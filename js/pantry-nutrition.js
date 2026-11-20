// "Find nutrition" on a pantry item without data: a NEVO or Open Food Facts search fills in its values,
// for loose produce and items a barcode lookup couldn't fill (common for Dutch products).
import { addFoodSearch, sourceLabel } from "./food-search.js";
import { normalizeNutrition } from "./nutrition.js";
import { saveStockItems } from "./persistence.js";
import { state } from "./state.js";
import { openLogDialog } from "./today.js";
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
