// The Today tab: eaten vs daily targets for the day shown, per meal, the logged entries (edit/delete),
// and "Add food" (js/add-food.js). Also the shared pieces other modules use to log food (logEntry, the dialog helpers).
import { formatNutritionValue } from "./format.js";
import {
  createEntry,
  dateKey,
  dayTotals,
  entryNutrition,
  mealForTime,
  mealKcal,
  nevoVersionsUsed,
  perServingFromRecipe,
  shiftDate
} from "./intake.js";
import { openAddFood } from "./add-food.js";
import { nevoReference } from "./nevo.js";
import { saveIntakeLog } from "./persistence.js";
import { state } from "./state.js";
import { MEAL_TYPES, mealTargets } from "./targets.js";
import { showToast } from "./ui.js";
import { renderWeekChart } from "./week-chart.js";

const byId = (id) => document.getElementById(id);

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};
const NUTRIENT_LABELS = {
  kcal: "kcal",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fibre"
};

// The current time as "HH:MM", stored with each entry to order a meal's entries.
function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// ----- Shared dialog helpers (also used to log recipes and products) -----

// Opens the log dialog with a title and returns its parts; the caller adds fields and the confirm action.
export function openLogDialog(title) {
  const dialog = byId("logDialog");
  dialog.innerHTML = "";
  const heading = document.createElement("h2");
  heading.id = "logDialogTitle";
  heading.textContent = title;
  dialog.appendChild(heading);
  const body = document.createElement("div");
  body.className = "form-stack";
  dialog.appendChild(body);

  // Adds Cancel and a confirm button; onConfirm returns false to keep the dialog open (e.g. a missing value).
  const addActions = (confirmLabel, onConfirm) => {
    const actions = document.createElement("div");
    actions.className = "action-row";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => dialog.close());
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "primary-button";
    confirm.id = "logConfirmButton";
    confirm.textContent = confirmLabel;
    confirm.addEventListener("click", () => {
      if (onConfirm() !== false) {
        dialog.close();
      }
    });
    actions.append(cancel, confirm);
    dialog.appendChild(actions);
    dialog.showModal();
  };

  return { dialog, body, addActions };
}

// A labelled form field (label + input or select) appended to parent; returns the input.
export function addField(parent, labelText, input, id) {
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  input.id = id;
  label.htmlFor = id;
  parent.append(label, input);
  return input;
}

export function numberInput(value, step = "any") {
  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.min = "0";
  input.step = step;
  input.value = value === null || value === undefined ? "" : String(value);
  return input;
}

// A meal dropdown, pre-set to the given meal.
export function mealSelect(selected) {
  const select = document.createElement("select");
  MEAL_TYPES.forEach((meal) => {
    const option = document.createElement("option");
    option.value = meal;
    option.textContent = MEAL_LABELS[meal];
    select.appendChild(option);
  });
  select.value = selected;
  return select;
}

// The meal a new entry defaults to: the given meal type if any, otherwise by the current time.
export function defaultMeal(mealType) {
  return MEAL_TYPES.includes(mealType) ? mealType : mealForTime(new Date());
}

// Adds an entry to the log, saves and refreshes the Today tab; confirms with a pop-up unless silent
// (when the caller shows its own pop-up, e.g. "Cooked" with Undo).
export function logEntry(fields, options = {}) {
  const entry = createEntry({ time: timeNow(), ...fields });
  state.intakeLog.push(entry);
  saveIntakeLog();
  renderToday();
  if (!options.silent) {
    showToast(`Logged ${entry.name}`);
  }
  return entry;
}

// Removes an entry (used by Undo after cooking).
export function removeEntry(entry) {
  state.intakeLog = state.intakeLog.filter((item) => item !== entry);
  saveIntakeLog();
  renderToday();
}

// The date new entries go to: the day shown on the Today tab when that tab is open, otherwise today.
export function logDateForNewEntry(fromTodayTab) {
  return fromTodayTab ? state.todayDate : dateKey(new Date());
}

// ----- Rendering -----

function formatValue(key, value) {
  return key === "kcal" ? String(Math.round(value)) : `${formatNutritionValue(value)}g`;
}

// One labelled progress bar: eaten against target; over target turns amber.
function progressRow(label, eaten, target, valueText) {
  const row = document.createElement("div");
  row.className = "progress-row";
  const top = document.createElement("div");
  top.className = "progress-label";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.textContent = valueText;
  top.append(name, value);
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  const ratio = target > 0 ? eaten / target : 0;
  fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
  if (ratio > 1) {
    fill.classList.add("over");
  }
  bar.appendChild(fill);
  row.append(top, bar);
  return row;
}

export function renderToday() {
  const panel = byId("panel-today");
  if (!panel || !state.intakeLog) {
    return;
  }
  const date = state.todayDate;
  byId("todayDateInput").value = date;
  byId("todayTodayButton").disabled = date === dateKey(new Date());

  const { totals, notFullyCounted, count } = dayTotals(state.intakeLog, date);
  const targets = state.targetSettings ? state.targetSettings.targets : {};
  const progress = byId("todayProgress");
  progress.innerHTML = "";
  const withTargets = Object.keys(NUTRIENT_LABELS).filter(
    (key) => targets[key] !== null && targets[key] !== undefined
  );
  if (withTargets.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint-text";
    hint.textContent = `Eaten: ${Math.round(totals.kcal)} kcal. Set daily targets in Settings to see your progress.`;
    progress.appendChild(hint);
  }
  withTargets.forEach((key) => {
    progress.appendChild(
      progressRow(
        NUTRIENT_LABELS[key],
        totals[key],
        targets[key],
        `${formatValue(key, totals[key])} / ${formatValue(key, targets[key])}`
      )
    );
  });

  byId("todayNotCounted").textContent =
    notFullyCounted > 0
      ? `${notFullyCounted} ${notFullyCounted === 1 ? "entry is" : "entries are"} not fully counted (missing nutrition data).`
      : "";

  const meals = byId("todayMeals");
  meals.innerHTML = "";
  const eatenPerMeal = mealKcal(state.intakeLog, date);
  MEAL_TYPES.forEach((meal) => {
    const share = targets.kcal
      ? mealTargets(targets, state.targetSettings.mealSplit, meal).kcal
      : null;
    const text = share
      ? `${Math.round(eatenPerMeal[meal])} / ${Math.round(share)} kcal`
      : `${Math.round(eatenPerMeal[meal])} kcal`;
    meals.appendChild(progressRow(MEAL_LABELS[meal], eatenPerMeal[meal], share || 0, text));
  });

  renderEntries(date);
  // RIVM requires its reference wherever NEVO values are used in a calculation, such as these day totals.
  byId("todayNevoReference").textContent = nevoVersionsUsed(state.intakeLog, date)
    .map(nevoReference)
    .join(" ");
  byId("todayEmptyMessage").style.display = count === 0 ? "block" : "none";
  renderWeekChart(byId("weekChart"), state.intakeLog, date, targets.kcal || null);
}

function renderEntries(date) {
  const container = byId("todayEntries");
  container.innerHTML = "";
  MEAL_TYPES.forEach((meal) => {
    const entries = state.intakeLog
      .filter((entry) => entry.date === date && entry.meal === meal)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (entries.length === 0) {
      return;
    }
    const heading = document.createElement("h3");
    heading.textContent = MEAL_LABELS[meal];
    container.appendChild(heading);
    const list = document.createElement("ul");
    list.className = "shopping-list log-entries";
    entries.forEach((entry) => list.appendChild(entryRow(entry)));
    container.appendChild(list);
  });
}

function amountText(entry) {
  if (entry.unit === "serving") {
    return `${formatNutritionValue(entry.quantity)} serving${entry.quantity === 1 ? "" : "s"}`;
  }
  if (entry.unit === "g" || entry.unit === "ml") {
    return `${formatNutritionValue(entry.quantity)} ${entry.unit}`;
  }
  return "";
}

// Where a logged product's values came from, when it was searched by name.
const SOURCE_LABELS = { nevo: "NEVO", off: "Open Food Facts" };

const STATUS_NOTES = {
  partial: "partly counted: some nutrition data missing",
  estimated: "estimated by AI",
  unknown: "not counted: no nutrition data"
};

function entryRow(entry) {
  const li = document.createElement("li");
  li.className = "log-entry";
  const info = document.createElement("div");
  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = entry.name;
  const values = entryNutrition(entry);
  const meta = document.createElement("span");
  meta.className = "item-meta";
  meta.textContent = [
    amountText(entry),
    values.kcal === null ? "" : `${Math.round(values.kcal)} kcal`,
    SOURCE_LABELS[entry.nutritionSource] || ""
  ]
    .filter(Boolean)
    .join(" · ");
  info.append(name, meta);
  if (STATUS_NOTES[entry.status]) {
    const note = document.createElement("span");
    note.className = `item-note log-status-${entry.status}`;
    note.textContent = STATUS_NOTES[entry.status];
    info.appendChild(note);
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";
  const edit = document.createElement("button");
  edit.className = "edit-button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => openEditEntry(entry));
  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => deleteEntry(entry));
  actions.append(edit, remove);
  li.append(info, actions);
  return li;
}

// ----- Editing -----

// Lets you move an entry to another meal and change its servings or grams (its values rescale).
function openEditEntry(entry) {
  const { body, addActions } = openLogDialog(`Edit ${entry.name}`);
  const meal = addField(body, "Meal", mealSelect(entry.meal), "logMealSelect");
  let quantity = null;
  if (["serving", "g", "ml"].includes(entry.unit)) {
    const labels = { serving: "Servings eaten", g: "Grams eaten", ml: "Millilitres eaten" };
    quantity = addField(body, labels[entry.unit], numberInput(entry.quantity), "logQuantityInput");
  }
  addActions("Save", () => {
    const amount = quantity ? Number(quantity.value) : entry.quantity;
    if (!(amount > 0)) {
      return false;
    }
    entry.meal = meal.value;
    entry.quantity = amount;
    saveIntakeLog();
    renderToday();
    return true;
  });
}

// Deletes an entry, with an Undo in the pop-up. The pantry is not changed.
function deleteEntry(entry) {
  const index = state.intakeLog.indexOf(entry);
  state.intakeLog.splice(index, 1);
  saveIntakeLog();
  renderToday();
  showToast(`Deleted ${entry.name}`, {
    label: "Undo",
    durationMs: 10000,
    onClick: () => {
      state.intakeLog.splice(index, 0, entry);
      saveIntakeLog();
      renderToday();
    }
  });
}

// ----- A saved recipe -----

// "Ate this" on a saved recipe: how many servings, which meal; logged on today.
export function openAteRecipe(recipe) {
  const { body, addActions } = openLogDialog(`Ate ${recipe.name}`);
  const servings = addField(body, "Servings eaten", numberInput(1), "logQuantityInput");
  const meal = addField(body, "Meal", mealSelect(defaultMeal(recipe.mealType)), "logMealSelect");
  const nutrition = perServingFromRecipe(recipe);
  if (nutrition.status !== "complete") {
    const note = document.createElement("p");
    note.className = "hint-text";
    note.textContent =
      nutrition.status === "unknown"
        ? "This recipe has no nutrition data, so it won't count towards your totals."
        : "Some ingredients have no nutrition data, so this only partly counts.";
    body.appendChild(note);
  }
  addActions("Log", () => {
    const amount = Number(servings.value);
    if (!(amount > 0)) {
      return false;
    }
    logEntry({
      date: logDateForNewEntry(false),
      meal: meal.value,
      name: recipe.name,
      source: "recipe",
      unit: "serving",
      quantity: amount,
      ...nutrition
    });
    return true;
  });
}

export function initToday() {
  if (!byId("panel-today")) {
    return;
  }
  const go = (date) => {
    state.todayDate = date;
    renderToday();
  };
  byId("todayPrevButton").addEventListener("click", () => go(shiftDate(state.todayDate, -1)));
  byId("todayNextButton").addEventListener("click", () => go(shiftDate(state.todayDate, 1)));
  byId("todayTodayButton").addEventListener("click", () => go(dateKey(new Date())));
  byId("todayDateInput").addEventListener("change", () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(byId("todayDateInput").value)) {
      go(byId("todayDateInput").value);
    }
  });
  byId("addFoodButton").addEventListener("click", openAddFood);
  renderToday();
}
