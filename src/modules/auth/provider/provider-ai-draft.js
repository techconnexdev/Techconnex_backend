import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const prisma = new PrismaClient();

/**
 * Generate a short AI summary (<=180 chars) for a provider profile and save to AiDraft
 * @param {string} providerProfileId - ProviderProfile.id (uuid)
 */
export async function createProviderAiDraft(providerProfileId) {
  try {
    const profile = await prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        // include user basic info to enrich the draft
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!profile) throw new Error("Provider profile not found");

    // Prepare prompt
    const prompt = PromptTemplate.fromTemplate(`
You are an assistant that writes a concise professional summary for a freelancer/provider profile.

Profile data:
- Name: {name}
- Major/Title: {major}
- Skills: {skills}
- Years Experience: {yearsExperience}
- Hourly Rate: {hourlyRate}
- Location: {location}
- Availability: {availability}
- Work Preference: {workPreference}

Write a single clear, professional brief describing this provider's core offering and strengths.
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

    const skills =
      (profile.skills || []).slice(0, 6).join(", ") ||
      "Experienced professional";

    const chain = RunnableSequence.from([prompt, model]);

    const result = await chain.invoke({
      name: profile.user?.name || "",
      major: profile.major || "",
      skills,
      yearsExperience: profile.yearsExperience?.toString() || "",
      hourlyRate: profile.hourlyRate?.toString() || "",
      location: profile.location || "",
      availability: profile.availability || "",
      workPreference: profile.workPreference || "",
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
      text = `${
        profile.major || "Experienced provider"
      } with skills in ${skills}`.slice(0, 180);
    }

    // Save to AiDraft table
    const saved = await prisma.aiDraft.create({
      data: {
        type: "PROVIDER",
        referenceId: providerProfileId,
        summary: text,
        version: 1,
        sourceData: {
          name: profile.user?.name || null,
          major: profile.major || null,
          skills: profile.skills || [],
          yearsExperience: profile.yearsExperience || null,
        },
      },
    });

    return saved;
  } catch (error) {
    console.error("createProviderAiDraft error:", error);
    throw error;
  }
}
