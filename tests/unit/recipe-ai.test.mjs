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
    stockId: null,
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
  assert.match(any, /- \[1\] Eieren \(6 pcs\)/);
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

test("the complex switch asks for elaborate recipes; off, it asks for quick ones", async () => {
  const { buildUserMessage } = await import("../../js/recipe-ai.js");
  const stock = [{ name: "Kip", quantity: 500, unit: "g" }];
  const complex = buildUserMessage(stock, "", [], "dinner", { complex: true });
  assert.match(complex, /Make every recipe elaborate:/);
  assert.match(complex, /may take an hour or more/);
  // Normal recipes are asked to be quick, so the two modes clearly differ.
  const normal = buildUserMessage(stock, "", [], "dinner");
  assert.doesNotMatch(normal, /elaborate/);
  assert.match(
    normal,
    /Keep every recipe quick and simple: at most 30 minutes in total, at most 6 short steps/
  );
  assert.match(complex, /at least two components .* at least 8 steps/);
  // Works together with the follow-up request for recipes with extras.
  assert.match(
    buildUserMessage(stock, "", [], "", { group: "needsExtras", complex: true }),
    /leave this empty[\s\S]*elaborate/
  );
});

test("stock lines are numbered and give the total weight of packs and pieces when known", async () => {
  const { stockLine } = await import("../../js/recipe-ai.js");
  assert.equal(
    stockLine({ name: "Long grain rice", quantity: 1, unit: "pack", packGrams: 5000 }, 3),
    "- [3] Long grain rice (1 pack of 5000 g each = 5000 g in total)"
  );
  assert.equal(
    stockLine({ name: "Ei", quantity: 30, unit: "pcs", packGrams: 60 }, 1),
    "- [1] Ei (30 pcs of 60 g each = 1800 g in total)"
  );
  // Without a known weight, or for weight units, the amount stays as it is.
  assert.equal(stockLine({ name: "Ei", quantity: 30, unit: "pcs" }, 1), "- [1] Ei (30 pcs)");
  assert.equal(
    stockLine({ name: "Melk", quantity: 1, unit: "l", packGrams: 1000 }, 2),
    "- [2] Melk (1 l)"
  );
  assert.equal(stockLine({ name: "Zout", quantity: null, unit: "" }, 4), "- [4] Zout");
});

test("the AI's stock numbers become the pantry items' names; unknown numbers mean not in stock", async () => {
  const { applyStockIds } = await import("../../js/recipe-ai.js");
  const stock = [{ name: "Ei" }, { name: "Long grain rice" }];
  const recipes = [
    {
      ingredients: [
        { name: "Rijst", stockId: 2, stockItem: undefined },
        { name: "Egg", stockId: 1, stockItem: undefined },
        { name: "Ui", stockId: null, stockItem: null },
        { name: "Kaas", stockId: 9, stockItem: undefined },
        // Older answers name the item instead; that is kept.
        { name: "Melk", stockItem: "Melk" }
      ]
    }
  ];
  const [recipe] = applyStockIds(recipes, stock);
  assert.deepEqual(
    recipe.ingredients.map((i) => [i.name, i.stockItem, "stockId" in i]),
    [
      ["Rijst", "Long grain rice", false],
      ["Egg", "Ei", false],
      ["Ui", null, false],
      ["Kaas", null, false],
      ["Melk", "Melk", false]
    ]
  );
});
