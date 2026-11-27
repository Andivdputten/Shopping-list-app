// Reads what is typed into the shopping list's add box: "2 l milk", "milk 2l", "500g mince", "3 bananas".
// Pure functions with no page access, covered by tests/unit/add-parser.test.mjs.
import { normalizeIngredientName } from "./items.js";

// Words accepted for each of the app's units (the same units as the Scanner form's unit menu).
const UNIT_WORDS = {
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  ml: "ml",
  l: "l",
  ltr: "l",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  pack: "pack",
  packs: "pack",
  bottle: "bottle",
  bottles: "bottle",
  can: "can",
  cans: "can"
};

const NUMBER = "(\\d+(?:[.,]\\d+)?)";
const NUMBER_ONLY = new RegExp(`^${NUMBER}(?:x|×)?$`, "i");
const NUMBER_WITH_UNIT = new RegExp(`^${NUMBER}([a-z]+)$`, "i");

function unitFromWord(word) {
  return typeof word === "string" ? UNIT_WORDS[word.toLowerCase()] || null : null;
}

function toQuantity(text) {
  const value = parseFloat(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) / 1000 : null;
}

function capitalize(name) {
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}

// Splits typed text into { name, quantity, unit }. Amounts are only read at the start ("2 l milk",
// "2x milk", "500g mince") or as a number with a unit at the end ("milk 2l", "milk 2 l"). Anything
// else stays part of the name, so "7up", "2-in-1 shampoo" and "Tomatoes 400g x2" are left alone.
// A number without a unit gives a quantity without a unit, like "No unit" in the Scanner form.
export function parseAddInput(text) {
  const cleaned = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
  const plain = { name: cleaned, quantity: null, unit: "" };

  if (cleaned === "") {
    return plain;
  }

  const tokens = cleaned.split(" ");
  let quantity = null;
  let unit = "";
  let nameTokens = tokens;

  const first = tokens[0];
  const leadingNumber = first.match(NUMBER_ONLY);
  const leadingWithUnit = first.match(NUMBER_WITH_UNIT);

  if (leadingNumber && tokens.length > 1) {
    quantity = toQuantity(leadingNumber[1]);
    nameTokens = tokens.slice(1);
    if (/^[x×]$/i.test(nameTokens[0]) && nameTokens.length > 1) {
      nameTokens = nameTokens.slice(1);
    }
    const spacedUnit = unitFromWord(nameTokens[0]);
    if (spacedUnit && nameTokens.length > 1) {
      unit = spacedUnit;
      nameTokens = nameTokens.slice(1);
    }
  } else if (leadingWithUnit && unitFromWord(leadingWithUnit[2]) && tokens.length > 1) {
    quantity = toQuantity(leadingWithUnit[1]);
    unit = unitFromWord(leadingWithUnit[2]);
    nameTokens = tokens.slice(1);
  } else if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const trailingWithUnit = last.match(NUMBER_WITH_UNIT);
    const beforeLast = tokens[tokens.length - 2];
    if (trailingWithUnit && unitFromWord(trailingWithUnit[2])) {
      quantity = toQuantity(trailingWithUnit[1]);
      unit = unitFromWord(trailingWithUnit[2]);
      nameTokens = tokens.slice(0, -1);
    } else if (
      tokens.length > 2 &&
      unitFromWord(last) &&
      new RegExp(`^${NUMBER}$`).test(beforeLast)
    ) {
      quantity = toQuantity(beforeLast);
      unit = unitFromWord(last);
      nameTokens = tokens.slice(0, -2);
    }
  }

  const name = nameTokens.join(" ");
  // "2 l" or "3 cans" alone: the unit word is not a name, so nothing is read from it.
  const onlyAUnit = nameTokens.length === 1 && unitFromWord(nameTokens[0]) !== null;
  if (quantity === null || name === "" || onlyAUnit) {
    return plain;
  }

  return { name: capitalize(name), quantity, unit };
}

// The list item with exactly the same name (ignoring case, spacing and a plural s), or null.
export function findSameNameItem(items, name) {
  const wanted = normalizeIngredientName(name);
  if (wanted === "") {
    return null;
  }
  return items.find((item) => normalizeIngredientName(item.name) === wanted) || null;
}

// How a typed amount can be added to an item already on the list: the new quantity and unit, or null
// when it can't (nothing typed, or different units such as "pack" and "g").
export function mergedAmount(existing, parsed) {
  if (parsed.quantity === null) {
    return null;
  }
  const existingQuantity =
    typeof existing.quantity === "number" && existing.quantity > 0 ? existing.quantity : null;
  if (existingQuantity === null) {
    return { quantity: parsed.quantity, unit: parsed.unit };
  }
  const existingUnit = (existing.unit || "").trim().toLowerCase();
  if (existingUnit !== parsed.unit) {
    return null;
  }
  return {
    quantity: Math.round((existingQuantity + parsed.quantity) * 1000) / 1000,
    unit: parsed.unit
  };
}
