// Reading data from browser storage and validating it. No page or state access, so loaders can be unit-tested.
import {
  BARCODE_CACHE_STORAGE_KEY,
  INTAKE_STORAGE_KEY,
  NEVO_STORAGE_KEY,
  RECIPE_STORAGE_KEY,
  STOCK_STORAGE_KEY,
  STORAGE_KEY,
  TARGETS_STORAGE_KEY
} from "./constants.js";
import { normalizeDisplayAmount, parseOptionalNumberInput } from "./format.js";
import { ingredientSourceFields } from "./ingredient-nutrition.js";
import { normalizeIntakeLog } from "./intake.js";
import { normalizeNevoData } from "./nevo.js";
import {
  createShoppingItem,
  createStockItem,
  ensureUniqueIds,
  isItemId,
  normalizeStockLink
} from "./items.js";
import { normalizeNutrition } from "./nutrition.js";
import { normalizeMealType, normalizeTargetSettings } from "./targets.js";

export function loadRecipes() {
  return loadStoredList(RECIPE_STORAGE_KEY, (recipe) => {
    const name = typeof recipe.name === "string" ? recipe.name.trim() : "";

    if (name === "" || !Array.isArray(recipe.ingredients)) {
      return null;
    }

    const servings = parseOptionalNumberInput(String(recipe.servings ?? "1")) || 1;

    const ingredients = recipe.ingredients
      .map((ingredient) => {
        if (typeof ingredient !== "object" || ingredient === null) {
          return null;
        }

        const ingredientName = typeof ingredient.name === "string" ? ingredient.name.trim() : "";

        if (ingredientName === "") {
          return null;
        }

        const grams = parseOptionalNumberInput(String(ingredient.grams));

        // Keep ingredients without a usable amount (grams = null) instead of dropping them.
        // Dropping them silently deleted ingredients from AI-saved recipes on every reload.
        return {
          name: ingredientName,
          grams: grams !== null && grams > 0 ? grams : null,
          displayAmount: normalizeDisplayAmount(ingredient.displayAmount),
          stockItem: normalizeStockLink(ingredient.stockItem),
          nutrition: normalizeNutrition(ingredient.nutrition),
          // Where the values came from (pantry, NEVO, Open Food Facts, typed in or the AI's estimate).
          ...ingredientSourceFields(ingredient)
        };
      })
      .filter(Boolean);

    return {
      name,
      description: typeof recipe.description === "string" ? recipe.description : "",
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions
            .filter((step) => typeof step === "string" && step.trim() !== "")
            .map((step) => step.trim())
        : [],
      servings,
      servingLabel: typeof recipe.servingLabel === "string" ? recipe.servingLabel : "",
      mealType: normalizeMealType(recipe.mealType),
      ingredients
    };
  });
}

export function saveBarcodeCache(cache) {
  try {
    localStorage.setItem(BARCODE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    // Storage can fail (quota exceeded, private browsing, etc).
    // The cache is a pure optimization, so silently skip saving on failure.
  }
}

export function loadBarcodeCache() {
  const saved = localStorage.getItem(BARCODE_CACHE_STORAGE_KEY);

  if (!saved) {
    return {};
  }

  try {
    const parsed = JSON.parse(saved);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

export function loadStockItems() {
  let idsAdded = false;
  const items = loadStoredList(STOCK_STORAGE_KEY, (item) => {
    const name = storedItemName(item);
    if (name === "") {
      return null;
    }
    idsAdded = idsAdded || !isItemId(item.id);
    return { ...createStockItem(item), name };
  });
  return keepIds(STOCK_STORAGE_KEY, items, idsAdded);
}

// Items saved before ids existed (or from an old backup) get them on load. They are written back once
// so the ids stay the same on the next load; a failed write only means new ids next time.
function keepIds(key, items, idsAdded) {
  const duplicatesFixed = ensureUniqueIds(items);
  if (idsAdded || duplicatesFixed) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      // Storage full or unavailable: the ids still work until the page reloads.
    }
  }
  return items;
}

// Reads a JSON array from storage and turns each entry into a clean record with normalizeEntry,
// dropping entries it returns null for. Missing, corrupt or non-array data gives an empty list.
// One shared reader for the shopping list, pantry and recipes, so all three handle bad data the same way.
export function loadStoredList(key, normalizeEntry) {
  const saved = localStorage.getItem(key);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => (typeof entry === "object" && entry !== null ? normalizeEntry(entry) : null))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

// Stored items need a non-empty name; everything else falls back to createStockItem()'s defaults.
function storedItemName(item) {
  return typeof item.name === "string" ? item.name.trim() : "";
}

export function loadItems() {
  let idsAdded = false;
  const items = loadStoredList(STORAGE_KEY, (item) => {
    const name = storedItemName(item);
    if (name === "") {
      return null;
    }
    idsAdded = idsAdded || !isItemId(item.id);
    return {
      ...createShoppingItem(item),
      name,
      bought: typeof item.bought === "boolean" ? item.bought : false
    };
  });
  return keepIds(STORAGE_KEY, items, idsAdded);
}

// Reads the daily target settings; missing or damaged data gives empty targets and the default meal split.
export function loadTargetSettings() {
  try {
    return normalizeTargetSettings(JSON.parse(localStorage.getItem(TARGETS_STORAGE_KEY)));
  } catch (error) {
    return normalizeTargetSettings(null);
  }
}

// Reads the intake log; missing or damaged data gives an empty log, and broken entries are dropped.
export function loadIntakeLog() {
  try {
    return normalizeIntakeLog(JSON.parse(localStorage.getItem(INTAKE_STORAGE_KEY)));
  } catch (error) {
    return [];
  }
}

export function loadNevoData() {
  try {
    return normalizeNevoData(JSON.parse(localStorage.getItem(NEVO_STORAGE_KEY)));
  } catch (error) {
    return null;
  }
}
