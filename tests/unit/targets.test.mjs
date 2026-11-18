// Unit tests for daily targets and the fit badge (js/targets.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessFit,
  calculateTargets,
  maintenanceCalories,
  mealSplitTotal,
  mealTargets,
  normalizeTargetSettings
} from "../../js/targets.js";

const body = {
  sex: "male",
  age: 35,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  goal: "keep"
};

test("maintenance calories use Mifflin-St Jeor times the activity factor", () => {
  // 10*80 + 6.25*180 - 5*35 + 5 = 1755; x 1.55 = 2720.25
  assert.equal(Math.round(maintenanceCalories(body)), 2720);
  // Women: -161 instead of +5 → 1589 x 1.2
  assert.equal(
    Math.round(maintenanceCalories({ ...body, sex: "female", activity: "sedentary" })),
    1907
  );
});

test("targets follow the goal: protein 1.8 g/kg, fat 30%, fibre 14 g per 1000 kcal, carbs the rest", () => {
  assert.deepEqual(calculateTargets(body), {
    kcal: 2720,
    protein: 144,
    fat: 91,
    fiber: 38,
    carbs: 332
  });
  // Lose = -15%, gain = +10%.
  assert.equal(calculateTargets({ ...body, goal: "lose" }).kcal, 2312);
  assert.equal(calculateTargets({ ...body, goal: "gain" }).kcal, 2992);
});

test("the calculator refuses incomplete or impossible body data", () => {
  assert.equal(calculateTargets({ ...body, weightKg: null }), null);
  assert.equal(calculateTargets({ ...body, age: 0 }), null);
  assert.equal(calculateTargets({ ...body, activity: "couch" }), null);
});

test("meal targets are each meal's share of the daily targets; unset targets stay unset", () => {
  const daily = { kcal: 2000, protein: 150, carbs: null, fat: 70, fiber: 30 };
  const split = { breakfast: 25, lunch: 30, dinner: 35, snack: 10 };
  assert.equal(mealSplitTotal(split), 100);
  assert.deepEqual(mealTargets(daily, split, "dinner"), {
    kcal: 700,
    protein: 52.5,
    carbs: null,
    fat: 24.5,
    fiber: 10.5
  });
  assert.equal(mealTargets(daily, split, "brunch"), null);
});

test("the fit badge: kcal within 10% is a good fit, macros flagged over 125% or under 75%", () => {
  const target = { kcal: 700, protein: 50, carbs: 80, fat: 25, fiber: 10 };
  const good = assessFit({ kcal: 760, protein: 30, carbs: 80, fat: 33, fiber: 10 }, target);
  assert.equal(good.kcal, "good");
  assert.deepEqual(good.notes, [
    { macro: "protein", level: "low" },
    { macro: "fat", level: "high" }
  ]);
  assert.equal(
    assessFit({ kcal: 771, protein: 50, carbs: 80, fat: 25, fiber: 10 }, target).kcal,
    "over"
  );
  assert.equal(
    assessFit({ kcal: 629, protein: 50, carbs: 80, fat: 25, fiber: 10 }, target).kcal,
    "under"
  );
  // Unknown fibre in the recipe is never reported as "low".
  assert.deepEqual(
    assessFit({ kcal: 700, protein: 50, carbs: 80, fat: 25, fiber: null }, target).notes,
    []
  );
  // No badge without a kcal target or without the recipe's kcal.
  assert.equal(assessFit({ kcal: 700 }, { ...target, kcal: null }), null);
  assert.equal(assessFit({ kcal: null }, target), null);
});

test("stored settings are cleaned up and fall back to the default meal split", () => {
  const settings = normalizeTargetSettings({
    targets: { kcal: "2000", protein: 150, fat: -5 },
    mealSplit: { breakfast: 50 }
  });
  assert.deepEqual(settings.targets, {
    kcal: null,
    protein: 150,
    carbs: null,
    fat: null,
    fiber: null
  });
  assert.deepEqual(settings.mealSplit, { breakfast: 25, lunch: 30, dinner: 35, snack: 10 });
  assert.deepEqual(normalizeTargetSettings(undefined).body, {
    sex: "",
    age: null,
    heightCm: null,
    weightKg: null,
    activity: "",
    goal: "keep"
  });
});
