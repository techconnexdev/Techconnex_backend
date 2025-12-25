import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const prisma = new PrismaClient();

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
You are an assistant that writes a concise professional summary for a service request/project posting.

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

Write a single clear, professional brief describing this project opportunity and what makes it attractive.
Constraints:
- Maximum 180 characters total (count characters, not words).
- One sentence only.
- No greetings, no punctuation at the end other than a period.
- Focus on the project value and key requirements.
- Avoid mentioning private data (email).

Output only the brief text, nothing else.
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
    });

    let text = (result.content || "").trim();

    // Remove code fences or quotes
    if (text.startsWith("```") && text.endsWith("```")) {
      text = text.replace(/```[\s\S]*?```/g, "").trim();
    }
    if (text.startsWith('"') && text.endsWith('"'))
      text = text.slice(1, -1).trim();

    // Ensure length <= 180 chars
    if (text.length > 180) {
      text = text.slice(0, 177).trim();
      // end with ellipsis if truncated
      if (!text.endsWith("...")) text = text.replace(/[\s\S]$/g, "") + "...";
    }

    // Fallback if model returned empty
    if (!text) {
      text = `${serviceRequest.category || "Project"} opportunity requiring ${skills} with budget RM ${serviceRequest.budgetMin || 0}-${serviceRequest.budgetMax || 0}`.slice(0, 180);
    }

    // Save to AiDraft table
    const saved = await prisma.aiDraft.create({
      data: {
        type: "SERVICE_REQUEST",
        referenceId: serviceRequestId,
        summary: text,
        version: 1,
        sourceData: {
          title: serviceRequest.title || null,
          category: serviceRequest.category || null,
          budgetMin: serviceRequest.budgetMin || null,
          budgetMax: serviceRequest.budgetMax || null,
          skills: serviceRequest.skills || [],
        },
      },
    });

    return saved;
  } catch (error) {
    console.error("createServiceRequestAiDraft error:", error);
    throw error;
  }
}

