// Reading data from browser storage and validating it. No page or state access, so loaders can be unit-tested.
import {
  BARCODE_CACHE_STORAGE_KEY,
  RECIPE_STORAGE_KEY,
  STOCK_STORAGE_KEY,
  STORAGE_KEY
} from "./constants.js";
import { normalizeDisplayAmount, parseOptionalNumberInput } from "./format.js";
import { normalizeNutrition, normalizeNutritionNumber } from "./nutrition.js";

export function loadRecipes() {
  const savedValue = localStorage.getItem(RECIPE_STORAGE_KEY);

  if (!savedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((recipe) => {
        if (typeof recipe !== "object" || recipe === null) {
          return null;
        }

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

            const ingredientName =
              typeof ingredient.name === "string" ? ingredient.name.trim() : "";

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
              nutrition: normalizeNutrition(ingredient.nutrition)
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
          ingredients
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
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
  const savedItems = localStorage.getItem(STOCK_STORAGE_KEY);

  if (!savedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(savedItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const name = typeof item.name === "string" ? item.name.trim() : "";

        if (name === "") {
          return null;
        }

        let quantity = null;
        if (
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
        ) {
          quantity = item.quantity;
        }

        return {
          name,
          quantity,
          unit: typeof item.unit === "string" ? item.unit : "",
          category: typeof item.category === "string" ? item.category : "",
          note: typeof item.note === "string" ? item.note : "",
          barcode: typeof item.barcode === "string" ? item.barcode : "",
          nutrition: normalizeNutrition(item.nutrition),
          nutritionAmount: normalizeNutritionNumber(item.nutritionAmount)
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

export function loadItems() {
  const savedItems = localStorage.getItem(STORAGE_KEY);

  if (!savedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(savedItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const name = typeof item.name === "string" ? item.name.trim() : "";

        if (name === "") {
          return null;
        }

        let quantity = null;
        if (
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
        ) {
          quantity = item.quantity;
        }

        return {
          name,
          quantity,
          unit: typeof item.unit === "string" ? item.unit : "",
          category: typeof item.category === "string" ? item.category : "",
          note: typeof item.note === "string" ? item.note : "",
          barcode: typeof item.barcode === "string" ? item.barcode : "",
          nutrition: normalizeNutrition(item.nutrition),
          nutritionAmount: normalizeNutritionNumber(item.nutritionAmount),
          bought: typeof item.bought === "boolean" ? item.bought : false
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}
