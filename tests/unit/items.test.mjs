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
  const { id, updatedAt, ...rest } = createShoppingItem({ name: "Melk", quantity: -2, unit: 5 });
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.ok(!Number.isNaN(Date.parse(updatedAt)));
  assert.deepEqual(rest, {
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
    packGrams: null,
    nutritionSource: null,
    nevoVersion: null,
    restockQuantity: null,
    bought: false
  });
  assert.equal(createStockItem({ name: "Ui", nutritionSource: "nevo" }).nutritionSource, "nevo");
  assert.equal(createStockItem({ name: "Ui", nutritionSource: "other" }).nutritionSource, null);
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

test("the weight of one pack is read from package texts; none without a weight", async () => {
  const { parsePackGrams } = await import("../../js/items.js");
  assert.equal(parsePackGrams("5 kg"), 5000);
  assert.equal(parsePackGrams("Rijst 1kg"), 1000);
  assert.equal(parsePackGrams("6 x 330 ml"), 1980);
  assert.equal(parsePackGrams("4×125g"), 500);
  assert.equal(parsePackGrams("75 cl"), 750);
  assert.equal(parsePackGrams("0,5 l"), 500);
  assert.equal(parsePackGrams("10 stuks"), null);
  assert.equal(parsePackGrams(null), null);
});

test("a pack weight is kept when merging and validated on new items", () => {
  assert.equal(createStockItem({ name: "Rijst", packGrams: 5000 }).packGrams, 5000);
  assert.equal(createStockItem({ name: "Rijst", packGrams: -1 }).packGrams, null);
  const known = createStockItem({ name: "Rijst", quantity: 1, unit: "pack", packGrams: 5000 });
  assert.equal(
    mergeStockItems(known, { quantity: 1, unit: "pack", packGrams: 1000 }).packGrams,
    5000
  );
  const unknown = createStockItem({ name: "Rijst", quantity: 1, unit: "pack" });
  assert.equal(
    mergeStockItems(unknown, { quantity: 1, unit: "pack", packGrams: 1000 }).packGrams,
    1000
  );
});

test("items keep a stable id and time; repeated or missing ids are replaced", async () => {
  const { ensureUniqueIds, newItemId } = await import("../../js/items.js");
  const kept = createStockItem({ name: "Rijst", id: "abc", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(kept.id, "abc");
  assert.equal(kept.updatedAt, "2026-01-01T00:00:00.000Z");
  // A list item made from a pantry item (and back) keeps the same id.
  assert.equal(createShoppingItem(kept).id, "abc");
  assert.notEqual(newItemId(), newItemId());

  const list = [{ id: "a" }, { id: "a" }, { id: "" }, { id: "b" }];
  assert.equal(ensureUniqueIds(list), true);
  assert.equal(list[0].id, "a");
  assert.notEqual(list[1].id, "a");
  assert.notEqual(list[2].id, "");
  assert.equal(new Set(list.map((item) => item.id)).size, 4);
  assert.equal(ensureUniqueIds(list), false);
});

test("running low means at or below 20% of the last restock, rounded up", async () => {
  const { isRunningLow } = await import("../../js/items.js");
  const low = (quantity, restockQuantity) => isRunningLow({ quantity, restockQuantity });
  // Restocked to 6: the threshold is ceil(1.2) = 2.
  assert.equal(low(2, 6), true);
  assert.equal(low(3, 6), false);
  // Restocked to 3: the threshold is ceil(0.6) = 1.
  assert.equal(low(1, 3), true);
  assert.equal(low(2, 3), false);
  // Weights work the same way: 500 g restock, low at 100 g or less.
  assert.equal(low(100, 500), true);
  assert.equal(low(101, 500), false);
  // Without a quantity or a restock amount an item is never low.
  assert.equal(low(null, 6), false);
  assert.equal(low(1, null), false);
  assert.equal(isRunningLow(createStockItem({ name: "Melk", quantity: 1 })), false);
});

test("a restock is recorded only when the quantity goes up", async () => {
  const { markRestocked } = await import("../../js/items.js");
  assert.equal(markRestocked({ quantity: 7, restockQuantity: 6 }, 1).restockQuantity, 7);
  assert.equal(markRestocked({ quantity: 6, restockQuantity: null }, null).restockQuantity, 6);
  // Using some up (or a merge that couldn't add, like pack and g) keeps the old level.
  assert.equal(markRestocked({ quantity: 4, restockQuantity: 6 }, 6).restockQuantity, 6);
  assert.equal(markRestocked({ quantity: 6, restockQuantity: 6 }, 6).restockQuantity, 6);
  assert.equal(markRestocked({ quantity: null, restockQuantity: 6 }, 6).restockQuantity, 6);
});

test("counted units get steppers; weights and volumes get presets instead", async () => {
  const { isCountableUnit, unitPresets } = await import("../../js/items.js");
  for (const unit of ["", "pcs", "pack", "bottle", "can", " PCS "]) {
    assert.equal(isCountableUnit(unit), true, unit);
    assert.deepEqual(unitPresets(unit), [], unit);
  }
  for (const unit of ["g", "kg", "ml", "l", "KG"]) {
    assert.equal(isCountableUnit(unit), false, unit);
  }
  assert.deepEqual(
    unitPresets("g").map((p) => `${p.quantity} ${p.unit}`),
    ["100 g", "250 g", "500 g", "1 kg"]
  );
  assert.deepEqual(
    unitPresets("ml").map((p) => `${p.quantity} ${p.unit}`),
    ["250 ml", "500 ml", "1 l"]
  );
  assert.deepEqual(
    unitPresets("l").map((p) => `${p.quantity} ${p.unit}`),
    ["0.5 l", "1 l", "1.5 l", "2 l"]
  );
});
