// Entry point: loaded by index.html as a module; starts the app.
import { handleSuggestRecipesClick } from "./ai-recipes.js";
import {
  addButton,
  addMoreItemsButton,
  addRecipeIngredientButton,
  allElementsPresent,
  cancelEditButton,
  cancelRecipeEditButton,
  categoryInput,
  clearBarcodeButton,
  clearButton,
  clearRecipeButton,
  clearStockButton,
  customIngredientCarbsInput,
  customIngredientFatInput,
  customIngredientFiberInput,
  customIngredientKcalInput,
  customIngredientNameInput,
  customIngredientProteinInput,
  duplicateRecipeButton,
  itemInput,
  nutritionAmountInput,
  nutritionCarbsInput,
  nutritionFatInput,
  nutritionFiberInput,
  nutritionKcalInput,
  nutritionProteinInput,
  pantryScanButton,
  pantryScanStopButton,
  pantryUnknownAddButton,
  pantryUnknownNameInput,
  pantryUnknownSkipButton,
  quantityInput,
  quickAddButton,
  recipeGramsInput,
  recipeItemSelect,
  recipeServingLabelInput,
  recipeServingsInput,
  saveRecipeButton,
  searchInput,
  startScannerButton,
  stopScannerButton,
  suggestRecipesButton,
  unitInput
} from "./dom.js";
import {
  cancelEdit,
  clearPendingBarcode,
  handleAddMoreItems,
  handleEnterToSubmit,
  submitForm,
  updateFormMode,
  updatePendingBarcodeUI
} from "./item-form.js";
import { createEmptyNutrition } from "./nutrition.js";
import {
  skipPantryUnknown,
  startPantryScanner,
  stopPantryScanner,
  submitPantryUnknown
} from "./pantry-scanner.js";
import { clearStockItems, renderStockList } from "./pantry.js";
import {
  addRecipeIngredient,
  cancelRecipeEdit,
  clearRecipeIngredients,
  duplicateCurrentRecipe,
  handleEnterToAddIngredient,
  renderRecipeBuilder,
  renderRecipeItemOptions,
  saveCurrentRecipe,
  updateCustomIngredientVisibility,
  updateRecipeEditorMode
} from "./recipe-builder.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { startScanner, stopScanner } from "./scanner.js";
import { initApiKeySettings, initBackupSettings, initRecipeLanguageSetting } from "./settings.js";
import {
  clearAllItems,
  quickAddItem,
  renderList,
  updateQuickAddButtonState
} from "./shopping-list.js";
import { state } from "./state.js";
import {
  loadBarcodeCache,
  loadItems,
  loadRecipes,
  loadStockItems,
  loadTargetSettings
} from "./storage.js";
import { initTabs } from "./tabs.js";
import { initTargetsSettings } from "./targets-settings.js";
import { setStatus } from "./ui.js";

// Starts the app: checks the page, loads stored data, renders every tab and wires up the buttons.
// Kept in the same order as the original start-up code, because some steps depend on earlier ones.
function startApp() {
  if (!allElementsPresent()) {
    alert("HTML element missing. Check your index.html IDs.");
    return;
  }
  state.items = loadItems();
  state.pendingNutrition = createEmptyNutrition();
  state.savedRecipes = loadRecipes();
  state.stockItems = loadStockItems();
  state.barcodeCache = loadBarcodeCache();
  state.targetSettings = loadTargetSettings();
  renderList();
  updateFormMode();
  updatePendingBarcodeUI();
  updateQuickAddButtonState();
  initApiKeySettings();
  initBackupSettings();
  initRecipeLanguageSetting();
  initTargetsSettings();
  suggestRecipesButton.addEventListener("click", handleSuggestRecipesClick);
  setStatus("App loaded successfully.");
  renderRecipeItemOptions();
  renderRecipeBuilder();
  renderSavedRecipes();
  renderStockList();
  updateRecipeEditorMode();
  initTabs();

  if (recipeServingsInput.value.trim() === "") recipeServingsInput.value = "1";

  addButton.addEventListener("click", submitForm);
  cancelEditButton.addEventListener("click", cancelEdit);
  clearButton.addEventListener("click", clearAllItems);
  clearBarcodeButton.addEventListener("click", clearPendingBarcode);
  addRecipeIngredientButton.addEventListener("click", addRecipeIngredient);
  recipeItemSelect.addEventListener("change", updateCustomIngredientVisibility);
  clearRecipeButton.addEventListener("click", clearRecipeIngredients);
  // Enter in the ingredient fields adds the ingredient. The recipe name, servings and label fields
  // have no Enter action: saving stays on the button so a half-built recipe isn't saved by accident.
  [
    recipeGramsInput,
    recipeItemSelect,
    customIngredientNameInput,
    customIngredientKcalInput,
    customIngredientProteinInput,
    customIngredientCarbsInput,
    customIngredientFatInput,
    customIngredientFiberInput
  ].forEach((input) => input.addEventListener("keydown", handleEnterToAddIngredient));
  saveRecipeButton.addEventListener("click", saveCurrentRecipe);
  recipeServingsInput.addEventListener("input", renderRecipeBuilder);
  duplicateRecipeButton.addEventListener("click", duplicateCurrentRecipe);
  cancelRecipeEditButton.addEventListener("click", cancelRecipeEdit);
  recipeServingLabelInput.addEventListener("input", renderRecipeBuilder);
  clearStockButton.addEventListener("click", clearStockItems);

  startScannerButton.addEventListener("click", () => {
    void startScanner();
  });

  stopScannerButton.addEventListener("click", () => {
    void stopScanner(false);
  });

  addMoreItemsButton.addEventListener("click", handleAddMoreItems);

  pantryScanButton.addEventListener("click", () => {
    void startPantryScanner();
  });

  pantryScanStopButton.addEventListener("click", () => {
    void stopPantryScanner();
  });

  pantryUnknownAddButton.addEventListener("click", submitPantryUnknown);
  pantryUnknownSkipButton.addEventListener("click", skipPantryUnknown);
  pantryUnknownNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitPantryUnknown();
    }
  });

  searchInput.addEventListener("input", () => {
    renderList();
    updateQuickAddButtonState();
  });

  quickAddButton.addEventListener("click", quickAddItem);

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !quickAddButton.disabled) {
      quickAddItem();
    }
  });

  itemInput.addEventListener("keydown", handleEnterToSubmit);
  quantityInput.addEventListener("keydown", handleEnterToSubmit);
  unitInput.addEventListener("keydown", handleEnterToSubmit);
  categoryInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionKcalInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionProteinInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionCarbsInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionFatInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionFiberInput.addEventListener("keydown", handleEnterToSubmit);
  nutritionAmountInput.addEventListener("keydown", handleEnterToSubmit);
}

startApp();
