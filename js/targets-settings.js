// The "Daily targets" card in Settings: calculator inputs, the editable daily targets and the meal split.
// Every change is saved right away; the meal split only when it adds up to 100%.
import { saveTargetSettings } from "./persistence.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { state } from "./state.js";
import { MEAL_TYPES, calculateTargets, kcalFromMacros, mealSplitTotal } from "./targets.js";
import { renderToday } from "./today.js";

const byId = (id) => document.getElementById(id);

// Input ids per field, so filling and reading the form is one loop each.
const BODY_FIELDS = {
  sex: "targetSexSelect",
  age: "targetAgeInput",
  heightCm: "targetHeightInput",
  weightKg: "targetWeightInput",
  activity: "targetActivitySelect",
  goal: "targetGoalSelect"
};
const TARGET_FIELDS = {
  kcal: "targetKcalInput",
  protein: "targetProteinInput",
  carbs: "targetCarbsInput",
  fat: "targetFatInput",
  fiber: "targetFiberInput"
};
const SPLIT_FIELDS = {
  breakfast: "mealSplitBreakfastInput",
  lunch: "mealSplitLunchInput",
  dinner: "mealSplitDinnerInput",
  snack: "mealSplitSnackInput"
};

// A positive number from an input, or null when it is empty or invalid.
function readNumber(id) {
  const value = Number(byId(id).value);
  return byId(id).value.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

function fillForm() {
  const { body, targets, mealSplit } = state.targetSettings;
  Object.entries(BODY_FIELDS).forEach(([key, id]) => {
    byId(id).value = body[key] === null ? "" : String(body[key]);
  });
  Object.entries(TARGET_FIELDS).forEach(([key, id]) => {
    byId(id).value = targets[key] === null ? "" : String(targets[key]);
  });
  Object.entries(SPLIT_FIELDS).forEach(([key, id]) => {
    byId(id).value = String(mealSplit[key]);
  });
}

// Saves and refreshes what depends on the targets: the saved recipes' fit badges and the Today tab.
function saveAndRefresh(message) {
  saveTargetSettings();
  renderSavedRecipes();
  renderToday();
  byId("targetsStatus").textContent = message;
}

export function initTargetsSettings() {
  if (!byId("calculateTargetsButton")) {
    return;
  }
  fillForm();

  Object.entries(BODY_FIELDS).forEach(([key, id]) => {
    byId(id).addEventListener("change", () => {
      const isText = key === "sex" || key === "activity" || key === "goal";
      state.targetSettings.body[key] = isText ? byId(id).value : readNumber(id);
      saveTargetSettings();
    });
  });

  byId("calculateTargetsButton").addEventListener("click", () => {
    const targets = calculateTargets(state.targetSettings.body);
    if (!targets) {
      byId("targetsStatus").textContent =
        "Fill in sex, age, height, weight and activity level first.";
      return;
    }
    state.targetSettings.targets = targets;
    fillForm();
    saveAndRefresh(`Targets calculated: ${targets.kcal} kcal per day. Adjust them if you like.`);
  });

  // kcal is read-only: changing protein, carbs or fat recalculates it (x 4, x 4, x 9).
  Object.entries(TARGET_FIELDS).forEach(([key, id]) => {
    if (key === "kcal") {
      return;
    }
    byId(id).addEventListener("change", () => {
      const targets = state.targetSettings.targets;
      targets[key] = readNumber(id);
      targets.kcal = kcalFromMacros(targets);
      fillForm();
      saveAndRefresh(
        targets.kcal === null
          ? "Targets saved. Set protein, carbs and fat to get a kcal target."
          : `Targets saved: ${targets.kcal} kcal per day.`
      );
    });
  });

  // The split is only saved when the four shares add up to exactly 100%, so meal targets always cover one day.
  Object.values(SPLIT_FIELDS).forEach((id) => {
    byId(id).addEventListener("change", () => {
      const split = {};
      MEAL_TYPES.forEach((meal) => {
        const value = Number(byId(SPLIT_FIELDS[meal]).value);
        split[meal] = Number.isFinite(value) && value >= 0 ? value : 0;
      });
      const total = mealSplitTotal(split);
      if (total !== 100) {
        byId("targetsStatus").textContent =
          `The meal split adds up to ${total}%; it must be 100%. Not saved yet.`;
        return;
      }
      state.targetSettings.mealSplit = split;
      saveAndRefresh("Meal split saved.");
    });
  });
}
