// Unit tests for the shopping list's add box (js/add-parser.js) and aisle memory (js/aisle-memory.js).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { findSameNameItem, mergedAmount, parseAddInput } from "../../js/add-parser.js";
import { AISLE_MEMORY_STORAGE_KEY } from "../../js/constants.js";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};
const { rememberAisle, suggestAisle } = await import("../../js/aisle-memory.js");

beforeEach(() => store.clear());

const parsed = (name, quantity, unit) => ({ name, quantity, unit });

test("an amount at the start is read, with or without a space before the unit", () => {
  assert.deepEqual(parseAddInput("2 l milk"), parsed("Milk", 2, "l"));
  assert.deepEqual(parseAddInput("500g mince"), parsed("Mince", 500, "g"));
  assert.deepEqual(parseAddInput("1,5 kg potatoes"), parsed("Potatoes", 1.5, "kg"));
  assert.deepEqual(parseAddInput("0.5 litres orange juice"), parsed("Orange juice", 0.5, "l"));
  assert.deepEqual(parseAddInput("3 cans chickpeas"), parsed("Chickpeas", 3, "can"));
  assert.deepEqual(parseAddInput("2 packs Rice"), parsed("Rice", 2, "pack"));
});

test("a plain count at the start gives a quantity without a unit", () => {
  assert.deepEqual(parseAddInput("3 bananas"), parsed("Bananas", 3, ""));
  assert.deepEqual(parseAddInput("2x milk"), parsed("Milk", 2, ""));
  assert.deepEqual(parseAddInput("2 x milk"), parsed("Milk", 2, ""));
  // A word after the number that isn't a unit stays part of the name.
  assert.deepEqual(parseAddInput("2 large eggs"), parsed("Large eggs", 2, ""));
});

test("a number with a unit at the end is read", () => {
  assert.deepEqual(parseAddInput("milk 2l"), parsed("Milk", 2, "l"));
  assert.deepEqual(parseAddInput("Semi-skimmed milk 2 l"), parsed("Semi-skimmed milk", 2, "l"));
  assert.deepEqual(parseAddInput("Rice 1 KG"), parsed("Rice", 1, "kg"));
});

test("numbers that belong to the name are left alone", () => {
  for (const text of [
    "7up",
    "7up zero",
    "2-in-1 shampoo",
    "Tomatoes 400g x2",
    "Category 5",
    "Cola 0"
  ]) {
    assert.deepEqual(parseAddInput(text), parsed(text, null, ""), text);
  }
  // Only an amount, no name: kept as typed rather than guessing.
  assert.deepEqual(parseAddInput("2 l"), parsed("2 l", null, ""));
  assert.deepEqual(parseAddInput("500g"), parsed("500g", null, ""));
  assert.deepEqual(parseAddInput("0 bananas"), parsed("0 bananas", null, ""));
});

test("spacing is tidied and empty input gives an empty name", () => {
  assert.deepEqual(parseAddInput("  2   l   milk "), parsed("Milk", 2, "l"));
  assert.deepEqual(parseAddInput("   "), parsed("", null, ""));
  assert.deepEqual(parseAddInput(undefined), parsed("", null, ""));
  // Names keep their own capitals.
  assert.deepEqual(parseAddInput("iPhone charger"), parsed("iPhone charger", null, ""));
});

test("an item with the same name is found regardless of case and a plural s", () => {
  const items = [{ name: "Semi-skimmed milk" }, { name: "Eggs" }];
  assert.equal(findSameNameItem(items, "semi-skimmed  MILK"), items[0]);
  assert.equal(findSameNameItem(items, "egg"), items[1]);
  assert.equal(findSameNameItem(items, "milk"), null);
  assert.equal(findSameNameItem(items, ""), null);
});

test("a typed amount is added to the item on the list only when the units match", () => {
  assert.deepEqual(mergedAmount({ quantity: 2, unit: "l" }, parsed("Milk", 2, "l")), {
    quantity: 4,
    unit: "l"
  });
  assert.deepEqual(mergedAmount({ quantity: 0.1, unit: "kg" }, parsed("Rice", 0.2, "kg")), {
    quantity: 0.3,
    unit: "kg"
  });
  // No amount on the list yet: the typed one is used.
  assert.deepEqual(mergedAmount({ quantity: null, unit: "" }, parsed("Milk", 1, "l")), {
    quantity: 1,
    unit: "l"
  });
  assert.equal(mergedAmount({ quantity: 1, unit: "pack" }, parsed("Rice", 500, "g")), null);
  assert.equal(mergedAmount({ quantity: 2, unit: "l" }, parsed("Milk", null, "")), null);
});

test("the aisle comes from what you chose before, then from the pantry", () => {
  const pantry = [
    { name: "Eggs", category: "Dairy" },
    { name: "Rice", category: "" }
  ];
  assert.deepEqual(suggestAisle("egg", pantry), { category: "Dairy", source: "pantry" });
  assert.equal(suggestAisle("rice", pantry), null);
  assert.equal(suggestAisle("", pantry), null);

  rememberAisle("Eggs", "Produce");
  assert.deepEqual(suggestAisle("eggs", pantry), { category: "Produce", source: "history" });
  // Unknown aisles and "No aisle" aren't remembered.
  rememberAisle("Rice", "");
  rememberAisle("Rice", "Snacks");
  assert.equal(suggestAisle("rice", pantry), null);
  assert.deepEqual(Object.keys(JSON.parse(store.get(AISLE_MEMORY_STORAGE_KEY))), ["egg"]);
});
