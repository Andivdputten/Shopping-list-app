// Unit tests for cleaning up AI recipe answers (sanitizeRecipe in js/recipe-ai.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRecipe } from "../../js/recipe-ai.js";

const baseRecipe = () => ({
  name: "Omelet",
  description: "Snel",
  servings: 2,
  ingredients: [{ name: "Ei", amount: 100, unit: "g", displayAmount: "2", stockItem: "Eggs" }],
  instructions: ["Bak", "  "],
  estimatedMacrosPerServing: { kcal: 300, protein: 20, carbs: 2, fat: 22 }
});

test("a valid recipe passes through with its group", () => {
  const recipe = sanitizeRecipe(baseRecipe(), "needsExtras");
  assert.equal(recipe.group, "needsExtras");
  assert.deepEqual(recipe.ingredients[0], {
    name: "Ei",
    amount: 100,
    unit: "g",
    displayAmount: "2",
    stockItem: "Eggs"
  });
  // Empty steps are dropped.
  assert.deepEqual(recipe.instructions, ["Bak"]);
});

test("amounts sent as text are read as numbers (regression)", () => {
  const raw = baseRecipe();
  raw.ingredients[0].amount = "150";
  assert.equal(sanitizeRecipe(raw, "ready").ingredients[0].amount, 150);
});

test("'not in stock' answers and empty kitchen measures become null", () => {
  const raw = baseRecipe();
  raw.ingredients[0].stockItem = "none";
  raw.ingredients[0].displayAmount = " ";
  const [ingredient] = sanitizeRecipe(raw, "ready").ingredients;
  assert.equal(ingredient.stockItem, null);
  assert.equal(ingredient.displayAmount, null);
});

test("recipes without a name or usable ingredients are rejected", () => {
  assert.equal(sanitizeRecipe({ ...baseRecipe(), name: "" }, "ready"), null);
  assert.equal(sanitizeRecipe({ ...baseRecipe(), ingredients: [{ name: "" }] }, "ready"), null);
  assert.equal(sanitizeRecipe(null, "ready"), null);
});

test("invalid servings fall back to 1", () => {
  assert.equal(sanitizeRecipe({ ...baseRecipe(), servings: 0 }, "ready").servings, 1);
});

test("the meal type and estimated fibre come through; unknown values become null", () => {
  const raw = { ...baseRecipe(), mealType: "lunch" };
  raw.estimatedMacrosPerServing.fiber = 6;
  const recipe = sanitizeRecipe(raw, "ready");
  assert.equal(recipe.mealType, "lunch");
  assert.equal(recipe.estimatedMacrosPerServing.fiber, 6);
  assert.equal(sanitizeRecipe({ ...baseRecipe(), mealType: "brunch" }, "ready").mealType, null);
  assert.equal(sanitizeRecipe(baseRecipe(), "ready").estimatedMacrosPerServing.fiber, null);
});
