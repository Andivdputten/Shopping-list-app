// AI recipe suggestions: requesting them, matching ingredients to stock, showing and saving them.
import { openCookDialog } from "./cook-dialog.js";
import {
  aiPreferencesInput,
  aiRecipeResults,
  aiSuggestStatus,
  suggestRecipesButton
} from "./dom.js";
import { buildFitBadge } from "./fit-badge.js";
import { addFoodSearch } from "./food-search.js";
import {
  formatIngredientAmountText,
  formatIngredientLine,
  formatNutritionValue,
  normalizeDisplayAmount
} from "./format.js";
import {
  estimateChoice,
  initialIngredientChoice,
  offAutoChoice,
  recipeNutrition
} from "./ingredient-nutrition.js";
import { createShoppingItem, normalizeIngredientName } from "./items.js";
import { nevoReference } from "./nevo.js";
import { createEmptyNutrition, hasUsableNutrition, normalizeNutrition } from "./nutrition.js";
import { findMatchingStockItem } from "./pantry.js";
import { saveItems, saveRecipes } from "./persistence.js";
import { searchProductsByName } from "./product-lookup.js";
import { RecipeAI } from "./recipe-ai.js";
import { forLanguage } from "./recipe-ui-text.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { getRecipeLanguage } from "./settings.js";
import { renderList } from "./shopping-list.js";
import { state } from "./state.js";
import { switchTab } from "./tabs.js";
import { openLogDialog } from "./today.js";
import { normalizeMealType } from "./targets.js";
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
      hasNutrition: stockMatch ? hasUsableNutrition(stockMatch.nutrition) : false,
      // Where this ingredient's values come from: the pantry item, else NEVO; Open Food Facts is tried
      // afterwards (online), and the AI's estimate is the fallback (see js/ingredient-nutrition.js).
      choice: initialIngredientChoice(ingredient, { stockMatch, nevo: state.nevo })
    };
  });
}

// The values used for an ingredient right now: its chosen source, else the AI's estimate (or none).
function effectiveChoice(ing) {
  return ing.choice || estimateChoice(ing);
}

// An ingredient as stored in a saved recipe: grams, values and where they came from.
function nutritionIngredient(ing) {
  const choice = effectiveChoice(ing);
  return {
    grams: typeof ing.amount === "number" && ing.amount > 0 ? ing.amount : null,
    nutrition: choice ? normalizeNutrition(choice.nutrition) : createEmptyNutrition(),
    nutritionSource: choice ? choice.source : null,
    nevoVersion: choice ? choice.nevoVersion : null
  };
}

// Per-serving values from the ingredients' own sources. source: "calculated" (all from pantry, NEVO or
// Open Food Facts), "partlyEstimated" (some AI estimates per ingredient), "partial" (some without data and
// no recipe estimate), or the whole-recipe "estimated" when ingredient data is missing.
export function computeRecipeMacros(recipe, matchedIngredients) {
  const result = recipeNutrition(matchedIngredients.map(nutritionIngredient), recipe.servings);
  const est = recipe.estimatedMacrosPerServing;
  const hasEstimate =
    est && (est.kcal !== null || est.protein !== null || est.carbs !== null || est.fat !== null);

  // Some ingredients without any data would undercount (28 g of oil is 250 kcal), so then the AI's
  // whole-recipe estimate is the better number, as before per-ingredient sources existed.
  if (
    result.status === "complete" ||
    result.status === "estimated" ||
    (result.status === "partial" && !hasEstimate)
  ) {
    const source = { complete: "calculated", estimated: "partlyEstimated", partial: "partial" }[
      result.status
    ];
    return { source, perServing: result.perServing, nevoVersions: result.nevoVersions };
  }
  if (hasEstimate) {
    return { source: "estimated", perServing: est, nevoVersions: [] };
  }
  return { source: "unknown", perServing: null, nevoVersions: [] };
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

  const refreshers = [];
  const readyCount = prepared.filter((p) => p.missingCount === 0).length;
  const extrasCount = prepared.length - readyCount;
  let lastGroup = null;

  prepared.forEach(({ recipe, matchedIngredients, missingCount }) => {
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

    // The values, their source line and the fit badge; redrawn when an ingredient's source changes.
    const macroBox = document.createElement("div");
    macroBox.className = "ai-macro-box";
    card.appendChild(macroBox);
    const ingredientList = document.createElement("ul");
    ingredientList.className = "ai-ingredient-list";
    card.appendChild(ingredientList);
    const refresh = () => {
      renderMacroBox(macroBox, recipe, matchedIngredients);
      renderIngredientList(ingredientList, matchedIngredients, refresh);
    };
    refresh();
    refreshers.push({ matchedIngredients, refresh });

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
      // The AI's estimate goes along so logging what you ate has values when ingredients have no data.
      openCookDialog({
        ...buildSavedRecipeData(recipe, matchedIngredients),
        estimatedMacrosPerServing: recipe.estimatedMacrosPerServing
      });
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
  void lookUpMissingOnline(refreshers);
  return { readyCount, extrasCount };
}

// The macro pills, where the values come from, RIVM's reference when NEVO is used, and the fit badge.
function renderMacroBox(box, recipe, matchedIngredients) {
  const t = aiText();
  box.innerHTML = "";
  const macroResult = computeRecipeMacros(recipe, matchedIngredients);
  const pills = macroPillsHtml(macroResult.perServing);
  if (!pills) {
    return;
  }
  const macroRow = document.createElement("div");
  macroRow.className = "ai-macro-row";
  pills.forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "ai-macro-pill";
    pill.textContent = text;
    macroRow.appendChild(pill);
  });
  box.appendChild(macroRow);

  const sourceLine = document.createElement("p");
  sourceLine.className = "ai-macro-source";
  sourceLine.textContent = {
    calculated: t.sourceCalculated,
    partlyEstimated: t.sourcePartlyEstimated,
    partial: t.sourcePartial,
    estimated: t.sourceEstimated
  }[macroResult.source];
  box.appendChild(sourceLine);
  macroResult.nevoVersions.forEach((version) => {
    const reference = document.createElement("p");
    reference.className = "hint-text source-reference";
    reference.textContent = nevoReference(version);
    box.appendChild(reference);
  });

  const fitBadge = buildFitBadge(macroResult.perServing, recipe.mealType);
  if (fitBadge) {
    box.appendChild(fitBadge);
  }
}

// Each ingredient with its source ("Ui rauw · NEVO"); anything but a pantry item with data can be changed.
function renderIngredientList(list, matchedIngredients, refresh) {
  const t = aiText();
  list.innerHTML = "";
  matchedIngredients.forEach((ing) => {
    const li = document.createElement("li");
    const flag = document.createElement("span");
    flag.className = `ai-ingredient-flag ${ing.inStock ? "have" : "need"}`;
    flag.textContent = ing.inStock ? "✓" : "+";
    const label = document.createElement("span");
    label.textContent = formatIngredientLine(ing.name, ing.amount, ing.displayAmount);
    li.append(flag, label);

    const choice = effectiveChoice(ing);
    const source = document.createElement("span");
    source.className = "ai-ingredient-source";
    source.textContent = choice
      ? [choice.label, t.sourceLabels[choice.source]].filter(Boolean).join(" · ")
      : t.sourceLabels.none;
    li.appendChild(source);

    if (!(ing.choice && ing.choice.source === "pantry")) {
      const change = document.createElement("button");
      change.type = "button";
      change.className = "edit-button ai-change-source";
      change.textContent = t.changeSource;
      change.setAttribute("aria-label", `${t.changeSource}: ${ing.name}`);
      change.addEventListener("click", () => openIngredientSource(ing, refresh));
      li.appendChild(change);
    }
    list.appendChild(li);
  });
}

// Lets you pick another source for one ingredient: a NEVO or Open Food Facts food, or the AI's estimate.
function openIngredientSource(ing, refresh) {
  const t = aiText();
  const { body, addActions } = openLogDialog(t.changeSourceTitle(ing.name));
  let picked = null;
  const input = addFoodSearch(body, {
    idPrefix: "ingredientSource",
    onPick: (choice) => {
      picked = {
        source: choice.nutritionSource,
        label: choice.name,
        nutrition: normalizeNutrition(choice.nutrition),
        nevoVersion: choice.nevoVersion
      };
    }
  });
  input.value = ing.searchName || ing.name;
  const message = document.createElement("p");
  message.className = "status-text";
  const estimate = estimateChoice(ing);
  if (estimate) {
    const useEstimate = document.createElement("button");
    useEstimate.type = "button";
    useEstimate.className = "secondary-button";
    useEstimate.id = "useEstimateButton";
    useEstimate.textContent = t.useEstimate;
    useEstimate.addEventListener("click", () => {
      ing.choice = estimate;
      refresh();
      document.getElementById("logDialog").close();
    });
    body.appendChild(useEstimate);
  }
  body.appendChild(message);
  addActions(t.saveChoice, () => {
    if (!picked) {
      message.textContent = t.pickFirst;
      return false;
    }
    ing.choice = picked;
    refresh();
    return true;
  });
}

// Ingredients with neither pantry data nor a NEVO match are looked up in Open Food Facts, one at a time
// (its name search allows about 10 requests a minute), at most 8 per set of suggestions. Answers are kept
// per name, so the same ingredient in several recipes is looked up once.
const offCache = new Map();
let lookupRun = 0;
async function lookUpMissingOnline(refreshers) {
  const run = ++lookupRun;
  const pending = refreshers.flatMap(({ matchedIngredients, refresh }) =>
    matchedIngredients.filter((ing) => ing.choice === null).map((ing) => ({ ing, refresh }))
  );
  const names = [...new Set(pending.map(({ ing }) => ing.searchName || ing.name))].slice(0, 8);
  for (const name of names) {
    if (run !== lookupRun) {
      return;
    }
    if (!offCache.has(name)) {
      try {
        offCache.set(name, offAutoChoice(await searchProductsByName(name, 5)));
      } catch (error) {
        // Offline or refused: those ingredients keep the AI's estimate, and can still be changed by hand.
        return;
      }
    }
    const choice = offCache.get(name);
    if (run !== lookupRun || !choice) {
      continue;
    }
    pending
      .filter(({ ing }) => (ing.searchName || ing.name) === name && ing.choice === null)
      .forEach(({ ing, refresh }) => {
        ing.choice = choice;
        refresh();
      });
  }
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
    mealType: normalizeMealType(recipe.mealType),
    ingredients: matchedIngredients.map((ing) => ({
      name: ing.name,
      // Unknown amounts are stored as null rather than 0, because loadRecipes() used to discard 0-gram ingredients on reload.
      grams: typeof ing.amount === "number" && ing.amount > 0 ? ing.amount : null,
      displayAmount: normalizeDisplayAmount(ing.displayAmount),
      // Which pantry item this ingredient is, so "Cook this" on the saved recipe deducts the right one.
      stockItem: ing.stockMatch ? ing.stockMatch.name : null,
      // The values shown on the card, with their source, so the saved recipe adds up the same way.
      ...(({ nutrition, nutritionSource, nevoVersion }) => ({
        nutrition,
        nutritionSource,
        nevoVersion
      }))(nutritionIngredient(ing))
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
    avoidNames: state.savedRecipes.map((recipe) => recipe.name),
    // "" (any meal) or the one meal type all suggestions should suit.
    mealType: document.getElementById("aiMealTypeSelect").value
  });

  suggestRecipesButton.disabled = false;
  suggestRecipesButton.textContent = previousLabel;

  if (!result.ok) {
    aiSuggestStatus.textContent = result.message;
    return;
  }

  const counts = showSuggestions(result.recipes);
  const total = result.recipes.length;
  let message = t.gotRecipes(total, counts.readyCount, counts.extrasCount);

  if (counts.extrasCount === 0) {
    message += t.noneExtras;
  }

  aiSuggestStatus.textContent = message;
}

// The current suggestions, so a follow-up request can add to them instead of replacing them.
let shownRecipes = [];

// Shows the suggestions; when none needs extra ingredients (the AI left that group empty, or its
// "extras" turned out to be in your pantry), adds a button that asks for 3 such recipes. The button
// costs a request only when tapped, so nothing is spent on a case that may never happen.
function showSuggestions(recipes) {
  shownRecipes = recipes;
  const counts = renderAiRecipes(recipes);
  if (counts.extrasCount === 0 && recipes.length > 0) {
    const t = aiText();
    const more = document.createElement("button");
    more.type = "button";
    more.className = "secondary-button";
    more.id = "moreExtrasButton";
    more.textContent = t.moreWithExtras;
    more.addEventListener("click", () => requestExtras(more));
    aiRecipeResults.appendChild(more);
  }
  return counts;
}

async function requestExtras(button) {
  const t = aiText();
  button.disabled = true;
  button.textContent = t.thinking;
  aiSuggestStatus.textContent = t.asking;
  const result = await RecipeAI.generateRecipes(state.stockItems, aiPreferencesInput.value, {
    language: getRecipeLanguage(),
    // Also the names on screen, so the new recipes differ from the ones just suggested.
    avoidNames: [...state.savedRecipes, ...shownRecipes].map((recipe) => recipe.name),
    mealType: document.getElementById("aiMealTypeSelect").value,
    onlyExtras: true
  });
  if (!result.ok) {
    button.disabled = false;
    button.textContent = t.moreWithExtras;
    aiSuggestStatus.textContent = result.message;
    return;
  }
  const counts = showSuggestions([...shownRecipes, ...result.recipes]);
  aiSuggestStatus.textContent =
    t.gotExtras(result.recipes.length) + (counts.extrasCount === 0 ? t.noneExtras : "");
}
