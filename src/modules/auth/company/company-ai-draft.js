import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const prisma = new PrismaClient();

/**
 * Generate a short AI summary (<=180 chars) for a company/customer profile and save to AiDraft
 * @param {string} customerProfileId - CustomerProfile.id (uuid)
 */
export async function createCompanyAiDraft(customerProfileId) {
  try {
    const profile = await prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      include: {
        // include user basic info to enrich the draft
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!profile) throw new Error("Customer profile not found");

    // Prepare prompt
    const prompt = PromptTemplate.fromTemplate(`
You are an assistant that writes a concise professional summary for a company/customer profile.

Profile data:
- Name: {name}
- Industry: {industry}
- Location: {location}
- Company Size: {companySize}
- Description: {description}
- Established Year: {establishedYear}
- Employee Count: {employeeCount}
- Mission: {mission}
- Values: {values}
- Categories Hiring For: {categoriesHiringFor}

Write a single clear, professional brief describing this company's core business and strengths.
Constraints:
- Maximum 180 characters total (count characters, not words).
- One sentence only.
- No greetings, no punctuation at the end other than a period.
- Avoid mentioning private data (email).

Output only the brief text, nothing else.
`);

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const categoriesHiringFor =
      (profile.categoriesHiringFor || []).slice(0, 3).join(", ") ||
      "Various industries";

    const values =
      (profile.values || []).slice(0, 3).join(", ") || "Professional";

    const chain = RunnableSequence.from([prompt, model]);

    const result = await chain.invoke({
      name: profile.user?.name || "",
      industry: profile.industry || "General",
      location: profile.location || "",
      companySize: profile.companySize || "",
      description: (profile.description || "").slice(0, 200),
      establishedYear: profile.establishedYear?.toString() || "",
      employeeCount: profile.employeeCount?.toString() || "",
      mission: (profile.mission || "").slice(0, 200),
      values,
      categoriesHiringFor,
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
      text = `${profile.industry || "Company"} in ${profile.location || "Malaysia"} looking for ${categoriesHiringFor}`.slice(0, 180);
    }

    // Save to AiDraft table
    const saved = await prisma.aiDraft.create({
      data: {
        type: "CUSTOMER",
        referenceId: customerProfileId,
        summary: text,
        version: 1,
        sourceData: {
          name: profile.user?.name || null,
          industry: profile.industry || null,
          location: profile.location || null,
          companySize: profile.companySize || null,
          description: profile.description || null,
        },
      },
    });

    return saved;
  } catch (error) {
    console.error("createCompanyAiDraft error:", error);
    throw error;
  }
}

