// The "Cook this" confirmation screen: shows what cooking a recipe takes from the pantry, lets you adjust it,
// then deducts it, with an Undo in the pop-up. The rules themselves live in cooking.js.
import { aiText } from "./ai-recipes.js";
import { applyCooking, planCooking } from "./cooking.js";
import { cookDialog } from "./dom.js";
import { perServingFromRecipe } from "./intake.js";
import { createShoppingItem, normalizeIngredientName } from "./items.js";
import { renderStockList } from "./pantry.js";
import { saveItems, saveStockItems } from "./persistence.js";
import { renderList } from "./shopping-list.js";
import { state } from "./state.js";
import { defaultMeal, logDateForNewEntry, logEntry, removeEntry } from "./today.js";
import { showToast } from "./ui.js";

// Pantry amounts with up to 2 decimals, so "0.15 l" isn't shown as "0.2 l".
function formatAmount(value) {
  return String(Math.round(value * 100) / 100);
}

// A labelled element with the given class and text, to keep the dialog-building code short.
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

// Opens the confirmation screen for a recipe ({ name, servings, ingredients: [{ name, grams, displayAmount, stockItem }] }).
export function openCookDialog(recipe) {
  const t = aiText();
  const recipeServings = recipe.servings > 0 ? recipe.servings : 1;
  let plan = planCooking(recipe, recipeServings, state.stockItems);

  cookDialog.innerHTML = "";
  const title = element("h2", "", t.cookTitle(recipe.name));
  title.id = "cookDialogTitle";
  cookDialog.appendChild(title);

  const servingsLabel = element("label", "cook-servings");
  const servingsInput = element("input");
  servingsInput.type = "number";
  servingsInput.inputMode = "decimal";
  servingsInput.min = "0";
  servingsInput.step = "any";
  servingsInput.value = String(recipeServings);
  servingsInput.id = "cookServingsInput";
  servingsLabel.append(t.servingsCooked, servingsInput);
  cookDialog.appendChild(servingsLabel);

  // How much of it you ate now; logged on the Today tab (0 = don't log, e.g. when cooking ahead).
  const eatenLabel = element("label", "cook-servings");
  const eatenInput = element("input");
  eatenInput.type = "number";
  eatenInput.inputMode = "decimal";
  eatenInput.min = "0";
  eatenInput.step = "any";
  eatenInput.value = "1";
  eatenInput.id = "cookEatenInput";
  eatenLabel.append(t.servingsEaten, eatenInput);
  cookDialog.appendChild(eatenLabel);

  // One row per ingredient: tick box, name (and the pantry item it comes from), amount box and a note.
  const list = element("ul", "cook-lines");
  const rows = plan.lines.map((line) => {
    const li = element("li", `cook-line cook-${line.kind}`);
    const label =
      line.stockName &&
      normalizeIngredientName(line.stockName) !== normalizeIngredientName(line.name)
        ? `${line.name} → ${line.stockName}`
        : line.name;
    const deductable = line.kind !== "missing" && line.kind !== "unknown";

    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.disabled = !deductable;
    checkbox.checked = deductable && line.amount !== null && line.amount > 0;
    checkbox.setAttribute("aria-label", label);
    li.appendChild(checkbox);
    li.appendChild(element("span", "cook-line-name", label));

    const input = element("input", "cook-amount");
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "any";
    input.setAttribute("aria-label", `${label} (${line.unit})`);
    if (deductable) {
      input.value = line.amount !== null ? formatAmount(line.amount) : "";
      // Typing an amount ticks the line; clearing it unticks it.
      input.addEventListener("input", () => {
        checkbox.checked = Number(input.value) > 0;
      });
      li.appendChild(input);
      li.appendChild(element("span", "cook-unit", line.unit));
    }

    const note = element("span", "cook-note");
    li.appendChild(note);
    list.appendChild(li);
    return { checkbox, input, note, kind: line.kind };
  });
  cookDialog.appendChild(list);

  // Notes show what is in the pantry and any shortfall; refreshed when the servings change.
  const refreshNotes = () => {
    plan.lines.forEach((line, i) => {
      const row = rows[i];
      if (line.kind === "missing") {
        row.note.textContent = t.notInStock;
      } else if (line.kind === "unknown") {
        row.note.textContent = t.unknownQuantity;
      } else {
        const parts = [t.inPantry(formatAmount(line.available), line.unit)];
        // The amount box is too narrow for this hint, so it goes in the note.
        if (line.kind === "manual") {
          parts.push(t.enterAmount);
        }
        if (line.short > 0) {
          parts.push(t.short(formatAmount(line.short), line.unit));
        }
        row.note.textContent = parts.join(" · ");
        row.note.classList.toggle("cook-short", line.short > 0);
      }
    });
  };
  refreshNotes();

  // Other servings: recalculate the automatic amounts; amounts you typed for "enter amount" lines stay.
  servingsInput.addEventListener("input", () => {
    const servings = Number(servingsInput.value);
    plan = planCooking(recipe, servings > 0 ? servings : 0, state.stockItems);
    plan.lines.forEach((line, i) => {
      if (line.kind === "convert" || line.kind === "count") {
        rows[i].input.value = formatAmount(line.amount);
        rows[i].checkbox.checked = line.amount > 0;
      }
    });
    refreshNotes();
  });

  const addToListLabel = element("label", "cook-add-to-list");
  const addToList = element("input");
  addToList.type = "checkbox";
  addToList.checked = true;
  addToList.id = "cookAddToList";
  addToListLabel.append(addToList, t.cookAddUsedUp);
  cookDialog.appendChild(addToListLabel);

  const actions = element("div", "action-row");
  const cancelButton = element("button", "secondary-button", t.cancel);
  cancelButton.type = "button";
  cancelButton.addEventListener("click", () => cookDialog.close());
  const confirmButton = element("button", "primary-button", t.cookConfirm);
  confirmButton.type = "button";
  confirmButton.id = "cookConfirmButton";
  confirmButton.addEventListener("click", () => {
    const deductions = plan.lines
      .map((line, i) => ({ line, row: rows[i] }))
      .filter(({ row }) => row.checkbox.checked && Number(row.input.value) > 0)
      .map(({ line, row }) => ({ stockIndex: line.stockIndex, amount: Number(row.input.value) }));
    cookDialog.close();
    cook(recipe, deductions, addToList.checked, Number(eatenInput.value) || 0);
  });
  actions.append(cancelButton, confirmButton);
  cookDialog.appendChild(actions);

  cookDialog.showModal();
}

// Takes the confirmed amounts ({ stockIndex, amount }) out of the pantry; used-up items leave the pantry
// and, if asked, go on the shopping list once. Returns a function that undoes exactly this.
// Shared by "Cook this" and logging a product from the pantry.
export function takeFromPantry(deductions, addUsedUpToList) {
  const stockBefore = state.stockItems;
  const { stockItems, usedUp } = applyCooking(stockBefore, deductions);
  state.stockItems = stockItems;

  const added = [];
  if (addUsedUpToList) {
    usedUp.forEach((item) => {
      const onList = state.items.some(
        (listItem) => normalizeIngredientName(listItem.name) === normalizeIngredientName(item.name)
      );
      if (!onList) {
        const shoppingItem = createShoppingItem({ ...item, quantity: null });
        state.items.push(shoppingItem);
        added.push(shoppingItem);
      }
    });
  }
  saveAndRender();

  return () => {
    state.stockItems = stockBefore;
    state.items = state.items.filter((item) => !added.includes(item));
    saveAndRender();
  };
}

// Cooks: takes the amounts from the pantry, logs the servings eaten (if any) and offers one Undo for both.
function cook(recipe, deductions, addUsedUpToList, servingsEaten) {
  const t = aiText();
  const undoPantry = takeFromPantry(deductions, addUsedUpToList);

  // Logged silently so the "Cooked" pop-up with its Undo stays visible.
  let entry = null;
  if (servingsEaten > 0) {
    entry = logEntry(
      {
        date: logDateForNewEntry(false),
        meal: defaultMeal(recipe.mealType),
        name: recipe.name,
        source: "recipe",
        unit: "serving",
        quantity: servingsEaten,
        ...perServingFromRecipe(recipe, recipe.estimatedMacrosPerServing)
      },
      { silent: true }
    );
  }

  showToast(t.cooked(recipe.name), {
    label: t.undo,
    durationMs: 10000,
    // Puts the pantry back, takes back the shopping-list items, and removes the log entry.
    onClick: () => {
      undoPantry();
      if (entry) {
        removeEntry(entry);
      }
      showToast(t.undone);
    }
  });
}

function saveAndRender() {
  saveStockItems();
  saveItems();
  renderStockList();
  renderList();
}
