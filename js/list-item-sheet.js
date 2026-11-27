// The sheet for editing one shopping-list item: name, amount (with quick amounts for g, kg, ml and l),
// aisle and note, with barcode, nutrition and pack weight behind "More details".
// It only reads and checks the form; js/shopping-list.js decides what saving and deleting do.
import { CATEGORY_ORDER } from "./constants.js";
import { listEls } from "./dom.js";
import { formatNutritionInputValue, parseOptionalNumberInput } from "./format.js";
import { normalizeCategory, unitPresets } from "./items.js";
import { normalizeNutrition } from "./nutrition.js";

const AISLE_INPUT_NAME = "listItemAisle";

// { onSave, onDelete, opener } for the item being edited, or null when the sheet is closed.
let current = null;

export function initItemSheet() {
  CATEGORY_ORDER.forEach((category) => {
    const label = document.createElement("label");
    label.className = "chip chip-choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = AISLE_INPUT_NAME;
    input.value = category;
    const text = document.createElement("span");
    text.textContent = category === "" ? "No aisle" : category;
    label.appendChild(input);
    label.appendChild(text);
    listEls.listItemAisles.appendChild(label);
  });

  listEls.listItemUnit.addEventListener("change", renderPresets);
  listEls.listItemQuantity.addEventListener("input", renderPresets);
  listEls.listItemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });
  listEls.listItemCancelButton.addEventListener("click", () => listEls.listItemDialog.close());
  listEls.listItemDeleteButton.addEventListener("click", () => {
    const sheet = finish();
    if (sheet) {
      sheet.onDelete();
    }
  });
  // Escape and Cancel end here: focus goes back to what opened the sheet. The "close" event arrives
  // a moment after close(); if the sheet was opened again meanwhile, it belongs to the earlier one.
  listEls.listItemDialog.addEventListener("close", () => {
    if (listEls.listItemDialog.open || current === null) {
      return;
    }
    const { opener } = current;
    current = null;
    if (opener && opener.isConnected) {
      opener.focus();
    } else {
      listEls.listAddInput.focus();
    }
  });
}

// Closes the sheet for Save and Delete, which redraw the list and place the focus themselves.
function finish() {
  const sheet = current;
  current = null;
  listEls.listItemDialog.close();
  return sheet;
}

export function openItemSheet(item, { onSave, onDelete, opener }) {
  current = { onSave, onDelete, opener };
  const nutrition = normalizeNutrition(item.nutrition);

  listEls.listItemDialogTitle.textContent = `Edit ${item.name}`;
  listEls.listItemName.value = item.name;
  listEls.listItemQuantity.value = typeof item.quantity === "number" ? String(item.quantity) : "";
  listEls.listItemUnit.value = item.unit || "";
  listEls.listItemNote.value = item.note || "";
  listEls.listItemBarcode.value = item.barcode || "";
  listEls.listItemKcal.value = formatNutritionInputValue(nutrition.kcal100g);
  listEls.listItemProtein.value = formatNutritionInputValue(nutrition.protein100g);
  listEls.listItemCarbs.value = formatNutritionInputValue(nutrition.carbs100g);
  listEls.listItemFat.value = formatNutritionInputValue(nutrition.fat100g);
  listEls.listItemFiber.value = formatNutritionInputValue(nutrition.fiber100g);
  listEls.listItemPackGrams.value =
    typeof item.packGrams === "number" ? String(item.packGrams) : "";
  listEls.listItemError.textContent = "";
  listEls.listItemForm.querySelector("details").open = false;

  const aisle = normalizeCategory(item.category);
  listEls.listItemAisles.querySelectorAll("input").forEach((input) => {
    input.checked = input.value === aisle;
  });

  renderPresets();
  listEls.listItemDialog.showModal();
  listEls.listItemName.focus();
}

function renderPresets() {
  const container = listEls.listItemPresets;
  container.innerHTML = "";
  const presets = unitPresets(listEls.listItemUnit.value);
  container.classList.toggle("hidden", presets.length === 0);
  const quantity = Number(listEls.listItemQuantity.value);

  presets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `${preset.quantity} ${preset.unit}`;
    const selected = quantity === preset.quantity && listEls.listItemUnit.value === preset.unit;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      listEls.listItemQuantity.value = String(preset.quantity);
      listEls.listItemUnit.value = preset.unit;
      renderPresets();
      // The chips were redrawn; keep the keyboard on the one just chosen.
      const same = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === button.textContent
      );
      (same || listEls.listItemQuantity).focus();
    });
    container.appendChild(button);
  });
}

function showError(message, field) {
  listEls.listItemError.textContent = message;
  field.focus();
}

function save() {
  const name = listEls.listItemName.value.trim();
  if (name === "") {
    showError("Type a name first.", listEls.listItemName);
    return;
  }

  const quantityText = listEls.listItemQuantity.value.trim();
  let quantity = null;
  if (quantityText !== "") {
    quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showError("The amount must be more than 0, or leave it empty.", listEls.listItemQuantity);
      return;
    }
  }

  const packGrams = parseOptionalNumberInput(listEls.listItemPackGrams.value);
  const checkedAisle = listEls.listItemAisles.querySelector("input:checked");

  const fields = {
    name,
    quantity,
    unit: listEls.listItemUnit.value,
    category: checkedAisle ? checkedAisle.value : "",
    note: listEls.listItemNote.value.trim(),
    nutrition: normalizeNutrition({
      kcal100g: parseOptionalNumberInput(listEls.listItemKcal.value),
      protein100g: parseOptionalNumberInput(listEls.listItemProtein.value),
      carbs100g: parseOptionalNumberInput(listEls.listItemCarbs.value),
      fat100g: parseOptionalNumberInput(listEls.listItemFat.value),
      fiber100g: parseOptionalNumberInput(listEls.listItemFiber.value)
    }),
    packGrams: packGrams !== null && packGrams > 0 ? packGrams : null
  };

  const sheet = finish();
  if (sheet) {
    sheet.onSave(fields);
  }
}
