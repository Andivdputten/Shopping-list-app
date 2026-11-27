// Remembers which aisle (category) each item name was put in, on this device only, so a newly typed item
// lands in the right aisle. Deliberately left out of backups: it rebuilds itself from use.
import { AISLE_MEMORY_STORAGE_KEY } from "./constants.js";
import { normalizeCategory, normalizeIngredientName } from "./items.js";

const MAX_ENTRIES = 500;

function readMemory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AISLE_MEMORY_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

// Stores the aisle for a name. "No aisle" isn't remembered, so it never hides a pantry match.
export function rememberAisle(name, category) {
  const key = normalizeIngredientName(name);
  const aisle = normalizeCategory(category);
  if (key === "" || aisle === "") {
    return;
  }
  const memory = readMemory();
  if (memory[key] === aisle) {
    return;
  }
  delete memory[key];
  memory[key] = aisle;
  // Oldest names first in insertion order; drop them when the memory gets too big.
  const keys = Object.keys(memory);
  keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).forEach((old) => delete memory[old]);
  try {
    localStorage.setItem(AISLE_MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch (error) {
    // Only a convenience: without it, new items just start without an aisle.
  }
}

// The aisle for a typed name and where it came from: { category, source: "history" | "pantry" },
// or null when neither knows the name. What you chose before wins over the pantry.
export function suggestAisle(name, stockItems) {
  const key = normalizeIngredientName(name);
  if (key === "") {
    return null;
  }
  const remembered = normalizeCategory(readMemory()[key]);
  if (remembered !== "") {
    return { category: remembered, source: "history" };
  }
  const inPantry = (stockItems || []).find(
    (item) => normalizeIngredientName(item.name) === key && normalizeCategory(item.category) !== ""
  );
  return inPantry ? { category: normalizeCategory(inPantry.category), source: "pantry" } : null;
}
