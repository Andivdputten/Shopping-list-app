// Unit tests for the item rules in js/items.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShoppingItem,
  createStockItem,
  mergeStockItems,
  normalizeCategory,
  normalizeIngredientName,
  parsePackageQuantity,
  positiveQuantityOrNull
} from "../../js/items.js";

test("package sizes from Open Food Facts become a quantity and unit", () => {
  assert.deepEqual(parsePackageQuantity("500 g"), { quantity: 500, unit: "g" });
  assert.deepEqual(parsePackageQuantity("1,5 kg"), { quantity: 1.5, unit: "kg" });
  // Centilitres are converted to millilitres.
  assert.deepEqual(parsePackageQuantity("33 cl"), { quantity: 330, unit: "ml" });
  // Anything unclear counts as one pack.
  assert.deepEqual(parsePackageQuantity("6 x 33 cl"), { quantity: 1, unit: "pack" });
  assert.deepEqual(parsePackageQuantity(undefined), { quantity: 1, unit: "pack" });
});

test("ingredient names match regardless of case, spacing and a plural s", () => {
  assert.equal(normalizeIngredientName("  Eggs "), normalizeIngredientName("egg"));
  assert.equal(normalizeIngredientName("Olive   Oil"), "olive oil");
  // Short words keep their s, so "gas" stays "gas".
  assert.equal(normalizeIngredientName("gas"), "gas");
});

test("new items get safe defaults for missing or wrongly typed fields", () => {
  assert.deepEqual(createShoppingItem({ name: "Melk", quantity: -2, unit: 5 }), {
    name: "Melk",
    quantity: null,
    unit: "",
    category: "",
    note: "",
    barcode: "",
    nutrition: {
      kcal100g: null,
      protein100g: null,
      carbs100g: null,
      fat100g: null,
      fiber100g: null
    },
    nutritionAmount: null,
    bought: false
  });
  assert.equal("bought" in createStockItem({ name: "Melk" }), false);
  assert.equal(positiveQuantityOrNull(0), null);
  assert.equal(positiveQuantityOrNull(2), 2);
});

test("merging pantry items adds quantities only when the units match", () => {
  const existing = createStockItem({ name: "Rijst", quantity: 500, unit: "g" });
  assert.equal(mergeStockItems(existing, { quantity: 250, unit: "g" }).quantity, 750);
  assert.equal(mergeStockItems(existing, { quantity: 1, unit: "pack" }).quantity, 500);
  // An item without a quantity takes the incoming one.
  const unknown = createStockItem({ name: "Rijst" });
  assert.equal(mergeStockItems(unknown, { quantity: 1, unit: "pack" }).quantity, 1);
});

test("only known categories are kept", () => {
  assert.equal(normalizeCategory(" Dairy "), "Dairy");
  assert.equal(normalizeCategory("Snacks"), "");
});
