// Unit tests for the "Cook this" rules in js/cooking.js: matching, unit conversion, scaling and deducting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCooking, findStockIndex, gramsToStockUnit, planCooking } from "../../js/cooking.js";

const stock = () => [
  { name: "Rijst", quantity: 500, unit: "g" },
  { name: "Halfvolle melk", quantity: 1, unit: "l" },
  { name: "Eggs", quantity: 6, unit: "pcs" },
  { name: "Volkoren pasta", quantity: 1, unit: "pack" },
  { name: "Kaas", quantity: null, unit: "g" }
];

const recipe = (ingredients, servings = 2) => ({ name: "Test", servings, ingredients });

test("grams convert to g, kg, ml and l, and to nothing else", () => {
  assert.equal(gramsToStockUnit(150, "g"), 150);
  assert.equal(gramsToStockUnit(150, "kg"), 0.15);
  // 1 ml is counted as 1 g.
  assert.equal(gramsToStockUnit(200, "ml"), 200);
  assert.equal(gramsToStockUnit(200, "l"), 0.2);
  assert.equal(gramsToStockUnit(200, "pack"), null);
  assert.equal(gramsToStockUnit(200, "pcs"), null);
});

test("ingredients find their pantry item by link first, then by name", () => {
  const items = stock();
  // A link to the pantry item wins over the ingredient's own name.
  assert.equal(findStockIndex({ name: "Melk", stockItem: "Halfvolle melk" }, items), 1);
  // Old recipes have no link and match by name (case, spacing and plural s ignored).
  assert.equal(findStockIndex({ name: "egg" }, items), 2);
  // An explicit "not in stock" is respected, even when a name would match.
  assert.equal(findStockIndex({ name: "Rijst", stockItem: null }, items), -1);
  // A link to a renamed or deleted item falls back to the ingredient name.
  assert.equal(findStockIndex({ name: "Rijst", stockItem: "Basmati" }, items), 0);
});

test("a cooking plan converts, counts and scales by servings cooked", () => {
  const plan = planCooking(
    recipe([
      { name: "Rijst", grams: 300, displayAmount: null, stockItem: "Rijst" },
      { name: "Melk", grams: 200, displayAmount: "2 dl", stockItem: "Halfvolle melk" },
      { name: "Ei", grams: 200, displayAmount: "4", stockItem: "Eggs" }
    ]),
    1,
    stock()
  );
  // 1 of 2 servings: everything halves.
  assert.equal(plan.scale, 0.5);
  assert.deepEqual(
    plan.lines.map((l) => [l.name, l.kind, l.amount, l.unit, l.short]),
    [
      ["Rijst", "convert", 150, "g", 0],
      ["Melk", "convert", 0.1, "l", 0],
      ["Ei", "count", 2, "pcs", 0]
    ]
  );
});

test("lines that can't be converted ask for an amount, missing and unknown ones deduct nothing", () => {
  const plan = planCooking(
    recipe([
      { name: "Pasta", grams: 200, displayAmount: null, stockItem: "Volkoren pasta" },
      { name: "Ui", grams: 150, displayAmount: "1", stockItem: null },
      { name: "Kaas", grams: 50, displayAmount: null, stockItem: "Kaas" }
    ]),
    2,
    stock()
  );
  assert.deepEqual(
    plan.lines.map((l) => [l.name, l.kind, l.amount, l.stockIndex]),
    [
      ["Pasta", "manual", null, 3],
      ["Ui", "missing", null, -1],
      // In the pantry, but its quantity is unknown.
      ["Kaas", "unknown", null, 4]
    ]
  );
});

test("needing more than is in stock uses it all and reports the shortfall", () => {
  const plan = planCooking(
    recipe([{ name: "Rijst", grams: 700, displayAmount: null, stockItem: "Rijst" }]),
    2,
    stock()
  );
  assert.equal(plan.lines[0].amount, 500);
  assert.equal(plan.lines[0].short, 200);
});

test("two ingredients from the same pantry item share what is left", () => {
  const plan = planCooking(
    recipe([
      { name: "Rijst", grams: 300, displayAmount: null, stockItem: "Rijst" },
      { name: "Rijst", grams: 300, displayAmount: null, stockItem: "Rijst" }
    ]),
    2,
    stock()
  );
  assert.deepEqual(
    plan.lines.map((l) => [l.amount, l.short]),
    [
      [300, 0],
      [200, 100]
    ]
  );
});

test("applying a plan subtracts amounts and removes used-up items, without changing the input", () => {
  const items = stock();
  const result = applyCooking(items, [
    { stockIndex: 0, amount: 150 },
    { stockIndex: 2, amount: 6 },
    { stockIndex: 1, amount: 0 }
  ]);
  assert.deepEqual(
    result.stockItems.map((i) => [i.name, i.quantity]),
    [
      ["Rijst", 350],
      ["Halfvolle melk", 1],
      ["Volkoren pasta", 1],
      ["Kaas", null]
    ]
  );
  assert.deepEqual(
    result.usedUp.map((i) => i.name),
    ["Eggs"]
  );
  // The original list is untouched, so undo can restore it.
  assert.equal(items[0].quantity, 500);
  assert.equal(items.length, 5);
});
