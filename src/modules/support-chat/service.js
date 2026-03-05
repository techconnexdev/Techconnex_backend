import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { searchRelevantChunks } from "./rag-service.js";
import { needsHumanHandoff, HANDOFF_MESSAGE } from "./handoff.js";
import { sendEmail } from "../auth/sendEmail.js";

const prisma = new PrismaClient();

/**
 * Fetch user context (name + role) for AI personalization. Detects provider vs company (CUSTOMER).
 * Returns { displayName, primaryRole, roleDescription } for use in prompts.
 */
async function getUserContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true },
  });
  if (!user) return { displayName: "User", primaryRole: "unknown", roleDescription: "a platform user" };

  const roles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : [];
  const displayName = (user.name || "").trim() || "User";

  // Primary role for support: PROVIDER vs CUSTOMER (company)
  let primaryRole = "unknown";
  let roleDescription = "a platform user";
  if (roles.includes("PROVIDER")) {
    primaryRole = "provider";
    roleDescription = "a provider (freelancer/service provider) who finds projects and sends proposals to companies";
  } else if (roles.includes("CUSTOMER")) {
    primaryRole = "company";
    roleDescription = "a company/customer who posts projects and hires providers";
  }

  return { displayName, primaryRole, roleDescription };
}

/**
 * Build a short "user situation" summary for assistant-style suggestions.
 * Returns a string (or empty) so the AI can suggest/remind when relevant. Does not change any behavior.
 */
async function getUserSituation(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        kycStatus: true,
        providerProfile: { select: { completion: true } },
      },
    });
    if (!user) return "";

    const roles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : [];
    const lines = [];

    if (roles.includes("PROVIDER")) {
      const [proposalCount, projectCount, unreadCount] = await Promise.all([
        prisma.proposal.count({ where: { providerId: userId } }),
        prisma.project.count({ where: { providerId: userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);
      if (user.kycStatus !== "active") {
        lines.push("KYC is not yet verified (pending or inactive).");
      }
      const completion = user.providerProfile?.completion;
      if (completion != null && completion < 100) {
        lines.push(`Profile completion: ${completion}%.`);
      }
      if (proposalCount > 0) lines.push(`${proposalCount} proposal(s) sent.`);
      if (projectCount > 0) lines.push(`${projectCount} project(s) as provider.`);
      if (unreadCount > 0) lines.push(`${unreadCount} unread notification(s).`);
    }

    if (roles.includes("CUSTOMER")) {
      const [openRequests, projectCount, unreadCount] = await Promise.all([
        prisma.serviceRequest.count({ where: { customerId: userId, status: "OPEN" } }),
        prisma.project.count({ where: { customerId: userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);
      if (openRequests > 0) lines.push(`${openRequests} open request(s) for providers.`);
      if (projectCount > 0) lines.push(`${projectCount} project(s) as company.`);
      if (unreadCount > 0) lines.push(`${unreadCount} unread notification(s).`);
    }

    return lines.length ? lines.join(" ") : "";
  } catch (err) {
    console.error("getUserSituation error:", err);
    return "";
  }
}

/**
 * Generate a one-sentence summary of the user's issue from the conversation (for handoff email).
 * Returns fallback text on error or if no context.
 */
async function summarizeConversationForHandoff(conversationId, lastUserMessage) {
  try {
    const messages = await prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const lines = messages.map((m) => {
      const label = m.senderType === "HUMAN" ? "User" : m.senderType === "AI" ? "Assistant" : "Support";
      return `${label}: ${(m.content || "").trim().slice(0, 300)}`;
    });
    const conversationText = lines.join("\n");
    if (!conversationText.trim()) return lastUserMessage?.slice(0, 300) || "No messages yet.";

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    const result = await model.invoke(
      `Based on this support conversation, summarize the user's issue or request in one short sentence for an admin. Reply with only that sentence, no prefix.\n\nConversation:\n${conversationText}`
    );
    const summary = (result.content && typeof result.content === "string" ? result.content : "").trim();
    return summary || lastUserMessage?.slice(0, 300) || "See conversation.";
  } catch (err) {
    console.error("Handoff summary error:", err);
    return lastUserMessage?.slice(0, 300) || "See conversation.";
  }
}

/**
 * List support conversations for the user (for history). Optional status filter (e.g. CLOSED).
 * Returns id, status, updatedAt, messageCount, lastMessage (content, senderType, createdAt).
 */
export async function listUserConversations(userId, statusFilter) {
  const where = { userId };
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  const conversations = await prisma.supportConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true, senderType: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });
  return conversations.map((c) => ({
    id: c.id,
    userId: c.userId,
    status: c.status,
    updatedAt: c.updatedAt,
    messageCount: c._count.messages,
    lastMessage: c.messages[0]
      ? {
          id: c.messages[0].id,
          content: c.messages[0].content,
          senderType: c.messages[0].senderType,
          createdAt: c.messages[0].createdAt,
        }
      : null,
  }));
}

/**
 * Get a single conversation by id. Only returns if it belongs to the user.
 */
export async function getConversationByIdForUser(conversationId, userId) {
  const conversation = await prisma.supportConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  return conversation;
}

/**
 * Get the latest support conversation for the user, or create one if none exist.
 */
export async function getOrCreateConversation(userId) {
  const latest = await prisma.supportConversation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (latest) return latest;
  return prisma.supportConversation.create({
    data: { userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Start a new support conversation for the user (e.g. after previous was closed).
 */
export async function startNewConversation(userId) {
  return prisma.supportConversation.create({
    data: { userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Add a user message and generate AI reply (or handoff). Persist both.
 * Status rules: OPEN / HANDOFF_REQUESTED = AI can reply; HUMAN_TAKEN = only save user message; CLOSED = reject (caller should check).
 */
export async function addUserMessageAndReply(conversationId, userId, content, attachmentUrls = []) {
  const conv = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });
  if (!conv || conv.userId !== userId) throw new Error("Conversation not found");
  if (conv.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

  const userMessage = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: "HUMAN",
      senderUserId: userId,
      content: (content || "").trim(),
      attachments: Array.isArray(attachmentUrls) ? attachmentUrls : [],
    },
  });

  // When human has taken over, do not generate AI reply
  if (conv.status === "HUMAN_TAKEN") {
    return { userMessage, aiMessage: null };
  }

  let aiMessage;
  if (needsHumanHandoff(content)) {
    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        status: "HANDOFF_REQUESTED",
        handoffRequestedAt: new Date(),
      },
    });
    aiMessage = await prisma.supportMessage.create({
      data: {
        conversationId,
        senderType: "AI",
        content: HANDOFF_MESSAGE,
        metadata: { handoffTriggered: true },
      },
    });
    // Notify admin that a human is needed (fire-and-forget; do not block response)
    const adminEmail =
      process.env.SUPPORT_HANDOFF_NOTIFY_EMAIL || process.env.MAIL_USER;
    if (adminEmail) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const userName = (user?.name || "").trim() || "User";
      const userEmail = user?.email || "(unknown)";
      const lastMessage = (content || "").trim();
      const issueSummary = await summarizeConversationForHandoff(conversationId, lastMessage);
      const text = [
        "A support conversation has been escalated and needs a human response.",
        "",
        "Issue summary (AI): " + issueSummary,
        "",
        `Conversation ID: ${conversationId}`,
        `User: ${userName} (${userEmail})`,
        `Latest user message: ${lastMessage.slice(0, 500)}`,
        "",
        "Please take over the conversation in the admin support panel.",
      ].join("\n");
      sendEmail({
        to: adminEmail,
        subject: "TechConnex Support: Human handoff requested",
        text,
      }).catch((err) => console.error("Handoff notification email failed:", err));
    }
  } else {
    const [userContext, userSituation] = await Promise.all([
      getUserContext(userId),
      getUserSituation(userId),
    ]);
    const contextChunks = await searchRelevantChunks(content, 10, userContext.primaryRole);
    const contextText = contextChunks.length
      ? contextChunks.map((c) => c.content).join("\n\n---\n\n")
      : "(No specific excerpt matched yet. Use this when the user message is vague or open-ended.)";

    // Fetch recent conversation history (last 16 messages, chronological order) for context
    const recentMessages = await prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 16,
    });
    const messagesForHistory = recentMessages.reverse();
    const conversationHistoryLines = messagesForHistory.map((m) => {
      const text = (m.content || "").trim();
      if (m.senderType === "AI") return `Assistant: ${text}`;
      if (m.senderType === "HUMAN" && m.senderUserId === userId) return `User: ${text}`;
      return `Human support: ${text}`;
    });
    const conversationHistory = conversationHistoryLines.length
      ? conversationHistoryLines.join("\n")
      : "(No previous messages in this conversation.)";

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const userContextBlock =
      userContext.primaryRole === "unknown"
        ? `You are speaking with ${userContext.displayName}.`
        : `You are speaking with ${userContext.displayName}, who is ${userContext.roleDescription}.
Use this to tailor your answers: for providers, emphasize proposals, earnings, milestones, and finding companies; for companies, emphasize posting projects, hiring providers, milestones, and payments. You may address them by name when appropriate.`;

    const situationBlock = userSituation
      ? `**Current situation (use only to suggest or remind when relevant; do not invent):**
${userSituation}

`
      : "";

    const systemPrompt = `You are a friendly, helpful support assistant for TechConnex. You help users understand how to use the platform using the Company and Provider manuals.

**Who you're talking to:**
${userContextBlock}
${situationBlock}
Use the "Previous conversation" below to keep context. Reply in a natural, continuous way (e.g. refer back to what they asked if needed, or follow up on a previous topic).

How to respond:

1. **Open or vague messages** (e.g. "I need help", "Hi", "What can you do?"): Reply in a warm, welcoming way. Invite them to ask something specific, and suggest topics relevant to their role (providers: proposals, earnings; companies: projects, hiring). Do NOT reply with "The manuals don't cover that" or "contact support" to a greeting or general "I need help"—always engage and point them to topics you can help with.

2. **Specific questions**: When the user asks something concrete, use the reference excerpts below to answer. Be concise and clear. Tailor your answer to their role when relevant. If the excerpts clearly contain the answer, give it verbatim or closely paraphrased from the manual. Do NOT say "the manual typically covers" or "I can't provide the exact..."—if the excerpts contain a table of contents, chapter list, or structure, REPRODUCE IT from those excerpts.

3. **Table of contents / overview / structure questions**: When the user asks "what's in the manual", "table of contents", "what topics does it cover", "overview", etc., the excerpts below may contain that information. Look carefully for numbered lists, chapter titles, section headings, or any structured outline. If you find it in the excerpts, list it directly. If not, say the excerpts don't include a table of contents and suggest they ask about a specific topic.

4. **Tone**: Be conversational and helpful. Avoid robotic or cold phrases. Never say only "What can I help you?" without adding value—e.g. suggest topics or ask what they'd like to know about.

5. **User situation**: When "Current situation" is present above, you may briefly suggest or remind the user about it when relevant (e.g. complete profile, check proposals, KYC). Do not invent; only use the listed items. Keep it natural—one short line is enough.

6. **When the user asks for a real human, customer support, or to talk to an agent**: Do NOT immediately say they will be transferred. First offer guidance: briefly ask if there's something specific you can help with (e.g. payments, account, how-to). Then say that if they prefer to speak with our team, they can say "transfer me" or "yes, connect me" and you'll connect them. Keep it to one short paragraph. Do not say "a support agent will join shortly" or "I'm connecting you now" unless the user has already confirmed (e.g. "yes transfer me")—in that case the system will send a separate message.

7. Do not say "a human agent will join" or "a support agent will assist you" in your reply; the system sends that message automatically when the user confirms they want to be transferred.`;

    const prompt = PromptTemplate.fromTemplate(
      `${systemPrompt}\n\nReference excerpts:\n{context}\n\nPrevious conversation:\n{conversationHistory}\n\nLatest user message: {question}\n\nYour reply (friendly and helpful, use the excerpts when they apply, tailor to the user's role, and keep the conversation natural):`
    );
    const chain = RunnableSequence.from([prompt, model]);

    let reply;
    try {
      const result = await chain.invoke({
        context: contextText,
        conversationHistory,
        question: content,
      });
      reply = result.content?.trim() || "I couldn't generate a reply. Please try rephrasing or ask for human support.";
    } catch (err) {
      console.error("Support chat LLM error:", err);
      reply = "Something went wrong. A support agent can help you—please wait or try again.";
    }

    aiMessage = await prisma.supportMessage.create({
      data: {
        conversationId,
        senderType: "AI",
        content: reply,
        metadata: {
          referencesUsed: contextChunks.map((c) => ({ documentSlug: c.documentSlug, snippet: c.content.slice(0, 200) })),
        },
      },
    });
  }

  return { userMessage, aiMessage: aiMessage ?? null };
}
