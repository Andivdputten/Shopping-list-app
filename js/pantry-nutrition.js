// "Find nutrition" on a pantry item without data: a NEVO or Open Food Facts search fills in its values,
// for loose produce and items a barcode lookup couldn't fill (common for Dutch products).
import { addFoodSearch, sourceLabel } from "./food-search.js";
import { normalizeNutrition } from "./nutrition.js";
import { saveStockItems } from "./persistence.js";
import { state } from "./state.js";
import { addField, numberInput, openLogDialog } from "./today.js";
import { showToast } from "./ui.js";

// The source line shown under a pantry item's values; "" for values typed in or from a barcode.
export function pantrySourceText(item) {
  if (item.nutritionSource === "nevo") {
    return `Source: NEVO ${item.nevoVersion || ""}`.trim();
  }
  return item.nutritionSource === "off" ? "Source: Open Food Facts (search)" : "";
}

export function openFindNutrition(index, onSaved) {
  const item = state.stockItems[index];
  const { body, addActions } = openLogDialog(`Nutrition for ${item.name}`);
  let chosen = null;
  const input = addFoodSearch(body, {
    idPrefix: "pantryNutrition",
    onPick: (choice) => {
      chosen = choice;
    }
  });
  // Starts from the item's own name, since that is usually what you'd search for.
  input.value = item.name;
  const message = document.createElement("p");
  message.className = "status-text";
  body.appendChild(message);

  addActions("Save", () => {
    if (!chosen) {
      message.textContent = "Search and choose a food first.";
      return false;
    }
    item.nutrition = normalizeNutrition(chosen.nutrition);
    item.nutritionSource = chosen.nutritionSource;
    item.nevoVersion = chosen.nevoVersion;
    saveStockItems();
    onSaved();
    showToast(`Nutrition saved for ${item.name} (${sourceLabel(chosen)})`);
    return true;
  });
}

// Units that are already a weight or volume; other units (pack, pcs, bottle...) need a weight per unit.
const WEIGHT_UNITS = ["g", "kg", "ml", "l"];

export function needsPackWeight(item) {
  return !WEIGHT_UNITS.includes((item.unit || "").trim().toLowerCase());
}

// "5000 g per pack" (or "1000 g each" without a unit) under a pantry item counted in packs or pieces; ""
// when unknown or not needed.
export function packWeightText(item) {
  if (!needsPackWeight(item) || !(item.packGrams > 0)) {
    return "";
  }
  const unit = (item.unit || "").trim();
  return unit === "" ? `${item.packGrams} g each` : `${item.packGrams} g per ${unit}`;
}

// "Set weight": how many grams one pack or piece holds, so recipes, cooking and statistics know the total.
export function openPackWeight(index, onSaved) {
  const item = state.stockItems[index];
  const unit = (item.unit || "").trim() || "piece";
  const { body, addActions } = openLogDialog(`Weight of ${item.name}`);
  const input = addField(
    body,
    `Grams per ${unit}`,
    numberInput(item.packGrams),
    "packGramsDialogInput"
  );
  const hint = document.createElement("p");
  hint.className = "hint-text";
  hint.textContent = `For example 5000 for a 5 kg pack, or 60 for one egg. Leave empty if unknown.`;
  const message = document.createElement("p");
  message.className = "status-text";
  body.append(hint, message);
  addActions("Save", () => {
    const value = Number(input.value);
    if (input.value.trim() !== "" && !(Number.isFinite(value) && value > 0)) {
      message.textContent = "Enter a weight above 0, or leave it empty.";
      return false;
    }
    item.packGrams = input.value.trim() === "" ? null : value;
    saveStockItems();
    onSaved();
    showToast(
      item.packGrams === null
        ? `Weight removed for ${item.name}`
        : `${item.name}: ${item.packGrams} g per ${unit}`
    );
    return true;
  });
}
