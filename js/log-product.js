// "Add product" on the Today tab: log grams of a pantry item, a scanned product or a searched food (NEVO or
// Open Food Facts), and optionally take a pantry item from the pantry (pieces and packs entered by hand).
import {
  cameraUnavailableMessage,
  createCamera,
  getScannerStartErrorMessage,
  startCamera,
  stopCamera
} from "./camera.js";
import { takeFromPantry } from "./cook-dialog.js";
import { gramsToStockUnit } from "./cooking.js";
import { perGramFromNutrition } from "./intake.js";
import { hasAnyNutrition } from "./nutrition.js";
import { addFoodSearch } from "./food-search.js";
import { getCachedBarcodeLookup, setCachedBarcodeLookup } from "./persistence.js";
import { lookupProductByBarcode } from "./product-lookup.js";
import { state } from "./state.js";
import {
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

export function openAddProduct() {
  const { dialog, body, addActions } = openLogDialog("Add product");

  // What was eaten: a pantry item (by index) or, after a scan or search, a food that isn't in the pantry.
  let scanned = null;
  const select = document.createElement("select");
  const placeholder = new Option("Choose from your pantry", "");
  select.appendChild(placeholder);
  state.stockItems.forEach((item, index) => {
    const label = hasAnyNutrition(item.nutrition) ? item.name : `${item.name} (no nutrition data)`;
    select.appendChild(new Option(label, String(index)));
  });
  addField(body, "Product", select, "logProductSelect");

  // Scanning: a camera view inside the dialog; a barcode in the pantry selects that item.
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

  // Searching: NEVO foods without a barcode (fruit, cooked rice) and Open Food Facts products by name.
  const searchHeading = document.createElement("p");
  searchHeading.className = "field-label";
  searchHeading.textContent = "Or search a food";
  body.appendChild(searchHeading);
  addFoodSearch(body, {
    idPrefix: "log",
    onPick: (choice) => {
      select.value = "";
      scanned = choice;
      scanMessage.textContent = "";
      refreshPantryBox();
    }
  });

  const grams = addField(body, "Grams eaten", numberInput(null), "logGramsInput");
  const gramsLabel = body.querySelector('label[for="logGramsInput"]');
  const meal = addField(body, "Meal", mealSelect(defaultMeal(null)), "logMealSelect");

  // Taking it from the pantry: only for pantry items; ticked by default, like Cook this.
  const pantryBox = document.createElement("div");
  pantryBox.className = "form-stack";
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
  const manualLabel = document.createElement("label");
  manualLabel.className = "field-label";
  const listLabel = document.createElement("label");
  listLabel.className = "cook-add-to-list";
  const addToList = document.createElement("input");
  addToList.type = "checkbox";
  addToList.checked = true;
  listLabel.append(addToList, "Add used-up items to the shopping list");
  pantryBox.append(takeLabel, takeNote, manualLabel, manualAmount, listLabel);
  manualAmount.id = "logPantryAmountInput";
  manualLabel.htmlFor = manualAmount.id;
  body.appendChild(pantryBox);

  const message = document.createElement("p");
  message.className = "status-text";
  body.appendChild(message);

  const selectedItem = () => (select.value === "" ? null : state.stockItems[Number(select.value)]);

  // Shows how much leaves the pantry, or asks for the amount when grams can't be converted.
  const refreshPantryBox = () => {
    const item = selectedItem();
    // NEVO drinks are per 100 ml, so their amount is asked in millilitres.
    gramsLabel.textContent =
      !item && scanned && scanned.unit === "ml" ? "Millilitres eaten" : "Grams eaten";
    pantryBox.classList.toggle("hidden", !item);
    if (!item) {
      return;
    }
    const unit = item.unit || "";
    const converted = grams.value === "" ? null : gramsToStockUnit(Number(grams.value), unit);
    const needsAmount = gramsToStockUnit(1, unit) === null;
    manualLabel.classList.toggle("hidden", !needsAmount);
    manualAmount.classList.toggle("hidden", !needsAmount);
    manualLabel.textContent = `Amount to take from the pantry (${unit || "pieces"})`;
    const inPantry =
      typeof item.quantity === "number" ? `in pantry: ${formatAmount(item.quantity)} ${unit}` : "";
    takeNote.textContent =
      !needsAmount && converted !== null
        ? `Takes ${formatAmount(converted)} ${unit} (${inPantry})`
        : inPantry;
  };
  select.addEventListener("change", () => {
    scanned = null;
    refreshPantryBox();
  });
  grams.addEventListener("input", refreshPantryBox);
  take.addEventListener("change", () => {
    [manualAmount, addToList].forEach((input) => (input.disabled = !take.checked));
  });
  refreshPantryBox();

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
      select.value = String(index);
      scanned = null;
      scanMessage.textContent = `Found in your pantry: ${state.stockItems[index].name}`;
      refreshPantryBox();
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
    select.value = "";
    scanned = {
      name: product && product.name ? product.name : `Product ${barcode}`,
      unit: "g",
      nutrition: product ? product.nutrition : null,
      nutritionSource: product ? "off" : null,
      nevoVersion: null
    };
    scanMessage.textContent = product
      ? `Not in your pantry: ${scanned.name}`
      : `Barcode ${barcode} wasn't found; it will be logged without nutrition data.`;
    refreshPantryBox();
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

  // ----- Logging -----
  addActions("Log", () => {
    const item = selectedItem();
    const source = item || scanned;
    const amount = Number(grams.value);
    if (!source || !(amount > 0)) {
      message.textContent = "Choose, scan or search a food and enter the amount eaten.";
      return false;
    }

    let undoPantry = null;
    if (item && take.checked) {
      const converted = gramsToStockUnit(amount, item.unit || "");
      const fromPantry = converted !== null ? converted : Number(manualAmount.value) || 0;
      if (fromPantry > 0) {
        undoPantry = takeFromPantry(
          [{ stockIndex: Number(select.value), amount: fromPantry }],
          addToList.checked
        );
      }
    }

    const entry = logEntry(
      {
        date: logDateForNewEntry(true),
        meal: meal.value,
        name: source.name,
        source: "product",
        unit: !item && scanned.unit === "ml" ? "ml" : "g",
        quantity: amount,
        ...perGramFromNutrition(source.nutrition),
        nutritionSource: item ? item.nutritionSource || "pantry" : scanned.nutritionSource,
        nevoVersion: item ? item.nevoVersion || null : scanned.nevoVersion
      },
      { silent: true }
    );
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
    return true;
  });
}
