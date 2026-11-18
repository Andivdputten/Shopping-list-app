// The list of saved recipes: viewing, loading into the builder and deleting.
import { aiText } from "./ai-recipes.js";
import { openCookDialog } from "./cook-dialog.js";
import {
  recipeInstructionsInput,
  recipeMealTypeSelect,
  recipeNameInput,
  recipeServingLabelInput,
  recipeServingsInput,
  savedRecipesEmptyMessage,
  savedRecipesList
} from "./dom.js";
import { buildFitBadge } from "./fit-badge.js";
import {
  formatIngredientLine,
  formatNutritionValue,
  formatRecipeServingsLabel,
  instructionsToText,
  normalizeDisplayAmount
} from "./format.js";
import { normalizeStockLink } from "./items.js";
import {
  buildRecipePer100gSummaryFromIngredients,
  buildRecipePerServingDisplayFromIngredients,
  buildRecipeTotalsSummaryFromIngredients,
  buildRecipeWeightSummaryFromIngredients,
  normalizeNutrition,
  sumRecipeNutrition
} from "./nutrition.js";
import { saveRecipes } from "./persistence.js";
import {
  renderRecipeBuilder,
  resetRecipeBuilder,
  setRecipeStatus,
  updateRecipeEditorMode
} from "./recipe-builder.js";
import { state } from "./state.js";
import { switchTab } from "./tabs.js";
import { openAteRecipe } from "./today.js";

export const expandedSavedRecipes = new Set();

export function buildSavedRecipeDetails(recipe) {
  const details = document.createElement("div");
  details.className = "saved-recipe-details";

  if (typeof recipe.description === "string" && recipe.description !== "") {
    const description = document.createElement("p");
    description.className = "ai-recipe-description";
    description.textContent = recipe.description;
    details.appendChild(description);
  }

  const ingredientsHeading = document.createElement("h4");
  ingredientsHeading.className = "saved-recipe-subheading";
  ingredientsHeading.textContent = "Ingredients";
  details.appendChild(ingredientsHeading);

  recipe.ingredients.forEach((ingredient) => {
    const line = document.createElement("div");
    line.className = "saved-recipe-line";
    line.textContent = formatIngredientLine(
      ingredient.name,
      ingredient.grams,
      ingredient.displayAmount
    );
    details.appendChild(line);
  });

  const stepsHeading = document.createElement("h4");
  stepsHeading.className = "saved-recipe-subheading";
  stepsHeading.textContent = "Cooking instructions";
  details.appendChild(stepsHeading);

  const steps = Array.isArray(recipe.instructions) ? recipe.instructions : [];

  if (steps.length === 0) {
    const none = document.createElement("p");
    none.className = "hint-text";
    none.textContent = "No cooking instructions saved for this recipe. Tap Load to add some.";
    details.appendChild(none);
  } else {
    steps.forEach((step, stepIndex) => {
      const row = document.createElement("div");
      row.className = "saved-step";

      const number = document.createElement("span");
      number.className = "saved-step-number";
      number.textContent = String(stepIndex + 1);

      const text = document.createElement("span");
      text.textContent = step;

      row.appendChild(number);
      row.appendChild(text);
      details.appendChild(row);
    });
  }

  return details;
}

export function renderSavedRecipes() {
  savedRecipesList.innerHTML = "";

  if (state.savedRecipes.length === 0) {
    savedRecipesEmptyMessage.style.display = "block";
    return;
  }

  savedRecipesEmptyMessage.style.display = "none";

  state.savedRecipes.forEach((recipe, index) => {
    const li = document.createElement("li");
    li.className = "saved-recipe-item";

    const infoWrap = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = recipe.name;

    const ingredientCountSpan = document.createElement("span");
    ingredientCountSpan.className = "item-meta";
    ingredientCountSpan.textContent = `${recipe.ingredients.length} ingredient(s) · ${formatRecipeServingsLabel(recipe.servings || 1, recipe.servingLabel)}`;

    const totalsSpan = document.createElement("span");
    totalsSpan.className = "item-meta";
    totalsSpan.textContent = `Total: ${buildRecipeTotalsSummaryFromIngredients(recipe.ingredients)}`;

    const weightSpan = document.createElement("span");
    weightSpan.className = "item-meta";
    weightSpan.textContent = buildRecipeWeightSummaryFromIngredients(recipe.ingredients);

    const per100gSpan = document.createElement("span");
    per100gSpan.className = "item-meta";
    per100gSpan.textContent = buildRecipePer100gSummaryFromIngredients(recipe.ingredients);

    const perServingSpan = document.createElement("span");
    perServingSpan.className = "item-meta";
    perServingSpan.textContent = buildRecipePerServingDisplayFromIngredients(
      recipe.ingredients,
      recipe.servings || 1,
      recipe.servingLabel || ""
    );

    infoWrap.appendChild(nameSpan);
    infoWrap.appendChild(ingredientCountSpan);
    infoWrap.appendChild(totalsSpan);
    infoWrap.appendChild(weightSpan);
    infoWrap.appendChild(per100gSpan);
    infoWrap.appendChild(perServingSpan);

    // Fit badge from the recipe's per-serving totals (only when targets are set and kcal is known).
    const totals = sumRecipeNutrition(recipe.ingredients);
    const servings = recipe.servings > 0 ? recipe.servings : 1;
    const perServing = totals && {
      kcal: totals.kcal / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
      fiber: totals.fiber === null ? null : totals.fiber / servings
    };
    const fitBadge = buildFitBadge(perServing, recipe.mealType);
    if (fitBadge) {
      infoWrap.appendChild(fitBadge);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const recipeKey = recipe.name.toLowerCase();
    const isOpen = expandedSavedRecipes.has(recipeKey);

    const viewButton = document.createElement("button");
    viewButton.className = "edit-button view-button";
    viewButton.textContent = isOpen ? "Hide" : "View";
    viewButton.setAttribute("aria-expanded", String(isOpen));
    viewButton.addEventListener("click", () => {
      if (expandedSavedRecipes.has(recipeKey)) {
        expandedSavedRecipes.delete(recipeKey);
      } else {
        expandedSavedRecipes.add(recipeKey);
      }
      renderSavedRecipes();
    });

    const loadButton = document.createElement("button");
    loadButton.className = "edit-button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => {
      loadSavedRecipe(index);
      switchTab("recipes");
    });

    const deleteRecipeButton = document.createElement("button");
    deleteRecipeButton.className = "delete-button";
    deleteRecipeButton.textContent = "Delete";
    deleteRecipeButton.addEventListener("click", () => {
      deleteSavedRecipe(index);
    });

    // Opens the confirmation screen that deducts this recipe's ingredients from the pantry.
    const cookButton = document.createElement("button");
    cookButton.className = "edit-button";
    cookButton.textContent = aiText().cookThis;
    cookButton.addEventListener("click", () => {
      openCookDialog(recipe);
    });

    // Logs a serving of this recipe as eaten today, without changing the pantry.
    const ateButton = document.createElement("button");
    ateButton.className = "edit-button";
    ateButton.textContent = aiText().ateThis;
    ateButton.addEventListener("click", () => {
      openAteRecipe(recipe);
    });

    actions.appendChild(cookButton);
    actions.appendChild(ateButton);
    actions.appendChild(viewButton);
    actions.appendChild(loadButton);
    actions.appendChild(deleteRecipeButton);

    li.appendChild(infoWrap);
    li.appendChild(actions);

    if (isOpen) {
      li.appendChild(buildSavedRecipeDetails(recipe));
    }

    savedRecipesList.appendChild(li);
  });
}

export function loadSavedRecipe(index) {
  const recipe = state.savedRecipes[index];

  if (!recipe) {
    return;
  }

  state.editingSavedRecipeIndex = index;
  recipeNameInput.value = recipe.name;
  recipeServingsInput.value = formatNutritionValue(
    typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : 1
  );
  recipeServingLabelInput.value =
    typeof recipe.servingLabel === "string" ? recipe.servingLabel : "";
  recipeInstructionsInput.value = instructionsToText(recipe.instructions);
  recipeMealTypeSelect.value = recipe.mealType || "";

  state.recipeIngredients = recipe.ingredients.map((ingredient) => {
    return {
      name: ingredient.name,
      grams: ingredient.grams,
      displayAmount: normalizeDisplayAmount(ingredient.displayAmount),
      stockItem: normalizeStockLink(ingredient.stockItem),
      nutrition: normalizeNutrition(ingredient.nutrition)
    };
  });

  renderRecipeBuilder();
  renderSavedRecipes();
  updateRecipeEditorMode();
  setRecipeStatus(`Loaded recipe "${recipe.name}" for editing.`);
}

export function deleteSavedRecipe(index) {
  const recipe = state.savedRecipes[index];

  if (!recipe) {
    return;
  }

  const removedName = recipe.name;
  state.savedRecipes.splice(index, 1);

  if (state.editingSavedRecipeIndex === index) {
    resetRecipeBuilder();
  } else if (state.editingSavedRecipeIndex !== null && index < state.editingSavedRecipeIndex) {
    state.editingSavedRecipeIndex -= 1;
  }

  saveRecipes();
  renderSavedRecipes();
  updateRecipeEditorMode();
  setRecipeStatus(`Deleted recipe "${removedName}".`);
}
