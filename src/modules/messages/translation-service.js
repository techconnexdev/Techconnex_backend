/**
 * OpenAI-backed chat message translation (viewer locale: en | id | ar).
 */
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { prisma } from "../../utils/prisma.js";

const SUPPORTED = new Set(["en", "id", "ar"]);

/**
 * Normalize LangChain AIMessage / chunk content (string | blocks | objects).
 */
function extractTextFromModelResponse(res) {
  if (res == null) return "";
  if (typeof res === "string") return res;

  const raw = res.content != null ? res.content : res.text;
  if (typeof raw === "string") return raw;

  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          if (typeof part.text === "string") return part.text;
          if (part.type === "text" && typeof part.text === "string")
            return part.text;
        }
        return "";
      })
      .join("");
  }

  if (raw && typeof raw === "object" && typeof raw.text === "string") {
    return raw.text;
  }

  try {
    return String(raw ?? "");
  } catch {
    return "";
  }
}

export function normalizeLocaleInput(input) {
  if (typeof input !== "string" || !input.trim()) return "";
  const base = input.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.has(base) ? base : "";
}

export async function getUserPreferredLocale(userId) {
  const row = await prisma.settings.findUnique({
    where: { userId },
    select: { locale: true },
  });
  const raw = row?.locale || "en";
  return normalizeLocaleInput(raw) || "en";
}

const LANG_NAMES = {
  en: "English",
  id: "Indonesian",
  ar: "Arabic",
};

/**
 * Translate strings in order (one API call per non-empty string).
 * Returns array of same length; null means failure for that item.
 */
export async function translateTextsInOrder(texts, targetLocale) {
  const locale = normalizeLocaleInput(targetLocale) || "en";
  const langName = LANG_NAMES[locale] || "English";

  if (!String(process.env.OPENAI_API_KEY ?? "").trim()) {
    throw new Error(
      "OPENAI_API_KEY is not set — add it to Backend/.env and restart the server.",
    );
  }

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MESSAGE_TRANSLATE_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const results = [];
  for (const text of texts) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
      results.push("");
      continue;
    }
    try {
      const prompt = `Translate the following chat message into ${langName} (locale code: ${locale}). Preserve meaning, tone, emojis, URLs, and line breaks. Reply with ONLY the translated text — no quotes, labels, or preamble.\n\nMessage:\n${trimmed}`;
      const res = await model.invoke([new HumanMessage(prompt)]);
      const out = extractTextFromModelResponse(res).trim();
      results.push(out.length > 0 ? out : null);
    } catch (e) {
      console.error("translateTextsInOrder failed:", e?.message || e);
      results.push(null);
    }
  }
  return results;
}

/**
 * Attach translatedContent for text messages (does not mutate stored content).
 */
export async function enrichMessagesWithTranslations(
  messages,
  userId,
  options = {},
) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const targetLocale =
    normalizeLocaleInput(options.targetLocale) ||
    (await getUserPreferredLocale(userId));

  const indices = [];
  const toTranslate = [];

  messages.forEach((m, i) => {
    if (m.messageType === "text" && String(m.content ?? "").trim()) {
      indices.push(i);
      toTranslate.push(String(m.content));
    }
  });

  if (toTranslate.length === 0) return messages;

  let outs;
  try {
    outs = await translateTextsInOrder(toTranslate, targetLocale);
  } catch (e) {
    console.error("enrichMessagesWithTranslations:", e?.message || e);
    return messages;
  }

  const byMsgIndex = new Map();
  indices.forEach((msgIndex, j) => {
    byMsgIndex.set(msgIndex, outs[j]);
  });

  return messages.map((m, i) => {
    if (m.messageType !== "text") return m;
    const tr = byMsgIndex.get(i);
    if (tr == null || !String(tr).trim()) return m;
    return { ...m, translatedContent: tr };
  });
}
