// Where each recipe ingredient's nutrition comes from, and the per-serving values that follow.
// Order: the pantry item, else the best NEVO food, else the best Open Food Facts product, else the AI's
// estimate. No page or state access, so every rule is unit-tested (tests/unit/ingredient-nutrition.test.mjs).
import { bestNevoMatch } from "./nevo.js";
import { hasUsableNutrition, normalizeNutrition } from "./nutrition.js";

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

// A choice: { source: "pantry" | "nevo" | "off" | "manual" | "estimated", label, nutrition, nevoVersion }.
// The pantry and NEVO choices need no network, so they are made straight away.
export function initialIngredientChoice(ingredient, { stockMatch, nevo }) {
  if (stockMatch && hasUsableNutrition(stockMatch.nutrition)) {
    // A pantry item filled from NEVO keeps that source, so the RIVM reference still shows.
    const fromNevo = stockMatch.nutritionSource === "nevo";
    return {
      source: fromNevo ? "nevo" : "pantry",
      label: stockMatch.name,
      nutrition: normalizeNutrition(stockMatch.nutrition),
      nevoVersion: fromNevo ? stockMatch.nevoVersion || null : null
    };
  }
  if (nevo) {
    const food = bestNevoMatch(nevo.foods, ingredient.searchName || ingredient.name);
    if (food) {
      return {
        source: "nevo",
        label: food.nameNl,
        nutrition: { ...food.nutrition },
        nevoVersion: nevo.version
      };
    }
  }
  return null;
}

// The first Open Food Facts product with kcal, protein, carbs and fat, or null: a name search returns
// branded products, so one with gaps would make the recipe look complete when it isn't.
export function offAutoChoice(products) {
  const product = (products || []).find((candidate) => {
    const n = candidate.nutrition || {};
    return [n.kcal100g, n.protein100g, n.carbs100g, n.fat100g].every(isNumber);
  });
  return product
    ? {
        source: "off",
        label: product.name,
        nutrition: normalizeNutrition(product.nutrition),
        nevoVersion: null
      }
    : null;
}

// The AI's own per-100 g estimate for an ingredient, used when nothing better was found.
export function estimateChoice(ingredient) {
  const e = ingredient.estimatedPer100g;
  if (!e || !isNumber(e.kcal)) {
    return null;
  }
  return {
    source: "estimated",
    label: "",
    nutrition: normalizeNutrition({
      kcal100g: e.kcal,
      protein100g: e.protein,
      carbs100g: e.carbs,
      fat100g: e.fat,
      fiber100g: e.fiber
    }),
    nevoVersion: null
  };
}

// Per-serving values from ingredients ({ grams, nutrition, nutritionSource, nevoVersion }), with a status:
// "complete" when every ingredient has data and none is estimated, "estimated" when all have data but some
// is the AI's estimate, "partial" when some ingredient has no data or amount, "unknown" when none has data.
export function recipeNutrition(ingredients, servings) {
  const portions = servings > 0 ? servings : 1;
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null };
  let withData = 0;
  let estimated = false;
  const nevoVersions = new Set();

  ingredients.forEach((ingredient) => {
    const grams = isNumber(ingredient.grams) && ingredient.grams > 0 ? ingredient.grams : null;
    const n = normalizeNutrition(ingredient.nutrition);
    if (grams === null || !hasUsableNutrition(n)) {
      return;
    }
    withData++;
    estimated = estimated || ingredient.nutritionSource === "estimated";
    if (ingredient.nutritionSource === "nevo" && ingredient.nevoVersion) {
      nevoVersions.add(ingredient.nevoVersion);
    }
    const factor = grams / 100;
    totals.kcal += (n.kcal100g || 0) * factor;
    totals.protein += (n.protein100g || 0) * factor;
    totals.carbs += (n.carbs100g || 0) * factor;
    totals.fat += (n.fat100g || 0) * factor;
    if (n.fiber100g !== null) {
      totals.fiber = (totals.fiber || 0) + n.fiber100g * factor;
    }
  });

  const round1 = (value) => Math.round(value * 10) / 10;
  const perServing =
    withData === 0
      ? null
      : {
          kcal: Math.round(totals.kcal / portions),
          protein: round1(totals.protein / portions),
          carbs: round1(totals.carbs / portions),
          fat: round1(totals.fat / portions),
          fiber: totals.fiber === null ? null : round1(totals.fiber / portions)
        };
  const status =
    withData === 0
      ? "unknown"
      : withData < ingredients.length
        ? "partial"
        : estimated
          ? "estimated"
          : "complete";
  return { perServing, status, nevoVersions: [...nevoVersions] };
}

const SOURCES = ["pantry", "nevo", "off", "manual", "estimated"];

// The source fields stored on a recipe ingredient, validated (anything unknown becomes null).
export function ingredientSourceFields(ingredient) {
  const source =
    ingredient && SOURCES.includes(ingredient.nutritionSource) ? ingredient.nutritionSource : null;
  return {
    nutritionSource: source,
    nevoVersion:
      source === "nevo" && typeof ingredient.nevoVersion === "string"
        ? ingredient.nevoVersion
        : null
  };
}

// The NEVO versions behind a recipe's ingredients, for RIVM's required reference under its totals.
export function nevoVersionsIn(ingredients) {
  return [
    ...new Set(
      ingredients
        .filter((ingredient) => ingredient.nutritionSource === "nevo" && ingredient.nevoVersion)
        .map((ingredient) => ingredient.nevoVersion)
    )
  ];
}

// English names of the sources, for the saved recipes and the recipe builder.
export const SOURCE_NAMES = {
  pantry: "pantry",
  nevo: "NEVO",
  off: "Open Food Facts",
  manual: "typed in",
  estimated: "AI estimate"
};
