// Saves the shared state to browser storage and manages the barcode lookup cache.
import {
  BARCODE_CACHE_MAX_ENTRIES,
  BARCODE_CACHE_NOT_FOUND_TTL_MS,
  INTAKE_STORAGE_KEY,
  NEVO_STORAGE_KEY,
  RECIPE_STORAGE_KEY,
  STOCK_STORAGE_KEY,
  STORAGE_KEY,
  TARGETS_STORAGE_KEY
} from "./constants.js";
import { state } from "./state.js";
import { saveBarcodeCache } from "./storage.js";

export function saveRecipes() {
  localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(state.savedRecipes));
}

export function getCachedBarcodeLookup(barcode) {
  const entry = state.barcodeCache[barcode];

  if (!entry) {
    return undefined;
  }

  if (entry.found === false && typeof entry.cachedAt === "number") {
    const age = Date.now() - entry.cachedAt;
    if (age > BARCODE_CACHE_NOT_FOUND_TTL_MS) {
      delete state.barcodeCache[barcode];
      saveBarcodeCache(state.barcodeCache);
      return undefined;
    }
  }

  return entry.found ? entry.data : null;
}

export function setCachedBarcodeLookup(barcode, productData) {
  state.barcodeCache[barcode] = {
    found: productData !== null,
    data: productData,
    cachedAt: Date.now()
  };

  const keys = Object.keys(state.barcodeCache);
  if (keys.length > BARCODE_CACHE_MAX_ENTRIES) {
    // Simple bound so the cache can't grow forever: drop the oldest entries.
    keys
      .sort((a, b) => (state.barcodeCache[a].cachedAt || 0) - (state.barcodeCache[b].cachedAt || 0))
      .slice(0, keys.length - BARCODE_CACHE_MAX_ENTRIES)
      .forEach((key) => delete state.barcodeCache[key]);
  }

  saveBarcodeCache(state.barcodeCache);
}

export function saveStockItems() {
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(state.stockItems));
}

export function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

// Saves the daily target settings; storage can fail (full or private browsing), which only loses this change.
export function saveTargetSettings() {
  try {
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(state.targetSettings));
  } catch (error) {
    // Nothing else to do: the settings still apply until the page reloads.
  }
}

export function saveIntakeLog() {
  localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(state.intakeLog));
}

// Saves (or with null removes) the imported NEVO foods; returns false when the browser storage is full.
export function saveNevoData() {
  try {
    if (state.nevo === null) {
      localStorage.removeItem(NEVO_STORAGE_KEY);
    } else {
      localStorage.setItem(NEVO_STORAGE_KEY, JSON.stringify(state.nevo));
    }
    return true;
  } catch (error) {
    return false;
  }
}
