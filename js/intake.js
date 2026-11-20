// The intake log: what was eaten when, and how it adds up per day and per meal.
// No page or state access, so every rule is unit-tested (tests/unit/intake.test.mjs).
import { hasAnyNutrition, normalizeNutrition } from "./nutrition.js";
import { MEAL_TYPES } from "./targets.js";

export const NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fiber"];

// Entry status: how far its values can be trusted. Only "complete" and "estimated" count in full;
// "partial" (some data missing) and "unknown" (no data) are flagged on the Today tab, never counted as zero.
const STATUSES = ["complete", "partial", "estimated", "unknown"];

// Sources of an entry's values: NEVO, Open Food Facts, a pantry item, typed by hand, a recipe or the AI.
export const NUTRITION_SOURCES = ["nevo", "off", "pantry", "manual", "recipe", "estimated"];

const round1 = (value) => Math.round(value * 10) / 10;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

function emptyValues() {
  return { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
}

// The calendar date of a moment on this device, as "YYYY-MM-DD"; days run from local midnight to midnight.
export function dateKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The date `days` days before (negative) or after (positive) a "YYYY-MM-DD" date.
export function shiftDate(key, days) {
  const [year, month, day] = key.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day + days));
}

// The meal an entry belongs to by default: before 10:30 breakfast, before 15:00 lunch,
// before 21:00 dinner, otherwise a snack.
export function mealForTime(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60) return "lunch";
  if (minutes < 21 * 60) return "dinner";
  return "snack";
}

// Turns a product's nutrition per 100 g into values per gram, with a status for how complete it is.
export function perGramFromNutrition(nutrition) {
  const data = normalizeNutrition(nutrition);
  const perUnit = {
    kcal: data.kcal100g === null ? null : data.kcal100g / 100,
    protein: data.protein100g === null ? null : data.protein100g / 100,
    carbs: data.carbs100g === null ? null : data.carbs100g / 100,
    fat: data.fat100g === null ? null : data.fat100g / 100,
    fiber: data.fiber100g === null ? null : data.fiber100g / 100
  };
  const status = perUnit.kcal !== null ? "complete" : hasAnyNutrition(data) ? "partial" : "unknown";
  return { perUnit, status };
}

// A recipe's values per serving from its ingredients' nutrition and grams.
// "partial" when some ingredient has no nutrition data or amount; with no data at all, the AI's
// per-serving estimate (when given) stands in as "estimated", otherwise the values are "unknown".
export function perServingFromRecipe(recipe, estimate) {
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const totals = emptyValues();
  let withData = 0;

  recipe.ingredients.forEach((ingredient) => {
    const grams = isNumber(ingredient.grams) && ingredient.grams > 0 ? ingredient.grams : null;
    const data = normalizeNutrition(ingredient.nutrition);
    if (grams === null || !hasAnyNutrition(data)) {
      return;
    }
    withData++;
    [
      ["kcal", data.kcal100g],
      ["protein", data.protein100g],
      ["carbs", data.carbs100g],
      ["fat", data.fat100g],
      ["fiber", data.fiber100g]
    ].forEach(([key, per100g]) => {
      if (per100g !== null) {
        totals[key] = (totals[key] || 0) + (per100g * grams) / 100;
      }
    });
  });

  if (withData === 0) {
    if (estimate && isNumber(estimate.kcal)) {
      const perUnit = emptyValues();
      NUTRIENTS.forEach((key) => {
        perUnit[key] = isNumber(estimate[key]) ? estimate[key] : null;
      });
      return { perUnit, status: "estimated" };
    }
    return { perUnit: emptyValues(), status: "unknown" };
  }

  const perUnit = emptyValues();
  NUTRIENTS.forEach((key) => {
    perUnit[key] = totals[key] === null ? null : round1(totals[key] / servings);
  });
  return { perUnit, status: withData === recipe.ingredients.length ? "complete" : "partial" };
}

// A new log entry. unit is "serving", "g" or "" (a quick entry); its values are perUnit times quantity.
// The values are stored as they are now, so later changes to a recipe or product don't rewrite history.
export function createEntry({
  date,
  meal,
  name,
  source,
  unit,
  quantity,
  perUnit,
  status,
  time,
  nutritionSource = null,
  nevoVersion = null
}) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    time: time || "",
    meal,
    name,
    source,
    unit,
    quantity,
    perUnit: { ...emptyValues(), ...perUnit },
    status,
    nutritionSource,
    nevoVersion
  };
}

// The NEVO versions behind a day's entries, for RIVM's required reference under that day's totals.
export function nevoVersionsUsed(entries, date) {
  return [
    ...new Set(
      entries
        .filter((entry) => entry.date === date && entry.nutritionSource === "nevo")
        .map((entry) => entry.nevoVersion)
        .filter(Boolean)
    )
  ];
}

// An entry's values: per-unit values times the quantity, rounded to 1 decimal; unknown values stay null.
export function entryNutrition(entry) {
  const values = emptyValues();
  NUTRIENTS.forEach((key) => {
    const perUnit = entry.perUnit[key];
    values[key] = perUnit === null ? null : round1(perUnit * entry.quantity);
  });
  return values;
}

// Totals for one day (known values added up), how many entries aren't fully counted, and the entry count.
export function dayTotals(entries, date) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let notFullyCounted = 0;
  let count = 0;

  entries
    .filter((entry) => entry.date === date)
    .forEach((entry) => {
      count++;
      if (entry.status === "partial" || entry.status === "unknown") {
        notFullyCounted++;
      }
      const values = entryNutrition(entry);
      NUTRIENTS.forEach((key) => {
        if (values[key] !== null) {
          totals[key] = round1(totals[key] + values[key]);
        }
      });
    });

  return { totals, notFullyCounted, count };
}

// kcal eaten per meal on one day.
export function mealKcal(entries, date) {
  const result = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  entries
    .filter((entry) => entry.date === date)
    .forEach((entry) => {
      const { kcal } = entryNutrition(entry);
      if (kcal !== null) {
        result[entry.meal] = round1(result[entry.meal] + kcal);
      }
    });
  return result;
}

// kcal per day for `days` days ending on `endDate`, oldest first (for the week chart).
export function kcalPerDay(entries, endDate, days) {
  const result = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = shiftDate(endDate, -offset);
    result.push({ date, kcal: dayTotals(entries, date).totals.kcal });
  }
  return result;
}

// Validates stored entries: drops ones without a valid date, meal or name; unknown values become null.
export function normalizeIntakeLog(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        MEAL_TYPES.includes(entry.meal) &&
        typeof entry.name === "string" &&
        entry.name.trim() !== ""
    )
    .map((entry) => {
      const perUnit = emptyValues();
      NUTRIENTS.forEach((key) => {
        const value = entry.perUnit && entry.perUnit[key];
        perUnit[key] = isNumber(value) && value >= 0 ? value : null;
      });
      return {
        id:
          typeof entry.id === "string"
            ? entry.id
            : `${entry.date}-${Math.random().toString(36).slice(2, 8)}`,
        date: entry.date,
        time: typeof entry.time === "string" ? entry.time : "",
        meal: entry.meal,
        name: entry.name.trim(),
        source: ["recipe", "product", "manual"].includes(entry.source) ? entry.source : "manual",
        unit: ["serving", "g", "ml"].includes(entry.unit) ? entry.unit : "",
        quantity: isNumber(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
        perUnit,
        status: STATUSES.includes(entry.status) ? entry.status : "unknown",
        // Where the values came from; a NEVO entry keeps its NEVO version for the required reference.
        nutritionSource: NUTRITION_SOURCES.includes(entry.nutritionSource)
          ? entry.nutritionSource
          : null,
        nevoVersion: typeof entry.nevoVersion === "string" ? entry.nevoVersion : null
      };
    });
}
