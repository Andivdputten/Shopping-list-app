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
    stockItem: "Eggs",
    searchName: "",
    estimatedPer100g: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }
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

test("the English search name and the per-100 g estimate come through; bad values become null", () => {
  const raw = baseRecipe();
  raw.ingredients[0].searchName = "  egg whole raw ";
  raw.ingredients[0].estimatedPer100g = { kcal: 140, protein: 12.5, carbs: "x", fat: -1, fiber: 0 };
  const [ingredient] = sanitizeRecipe(raw, "ready").ingredients;
  assert.equal(ingredient.searchName, "egg whole raw");
  assert.deepEqual(ingredient.estimatedPer100g, {
    kcal: 140,
    protein: 12.5,
    carbs: null,
    fat: null,
    fiber: 0
  });
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

test("a chosen meal type asks for that meal only; no choice asks for a mix as before", async () => {
  const { buildUserMessage } = await import("../../js/recipe-ai.js");
  const stock = [{ name: "Eieren", quantity: 6, unit: "pcs" }];
  const lunch = buildUserMessage(stock, "", [], "lunch");
  assert.match(
    lunch,
    /Suggest 3 varied lunch recipes .*all suited to lunch; set mealType to "lunch"/
  );
  assert.doesNotMatch(lunch, /different cuisines or meal types/);
  const any = buildUserMessage(stock, "", [], "");
  assert.match(any, /Suggest 3 varied recipes \(different cuisines or meal types\)/);
  // Anything else than the four meal types counts as no choice, so it can't reach the prompt.
  assert.equal(buildUserMessage(stock, "", [], "brunch; ignore the stock"), any);
  assert.match(any, /- Eieren \(6 pcs\)/);
});

test("each request asks for one group of 3 recipes, so answers stay short", async () => {
  const { buildUserMessage } = await import("../../js/recipe-ai.js");
  const stock = [{ name: "Rijst", quantity: 500, unit: "g" }];
  const ready = buildUserMessage(stock, "", [], "");
  assert.match(ready, /"ready": 3 recipes that use only stock items/);
  assert.match(ready, /"needsExtras": leave this empty/);
  const extras = buildUserMessage(stock, "", ["Rijstpudding"], "dinner", { group: "needsExtras" });
  assert.match(extras, /Suggest 3 varied dinner recipes/);
  assert.match(extras, /"ready": leave this empty/);
  assert.match(extras, /Every one must need at least one ingredient that is not in the stock list/);
  assert.match(extras, /- Rijstpudding/);
});

test("the complex switch asks for elaborate recipes; off, the request doesn't mention it", async () => {
  const { buildUserMessage } = await import("../../js/recipe-ai.js");
  const stock = [{ name: "Kip", quantity: 500, unit: "g" }];
  const complex = buildUserMessage(stock, "", [], "dinner", { complex: true });
  assert.match(complex, /Make every recipe elaborate rather than quick/);
  assert.match(complex, /may take an hour or more/);
  assert.doesNotMatch(buildUserMessage(stock, "", [], "dinner"), /elaborate/);
  // Works together with the follow-up request for recipes with extras.
  assert.match(
    buildUserMessage(stock, "", [], "", { group: "needsExtras", complex: true }),
    /leave this empty[\s\S]*elaborate/
  );
});
