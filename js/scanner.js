// The camera barcode scanner on the Scanner tab.
import {
  cameraUnavailableMessage,
  createCamera,
  getScannerStartErrorMessage,
  startCamera,
  stopCamera
} from "./camera.js";
import { readerWrapper, scannerMessage, startScannerButton, stopScannerButton } from "./dom.js";
import {
  applyLookupToForm,
  hideAddMoreButton,
  startEdit,
  updatePendingBarcodeUI
} from "./item-form.js";
import { getCachedBarcodeLookup, setCachedBarcodeLookup } from "./persistence.js";
import { lookupProductByBarcode } from "./product-lookup.js";
import { findItemIndexByBarcode } from "./shopping-list.js";
import { state } from "./state.js";
import { setStatus } from "./ui.js";

export async function startScanner() {
  if (state.scannerRunning) {
    setStatus("Scanner already running.");
    return;
  }

  const unavailable = cameraUnavailableMessage();
  if (unavailable !== "") {
    scannerMessage.textContent = unavailable;
    setStatus(
      window.isSecureContext ? "Scanner library did not load." : "Camera scanning requires HTTPS."
    );
    return;
  }

  hideAddMoreButton();
  readerWrapper.classList.remove("hidden");
  startScannerButton.disabled = true;
  stopScannerButton.disabled = true;
  scannerMessage.textContent = "Requesting camera access...";

  state.scanLock = false;
  state.html5QrCode = createCamera("reader");

  try {
    await startCamera(state.html5QrCode, onScanSuccess);

    state.scannerRunning = true;
    stopScannerButton.disabled = false;
    scannerMessage.textContent = "Scanner running. Point the back camera at a barcode.";
    setStatus("Scanner started.");
  } catch (error) {
    state.html5QrCode = null;
    readerWrapper.classList.add("hidden");
    startScannerButton.disabled = false;
    stopScannerButton.disabled = true;
    const reason = getScannerStartErrorMessage(error);
    scannerMessage.textContent = reason;
    setStatus(reason);
  }
}

export function onScanSuccess(decodedText) {
  if (state.scanLock) {
    return;
  }

  state.scanLock = true;
  void handleDetectedBarcode(decodedText);
}

export async function handleDetectedBarcode(decodedText) {
  state.pendingBarcode = decodedText;
  updatePendingBarcodeUI();

  await stopScanner(true);

  const existingIndex = findItemIndexByBarcode(decodedText);

  if (existingIndex !== null) {
    const existingItem = state.items[existingIndex];
    startEdit(existingIndex);
    scannerMessage.textContent = `Matched existing item: ${existingItem.name}`;
    setStatus(`Barcode matched "${existingItem.name}". Existing item loaded for editing.`);
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
    setStatus("Barcode not found in Open Food Facts. Fill in the item details manually.");
  } catch (error) {
    scannerMessage.textContent = `New barcode ready: ${decodedText}`;
    setStatus("Barcode scanned, but external lookup failed. Fill in the item details manually.");
  }
}

export async function stopScanner(autoStopped) {
  if (!state.html5QrCode) {
    state.scannerRunning = false;
    startScannerButton.disabled = false;
    stopScannerButton.disabled = true;
    readerWrapper.classList.add("hidden");

    if (autoStopped) {
      scannerMessage.textContent = `Barcode ready for next save: ${state.pendingBarcode}`;
    } else {
      scannerMessage.textContent = "Scanner stopped.";
      setStatus("Scanner stopped.");
    }

    return;
  }

  await stopCamera(state.html5QrCode, state.scannerRunning);

  state.html5QrCode = null;
  state.scannerRunning = false;
  state.scanLock = false;
  startScannerButton.disabled = false;
  stopScannerButton.disabled = true;
  readerWrapper.classList.add("hidden");

  if (autoStopped) {
    scannerMessage.textContent = `Barcode ready for next save: ${state.pendingBarcode}`;
  } else {
    scannerMessage.textContent = "Scanner stopped.";
    setStatus("Scanner stopped.");
  }
}
