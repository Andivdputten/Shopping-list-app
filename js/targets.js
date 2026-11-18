// Daily targets: the calculator, each meal's share of the day, and the fit badge for recipes.
// No page or state access, so every rule is unit-tested (tests/unit/targets.test.mjs).

// Multipliers on resting calories for how active someone is (the standard Mifflin-St Jeor levels).
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9
};

// How the goal changes maintenance calories: lose 15% below, keep, or gain 10% above.
export const GOAL_ADJUSTMENTS = { lose: -0.15, keep: 0, gain: 0.1 };

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

// Share of the day's targets per meal, in percent; must add up to 100.
export const DEFAULT_MEAL_SPLIT = { breakfast: 25, lunch: 30, dinner: 35, snack: 10 };

export const TARGET_KEYS = ["kcal", "protein", "carbs", "fat", "fiber"];

// Fit badge thresholds: kcal within ±10% of the meal's share is a good fit; a macro above 125% or
// below 75% of its share gets a note.
const KCAL_BAND = 0.1;
const MACRO_HIGH = 1.25;
const MACRO_LOW = 0.75;

const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

// Calories per day to keep the current weight: Mifflin-St Jeor resting calories times the activity factor.
export function maintenanceCalories({ sex, age, heightCm, weightKg, activity }) {
  const resting = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  return resting * ACTIVITY_FACTORS[activity];
}

// Suggested daily targets from body data, or null when something needed is missing or impossible.
// Protein 1.8 g per kg body weight, fat 30% of calories, fibre 14 g per 1000 kcal, carbs the remainder.
export function calculateTargets(body) {
  const valid =
    body &&
    (body.sex === "male" || body.sex === "female") &&
    positive(body.age) &&
    positive(body.heightCm) &&
    positive(body.weightKg) &&
    body.activity in ACTIVITY_FACTORS &&
    body.goal in GOAL_ADJUSTMENTS;
  if (!valid) {
    return null;
  }

  const kcal = Math.round(maintenanceCalories(body) * (1 + GOAL_ADJUSTMENTS[body.goal]));
  const protein = Math.round(1.8 * body.weightKg);
  const fatKcal = 0.3 * kcal;
  return {
    kcal,
    protein,
    fat: Math.round(fatKcal / 9),
    fiber: Math.round((14 * kcal) / 1000),
    // Protein has 4 kcal per gram and carbs 4; never below zero for very high protein.
    carbs: Math.max(0, Math.round((kcal - protein * 4 - fatKcal) / 4))
  };
}

// Sum of the meal split percentages; the settings only accept a split that adds up to 100.
export function mealSplitTotal(split) {
  return MEAL_TYPES.reduce((sum, meal) => sum + (Number(split[meal]) || 0), 0);
}

// One meal's share of the daily targets (e.g. dinner = 35% of each); unset targets stay null.
export function mealTargets(dailyTargets, split, mealType) {
  if (!MEAL_TYPES.includes(mealType)) {
    return null;
  }
  const share = (Number(split[mealType]) || 0) / 100;
  const result = {};
  TARGET_KEYS.forEach((key) => {
    result[key] = positive(dailyTargets[key])
      ? Math.round(dailyTargets[key] * share * 10) / 10
      : null;
  });
  return result;
}

// Compares a recipe's per-serving values with a meal's targets.
// Returns null when there is nothing to compare (no kcal target or no recipe kcal); otherwise
// kcal: "good" | "over" | "under", and notes: [{ macro, level: "high" | "low" }] for macros out of range.
export function assessFit(perServing, mealTarget) {
  if (!perServing || !mealTarget || !positive(mealTarget.kcal) || !positive(perServing.kcal)) {
    return null;
  }

  const ratio = perServing.kcal / mealTarget.kcal;
  const kcal = ratio > 1 + KCAL_BAND ? "over" : ratio < 1 - KCAL_BAND ? "under" : "good";

  const notes = [];
  ["protein", "carbs", "fat", "fiber"].forEach((macro) => {
    const value = perServing[macro];
    // Unknown values (e.g. fibre the recipe has no data for) are never flagged.
    if (!positive(mealTarget[macro]) || typeof value !== "number") {
      return;
    }
    const macroRatio = value / mealTarget[macro];
    if (macroRatio > MACRO_HIGH) {
      notes.push({ macro, level: "high" });
    } else if (macroRatio < MACRO_LOW) {
      notes.push({ macro, level: "low" });
    }
  });

  return { kcal, notes };
}

// Cleans up stored target settings: body data for the calculator, the daily targets and the meal split.
// Wrong or missing values become empty; a meal split that doesn't add up to 100 falls back to the default.
export function normalizeTargetSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawBody = source.body && typeof source.body === "object" ? source.body : {};
  const rawTargets = source.targets && typeof source.targets === "object" ? source.targets : {};
  const rawSplit = source.mealSplit && typeof source.mealSplit === "object" ? source.mealSplit : {};

  const number = (value) => (positive(value) ? value : null);
  const targets = {};
  TARGET_KEYS.forEach((key) => {
    targets[key] = number(rawTargets[key]);
  });

  const split = {};
  MEAL_TYPES.forEach((meal) => {
    split[meal] = typeof rawSplit[meal] === "number" && rawSplit[meal] >= 0 ? rawSplit[meal] : null;
  });
  const splitValid =
    MEAL_TYPES.every((meal) => split[meal] !== null) && mealSplitTotal(split) === 100;

  return {
    body: {
      sex: rawBody.sex === "male" || rawBody.sex === "female" ? rawBody.sex : "",
      age: number(rawBody.age),
      heightCm: number(rawBody.heightCm),
      weightKg: number(rawBody.weightKg),
      activity: rawBody.activity in ACTIVITY_FACTORS ? rawBody.activity : "",
      goal: rawBody.goal in GOAL_ADJUSTMENTS ? rawBody.goal : "keep"
    },
    targets,
    mealSplit: splitValid ? split : { ...DEFAULT_MEAL_SPLIT }
  };
}
