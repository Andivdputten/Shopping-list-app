// Unit tests for AI token usage and the cost estimate (js/token-usage.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addUsage,
  budgetStatus,
  monthDays,
  monthTotals,
  normalizeUsage,
  usageCost
} from "../../js/token-usage.js";

const MODEL = "claude-haiku-5-5";
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);

test("a reply's cost: input at $0.10 and output at $0.50 per million tokens", () => {
  const result = usageCost({ input_tokens: 2000, output_tokens: 6000 }, MODEL);
  assert.deepEqual([result.input, result.output], [2000, 6000]);
  // 2000 × 0.10 / 1M + 6000 × 0.50 / 1M = 0.0002 + 0.003
  close(result.cost, 0.0032);
});

test("cache tokens count as input, written at 1.25x and read at 0.1x the input price", () => {
  const result = usageCost(
    {
      input_tokens: 1000,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 10000,
      output_tokens: 0
    },
    MODEL
  );
  assert.equal(result.input, 12000);
  close(result.cost, ((1000 + 1250 + 1000) * 0.1) / 1000000);
});

test("prompts above 100K tokens use the higher prices; unknown models have no cost", () => {
  close(
    usageCost({ input_tokens: 200000, output_tokens: 1000 }, MODEL).cost,
    (200000 * 0.5 + 1000 * 2.5) / 1e6
  );
  assert.equal(usageCost({ input_tokens: 10, output_tokens: 10 }, "some-other-model").cost, null);
  assert.deepEqual(usageCost(null, MODEL), { input: 0, output: 0, cost: 0 });
});

test("usage adds up per day and per month; old days are dropped", () => {
  let days = {};
  days = addUsage(days, "2026-11-19", { input_tokens: 1000, output_tokens: 3000 }, MODEL);
  days = addUsage(days, "2026-11-20", { input_tokens: 1500, output_tokens: 4000 }, MODEL);
  days = addUsage(days, "2026-11-20", { input_tokens: 500, output_tokens: 1000 }, MODEL);
  days = addUsage(days, "2026-10-31", { input_tokens: 9999, output_tokens: 9999 }, MODEL);
  assert.deepEqual(days["2026-11-20"].requests, 2);
  const totals = monthTotals(days, "2026-11-20");
  assert.deepEqual([totals.input, totals.output, totals.requests], [3000, 8000, 3]);
  close(totals.cost, (3000 * 0.1 + 8000 * 0.5) / 1e6);

  const days20 = monthDays(days, "2026-11-20");
  assert.equal(days20.length, 20);
  assert.deepEqual(days20[0], { date: "2026-11-01", input: 0, output: 0 });
  assert.deepEqual(days20.at(-1), { date: "2026-11-20", input: 2000, output: 5000 });

  // 13 months back from January 2028 is December 2026, so the November 2026 days are gone.
  const later = addUsage(days, "2028-01-15", { input_tokens: 1, output_tokens: 1 }, MODEL);
  assert.deepEqual(Object.keys(later), ["2028-01-15"]);
});

test("the budget is in tokens: warning from 80%, over from 100%, nothing without a budget", () => {
  const totals = { input: 30000, output: 50000, cost: 0, requests: 1 };
  assert.deepEqual(budgetStatus(totals, 200000), { share: 0.4, level: "ok" });
  assert.equal(budgetStatus(totals, 100000).level, "warning");
  assert.equal(budgetStatus(totals, 80000).level, "over");
  assert.deepEqual(budgetStatus(totals, null), { share: null, level: "none" });
  assert.equal(budgetStatus(totals, 0).level, "none");
});

test("stored usage is validated", () => {
  assert.deepEqual(normalizeUsage(null), {});
  assert.deepEqual(normalizeUsage([1]), {});
  assert.deepEqual(
    normalizeUsage({ "2026-11-20": { input: 5, output: "x", cost: -1 }, nonsense: { input: 1 } }),
    { "2026-11-20": { input: 5, output: 0, cost: 0, requests: 0 } }
  );
});
