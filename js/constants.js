// Fixed values shared across the app: storage keys, limits, category order and tab titles.

export const STORAGE_KEY = "grocery_scanner_items_v6";

export const STOCK_STORAGE_KEY = "grocery_scanner_stock_v1";

export const RECIPE_STORAGE_KEY = "grocery_scanner_recipes_v1";

export const BARCODE_CACHE_STORAGE_KEY = "grocery_scanner_barcode_cache_v1";

// Chosen language for AI recipes. Declared up here because it is read during startup, before later code runs.
export const RECIPE_LANGUAGE_STORAGE_KEY = "grocery_scanner_recipe_language_v1";

export const BARCODE_CACHE_MAX_ENTRIES = 500;

// Cached "not found" results expire after a while in case a product gets
// added to Open Food Facts later; successful matches are cached indefinitely
// since a product's barcode/nutrition data rarely changes.
export const BARCODE_CACHE_NOT_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// 30 days
export const CATEGORY_ORDER = [
  "",
  "Produce",
  "Dairy",
  "Pantry",
  "Frozen",
  "Drinks",
  "Household",
  "Personal care"
];

export const PANTRY_SCAN_COOLDOWN_MS = 3000;

export const PANTRY_SKIP_COOLDOWN_MS = 8000;

export const TAB_INFO = {
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
    subtitle: "AI, daily targets, backup and statistics"
  }
};

// Format marker written into backup files, so imports can reject files that came from somewhere else.
// Daily targets, body data for the calculator and the meal split (see js/targets.js).
export const TARGETS_STORAGE_KEY = "grocery_scanner_targets_v1";

export const BACKUP_APP_ID = "grocery-scanner-backup";

export const BACKUP_FORMAT_VERSION = 1;
