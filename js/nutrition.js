// Pure nutrition maths: normalising values, recipe totals and macro statistics. No page or state access.
import { formatNutritionValue } from "./format.js";

export function hasUsableNutrition(nutrition) {
  if (!nutrition) {
    return false;
  }
  return (
    typeof nutrition.kcal100g === "number" ||
    typeof nutrition.protein100g === "number" ||
    typeof nutrition.carbs100g === "number" ||
    typeof nutrition.fat100g === "number"
  );
}

export function createEmptyNutrition() {
  return {
    kcal100g: null,
    protein100g: null,
    carbs100g: null,
    fat100g: null
  };
}

export function normalizeNutrition(value) {
  if (typeof value !== "object" || value === null) {
    return createEmptyNutrition();
  }

  return {
    kcal100g: normalizeNutritionNumber(value.kcal100g),
    protein100g: normalizeNutritionNumber(value.protein100g),
    carbs100g: normalizeNutritionNumber(value.carbs100g),
    fat100g: normalizeNutritionNumber(value.fat100g)
  };
}

export function normalizeNutritionNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

export function hasAnyNutrition(nutrition) {
  const data = normalizeNutrition(nutrition);

  return (
    data.kcal100g !== null ||
    data.protein100g !== null ||
    data.carbs100g !== null ||
    data.fat100g !== null
  );
}

// Adds up kcal and macros over a recipe's ingredients (nutrition per 100 g times grams).
// Returns null when no ingredient has any nutrition data, so callers can show nothing instead of zeros.
export function sumRecipeNutrition(ingredients) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let hasAny = false;

  ingredients.forEach((ingredient) => {
    const nutrition = normalizeNutrition(ingredient.nutrition);
    const factor = ingredient.grams / 100;

    [
      ["kcal", nutrition.kcal100g],
      ["protein", nutrition.protein100g],
      ["carbs", nutrition.carbs100g],
      ["fat", nutrition.fat100g]
    ].forEach(([key, per100g]) => {
      if (per100g !== null) {
        totals[key] += per100g * factor;
        hasAny = true;
      }
    });
  });

  return hasAny ? totals : null;
}

// Formats totals as "955 kcal · P 35.5g · C 174g · F 7.3g", each value multiplied by scale first.
// One formatter for the recipe total, per-serving and per-100 g lines, so they always look the same.
function formatMacroLine(totals, scale) {
  return (
    `${formatNutritionValue(totals.kcal * scale)} kcal · ` +
    `P ${formatNutritionValue(totals.protein * scale)}g · ` +
    `C ${formatNutritionValue(totals.carbs * scale)}g · ` +
    `F ${formatNutritionValue(totals.fat * scale)}g`
  );
}

export function buildRecipeTotalsSummaryFromIngredients(ingredients) {
  const totals = sumRecipeNutrition(ingredients);
  return totals ? formatMacroLine(totals, 1) : "";
}

export function buildRecipePerServingSummaryFromIngredients(ingredients, servings) {
  if (typeof servings !== "number" || !Number.isFinite(servings) || servings <= 0) {
    return "";
  }

  const totals = sumRecipeNutrition(ingredients);
  return totals ? formatMacroLine(totals, 1 / servings) : "";
}

export function buildRecipeWeightSummaryFromIngredients(ingredients) {
  const totalWeight = ingredients.reduce((sum, ingredient) => {
    return sum + ingredient.grams;
  }, 0);

  if (totalWeight <= 0) {
    return "";
  }

  return `Total weight: ${formatNutritionValue(totalWeight)}g`;
}

export function buildRecipePer100gSummaryFromIngredients(ingredients) {
  const totalWeight = ingredients.reduce((sum, ingredient) => {
    return sum + ingredient.grams;
  }, 0);

  if (totalWeight <= 0) {
    return "";
  }

  const totals = sumRecipeNutrition(ingredients);
  return totals ? `Per 100g: ${formatMacroLine(totals, 100 / totalWeight)}` : "";
}

export function buildRecipePerServingDisplayFromIngredients(ingredients, servings, servingLabel) {
  const summary = buildRecipePerServingSummaryFromIngredients(ingredients, servings);

  if (summary === "") {
    return "";
  }

  const label = typeof servingLabel === "string" ? servingLabel.trim() : "";

  if (label === "") {
    return `Per serving: ${summary}`;
  }

  return `Per ${label}: ${summary}`;
}

export function getQuantityStep(unit) {
  const normalized = typeof unit === "string" ? unit.trim().toLowerCase() : "";

  if (normalized === "g" || normalized === "ml") {
    return 50;
  }

  if (normalized === "kg" || normalized === "l") {
    return 0.1;
  }

  // Countable units (pcs, pack, bottle, can) and anything unrecognised.
  return 1;
}

export function estimateItemGrams(item) {
  if (typeof item.nutritionAmount === "number" && item.nutritionAmount > 0) {
    return item.nutritionAmount;
  }

  if (typeof item.quantity !== "number" || item.quantity <= 0) {
    return null;
  }

  const unit = typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";

  if (unit === "g" || unit === "ml") {
    return item.quantity;
  }

  if (unit === "kg" || unit === "l") {
    return item.quantity * 1000;
  }

  // Countable units (pcs, pack, bottle, can) or no unit: we don't know
  // the gram weight, so this item can't be included in totals.
  return null;
}

export function calculateMacroTotals(itemArray) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let includedCount = 0;

  itemArray.forEach((item) => {
    const nutrition = item.nutrition;
    const hasAnyNutrition =
      nutrition &&
      (typeof nutrition.kcal100g === "number" ||
        typeof nutrition.protein100g === "number" ||
        typeof nutrition.carbs100g === "number" ||
        typeof nutrition.fat100g === "number");

    if (!hasAnyNutrition) {
      return;
    }

    const grams = estimateItemGrams(item);
    if (grams === null) {
      return;
    }

    const factor = grams / 100;
    totals.kcal += (nutrition.kcal100g || 0) * factor;
    totals.protein += (nutrition.protein100g || 0) * factor;
    totals.carbs += (nutrition.carbs100g || 0) * factor;
    totals.fat += (nutrition.fat100g || 0) * factor;
    includedCount++;
  });

  return {
    totals,
    includedCount,
    totalCount: itemArray.length
  };
}

export function buildMacroDonutSvg(proteinKcal, carbsKcal, fatKcal) {
  const size = 140;
  const center = size / 2;
  const radius = 54;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { kcal: proteinKcal, color: "#2e7d32" },
    { kcal: carbsKcal, color: "#f59e0b" },
    { kcal: fatKcal, color: "#dc2626" }
  ];

  const totalKcal = proteinKcal + carbsKcal + fatKcal;

  let cumulative = 0;
  const circles = segments
    .map((segment) => {
      if (segment.kcal <= 0 || totalKcal <= 0) {
        return "";
      }
      const fraction = segment.kcal / totalKcal;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const offset = -cumulative;
      cumulative += dash;
      return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}" />`;
    })
    .join("");

  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Macro breakdown pie chart">
      <g transform="rotate(-90 ${center} ${center})">${circles}</g>
    </svg>`;
}
