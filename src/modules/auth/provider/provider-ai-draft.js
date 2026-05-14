
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { prisma } from "../../../utils/prisma.js";
import { aiLocaleLanguage } from "../../../utils/aiDraftLocale.js";
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
Output language: {outputLanguage}. Keep names, numbers, and currency codes unchanged.

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
    const fallbackForLocale = (locale) => {
      const l = String(locale || "en").toLowerCase();
      const major = profile.major || "";
      const loc = profile.location || "";
      const years = profile.yearsExperience?.toString() || "";
      if (l.startsWith("id")) {
        return `${major || "Tenaga ahli"}${years ? `, ${years} tahun` : ""}${loc ? `, ${loc}` : ""}. Spesialisasi: ${skills}.`.slice(0, 180);
      }
      if (l.startsWith("ar")) {
        return `${major || "مقدم خدمات"}${years ? `، خبرة ${years} سنة` : ""}${loc ? `، ${loc}` : ""}. المهارات: ${skills}.`.slice(0, 180);
      }
      return `${major || "Experienced provider"}${years ? `, ${years} years experience` : ""}${loc ? `, based in ${loc}` : ""}. Skills: ${skills}.`.slice(0, 180);
    };
    const makeSummaryForLocale = async (locale) => {
      try {
        const result = await chain.invoke({
          name: profile.user?.name || "",
          major: profile.major || "",
          skills,
          yearsExperience: profile.yearsExperience?.toString() || "",
          hourlyRate: profile.hourlyRate?.toString() || "",
          location: profile.location || "",
          availability: profile.availability || "",
          workPreference: profile.workPreference || "",
          outputLanguage: aiLocaleLanguage(locale),
        });

        let text = String(result?.content || "").trim();
        if (text.startsWith("```") && text.endsWith("```")) {
          text = text.replace(/```[\s\S]*?```/g, "").trim();
        }
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim();
        if (text.length > 180) {
          text = text.slice(0, 177).trim();
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

    // Upsert: overwrite existing draft for this provider profile (no new records on re-submit)
    const existing = await prisma.aiDraft.findFirst({
      where: {
        type: "PROVIDER",
        referenceId: providerProfileId,
      },
    });

    const draftData = {
      summary: summaryMap,
      sourceData: {
        name: profile.user?.name || null,
        major: profile.major || null,
        skills: profile.skills || [],
        yearsExperience: profile.yearsExperience || null,
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
            type: "PROVIDER",
            referenceId: providerProfileId,
            version: 1,
            ...draftData,
          },
        });

    return saved;
  } catch (error) {
    console.error("createProviderAiDraft error:", error);
    throw error;
  }
}

/**
 * Generate or overwrite AI summary for the current user's provider profile.
 * Use after profile upsert so one draft per provider; re-submitting overwrites.
 * @param {string} userId - User.id (uuid)
 */
export async function upsertProviderAiDraftByUserId(userId) {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new Error("Provider profile not found");
  return createProviderAiDraft(profile.id);
}
