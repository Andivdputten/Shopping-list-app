// Values that change while the app runs, shared by all modules through this one object.
// ES modules can't reassign each other's variables, so they read and write state.X instead.
// main.js fills in the stored data at start-up.
export const state = {
  items: null,
  editIndex: null,
  pendingBarcode: "",
  pendingNutrition: null,
  html5QrCode: null,
  scannerRunning: false,
  scanLock: false,
  pantryScanner: null,
  pantryScannerRunning: false,
  pantryScanBusy: false,
  pantryLastBarcode: "",
  pantryCooldownUntil: 0,
  pantryPendingBarcode: "",
  pantryPendingProduct: null,
  toastTimer: null,
  recipeIngredients: [],
  savedRecipes: null,
  aiRecipeEntries: [],
  aiToolbar: null,
  editingSavedRecipeIndex: null,
  stockItems: null,
  barcodeCache: null,
  // Daily targets, body data and meal split; loaded at start-up (see js/targets.js).
  targetSettings: null
};
