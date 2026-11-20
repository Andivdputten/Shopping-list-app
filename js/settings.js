// The Settings tab: API key, recipe language and backup export/import.
import { aiText } from "./ai-recipes.js";
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  INTAKE_STORAGE_KEY,
  RECIPE_COMPLEX_STORAGE_KEY,
  RECIPE_LANGUAGE_STORAGE_KEY,
  RECIPE_STORAGE_KEY,
  STOCK_STORAGE_KEY,
  STORAGE_KEY,
  TARGETS_STORAGE_KEY
} from "./constants.js";
import {
  aiPreferencesInput,
  apiKeyInput,
  apiKeyStatus,
  clearApiKeyButton,
  saveApiKeyButton,
  suggestRecipesButton,
  testApiKeyButton
} from "./dom.js";
import { RecipeAI } from "./recipe-ai.js";
import { state } from "./state.js";

export function initApiKeySettings() {
  apiKeyInput.value = RecipeAI.getApiKey();
  updateApiKeyStatusDisplay();

  saveApiKeyButton.addEventListener("click", () => {
    const value = apiKeyInput.value.trim();

    if (value === "") {
      apiKeyStatus.textContent = "Enter a key before saving.";
      return;
    }

    RecipeAI.setApiKey(value);
    updateApiKeyStatusDisplay();
  });

  clearApiKeyButton.addEventListener("click", () => {
    RecipeAI.clearApiKey();
    apiKeyInput.value = "";
    apiKeyStatus.textContent = "API key removed.";
  });

  testApiKeyButton.addEventListener("click", async () => {
    testApiKeyButton.disabled = true;
    const previousLabel = testApiKeyButton.textContent;
    testApiKeyButton.textContent = "Testing...";
    apiKeyStatus.textContent = "Testing connection...";

    const result = await RecipeAI.testConnection();

    testApiKeyButton.disabled = false;
    testApiKeyButton.textContent = previousLabel;
    apiKeyStatus.textContent = result.message;
  });
}

// Reads the chosen recipe language code ("en", "nl", ...), defaulting to English.
// Wrapped in try/catch because storage can be unavailable (e.g. private browsing).
export function getRecipeLanguage() {
  // The dropdown holds the current choice even if saving it to storage failed.
  const select = document.getElementById("recipeLanguageSelect");
  if (select && select.value) {
    return select.value;
  }
  return readStoredRecipeLanguage();
}

// Puts the AI recipe card's fixed texts (heading, hint, input placeholder, button) into the chosen recipe language.
// Runs at startup and whenever the language changes, so the generator reads in one language throughout.
export function applyRecipeSectionLanguage() {
  const t = aiText();
  const title = document.getElementById("aiSectionTitle");
  const hint = document.getElementById("aiSectionHint");

  if (title) {
    title.textContent = t.sectionTitle;
  }
  if (hint) {
    hint.textContent = t.sectionHint;
  }
  aiPreferencesInput.placeholder = t.preferencesPlaceholder;
  // The meal-type choice: "Any meal" first, then the four meals, keeping the current choice on relabelling.
  const mealSelect = document.getElementById("aiMealTypeSelect");
  if (mealSelect) {
    const chosen = mealSelect.value;
    mealSelect.innerHTML = "";
    mealSelect.appendChild(new Option(t.anyMeal, ""));
    ["breakfast", "lunch", "dinner", "snack"].forEach((meal) => {
      const label = t.meals[meal];
      mealSelect.appendChild(new Option(label.charAt(0).toUpperCase() + label.slice(1), meal));
    });
    mealSelect.value = chosen;
    mealSelect.setAttribute("aria-label", t.mealChoiceLabel);
  }
  const complexText = document.getElementById("aiComplexText");
  if (complexText) {
    complexText.textContent = t.complexToggle;
  }
  // Not while a request is running, when the button temporarily shows the "thinking" label.
  if (!suggestRecipesButton.disabled) {
    suggestRecipesButton.textContent = t.suggestButton;
  }
}

// Reads the saved language straight from storage; used when the dropdown is first filled,
// because at that moment its value is still the default first option rather than the saved choice.
export function readStoredRecipeLanguage() {
  try {
    return localStorage.getItem(RECIPE_LANGUAGE_STORAGE_KEY) || "en";
  } catch (error) {
    return "en";
  }
}

// Fills the "Recipe language" dropdown in Settings and saves the choice when it changes.
// The setting only affects AI-generated recipes, not the rest of the app.
export function initRecipeLanguageSetting() {
  const select = document.getElementById("recipeLanguageSelect");

  if (!select) {
    return;
  }

  const labels = {
    en: "English",
    nl: "Nederlands",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
    pt: "Português (Brasil)"
  };
  Object.keys(RecipeAI.recipeLanguages).forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = labels[code] || RecipeAI.recipeLanguages[code];
    select.appendChild(option);
  });

  select.value = readStoredRecipeLanguage();
  applyRecipeSectionLanguage();

  select.addEventListener("change", () => {
    applyRecipeSectionLanguage();
    try {
      localStorage.setItem(RECIPE_LANGUAGE_STORAGE_KEY, select.value);
    } catch (error) {
      // Not saved; the choice still applies until the page is reloaded.
    }
  });
}

// Wires up the Export/Import backup buttons in Settings.
// All data lives only in localStorage, so this is the user's only protection against losing it.
export function initBackupSettings() {
  const exportButton = document.getElementById("exportDataButton");
  const importButton = document.getElementById("importDataButton");
  const importInput = document.getElementById("importDataInput");
  const backupStatus = document.getElementById("backupStatus");

  if (!exportButton || !importButton || !importInput || !backupStatus) {
    return;
  }

  exportButton.addEventListener("click", () => {
    exportBackup(backupStatus);
  });

  // The visible button opens the hidden file picker, which looks better than the browser's default file input.
  importButton.addEventListener("click", () => {
    importInput.value = "";
    importInput.click();
  });

  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    if (file) {
      void importBackup(file, backupStatus);
    }
  });
}

// Downloads the shopping list, pantry and saved recipes as one JSON file.
// The API key and barcode cache are left out: the key is a secret, and the cache rebuilds itself.
export function exportBackup(statusElement) {
  const backup = {
    app: BACKUP_APP_ID,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    items: state.items,
    stockItems: state.stockItems,
    savedRecipes: state.savedRecipes,
    // Optional: older backups have no targets, and older app versions ignore this field.
    targetSettings: state.targetSettings,
    // Optional, like targetSettings: older backups have no log.
    intakeLog: state.intakeLog
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grocery-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the temporary URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  statusElement.textContent = `Exported ${state.items.length} list item(s), ${state.stockItems.length} pantry item(s) and ${state.savedRecipes.length} recipe(s).`;
}

// Replaces all current data with the contents of a backup file, after the user confirms.
// The data is written to storage and the page reloads, so the existing load functions validate every entry.
export async function importBackup(file, statusElement) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (error) {
    statusElement.textContent = "That file isn't a valid backup (it couldn't be read as JSON).";
    return;
  }

  if (
    !backup ||
    backup.app !== BACKUP_APP_ID ||
    !Array.isArray(backup.items) ||
    !Array.isArray(backup.stockItems) ||
    !Array.isArray(backup.savedRecipes)
  ) {
    statusElement.textContent = "That file isn't a Grocery Scanner backup.";
    return;
  }

  // Newer formats may hold data this version doesn't understand, so refuse rather than import it partially.
  if (typeof backup.version !== "number" || backup.version > BACKUP_FORMAT_VERSION) {
    statusElement.textContent =
      "This backup was made by a newer version of the app. Update the app first.";
    return;
  }

  const dateText =
    typeof backup.exportedAt === "string" ? ` from ${backup.exportedAt.slice(0, 10)}` : "";
  const confirmed = window.confirm(
    `Replace ALL current data with this backup${dateText}?\n\n` +
      `It contains ${backup.items.length} list item(s), ${backup.stockItems.length} pantry item(s) ` +
      `and ${backup.savedRecipes.length} recipe(s). Your current data will be overwritten.`
  );

  if (!confirmed) {
    statusElement.textContent = "Import cancelled.";
    return;
  }

  // Remember the current stored values so a failed write (e.g. storage full) can be undone instead of leaving half-imported data.
  const keys = [
    STORAGE_KEY,
    STOCK_STORAGE_KEY,
    RECIPE_STORAGE_KEY,
    TARGETS_STORAGE_KEY,
    INTAKE_STORAGE_KEY
  ];
  const previousValues = keys.map((key) => localStorage.getItem(key));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.items));
    localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(backup.stockItems));
    localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(backup.savedRecipes));
    // A backup made before targets existed leaves the current targets as they are.
    if (backup.targetSettings && typeof backup.targetSettings === "object") {
      localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(backup.targetSettings));
    }
    if (Array.isArray(backup.intakeLog)) {
      localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(backup.intakeLog));
    }
  } catch (error) {
    keys.forEach((key, i) => {
      try {
        if (previousValues[i] === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, previousValues[i]);
        }
      } catch (restoreError) {
        // Restoring the old values should fit, as they were stored before; nothing more can be done if it doesn't.
      }
    });
    statusElement.textContent =
      "Couldn't save the backup (storage may be full). Your existing data was kept.";
    return;
  }

  window.location.reload();
}

export function updateApiKeyStatusDisplay() {
  if (RecipeAI.hasApiKey()) {
    apiKeyStatus.textContent = 'API key saved. Tap "Test connection" to verify it works.';
  } else {
    apiKeyStatus.textContent = "No API key saved yet.";
  }
}

// The "Complex recipes" switch: restored at start-up and saved on every change, on this device only.
export function initComplexRecipesToggle() {
  const toggle = document.getElementById("aiComplexToggle");
  if (!toggle) {
    return;
  }
  try {
    toggle.checked = localStorage.getItem(RECIPE_COMPLEX_STORAGE_KEY) === "1";
  } catch (error) {
    toggle.checked = false;
  }
  toggle.addEventListener("change", () => {
    try {
      localStorage.setItem(RECIPE_COMPLEX_STORAGE_KEY, toggle.checked ? "1" : "0");
    } catch (error) {
      // Not stored (e.g. private mode): the switch still applies until the app is closed.
    }
  });
}
