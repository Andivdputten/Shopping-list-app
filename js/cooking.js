// Rules for "Cook this": which pantry item each ingredient uses, how much to deduct and what is left.
// No page or state access, so every rule is unit-tested (tests/unit/cooking.test.mjs).
import { normalizeIngredientName } from "./items.js";

// Pantry units counted in whole things; a recipe's plain-number kitchen measure ("4" eggs) is deducted in these.
const COUNTABLE_UNITS = ["pcs", "pack", "bottle", "can", ""];

// Rounds to 2 decimals, the precision the pantry stores, so repeated cooking doesn't build up float noise.
function round2(value) {
  return Math.round(value * 100) / 100;
}

// Converts a recipe's grams into a pantry unit, or null when that unit has no known weight.
// 1 ml is counted as 1 g: exact for water and milk, close enough for most cooking liquids.
export function gramsToStockUnit(grams, unit) {
  switch (typeof unit === "string" ? unit.trim().toLowerCase() : "") {
    case "g":
    case "ml":
      return grams;
    case "kg":
    case "l":
      return grams / 1000;
    default:
      return null;
  }
}

// Finds the pantry item an ingredient uses and returns its index, or -1 when it isn't in stock.
// stockItem is the link saved with the recipe: a name, null for "not in stock", or missing in older recipes.
// A link whose item was renamed or deleted falls back to the ingredient's own name.
export function findStockIndex(ingredient, stockItems) {
  if (ingredient.stockItem === null) {
    return -1;
  }

  const byName = (name) => {
    const wanted = normalizeIngredientName(name);
    return wanted === ""
      ? -1
      : stockItems.findIndex((item) => normalizeIngredientName(item.name) === wanted);
  };

  if (typeof ingredient.stockItem === "string") {
    const linked = byName(ingredient.stockItem);
    if (linked !== -1) {
      return linked;
    }
  }

  return byName(ingredient.name);
}

// The amount one ingredient needs in its pantry item's unit, or null when it can't be worked out.
function neededAmount(ingredient, stockItem, scale) {
  const grams =
    typeof ingredient.grams === "number" && ingredient.grams > 0 ? ingredient.grams : null;
  const converted = grams === null ? null : gramsToStockUnit(grams, stockItem.unit);
  if (converted !== null) {
    return { kind: "convert", amount: converted * scale };
  }

  const display =
    typeof ingredient.displayAmount === "string" ? ingredient.displayAmount.trim() : "";
  const unit = typeof stockItem.unit === "string" ? stockItem.unit.trim().toLowerCase() : "";
  if (/^\d+([.,]\d+)?$/.test(display) && COUNTABLE_UNITS.includes(unit)) {
    return { kind: "count", amount: parseFloat(display.replace(",", ".")) * scale };
  }

  return { kind: "manual", amount: null };
}

// Works out, per ingredient, what cooking servingsCooked servings would take from the pantry.
// Each line: kind ("convert", "count", "manual", "missing" or "unknown"), the suggested amount in the
// pantry item's unit (null when you must enter it or nothing is deducted), and any shortfall.
// Lines are worked out in order against what earlier lines left, so two lines using one item share it.
export function planCooking(recipe, servingsCooked, stockItems) {
  const recipeServings = recipe.servings > 0 ? recipe.servings : 1;
  const scale = servingsCooked > 0 ? servingsCooked / recipeServings : 0;
  const remaining = stockItems.map((item) =>
    typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : null
  );

  const lines = recipe.ingredients.map((ingredient) => {
    const stockIndex = findStockIndex(ingredient, stockItems);
    const base = { name: ingredient.name, stockIndex, short: 0 };

    if (stockIndex === -1) {
      return { ...base, kind: "missing", amount: null, unit: "", available: null, stockName: "" };
    }

    const stockItem = stockItems[stockIndex];
    const info = { ...base, unit: stockItem.unit || "", stockName: stockItem.name };
    const available = remaining[stockIndex];

    if (available === null) {
      return { ...info, kind: "unknown", amount: null, available: null };
    }

    const need = neededAmount(ingredient, stockItem, scale);
    if (need.amount === null) {
      return { ...info, kind: need.kind, amount: null, available };
    }

    const wanted = round2(need.amount);
    const amount = Math.min(wanted, available);
    remaining[stockIndex] = round2(available - amount);
    return { ...info, kind: need.kind, amount, available, short: round2(wanted - amount) };
  });

  return { scale, lines };
}

// Subtracts the confirmed amounts ({ stockIndex, amount } per line) and removes items that reach zero.
// Returns new arrays and leaves the input untouched, so the caller can keep the old list for undo.
export function applyCooking(stockItems, deductions) {
  const next = stockItems.map((item) => ({ ...item }));

  deductions.forEach(({ stockIndex, amount }) => {
    const item = next[stockIndex];
    if (!item || typeof amount !== "number" || !(amount > 0) || typeof item.quantity !== "number") {
      return;
    }
    item.quantity = round2(item.quantity - amount);
  });

  const usedUp = next.filter((item) => typeof item.quantity === "number" && item.quantity <= 0);
  return { stockItems: next.filter((item) => !usedUp.includes(item)), usedUp };
}
