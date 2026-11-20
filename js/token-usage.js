// AI token usage per day, counted from the "usage" each API reply reports, with an estimated cost.
// A normal API key can't read the real balance, so this is the app's own count, not Anthropic's bill.
// No page or state access, so every rule is unit-tested (tests/unit/token-usage.test.mjs).

// List prices in US dollars per million tokens (Anthropic bills in USD). Claude Haiku 5.5 costs more
// for prompts above 100K tokens; the app's prompts are far below that. Update when prices change.
export const PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longInput: 0.5, longOutput: 2.5, longFrom: 100000 }
};
// Prompt caching: writing to the cache costs 1.25x the input price, reading from it 0.1x.
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

const count = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

// Tokens and estimated dollars for one reply's usage object. Cache tokens count as input tokens.
export function usageCost(usage, model) {
  const price = PRICES[model];
  const plain = count(usage && usage.input_tokens);
  const written = count(usage && usage.cache_creation_input_tokens);
  const read = count(usage && usage.cache_read_input_tokens);
  const output = count(usage && usage.output_tokens);
  const input = plain + written + read;
  if (!price) {
    return { input, output, cost: null };
  }
  const long = input > price.longFrom;
  const inputPrice = long ? price.longInput : price.input;
  const outputPrice = long ? price.longOutput : price.output;
  const cost =
    ((plain + written * CACHE_WRITE + read * CACHE_READ) * inputPrice + output * outputPrice) /
    1000000;
  return { input, output, cost };
}

// Adds one reply to the per-day totals ({ "YYYY-MM-DD": { input, output, cost, requests } }).
// Days older than about 13 months are dropped, so the stored log stays small.
export function addUsage(days, date, usage, model) {
  const { input, output, cost } = usageCost(usage, model);
  const day = days[date] || { input: 0, output: 0, cost: 0, requests: 0 };
  const next = {
    ...days,
    [date]: {
      input: day.input + input,
      output: day.output + output,
      cost: day.cost + (cost || 0),
      requests: day.requests + 1
    }
  };
  const oldest = shiftMonths(date, -13);
  Object.keys(next).forEach((key) => {
    if (key < oldest) {
      delete next[key];
    }
  });
  return next;
}

// "2026-11-20" moved by a number of months, to the first day of that month.
function shiftMonths(date, months) {
  const [year, month] = date.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
}

// Totals for the month of a date ("2026-11-20" → all of November 2026).
export function monthTotals(days, date) {
  const prefix = date.slice(0, 7);
  return Object.entries(days)
    .filter(([key]) => key.startsWith(prefix))
    .reduce(
      (sum, [, day]) => ({
        input: sum.input + day.input,
        output: sum.output + day.output,
        cost: sum.cost + day.cost,
        requests: sum.requests + day.requests
      }),
      { input: 0, output: 0, cost: 0, requests: 0 }
    );
}

// Every day of the month up to and including the date, with its tokens (0 on days without use).
export function monthDays(days, date) {
  const [year, month, last] = date.split("-").map(Number);
  const result = [];
  for (let day = 1; day <= last; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const entry = days[key] || { input: 0, output: 0 };
    result.push({ date: key, input: entry.input, output: entry.output });
  }
  return result;
}

// How the month stands against the budget (in tokens): the share used and a level for the bar.
// No budget (null or 0) means no share and no warning.
export function budgetStatus(totals, budget) {
  if (!(typeof budget === "number" && budget > 0)) {
    return { share: null, level: "none" };
  }
  const share = (totals.input + totals.output) / budget;
  return { share, level: share >= 1 ? "over" : share >= 0.8 ? "warning" : "ok" };
}

// Validates the stored usage log; anything malformed is dropped rather than breaking the totals.
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result = {};
  Object.entries(raw).forEach(([key, day]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && day && typeof day === "object") {
      result[key] = {
        input: count(day.input),
        output: count(day.output),
        cost: count(day.cost),
        requests: count(day.requests)
      };
    }
  });
  return result;
}
