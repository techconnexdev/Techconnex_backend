const BNM_EXCHANGE_RATE_URL = "https://api.bnm.gov.my/public/exchange-rate";
const DEFAULT_TIMEOUT_MS = 10000;

export function normalizeCurrencyCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function buildSnapshotRatesMap(rawData = []) {
  const ratesMap = {
    MYR: {
      unit: 1,
      middleRate: 1,
    },
  };

  for (const row of rawData) {
    const code = normalizeCurrencyCode(row?.currency_code);
    const unit = Number(row?.unit);
    const middleRate = Number(row?.rate?.middle_rate);
    if (!code || !Number.isFinite(unit) || unit <= 0) continue;
    if (!Number.isFinite(middleRate) || middleRate <= 0) continue;

    ratesMap[code] = { unit, middleRate };
  }

  return ratesMap;
}

export async function fetchLatestFxSnapshot() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(BNM_EXCHANGE_RATE_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.BNM.API.v1+json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`BNM exchange rate request failed (${res.status})`);
    }

    const payload = await res.json();
    const ratesMap = buildSnapshotRatesMap(payload?.data || []);

    return {
      ratesMap,
      date: payload?.meta?.last_updated || payload?.data?.[0]?.rate?.date || null,
      session: payload?.meta?.session || null,
      quote: payload?.meta?.quote || "RM",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function convertWithSnapshot({
  amount,
  fromCurrencyCode,
  toCurrencyCode,
  ratesMap,
}) {
  const value = Number(amount);
  const fromCode = normalizeCurrencyCode(fromCurrencyCode);
  const toCode = normalizeCurrencyCode(toCurrencyCode);
  if (!Number.isFinite(value)) return null;
  if (!fromCode || !toCode || !ratesMap) return null;

  const from = ratesMap[fromCode];
  const to = ratesMap[toCode];
  if (!from || !to) return null;

  const amountInMyr = value * (Number(from.middleRate) / Number(from.unit));
  const converted = amountInMyr / (Number(to.middleRate) / Number(to.unit));

  if (!Number.isFinite(converted)) return null;
  return Number(converted.toFixed(2));
}

export function hasCurrencyInSnapshot(currencyCode, ratesMap) {
  const code = normalizeCurrencyCode(currencyCode);
  return Boolean(code && ratesMap && ratesMap[code]);
}

export function buildBudgetDisplayData(item, preferredCurrency) {
  const originalCurrencyCode = normalizeCurrencyCode(item?.currencyCode || "MYR");
  const targetCurrencyCode = normalizeCurrencyCode(preferredCurrency || "MYR");
  const ratesMap = item?.fxSnapshotRatesJson || null;

  const convertedMin = convertWithSnapshot({
    amount: item?.budgetMin,
    fromCurrencyCode: originalCurrencyCode,
    toCurrencyCode: targetCurrencyCode,
    ratesMap,
  });
  const convertedMax = convertWithSnapshot({
    amount: item?.budgetMax,
    fromCurrencyCode: originalCurrencyCode,
    toCurrencyCode: targetCurrencyCode,
    ratesMap,
  });

  const canConvert = convertedMin != null && convertedMax != null;

  return {
    originalBudgetMin: item?.budgetMin ?? null,
    originalBudgetMax: item?.budgetMax ?? null,
    originalCurrencyCode,
    displayBudgetMin: canConvert ? convertedMin : item?.budgetMin ?? null,
    displayBudgetMax: canConvert ? convertedMax : item?.budgetMax ?? null,
    displayCurrencyCode: canConvert ? targetCurrencyCode : originalCurrencyCode,
    conversionMeta: {
      snapshotDate: item?.fxSnapshotDate || null,
      snapshotSession: item?.fxSnapshotSession || null,
      usedSnapshot: canConvert,
    },
  };
}
