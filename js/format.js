// Pure text formatting and parsing helpers. No page or state access, so they can be unit-tested.
import { normalizeNutrition } from "./nutrition.js";

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

export function pickFirstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}

export function formatNutritionSummary(nutrition) {
  const data = normalizeNutrition(nutrition);
  const parts = [];

  if (data.kcal100g !== null) {
    parts.push(`${formatNutritionValue(data.kcal100g)} kcal`);
  }

  if (data.protein100g !== null) {
    parts.push(`P ${formatNutritionValue(data.protein100g)}g`);
  }

  if (data.carbs100g !== null) {
    parts.push(`C ${formatNutritionValue(data.carbs100g)}g`);
  }

  if (data.fat100g !== null) {
    parts.push(`F ${formatNutritionValue(data.fat100g)}g`);
  }

  if (data.fiber100g !== null) {
    parts.push(`Fib ${formatNutritionValue(data.fiber100g)}g`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `Per 100g: ${parts.join(" · ")}`;
}

export function formatNutritionValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Math.round(value * 10) / 10);
}

// Returns a trimmed kitchen measure ("1", "2 tbsp"), or null when there is none.
// Used wherever ingredients are saved or loaded, so the field is always either a usable string or null.
export function normalizeDisplayAmount(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// Text for an ingredient's amount on its own: "1 (50 g)", "2 tbsp (28 g)", "150 g" or "amount unknown".
// The kitchen measure is what you cook with; the grams in brackets are what the nutrition maths uses.
export function formatIngredientAmountText(grams, displayAmount) {
  const hasGrams = typeof grams === "number" && Number.isFinite(grams) && grams > 0;
  const display = normalizeDisplayAmount(displayAmount);
  const gramsText = hasGrams ? `${formatNutritionValue(grams)} g` : "";

  if (display !== null) {
    return gramsText !== "" ? `${display} (${gramsText})` : display;
  }
  return gramsText !== "" ? gramsText : "amount unknown";
}

// Full ingredient line: "1 egg (50 g)" when there is a kitchen measure, otherwise "150 g rice".
// Puts the name between the measure and the grams, because "1 (50 g) egg" reads badly.
export function formatIngredientLine(name, grams, displayAmount) {
  const hasGrams = typeof grams === "number" && Number.isFinite(grams) && grams > 0;
  const display = normalizeDisplayAmount(displayAmount);

  if (display !== null) {
    return hasGrams
      ? `${display} ${name} (${formatNutritionValue(grams)} g)`
      : `${display} ${name}`;
  }
  return `${formatIngredientAmountText(grams, null)} ${name}`;
}

export function parseOptionalNumberInput(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (trimmed === "") {
    return null;
  }

  const numberValue = Number(trimmed);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

export function formatNutritionInputValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Math.round(value * 10) / 10);
}

export function formatNutritionTotalSummary(nutrition, amountGrams) {
  if (typeof amountGrams !== "number" || !Number.isFinite(amountGrams) || amountGrams <= 0) {
    return "";
  }

  const data = normalizeNutrition(nutrition);
  const factor = amountGrams / 100;
  const parts = [];

  if (data.kcal100g !== null) {
    parts.push(`${formatNutritionValue(data.kcal100g * factor)} kcal`);
  }

  if (data.protein100g !== null) {
    parts.push(`P ${formatNutritionValue(data.protein100g * factor)}g`);
  }

  if (data.carbs100g !== null) {
    parts.push(`C ${formatNutritionValue(data.carbs100g * factor)}g`);
  }

  if (data.fat100g !== null) {
    parts.push(`F ${formatNutritionValue(data.fat100g * factor)}g`);
  }

  if (data.fiber100g !== null) {
    parts.push(`Fib ${formatNutritionValue(data.fiber100g * factor)}g`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `For ${formatNutritionValue(amountGrams)}g: ${parts.join(" · ")}`;
}

export function parseInstructionsText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function instructionsToText(instructions) {
  return Array.isArray(instructions) ? instructions.join("\n") : "";
}

export function formatRecipeServingsLabel(servings, servingLabel) {
  const label = typeof servingLabel === "string" ? servingLabel.trim() : "";
  const servingCount = formatNutritionValue(servings);

  if (label === "") {
    return `${servingCount} serving(s)`;
  }

  return `${servingCount} ${label}(s)`;
}

export function buildMetaText(item) {
  const hasQuantity = typeof item.quantity === "number" && item.quantity > 0;
  const hasUnit = typeof item.unit === "string" && item.unit.trim() !== "";

  if (hasQuantity && hasUnit) {
    return `${formatQuantity(item.quantity)} ${item.unit}`;
  }

  if (hasQuantity) {
    return `${formatQuantity(item.quantity)}`;
  }

  return "";
}

export function formatQuantity(quantity) {
  return String(quantity);
}
