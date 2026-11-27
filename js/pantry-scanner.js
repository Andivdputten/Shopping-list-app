// The continuous barcode scanner on the Pantry tab, which adds each scanned product to stock.
import {
  cameraUnavailableMessage,
  createCamera,
  getScannerStartErrorMessage,
  startCamera,
  stopCamera
} from "./camera.js";
import { PANTRY_SCAN_COOLDOWN_MS, PANTRY_SKIP_COOLDOWN_MS } from "./constants.js";
import {
  pantryReaderWrapper,
  pantryScanButton,
  pantryScanMessage,
  pantryScanStopButton,
  pantryUnknownForm,
  pantryUnknownNameInput,
  pantryUnknownText
} from "./dom.js";
import { createStockItem, mergeStockItems, parsePackageQuantity, parsePackGrams } from "./items.js";
import { normalizeNutrition } from "./nutrition.js";
import { findMatchingStockIndex, renderStockList } from "./pantry.js";
import { getCachedBarcodeLookup, saveStockItems, setCachedBarcodeLookup } from "./persistence.js";
import { buildLookupNote, lookupProductByBarcode } from "./product-lookup.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";

export function addScannedItemToPantry(barcode, productData, nameOverride) {
  const typedName = typeof nameOverride === "string" ? nameOverride.trim() : "";
  const name = typedName !== "" ? typedName : productData ? productData.name : "";

  if (name === "") {
    return false;
  }

  const pack = productData
    ? parsePackageQuantity(productData.packageQuantity)
    : // Same fallback unit as parsePackageQuantity(), so repeat scans merge instead of creating a duplicate entry.
      { quantity: 1, unit: "pack" };

  const incoming = {
    name,
    quantity: pack.quantity,
    unit: pack.unit,
    category: productData ? productData.category : "",
    note: productData ? buildLookupNote(productData) : "",
    barcode,
    nutrition: normalizeNutrition(productData ? productData.nutrition : null),
    nutritionAmount: null,
    // Counted in packs (the size wasn't a plain "500 g"): the weight of one pack, when the package text
    // gives it ("6 x 330 ml"), so recipes and cooking know how much a pack holds.
    packGrams:
      productData && !["g", "kg", "ml", "l"].includes(pack.unit)
        ? parsePackGrams(productData.packageQuantity)
        : null
  };

  const existingIndex = findMatchingStockIndex(incoming);
  let message;

  if (existingIndex === null) {
    state.stockItems.push(createStockItem(incoming));
    message = `${name} added to pantry`;
  } else {
    const quantityBefore = state.stockItems[existingIndex].quantity;
    state.stockItems[existingIndex] = mergeStockItems(state.stockItems[existingIndex], incoming);
    const merged = state.stockItems[existingIndex];
    const unitText = merged.unit ? ` ${merged.unit}` : "";

    if (typeof merged.quantity !== "number") {
      message = `${name} added to pantry`;
    } else if (merged.quantity === quantityBefore) {
      // Units didn't match, so nothing could be added up.
      message = `${name} is already in your pantry (quantity unchanged)`;
    } else {
      message = `${name} added to pantry (now ${merged.quantity}${unitText})`;
    }
  }

  saveStockItems();
  renderStockList();
  showToast(message);
  return true;
}

export async function startPantryScanner() {
  if (state.pantryScannerRunning || state.pantryScanner) {
    return;
  }

  const unavailable = cameraUnavailableMessage();
  if (unavailable !== "") {
    pantryScanMessage.textContent = unavailable;
    return;
  }

  pantryReaderWrapper.classList.remove("hidden");
  pantryScanButton.disabled = true;
  pantryScanStopButton.disabled = true;
  pantryScanMessage.textContent = "Requesting camera access...";

  state.pantryScanBusy = false;
  state.pantryLastBarcode = "";
  state.pantryCooldownUntil = 0;
  state.pantryScanner = createCamera("pantryReader");

  try {
    await startCamera(state.pantryScanner, onPantryScanSuccess);

    state.pantryScannerRunning = true;
    pantryScanStopButton.disabled = false;
    pantryScanMessage.textContent = "Scanning. Each barcode you scan is added to your pantry.";
  } catch (error) {
    state.pantryScanner = null;
    pantryReaderWrapper.classList.add("hidden");
    pantryScanButton.disabled = false;
    pantryScanStopButton.disabled = true;
    pantryScanMessage.textContent = getScannerStartErrorMessage(error);
  }
}

export async function stopPantryScanner() {
  const scanner = state.pantryScanner;
  const wasRunning = state.pantryScannerRunning;

  state.pantryScanner = null;
  state.pantryScannerRunning = false;
  state.pantryScanBusy = false;

  if (scanner) {
    await stopCamera(scanner, wasRunning);
  }

  hidePantryUnknownForm();
  pantryReaderWrapper.classList.add("hidden");
  pantryScanButton.disabled = false;
  pantryScanStopButton.disabled = true;
  pantryScanMessage.textContent = "Scanner stopped.";
}

export function onPantryScanSuccess(decodedText) {
  if (state.pantryScanBusy) {
    return;
  }

  // The camera keeps seeing the same barcode for a moment; don't add it twice.
  if (decodedText === state.pantryLastBarcode && Date.now() < state.pantryCooldownUntil) {
    return;
  }

  state.pantryScanBusy = true;
  void handlePantryBarcode(decodedText);
}

export function finishPantryScan(barcode, message, cooldownMs) {
  state.pantryLastBarcode = barcode;
  state.pantryCooldownUntil = Date.now() + cooldownMs;
  state.pantryScanBusy = false;
  pantryScanMessage.textContent = message;
}

export async function handlePantryBarcode(barcode) {
  pantryScanMessage.textContent = "Looking up product...";

  let product = null;
  let lookupFailed = false;
  const cached = getCachedBarcodeLookup(barcode);

  if (cached !== undefined) {
    product = cached;
  } else {
    try {
      product = await lookupProductByBarcode(barcode);
      setCachedBarcodeLookup(barcode, product);
    } catch (error) {
      product = null;
      lookupFailed = true;
    }
  }

  if (product && product.name !== "") {
    addScannedItemToPantry(barcode, product, "");
    finishPantryScan(barcode, "Added. Point at the next barcode.", PANTRY_SCAN_COOLDOWN_MS);
    return;
  }

  // Already in the pantry under this barcode (e.g. named by hand earlier):
  // just add to that entry instead of asking for a name again.
  const stockIndex = state.stockItems.findIndex(
    (stockItem) => typeof stockItem.barcode === "string" && stockItem.barcode.trim() === barcode
  );

  if (stockIndex !== -1) {
    addScannedItemToPantry(barcode, product, state.stockItems[stockIndex].name);
    finishPantryScan(barcode, "Added. Point at the next barcode.", PANTRY_SCAN_COOLDOWN_MS);
    return;
  }

  // Unknown barcode (or a product without a name): ask for a name instead of
  // silently dropping the scan. Scanning pauses until this is resolved.
  if (!state.pantryScannerRunning) {
    state.pantryScanBusy = false;
    return;
  }

  state.pantryPendingBarcode = barcode;
  state.pantryPendingProduct = product;
  pantryUnknownText.textContent = lookupFailed
    ? `Couldn't look up ${barcode} (are you offline?). Enter a name to add it anyway.`
    : `Barcode ${barcode} wasn't found. Enter a name to add it to your pantry.`;
  pantryUnknownNameInput.value = "";
  pantryUnknownForm.classList.remove("hidden");
  pantryScanMessage.textContent = "Waiting for a name...";
  pantryUnknownNameInput.focus();
}

export function hidePantryUnknownForm() {
  pantryUnknownForm.classList.add("hidden");
  pantryUnknownNameInput.value = "";
  state.pantryPendingBarcode = "";
  state.pantryPendingProduct = null;
}

export function submitPantryUnknown() {
  const name = pantryUnknownNameInput.value.trim();

  if (name === "") {
    pantryScanMessage.textContent = "Enter a name first, or tap Skip.";
    return;
  }

  const barcode = state.pantryPendingBarcode;
  addScannedItemToPantry(barcode, state.pantryPendingProduct, name);
  hidePantryUnknownForm();
  finishPantryScan(barcode, "Added. Point at the next barcode.", PANTRY_SCAN_COOLDOWN_MS);
}

export function skipPantryUnknown() {
  const barcode = state.pantryPendingBarcode;
  hidePantryUnknownForm();
  finishPantryScan(barcode, "Skipped. Point at the next barcode.", PANTRY_SKIP_COOLDOWN_MS);
}
