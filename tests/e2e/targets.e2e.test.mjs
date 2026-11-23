// Daily targets: the calculator fills the targets, a meal split must add up to 100%, and recipes get a
// fit badge against their meal's share (kcal within 10% = good fit; macros flagged above 125% / below 75%).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

// Dinner is 35% of 2723 kcal = 953 kcal; 400 g at 238 kcal/100 g = 952 kcal, macros within range.
const DINNER = {
  name: "Stamppot",
  servings: 1,
  mealType: "dinner",
  ingredients: [
    {
      name: "Stamppot",
      grams: 400,
      nutrition: { kcal100g: 238, protein100g: 12.6, carbs100g: 29, fat100g: 8, fiber100g: 3.3 }
    }
  ]
};
// Saved before meal types existed: no meal type, so it gets the hint instead of a badge.
const OLD_RECIPE = { ...DINNER, name: "Oud recept", mealType: undefined };

// Lunch is 30% of 2723 = 817 kcal; 1200 kcal is 47% too much, and 20 g protein is under 75% of 43.2 g.
const AI_REPLY = {
  ready: [
    {
      name: "Grote wrap",
      description: "Veel.",
      servings: 1,
      mealType: "lunch",
      ingredients: [{ name: "Wrap", amount: 300, unit: "g", displayAmount: "3", stockItem: null }],
      instructions: ["Vul de wrap."],
      estimatedMacrosPerServing: { kcal: 1200, protein: 20, carbs: 100, fat: 30, fiber: 12 }
    }
  ],
  needsExtras: []
};

test(
  "targets are calculated and recipes get a fit badge for their meal",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // AI recipe values here are fixed test numbers, so the NEVO table included with the app is left out
    // (tests/e2e/nevo.e2e.test.mjs covers it).
    await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
    await page.route("https://api.anthropic.com/**", (route) =>
      route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: {
          content: [{ type: "text", text: JSON.stringify(AI_REPLY) }],
          stop_reason: "end_turn"
        }
      })
    );

    const storedTargets = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("grocery_scanner_targets_v1")));

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate(
        (recipes) => {
          localStorage.setItem("grocery_scanner_recipes_v1", JSON.stringify(recipes));
          localStorage.setItem(
            "grocery_scanner_stock_v1",
            JSON.stringify([{ name: "Rijst", quantity: 500, unit: "g" }])
          );
          localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
        },
        [DINNER, OLD_RECIPE]
      );
      await page.reload();

      // No targets yet: no badges and no hints.
      await page.click('[data-tab="recipes"]');
      assert.equal(await page.$("#savedRecipesList .fit-badge-row"), null);

      // The calculator needs complete body data, then fills in every target.
      await page.click('[data-tab="settings"]');
      await page.click("#calculateTargetsButton");
      assert.match(await page.textContent("#targetsStatus"), /Fill in/);
      await page.selectOption("#targetSexSelect", "male");
      for (const [id, value] of [
        ["#targetAgeInput", "35"],
        ["#targetHeightInput", "180"],
        ["#targetWeightInput", "80"]
      ]) {
        await page.fill(id, value);
        await page.dispatchEvent(id, "change");
      }
      await page.selectOption("#targetActivitySelect", "moderate");
      await page.click("#calculateTargetsButton");
      const shown = await page.$$eval(
        [
          "#targetKcalInput",
          "#targetProteinInput",
          "#targetCarbsInput",
          "#targetFatInput",
          "#targetFiberInput"
        ].join(","),
        (inputs) => inputs.map((input) => input.value)
      );
      assert.deepEqual(shown, ["2723", "144", "332", "91", "38"]);
      assert.equal((await storedTargets()).targets.kcal, 2723);

      // kcal can't be typed; changing a macro recalculates it (150 g protein: +6 g x 4 = 2747).
      assert.equal(await page.getAttribute("#targetKcalInput", "readonly"), "");
      await page.fill("#targetProteinInput", "150");
      await page.dispatchEvent("#targetProteinInput", "change");
      assert.equal(await page.inputValue("#targetKcalInput"), "2747");
      assert.match(await page.textContent("#targetsStatus"), /2747 kcal per day/);
      // Without carbs there is no kcal target, and the status says why.
      await page.fill("#targetCarbsInput", "");
      await page.dispatchEvent("#targetCarbsInput", "change");
      assert.equal(await page.inputValue("#targetKcalInput"), "");
      assert.match(await page.textContent("#targetsStatus"), /Set protein, carbs and fat/);
      // Back to the calculated targets for the badge checks below.
      await page.click("#calculateTargetsButton");

      // A meal split that doesn't add up to 100% is refused and not saved.
      await page.fill("#mealSplitSnackInput", "20");
      await page.dispatchEvent("#mealSplitSnackInput", "change");
      assert.match(await page.textContent("#targetsStatus"), /adds up to 110%/);
      assert.equal((await storedTargets()).mealSplit.snack, 10);
      await page.fill("#mealSplitSnackInput", "10");
      await page.dispatchEvent("#mealSplitSnackInput", "change");

      // Saved recipes: a good fit for dinner; the old recipe asks for a meal type.
      await page.click('[data-tab="recipes"]');
      const savedRows = await page.$$eval("#savedRecipesList .fit-badge-row", (rows) =>
        rows.map((row) => row.textContent)
      );
      assert.deepEqual(savedRows, [
        "Good fit for dinner",
        "Set a meal type to see how it fits your targets"
      ]);

      // AI suggestion for lunch: far too much, and low in protein.
      await page.click("#suggestRecipesButton");
      await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
      assert.equal(
        await page.textContent("#aiRecipeResults .fit-badge-row"),
        "Too much for lunch (+47% kcal)low in protein"
      );
      // Fibre from the AI's estimate is shown with the other macros.
      assert.match(await page.textContent("#aiRecipeResults .ai-macro-row"), /12g fibre/);

      // Give the old recipe a meal type in the builder; its badge appears and the type is stored.
      await page.click('#savedRecipesList li:nth-child(2) button:text-is("Load")');
      await page.selectOption("#recipeMealTypeSelect", "dinner");
      await page.click("#saveRecipeButton");
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("grocery_scanner_recipes_v1")).map((r) => r.mealType)
      );
      assert.deepEqual(stored, ["dinner", "dinner"]);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
