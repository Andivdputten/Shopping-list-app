// Unit tests for per-ingredient nutrition sources (js/ingredient-nutrition.js) and NEVO best matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateChoice,
  initialIngredientChoice,
  offAutoChoice,
  recipeNutrition
} from "../../js/ingredient-nutrition.js";
import { bestNevoMatch } from "../../js/nevo.js";

const n = (kcal, protein, carbs, fat, fiber) => ({
  kcal100g: kcal,
  protein100g: protein,
  carbs100g: carbs,
  fat100g: fat,
  fiber100g: fiber
});
const food = (code, nameNl, nameEn, nutrition) => ({
  code,
  nameNl,
  nameEn,
  synonym: "",
  group: "",
  unit: "g",
  nutrition
});

// Made-up foods named in NEVO's style (main food first, then variety and state).
const FOODS = [
  food(1, "Testui rauw", "Onions raw", n(37, 1.3, 6.3, 0.2, 2.7)),
  food(2, "Testolie olijf", "Oil olive", n(900, 0, 0, 100, 0)),
  food(3, "Testolijven in blik", "Olives in brine tinned", n(150, 1, 1, 15, 3)),
  food(4, "Testtomaat in blik", "Tomatoes tinned", n(20, 1, 3, 0.2, 1)),
  food(
    5,
    "Testbonen in tomatensaus",
    "Beans white baked in tomato sauce tinned",
    n(90, 5, 13, 0.5, 5)
  ),
  food(6, "Testei rauw", "Egg whole chicken raw", n(140, 12.5, 0.5, 10, 0)),
  food(7, "Testaubergine", "Eggplant raw", n(20, 1, 3, 0.2, 2.5)),
  food(8, "Testpindakaas", "Peanut butter", n(630, 25, 13, 50, 7)),
  food(9, "Testboter gezouten", "Butter salted", n(740, 0.6, 0.6, 82, 0)),
  food(10, "Testpasta witte rauw", "Pasta white raw", n(350, 12, 70, 1.5, 3)),
  food(11, "Testzalm rauw", "Salmon raw", n(200, 20, 0, 13, 0)),
  food(12, "Testkipfilet rauw", "Chicken fillet raw", n(110, 24, 0, 1.5, 0))
];
const best = (query) => {
  const match = bestNevoMatch(FOODS, query);
  return match ? match.nameEn : null;
};

test("the best NEVO match ignores word order and prefers exact, leading, well-covered names", () => {
  assert.equal(best("onion raw"), "Onions raw");
  assert.equal(best("olive oil"), "Oil olive");
  assert.equal(best("tomatoes canned"), "Tomatoes tinned");
  assert.equal(best("egg whole raw"), "Egg whole chicken raw");
  assert.equal(best("egg"), "Egg whole chicken raw");
  assert.equal(best("butter"), "Butter salted");
  assert.equal(best("pasta uncooked"), "Pasta white raw");
  assert.equal(best("salmon fillet raw"), "Salmon raw");
  assert.equal(best("chicken breast raw"), "Chicken fillet raw");
});

test("state words alone never match, and unknown foods give no match", () => {
  assert.equal(best("raw"), null);
  assert.equal(best("canned"), null);
  assert.equal(best("zucchini raw"), null);
  assert.equal(best(""), null);
});

test("an ingredient's first choice: the pantry item, else NEVO, else nothing yet", () => {
  const nevo = { version: "2099/1.0", foods: FOODS };
  const stock = { name: "Uien", nutrition: n(40, 1, 7, 0, 2) };
  assert.deepEqual(initialIngredientChoice({ name: "ui" }, { stockMatch: stock, nevo }), {
    source: "pantry",
    label: "Uien",
    nutrition: n(40, 1, 7, 0, 2),
    nevoVersion: null
  });
  // A pantry item without data falls through to NEVO, matched on the English search name.
  const choice = initialIngredientChoice(
    { name: "cebola", searchName: "onion raw" },
    { stockMatch: { name: "Ui", nutrition: n(null, null, null, null, null) }, nevo }
  );
  assert.deepEqual(choice, {
    source: "nevo",
    label: "Testui rauw",
    nutrition: n(37, 1.3, 6.3, 0.2, 2.7),
    nevoVersion: "2099/1.0"
  });
  // A pantry item that was filled from NEVO keeps NEVO as its source.
  const nevoStock = {
    name: "Ui",
    nutrition: n(37, 1, 6, 0, 3),
    nutritionSource: "nevo",
    nevoVersion: "2099/1.0"
  };
  assert.equal(
    initialIngredientChoice({ name: "ui" }, { stockMatch: nevoStock, nevo: null }).source,
    "nevo"
  );
  assert.equal(initialIngredientChoice({ name: "drakensaus" }, { stockMatch: null, nevo }), null);
  assert.equal(initialIngredientChoice({ name: "ui" }, { stockMatch: null, nevo: null }), null);
});

test("an Open Food Facts product is only picked automatically with kcal and all three macros", () => {
  const partial = { name: "Soep zonder vet", nutrition: n(40, 1, 6, null, null) };
  const full = { name: "Tomatensoep", nutrition: n(40, 1, 6, 1, null) };
  assert.equal(offAutoChoice([partial]), null);
  assert.deepEqual(offAutoChoice([partial, full]), {
    source: "off",
    label: "Tomatensoep",
    nutrition: n(40, 1, 6, 1, null),
    nevoVersion: null
  });
  assert.equal(offAutoChoice([]), null);
});

test("the AI estimate per 100 g is the last resort", () => {
  assert.deepEqual(
    estimateChoice({ estimatedPer100g: { kcal: 50, protein: 1, carbs: 10, fat: 0, fiber: 2 } }),
    {
      source: "estimated",
      label: "",
      nutrition: n(50, 1, 10, 0, 2),
      nevoVersion: null
    }
  );
  assert.equal(estimateChoice({}), null);
  assert.equal(estimateChoice({ estimatedPer100g: { kcal: null } }), null);
});

test("recipe values per serving with a status and the NEVO versions used", () => {
  const ingredient = (grams, nutrition, nutritionSource, nevoVersion = null) => ({
    grams,
    nutrition,
    nutritionSource,
    nevoVersion
  });
  const onion = ingredient(200, n(37, 1.3, 6.3, 0.2, 2.7), "nevo", "2099/1.0");
  const oil = ingredient(20, n(900, 0, 0, 100, null), "pantry");
  const guess = ingredient(100, n(50, 1, 10, 0, 2), "estimated");
  const none = ingredient(100, n(null, null, null, null, null), null);

  assert.deepEqual(recipeNutrition([onion, oil], 2), {
    perServing: { kcal: 127, protein: 1.3, carbs: 6.3, fat: 10.2, fiber: 2.7 },
    status: "complete",
    nevoVersions: ["2099/1.0"]
  });
  assert.equal(recipeNutrition([onion, guess], 1).status, "estimated");
  assert.equal(recipeNutrition([onion, none], 1).status, "partial");
  assert.equal(recipeNutrition([{ ...onion, grams: null }], 1).status, "unknown");
  assert.equal(recipeNutrition([none], 1).perServing, null);
});
