// "Add food" on the Today tab, the one way to log food by hand: re-log a recent food, search your pantry,
// NEVO and Open Food Facts, scan a barcode, or type the values of a portion (e.g. a meal eaten out).
// A pantry item can also be taken from the pantry (the same conversion as "Cook this").
import {
  cameraUnavailableMessage,
  createCamera,
  getScannerStartErrorMessage,
  startCamera,
  stopCamera
} from "./camera.js";
import { takeFromPantry } from "./cook-dialog.js";
import { gramsToStockUnit } from "./cooking.js";
import { addFoodSearch, sourceLabel } from "./food-search.js";
import { formatNutritionValue } from "./format.js";
import { entryNutrition, perGramFromNutrition, recentFoods } from "./intake.js";
import { searchText } from "./nevo.js";
import { getCachedBarcodeLookup, setCachedBarcodeLookup } from "./persistence.js";
import { lookupProductByBarcode } from "./product-lookup.js";
import { state } from "./state.js";
import {
  MEAL_LABELS,
  addField,
  defaultMeal,
  logDateForNewEntry,
  logEntry,
  mealSelect,
  numberInput,
  openLogDialog,
  removeEntry
} from "./today.js";
import { showToast } from "./ui.js";

const formatAmount = (value) => String(Math.round(value * 100) / 100);

const AMOUNT_LABELS = {
  g: "Grams eaten",
  ml: "Millilitres eaten",
  serving: "Servings eaten",
  "": "Portions eaten"
};

// A pantry item as a search result; it keeps its index so it can be taken from the pantry.
function pantryChoice(item, index) {
  return {
    name: item.name,
    detail:
      typeof item.quantity === "number"
        ? `in pantry: ${formatAmount(item.quantity)} ${item.unit}`
        : "",
    unit: "g",
    nutrition: item.nutrition,
    // An item filled from NEVO or Open Food Facts keeps that source (NEVO needs RIVM's reference).
    nutritionSource: item.nutritionSource || "pantry",
    nevoVersion: item.nevoVersion || null,
    stockIndex: index
  };
}

// Pantry items whose name contains every word of the query (accents and case ignored).
function searchPantry(query) {
  const words = searchText(query).split(" ").filter(Boolean);
  return state.stockItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => words.every((word) => searchText(item.name).includes(word)))
    .map(({ item, index }) => ({ ...pantryChoice(item, index), resultLabel: "Pantry" }));
}

// One line about a recent entry: its amount, kcal and meal, e.g. "150 g · 90 kcal · Breakfast".
function recentText(entry) {
  const { kcal } = entryNutrition(entry);
  const amount =
    entry.unit === "g" || entry.unit === "ml"
      ? `${formatNutritionValue(entry.quantity)} ${entry.unit}`
      : entry.unit === "serving"
        ? `${formatNutritionValue(entry.quantity)} serving${entry.quantity === 1 ? "" : "s"}`
        : "";
  return [amount, kcal === null ? "" : `${Math.round(kcal)} kcal`, MEAL_LABELS[entry.meal]]
    .filter(Boolean)
    .join(" · ");
}

export function openAddFood() {
  const { dialog, body, addActions } = openLogDialog("Add food");

  // What will be logged: a food (searched, scanned or from the pantry), a recent entry, or typed values.
  let chosen = null;
  let recent = null;
  let manual = false;

  // ----- Recent foods: shown until you start typing a search -----
  const recentBox = document.createElement("div");
  recentBox.className = "form-stack";
  const recentEntries = recentFoods(state.intakeLog);
  if (recentEntries.length > 0) {
    const heading = document.createElement("p");
    heading.className = "field-label";
    heading.textContent = "Recent";
    const list = document.createElement("ul");
    list.className = "shopping-list food-results";
    list.id = "addFoodRecent";
    recentEntries.forEach((entry) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "item-button food-result";
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = entry.name;
      const meta = document.createElement("span");
      meta.className = "item-meta";
      meta.textContent = recentText(entry);
      button.append(name, meta);
      button.addEventListener("click", () => {
        body.querySelectorAll(".food-result").forEach((other) => other.classList.remove("chosen"));
        button.classList.add("chosen");
        chooseRecent(entry);
      });
      li.appendChild(button);
      list.appendChild(li);
    });
    recentBox.append(heading, list);
  }
  body.appendChild(recentBox);

  // ----- Search: pantry, then NEVO, then Open Food Facts -----
  const searchInput = addFoodSearch(body, {
    idPrefix: "log",
    localResults: searchPantry,
    // The search shows its own "Chosen:" line, so the dialog's line stays empty for search picks.
    onPick: (choice) => chooseFood(choice, { fromSearch: true })
  });
  searchInput.addEventListener("input", () => {
    recentBox.classList.toggle("hidden", searchInput.value.trim() !== "");
  });

  // ----- Scanning: a barcode in the pantry selects that item -----
  const scanButton = document.createElement("button");
  scanButton.type = "button";
  scanButton.className = "secondary-button";
  scanButton.id = "logScanButton";
  scanButton.textContent = "Scan a barcode";
  const reader = document.createElement("div");
  reader.id = "logReader";
  reader.className = "hidden";
  const scanMessage = document.createElement("p");
  scanMessage.className = "status-text";
  body.append(scanButton, reader, scanMessage);

  // ----- Typing the values of a portion, for food that can't be looked up -----
  const manualButton = document.createElement("button");
  manualButton.type = "button";
  manualButton.className = "secondary-button";
  manualButton.id = "manualEntryButton";
  manualButton.textContent = "Enter values by hand";
  body.appendChild(manualButton);
  const manualBox = document.createElement("div");
  manualBox.className = "form-stack hidden";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.autocomplete = "off";
  addField(manualBox, "What did you eat?", nameInput, "quickNameInput");
  const grid = document.createElement("div");
  grid.className = "target-grid";
  manualBox.appendChild(grid);
  const manualInputs = {};
  [
    ["kcal", "kcal"],
    ["protein", "Protein (g, optional)"],
    ["carbs", "Carbs (g, optional)"],
    ["fat", "Fat (g, optional)"],
    ["fiber", "Fibre (g, optional)"]
  ].forEach(([key, label]) => {
    manualInputs[key] = addField(grid, label, numberInput(null), `quick${key}Input`);
  });
  body.appendChild(manualBox);

  // ----- What was chosen, the amount, and taking it from the pantry -----
  const chosenText = document.createElement("p");
  chosenText.className = "status-text";
  chosenText.id = "addFoodChosen";
  body.appendChild(chosenText);
  const amountBox = document.createElement("div");
  amountBox.className = "form-stack";
  const amount = addField(amountBox, "Grams eaten", numberInput(null), "logGramsInput");
  const amountLabel = amountBox.querySelector('label[for="logGramsInput"]');
  body.appendChild(amountBox);

  const pantryBox = document.createElement("div");
  pantryBox.className = "form-stack hidden";
  const takeLabel = document.createElement("label");
  takeLabel.className = "cook-add-to-list";
  const take = document.createElement("input");
  take.type = "checkbox";
  take.checked = true;
  take.id = "logTakeFromPantry";
  takeLabel.append(take, "Take from pantry");
  const takeNote = document.createElement("p");
  takeNote.className = "hint-text";
  // For pieces, packs and the like: the amount in the pantry's own unit, entered by hand.
  const manualAmount = numberInput(null);
  manualAmount.id = "logPantryAmountInput";
  const manualAmountLabel = document.createElement("label");
  manualAmountLabel.className = "field-label";
  manualAmountLabel.htmlFor = manualAmount.id;
  const listLabel = document.createElement("label");
  listLabel.className = "cook-add-to-list";
  const addToList = document.createElement("input");
  addToList.type = "checkbox";
  addToList.checked = true;
  listLabel.append(addToList, "Add used-up items to the shopping list");
  pantryBox.append(takeLabel, takeNote, manualAmountLabel, manualAmount, listLabel);
  body.appendChild(pantryBox);
  take.addEventListener("change", () => {
    [manualAmount, addToList].forEach((input) => (input.disabled = !take.checked));
  });

  const meal = addField(body, "Meal", mealSelect(defaultMeal(null)), "logMealSelect");
  const message = document.createElement("p");
  message.className = "status-text";
  body.appendChild(message);

  const pantryItem = () =>
    chosen && chosen.stockIndex !== undefined ? state.stockItems[chosen.stockIndex] : null;

  // Shows how much leaves the pantry, or asks for the amount when grams can't be converted.
  const refresh = () => {
    amountBox.classList.toggle("hidden", manual);
    manualBox.classList.toggle("hidden", !manual);
    const unit = recent ? recent.unit : chosen ? chosen.unit : "g";
    amountLabel.textContent = AMOUNT_LABELS[unit] || AMOUNT_LABELS.g;
    const item = manual ? null : pantryItem();
    pantryBox.classList.toggle("hidden", !item);
    if (!item) {
      return;
    }
    const stockUnit = item.unit || "";
    const converted =
      amount.value === "" ? null : gramsToStockUnit(Number(amount.value), stockUnit);
    const needsAmount = gramsToStockUnit(1, stockUnit) === null;
    manualAmountLabel.classList.toggle("hidden", !needsAmount);
    manualAmount.classList.toggle("hidden", !needsAmount);
    manualAmountLabel.textContent = `Amount to take from the pantry (${stockUnit || "pieces"})`;
    const inPantry =
      typeof item.quantity === "number"
        ? `in pantry: ${formatAmount(item.quantity)} ${stockUnit}`
        : "";
    takeNote.textContent =
      !needsAmount && converted !== null
        ? `Takes ${formatAmount(converted)} ${stockUnit} (${inPantry})`
        : inPantry;
  };
  amount.addEventListener("input", refresh);

  function chooseFood(choice, { fromSearch = false } = {}) {
    chosen = choice;
    recent = null;
    manual = false;
    chosenText.textContent = fromSearch
      ? ""
      : `Chosen: ${choice.name}${
          choice.resultLabel || sourceLabel(choice)
            ? ` (${choice.resultLabel || sourceLabel(choice)})`
            : ""
        }`;
    refresh();
  }

  function chooseRecent(entry) {
    recent = entry;
    chosen = null;
    manual = false;
    chosenText.textContent = `Chosen: ${entry.name} (recent)`;
    amount.value = String(entry.quantity);
    meal.value = entry.meal;
    refresh();
  }

  manualButton.addEventListener("click", () => {
    manual = true;
    chosen = null;
    recent = null;
    chosenText.textContent = "";
    refresh();
    nameInput.focus();
  });

  // ----- Scanning -----
  let camera = null;
  let cameraRunning = false;
  const stopScanning = async () => {
    if (camera) {
      const running = cameraRunning;
      const instance = camera;
      camera = null;
      cameraRunning = false;
      await stopCamera(instance, running);
    }
    reader.classList.add("hidden");
  };
  dialog.addEventListener("close", stopScanning, { once: true });

  const handleBarcode = async (barcode) => {
    await stopScanning();
    const index = state.stockItems.findIndex((item) => item.barcode === barcode);
    if (index !== -1) {
      scanMessage.textContent = `Found in your pantry: ${state.stockItems[index].name}`;
      chooseFood({ ...pantryChoice(state.stockItems[index], index), resultLabel: "Pantry" });
      return;
    }
    scanMessage.textContent = "Looking up product...";
    let product = getCachedBarcodeLookup(barcode);
    if (product === undefined) {
      try {
        product = await lookupProductByBarcode(barcode);
        setCachedBarcodeLookup(barcode, product);
      } catch (error) {
        product = null;
      }
    }
    const name = product && product.name ? product.name : `Product ${barcode}`;
    scanMessage.textContent = product
      ? `Not in your pantry: ${name}`
      : `Barcode ${barcode} wasn't found; it will be logged without nutrition data.`;
    chooseFood({
      name,
      unit: "g",
      nutrition: product ? product.nutrition : null,
      nutritionSource: product ? "off" : null,
      nevoVersion: null
    });
  };

  scanButton.addEventListener("click", async () => {
    const unavailable = cameraUnavailableMessage();
    if (unavailable) {
      scanMessage.textContent = unavailable;
      return;
    }
    if (camera) {
      return;
    }
    reader.classList.remove("hidden");
    scanMessage.textContent = "Point the camera at a barcode.";
    camera = createCamera("logReader");
    try {
      await startCamera(camera, (barcode) => void handleBarcode(barcode));
      cameraRunning = true;
    } catch (error) {
      camera = null;
      reader.classList.add("hidden");
      scanMessage.textContent = getScannerStartErrorMessage(error);
    }
  });

  refresh();

  // ----- Logging -----
  // Every way of logging confirms with Undo, which also puts back what was taken from the pantry.
  const confirmWithUndo = (entry, undoPantry) => {
    showToast(`Logged ${entry.name}`, {
      label: "Undo",
      durationMs: 10000,
      onClick: () => {
        removeEntry(entry);
        if (undoPantry) {
          undoPantry();
        }
      }
    });
  };

  addActions("Log", () => {
    const date = logDateForNewEntry(true);
    if (manual) {
      const name = nameInput.value.trim();
      const kcal = Number(manualInputs.kcal.value);
      if (name === "" || manualInputs.kcal.value.trim() === "" || !(kcal >= 0)) {
        message.textContent = "Enter a name and the kcal.";
        return false;
      }
      const perUnit = {};
      Object.entries(manualInputs).forEach(([key, input]) => {
        const value = Number(input.value);
        perUnit[key] = input.value.trim() !== "" && value >= 0 ? value : null;
      });
      const entry = logEntry(
        {
          date,
          meal: meal.value,
          name,
          source: "manual",
          unit: "",
          quantity: 1,
          perUnit,
          status: "complete",
          nutritionSource: "manual"
        },
        { silent: true }
      );
      confirmWithUndo(entry, null);
      return true;
    }

    const quantity = Number(amount.value);
    if ((!chosen && !recent) || !(quantity > 0)) {
      message.textContent = "Choose a recent food, search or scan one, and enter the amount eaten.";
      return false;
    }

    if (recent) {
      // The same values as last time; only the amount and meal can differ.
      const entry = logEntry(
        {
          date,
          meal: meal.value,
          name: recent.name,
          source: recent.source,
          unit: recent.unit,
          quantity,
          perUnit: { ...recent.perUnit },
          status: recent.status,
          nutritionSource: recent.nutritionSource,
          nevoVersion: recent.nevoVersion
        },
        { silent: true }
      );
      confirmWithUndo(entry, null);
      return true;
    }

    let undoPantry = null;
    const item = pantryItem();
    if (item && take.checked) {
      const converted = gramsToStockUnit(quantity, item.unit || "");
      const fromPantry = converted !== null ? converted : Number(manualAmount.value) || 0;
      if (fromPantry > 0) {
        undoPantry = takeFromPantry(
          [{ stockIndex: chosen.stockIndex, amount: fromPantry }],
          addToList.checked
        );
      }
    }
    const entry = logEntry(
      {
        date,
        meal: meal.value,
        name: chosen.name,
        source: "product",
        unit: chosen.unit === "ml" ? "ml" : "g",
        quantity,
        ...perGramFromNutrition(chosen.nutrition),
        nutritionSource: chosen.nutritionSource,
        nevoVersion: chosen.nevoVersion
      },
      { silent: true }
    );
    confirmWithUndo(entry, undoPantry);
    return true;
  });
}
