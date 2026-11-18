// Unit tests for the pure formatting and nutrition helpers (js/format.js, js/nutrition.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatIngredientAmountText,
  formatIngredientLine,
  formatNutritionValue,
  parseOptionalNumberInput
} from "../../js/format.js";
import {
  buildRecipePer100gSummaryFromIngredients,
  buildRecipePerServingSummaryFromIngredients,
  buildRecipeTotalsSummaryFromIngredients,
  normalizeNutrition,
  sumRecipeNutrition
} from "../../js/nutrition.js";

test("ingredient lines show the kitchen measure with grams in brackets", () => {
  assert.equal(formatIngredientLine("Ei", 50, "1"), "1 Ei (50 g)");
  assert.equal(formatIngredientLine("Olijfolie", 28, "2 el"), "2 el Olijfolie (28 g)");
  // Grams are the natural measure: no brackets.
  assert.equal(formatIngredientLine("Rijst", 150, null), "150 g Rijst");
  // Unknown amount (saved before amounts were required) stays visible instead of disappearing.
  assert.equal(formatIngredientLine("Zout", null, null), "amount unknown Zout");
  assert.equal(formatIngredientAmountText(null, "a pinch"), "a pinch");
});

test("number formatting rounds to one decimal and hides non-numbers", () => {
  assert.equal(formatNutritionValue(12), "12");
  assert.equal(formatNutritionValue(12.345), "12.3");
  assert.equal(formatNutritionValue(NaN), "");
  assert.equal(parseOptionalNumberInput("2.5"), 2.5);
  assert.equal(parseOptionalNumberInput(""), null);
});

test("nutrition values of the wrong type are replaced by null", () => {
  assert.deepEqual(normalizeNutrition({ kcal100g: 100, protein100g: "5", carbs100g: -1 }), {
    kcal100g: 100,
    protein100g: null,
    carbs100g: null,
    fat100g: null
  });
  assert.deepEqual(normalizeNutrition(undefined), {
    kcal100g: null,
    protein100g: null,
    carbs100g: null,
    fat100g: null
  });
});

test("recipe totals add nutrition per 100 g times grams", () => {
  const ingredients = [
    { grams: 200, nutrition: { kcal100g: 100, protein100g: 10, carbs100g: 20, fat100g: 1 } },
    { grams: 100, nutrition: { kcal100g: 50, protein100g: null, carbs100g: 10, fat100g: 0 } }
  ];
  assert.deepEqual(sumRecipeNutrition(ingredients), { kcal: 250, protein: 20, carbs: 50, fat: 2 });
  assert.equal(
    buildRecipeTotalsSummaryFromIngredients(ingredients),
    "250 kcal · P 20g · C 50g · F 2g"
  );
  assert.equal(
    buildRecipePerServingSummaryFromIngredients(ingredients, 2),
    "125 kcal · P 10g · C 25g · F 1g"
  );
  assert.equal(
    buildRecipePer100gSummaryFromIngredients(ingredients),
    "Per 100g: 83.3 kcal · P 6.7g · C 16.7g · F 0.7g"
  );
});

test("recipe totals are empty when no ingredient has nutrition data", () => {
  const ingredients = [{ grams: 100, nutrition: null }];
  assert.equal(sumRecipeNutrition(ingredients), null);
  assert.equal(buildRecipeTotalsSummaryFromIngredients(ingredients), "");
  assert.equal(buildRecipePerServingSummaryFromIngredients(ingredients, 0), "");
});

test("an ingredient without an amount counts as zero grams instead of breaking the totals", () => {
  const ingredients = [
    { grams: 100, nutrition: { kcal100g: 100, protein100g: 1, carbs100g: 1, fat100g: 1 } },
    { grams: null, nutrition: { kcal100g: 900, protein100g: 0, carbs100g: 0, fat100g: 100 } }
  ];
  assert.equal(
    buildRecipeTotalsSummaryFromIngredients(ingredients),
    "100 kcal · P 1g · C 1g · F 1g"
  );
});
