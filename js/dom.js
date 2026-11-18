// References to the page elements the app uses, looked up once when the module loads.

export const formTitle = document.getElementById("formTitle");
export const itemInput = document.getElementById("itemInput");
export const quantityInput = document.getElementById("quantityInput");
export const unitInput = document.getElementById("unitInput");
export const categoryInput = document.getElementById("categoryInput");
export const noteInput = document.getElementById("noteInput");
export const nutritionKcalInput = document.getElementById("nutritionKcalInput");
export const nutritionProteinInput = document.getElementById("nutritionProteinInput");
export const nutritionCarbsInput = document.getElementById("nutritionCarbsInput");
export const nutritionFatInput = document.getElementById("nutritionFatInput");
export const nutritionFiberInput = document.getElementById("nutritionFiberInput");
export const nutritionAmountInput = document.getElementById("nutritionAmountInput");
export const barcodePreview = document.getElementById("barcodePreview");
export const clearBarcodeButton = document.getElementById("clearBarcodeButton");
export const addButton = document.getElementById("addButton");
export const cancelEditButton = document.getElementById("cancelEditButton");
export const startScannerButton = document.getElementById("startScannerButton");
export const stopScannerButton = document.getElementById("stopScannerButton");
export const addMoreRow = document.getElementById("addMoreRow");
export const addMoreItemsButton = document.getElementById("addMoreItemsButton");
export const pantryScanButton = document.getElementById("pantryScanButton");
export const pantryScanStopButton = document.getElementById("pantryScanStopButton");
export const pantryScanMessage = document.getElementById("pantryScanMessage");
export const pantryReaderWrapper = document.getElementById("pantryReaderWrapper");
export const pantryUnknownForm = document.getElementById("pantryUnknownForm");
export const pantryUnknownText = document.getElementById("pantryUnknownText");
export const pantryUnknownNameInput = document.getElementById("pantryUnknownNameInput");
export const pantryUnknownAddButton = document.getElementById("pantryUnknownAddButton");
export const pantryUnknownSkipButton = document.getElementById("pantryUnknownSkipButton");
export const toastEl = document.getElementById("toast");
export const cookDialog = document.getElementById("cookDialog");
export const scannerMessage = document.getElementById("scannerMessage");
export const readerWrapper = document.getElementById("readerWrapper");
export const recipeNameInput = document.getElementById("recipeNameInput");
export const recipeServingsInput = document.getElementById("recipeServingsInput");
export const recipeItemSelect = document.getElementById("recipeItemSelect");
export const recipeGramsInput = document.getElementById("recipeGramsInput");
export const recipeEditorModeText = document.getElementById("recipeEditorModeText");
export const duplicateRecipeButton = document.getElementById("duplicateRecipeButton");
export const cancelRecipeEditButton = document.getElementById("cancelRecipeEditButton");
export const addRecipeIngredientButton = document.getElementById("addRecipeIngredientButton");
export const saveRecipeButton = document.getElementById("saveRecipeButton");
export const clearRecipeButton = document.getElementById("clearRecipeButton");
export const recipeIngredientsList = document.getElementById("recipeIngredientsList");
export const recipeEmptyMessage = document.getElementById("recipeEmptyMessage");
export const recipeTotals = document.getElementById("recipeTotals");
export const recipePerServingTotals = document.getElementById("recipePerServingTotals");
export const savedRecipesList = document.getElementById("savedRecipesList");
export const savedRecipesEmptyMessage = document.getElementById("savedRecipesEmptyMessage");
export const recipeServingLabelInput = document.getElementById("recipeServingLabelInput");
export const recipeInstructionsInput = document.getElementById("recipeInstructionsInput");
export const customIngredientBlock = document.getElementById("customIngredientBlock");
export const customIngredientNameInput = document.getElementById("customIngredientNameInput");
export const customIngredientKcalInput = document.getElementById("customIngredientKcalInput");
export const customIngredientProteinInput = document.getElementById("customIngredientProteinInput");
export const customIngredientCarbsInput = document.getElementById("customIngredientCarbsInput");
export const customIngredientFatInput = document.getElementById("customIngredientFatInput");
export const customIngredientFiberInput = document.getElementById("customIngredientFiberInput");
export const recipeBuilderMessage = document.getElementById("recipeBuilderMessage");
export const recipeMissingNutritionNote = document.getElementById("recipeMissingNutritionNote");
export const recipeWeightTotals = document.getElementById("recipeWeightTotals");
export const recipePer100gTotals = document.getElementById("recipePer100gTotals");
export const searchInput = document.getElementById("searchInput");
export const quickAddButton = document.getElementById("quickAddButton");
export const clearStockButton = document.getElementById("clearStockButton");
export const stockList = document.getElementById("stockList");
export const stockEmptyMessage = document.getElementById("stockEmptyMessage");
export const clearButton = document.getElementById("clearButton");
export const shoppingSections = document.getElementById("shoppingSections");
export const emptyMessage = document.getElementById("emptyMessage");
export const statusEl = document.getElementById("status");
export const bottomTabs = document.getElementById("bottomTabs");
export const tabButtons = document.querySelectorAll(".tab-button");
export const tabPanels = document.querySelectorAll(".tab-panel");
export const pageTitle = document.getElementById("pageTitle");
export const pageSubtitle = document.getElementById("pageSubtitle");
export const listTabBadge = document.getElementById("listTabBadge");
export const pantryTabBadge = document.getElementById("pantryTabBadge");
export const apiKeyInput = document.getElementById("apiKeyInput");
export const saveApiKeyButton = document.getElementById("saveApiKeyButton");
export const clearApiKeyButton = document.getElementById("clearApiKeyButton");
export const testApiKeyButton = document.getElementById("testApiKeyButton");
export const apiKeyStatus = document.getElementById("apiKeyStatus");
export const aiPreferencesInput = document.getElementById("aiPreferencesInput");
export const suggestRecipesButton = document.getElementById("suggestRecipesButton");
export const aiSuggestStatus = document.getElementById("aiSuggestStatus");
export const aiRecipeResults = document.getElementById("aiRecipeResults");
export const pantryMacroChart = document.getElementById("pantryMacroChart");
export const pantryMacroLegend = document.getElementById("pantryMacroLegend");
export const pantryMacroCoverage = document.getElementById("pantryMacroCoverage");
export const listMacroChart = document.getElementById("listMacroChart");
export const listMacroLegend = document.getElementById("listMacroLegend");
export const listMacroCoverage = document.getElementById("listMacroCoverage");

// True when every element the app needs exists, so a renamed or deleted ID in index.html
// is reported once at start-up instead of causing errors later.
export function allElementsPresent() {
  return [
    formTitle,
    itemInput,
    quantityInput,
    unitInput,
    categoryInput,
    noteInput,
    nutritionKcalInput,
    nutritionProteinInput,
    nutritionCarbsInput,
    nutritionFatInput,
    nutritionFiberInput,
    nutritionAmountInput,
    barcodePreview,
    clearBarcodeButton,
    addButton,
    cancelEditButton,
    startScannerButton,
    stopScannerButton,
    addMoreRow,
    addMoreItemsButton,
    pantryScanButton,
    pantryScanStopButton,
    pantryScanMessage,
    pantryReaderWrapper,
    pantryUnknownForm,
    pantryUnknownText,
    pantryUnknownNameInput,
    pantryUnknownAddButton,
    pantryUnknownSkipButton,
    toastEl,
    cookDialog,
    scannerMessage,
    readerWrapper,
    recipeItemSelect,
    recipeGramsInput,
    recipeNameInput,
    saveRecipeButton,
    savedRecipesList,
    recipeServingsInput,
    recipePerServingTotals,
    savedRecipesEmptyMessage,
    addRecipeIngredientButton,
    clearRecipeButton,
    recipeIngredientsList,
    recipeEmptyMessage,
    recipeTotals,
    recipeEditorModeText,
    duplicateRecipeButton,
    cancelRecipeEditButton,
    searchInput,
    clearButton,
    shoppingSections,
    emptyMessage,
    clearStockButton,
    stockList,
    stockEmptyMessage,
    recipeServingLabelInput,
    recipeInstructionsInput,
    customIngredientBlock,
    customIngredientNameInput,
    customIngredientKcalInput,
    customIngredientProteinInput,
    customIngredientCarbsInput,
    customIngredientFatInput,
    customIngredientFiberInput,
    recipeBuilderMessage,
    recipeMissingNutritionNote,
    recipeWeightTotals,
    recipePer100gTotals,
    statusEl,
    bottomTabs,
    pageTitle,
    pageSubtitle,
    listTabBadge,
    pantryTabBadge,
    quickAddButton,
    apiKeyInput,
    saveApiKeyButton,
    clearApiKeyButton,
    testApiKeyButton,
    apiKeyStatus,
    aiPreferencesInput,
    suggestRecipesButton,
    aiSuggestStatus,
    aiRecipeResults,
    pantryMacroChart,
    pantryMacroLegend,
    pantryMacroCoverage,
    listMacroChart,
    listMacroLegend,
    listMacroCoverage
  ].every(Boolean);
}
