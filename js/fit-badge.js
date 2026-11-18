// The fit badge: how a recipe's per-serving values fit its meal's share of the daily targets.
// Shown on AI suggestion cards and saved recipes; the rules live in targets.js.
import { aiText } from "./ai-recipes.js";
import { state } from "./state.js";
import { TARGET_KEYS, assessFit, mealTargets } from "./targets.js";

// Builds the badge for per-serving values ({ kcal, protein, carbs, fat, fiber }) and a meal type.
// Returns null when there is nothing to show: no targets set, or no kcal to compare.
// Without a meal type it returns a hint to set one, since the badge needs to know which meal it is for.
export function buildFitBadge(perServing, mealType) {
  const settings = state.targetSettings;
  if (!settings || !TARGET_KEYS.some((key) => settings.targets[key] !== null)) {
    return null;
  }

  const t = aiText();
  const row = document.createElement("div");
  row.className = "fit-badge-row";

  if (!mealType) {
    row.classList.add("fit-hint");
    row.textContent = t.setMealType;
    return row;
  }

  const target = mealTargets(settings.targets, settings.mealSplit, mealType);
  const fit = assessFit(perServing, target);
  if (!fit) {
    return null;
  }

  const meal = t.meals[mealType];
  const percentOff = Math.round(Math.abs(perServing.kcal / target.kcal - 1) * 100);
  const badge = document.createElement("span");
  badge.className = `fit-badge fit-${fit.kcal}`;
  badge.textContent =
    fit.kcal === "good"
      ? t.fitGood(meal)
      : fit.kcal === "over"
        ? t.fitOver(meal, percentOff)
        : t.fitUnder(meal, percentOff);
  row.appendChild(badge);

  if (fit.notes.length > 0) {
    const notes = document.createElement("span");
    notes.className = "fit-notes";
    notes.textContent = fit.notes
      .map((note) => (note.level === "high" ? t.highIn : t.lowIn)(t[note.macro]))
      .join(" · ");
    row.appendChild(notes);
  }

  return row;
}
