
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { prisma } from "../../../utils/prisma.js";
import { aiLocaleLanguage } from "../../../utils/aiDraftLocale.js";
/**
 * 
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
Output language: {outputLanguage}. Keep company names, numbers, and currency codes unchanged.

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
    const fallbackForLocale = (locale) => {
      const l = String(locale || "en").toLowerCase();
      const industry = profile.industry || "";
      const location = profile.location || "";
      if (l.startsWith("id")) {
        return `${industry || "Perusahaan"} di ${location || "wilayah Anda"} mencari talenta di ${categoriesHiringFor}.`.slice(0, 180);
      }
      if (l.startsWith("ar")) {
        return `${industry || "شركة"} في ${location || "المنطقة"} تبحث عن مواهب في ${categoriesHiringFor}.`.slice(0, 180);
      }
      return `${industry || "Company"} in ${location || "Malaysia"} hiring for ${categoriesHiringFor}.`.slice(0, 180);
    };
    const makeSummaryForLocale = async (locale) => {
      try {
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

    // Upsert: overwrite existing draft for this customer profile (no new records on re-submit)
    const existing = await prisma.aiDraft.findFirst({
      where: {
        type: "CUSTOMER",
        referenceId: customerProfileId,
      },
    });

    const draftData = {
      summary: summaryMap,
      sourceData: {
        name: profile.user?.name || null,
        industry: profile.industry || null,
        location: profile.location || null,
        companySize: profile.companySize || null,
        description: profile.description || null,
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
            type: "CUSTOMER",
            referenceId: customerProfileId,
            version: 1,
            ...draftData,
          },
        });

    return saved;
  } catch (error) {
    console.error("createCompanyAiDraft error:", error);
    throw error;
  }
}

/**
 * Generate or overwrite AI summary for the current user's company (customer) profile.
 * Use after profile upsert so one draft per customer; re-submitting overwrites.
 * @param {string} userId - User.id (uuid)
 */
export async function upsertCompanyAiDraftByUserId(userId) {
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new Error("Customer profile not found");
  return createCompanyAiDraft(profile.id);
}

