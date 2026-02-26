import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { searchRelevantChunks } from "./rag-service.js";
import { needsHumanHandoff, HANDOFF_MESSAGE } from "./handoff.js";

const prisma = new PrismaClient();

/**
 * Get or create the support conversation for the given user.
 */
export async function getOrCreateConversation(userId) {
  let conv = await prisma.supportConversation.findUnique({
    where: { userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conv) {
    conv = await prisma.supportConversation.create({
      data: { userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  }
  return conv;
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
  } else {
    const contextChunks = await searchRelevantChunks(content, 5);
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

    const systemPrompt = `You are a friendly, helpful support assistant for TechConnex. You help users understand how to use the platform using the Company and Provider manuals.

Use the "Previous conversation" below to keep context. Reply in a natural, continuous way (e.g. refer back to what they asked if needed, or follow up on a previous topic).

How to respond:

1. **Open or vague messages** (e.g. "I need help", "Hi", "What can you do?"): Reply in a warm, welcoming way. Invite them to ask something specific. For example: "I'd be happy to help! You can ask me about posting projects, sending proposals, milestones, payments, finding providers or companies, and more. What would you like to know?" Do NOT reply with "The manuals don't cover that" or "contact support" to a greeting or general "I need help"—always engage and point them to topics you can help with.

2. **Specific questions**: When the user asks something concrete, use the reference excerpts below to answer. Be concise and clear. If the excerpts clearly contain the answer, give it. If the question is specific but the excerpts don't have it, give a brief helpful suggestion (e.g. which part of the platform might be relevant) and only then mention they can contact support for more detail—do not lead with "the manuals don't cover that."

3. **Tone**: Be conversational and helpful. Avoid robotic or cold phrases. Never say only "What can I help you?" without adding value—e.g. suggest topics or ask what they'd like to know about.

4. Do not say "a human agent will join" or "a support agent will assist you" in your reply; the system handles handoff automatically when needed.`;

    const prompt = PromptTemplate.fromTemplate(
      `${systemPrompt}\n\nReference excerpts:\n{context}\n\nPrevious conversation:\n{conversationHistory}\n\nLatest user message: {question}\n\nYour reply (friendly and helpful, use the excerpts when they apply, and keep the conversation natural):`
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
