document.addEventListener("DOMContentLoaded", () => {
const STORAGE_KEY = "grocery_scanner_items_v6";
const STOCK_STORAGE_KEY = "grocery_scanner_stock_v1";
const RECIPE_STORAGE_KEY = "grocery_scanner_recipes_v1";
const BARCODE_CACHE_STORAGE_KEY = "grocery_scanner_barcode_cache_v1";
const BARCODE_CACHE_MAX_ENTRIES = 500;
// Cached "not found" results expire after a while in case a product gets
// added to Open Food Facts later; successful matches are cached indefinitely
// since a product's barcode/nutrition data rarely changes.
const BARCODE_CACHE_NOT_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CATEGORY_ORDER = [
"",
"Produce",
"Dairy",
"Pantry",
"Frozen",
"Drinks",
"Household",
"Personal care"
];

const formTitle = document.getElementById("formTitle");
const itemInput = document.getElementById("itemInput");
const quantityInput = document.getElementById("quantityInput");
const unitInput = document.getElementById("unitInput");
const categoryInput = document.getElementById("categoryInput");
const noteInput = document.getElementById("noteInput");
const nutritionKcalInput = document.getElementById("nutritionKcalInput");
const nutritionProteinInput = document.getElementById("nutritionProteinInput");
const nutritionCarbsInput = document.getElementById("nutritionCarbsInput");
const nutritionFatInput = document.getElementById("nutritionFatInput");
const nutritionAmountInput = document.getElementById("nutritionAmountInput");
const barcodePreview = document.getElementById("barcodePreview");
const clearBarcodeButton = document.getElementById("clearBarcodeButton");
const addButton = document.getElementById("addButton");
const cancelEditButton = document.getElementById("cancelEditButton");

const startScannerButton = document.getElementById("startScannerButton");
const stopScannerButton = document.getElementById("stopScannerButton");
const scannerMessage = document.getElementById("scannerMessage");
const readerWrapper = document.getElementById("readerWrapper");

const recipeNameInput = document.getElementById("recipeNameInput");
const recipeServingsInput = document.getElementById("recipeServingsInput");
const recipeItemSelect = document.getElementById("recipeItemSelect");
const recipeGramsInput = document.getElementById("recipeGramsInput");
const recipeEditorModeText = document.getElementById("recipeEditorModeText");
const duplicateRecipeButton = document.getElementById("duplicateRecipeButton");
const cancelRecipeEditButton = document.getElementById("cancelRecipeEditButton");
const addRecipeIngredientButton = document.getElementById("addRecipeIngredientButton");
const saveRecipeButton = document.getElementById("saveRecipeButton");
const clearRecipeButton = document.getElementById("clearRecipeButton");
const recipeIngredientsList = document.getElementById("recipeIngredientsList");
const recipeEmptyMessage = document.getElementById("recipeEmptyMessage");
const recipeTotals = document.getElementById("recipeTotals");
const recipePerServingTotals = document.getElementById("recipePerServingTotals");
const savedRecipesList = document.getElementById("savedRecipesList");
const savedRecipesEmptyMessage = document.getElementById("savedRecipesEmptyMessage");
const recipeServingLabelInput = document.getElementById("recipeServingLabelInput");
const recipeWeightTotals = document.getElementById("recipeWeightTotals");
const recipePer100gTotals = document.getElementById("recipePer100gTotals");
const searchInput = document.getElementById("searchInput");
const quickAddButton = document.getElementById("quickAddButton");

const clearStockButton = document.getElementById("clearStockButton");
const stockList = document.getElementById("stockList");
const stockEmptyMessage = document.getElementById("stockEmptyMessage");

const clearButton = document.getElementById("clearButton");
const shoppingSections = document.getElementById("shoppingSections");
const emptyMessage = document.getElementById("emptyMessage");
const statusEl = document.getElementById("status");

const bottomTabs = document.getElementById("bottomTabs");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const listTabBadge = document.getElementById("listTabBadge");
const pantryTabBadge = document.getElementById("pantryTabBadge");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveApiKeyButton = document.getElementById("saveApiKeyButton");
const clearApiKeyButton = document.getElementById("clearApiKeyButton");
const testApiKeyButton = document.getElementById("testApiKeyButton");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const aiPreferencesInput = document.getElementById("aiPreferencesInput");
const suggestRecipesButton = document.getElementById("suggestRecipesButton");
const aiSuggestStatus = document.getElementById("aiSuggestStatus");
const aiRecipeResults = document.getElementById("aiRecipeResults");
const pantryMacroChart = document.getElementById("pantryMacroChart");
const pantryMacroLegend = document.getElementById("pantryMacroLegend");
const pantryMacroCoverage = document.getElementById("pantryMacroCoverage");
const listMacroChart = document.getElementById("listMacroChart");
const listMacroLegend = document.getElementById("listMacroLegend");
const listMacroCoverage = document.getElementById("listMacroCoverage");

if (
!formTitle ||
!itemInput ||
!quantityInput ||
!unitInput ||
!categoryInput ||
!noteInput ||
!nutritionKcalInput ||
!nutritionProteinInput ||
!nutritionCarbsInput ||
!nutritionFatInput ||
!nutritionAmountInput ||
!barcodePreview ||
!clearBarcodeButton ||
!addButton ||
!cancelEditButton ||
!startScannerButton ||
!stopScannerButton ||
!scannerMessage ||
!readerWrapper ||
!recipeItemSelect ||
!recipeGramsInput ||
!recipeNameInput ||
!saveRecipeButton ||
!savedRecipesList ||
!recipeServingsInput ||
!recipePerServingTotals ||
!savedRecipesEmptyMessage ||
!addRecipeIngredientButton ||
!clearRecipeButton ||
!recipeIngredientsList ||
!recipeEmptyMessage ||
!recipeTotals ||  
!recipeEditorModeText ||
!duplicateRecipeButton ||
!cancelRecipeEditButton ||
!searchInput ||
!clearButton ||
!shoppingSections ||
!emptyMessage ||
!clearStockButton ||
!stockList ||
!stockEmptyMessage ||
!recipeServingLabelInput ||
!recipeWeightTotals ||
!recipePer100gTotals ||
!statusEl ||
!bottomTabs ||
!pageTitle ||
!pageSubtitle ||
!listTabBadge ||
!pantryTabBadge ||
!quickAddButton ||
!apiKeyInput ||
!saveApiKeyButton ||
!clearApiKeyButton ||
!testApiKeyButton ||
!apiKeyStatus ||
!aiPreferencesInput ||
!suggestRecipesButton ||
!aiSuggestStatus ||
!aiRecipeResults ||
!pantryMacroChart ||
!pantryMacroLegend ||
!pantryMacroCoverage ||
!listMacroChart ||
!listMacroLegend ||
!listMacroCoverage
) {
alert("HTML element missing. Check your index.html IDs.");
return;
}

let items = loadItems();
let editIndex = null;
let pendingBarcode = "";
let pendingNutrition = createEmptyNutrition();
let html5QrCode = null;
let scannerRunning = false;
let scanLock = false;
let recipeIngredients = [];
let savedRecipes = loadRecipes();
let editingSavedRecipeIndex = null;
let stockItems = loadStockItems();
let barcodeCache = loadBarcodeCache();

const TAB_INFO = {
  scanner: {
    title: "Scanner",
    subtitle: "Scan a barcode or add an item by hand"
  },
  list: {
    title: "Shopping list",
    subtitle: "What you still need to buy"
  },
  pantry: {
    title: "Pantry",
    subtitle: "What you already have in stock"
  },
  recipes: {
    title: "Recipes",
    subtitle: "Build and save recipes from your items"
  },
  settings: {
    title: "Settings",
    subtitle: "Manage your AI connection"
  }
};
  
renderList();
updateFormMode();
updatePendingBarcodeUI();
updateQuickAddButtonState();
initApiKeySettings();
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
clearRecipeButton.addEventListener("click", clearRecipeIngredients);
recipeGramsInput.addEventListener("keydown", handleEnterToSubmit);
recipeItemSelect.addEventListener("keydown", handleEnterToSubmit);
saveRecipeButton.addEventListener("click", saveCurrentRecipe);
recipeNameInput.addEventListener("keydown", handleEnterToSubmit);
recipeServingsInput.addEventListener("input", renderRecipeBuilder);
recipeServingsInput.addEventListener("keydown", handleEnterToSubmit);
duplicateRecipeButton.addEventListener("click", duplicateCurrentRecipe);
cancelRecipeEditButton.addEventListener("click", cancelRecipeEdit);
recipeServingLabelInput.addEventListener("input", renderRecipeBuilder);
recipeServingLabelInput.addEventListener("keydown", handleEnterToSubmit);
recipeServingsInput.addEventListener("input", renderRecipeBuilder);
clearStockButton.addEventListener("click", clearStockItems);
  
startScannerButton.addEventListener("click", () => {
void startScanner();
});

stopScannerButton.addEventListener("click", () => {
void stopScanner(false);
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
nutritionAmountInput.addEventListener("keydown", handleEnterToSubmit);
  
function handleEnterToSubmit(event) {
if (event.key === "Enter") {
submitForm();
}
}

function updateQuickAddButtonState() {
  quickAddButton.disabled = searchInput.value.trim() === "";
}

function quickAddItem() {
  const name = searchInput.value.trim();

  if (name === "") {
    return;
  }

  items.push({
    name,
    quantity: null,
    unit: "",
    category: "",
    note: "",
    barcode: "",
    nutrition: createEmptyNutrition(),
    nutritionAmount: null,
    bought: false
  });

  saveItems();
  searchInput.value = "";
  updateQuickAddButtonState();
  renderList();
  setStatus(`Added "${name}" to your shopping list.`);
}

function initApiKeySettings() {
  if (!window.RecipeAI) {
    apiKeyStatus.textContent = "AI module failed to load. Try reloading the app.";
    saveApiKeyButton.disabled = true;
    clearApiKeyButton.disabled = true;
    testApiKeyButton.disabled = true;
    return;
  }

  apiKeyInput.value = window.RecipeAI.getApiKey();
  updateApiKeyStatusDisplay();

  saveApiKeyButton.addEventListener("click", () => {
    const value = apiKeyInput.value.trim();

    if (value === "") {
      apiKeyStatus.textContent = "Enter a key before saving.";
      return;
    }

    window.RecipeAI.setApiKey(value);
    updateApiKeyStatusDisplay();
  });

  clearApiKeyButton.addEventListener("click", () => {
    window.RecipeAI.clearApiKey();
    apiKeyInput.value = "";
    apiKeyStatus.textContent = "API key removed.";
  });

  testApiKeyButton.addEventListener("click", async () => {
    testApiKeyButton.disabled = true;
    const previousLabel = testApiKeyButton.textContent;
    testApiKeyButton.textContent = "Testing...";
    apiKeyStatus.textContent = "Testing connection...";

    const result = await window.RecipeAI.testConnection();

    testApiKeyButton.disabled = false;
    testApiKeyButton.textContent = previousLabel;
    apiKeyStatus.textContent = result.message;
  });
}

function updateApiKeyStatusDisplay() {
  if (window.RecipeAI && window.RecipeAI.hasApiKey()) {
    apiKeyStatus.textContent = 'API key saved. Tap "Test connection" to verify it works.';
  } else {
    apiKeyStatus.textContent = "No API key saved yet.";
  }
}

function normalizeIngredientName(name) {
  let normalized = typeof name === "string" ? name.trim().toLowerCase() : "";
  normalized = normalized.replace(/\s+/g, " ");
  // Very small heuristic: treat "eggs" and "egg" as the same ingredient.
  if (normalized.length > 3 && normalized.endsWith("s")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function findMatchingStockItem(ingredientName) {
  const target = normalizeIngredientName(ingredientName);

  if (target === "") {
    return null;
  }

  const exact = stockItems.find(
    (item) => normalizeIngredientName(item.name) === target
  );
  if (exact) {
    return exact;
  }

  // Loose fallback: one name contains the other (e.g. "olive oil" vs "oil").
  return (
    stockItems.find((item) => {
      const stockName = normalizeIngredientName(item.name);
      return stockName !== "" && (stockName.includes(target) || target.includes(stockName));
    }) || null
  );
}

function hasUsableNutrition(nutrition) {
  if (!nutrition) {
    return false;
  }
  return (
    typeof nutrition.kcal100g === "number" ||
    typeof nutrition.protein100g === "number" ||
    typeof nutrition.carbs100g === "number" ||
    typeof nutrition.fat100g === "number"
  );
}

function matchRecipeIngredients(recipe) {
  return recipe.ingredients.map((ingredient) => {
    const stockMatch = findMatchingStockItem(ingredient.name);
    return {
      ...ingredient,
      stockMatch,
      inStock: stockMatch !== null,
      hasNutrition: stockMatch ? hasUsableNutrition(stockMatch.nutrition) : false
    };
  });
}

function computeRecipeMacros(recipe, matchedIngredients) {
  const allHaveNutrition = matchedIngredients.every(
    (ing) => ing.hasNutrition && typeof ing.amount === "number"
  );

  if (allHaveNutrition && matchedIngredients.length > 0) {
    const totals = matchedIngredients.reduce(
      (acc, ing) => {
        const factor = ing.amount / 100;
        const n = ing.stockMatch.nutrition;
        acc.kcal += (n.kcal100g || 0) * factor;
        acc.protein += (n.protein100g || 0) * factor;
        acc.carbs += (n.carbs100g || 0) * factor;
        acc.fat += (n.fat100g || 0) * factor;
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const servings = recipe.servings > 0 ? recipe.servings : 1;
    return {
      source: "calculated",
      perServing: {
        kcal: Math.round(totals.kcal / servings),
        protein: Math.round((totals.protein / servings) * 10) / 10,
        carbs: Math.round((totals.carbs / servings) * 10) / 10,
        fat: Math.round((totals.fat / servings) * 10) / 10
      }
    };
  }

  const est = recipe.estimatedMacrosPerServing;
  if (est && (est.kcal !== null || est.protein !== null || est.carbs !== null || est.fat !== null)) {
    return { source: "estimated", perServing: est };
  }

  return { source: "unknown", perServing: null };
}

function macroPillsHtml(macros) {
  if (!macros || macros.kcal === null) {
    return "";
  }
  const parts = [];
  if (macros.kcal !== null) parts.push(`${Math.round(macros.kcal)} kcal`);
  if (macros.protein !== null) parts.push(`${macros.protein}g protein`);
  if (macros.carbs !== null) parts.push(`${macros.carbs}g carbs`);
  if (macros.fat !== null) parts.push(`${macros.fat}g fat`);
  return parts;
}

function renderAiRecipes(recipes) {
  aiRecipeResults.innerHTML = "";

  recipes.forEach((recipe) => {
    const matchedIngredients = matchRecipeIngredients(recipe);
    const macroResult = computeRecipeMacros(recipe, matchedIngredients);
    const missingIngredients = matchedIngredients.filter((ing) => !ing.inStock);

    const card = document.createElement("div");
    card.className = "ai-recipe-card";

    const heading = document.createElement("h3");
    heading.textContent = recipe.name;
    card.appendChild(heading);

    if (recipe.description !== "") {
      const desc = document.createElement("p");
      desc.className = "ai-recipe-description";
      desc.textContent = recipe.description;
      card.appendChild(desc);
    }

    const servingsLine = document.createElement("p");
    servingsLine.className = "item-meta";
    servingsLine.textContent = `Serves ${recipe.servings}${
      missingIngredients.length > 0 ? ` — needs ${missingIngredients.length} extra ingredient${missingIngredients.length === 1 ? "" : "s"}` : " — you have everything"
    }`;
    card.appendChild(servingsLine);

    const pills = macroPillsHtml(macroResult.perServing);
    if (pills) {
      const macroRow = document.createElement("div");
      macroRow.className = "ai-macro-row";
      pills.forEach((text) => {
        const pill = document.createElement("span");
        pill.className = "ai-macro-pill";
        pill.textContent = text;
        macroRow.appendChild(pill);
      });
      card.appendChild(macroRow);

      const sourceLine = document.createElement("p");
      sourceLine.className = "ai-macro-source";
      sourceLine.textContent =
        macroResult.source === "calculated"
          ? "Per serving — calculated from your saved nutrition data."
          : "Per serving — estimated by AI (add nutrition data to matching items for precise numbers).";
      card.appendChild(sourceLine);
    }

    const ingredientList = document.createElement("ul");
    ingredientList.className = "ai-ingredient-list";
    matchedIngredients.forEach((ing) => {
      const li = document.createElement("li");
      const flag = document.createElement("span");
      flag.className = `ai-ingredient-flag ${ing.inStock ? "have" : "need"}`;
      flag.textContent = ing.inStock ? "✓" : "+";
      const label = document.createElement("span");
      const amountText =
        typeof ing.amount === "number" ? `${ing.amount}${ing.unit} ` : "";
      label.textContent = `${amountText}${ing.name}`;
      li.appendChild(flag);
      li.appendChild(label);
      ingredientList.appendChild(li);
    });
    card.appendChild(ingredientList);

    if (recipe.instructions.length > 0) {
      const steps = document.createElement("ol");
      steps.className = "ai-instructions";
      recipe.instructions.forEach((step) => {
        const li = document.createElement("li");
        li.textContent = step;
        steps.appendChild(li);
      });
      card.appendChild(steps);
    }

    const actions = document.createElement("div");
    actions.className = "ai-recipe-actions";

    const saveButton = document.createElement("button");
    saveButton.className = "secondary-button";
    saveButton.textContent = "Save recipe";
    saveButton.addEventListener("click", () => {
      saveAiRecipe(recipe, matchedIngredients);
    });
    actions.appendChild(saveButton);

    if (missingIngredients.length > 0) {
      const addMissingButton = document.createElement("button");
      addMissingButton.className = "secondary-button";
      addMissingButton.textContent = "Add missing to list";
      addMissingButton.addEventListener("click", () => {
        addMissingIngredientsToShoppingList(missingIngredients);
      });
      actions.appendChild(addMissingButton);
    }

    card.appendChild(actions);
    aiRecipeResults.appendChild(card);
  });
}

function saveAiRecipe(recipe, matchedIngredients) {
  const recipeData = {
    name: recipe.name,
    servings: recipe.servings,
    servingLabel: "",
    ingredients: matchedIngredients.map((ing) => ({
      name: ing.name,
      grams: typeof ing.amount === "number" ? ing.amount : 0,
      nutrition: ing.hasNutrition
        ? normalizeNutrition(ing.stockMatch.nutrition)
        : createEmptyNutrition()
    }))
  };

  const existingIndex = savedRecipes.findIndex(
    (r) => r.name.toLowerCase() === recipe.name.toLowerCase()
  );

  if (existingIndex !== -1) {
    aiSuggestStatus.textContent = `A saved recipe named "${recipe.name}" already exists.`;
    return;
  }

  savedRecipes.push(recipeData);
  saveRecipes();
  renderSavedRecipes();
  aiSuggestStatus.textContent = `Saved "${recipe.name}" to your recipes.`;
}

function addMissingIngredientsToShoppingList(missingIngredients) {
  let addedCount = 0;

  missingIngredients.forEach((ing) => {
    const alreadyOnList = items.some(
      (item) => normalizeIngredientName(item.name) === normalizeIngredientName(ing.name)
    );
    if (alreadyOnList) {
      return;
    }

    items.push({
      name: ing.name,
      quantity: typeof ing.amount === "number" ? ing.amount : null,
      unit: ing.unit || "",
      category: "",
      note: "",
      barcode: "",
      nutrition: createEmptyNutrition(),
      nutritionAmount: null,
      bought: false
    });
    addedCount++;
  });

  saveItems();
  renderList();
  aiSuggestStatus.textContent =
    addedCount > 0
      ? `Added ${addedCount} missing ingredient${addedCount === 1 ? "" : "s"} to your shopping list.`
      : "Those ingredients are already on your shopping list.";
}

async function handleSuggestRecipesClick() {
  if (!window.RecipeAI || !window.RecipeAI.hasApiKey()) {
    aiSuggestStatus.textContent = "Add an API key in Settings first.";
    switchTab("settings");
    return;
  }

  suggestRecipesButton.disabled = true;
  const previousLabel = suggestRecipesButton.textContent;
  suggestRecipesButton.textContent = "Thinking...";
  aiSuggestStatus.textContent = "Asking the AI for recipe ideas based on your stock...";
  aiRecipeResults.innerHTML = "";

  const result = await window.RecipeAI.generateRecipes(
    stockItems,
    aiPreferencesInput.value
  );

  suggestRecipesButton.disabled = false;
  suggestRecipesButton.textContent = previousLabel;

  if (!result.ok) {
    aiSuggestStatus.textContent = result.message;
    return;
  }

  aiSuggestStatus.textContent = `Got ${result.recipes.length} recipe idea${result.recipes.length === 1 ? "" : "s"}.`;
  renderAiRecipes(result.recipes);
}

function submitForm() {
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
  
  pendingNutrition = readNutritionFromInputs();
  const nutritionAmount = parseOptionalNumberInput(nutritionAmountInput.value);
  
  const duplicateBarcodeIndex = findDuplicateBarcodeIndex(
    pendingBarcode,
    editIndex
  );

  if (duplicateBarcodeIndex !== null) {
    const existingItem = items[duplicateBarcodeIndex];
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
    barcode: pendingBarcode,
   nutrition: normalizeNutrition(pendingNutrition),
   nutritionAmount,
   bought: false
  };

  if (editIndex === null) {
    items.push(itemData);
    setStatus(`Added "${name}".`);
  } else {
    itemData.bought = items[editIndex].bought;
    items[editIndex] = itemData;
    setStatus(`Updated "${name}".`);
  }

  saveItems();
  renderList();
  resetForm();
}

function startEdit(index) {
  const item = items[index];

  editIndex = index;
  itemInput.value = item.name;
  quantityInput.value = item.quantity === null ? "" : String(item.quantity);
  unitInput.value = item.unit;
  categoryInput.value = item.category;
  noteInput.value = item.note || "";
  pendingBarcode = typeof item.barcode === "string" ? item.barcode : "";
  pendingNutrition = normalizeNutrition(item.nutrition);
  syncNutritionInputsFromPending();
  nutritionAmountInput.value = formatNutritionInputValue(item.nutritionAmount);
  updatePendingBarcodeUI();
  updateFormMode();

  // The add/edit form lives on the Scanner tab. Switch there so the
  // populated form is actually visible, no matter which tab the edit
  // was triggered from (e.g. the List tab's "Edit" button).
  switchTab("scanner");

  itemInput.focus();
  setStatus(`Editing "${item.name}".`);
}

function cancelEdit() {
if (editIndex === null) {
return;
}

const itemName = items[editIndex] ? items[editIndex].name : "item";
resetForm();
setStatus(`Edit cancelled for "${itemName}".`);
}

function resetForm() {
  editIndex = null;
  itemInput.value = "";
  quantityInput.value = "";
  unitInput.value = "";
  categoryInput.value = "";
  noteInput.value = "";
  pendingBarcode = "";
  pendingNutrition = createEmptyNutrition();
  syncNutritionInputsFromPending();
  nutritionAmountInput.value = "";
  updatePendingBarcodeUI();
  updateFormMode();
  itemInput.focus();
}
function updateFormMode() {
if (editIndex === null) {
formTitle.textContent = "Add item";
addButton.textContent = "Add item";
cancelEditButton.classList.add("hidden");
} else {
formTitle.textContent = "Edit item";
addButton.textContent = "Save changes";
cancelEditButton.classList.remove("hidden");
}
}

function updatePendingBarcodeUI() {
barcodePreview.value = pendingBarcode;
clearBarcodeButton.disabled = pendingBarcode === "";
}

function clearPendingBarcode() {
  if (pendingBarcode === "") {
    setStatus("There is no barcode to clear.");
    return;
  }

  pendingBarcode = "";
  pendingNutrition = createEmptyNutrition();
  updatePendingBarcodeUI();
  setStatus("Pending barcode cleared.");
}

async function startScanner() {
if (scannerRunning) {
setStatus("Scanner already running.");
return;
}

if (!window.isSecureContext) {
scannerMessage.textContent = "Scanner unavailable: page is not using HTTPS.";
setStatus("Camera scanning requires HTTPS.");
return;
}

if (typeof Html5Qrcode === "undefined") {
scannerMessage.textContent = "Scanner unavailable: library failed to load.";
setStatus("Scanner library did not load.");
return;
}

readerWrapper.classList.remove("hidden");
startScannerButton.disabled = true;
stopScannerButton.disabled = true;
scannerMessage.textContent = "Requesting camera access...";

scanLock = false;
html5QrCode = new Html5Qrcode("reader");

try {
await html5QrCode.start(
{ facingMode: "environment" },
{
fps: 10,
qrbox: { width: 280, height: 120 },
aspectRatio: 1.7777778
},
onScanSuccess,
() => {
// Ignore per-frame scan misses.
}
);

scannerRunning = true;
stopScannerButton.disabled = false;
scannerMessage.textContent =
"Scanner running. Point the back camera at a barcode.";
setStatus("Scanner started.");
} catch (error) {
html5QrCode = null;
readerWrapper.classList.add("hidden");
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
const reason = getScannerStartErrorMessage(error);
scannerMessage.textContent = reason;
setStatus(reason);
}
}

function onScanSuccess(decodedText) {
if (scanLock) {
return;
}

scanLock = true;
void handleDetectedBarcode(decodedText);
}

async function handleDetectedBarcode(decodedText) {
pendingBarcode = decodedText;
updatePendingBarcodeUI();

await stopScanner(true);

const existingIndex = findItemIndexByBarcode(decodedText);

if (existingIndex !== null) {
const existingItem = items[existingIndex];
startEdit(existingIndex);
scannerMessage.textContent = `Matched existing item: ${existingItem.name}`;
setStatus(
`Barcode matched "${existingItem.name}". Existing item loaded for editing.`
);
return;
}

const cached = getCachedBarcodeLookup(decodedText);

if (cached !== undefined) {
if (cached !== null) {
applyLookupToForm(cached);
scannerMessage.textContent =
cached.name !== ""
? `Match from local cache: ${cached.name}`
: `Match from local cache for barcode ${decodedText}`;
setStatus("Loaded from a previous scan (no network request needed). Review and save.");
} else {
scannerMessage.textContent = `New barcode ready: ${decodedText}`;
setStatus(
"This barcode wasn't found in Open Food Facts last time it was scanned. Fill in the item details manually."
);
}
return;
}

scannerMessage.textContent = "Looking up product data...";
setStatus("Barcode scanned. Looking up external product data...");

try {
const productData = await lookupProductByBarcode(decodedText);
setCachedBarcodeLookup(decodedText, productData);

if (productData !== null) {
applyLookupToForm(productData);

scannerMessage.textContent =
productData.name !== ""
? `External match: ${productData.name}`
: `External match for barcode ${decodedText}`;

setStatus("External product match found. Review the autofill and save.");
return;
}

scannerMessage.textContent = `New barcode ready: ${decodedText}`;
setStatus(
"Barcode not found in Open Food Facts. Fill in the item details manually."
);
} catch (error) {
scannerMessage.textContent = `New barcode ready: ${decodedText}`;
setStatus(
"Barcode scanned, but external lookup failed. Fill in the item details manually."
);
}
}

async function stopScanner(autoStopped) {
if (!html5QrCode) {
scannerRunning = false;
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
readerWrapper.classList.add("hidden");

if (autoStopped) {
scannerMessage.textContent = `Barcode ready for next save: ${pendingBarcode}`;
} else {
scannerMessage.textContent = "Scanner stopped.";
setStatus("Scanner stopped.");
}

return;
}

try {
if (scannerRunning) {
await html5QrCode.stop();
}
} catch (error) {
// Ignore stop errors and continue cleanup.
}

try {
html5QrCode.clear();
} catch (error) {
// Ignore clear errors during cleanup.
}

html5QrCode = null;
scannerRunning = false;
scanLock = false;
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
readerWrapper.classList.add("hidden");

if (autoStopped) {
scannerMessage.textContent = `Barcode ready for next save: ${pendingBarcode}`;
} else {
scannerMessage.textContent = "Scanner stopped.";
setStatus("Scanner stopped.");
}
}

function getScannerStartErrorMessage(error) {
const name =
  error && typeof error.name === "string" ? error.name : "";
const message =
  error && typeof error.message === "string"
    ? error.message
    : String(error || "");
const combined = `${name} ${message}`;

if (combined.includes("NotAllowedError") || combined.includes("Permission denied")) {
  return "Camera permission was denied. Check the site permission (tap the lock/info icon in the address bar) and your phone's app-level camera permission for this browser.";
}

if (combined.includes("NotFoundError") || combined.includes("Requested device not found")) {
  return "No usable camera was found on this device.";
}

if (combined.includes("NotReadableError") || combined.includes("Could not start video source")) {
  return "Camera is busy or blocked by another app. Close other apps/tabs using the camera and try again.";
}

if (combined.includes("OverconstrainedError")) {
  return "No camera matched the requested settings (back camera). Try a different device.";
}

if (combined.trim()) {
  return `Could not start the scanner: ${combined.trim()}`;
}

return "Could not start the scanner.";
}

async function lookupProductByBarcode(barcode) {
  const fields = [
    "product_name",
    "product_name_en",
    "brands",
    "quantity",
    "categories_tags",
    "nutrition_grades",
    "nutriments"
  ].join(",");

  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
    `?fields=${encodeURIComponent(fields)}`;

  const response = await fetch(url);

  if (response.status === 404) {
    // Open Food Facts uses 404 for "no product with this barcode",
    // which is a normal, expected outcome — not a lookup failure.
    return null;
  }

  if (!response.ok) {
    throw new Error(`Lookup failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data || data.status !== 1 || !data.product) {
    return null;
  }

  const product = data.product;

  return {
    name: firstNonEmpty(
      normalizeText(product.product_name),
      normalizeText(product.product_name_en),
      ""
    ),
    brand: normalizeText(product.brands),
    packageQuantity: normalizeText(product.quantity),
    category: mapOffCategoryToAppCategory(product.categories_tags),
    nutriScore: normalizeNutriScore(product.nutrition_grades),
    nutrition: extractNutritionFromOffProduct(product)
  };
}

function applyLookupToForm(productData) {
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

  pendingNutrition = normalizeNutrition(productData.nutrition);
  syncNutritionInputsFromPending();
}

function buildLookupNote(productData) {
const lines = [];

if (productData.brand !== "") {
lines.push(`Brand: ${productData.brand}`);
}

if (productData.packageQuantity !== "") {
lines.push(`Pack size: ${productData.packageQuantity}`);
}

if (productData.nutriScore !== "") {
lines.push(`Nutri-Score: ${productData.nutriScore.toUpperCase()}`);
}

return lines.join("\n");
}

function mapOffCategoryToAppCategory(categoriesTags) {
if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) {
return "";
}

const text = categoriesTags.join(" ").toLowerCase();

if (
text.includes("en:fruits") ||
text.includes("en:vegetables") ||
text.includes("en:fresh-vegetables") ||
text.includes("en:fresh-fruits") ||
text.includes("en:produce")
) {
return "Produce";
}

if (
text.includes("en:milk") ||
text.includes("en:cheeses") ||
text.includes("en:yogurts") ||
text.includes("en:butter") ||
text.includes("en:cream") ||
text.includes("en:dairy")
) {
return "Dairy";
}

if (
text.includes("en:frozen-foods") ||
text.includes("en:frozen-pizzas") ||
text.includes("en:frozen-desserts") ||
text.includes("en:ice-creams")
) {
return "Frozen";
}

if (
text.includes("en:beverages") ||
text.includes("en:drinks") ||
text.includes("en:waters") ||
text.includes("en:juices") ||
text.includes("en:sodas") ||
text.includes("en:soft-drinks") ||
text.includes("en:teas") ||
text.includes("en:coffees") ||
text.includes("en:energy-drinks")
) {
return "Drinks";
}

return "Pantry";
}

function normalizeNutriScore(value) {
if (typeof value !== "string") {
return "";
}

const trimmed = value.trim().toLowerCase();

if (["a", "b", "c", "d", "e"].includes(trimmed)) {
return trimmed;
}

return "";
}

function normalizeText(value) {
return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
for (const value of values) {
if (typeof value === "string" && value.trim() !== "") {
return value.trim();
}
}

return "";
}

function createEmptyNutrition() {
  return {
    kcal100g: null,
    protein100g: null,
    carbs100g: null,
    fat100g: null
  };
}

function normalizeNutrition(value) {
  if (typeof value !== "object" || value === null) {
    return createEmptyNutrition();
  }

  return {
    kcal100g: normalizeNutritionNumber(value.kcal100g),
    protein100g: normalizeNutritionNumber(value.protein100g),
    carbs100g: normalizeNutritionNumber(value.carbs100g),
    fat100g: normalizeNutritionNumber(value.fat100g)
  };
}

function normalizeNutritionNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function extractNutritionFromOffProduct(product) {
  const nutriments =
    product &&
    typeof product === "object" &&
    product.nutriments &&
    typeof product.nutriments === "object"
      ? product.nutriments
      : {};

  return normalizeNutrition({
    kcal100g: pickFirstNumber(
      nutriments["energy-kcal_100g"],
      nutriments["energy-kcal"]
    ),
    protein100g: pickFirstNumber(nutriments.proteins_100g),
    carbs100g: pickFirstNumber(nutriments.carbohydrates_100g),
    fat100g: pickFirstNumber(nutriments.fat_100g)
  });
}

function pickFirstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}

function formatNutritionSummary(nutrition) {
  const data = normalizeNutrition(nutrition);
  const parts = [];

  if (data.kcal100g !== null) {
    parts.push(`${formatNutritionValue(data.kcal100g)} kcal`);
  }

  if (data.protein100g !== null) {
    parts.push(`P ${formatNutritionValue(data.protein100g)}g`);
  }

  if (data.carbs100g !== null) {
    parts.push(`C ${formatNutritionValue(data.carbs100g)}g`);
  }

  if (data.fat100g !== null) {
    parts.push(`F ${formatNutritionValue(data.fat100g)}g`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `Per 100g: ${parts.join(" · ")}`;
}

function formatNutritionValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Math.round(value * 10) / 10);
}

function syncNutritionInputsFromPending() {
  const nutrition = normalizeNutrition(pendingNutrition);

  nutritionKcalInput.value = formatNutritionInputValue(nutrition.kcal100g);
  nutritionProteinInput.value = formatNutritionInputValue(nutrition.protein100g);
  nutritionCarbsInput.value = formatNutritionInputValue(nutrition.carbs100g);
  nutritionFatInput.value = formatNutritionInputValue(nutrition.fat100g);
}

function readNutritionFromInputs() {
  return normalizeNutrition({
    kcal100g: parseOptionalNumberInput(nutritionKcalInput.value),
    protein100g: parseOptionalNumberInput(nutritionProteinInput.value),
    carbs100g: parseOptionalNumberInput(nutritionCarbsInput.value),
    fat100g: parseOptionalNumberInput(nutritionFatInput.value)
  });
}

function parseOptionalNumberInput(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (trimmed === "") {
    return null;
  }

  const numberValue = Number(trimmed);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function formatNutritionInputValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Math.round(value * 10) / 10);
}

function formatNutritionTotalSummary(nutrition, amountGrams) {
  if (typeof amountGrams !== "number" || !Number.isFinite(amountGrams) || amountGrams <= 0) {
    return "";
  }

  const data = normalizeNutrition(nutrition);
  const factor = amountGrams / 100;
  const parts = [];

  if (data.kcal100g !== null) {
    parts.push(`${formatNutritionValue(data.kcal100g * factor)} kcal`);
  }

  if (data.protein100g !== null) {
    parts.push(`P ${formatNutritionValue(data.protein100g * factor)}g`);
  }

  if (data.carbs100g !== null) {
    parts.push(`C ${formatNutritionValue(data.carbs100g * factor)}g`);
  }

  if (data.fat100g !== null) {
    parts.push(`F ${formatNutritionValue(data.fat100g * factor)}g`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `For ${formatNutritionValue(amountGrams)}g: ${parts.join(" · ")}`;
}

function renderRecipeItemOptions() {
  const previousValue = recipeItemSelect.value;

  recipeItemSelect.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select an item";
  recipeItemSelect.appendChild(placeholderOption);

  items.forEach((item, index) => {
    if (!hasAnyNutrition(item.nutrition)) {
      return;
    }

    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = item.name;
    recipeItemSelect.appendChild(option);
  });

  const stillExists = Array.from(recipeItemSelect.options).some((option) => {
    return option.value === previousValue;
  });

  recipeItemSelect.value = stillExists ? previousValue : "";
}

function addRecipeIngredient() {
  const selectedIndexRaw = recipeItemSelect.value;
  const grams = parseOptionalNumberInput(recipeGramsInput.value);

  if (selectedIndexRaw === "") {
    setStatus("Select an item for the recipe first.");
    return;
  }

  if (grams === null || grams <= 0) {
    setStatus("Recipe grams must be greater than 0.");
    return;
  }

  const selectedIndex = Number(selectedIndexRaw);
  const item = items[selectedIndex];

  if (!item) {
    setStatus("Selected recipe item no longer exists.");
    renderRecipeItemOptions();
    return;
  }

  if (!hasAnyNutrition(item.nutrition)) {
    setStatus(`"${item.name}" has no nutrition data yet.`);
    return;
  }

  recipeIngredients.push({
    name: item.name,
    grams,
    nutrition: normalizeNutrition(item.nutrition)
  });

  recipeGramsInput.value = "";
  renderRecipeBuilder();
  setStatus(`Added "${item.name}" to the recipe.`);
}

function clearRecipeIngredients() {
  const hasAnything =
    recipeIngredients.length > 0 ||
    recipeNameInput.value.trim() !== "" ||
    recipeServingsInput.value.trim() !== "";

  if (!hasAnything) {
    setStatus("There is no recipe to clear.");
    return;
  }

  resetRecipeBuilder();
  setStatus("Recipe builder cleared.");
}

function removeRecipeIngredient(index) {
  if (!recipeIngredients[index]) {
    return;
  }

  const removedName = recipeIngredients[index].name;
  recipeIngredients.splice(index, 1);
  renderRecipeBuilder();
  setStatus(`Removed "${removedName}" from the recipe.`);
}

function renderRecipeBuilder() {
  recipeIngredientsList.innerHTML = "";

  if (recipeIngredients.length === 0) {
    recipeEmptyMessage.style.display = "block";
    recipeTotals.textContent = "";
    recipeWeightTotals.textContent = "";
    recipePer100gTotals.textContent = "";
    recipePerServingTotals.textContent = "";
    return;
  }

  recipeEmptyMessage.style.display = "none";

  recipeIngredients.forEach((ingredient, index) => {
    const li = document.createElement("li");

    const infoWrap = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = ingredient.name;

    const gramsSpan = document.createElement("span");
    gramsSpan.className = "item-meta";
    gramsSpan.textContent = `${formatNutritionValue(ingredient.grams)}g`;

    const totalsSpan = document.createElement("span");
    totalsSpan.className = "item-meta";
    totalsSpan.textContent = formatNutritionTotalSummary(
      ingredient.nutrition,
      ingredient.grams
    );

    infoWrap.appendChild(nameSpan);
    infoWrap.appendChild(gramsSpan);
    infoWrap.appendChild(totalsSpan);

    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      removeRecipeIngredient(index);
    });

    li.appendChild(infoWrap);
    li.appendChild(removeButton);
    recipeIngredientsList.appendChild(li);
  });

  recipeTotals.textContent = buildRecipeTotalsSummary();
  recipeWeightTotals.textContent = buildRecipeWeightSummary();
  recipePer100gTotals.textContent = buildRecipePer100gSummary();
  recipePerServingTotals.textContent = buildRecipePerServingSummary();
}

function buildRecipeTotalsSummary() {
  const summary = buildRecipeTotalsSummaryFromIngredients(recipeIngredients);

  if (summary === "") {
    return "";
  }

  return `Recipe total: ${summary}`;
}

function hasAnyNutrition(nutrition) {
  const data = normalizeNutrition(nutrition);

  return (
    data.kcal100g !== null ||
    data.protein100g !== null ||
    data.carbs100g !== null ||
    data.fat100g !== null
  );
}

function saveCurrentRecipe() {
  const recipeName = recipeNameInput.value.trim();
  const servings = parseOptionalNumberInput(recipeServingsInput.value);

  if (recipeName === "") {
    setStatus("Type a recipe name first.");
    return;
  }

  if (recipeIngredients.length === 0) {
    setStatus("Add at least one ingredient before saving the recipe.");
    return;
  }

  if (servings === null || servings <= 0) {
    setStatus("Servings must be greater than 0.");
    return;
  }

  const recipeData = {
  name: recipeName,
  servings,
  servingLabel: recipeServingLabelInput.value.trim(),
  ingredients: recipeIngredients.map((ingredient) => {
      return {
        name: ingredient.name,
        grams: ingredient.grams,
        nutrition: normalizeNutrition(ingredient.nutrition)
      };
    })
  };

  const existingIndex = savedRecipes.findIndex((recipe) => {
    return recipe.name.toLowerCase() === recipeName.toLowerCase();
  });

  if (editingSavedRecipeIndex === null) {
    if (existingIndex !== -1) {
      setStatus("A saved recipe already uses that name. Load it to edit, or rename this one.");
      return;
    }

    savedRecipes.push(recipeData);
    editingSavedRecipeIndex = savedRecipes.length - 1;
    setStatus(`Saved recipe "${recipeName}".`);
  } else {
    if (existingIndex !== -1 && existingIndex !== editingSavedRecipeIndex) {
      setStatus("Another saved recipe already uses that name. Rename this recipe or duplicate it.");
      return;
    }

    savedRecipes[editingSavedRecipeIndex] = recipeData;
    setStatus(`Updated recipe "${recipeName}".`);
  }

  saveRecipes();
  renderSavedRecipes();
  updateRecipeEditorMode();
}

function renderSavedRecipes() {
  savedRecipesList.innerHTML = "";

  if (savedRecipes.length === 0) {
    savedRecipesEmptyMessage.style.display = "block";
    return;
  }

  savedRecipesEmptyMessage.style.display = "none";

  savedRecipes.forEach((recipe, index) => {
    const li = document.createElement("li");

    const infoWrap = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = recipe.name;

const ingredientCountSpan = document.createElement("span");
ingredientCountSpan.className = "item-meta";
ingredientCountSpan.textContent =
  `${recipe.ingredients.length} ingredient(s) · ${formatRecipeServingsLabel(recipe.servings || 1, recipe.servingLabel)}`;

const totalsSpan = document.createElement("span");
totalsSpan.className = "item-meta";
totalsSpan.textContent = `Total: ${buildRecipeTotalsSummaryFromIngredients(recipe.ingredients)}`;

const weightSpan = document.createElement("span");
weightSpan.className = "item-meta";
weightSpan.textContent = buildRecipeWeightSummaryFromIngredients(recipe.ingredients);

const per100gSpan = document.createElement("span");
per100gSpan.className = "item-meta";
per100gSpan.textContent = buildRecipePer100gSummaryFromIngredients(recipe.ingredients);

const perServingSpan = document.createElement("span");
perServingSpan.className = "item-meta";
perServingSpan.textContent = buildRecipePerServingDisplayFromIngredients(
  recipe.ingredients,
  recipe.servings || 1,
  recipe.servingLabel || ""
);

infoWrap.appendChild(nameSpan);
infoWrap.appendChild(ingredientCountSpan);
infoWrap.appendChild(totalsSpan);
infoWrap.appendChild(weightSpan);
infoWrap.appendChild(per100gSpan);
infoWrap.appendChild(perServingSpan);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const loadButton = document.createElement("button");
    loadButton.className = "edit-button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => {
      loadSavedRecipe(index);
      switchTab("recipes");
    });

    const deleteRecipeButton = document.createElement("button");
    deleteRecipeButton.className = "delete-button";
    deleteRecipeButton.textContent = "Delete";
    deleteRecipeButton.addEventListener("click", () => {
      deleteSavedRecipe(index);
    });

    actions.appendChild(loadButton);
    actions.appendChild(deleteRecipeButton);

    li.appendChild(infoWrap);
    li.appendChild(actions);
    savedRecipesList.appendChild(li);
  });
}

function loadSavedRecipe(index) {
  const recipe = savedRecipes[index];

  if (!recipe) {
    return;
  }

  editingSavedRecipeIndex = index;
  recipeNameInput.value = recipe.name;
  recipeServingsInput.value = formatNutritionValue(
    typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : 1
  );
  recipeServingLabelInput.value =
  typeof recipe.servingLabel === "string" ? recipe.servingLabel : "";
  

  recipeIngredients = recipe.ingredients.map((ingredient) => {
    return {
      name: ingredient.name,
      grams: ingredient.grams,
      nutrition: normalizeNutrition(ingredient.nutrition)
    };
  });

  renderRecipeBuilder();
  renderSavedRecipes();
  updateRecipeEditorMode();
  setStatus(`Loaded recipe "${recipe.name}" for editing.`);
}

function deleteSavedRecipe(index) {
  const recipe = savedRecipes[index];

  if (!recipe) {
    return;
  }

  const removedName = recipe.name;
  savedRecipes.splice(index, 1);

  if (editingSavedRecipeIndex === index) {
    resetRecipeBuilder();
  } else if (
    editingSavedRecipeIndex !== null &&
    index < editingSavedRecipeIndex
  ) {
    editingSavedRecipeIndex -= 1;
  }

  saveRecipes();
  renderSavedRecipes();
  updateRecipeEditorMode();
  setStatus(`Deleted recipe "${removedName}".`);
}

function saveRecipes() {
  localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(savedRecipes));
}

function loadRecipes() {
  const savedValue = localStorage.getItem(RECIPE_STORAGE_KEY);

  if (!savedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((recipe) => {
        if (typeof recipe !== "object" || recipe === null) {
          return null;
        }

        const name = typeof recipe.name === "string" ? recipe.name.trim() : "";

        if (name === "" || !Array.isArray(recipe.ingredients)) {
          return null;
        }

        const servings = parseOptionalNumberInput(String(recipe.servings ?? "1")) || 1;

        const ingredients = recipe.ingredients
          .map((ingredient) => {
            if (typeof ingredient !== "object" || ingredient === null) {
              return null;
            }

            const ingredientName =
              typeof ingredient.name === "string" ? ingredient.name.trim() : "";

            if (ingredientName === "") {
              return null;
            }

            const grams = parseOptionalNumberInput(String(ingredient.grams));

            if (grams === null || grams <= 0) {
              return null;
            }

            return {
              name: ingredientName,
              grams,
              nutrition: normalizeNutrition(ingredient.nutrition)
            };
          })
          .filter(Boolean);

        return {
  name,
  servings,
  servingLabel:
    typeof recipe.servingLabel === "string" ? recipe.servingLabel : "",
  ingredients
};
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function buildRecipeTotalsSummaryFromIngredients(ingredients) {
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let hasAny = false;

  ingredients.forEach((ingredient) => {
    const nutrition = normalizeNutrition(ingredient.nutrition);
    const factor = ingredient.grams / 100;

    if (nutrition.kcal100g !== null) {
      totalKcal += nutrition.kcal100g * factor;
      hasAny = true;
    }

    if (nutrition.protein100g !== null) {
      totalProtein += nutrition.protein100g * factor;
      hasAny = true;
    }

    if (nutrition.carbs100g !== null) {
      totalCarbs += nutrition.carbs100g * factor;
      hasAny = true;
    }

    if (nutrition.fat100g !== null) {
      totalFat += nutrition.fat100g * factor;
      hasAny = true;
    }
  });

  if (!hasAny) {
    return "";
  }

  return (
    `${formatNutritionValue(totalKcal)} kcal · ` +
    `P ${formatNutritionValue(totalProtein)}g · ` +
    `C ${formatNutritionValue(totalCarbs)}g · ` +
    `F ${formatNutritionValue(totalFat)}g`
  );
}

function buildRecipePerServingSummary() {
  const servings = parseOptionalNumberInput(recipeServingsInput.value);

  if (servings === null || servings <= 0) {
    return "";
  }

  return buildRecipePerServingDisplayFromIngredients(
    recipeIngredients,
    servings,
    recipeServingLabelInput.value.trim()
  );
}

function buildRecipePerServingSummaryFromIngredients(ingredients, servings) {
  if (typeof servings !== "number" || !Number.isFinite(servings) || servings <= 0) {
    return "";
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let hasAny = false;

  ingredients.forEach((ingredient) => {
    const nutrition = normalizeNutrition(ingredient.nutrition);
    const factor = ingredient.grams / 100;

    if (nutrition.kcal100g !== null) {
      totalKcal += nutrition.kcal100g * factor;
      hasAny = true;
    }

    if (nutrition.protein100g !== null) {
      totalProtein += nutrition.protein100g * factor;
      hasAny = true;
    }

    if (nutrition.carbs100g !== null) {
      totalCarbs += nutrition.carbs100g * factor;
      hasAny = true;
    }

    if (nutrition.fat100g !== null) {
      totalFat += nutrition.fat100g * factor;
      hasAny = true;
    }
  });

  if (!hasAny) {
    return "";
  }

  return (
    `${formatNutritionValue(totalKcal / servings)} kcal · ` +
    `P ${formatNutritionValue(totalProtein / servings)}g · ` +
    `C ${formatNutritionValue(totalCarbs / servings)}g · ` +
    `F ${formatNutritionValue(totalFat / servings)}g`
  );
}
function updateRecipeEditorMode() {
  if (editingSavedRecipeIndex === null) {
    recipeEditorModeText.textContent = "Creating a new recipe.";
    saveRecipeButton.textContent = "Save recipe";
    duplicateRecipeButton.classList.add("hidden");
    cancelRecipeEditButton.classList.add("hidden");
  } else {
    recipeEditorModeText.textContent = "Editing a saved recipe.";
    saveRecipeButton.textContent = "Save changes";
    duplicateRecipeButton.classList.remove("hidden");
    cancelRecipeEditButton.classList.remove("hidden");
  }
}

function resetRecipeBuilder() {
  recipeNameInput.value = "";
  recipeServingsInput.value = "1";
  recipeServingLabelInput.value = "";
  recipeItemSelect.value = "";
  recipeGramsInput.value = "";
  recipeIngredients = [];
  editingSavedRecipeIndex = null;

  renderRecipeBuilder();
  renderSavedRecipes();
  updateRecipeEditorMode();
}

function cancelRecipeEdit() {
  if (editingSavedRecipeIndex === null) {
    setStatus("No saved recipe is being edited.");
    return;
  }

  resetRecipeBuilder();
  setStatus("Recipe edit cancelled.");
}

function duplicateCurrentRecipe() {
  if (recipeIngredients.length === 0) {
    setStatus("There is no recipe to duplicate.");
    return;
  }

  editingSavedRecipeIndex = null;
  recipeNameInput.value = makeRecipeCopyName(recipeNameInput.value);
  updateRecipeEditorMode();
  setStatus("Recipe duplicated into a new unsaved copy.");
}

function makeRecipeCopyName(baseName) {
  const trimmed = typeof baseName === "string" ? baseName.trim() : "";
  const base = trimmed === "" ? "Recipe" : trimmed;

  let candidate = `${base} Copy`;
  let counter = 2;

  while (
    savedRecipes.some((recipe) => recipe.name.toLowerCase() === candidate.toLowerCase())
  ) {
    candidate = `${base} Copy ${counter}`;
    counter += 1;
  }

  return candidate;
}
  function buildRecipeWeightSummary() {
  return buildRecipeWeightSummaryFromIngredients(recipeIngredients);
}

function buildRecipeWeightSummaryFromIngredients(ingredients) {
  const totalWeight = ingredients.reduce((sum, ingredient) => {
    return sum + ingredient.grams;
  }, 0);

  if (totalWeight <= 0) {
    return "";
  }

  return `Total weight: ${formatNutritionValue(totalWeight)}g`;
}

function buildRecipePer100gSummary() {
  return buildRecipePer100gSummaryFromIngredients(recipeIngredients);
}

function buildRecipePer100gSummaryFromIngredients(ingredients) {
  const totalWeight = ingredients.reduce((sum, ingredient) => {
    return sum + ingredient.grams;
  }, 0);

  if (totalWeight <= 0) {
    return "";
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let hasAny = false;

  ingredients.forEach((ingredient) => {
    const nutrition = normalizeNutrition(ingredient.nutrition);
    const factor = ingredient.grams / 100;

    if (nutrition.kcal100g !== null) {
      totalKcal += nutrition.kcal100g * factor;
      hasAny = true;
    }

    if (nutrition.protein100g !== null) {
      totalProtein += nutrition.protein100g * factor;
      hasAny = true;
    }

    if (nutrition.carbs100g !== null) {
      totalCarbs += nutrition.carbs100g * factor;
      hasAny = true;
    }

    if (nutrition.fat100g !== null) {
      totalFat += nutrition.fat100g * factor;
      hasAny = true;
    }
  });

  if (!hasAny) {
    return "";
  }

  const factorTo100g = 100 / totalWeight;

  return (
    `Per 100g: ` +
    `${formatNutritionValue(totalKcal * factorTo100g)} kcal · ` +
    `P ${formatNutritionValue(totalProtein * factorTo100g)}g · ` +
    `C ${formatNutritionValue(totalCarbs * factorTo100g)}g · ` +
    `F ${formatNutritionValue(totalFat * factorTo100g)}g`
  );
}

function buildRecipePerServingDisplayFromIngredients(ingredients, servings, servingLabel) {
  const summary = buildRecipePerServingSummaryFromIngredients(ingredients, servings);

  if (summary === "") {
    return "";
  }

  const label = typeof servingLabel === "string" ? servingLabel.trim() : "";

  if (label === "") {
    return `Per serving: ${summary}`;
  }

  return `Per ${label}: ${summary}`;
}

function formatRecipeServingsLabel(servings, servingLabel) {
  const label = typeof servingLabel === "string" ? servingLabel.trim() : "";
  const servingCount = formatNutritionValue(servings);

  if (label === "") {
    return `${servingCount} serving(s)`;
  }

  return `${servingCount} ${label}(s)`;
}
function moveItemToStock(index) {
  const item = items[index];

  if (!item) {
    return;
  }

  if (!item.bought) {
    setStatus("Only bought items can be moved to stock.");
    return;
  }

  const stockIndex = findMatchingStockIndex(item);

  if (stockIndex === null) {
    stockItems.push(createStockItemFromShoppingItem(item));
  } else {
    stockItems[stockIndex] = mergeStockItems(stockItems[stockIndex], item);
  }

  const movedName = item.name;
  items.splice(index, 1);

  if (editIndex === index) {
    resetForm();
  } else if (editIndex !== null && index < editIndex) {
    editIndex -= 1;
    updateFormMode();
  }

  saveItems();
  saveStockItems();
  renderList();
  renderStockList();
  setStatus(`Moved "${movedName}" to pantry stock.`);
}

function createStockItemFromShoppingItem(item) {
  return {
    name: typeof item.name === "string" ? item.name : "",
    quantity:
      typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
        ? item.quantity
        : null,
    unit: typeof item.unit === "string" ? item.unit : "",
    category: typeof item.category === "string" ? item.category : "",
    note: typeof item.note === "string" ? item.note : "",
    barcode: typeof item.barcode === "string" ? item.barcode : "",
    nutrition: normalizeNutrition(item.nutrition),
    nutritionAmount: normalizeNutritionNumber(item.nutritionAmount)
  };
}

function findMatchingStockIndex(item) {
  if (typeof item.barcode === "string" && item.barcode.trim() !== "") {
    const barcode = item.barcode.trim();

    const barcodeIndex = stockItems.findIndex((stockItem) => {
      return typeof stockItem.barcode === "string" && stockItem.barcode.trim() === barcode;
    });

    if (barcodeIndex !== -1) {
      return barcodeIndex;
    }
  }

  const name = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
  const unit = typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";
  const category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "";

  const index = stockItems.findIndex((stockItem) => {
    const stockName =
      typeof stockItem.name === "string" ? stockItem.name.trim().toLowerCase() : "";
    const stockUnit =
      typeof stockItem.unit === "string" ? stockItem.unit.trim().toLowerCase() : "";
    const stockCategory =
      typeof stockItem.category === "string"
        ? stockItem.category.trim().toLowerCase()
        : "";

    return stockName === name && stockUnit === unit && stockCategory === category;
  });

  return index === -1 ? null : index;
}

function mergeStockItems(existingItem, incomingItem) {
  const merged = {
    ...existingItem
  };

  if (
    typeof merged.quantity === "number" &&
    Number.isFinite(merged.quantity) &&
    merged.quantity > 0 &&
    typeof incomingItem.quantity === "number" &&
    Number.isFinite(incomingItem.quantity) &&
    incomingItem.quantity > 0 &&
    merged.unit === incomingItem.unit
  ) {
    merged.quantity += incomingItem.quantity;
  } else if (
    (merged.quantity === null || typeof merged.quantity !== "number") &&
    typeof incomingItem.quantity === "number" &&
    Number.isFinite(incomingItem.quantity) &&
    incomingItem.quantity > 0
  ) {
    merged.quantity = incomingItem.quantity;
  }

  if (
    (typeof merged.note !== "string" || merged.note.trim() === "") &&
    typeof incomingItem.note === "string"
  ) {
    merged.note = incomingItem.note;
  }

  if (
    (!hasAnyNutrition(merged.nutrition)) &&
    hasAnyNutrition(incomingItem.nutrition)
  ) {
    merged.nutrition = normalizeNutrition(incomingItem.nutrition);
  }

  if (
    normalizeNutritionNumber(merged.nutritionAmount) === null &&
    normalizeNutritionNumber(incomingItem.nutritionAmount) !== null
  ) {
    merged.nutritionAmount = normalizeNutritionNumber(incomingItem.nutritionAmount);
  }

  return merged;
}

function getQuantityStep(unit) {
  const normalized = typeof unit === "string" ? unit.trim().toLowerCase() : "";

  if (normalized === "g" || normalized === "ml") {
    return 50;
  }

  if (normalized === "kg" || normalized === "l") {
    return 0.1;
  }

  // Countable units (pcs, pack, bottle, can) and anything unrecognised.
  return 1;
}

function adjustStockQuantity(index, delta) {
  const item = stockItems[index];
  if (!item) {
    return;
  }

  const current =
    typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? item.quantity
      : 0;

  setStockQuantity(index, current + delta);
}

function setStockQuantity(index, rawValue) {
  const item = stockItems[index];
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

function renderStockList() {
  updateTabBadges();
  renderNutritionStatistics();
  stockList.innerHTML = "";

  if (stockItems.length === 0) {
    stockEmptyMessage.style.display = "block";
    return;
  }

  stockEmptyMessage.style.display = "none";

  stockItems.forEach((item, index) => {
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

    const nutritionTotalSummary = formatNutritionTotalSummary(
      item.nutrition,
      item.nutritionAmount
    );
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
  deleteStockItem(index);
});

actions.appendChild(returnButton);

    li.appendChild(infoWrap);
    li.appendChild(actions);
    stockList.appendChild(li);
  });
}

function deleteStockItem(index) {
  const item = stockItems[index];

  if (!item) {
    return;
  }

  const returnedName = item.name;

  items.push({
    name: typeof item.name === "string" ? item.name : "",
    quantity:
      typeof item.quantity === "number" &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
        ? item.quantity
        : null,
    unit: typeof item.unit === "string" ? item.unit : "",
    category: typeof item.category === "string" ? item.category : "",
    note: typeof item.note === "string" ? item.note : "",
    barcode: typeof item.barcode === "string" ? item.barcode : "",
    nutrition: normalizeNutrition(item.nutrition),
    nutritionAmount: normalizeNutritionNumber(item.nutritionAmount),
    bought: false
  });

  stockItems.splice(index, 1);

  saveItems();
  saveStockItems();
  renderList();
  renderStockList();
  setStatus(`Returned "${returnedName}" to the shopping list.`);
}
function clearStockItems() {
  if (stockItems.length === 0) {
    setStatus("There is no pantry stock to clear.");
    return;
  }

  stockItems = [];
  saveStockItems();
  renderStockList();
  setStatus("Pantry stock cleared.");
}

function saveBarcodeCache(cache) {
  try {
    localStorage.setItem(BARCODE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    // Storage can fail (quota exceeded, private browsing, etc).
    // The cache is a pure optimization, so silently skip saving on failure.
  }
}

function loadBarcodeCache() {
  const saved = localStorage.getItem(BARCODE_CACHE_STORAGE_KEY);

  if (!saved) {
    return {};
  }

  try {
    const parsed = JSON.parse(saved);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function getCachedBarcodeLookup(barcode) {
  const entry = barcodeCache[barcode];

  if (!entry) {
    return undefined;
  }

  if (entry.found === false && typeof entry.cachedAt === "number") {
    const age = Date.now() - entry.cachedAt;
    if (age > BARCODE_CACHE_NOT_FOUND_TTL_MS) {
      delete barcodeCache[barcode];
      saveBarcodeCache(barcodeCache);
      return undefined;
    }
  }

  return entry.found ? entry.data : null;
}

function setCachedBarcodeLookup(barcode, productData) {
  barcodeCache[barcode] = {
    found: productData !== null,
    data: productData,
    cachedAt: Date.now()
  };

  const keys = Object.keys(barcodeCache);
  if (keys.length > BARCODE_CACHE_MAX_ENTRIES) {
    // Simple bound so the cache can't grow forever: drop the oldest entries.
    keys
      .sort((a, b) => (barcodeCache[a].cachedAt || 0) - (barcodeCache[b].cachedAt || 0))
      .slice(0, keys.length - BARCODE_CACHE_MAX_ENTRIES)
      .forEach((key) => delete barcodeCache[key]);
  }

  saveBarcodeCache(barcodeCache);
}

function saveStockItems() {
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(stockItems));
}

function loadStockItems() {
  const savedItems = localStorage.getItem(STOCK_STORAGE_KEY);

  if (!savedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(savedItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const name = typeof item.name === "string" ? item.name.trim() : "";

        if (name === "") {
          return null;
        }

        let quantity = null;
        if (
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
        ) {
          quantity = item.quantity;
        }

        return {
          name,
          quantity,
          unit: typeof item.unit === "string" ? item.unit : "",
          category: typeof item.category === "string" ? item.category : "",
          note: typeof item.note === "string" ? item.note : "",
          barcode: typeof item.barcode === "string" ? item.barcode : "",
          nutrition: normalizeNutrition(item.nutrition),
          nutritionAmount: normalizeNutritionNumber(item.nutritionAmount)
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function createShoppingItemFromStockItem(item) {
  return {
    name: typeof item.name === "string" ? item.name : "",
    quantity:
      typeof item.quantity === "number" &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
        ? item.quantity
        : null,
    unit: typeof item.unit === "string" ? item.unit : "",
    category: typeof item.category === "string" ? item.category : "",
    note: typeof item.note === "string" ? item.note : "",
    barcode: typeof item.barcode === "string" ? item.barcode : "",
    nutrition: normalizeNutrition(item.nutrition),
    nutritionAmount: normalizeNutritionNumber(item.nutritionAmount),
    bought: false
  };
}

function findMatchingShoppingIndexForStock(item) {
  if (typeof item.barcode === "string" && item.barcode.trim() !== "") {
    const barcode = item.barcode.trim();

    const barcodeIndex = items.findIndex((shoppingItem) => {
      return (
        typeof shoppingItem.barcode === "string" &&
        shoppingItem.barcode.trim() === barcode
      );
    });

    if (barcodeIndex !== -1) {
      return barcodeIndex;
    }
  }

  const name =
    typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
  const unit =
    typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";
  const category =
    typeof item.category === "string" ? item.category.trim().toLowerCase() : "";

  const index = items.findIndex((shoppingItem) => {
    const shoppingName =
      typeof shoppingItem.name === "string"
        ? shoppingItem.name.trim().toLowerCase()
        : "";
    const shoppingUnit =
      typeof shoppingItem.unit === "string"
        ? shoppingItem.unit.trim().toLowerCase()
        : "";
    const shoppingCategory =
      typeof shoppingItem.category === "string"
        ? shoppingItem.category.trim().toLowerCase()
        : "";

    return (
      shoppingName === name &&
      shoppingUnit === unit &&
      shoppingCategory === category
    );
  });

  return index === -1 ? null : index;
}

function mergeShoppingItems(existingItem, stockItem) {
  const merged = {
    ...existingItem
  };

  if (
    typeof merged.quantity === "number" &&
    Number.isFinite(merged.quantity) &&
    merged.quantity > 0 &&
    typeof stockItem.quantity === "number" &&
    Number.isFinite(stockItem.quantity) &&
    stockItem.quantity > 0 &&
    merged.unit === stockItem.unit
  ) {
    merged.quantity += stockItem.quantity;
  } else if (
    (merged.quantity === null || typeof merged.quantity !== "number") &&
    typeof stockItem.quantity === "number" &&
    Number.isFinite(stockItem.quantity) &&
    stockItem.quantity > 0
  ) {
    merged.quantity = stockItem.quantity;
  }

  if (
    (typeof merged.note !== "string" || merged.note.trim() === "") &&
    typeof stockItem.note === "string"
  ) {
    merged.note = stockItem.note;
  }

  if (
    !hasAnyNutrition(merged.nutrition) &&
    hasAnyNutrition(stockItem.nutrition)
  ) {
    merged.nutrition = normalizeNutrition(stockItem.nutrition);
  }

  if (
    normalizeNutritionNumber(merged.nutritionAmount) === null &&
    normalizeNutritionNumber(stockItem.nutritionAmount) !== null
  ) {
    merged.nutritionAmount = normalizeNutritionNumber(stockItem.nutritionAmount);
  }

  merged.bought = false;

  return merged;
}
  
function findItemIndexByBarcode(barcode) {
if (typeof barcode !== "string" || barcode.trim() === "") {
return null;
}

const normalizedBarcode = barcode.trim();

const index = items.findIndex((item) => {
return (
typeof item.barcode === "string" &&
item.barcode.trim() === normalizedBarcode
);
});

return index === -1 ? null : index;
}

function findDuplicateBarcodeIndex(barcode, ignoreIndex) {
const matchIndex = findItemIndexByBarcode(barcode);

if (matchIndex === null) {
return null;
}

if (ignoreIndex !== null && matchIndex === ignoreIndex) {
return null;
}

return matchIndex;
}

function toggleBought(index) {
items[index].bought = !items[index].bought;
saveItems();
renderList();

const stateText = items[index].bought ? "bought" : "not bought";
setStatus(`Marked "${items[index].name}" as ${stateText}.`);
}

function deleteItem(index) {
const removedItem = items[index].name;
items.splice(index, 1);

if (editIndex === index) {
resetForm();
} else if (editIndex !== null && index < editIndex) {
editIndex -= 1;
updateFormMode();
}

saveItems();
renderList();
setStatus(`Removed "${removedItem}".`);
}

function clearAllItems() {
if (items.length === 0) {
setStatus("There is nothing to clear.");
return;
}

items = [];
resetForm();
saveItems();
renderList();
setStatus("All items cleared.");
}


function renderList() {
updateTabBadges();
renderMacroStatBlock(items, listMacroChart, listMacroLegend, listMacroCoverage);
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

function getFilteredEntries() {
  const searchValue = searchInput.value.trim().toLowerCase();

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const searchText = [
        item.name,
        item.note,
        item.barcode
      ].join(" ").toLowerCase();

      return searchValue === "" || searchText.includes(searchValue);
    });
}

function createStatusSection(title, entries) {
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

wrapper.appendChild(
createCategoryBlock(getCategoryLabel(category), categoryEntries)
);
});

return wrapper;
}

function groupEntriesByCategory(entries) {
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

function createCategoryBlock(title, entries) {
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

const nutritionTotalSummary = formatNutritionTotalSummary(
  item.nutrition,
  item.nutritionAmount
);
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

function normalizeCategory(category) {
if (typeof category !== "string") {
return "";
}

const trimmed = category.trim();

if (CATEGORY_ORDER.includes(trimmed)) {
return trimmed;
}

return "";
}

function getCategoryLabel(category) {
const normalized = normalizeCategory(category);
return normalized === "" ? "Uncategorised" : normalized;
}

function buildMetaText(item) {
const hasQuantity = typeof item.quantity === "number" && item.quantity > 0;
const hasUnit = typeof item.unit === "string" && item.unit.trim() !== "";

if (hasQuantity && hasUnit) {
return `${formatQuantity(item.quantity)} ${item.unit}`;
}

if (hasQuantity) {
return `${formatQuantity(item.quantity)}`;
}

return "";
}

function formatQuantity(quantity) {
return String(quantity);
}

function saveItems() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadItems() {
  const savedItems = localStorage.getItem(STORAGE_KEY);

  if (!savedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(savedItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const name = typeof item.name === "string" ? item.name.trim() : "";

        if (name === "") {
          return null;
        }

        let quantity = null;
        if (
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
        ) {
          quantity = item.quantity;
        }

        return {
          name,
          quantity,
          unit: typeof item.unit === "string" ? item.unit : "",
          category: typeof item.category === "string" ? item.category : "",
          note: typeof item.note === "string" ? item.note : "",
          barcode: typeof item.barcode === "string" ? item.barcode : "",
          nutrition: normalizeNutrition(item.nutrition),
          nutritionAmount: normalizeNutritionNumber(item.nutritionAmount),
          bought: typeof item.bought === "boolean" ? item.bought : false
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

  function initTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        switchTab(button.dataset.tab);
      });
    });

    // Stop the camera automatically when leaving the scanner tab,
    // so it doesn't keep running (and draining battery) in the background.
    switchTab("scanner");
  }

  function switchTab(tabName) {
    const info = TAB_INFO[tabName] || TAB_INFO.scanner;

    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tabName);
    });

    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    pageTitle.textContent = info.title;
    pageSubtitle.textContent = info.subtitle;

    if (tabName !== "scanner" && scannerRunning) {
      void stopScanner(false);
    }

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function updateTabBadges() {
    const toBuyCount = items.filter((item) => !item.bought).length;
    setBadge(listTabBadge, toBuyCount);
    setBadge(pantryTabBadge, stockItems.length);
  }

  function setBadge(badgeEl, count) {
    if (count > 0) {
      badgeEl.textContent = count > 99 ? "99+" : String(count);
      badgeEl.classList.remove("hidden");
    } else {
      badgeEl.classList.add("hidden");
    }
  }

  function estimateItemGrams(item) {
    if (typeof item.nutritionAmount === "number" && item.nutritionAmount > 0) {
      return item.nutritionAmount;
    }

    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return null;
    }

    const unit = typeof item.unit === "string" ? item.unit.trim().toLowerCase() : "";

    if (unit === "g" || unit === "ml") {
      return item.quantity;
    }

    if (unit === "kg" || unit === "l") {
      return item.quantity * 1000;
    }

    // Countable units (pcs, pack, bottle, can) or no unit: we don't know
    // the gram weight, so this item can't be included in totals.
    return null;
  }

  function calculateMacroTotals(itemArray) {
    const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    let includedCount = 0;

    itemArray.forEach((item) => {
      const nutrition = item.nutrition;
      const hasAnyNutrition =
        nutrition &&
        (typeof nutrition.kcal100g === "number" ||
          typeof nutrition.protein100g === "number" ||
          typeof nutrition.carbs100g === "number" ||
          typeof nutrition.fat100g === "number");

      if (!hasAnyNutrition) {
        return;
      }

      const grams = estimateItemGrams(item);
      if (grams === null) {
        return;
      }

      const factor = grams / 100;
      totals.kcal += (nutrition.kcal100g || 0) * factor;
      totals.protein += (nutrition.protein100g || 0) * factor;
      totals.carbs += (nutrition.carbs100g || 0) * factor;
      totals.fat += (nutrition.fat100g || 0) * factor;
      includedCount++;
    });

    return {
      totals,
      includedCount,
      totalCount: itemArray.length
    };
  }

  function buildMacroDonutSvg(proteinKcal, carbsKcal, fatKcal) {
    const size = 140;
    const center = size / 2;
    const radius = 54;
    const strokeWidth = 22;
    const circumference = 2 * Math.PI * radius;

    const segments = [
      { kcal: proteinKcal, color: "#2e7d32" },
      { kcal: carbsKcal, color: "#f59e0b" },
      { kcal: fatKcal, color: "#dc2626" }
    ];

    const totalKcal = proteinKcal + carbsKcal + fatKcal;

    let cumulative = 0;
    const circles = segments
      .map((segment) => {
        if (segment.kcal <= 0 || totalKcal <= 0) {
          return "";
        }
        const fraction = segment.kcal / totalKcal;
        const dash = fraction * circumference;
        const gap = circumference - dash;
        const offset = -cumulative;
        cumulative += dash;
        return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}" />`;
      })
      .join("");

    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Macro breakdown pie chart">
      <g transform="rotate(-90 ${center} ${center})">${circles}</g>
    </svg>`;
  }

  function renderMacroStatBlock(itemArray, chartEl, legendEl, coverageEl) {
    const { totals, includedCount, totalCount } = calculateMacroTotals(itemArray);

    const proteinKcal = totals.protein * 4;
    const carbsKcal = totals.carbs * 4;
    const fatKcal = totals.fat * 9;
    const macroKcalTotal = proteinKcal + carbsKcal + fatKcal;

    if (macroKcalTotal <= 0) {
      chartEl.innerHTML = '<div class="macro-chart-empty">No nutrition data available yet</div>';
      legendEl.innerHTML = "";
      coverageEl.textContent =
        totalCount === 0
          ? ""
          : `0 of ${totalCount} item${totalCount === 1 ? "" : "s"} counted.`;
      return;
    }

    chartEl.innerHTML = buildMacroDonutSvg(proteinKcal, carbsKcal, fatKcal);

    const round1 = (value) => Math.round(value * 10) / 10;
    const pct = (kcal) => Math.round((kcal / macroKcalTotal) * 100);

    legendEl.innerHTML = "";

    const totalRow = document.createElement("div");
    totalRow.className = "macro-legend-total";
    totalRow.textContent = `${Math.round(totals.kcal)} kcal total`;
    legendEl.appendChild(totalRow);

    const rows = [
      { label: "Protein", value: totals.protein, color: "#2e7d32", kcal: proteinKcal },
      { label: "Carbs", value: totals.carbs, color: "#f59e0b", kcal: carbsKcal },
      { label: "Fat", value: totals.fat, color: "#dc2626", kcal: fatKcal }
    ];

    rows.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "macro-legend-row";

      const dot = document.createElement("span");
      dot.className = "macro-legend-dot";
      dot.style.background = row.color;

      const label = document.createElement("span");
      label.className = "macro-legend-label";
      label.textContent = row.label;

      const value = document.createElement("span");
      value.className = "macro-legend-value";
      value.textContent = `${round1(row.value)}g (${pct(row.kcal)}%)`;

      rowEl.appendChild(dot);
      rowEl.appendChild(label);
      rowEl.appendChild(value);
      legendEl.appendChild(rowEl);
    });

    coverageEl.textContent = `Based on ${includedCount} of ${totalCount} item${totalCount === 1 ? "" : "s"} with known amount and nutrition data.`;
  }

  function renderNutritionStatistics() {
    renderMacroStatBlock(stockItems, pantryMacroChart, pantryMacroLegend, pantryMacroCoverage);
    renderMacroStatBlock(items, listMacroChart, listMacroLegend, listMacroCoverage);
  }

  function setStatus(message) {
    statusEl.textContent = message;
}
});
