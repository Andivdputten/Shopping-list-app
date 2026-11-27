// The shopping list: rendering, search, quick add, marking bought and moving items to stock.
import { CATEGORY_ORDER } from "./constants.js";
import {
  emptyMessage,
  listMacroChart,
  listMacroCoverage,
  listMacroLegend,
  quickAddButton,
  searchInput,
  shoppingSections
} from "./dom.js";
import { buildMetaText, formatNutritionSummary, formatNutritionTotalSummary } from "./format.js";
import { resetForm, startEdit } from "./item-form.js";
import {
  createShoppingItem,
  createStockItem,
  getCategoryLabel,
  mergeStockItems,
  normalizeCategory
} from "./items.js";
import { findMatchingStockIndex, renderStockList } from "./pantry.js";
import { saveItems, saveStockItems } from "./persistence.js";
import { renderRecipeBuilder, renderRecipeItemOptions } from "./recipe-builder.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { state } from "./state.js";
import { renderMacroStatBlock } from "./statistics.js";
import { updateTabBadges } from "./tabs.js";
import { setStatus, showToast } from "./ui.js";

export function updateQuickAddButtonState() {
  quickAddButton.disabled = searchInput.value.trim() === "";
}

export function quickAddItem() {
  const name = searchInput.value.trim();

  if (name === "") {
    return;
  }

  state.items.push(createShoppingItem({ name }));

  saveItems();
  searchInput.value = "";
  updateQuickAddButtonState();
  renderList();
  setStatus(`Added "${name}" to your shopping list.`);
  showToast(`${name} added to your list`);
}

export function moveItemToStock(index) {
  const item = state.items[index];

  if (!item) {
    return;
  }

  if (!item.bought) {
    setStatus("Only bought items can be moved to stock.");
    return;
  }

  const stockIndex = findMatchingStockIndex(item);

  if (stockIndex === null) {
    state.stockItems.push(createStockItem(item));
  } else {
    state.stockItems[stockIndex] = mergeStockItems(state.stockItems[stockIndex], item);
  }

  const movedName = item.name;
  state.items.splice(index, 1);

  if (state.editId === item.id) {
    resetForm();
  }

  saveItems();
  saveStockItems();
  renderList();
  renderStockList();
  setStatus(`Moved "${movedName}" to pantry stock.`);
}

export function findMatchingShoppingIndexForStock(item) {
  if (typeof item.barcode === "string" && item.barcode.trim() !== "") {
    const barcode = item.barcode.trim();

    const barcodeIndex = state.items.findIndex((shoppingItem) => {
      return typeof shoppingItem.barcode === "string" && shoppingItem.barcode.trim() === barcode;
    });

    if (barcodeIndex !== -1) {
      return barcodeIndex;
    }
  }

  const name = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
  const unit = typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";
  const category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "";

  const index = state.items.findIndex((shoppingItem) => {
    const shoppingName =
      typeof shoppingItem.name === "string" ? shoppingItem.name.trim().toLowerCase() : "";
    const shoppingUnit =
      typeof shoppingItem.unit === "string" ? shoppingItem.unit.trim().toLowerCase() : "";
    const shoppingCategory =
      typeof shoppingItem.category === "string" ? shoppingItem.category.trim().toLowerCase() : "";

    return shoppingName === name && shoppingUnit === unit && shoppingCategory === category;
  });

  return index === -1 ? null : index;
}

export function findItemIndexByBarcode(barcode) {
  if (typeof barcode !== "string" || barcode.trim() === "") {
    return null;
  }

  const normalizedBarcode = barcode.trim();

  const index = state.items.findIndex((item) => {
    return typeof item.barcode === "string" && item.barcode.trim() === normalizedBarcode;
  });

  return index === -1 ? null : index;
}

export function findDuplicateBarcodeIndex(barcode, ignoreIndex) {
  const matchIndex = findItemIndexByBarcode(barcode);

  if (matchIndex === null) {
    return null;
  }

  if (ignoreIndex !== null && matchIndex === ignoreIndex) {
    return null;
  }

  return matchIndex;
}

export function toggleBought(index) {
  state.items[index].bought = !state.items[index].bought;
  saveItems();
  renderList();

  const stateText = state.items[index].bought ? "bought" : "not bought";
  setStatus(`Marked "${state.items[index].name}" as ${stateText}.`);
}

export function deleteItem(index) {
  const removed = state.items[index];
  const removedItem = removed.name;
  state.items.splice(index, 1);

  if (state.editId === removed.id) {
    resetForm();
  }

  saveItems();
  renderList();
  setStatus(`Removed "${removedItem}".`);
}

export function clearAllItems() {
  if (state.items.length === 0) {
    setStatus("There is nothing to clear.");
    return;
  }

  // Ask before wiping the whole list, because there is no undo and no backup.
  if (
    !window.confirm(
      `Delete all ${state.items.length} item${state.items.length === 1 ? "" : "s"} from your shopping list? This can't be undone.`
    )
  ) {
    setStatus("Clear cancelled.");
    return;
  }

  state.items = [];
  resetForm();
  saveItems();
  renderList();
  setStatus("All items cleared.");
}

export function renderList() {
  updateTabBadges();
  renderMacroStatBlock(state.items, listMacroChart, listMacroLegend, listMacroCoverage);
  renderRecipeItemOptions();
  renderRecipeBuilder();
  renderSavedRecipes();
  shoppingSections.innerHTML = "";

  const filteredEntries = getFilteredEntries();

  if (filteredEntries.length === 0) {
    emptyMessage.style.display = "block";
    return;
  }

  emptyMessage.style.display = "none";

  const toBuyEntries = filteredEntries.filter((entry) => !entry.item.bought);
  const boughtEntries = filteredEntries.filter((entry) => entry.item.bought);

  if (toBuyEntries.length > 0) {
    shoppingSections.appendChild(createStatusSection("To buy", toBuyEntries));
  }

  if (boughtEntries.length > 0) {
    shoppingSections.appendChild(createStatusSection("Bought", boughtEntries));
  }
}

export function getFilteredEntries() {
  const searchValue = searchInput.value.trim().toLowerCase();

  return state.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const searchText = [item.name, item.note, item.barcode].join(" ").toLowerCase();

      return searchValue === "" || searchText.includes(searchValue);
    });
}

export function createStatusSection(title, entries) {
  const wrapper = document.createElement("section");
  wrapper.className = "status-section";

  const heading = document.createElement("h3");
  heading.className = "status-heading";
  heading.textContent = `${title} (${entries.length})`;

  wrapper.appendChild(heading);

  const groupedEntries = groupEntriesByCategory(entries);

  CATEGORY_ORDER.forEach((category) => {
    const categoryEntries = groupedEntries[category] || [];

    if (categoryEntries.length === 0) {
      return;
    }

    wrapper.appendChild(createCategoryBlock(getCategoryLabel(category), categoryEntries));
  });

  return wrapper;
}

export function groupEntriesByCategory(entries) {
  const grouped = {};

  entries.forEach((entry) => {
    const key = normalizeCategory(entry.item.category);

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(entry);
  });

  return grouped;
}

export function createCategoryBlock(title, entries) {
  const wrapper = document.createElement("div");
  wrapper.className = "category-block";

  const heading = document.createElement("h4");
  heading.className = "category-heading";
  heading.textContent = `${title} (${entries.length})`;

  const list = document.createElement("ul");
  list.className = "shopping-list";

  entries.forEach(({ item, index }) => {
    const li = document.createElement("li");

    const itemButton = document.createElement("button");
    itemButton.className = "item-button";

    if (item.bought) {
      itemButton.classList.add("bought");
    }

    itemButton.addEventListener("click", () => {
      toggleBought(index);
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = item.name;
    itemButton.appendChild(nameSpan);

    const metaText = buildMetaText(item);
    if (metaText !== "") {
      const metaSpan = document.createElement("span");
      metaSpan.className = "item-meta";
      metaSpan.textContent = metaText;
      itemButton.appendChild(metaSpan);
    }

    if (item.note !== "") {
      const noteSpan = document.createElement("span");
      noteSpan.className = "item-note";
      noteSpan.textContent = item.note;
      itemButton.appendChild(noteSpan);
    }

    const nutritionSummary = formatNutritionSummary(item.nutrition);
    if (nutritionSummary !== "") {
      const nutritionSpan = document.createElement("span");
      nutritionSpan.className = "item-meta";
      nutritionSpan.textContent = nutritionSummary;
      itemButton.appendChild(nutritionSpan);
    }

    const nutritionTotalSummary = formatNutritionTotalSummary(item.nutrition, item.nutritionAmount);
    if (nutritionTotalSummary !== "") {
      const nutritionTotalSpan = document.createElement("span");
      nutritionTotalSpan.className = "item-meta";
      nutritionTotalSpan.textContent = nutritionTotalSummary;
      itemButton.appendChild(nutritionTotalSpan);
    }

    if (item.barcode !== "") {
      const barcodeSpan = document.createElement("span");
      barcodeSpan.className = "item-barcode";
      barcodeSpan.textContent = `Barcode: ${item.barcode}`;
      itemButton.appendChild(barcodeSpan);
    }

    const categoryLabel = document.createElement("span");
    categoryLabel.className = "item-category";
    categoryLabel.textContent = getCategoryLabel(item.category);
    itemButton.appendChild(categoryLabel);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      startEdit(index);
    });

    if (item.bought) {
      const stockButton = document.createElement("button");
      stockButton.className = "edit-button";
      stockButton.textContent = "To stock";
      stockButton.addEventListener("click", () => {
        moveItemToStock(index);
      });
      actions.appendChild(stockButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteItem(index);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    li.appendChild(itemButton);
    li.appendChild(actions);
    list.appendChild(li);
  });

  wrapper.appendChild(heading);
  wrapper.appendChild(list);

  return wrapper;
}
