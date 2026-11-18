// The pantry stock list: rendering, quantities, returning items and clearing stock.
import { stockEmptyMessage, stockList } from "./dom.js";
import { formatNutritionSummary, formatNutritionTotalSummary } from "./format.js";
import { createShoppingItem, getCategoryLabel, normalizeIngredientName } from "./items.js";
import { getQuantityStep } from "./nutrition.js";
import { saveItems, saveStockItems } from "./persistence.js";
import { renderRecipeItemOptions } from "./recipe-builder.js";
import { renderList } from "./shopping-list.js";
import { state } from "./state.js";
import { renderNutritionStatistics } from "./statistics.js";
import { updateTabBadges } from "./tabs.js";
import { setStatus } from "./ui.js";

export function findMatchingStockItem(ingredientName) {
  const target = normalizeIngredientName(ingredientName);

  if (target === "") {
    return null;
  }

  // Only normalized exact matches count (case, spacing and a plural "s" are ignored).
  // The old substring fallback matched "egg" to "eggplant" and "butter" to "peanut butter", wrongly marking items as in stock.
  return state.stockItems.find((item) => normalizeIngredientName(item.name) === target) || null;
}

export function findMatchingStockIndex(item) {
  if (typeof item.barcode === "string" && item.barcode.trim() !== "") {
    const barcode = item.barcode.trim();

    const barcodeIndex = state.stockItems.findIndex((stockItem) => {
      return typeof stockItem.barcode === "string" && stockItem.barcode.trim() === barcode;
    });

    if (barcodeIndex !== -1) {
      return barcodeIndex;
    }
  }

  const name = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
  const unit = typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";
  const category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "";

  const index = state.stockItems.findIndex((stockItem) => {
    const stockName = typeof stockItem.name === "string" ? stockItem.name.trim().toLowerCase() : "";
    const stockUnit = typeof stockItem.unit === "string" ? stockItem.unit.trim().toLowerCase() : "";
    const stockCategory =
      typeof stockItem.category === "string" ? stockItem.category.trim().toLowerCase() : "";

    return stockName === name && stockUnit === unit && stockCategory === category;
  });

  return index === -1 ? null : index;
}

export function adjustStockQuantity(index, delta) {
  const item = state.stockItems[index];
  if (!item) {
    return;
  }

  const current =
    typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 0;

  setStockQuantity(index, current + delta);
}

export function setStockQuantity(index, rawValue) {
  const item = state.stockItems[index];
  if (!item) {
    return;
  }

  let value = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    value = 0;
  }

  // Avoid float drift like 0.1 + 0.1 + 0.1 !== 0.3 from repeated +/- taps.
  value = Math.round(value * 100) / 100;

  item.quantity = value > 0 ? value : null;

  saveStockItems();
  renderStockList();
}

export function renderStockList() {
  updateTabBadges();
  renderRecipeItemOptions();
  renderNutritionStatistics();
  stockList.innerHTML = "";

  if (state.stockItems.length === 0) {
    stockEmptyMessage.style.display = "block";
    return;
  }

  stockEmptyMessage.style.display = "none";

  state.stockItems.forEach((item, index) => {
    const li = document.createElement("li");

    const infoWrap = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = item.name;
    infoWrap.appendChild(nameSpan);

    const quantityControl = document.createElement("div");
    quantityControl.className = "quantity-control";

    const step = getQuantityStep(item.unit);

    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.className = "quantity-step-button";
    minusButton.textContent = "−";
    minusButton.setAttribute("aria-label", `Decrease ${item.name} quantity`);
    minusButton.addEventListener("click", () => {
      adjustStockQuantity(index, -step);
    });

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.inputMode = "decimal";
    quantityInput.min = "0";
    quantityInput.step = "any";
    quantityInput.className = "quantity-input";
    quantityInput.value = typeof item.quantity === "number" ? String(item.quantity) : "";
    quantityInput.placeholder = "0";
    quantityInput.setAttribute("aria-label", `${item.name} quantity`);
    quantityInput.addEventListener("change", () => {
      setStockQuantity(index, quantityInput.value);
    });
    quantityInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        quantityInput.blur();
      }
    });

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.className = "quantity-step-button";
    plusButton.textContent = "+";
    plusButton.setAttribute("aria-label", `Increase ${item.name} quantity`);
    plusButton.addEventListener("click", () => {
      adjustStockQuantity(index, step);
    });

    quantityControl.appendChild(minusButton);
    quantityControl.appendChild(quantityInput);
    quantityControl.appendChild(plusButton);

    if (item.unit.trim() !== "") {
      const unitLabel = document.createElement("span");
      unitLabel.className = "quantity-unit-label";
      unitLabel.textContent = item.unit;
      quantityControl.appendChild(unitLabel);
    }

    infoWrap.appendChild(quantityControl);

    if (item.note !== "") {
      const noteSpan = document.createElement("span");
      noteSpan.className = "item-note";
      noteSpan.textContent = item.note;
      infoWrap.appendChild(noteSpan);
    }

    const nutritionSummary = formatNutritionSummary(item.nutrition);
    if (nutritionSummary !== "") {
      const nutritionSpan = document.createElement("span");
      nutritionSpan.className = "item-meta";
      nutritionSpan.textContent = nutritionSummary;
      infoWrap.appendChild(nutritionSpan);
    }

    const nutritionTotalSummary = formatNutritionTotalSummary(item.nutrition, item.nutritionAmount);
    if (nutritionTotalSummary !== "") {
      const nutritionTotalSpan = document.createElement("span");
      nutritionTotalSpan.className = "item-meta";
      nutritionTotalSpan.textContent = nutritionTotalSummary;
      infoWrap.appendChild(nutritionTotalSpan);
    }

    if (item.barcode !== "") {
      const barcodeSpan = document.createElement("span");
      barcodeSpan.className = "item-barcode";
      barcodeSpan.textContent = `Barcode: ${item.barcode}`;
      infoWrap.appendChild(barcodeSpan);
    }

    const categoryLabel = document.createElement("span");
    categoryLabel.className = "item-category";
    categoryLabel.textContent = getCategoryLabel(item.category);
    infoWrap.appendChild(categoryLabel);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const returnButton = document.createElement("button");
    returnButton.className = "edit-button";
    returnButton.textContent = "Return";
    returnButton.addEventListener("click", () => {
      returnStockItemToList(index);
    });

    actions.appendChild(returnButton);

    li.appendChild(infoWrap);
    li.appendChild(actions);
    stockList.appendChild(li);
  });
}

// Moves a pantry item back onto the shopping list (the "Return" button).
// Renamed from deleteStockItem, which suggested the item was simply deleted.
export function returnStockItemToList(index) {
  const item = state.stockItems[index];

  if (!item) {
    return;
  }

  const returnedName = item.name;

  state.items.push(createShoppingItem(item));

  state.stockItems.splice(index, 1);

  saveItems();
  saveStockItems();
  renderList();
  renderStockList();
  setStatus(`Returned "${returnedName}" to the shopping list.`);
}

export function clearStockItems() {
  if (state.stockItems.length === 0) {
    setStatus("There is no pantry stock to clear.");
    return;
  }

  // Ask before wiping the whole pantry, because there is no undo and no backup.
  if (
    !window.confirm(
      `Delete all ${state.stockItems.length} item${state.stockItems.length === 1 ? "" : "s"} from your pantry? This can't be undone.`
    )
  ) {
    setStatus("Clear cancelled.");
    return;
  }

  state.stockItems = [];
  saveStockItems();
  renderStockList();
  setStatus("Pantry stock cleared.");
}
