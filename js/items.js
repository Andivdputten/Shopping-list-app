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
// The weight in grams (ml counts as grams) of one pack, from a package text such as "5 kg", "6 x 330 ml"
// or "Rijst 1kg"; null when it holds no weight. Used when the quantity itself is counted in packs.
export function parsePackGrams(text) {
  if (typeof text !== "string") {
    return null;
  }
  const lower = text.toLowerCase();
  const toGrams = (amount, unit) => {
    const value = parseFloat(amount.replace(",", "."));
    const factor = { g: 1, ml: 1, cl: 10, kg: 1000, l: 1000 }[unit];
    return Number.isFinite(value) && value > 0 ? value * factor : null;
  };
  const multi = lower.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (multi) {
    const each = toGrams(multi[2], multi[3]);
    return each === null ? null : Math.round(Number(multi[1]) * each * 100) / 100;
  }
  const single = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/);
  return single ? toGrams(single[1], single[2]) : null;
}

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

// A new stable id for a list or pantry item. crypto.randomUUID() needs a secure context (https or localhost);
// elsewhere a random version-4 UUID is built from crypto.getRandomValues().
export function newItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isItemId(value) {
  return typeof value === "string" && value.trim() !== "";
}

// Marks an item as changed now, so a future sync can tell which copy is newer.
export function touchItem(item) {
  item.updatedAt = new Date().toISOString();
  return item;
}

// Gives every item an id that is unique within its list: missing ids are created and the second
// copy of a repeated id gets a new one. Returns whether anything changed, so the caller can save it.
export function ensureUniqueIds(items) {
  const seen = new Set();
  let changed = false;
  items.forEach((item) => {
    if (!isItemId(item.id) || seen.has(item.id)) {
      item.id = newItemId();
      changed = true;
    }
    seen.add(item.id);
  });
  return changed;
}

// Turns a number into a positive quantity, or null when it is missing, zero, negative or not a number.
export function positiveQuantityOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// Builds a pantry item from any item-like object, replacing missing or wrongly typed fields with safe defaults.
// The single definition of a pantry item; shopping items are the same plus a "bought" flag.
export function createStockItem(item) {
  return {
    // Stable identity, so edits, Undo and moves never depend on an item's position in the list.
    id: isItemId(item.id) ? item.id : newItemId(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    name: typeof item.name === "string" ? item.name : "",
    quantity: positiveQuantityOrNull(item.quantity),
    unit: typeof item.unit === "string" ? item.unit : "",
    category: typeof item.category === "string" ? item.category : "",
    note: typeof item.note === "string" ? item.note : "",
    barcode: typeof item.barcode === "string" ? item.barcode : "",
    nutrition: normalizeNutrition(item.nutrition),
    nutritionAmount: normalizeNutritionNumber(item.nutritionAmount),
    // Weight in grams (or ml) of one pack or piece, for items counted in packs or pieces: "1 pack" of rice
    // is then 5000 g for the AI, for cooking and for the statistics. null when unknown.
    packGrams: positiveQuantityOrNull(item.packGrams),
    // Set when nutrition was found by name ("nevo" or "off"), so its source (and NEVO version) can be shown.
    nutritionSource: ["nevo", "off"].includes(item.nutritionSource) ? item.nutritionSource : null,
    nevoVersion: typeof item.nevoVersion === "string" ? item.nevoVersion : null
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

  if (positiveQuantityOrNull(merged.packGrams) === null) {
    merged.packGrams = positiveQuantityOrNull(incomingItem.packGrams);
  }

  if (!hasAnyNutrition(merged.nutrition) && hasAnyNutrition(incomingItem.nutrition)) {
    merged.nutrition = normalizeNutrition(incomingItem.nutrition);
    merged.nutritionSource = incomingItem.nutritionSource || null;
    merged.nevoVersion = incomingItem.nevoVersion || null;
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
