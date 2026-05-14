import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshotRatesMap,
  convertWithSnapshot,
  buildBudgetDisplayData,
} from "./service.js";

test("buildSnapshotRatesMap keeps MYR baseline", () => {
  const rates = buildSnapshotRatesMap([]);
  assert.equal(rates.MYR.unit, 1);
  assert.equal(rates.MYR.middleRate, 1);
});

test("convertWithSnapshot handles unit=100 currencies", () => {
  const ratesMap = {
    MYR: { unit: 1, middleRate: 1 },
    JPY: { unit: 100, middleRate: 2.5257 },
    USD: { unit: 1, middleRate: 4.72 },
  };

  const converted = convertWithSnapshot({
    amount: 1000,
    fromCurrencyCode: "JPY",
    toCurrencyCode: "USD",
    ratesMap,
  });

  assert.equal(typeof converted, "number");
  assert.ok(converted > 0);
});

test("buildBudgetDisplayData falls back when target missing", () => {
  const data = buildBudgetDisplayData(
    {
      budgetMin: 500,
      budgetMax: 1000,
      currencyCode: "USD",
      fxSnapshotRatesJson: {
        USD: { unit: 1, middleRate: 4.7 },
      },
    },
    "JPY",
  );

  assert.equal(data.displayCurrencyCode, "USD");
  assert.equal(data.displayBudgetMin, 500);
  assert.equal(data.displayBudgetMax, 1000);
});
