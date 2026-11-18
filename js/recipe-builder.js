// The manual recipe builder on the Recipes tab.
import {
  cancelRecipeEditButton,
  customIngredientBlock,
  customIngredientCarbsInput,
  customIngredientFatInput,
  customIngredientKcalInput,
  customIngredientNameInput,
  customIngredientProteinInput,
  duplicateRecipeButton,
  recipeBuilderMessage,
  recipeEditorModeText,
  recipeEmptyMessage,
  recipeGramsInput,
  recipeIngredientsList,
  recipeInstructionsInput,
  recipeItemSelect,
  recipeMissingNutritionNote,
  recipeNameInput,
  recipePer100gTotals,
  recipePerServingTotals,
  recipeServingLabelInput,
  recipeServingsInput,
  recipeTotals,
  recipeWeightTotals,
  saveRecipeButton
} from "./dom.js";
import {
  formatIngredientAmountText,
  formatNutritionTotalSummary,
  normalizeDisplayAmount,
  parseInstructionsText,
  parseOptionalNumberInput
} from "./format.js";
import { normalizeIngredientName } from "./items.js";
import {
  buildRecipePer100gSummaryFromIngredients,
  buildRecipePerServingDisplayFromIngredients,
  buildRecipeTotalsSummaryFromIngredients,
  buildRecipeWeightSummaryFromIngredients,
  hasAnyNutrition,
  normalizeNutrition
} from "./nutrition.js";
import { saveRecipes } from "./persistence.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { state } from "./state.js";
import { setStatus, showToast } from "./ui.js";

export function addRecipeOption(parent, value, item) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = hasAnyNutrition(item.nutrition)
    ? item.name
    : `${item.name} (no nutrition data)`;
  parent.appendChild(option);
}

export function renderRecipeItemOptions() {
  const previousValue = recipeItemSelect.value;
  const previousOption = recipeItemSelect.options[recipeItemSelect.selectedIndex];
  const previousLabel = previousOption ? previousOption.textContent : "";

  recipeItemSelect.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select an ingredient";
  recipeItemSelect.appendChild(placeholderOption);

  const byName = (a, b) => a.item.name.localeCompare(b.item.name);
  const pantryNames = new Set();

  const pantryEntries = state.stockItems.map((item, index) => ({ item, index })).sort(byName);

  if (pantryEntries.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "In your pantry";
    pantryEntries.forEach(({ item, index }) => {
      pantryNames.add(normalizeIngredientName(item.name));
      addRecipeOption(group, `stock:${index}`, item);
    });
    recipeItemSelect.appendChild(group);
  }

  // Skip list items that are already offered from the pantry.
  const listEntries = state.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !pantryNames.has(normalizeIngredientName(item.name)))
    .sort(byName);

  if (listEntries.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "On your shopping list";
    listEntries.forEach(({ item, index }) => {
      addRecipeOption(group, `list:${index}`, item);
    });
    recipeItemSelect.appendChild(group);
  }

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "+ Other ingredient (not in pantry)";
  recipeItemSelect.appendChild(customOption);

  // Keep the previous choice only if it still points at the same thing
  // (list positions shift when items are added or removed).
  const stillThere = Array.from(recipeItemSelect.options).some((option) => {
    return option.value === previousValue && option.textContent === previousLabel;
  });

  recipeItemSelect.value = stillThere ? previousValue : "";
  updateCustomIngredientVisibility();
}

export function updateCustomIngredientVisibility() {
  customIngredientBlock.classList.toggle("hidden", recipeItemSelect.value !== "custom");
}

export function setRecipeStatus(message) {
  recipeBuilderMessage.textContent = message;
  setStatus(message);
}

// Enter in an ingredient field adds the ingredient, just like the "Add ingredient" button.
// Previously these fields shared the Scanner tab's handler and submitted the shopping-list form instead.
export function handleEnterToAddIngredient(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addRecipeIngredient();
  }
}

export function addRecipeIngredient() {
  const selected = recipeItemSelect.value;
  const grams = parseOptionalNumberInput(recipeGramsInput.value);

  if (selected === "") {
    setRecipeStatus('Choose an ingredient first, or pick "Other ingredient" to add something new.');
    return;
  }

  if (grams === null || grams <= 0) {
    setRecipeStatus("Enter how many grams the recipe uses (more than 0).");
    return;
  }

  let name;
  let nutrition;

  if (selected === "custom") {
    name = customIngredientNameInput.value.trim();

    if (name === "") {
      setRecipeStatus("Type a name for the ingredient first.");
      customIngredientNameInput.focus();
      return;
    }

    nutrition = normalizeNutrition({
      kcal100g: parseOptionalNumberInput(customIngredientKcalInput.value),
      protein100g: parseOptionalNumberInput(customIngredientProteinInput.value),
      carbs100g: parseOptionalNumberInput(customIngredientCarbsInput.value),
      fat100g: parseOptionalNumberInput(customIngredientFatInput.value)
    });
  } else {
    const [kind, indexText] = selected.split(":");
    const index = Number(indexText);
    const source =
      kind === "stock" ? state.stockItems[index] : kind === "list" ? state.items[index] : null;

    if (!source) {
      setRecipeStatus("That item no longer exists. Pick another ingredient.");
      renderRecipeItemOptions();
      return;
    }

    name = source.name;
    nutrition = normalizeNutrition(source.nutrition);
  }

  // Manually added ingredients are entered in grams, so they have no separate kitchen measure.
  state.recipeIngredients.push({ name, grams, displayAmount: null, nutrition });

  recipeGramsInput.value = "";

  if (selected === "custom") {
    customIngredientNameInput.value = "";
    customIngredientKcalInput.value = "";
    customIngredientProteinInput.value = "";
    customIngredientCarbsInput.value = "";
    customIngredientFatInput.value = "";
  }

  renderRecipeBuilder();
  showToast(`${name} added to the recipe`);
  setRecipeStatus(
    hasAnyNutrition(nutrition)
      ? `Added "${name}" to the recipe.`
      : `Added "${name}" to the recipe. It has no nutrition data, so it isn't counted in the totals.`
  );
}

export function clearRecipeIngredients() {
  const hasAnything =
    state.recipeIngredients.length > 0 ||
    recipeNameInput.value.trim() !== "" ||
    recipeServingsInput.value.trim() !== "";

  if (!hasAnything) {
    setRecipeStatus("There is no recipe to clear.");
    return;
  }

  resetRecipeBuilder();
  setRecipeStatus("Recipe builder cleared.");
}

export function removeRecipeIngredient(index) {
  if (!state.recipeIngredients[index]) {
    return;
  }

  const removedName = state.recipeIngredients[index].name;
  state.recipeIngredients.splice(index, 1);
  renderRecipeBuilder();
  setRecipeStatus(`Removed "${removedName}" from the recipe.`);
}

export function renderRecipeBuilder() {
  recipeIngredientsList.innerHTML = "";

  if (state.recipeIngredients.length === 0) {
    recipeEmptyMessage.style.display = "block";
    recipeTotals.textContent = "";
    recipeWeightTotals.textContent = "";
    recipePer100gTotals.textContent = "";
    recipePerServingTotals.textContent = "";
    recipeMissingNutritionNote.textContent = "";
    return;
  }

  recipeEmptyMessage.style.display = "none";

  state.recipeIngredients.forEach((ingredient, index) => {
    const li = document.createElement("li");

    const infoWrap = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = ingredient.name;

    const gramsSpan = document.createElement("span");
    gramsSpan.className = "item-meta";
    gramsSpan.textContent = formatIngredientAmountText(ingredient.grams, ingredient.displayAmount);

    const totalsSpan = document.createElement("span");
    totalsSpan.className = "item-meta";
    totalsSpan.textContent = hasAnyNutrition(ingredient.nutrition)
      ? formatNutritionTotalSummary(ingredient.nutrition, ingredient.grams)
      : "No nutrition data (not counted in totals)";

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

  const missingNutritionCount = state.recipeIngredients.filter(
    (ingredient) => !hasAnyNutrition(ingredient.nutrition)
  ).length;
  recipeMissingNutritionNote.textContent =
    missingNutritionCount > 0
      ? `${missingNutritionCount} of ${state.recipeIngredients.length} ingredient${state.recipeIngredients.length === 1 ? "" : "s"} ha${missingNutritionCount === 1 ? "s" : "ve"} no nutrition data, so the totals are incomplete.`
      : "";
}

export function buildRecipeTotalsSummary() {
  const summary = buildRecipeTotalsSummaryFromIngredients(state.recipeIngredients);

  if (summary === "") {
    return "";
  }

  return `Recipe total: ${summary}`;
}

export function saveCurrentRecipe() {
  const recipeName = recipeNameInput.value.trim();
  const servings = parseOptionalNumberInput(recipeServingsInput.value);

  if (recipeName === "") {
    setRecipeStatus("Type a recipe name first.");
    return;
  }

  if (state.recipeIngredients.length === 0) {
    setRecipeStatus("Add at least one ingredient before saving the recipe.");
    return;
  }

  if (servings === null || servings <= 0) {
    setRecipeStatus("Servings must be greater than 0.");
    return;
  }

  const previousRecipe =
    state.editingSavedRecipeIndex !== null
      ? state.savedRecipes[state.editingSavedRecipeIndex]
      : null;

  const recipeData = {
    name: recipeName,
    description:
      previousRecipe && typeof previousRecipe.description === "string"
        ? previousRecipe.description
        : "",
    instructions: parseInstructionsText(recipeInstructionsInput.value),
    servings,
    servingLabel: recipeServingLabelInput.value.trim(),
    ingredients: state.recipeIngredients.map((ingredient) => {
      return {
        name: ingredient.name,
        grams: ingredient.grams,
        // Keeps the kitchen measure ("1", "2 tbsp") from AI recipes when the recipe is re-saved.
        displayAmount: normalizeDisplayAmount(ingredient.displayAmount),
        nutrition: normalizeNutrition(ingredient.nutrition)
      };
    })
  };

  const existingIndex = state.savedRecipes.findIndex((recipe) => {
    return recipe.name.toLowerCase() === recipeName.toLowerCase();
  });

  if (state.editingSavedRecipeIndex === null) {
    if (existingIndex !== -1) {
      setRecipeStatus(
        "A saved recipe already uses that name. Load it to edit, or rename this one."
      );
      return;
    }

    state.savedRecipes.push(recipeData);
    state.editingSavedRecipeIndex = state.savedRecipes.length - 1;
    setRecipeStatus(`Saved recipe "${recipeName}".`);
  } else {
    if (existingIndex !== -1 && existingIndex !== state.editingSavedRecipeIndex) {
      setRecipeStatus(
        "Another saved recipe already uses that name. Rename this recipe or duplicate it."
      );
      return;
    }

    state.savedRecipes[state.editingSavedRecipeIndex] = recipeData;
    setRecipeStatus(`Updated recipe "${recipeName}".`);
  }

  saveRecipes();
  renderSavedRecipes();
  updateRecipeEditorMode();
}

export function buildRecipePerServingSummary() {
  const servings = parseOptionalNumberInput(recipeServingsInput.value);

  if (servings === null || servings <= 0) {
    return "";
  }

  return buildRecipePerServingDisplayFromIngredients(
    state.recipeIngredients,
    servings,
    recipeServingLabelInput.value.trim()
  );
}

export function updateRecipeEditorMode() {
  if (state.editingSavedRecipeIndex === null) {
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

export function resetRecipeBuilder() {
  recipeNameInput.value = "";
  recipeServingsInput.value = "1";
  recipeServingLabelInput.value = "";
  recipeInstructionsInput.value = "";
  recipeItemSelect.value = "";
  recipeGramsInput.value = "";
  state.recipeIngredients = [];
  state.editingSavedRecipeIndex = null;

  renderRecipeBuilder();
  renderSavedRecipes();
  updateRecipeEditorMode();
}

export function cancelRecipeEdit() {
  if (state.editingSavedRecipeIndex === null) {
    setRecipeStatus("No saved recipe is being edited.");
    return;
  }

  resetRecipeBuilder();
  setRecipeStatus("Recipe edit cancelled.");
}

export function duplicateCurrentRecipe() {
  if (state.recipeIngredients.length === 0) {
    setRecipeStatus("There is no recipe to duplicate.");
    return;
  }

  state.editingSavedRecipeIndex = null;
  recipeNameInput.value = makeRecipeCopyName(recipeNameInput.value);
  updateRecipeEditorMode();
  setRecipeStatus("Recipe duplicated into a new unsaved copy.");
}

export function makeRecipeCopyName(baseName) {
  const trimmed = typeof baseName === "string" ? baseName.trim() : "";
  const base = trimmed === "" ? "Recipe" : trimmed;

  let candidate = `${base} Copy`;
  let counter = 2;

  while (
    state.savedRecipes.some((recipe) => recipe.name.toLowerCase() === candidate.toLowerCase())
  ) {
    candidate = `${base} Copy ${counter}`;
    counter += 1;
  }

  return candidate;
}

export function buildRecipeWeightSummary() {
  return buildRecipeWeightSummaryFromIngredients(state.recipeIngredients);
}

export function buildRecipePer100gSummary() {
  return buildRecipePer100gSummaryFromIngredients(state.recipeIngredients);
}
