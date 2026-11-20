// The food search used wherever nutrition is looked up by name: NEVO foods first (local, works offline),
// then Open Food Facts products (online). Every result shows its source, as the NEVO conditions require.
import { formatNutritionSummary } from "./format.js";
import { searchNevo } from "./nevo.js";
import { searchProductsByName } from "./product-lookup.js";
import { state } from "./state.js";

const NEVO_LIMIT = 15;

// A chosen food in one shape whatever its source; NEVO values stay unchanged, "ml" foods are per 100 ml.
export function nevoChoice(food, version) {
  return {
    name: food.nameNl,
    detail: food.nameEn,
    unit: food.unit,
    nutrition: { ...food.nutrition },
    nutritionSource: "nevo",
    nevoVersion: version
  };
}

export function offChoice(product) {
  return {
    name: product.name,
    detail: product.brand,
    unit: "g",
    nutrition: product.nutrition,
    nutritionSource: "off",
    nevoVersion: null
  };
}

// The label shown next to a value: where it came from (NEVO also names its version).
export function sourceLabel(choice) {
  if (choice.nutritionSource === "nevo") {
    return choice.nevoVersion ? `NEVO ${choice.nevoVersion}` : "NEVO";
  }
  return choice.nutritionSource === "off" ? "Open Food Facts" : "";
}

// Adds a search box, a Search button and a result list to parent; onPick gets the chosen food.
// Returns the input, so a caller can prefill it (e.g. with a pantry item's name).
export function addFoodSearch(parent, { idPrefix, onPick }) {
  const row = document.createElement("div");
  row.className = "barcode-row";
  const input = document.createElement("input");
  input.type = "search";
  input.id = `${idPrefix}SearchInput`;
  input.placeholder = "e.g. onion raw, rice boiled";
  input.setAttribute("aria-label", "Search a food");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button";
  button.id = `${idPrefix}SearchButton`;
  button.textContent = "Search";
  row.append(input, button);

  const hint = document.createElement("p");
  hint.className = "hint-text";
  hint.textContent = state.nevo
    ? "NEVO foods first, then Open Food Facts products."
    : "Searches Open Food Facts. Import the NEVO table in Settings for generic foods.";
  const results = document.createElement("ul");
  results.className = "shopping-list food-results";
  results.id = `${idPrefix}SearchResults`;
  const status = document.createElement("p");
  status.className = "status-text";
  parent.append(row, hint, results, status);

  const addResult = (choice) => {
    const li = document.createElement("li");
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "item-button food-result";
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = choice.name;
    const meta = document.createElement("span");
    meta.className = "item-meta";
    meta.textContent = [
      choice.detail,
      sourceLabel(choice),
      formatNutritionSummary(choice.nutrition).replace(
        /^Per 100g/,
        choice.unit === "ml" ? "Per 100ml" : "Per 100g"
      )
    ]
      .filter(Boolean)
      .join(" · ");
    pick.append(name, meta);
    pick.addEventListener("click", () => {
      results.querySelectorAll(".food-result").forEach((other) => other.classList.remove("chosen"));
      pick.classList.add("chosen");
      status.textContent = `Chosen: ${choice.name} (${sourceLabel(choice)})`;
      onPick(choice);
    });
    li.appendChild(pick);
    results.appendChild(li);
  };

  // A newer search makes an older, still running online search drop its answer.
  let searchId = 0;
  const search = async () => {
    const query = input.value.trim();
    const id = ++searchId;
    results.innerHTML = "";
    if (query === "") {
      status.textContent = "Type a food to search for.";
      return;
    }
    const nevoFoods = state.nevo ? searchNevo(state.nevo.foods, query, NEVO_LIMIT) : [];
    nevoFoods.forEach((food) => addResult(nevoChoice(food, state.nevo.version)));
    status.textContent = "Searching Open Food Facts...";
    let products = [];
    try {
      products = await searchProductsByName(query);
    } catch (error) {
      if (id === searchId) {
        status.textContent =
          nevoFoods.length > 0
            ? "Open Food Facts couldn't be reached; NEVO results only."
            : "Open Food Facts couldn't be reached and nothing matched in NEVO.";
      }
      return;
    }
    if (id !== searchId) {
      return;
    }
    products.forEach((product) => addResult(offChoice(product)));
    status.textContent =
      nevoFoods.length + products.length === 0
        ? "Nothing found; try other words."
        : "Tap a result to choose it.";
  };
  button.addEventListener("click", search);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });
  return input;
}
