// The add/edit item form on the Scanner tab.
import {
  addButton,
  addMoreRow,
  barcodePreview,
  cancelEditButton,
  categoryInput,
  clearBarcodeButton,
  formTitle,
  itemInput,
  noteInput,
  nutritionAmountInput,
  packGramsInput,
  nutritionCarbsInput,
  nutritionFatInput,
  nutritionFiberInput,
  nutritionKcalInput,
  nutritionProteinInput,
  quantityInput,
  unitInput
} from "./dom.js";
import { formatNutritionInputValue, parseOptionalNumberInput } from "./format.js";
import { createEmptyNutrition, normalizeNutrition } from "./nutrition.js";
import { saveItems } from "./persistence.js";
import { buildLookupNote } from "./product-lookup.js";
import { startScanner } from "./scanner.js";
import { findDuplicateBarcodeIndex, renderList } from "./shopping-list.js";
import { createShoppingItem, parsePackGrams, touchItem } from "./items.js";
import { state } from "./state.js";
import { switchTab } from "./tabs.js";
import { setStatus, showToast } from "./ui.js";

export function handleEnterToSubmit(event) {
  if (event.key === "Enter") {
    submitForm();
  }
}

export function submitForm() {
  const name = itemInput.value.trim();
  const quantityRaw = quantityInput.value.trim();
  const unit = unitInput.value.trim();
  const category = categoryInput.value.trim();
  const note = noteInput.value.trim();

  if (name === "") {
    setStatus("Type an item name first.");
    return;
  }

  let quantity = null;

  if (quantityRaw !== "") {
    quantity = Number(quantityRaw);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setStatus("Quantity must be greater than 0.");
      return;
    }
  }

  state.pendingNutrition = readNutritionFromInputs();
  const nutritionAmount = parseOptionalNumberInput(nutritionAmountInput.value);
  const packGrams = parseOptionalNumberInput(packGramsInput.value);

  const editIndex = findEditIndex();
  const duplicateBarcodeIndex = findDuplicateBarcodeIndex(state.pendingBarcode, editIndex);

  if (duplicateBarcodeIndex !== null) {
    const existingItem = state.items[duplicateBarcodeIndex];
    startEdit(duplicateBarcodeIndex);
    setStatus(
      `Barcode already belongs to "${existingItem.name}". Loaded existing item for editing instead of creating a duplicate.`
    );
    return;
  }

  const itemData = {
    name,
    quantity,
    unit,
    category,
    note,
    barcode: state.pendingBarcode,
    nutrition: normalizeNutrition(state.pendingNutrition),
    nutritionAmount,
    packGrams: packGrams !== null && packGrams > 0 ? packGrams : null,
    bought: false
  };

  if (editIndex === null) {
    state.items.push(createShoppingItem(itemData));
    setStatus(`Added "${name}".`);
    showToast(`${name} added to your list`);
  } else {
    const existing = state.items[editIndex];
    // createShoppingItem() keeps the id and resets "bought", so the bought state is copied back after it.
    const updated = createShoppingItem({ ...existing, ...itemData });
    updated.bought = existing.bought;
    state.items[editIndex] = touchItem(updated);
    setStatus(`Updated "${name}".`);
    showToast(`${name} updated`);
  }

  saveItems();
  renderList();
  resetForm();
  showAddMoreButton();
}

// Where the item being edited is in the list now, or null when adding (or when it was removed meanwhile).
function findEditIndex() {
  if (state.editId === null) {
    return null;
  }
  const index = state.items.findIndex((item) => item.id === state.editId);
  return index === -1 ? null : index;
}

export function startEdit(index) {
  const item = state.items[index];

  state.editId = item.id;
  itemInput.value = item.name;
  quantityInput.value = item.quantity === null ? "" : String(item.quantity);
  unitInput.value = item.unit;
  categoryInput.value = item.category;
  noteInput.value = item.note || "";
  state.pendingBarcode = typeof item.barcode === "string" ? item.barcode : "";
  state.pendingNutrition = normalizeNutrition(item.nutrition);
  syncNutritionInputsFromPending();
  nutritionAmountInput.value = formatNutritionInputValue(item.nutritionAmount);
  packGramsInput.value =
    item.packGrams === null || item.packGrams === undefined ? "" : String(item.packGrams);
  updatePendingBarcodeUI();
  updateFormMode();

  // The add/edit form lives on the Scanner tab. Switch there so the
  // populated form is actually visible, no matter which tab the edit
  // was triggered from (e.g. the List tab's "Edit" button).
  hideAddMoreButton();
  switchTab("scanner");

  itemInput.focus();
  setStatus(`Editing "${item.name}".`);
}

export function cancelEdit() {
  const editIndex = findEditIndex();
  if (state.editId === null) {
    return;
  }

  const itemName = editIndex !== null ? state.items[editIndex].name : "item";
  resetForm();
  setStatus(`Edit cancelled for "${itemName}".`);
}

export function resetForm() {
  state.editId = null;
  itemInput.value = "";
  quantityInput.value = "";
  unitInput.value = "";
  categoryInput.value = "";
  noteInput.value = "";
  state.pendingBarcode = "";
  state.pendingNutrition = createEmptyNutrition();
  syncNutritionInputsFromPending();
  nutritionAmountInput.value = "";
  packGramsInput.value = "";
  updatePendingBarcodeUI();
  updateFormMode();
  itemInput.focus();
}

export function updateFormMode() {
  if (state.editId === null) {
    formTitle.textContent = "Add item";
    addButton.textContent = "Add item";
    cancelEditButton.classList.add("hidden");
  } else {
    formTitle.textContent = "Edit item";
    addButton.textContent = "Save changes";
    cancelEditButton.classList.remove("hidden");
  }
}

export function updatePendingBarcodeUI() {
  barcodePreview.value = state.pendingBarcode;
  clearBarcodeButton.disabled = state.pendingBarcode === "";
}

export function clearPendingBarcode() {
  if (state.pendingBarcode === "") {
    setStatus("There is no barcode to clear.");
    return;
  }

  state.pendingBarcode = "";
  state.pendingNutrition = createEmptyNutrition();
  updatePendingBarcodeUI();
  setStatus("Pending barcode cleared.");
}

export function showAddMoreButton() {
  addMoreRow.classList.remove("hidden");
}

export function hideAddMoreButton() {
  addMoreRow.classList.add("hidden");
}

// Batch scanning: the form is already reset after saving, so just jump back
// to the top of the page and start the camera again.
export function handleAddMoreItems() {
  hideAddMoreButton();

  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  void startScanner();
}

export function applyLookupToForm(productData) {
  if (productData.name !== "" && itemInput.value.trim() === "") {
    itemInput.value = productData.name;
  }

  if (productData.category !== "" && categoryInput.value.trim() === "") {
    categoryInput.value = productData.category;
  }

  const generatedNote = buildLookupNote(productData);

  if (generatedNote !== "" && noteInput.value.trim() === "") {
    noteInput.value = generatedNote;
  }

  // The weight of one pack from the package text ("5 kg", "6 x 330 ml"), so the item carries it into the
  // pantry and recipes know how much a pack holds; left alone when already filled in.
  const packGrams = parsePackGrams(productData.packageQuantity);
  if (packGrams !== null && packGramsInput.value.trim() === "") {
    packGramsInput.value = String(packGrams);
  }

  state.pendingNutrition = normalizeNutrition(productData.nutrition);
  syncNutritionInputsFromPending();
}

export function syncNutritionInputsFromPending() {
  const nutrition = normalizeNutrition(state.pendingNutrition);

  nutritionKcalInput.value = formatNutritionInputValue(nutrition.kcal100g);
  nutritionProteinInput.value = formatNutritionInputValue(nutrition.protein100g);
  nutritionCarbsInput.value = formatNutritionInputValue(nutrition.carbs100g);
  nutritionFatInput.value = formatNutritionInputValue(nutrition.fat100g);
  nutritionFiberInput.value = formatNutritionInputValue(nutrition.fiber100g);
}

export function readNutritionFromInputs() {
  return normalizeNutrition({
    kcal100g: parseOptionalNumberInput(nutritionKcalInput.value),
    protein100g: parseOptionalNumberInput(nutritionProteinInput.value),
    carbs100g: parseOptionalNumberInput(nutritionCarbsInput.value),
    fat100g: parseOptionalNumberInput(nutritionFatInput.value),
    fiber100g: parseOptionalNumberInput(nutritionFiberInput.value)
  });
}
