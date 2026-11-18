// Pure rules for shopping and pantry items: categories, names, package sizes and merging. No page or state access.
import { CATEGORY_ORDER } from "./constants.js";
import { hasAnyNutrition, normalizeNutrition, normalizeNutritionNumber } from "./nutrition.js";

export function normalizeIngredientName(name) {
  let normalized = typeof name === "string" ? name.trim().toLowerCase() : "";
  normalized = normalized.replace(/\s+/g, " ");
  // Very small heuristic: treat "eggs" and "egg" as the same ingredient.
  if (normalized.length > 3 && normalized.endsWith("s")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Pantry scanner: scanned items go straight into pantry stock, and the camera
// stays on so several items can be scanned in a row.
// ---------------------------------------------------------------------------
export function parsePackageQuantity(text) {
  const fallback = { quantity: 1, unit: "pack" };

  if (typeof text !== "string") {
    return fallback;
  }

  const match = text
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/);

  if (!match) {
    return fallback;
  }

  let quantity = parseFloat(match[1].replace(",", "."));
  let unit = match[2];

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fallback;
  }

  if (unit === "cl") {
    quantity *= 10;
    unit = "ml";
  }

  return { quantity: Math.round(quantity * 100) / 100, unit };
}

// Turns a number into a positive quantity, or null when it is missing, zero, negative or not a number.
export function positiveQuantityOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// Builds a pantry item from any item-like object, replacing missing or wrongly typed fields with safe defaults.
// The single definition of a pantry item; shopping items are the same plus a "bought" flag.
export function createStockItem(item) {
  return {
    name: typeof item.name === "string" ? item.name : "",
    quantity: positiveQuantityOrNull(item.quantity),
    unit: typeof item.unit === "string" ? item.unit : "",
    category: typeof item.category === "string" ? item.category : "",
    note: typeof item.note === "string" ? item.note : "",
    barcode: typeof item.barcode === "string" ? item.barcode : "",
    nutrition: normalizeNutrition(item.nutrition),
    nutritionAmount: normalizeNutritionNumber(item.nutritionAmount)
  };
}

export function mergeStockItems(existingItem, incomingItem) {
  const merged = {
    ...existingItem
  };

  if (
    typeof merged.quantity === "number" &&
    Number.isFinite(merged.quantity) &&
    merged.quantity > 0 &&
    typeof incomingItem.quantity === "number" &&
    Number.isFinite(incomingItem.quantity) &&
    incomingItem.quantity > 0 &&
    merged.unit === incomingItem.unit
  ) {
    merged.quantity += incomingItem.quantity;
  } else if (
    (merged.quantity === null || typeof merged.quantity !== "number") &&
    typeof incomingItem.quantity === "number" &&
    Number.isFinite(incomingItem.quantity) &&
    incomingItem.quantity > 0
  ) {
    merged.quantity = incomingItem.quantity;
  }

  if (
    (typeof merged.note !== "string" || merged.note.trim() === "") &&
    typeof incomingItem.note === "string"
  ) {
    merged.note = incomingItem.note;
  }

  if (!hasAnyNutrition(merged.nutrition) && hasAnyNutrition(incomingItem.nutrition)) {
    merged.nutrition = normalizeNutrition(incomingItem.nutrition);
  }

  if (
    normalizeNutritionNumber(merged.nutritionAmount) === null &&
    normalizeNutritionNumber(incomingItem.nutritionAmount) !== null
  ) {
    merged.nutritionAmount = normalizeNutritionNumber(incomingItem.nutritionAmount);
  }

  return merged;
}

// Builds a shopping-list item (not yet bought) from any item-like object, with the same defaults as createStockItem().
export function createShoppingItem(item) {
  return { ...createStockItem(item), bought: false };
}

export function mergeShoppingItems(existingItem, stockItem) {
  const merged = {
    ...existingItem
  };

  if (
    typeof merged.quantity === "number" &&
    Number.isFinite(merged.quantity) &&
    merged.quantity > 0 &&
    typeof stockItem.quantity === "number" &&
    Number.isFinite(stockItem.quantity) &&
    stockItem.quantity > 0 &&
    merged.unit === stockItem.unit
  ) {
    merged.quantity += stockItem.quantity;
  } else if (
    (merged.quantity === null || typeof merged.quantity !== "number") &&
    typeof stockItem.quantity === "number" &&
    Number.isFinite(stockItem.quantity) &&
    stockItem.quantity > 0
  ) {
    merged.quantity = stockItem.quantity;
  }

  if (
    (typeof merged.note !== "string" || merged.note.trim() === "") &&
    typeof stockItem.note === "string"
  ) {
    merged.note = stockItem.note;
  }

  if (!hasAnyNutrition(merged.nutrition) && hasAnyNutrition(stockItem.nutrition)) {
    merged.nutrition = normalizeNutrition(stockItem.nutrition);
  }

  if (
    normalizeNutritionNumber(merged.nutritionAmount) === null &&
    normalizeNutritionNumber(stockItem.nutritionAmount) !== null
  ) {
    merged.nutritionAmount = normalizeNutritionNumber(stockItem.nutritionAmount);
  }

  merged.bought = false;

  return merged;
}

export function normalizeCategory(category) {
  if (typeof category !== "string") {
    return "";
  }

  const trimmed = category.trim();

  if (CATEGORY_ORDER.includes(trimmed)) {
    return trimmed;
  }

  return "";
}

export function getCategoryLabel(category) {
  const normalized = normalizeCategory(category);
  return normalized === "" ? "Uncategorised" : normalized;
}

// The pantry item a recipe ingredient uses, as saved with the recipe: a name, null for "not in stock",
// or undefined when unknown (recipes saved before links existed), so cooking can fall back to matching by name.
export function normalizeStockLink(value) {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
