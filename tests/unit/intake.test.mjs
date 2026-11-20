// Unit tests for the intake log rules (js/intake.js): dates, default meals, entry values and day totals.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEntry,
  dateKey,
  dayTotals,
  entryNutrition,
  kcalPerDay,
  mealForTime,
  mealKcal,
  normalizeIntakeLog,
  perGramFromNutrition,
  perServingFromRecipe,
  shiftDate
} from "../../js/intake.js";

test("days are local calendar dates and can be stepped across months", () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});

test("the default meal follows the time of day", () => {
  const at = (h, m) => mealForTime(new Date(2026, 0, 5, h, m));
  assert.equal(at(7, 0), "breakfast");
  assert.equal(at(10, 29), "breakfast");
  assert.equal(at(10, 30), "lunch");
  assert.equal(at(14, 59), "lunch");
  assert.equal(at(15, 0), "dinner");
  assert.equal(at(20, 59), "dinner");
  assert.equal(at(21, 0), "snack");
});

test("an entry's values are its per-unit values times the quantity; unknown stays unknown", () => {
  const entry = createEntry({
    date: "2026-01-05",
    meal: "lunch",
    name: "Yoghurt",
    source: "product",
    unit: "g",
    quantity: 150,
    perUnit: { kcal: 0.6, protein: 0.04, carbs: 0.05, fat: 0.02, fiber: null },
    status: "complete"
  });
  assert.deepEqual(entryNutrition(entry), {
    kcal: 90,
    protein: 6,
    carbs: 7.5,
    fat: 3,
    fiber: null
  });
});

test("product nutrition per 100 g becomes per gram; status says how complete it is", () => {
  assert.deepEqual(
    perGramFromNutrition({
      kcal100g: 60,
      protein100g: 4,
      carbs100g: 5,
      fat100g: 1.5,
      fiber100g: null
    }),
    {
      perUnit: { kcal: 0.6, protein: 0.04, carbs: 0.05, fat: 0.015, fiber: null },
      status: "complete"
    }
  );
  assert.equal(perGramFromNutrition({ kcal100g: null, protein100g: 4 }).status, "partial");
  assert.equal(perGramFromNutrition(null).status, "unknown");
});

test("a recipe's per-serving values come from its ingredients; missing data is flagged, not zero", () => {
  const recipe = {
    servings: 2,
    ingredients: [
      {
        name: "Rijst",
        grams: 200,
        nutrition: { kcal100g: 350, protein100g: 7, carbs100g: 78, fat100g: 1, fiber100g: 1 }
      },
      {
        name: "Kip",
        grams: 300,
        nutrition: { kcal100g: 120, protein100g: 23, carbs100g: 0, fat100g: 2, fiber100g: null }
      }
    ]
  };
  assert.deepEqual(perServingFromRecipe(recipe), {
    perUnit: { kcal: 530, protein: 41.5, carbs: 78, fat: 4, fiber: 1 },
    status: "complete",
    nevoVersion: null
  });
  // An AI estimate for one ingredient marks the whole serving "estimated"; NEVO's version is passed on
  // for RIVM's reference on the Today tab.
  const [rice, chicken] = recipe.ingredients;
  const mixed = perServingFromRecipe({
    ...recipe,
    ingredients: [
      { ...rice, nutritionSource: "nevo", nevoVersion: "2099/1.0" },
      { ...chicken, nutritionSource: "estimated" }
    ]
  });
  assert.deepEqual([mixed.status, mixed.nevoVersion], ["estimated", "2099/1.0"]);
  // One ingredient without data: values from the rest, marked partial.
  const partial = perServingFromRecipe({
    ...recipe,
    ingredients: [...recipe.ingredients, { name: "Saus", grams: 100, nutrition: null }]
  });
  assert.equal(partial.status, "partial");
  assert.equal(partial.perUnit.kcal, 530);
  // No data at all: unknown, unless the AI's estimate can stand in (marked estimated).
  const none = { servings: 1, ingredients: [{ name: "Saus", grams: 100 }] };
  assert.equal(perServingFromRecipe(none).status, "unknown");
  assert.deepEqual(
    perServingFromRecipe(none, { kcal: 400, protein: 20, carbs: 40, fat: 15, fiber: null }),
    {
      perUnit: { kcal: 400, protein: 20, carbs: 40, fat: 15, fiber: null },
      status: "estimated"
    }
  );
});

test("day totals add the known values and count entries that aren't fully counted", () => {
  const base = { date: "2026-01-05", source: "manual", unit: "", quantity: 1 };
  const entries = [
    createEntry({
      ...base,
      meal: "breakfast",
      name: "A",
      perUnit: { kcal: 400, protein: 20, carbs: 50, fat: 10, fiber: 5 },
      status: "complete"
    }),
    createEntry({
      ...base,
      meal: "lunch",
      name: "B",
      perUnit: { kcal: 600, protein: 30, carbs: null, fat: 20, fiber: null },
      status: "partial"
    }),
    createEntry({
      ...base,
      meal: "lunch",
      name: "C",
      perUnit: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
      status: "unknown"
    }),
    createEntry({
      ...base,
      date: "2026-01-04",
      meal: "dinner",
      name: "D",
      perUnit: { kcal: 900, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      status: "complete"
    })
  ];
  assert.deepEqual(dayTotals(entries, "2026-01-05"), {
    totals: { kcal: 1000, protein: 50, carbs: 50, fat: 30, fiber: 5 },
    notFullyCounted: 2,
    count: 3
  });
  assert.deepEqual(mealKcal(entries, "2026-01-05"), {
    breakfast: 400,
    lunch: 600,
    dinner: 0,
    snack: 0
  });
  assert.deepEqual(kcalPerDay(entries, "2026-01-05", 3), [
    { date: "2026-01-03", kcal: 0 },
    { date: "2026-01-04", kcal: 900 },
    { date: "2026-01-05", kcal: 1000 }
  ]);
});

test("stored entries are validated: broken ones are dropped, missing values become unknown", () => {
  const log = normalizeIntakeLog([
    {
      id: "a",
      date: "2026-01-05",
      time: "12:00",
      meal: "lunch",
      name: "Soep",
      source: "manual",
      unit: "",
      quantity: 1,
      perUnit: { kcal: 300 },
      status: "complete"
    },
    { id: "b", date: "not a date", meal: "lunch", name: "X" },
    { id: "c", date: "2026-01-05", meal: "brunch", name: "Y" },
    null
  ]);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].perUnit, {
    kcal: 300,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null
  });
  assert.deepEqual(normalizeIntakeLog("nonsense"), []);
});
