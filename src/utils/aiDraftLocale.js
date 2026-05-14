export function normalizeAiLocale(locale) {
  const code = String(locale || "en").trim().toLowerCase();
  if (code.startsWith("id")) return "id";
  if (code.startsWith("ar")) return "ar";
  return "en";
}

export function aiLocaleLanguage(locale) {
  if (locale === "id") return "Bahasa Indonesia";
  if (locale === "ar") return "Arabic";
  return "English";
}

export function parseAiDraftSummaryMap(value) {
  if (!value) return {};
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { en: text } : {};
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const locale = normalizeAiLocale(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text) out[locale] = text;
  }
  return out;
}

export function getAiDraftSummaryForLocale(value, locale = "en") {
  const map = parseAiDraftSummaryMap(value);
  const wanted = normalizeAiLocale(locale);
  return map[wanted] || map.en || map.id || map.ar || "";
}

export function hasAiDraftSummaryForLocale(value, locale = "en") {
  const map = parseAiDraftSummaryMap(value);
  const wanted = normalizeAiLocale(locale);
  return typeof map[wanted] === "string" && map[wanted].trim().length > 0;
}
