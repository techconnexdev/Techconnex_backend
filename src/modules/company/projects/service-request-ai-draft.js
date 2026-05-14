
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { prisma } from "../../../utils/prisma.js";
import { aiLocaleLanguage } from "../../../utils/aiDraftLocale.js";
/**
 * Generate a short AI summary (<=180 chars) for a service request and save to AiDraft
 * @param {string} serviceRequestId - ServiceRequest.id (uuid)
 */
export async function createServiceRequestAiDraft(serviceRequestId) {
  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        // include customer info to enrich the draft
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Fetch customer profile separately if needed
    let customerProfile = null;
    if (serviceRequest?.customer?.id) {
      customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: serviceRequest.customer.id },
        select: {
          industry: true,
          location: true,
          companySize: true,
        },
      });
    }

    if (!serviceRequest) throw new Error("Service request not found");

    // Prepare prompt
    const prompt = PromptTemplate.fromTemplate(`
You are an assistant that writes a concise, high-signal project opportunity summary for providers.
Output language: {outputLanguage}. Keep names, numbers, and currency codes unchanged.

Service request data:
- Title: {title}
- Description: {description}
- Category: {category}
- Budget: RM {budgetMin} - RM {budgetMax}
- Timeline: {timeline}
- Skills Required: {skills}
- Priority: {priority}
- Company: {companyName}
- Industry: {industry}

Write one sentence that makes this opportunity useful at a glance.
The sentence MUST include:
1) Main project intent/outcome,
2) Required tech/skills (at least 2 if available),
3) Budget and timeline fit.

Constraints:
- Maximum 220 characters total (count characters, not words).
- One sentence only.
- Plain text only.
- No greetings, no hashtags, no emojis.
- Avoid vague wording like "great opportunity" without specifics.
- Avoid mentioning private data.

Output only the sentence.
`);

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const skills =
      (serviceRequest.skills || []).slice(0, 5).join(", ") ||
      "Various skills";

    const chain = RunnableSequence.from([prompt, model]);
    const fallbackForLocale = (locale) => {
      const l = String(locale || "en").toLowerCase();
      if (l.startsWith("id")) {
        return `${serviceRequest.category || "Proyek"} untuk ${serviceRequest.title || "permintaan layanan"} membutuhkan ${skills} dengan anggaran RM ${serviceRequest.budgetMin || 0}-${serviceRequest.budgetMax || 0}`.slice(0, 180);
      }
      if (l.startsWith("ar")) {
        return `${serviceRequest.title || "طلب خدمة"} فرصة ${serviceRequest.category || "مشروع"} تتطلب ${skills} بميزانية RM ${serviceRequest.budgetMin || 0}-${serviceRequest.budgetMax || 0}`.slice(0, 180);
      }
      return `${serviceRequest.category || "Project"} opportunity requiring ${skills} with budget RM ${serviceRequest.budgetMin || 0}-${serviceRequest.budgetMax || 0}`.slice(0, 180);
    };
    const makeSummaryForLocale = async (locale) => {
      try {
        const result = await chain.invoke({
        title: serviceRequest.title || "",
        description: (serviceRequest.description || "").slice(0, 200),
        category: serviceRequest.category || "General",
        budgetMin: serviceRequest.budgetMin?.toString() || "0",
        budgetMax: serviceRequest.budgetMax?.toString() || "0",
        timeline: serviceRequest.timeline || "Not specified",
        skills,
        priority: serviceRequest.priority || "medium",
        companyName: serviceRequest.customer?.name || "Company",
        industry: customerProfile?.industry || "General",
        outputLanguage: aiLocaleLanguage(locale),
      });

        let text = String(result?.content || "").trim();
        if (text.startsWith("```") && text.endsWith("```")) {
          text = text.replace(/```[\s\S]*?```/g, "").trim();
        }
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim();
      if (text.length > 220) {
        text = text.slice(0, 217).trim();
          if (!text.endsWith("...")) text = text.replace(/[\s\S]$/g, "") + "...";
        }
        if (!text) return fallbackForLocale(locale);
        return text;
      } catch {
        return fallbackForLocale(locale);
      }
    };
    const [en, id, ar] = await Promise.all([
      makeSummaryForLocale("en"),
      makeSummaryForLocale("id"),
      makeSummaryForLocale("ar"),
    ]);
    const summaryMap = { en, id, ar };

    // Save to AiDraft table
    const existing = await prisma.aiDraft.findFirst({
      where: {
        type: "SERVICE_REQUEST",
        referenceId: serviceRequestId,
      },
      select: { id: true, version: true },
    });
    const draftData = {
      summary: summaryMap,
      sourceData: {
        title: serviceRequest.title || null,
        category: serviceRequest.category || null,
        budgetMin: serviceRequest.budgetMin || null,
        budgetMax: serviceRequest.budgetMax || null,
        skills: serviceRequest.skills || [],
      },
    };
    const saved = existing
      ? await prisma.aiDraft.update({
          where: { id: existing.id },
          data: {
            ...draftData,
            version: (existing.version || 1) + 1,
          },
        })
      : await prisma.aiDraft.create({
          data: {
            type: "SERVICE_REQUEST",
            referenceId: serviceRequestId,
            version: 1,
            ...draftData,
          },
        });

    return saved;
  } catch (error) {
    console.error("createServiceRequestAiDraft error:", error);
    throw error;
  }
}

