// AI recipe suggestions: requesting them, matching ingredients to stock, showing and saving them.
import { openCookDialog } from "./cook-dialog.js";
import {
  aiPreferencesInput,
  aiRecipeResults,
  aiSuggestStatus,
  suggestRecipesButton
} from "./dom.js";
import {
  formatIngredientAmountText,
  formatIngredientLine,
  formatNutritionValue,
  normalizeDisplayAmount
} from "./format.js";
import { createShoppingItem, normalizeIngredientName } from "./items.js";
import { createEmptyNutrition, hasUsableNutrition, normalizeNutrition } from "./nutrition.js";
import { findMatchingStockItem } from "./pantry.js";
import { saveItems, saveRecipes } from "./persistence.js";
import { RecipeAI } from "./recipe-ai.js";
import { forLanguage } from "./recipe-ui-text.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { getRecipeLanguage } from "./settings.js";
import { renderList } from "./shopping-list.js";
import { state } from "./state.js";
import { switchTab } from "./tabs.js";
import { showToast } from "./ui.js";

// Texts for the AI recipe section in the chosen recipe language (see recipe-ui-text.js).
export function aiText() {
  return forLanguage(getRecipeLanguage());
}

// Decides which pantry item (if any) a recipe ingredient corresponds to.
// The AI is asked to name the exact stock item for each ingredient, because
// it understands meaning and other languages ("Halfvolle melk" = milk, and
// "tomato sauce" is not "tomato"). The plain text matching below is only a
// fallback for responses that don't include that mapping.
export function resolveStockMatch(ingredient) {
  if (ingredient.stockItem === null) {
    return null;
  }

  if (typeof ingredient.stockItem === "string") {
    const wanted = ingredient.stockItem.trim().toLowerCase();
    const exact = state.stockItems.find((item) => item.name.trim().toLowerCase() === wanted);

    if (exact) {
      return exact;
    }

    // The AI named a stock item slightly differently than it's stored.
    // Retry with normalized matching; if it still can't be verified, treat the
    // ingredient as not in stock (the safer assumption when shopping).
    return findMatchingStockItem(ingredient.stockItem);
  }

  return findMatchingStockItem(ingredient.name);
}

export function matchRecipeIngredients(recipe) {
  return recipe.ingredients.map((ingredient) => {
    const stockMatch = resolveStockMatch(ingredient);
    return {
      ...ingredient,
      stockMatch,
      inStock: stockMatch !== null,
      hasNutrition: stockMatch ? hasUsableNutrition(stockMatch.nutrition) : false
    };
  });
}

export function computeRecipeMacros(recipe, matchedIngredients) {
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
        // Fibre only counts when the pantry item has it; otherwise it stays unknown (null).
        if (typeof n.fiber100g === "number") {
          acc.fiber = (acc.fiber || 0) + n.fiber100g * factor;
        }
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null }
    );

    const servings = recipe.servings > 0 ? recipe.servings : 1;
    return {
      source: "calculated",
      perServing: {
        kcal: Math.round(totals.kcal / servings),
        protein: Math.round((totals.protein / servings) * 10) / 10,
        carbs: Math.round((totals.carbs / servings) * 10) / 10,
        fat: Math.round((totals.fat / servings) * 10) / 10,
        fiber: totals.fiber === null ? null : Math.round((totals.fiber / servings) * 10) / 10
      }
    };
  }

  const est = recipe.estimatedMacrosPerServing;
  if (
    est &&
    (est.kcal !== null || est.protein !== null || est.carbs !== null || est.fat !== null)
  ) {
    return { source: "estimated", perServing: est };
  }

  return { source: "unknown", perServing: null };
}

export function macroPillsHtml(macros) {
  if (!macros || macros.kcal === null) {
    return "";
  }
  const parts = [];
  if (macros.kcal !== null) parts.push(`${Math.round(macros.kcal)} kcal`);
  const t = aiText();
  if (macros.protein !== null) parts.push(`${macros.protein}g ${t.protein}`);
  if (macros.carbs !== null) parts.push(`${macros.carbs}g ${t.carbs}`);
  if (macros.fat !== null) parts.push(`${macros.fat}g ${t.fat}`);
  if (typeof macros.fiber === "number") parts.push(`${macros.fiber}g ${t.fiber}`);
  return parts;
}

export function renderAiRecipes(recipes) {
  const t = aiText();
  aiRecipeResults.innerHTML = "";
  state.aiRecipeEntries = [];
  state.aiToolbar = null;

  if (recipes.length > 0) {
    buildAiToolbar();
  }

  // Group by what is actually missing (checked against your pantry), not by
  // what the AI claimed, so the headings can't be wrong.
  const prepared = recipes.map((recipe) => {
    const matchedIngredients = matchRecipeIngredients(recipe);
    const missingCount = matchedIngredients.filter((ing) => !ing.inStock).length;
    return { recipe, matchedIngredients, missingCount };
  });
  prepared.sort((a, b) => (a.missingCount === 0 ? 0 : 1) - (b.missingCount === 0 ? 0 : 1));

  const readyCount = prepared.filter((p) => p.missingCount === 0).length;
  const extrasCount = prepared.length - readyCount;
  let lastGroup = null;

  prepared.forEach(({ recipe, matchedIngredients, missingCount }) => {
    const macroResult = computeRecipeMacros(recipe, matchedIngredients);
    const missingIngredients = matchedIngredients.filter((ing) => !ing.inStock);

    const group = missingCount === 0 ? "ready" : "extras";
    if (group !== lastGroup) {
      const groupHeading = document.createElement("h4");
      groupHeading.className = "ai-group-heading";
      groupHeading.textContent =
        group === "ready" ? t.groupReady(readyCount) : t.groupExtras(extrasCount);
      aiRecipeResults.appendChild(groupHeading);
      lastGroup = group;
    }

    const card = document.createElement("div");
    card.className = "ai-recipe-card";

    const headerRow = document.createElement("div");
    headerRow.className = "ai-recipe-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "ai-select-checkbox";
    checkbox.setAttribute("aria-label", t.selectRecipe(recipe.name));

    const heading = document.createElement("h3");
    heading.textContent = recipe.name;

    headerRow.appendChild(checkbox);
    headerRow.appendChild(heading);
    card.appendChild(headerRow);

    if (recipe.description !== "") {
      const desc = document.createElement("p");
      desc.className = "ai-recipe-description";
      desc.textContent = recipe.description;
      card.appendChild(desc);
    }

    const servingsLine = document.createElement("p");
    servingsLine.className = "item-meta";
    servingsLine.textContent = t.serves(recipe.servings, missingIngredients.length);
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
        macroResult.source === "calculated" ? t.sourceCalculated : t.sourceEstimated;
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
      label.textContent = formatIngredientLine(ing.name, ing.amount, ing.displayAmount);
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
    saveButton.textContent = t.saveRecipe;
    actions.appendChild(saveButton);

    const entry = { recipe, matchedIngredients, checkbox, saveButton };
    state.aiRecipeEntries.push(entry);

    saveButton.addEventListener("click", () => {
      saveAiRecipes([entry]);
    });
    checkbox.addEventListener("change", updateAiSelectionUi);

    if (isRecipeAlreadySaved(recipe.name)) {
      markAiEntrySaved(entry, t.alreadySaved);
    }

    // Cooking a suggestion saves it first (unless it already is), then opens the confirmation screen.
    const cookButton = document.createElement("button");
    cookButton.className = "secondary-button";
    cookButton.textContent = t.cookThis;
    cookButton.addEventListener("click", () => {
      if (!saveButton.disabled) {
        saveAiRecipes([entry]);
      }
      openCookDialog(buildSavedRecipeData(recipe, matchedIngredients));
    });
    actions.appendChild(cookButton);

    if (missingIngredients.length > 0) {
      const addMissingButton = document.createElement("button");
      addMissingButton.className = "secondary-button";
      addMissingButton.textContent = t.addMissing;
      addMissingButton.addEventListener("click", () => {
        const addedCount = addMissingIngredientsToShoppingList(missingIngredients, recipe.name);
        // Visible confirmation on the button itself, since the status line at the top is usually scrolled out of view.
        // Disabled afterwards so a second tap can't look like it did nothing.
        addMissingButton.textContent = addedCount > 0 ? t.addedToList : t.alreadyOnList;
        addMissingButton.disabled = true;
      });
      actions.appendChild(addMissingButton);
    }

    card.appendChild(actions);
    aiRecipeResults.appendChild(card);
  });

  updateAiSelectionUi();
  return { readyCount, extrasCount };
}

export function isRecipeAlreadySaved(name) {
  const lower = name.toLowerCase();
  return state.savedRecipes.some((r) => r.name.toLowerCase() === lower);
}

export function markAiEntrySaved(entry, label) {
  entry.saveButton.textContent = label;
  entry.saveButton.disabled = true;
  entry.checkbox.checked = false;
  entry.checkbox.disabled = true;
}

export function buildAiToolbar() {
  const toolbar = document.createElement("div");
  toolbar.className = "ai-recipe-toolbar";

  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "ai-select-all";
  const selectAllCheckbox = document.createElement("input");
  selectAllCheckbox.type = "checkbox";
  selectAllCheckbox.className = "ai-select-checkbox";
  selectAllLabel.appendChild(selectAllCheckbox);
  const t = aiText();
  selectAllLabel.appendChild(document.createTextNode(` ${t.selectAll}`));

  const saveSelectedButton = document.createElement("button");
  saveSelectedButton.className = "primary-button ai-toolbar-button";
  saveSelectedButton.textContent = t.saveSelected(0);

  const saveAllButton = document.createElement("button");
  saveAllButton.className = "secondary-button ai-toolbar-button";
  saveAllButton.textContent = t.saveAll(0);

  selectAllCheckbox.addEventListener("change", () => {
    state.aiRecipeEntries.forEach((entry) => {
      if (!entry.checkbox.disabled) {
        entry.checkbox.checked = selectAllCheckbox.checked;
      }
    });
    updateAiSelectionUi();
  });

  saveSelectedButton.addEventListener("click", () => {
    saveAiRecipes(state.aiRecipeEntries.filter((entry) => entry.checkbox.checked));
  });

  saveAllButton.addEventListener("click", () => {
    saveAiRecipes(state.aiRecipeEntries);
  });

  toolbar.appendChild(selectAllLabel);
  toolbar.appendChild(saveSelectedButton);
  toolbar.appendChild(saveAllButton);
  aiRecipeResults.appendChild(toolbar);

  state.aiToolbar = { selectAllCheckbox, saveSelectedButton, saveAllButton };
}

export function updateAiSelectionUi() {
  if (!state.aiToolbar) {
    return;
  }

  const selectable = state.aiRecipeEntries.filter((entry) => !entry.checkbox.disabled);
  const selectedCount = selectable.filter((entry) => entry.checkbox.checked).length;

  const t = aiText();
  state.aiToolbar.saveSelectedButton.textContent = t.saveSelected(selectedCount);
  state.aiToolbar.saveSelectedButton.disabled = selectedCount === 0;

  state.aiToolbar.saveAllButton.textContent = t.saveAll(selectable.length);
  state.aiToolbar.saveAllButton.disabled = selectable.length === 0;

  state.aiToolbar.selectAllCheckbox.disabled = selectable.length === 0;
  state.aiToolbar.selectAllCheckbox.checked =
    selectable.length > 0 && selectedCount === selectable.length;
}

export function buildSavedRecipeData(recipe, matchedIngredients) {
  return {
    name: recipe.name,
    description: typeof recipe.description === "string" ? recipe.description : "",
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions.slice() : [],
    servings: recipe.servings,
    servingLabel: "",
    ingredients: matchedIngredients.map((ing) => ({
      name: ing.name,
      // Unknown amounts are stored as null rather than 0, because loadRecipes() used to discard 0-gram ingredients on reload.
      grams: typeof ing.amount === "number" && ing.amount > 0 ? ing.amount : null,
      displayAmount: normalizeDisplayAmount(ing.displayAmount),
      // Which pantry item this ingredient is, so "Cook this" on the saved recipe deducts the right one.
      stockItem: ing.stockMatch ? ing.stockMatch.name : null,
      nutrition: ing.hasNutrition
        ? normalizeNutrition(ing.stockMatch.nutrition)
        : createEmptyNutrition()
    }))
  };
}

// Saves any number of suggested recipes in one go (used by the per-card
// button, "Save selected" and "Save all"). Recipes whose name is already
// saved are skipped rather than duplicated.
export function saveAiRecipes(entries) {
  const t = aiText();
  // Entries already marked as saved (button disabled) are ignored quietly.
  const pending = entries.filter((entry) => !entry.saveButton.disabled);

  if (entries.length === 0) {
    aiSuggestStatus.textContent = t.selectFirst;
    return;
  }

  if (pending.length === 0) {
    aiSuggestStatus.textContent =
      entries.length === 1 ? t.oneAlreadySaved(entries[0].recipe.name) : t.thoseAlreadySaved;
    return;
  }

  let savedCount = 0;
  let duplicateCount = 0;
  let lastSavedName = "";

  pending.forEach((entry) => {
    // Name already exists (e.g. saved from the manual builder meanwhile).
    if (isRecipeAlreadySaved(entry.recipe.name)) {
      duplicateCount++;
      markAiEntrySaved(entry, t.alreadySaved);
      return;
    }

    state.savedRecipes.push(buildSavedRecipeData(entry.recipe, entry.matchedIngredients));
    markAiEntrySaved(entry, t.saved);
    savedCount++;
    lastSavedName = entry.recipe.name;
  });

  if (savedCount > 0) {
    saveRecipes();
    renderSavedRecipes();
  }

  if (savedCount === 0) {
    aiSuggestStatus.textContent =
      pending.length === 1 ? t.nameExists(pending[0].recipe.name) : t.thoseAlreadySaved;
  } else if (savedCount === 1 && duplicateCount === 0) {
    aiSuggestStatus.textContent = t.savedOne(lastSavedName);
  } else {
    aiSuggestStatus.textContent = t.savedMany(savedCount, duplicateCount);
  }

  updateAiSelectionUi();
}

// Adds a recipe's missing ingredients to the shopping list in the amount you'd buy ("1" onion rather than 150 g).
// The kitchen measure and gram weight go into the item's note, so the recipe amount is still visible while shopping.
// Returns how many ingredients were added, so the button can show the right confirmation.
export function addMissingIngredientsToShoppingList(missingIngredients, recipeName) {
  const t = aiText();
  let addedCount = 0;

  missingIngredients.forEach((ing) => {
    const alreadyOnList = state.items.some(
      (item) => normalizeIngredientName(item.name) === normalizeIngredientName(ing.name)
    );
    if (alreadyOnList) {
      return;
    }

    const grams = typeof ing.amount === "number" && ing.amount > 0 ? ing.amount : null;
    const display = typeof ing.displayAmount === "string" ? ing.displayAmount.trim() : "";
    // A plain number such as "2" means a count of pieces; measures like "2 tbsp" aren't a shopping quantity.
    const pieceCount = /^\d+([.,]\d+)?$/.test(display)
      ? parseFloat(display.replace(",", "."))
      : null;

    let quantity = null;
    let unit = "";
    if (pieceCount !== null && pieceCount > 0) {
      quantity = pieceCount;
      unit = "pcs";
    } else if (display === "" && grams !== null) {
      // Ingredients measured in grams anyway (rice, cheese) keep their gram amount.
      quantity = grams;
      unit = "g";
    }

    const amountNote = display !== "" ? formatIngredientAmountText(grams, display) : "";
    const noteParts = [];
    if (recipeName) {
      noteParts.push(t.forRecipe(recipeName));
    }
    if (amountNote !== "" && unit !== "pcs") {
      noteParts.push(amountNote);
    } else if (amountNote !== "" && grams !== null) {
      noteParts.push(`${formatNutritionValue(grams)} g`);
    }

    state.items.push(
      createShoppingItem({ name: ing.name, quantity, unit, note: noteParts.join(": ") })
    );
    addedCount++;
  });

  saveItems();
  renderList();
  const message = addedCount > 0 ? t.addedCount(addedCount) : t.allOnList;
  aiSuggestStatus.textContent = message;
  // Short pop-up at the bottom of the screen, because the status line above may be out of view.
  showToast(message);
  return addedCount;
}

export async function handleSuggestRecipesClick() {
  if (!RecipeAI.hasApiKey()) {
    aiSuggestStatus.textContent = aiText().needKey;
    switchTab("settings");
    return;
  }

  suggestRecipesButton.disabled = true;
  const previousLabel = suggestRecipesButton.textContent;
  const t = aiText();
  suggestRecipesButton.textContent = t.thinking;
  aiSuggestStatus.textContent = t.asking;
  aiRecipeResults.innerHTML = "";

  const result = await RecipeAI.generateRecipes(state.stockItems, aiPreferencesInput.value, {
    language: getRecipeLanguage(),
    // Saved recipe names are sent so the AI suggests new recipes instead of ones you already have.
    avoidNames: state.savedRecipes.map((recipe) => recipe.name)
  });

  suggestRecipesButton.disabled = false;
  suggestRecipesButton.textContent = previousLabel;

  if (!result.ok) {
    aiSuggestStatus.textContent = result.message;
    return;
  }

  const counts = renderAiRecipes(result.recipes);
  const total = result.recipes.length;
  let message = t.gotRecipes(total, counts.readyCount, counts.extrasCount);

  if (counts.extrasCount === 0) {
    message += t.noneExtras;
  }

  aiSuggestStatus.textContent = message;
}
