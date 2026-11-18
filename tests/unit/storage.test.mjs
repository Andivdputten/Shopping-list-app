// Unit tests for reading stored data (js/storage.js), using an in-memory stand-in for localStorage.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STOCK_STORAGE_KEY, STORAGE_KEY, RECIPE_STORAGE_KEY } from "../../js/constants.js";
import { loadItems, loadRecipes, loadStockItems } from "../../js/storage.js";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};

beforeEach(() => store.clear());

test("missing, corrupt or non-array data loads as an empty list", () => {
  assert.deepEqual(loadItems(), []);
  store.set(STORAGE_KEY, "{not json");
  assert.deepEqual(loadItems(), []);
  store.set(STORAGE_KEY, JSON.stringify({ name: "Melk" }));
  assert.deepEqual(loadItems(), []);
});

test("stored items are cleaned up: names trimmed, nameless entries dropped", () => {
  store.set(
    STORAGE_KEY,
    JSON.stringify([{ name: "  Melk ", quantity: 2, bought: true }, { name: "   " }, null, "x"])
  );
  const items = loadItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Melk");
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].bought, true);

  store.set(STOCK_STORAGE_KEY, JSON.stringify([{ name: "Rijst", quantity: "veel" }]));
  assert.deepEqual(loadStockItems()[0].quantity, null);
});

test("recipe ingredients without an amount are kept, not deleted (regression)", () => {
  store.set(
    RECIPE_STORAGE_KEY,
    JSON.stringify([
      {
        name: "Omelet",
        servings: 1,
        ingredients: [
          { name: "Ei", grams: 100, displayAmount: "2" },
          { name: "Zout", grams: 0 },
          { name: "Peper" }
        ]
      }
    ])
  );
  const [recipe] = loadRecipes();
  assert.deepEqual(
    recipe.ingredients.map((i) => [i.name, i.grams, i.displayAmount]),
    [
      ["Ei", 100, "2"],
      ["Zout", null, null],
      ["Peper", null, null]
    ]
  );
});
