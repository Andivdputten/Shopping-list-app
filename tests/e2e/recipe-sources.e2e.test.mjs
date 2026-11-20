// Recipe nutrition per ingredient, end to end on a made-up NEVO table: an AI recipe takes each ingredient
// from the pantry, NEVO, Open Food Facts or the AI's estimate; a source can be changed; saving, logging and
// the recipe builder's "Other ingredient" search keep each source and show RIVM's reference.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";
import { makeFakeNevoXlsx } from "../helpers/make-xlsx.mjs";

const REFERENCE =
  "Based on data from NEVO online version 2099/1.0, RIVM, Bilthoven and other data sources";

const STOCK = [
  {
    name: "Testrijst",
    quantity: 500,
    unit: "g",
    nutrition: { kcal100g: 130, protein100g: 2.5, carbs100g: 28, fat100g: 0.3, fiber100g: 0.4 }
  }
];

const ingredient = (name, amount, searchName, estimate, stockItem = null) => ({
  name,
  amount,
  unit: "g",
  displayAmount: null,
  stockItem,
  searchName,
  estimatedPer100g: estimate
});
const est = (kcal, protein, carbs, fat, fiber) => ({ kcal, protein, carbs, fat, fiber });

const AI_REPLY = {
  ready: [],
  needsExtras: [
    {
      name: "Testschotel",
      description: "Alles door elkaar.",
      servings: 1,
      // The AI says dinner, but lunch was asked for: the chosen meal wins (see step 1).
      mealType: "dinner",
      ingredients: [
        ingredient("Rijst", 100, "rice white boiled", est(140, 3, 30, 0, 0), "Testrijst"),
        // NEVO: "Test apple raw".
        ingredient("Appel", 100, "test apple raw", est(52, 0.3, 14, 0.2, 2.4)),
        // Not in NEVO, found in Open Food Facts.
        ingredient("Soep", 200, "tomato soup", est(30, 1, 5, 1, 1)),
        // Found nowhere: the AI's own estimate.
        ingredient("Kruiden", 10, "dragon spice", est(300, 10, 50, 5, 20))
      ],
      instructions: ["Meng alles."],
      estimatedMacrosPerServing: est(400, 10, 60, 5, 5)
    }
  ]
};

test(
  "AI recipes, saved recipes and the builder use a source per ingredient",
  { timeout: 90000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.clock.setFixedTime(new Date(2026, 10, 20, 12, 30));
    let prompt = "";
    await page.route("https://api.anthropic.com/**", (route) => {
      prompt = route.request().postDataJSON().messages[0].content;
      return route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: {
          content: [{ type: "text", text: JSON.stringify(AI_REPLY) }],
          stop_reason: "end_turn"
        }
      });
    });
    const offQueries = [];
    await page.route("https://world.openfoodfacts.org/**", (route) => {
      const url = new URL(route.request().url());
      offQueries.push(url.searchParams.get("search_terms"));
      const soup = url.searchParams.get("search_terms") === "tomato soup";
      return route.fulfill({
        json: {
          products: soup
            ? [
                {
                  product_name: "Tomatensoep",
                  nutriments: {
                    "energy-kcal_100g": 40,
                    proteins_100g: 1,
                    carbohydrates_100g: 6,
                    fat_100g: 1
                  }
                }
              ]
            : []
        }
      });
    });

    const sources = () =>
      page.$$eval("#aiRecipeResults .ai-ingredient-source", (spans) =>
        spans.map((s) => s.textContent)
      );
    const cardText = () => page.textContent("#aiRecipeResults");

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate((stock) => {
        localStorage.setItem("grocery_scanner_stock_v1", JSON.stringify(stock));
        localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
      }, STOCK);
      await page.reload();
      await page.click('[data-tab="settings"]');
      await page.setInputFiles("#importNevoInput", {
        name: "NEVO2099.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: makeFakeNevoXlsx()
      });
      await page.waitForFunction(() =>
        /imported\./.test(document.getElementById("nevoStatus").textContent)
      );

      // 1. Each ingredient gets the best source: pantry, NEVO, Open Food Facts (looked up afterwards), estimate.
      await page.click('[data-tab="recipes"]');
      // Lunch only: the prompt asks for lunch recipes.
      assert.deepEqual(
        await page.$$eval("#aiMealTypeSelect option", (options) =>
          options.map((o) => o.textContent)
        ),
        ["Any meal", "Breakfast", "Lunch", "Dinner", "Snack"]
      );
      await page.selectOption("#aiMealTypeSelect", "lunch");
      await page.click("#suggestRecipesButton");
      await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
      await page.waitForFunction(() =>
        document.getElementById("aiRecipeResults").textContent.includes("Tomatensoep")
      );
      assert.deepEqual(await sources(), [
        "Testrijst · pantry",
        "Testappel rauw · NEVO",
        "Tomatensoep · Open Food Facts",
        "AI estimate"
      ]);
      // Only the ingredients without a pantry item or NEVO food are looked up online.
      assert.deepEqual(offQueries, ["tomato soup", "dragon spice"]);
      // 130 + 50 + 80 (soup) + 30 (estimate) = 290 kcal, flagged as partly estimated, with RIVM's reference.
      assert.match(await cardText(), /290 kcal/);
      assert.match(await cardText(), /some values are AI estimates/);
      assert.match(await cardText(), new RegExp(REFERENCE));
      // A pantry item with data has no Change button; the other three do.
      assert.equal(await page.locator("#aiRecipeResults .ai-change-source").count(), 3);

      // 2. Changing a source: the estimate is replaced by a NEVO food, and the values follow.
      await page.click('button[aria-label="Change: Kruiden"]');
      assert.equal(await page.inputValue("#ingredientSourceSearchInput"), "dragon spice");
      assert.equal(await page.isVisible("#useEstimateButton"), true);
      await page.fill("#ingredientSourceSearchInput", "testmelk");
      await page.press("#ingredientSourceSearchInput", "Enter");
      await page.click("#ingredientSourceSearchResults .food-result >> nth=0");
      await page.click("#logConfirmButton");
      assert.equal((await sources())[3], "Testmelk halfvol · NEVO");
      // 130 + 50 + 80 + 4.6 = 264.6 kcal, now fully calculated.
      assert.match(await cardText(), /265 kcal/);
      assert.match(
        await cardText(),
        /calculated per ingredient \(pantry, NEVO or Open Food Facts\)/
      );

      // 3. Saving keeps every ingredient's values and source; the saved recipe shows them and the reference.
      await page.click('#aiRecipeResults button:text-is("Save recipe")');
      const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem("grocery_scanner_recipes_v1"))[0]
      );
      assert.match(prompt, /Suggest 3 varied lunch recipes/);
      assert.equal(saved.mealType, "lunch");
      assert.deepEqual(
        saved.ingredients.map((i) => [
          i.name,
          i.nutritionSource,
          i.nevoVersion,
          i.nutrition.kcal100g
        ]),
        [
          ["Rijst", "pantry", null, 130],
          ["Appel", "nevo", "2099/1.0", 50],
          ["Soep", "off", null, 40],
          ["Kruiden", "nevo", "2099/1.0", 46]
        ]
      );
      await page.click('#savedRecipesList button:text-is("View")');
      const savedText = await page.textContent("#savedRecipesList");
      assert.match(savedText, /100 g Appel · NEVO/);
      assert.match(savedText, /200 g Soep · Open Food Facts/);
      assert.match(savedText, new RegExp(REFERENCE));

      // 4. Logging the saved recipe counts it as complete and shows the reference on the Today tab.
      await page.click('#savedRecipesList button:text-is("Ate this")');
      await page.click("#logConfirmButton");
      const entry = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("grocery_scanner_intake_v1")).at(-1)
      );
      assert.deepEqual(
        [entry.status, entry.nevoVersion, Math.round(entry.perUnit.kcal)],
        ["complete", "2099/1.0", 265]
      );
      await page.click('[data-tab="today"]');
      assert.equal(await page.textContent("#todayNevoReference"), REFERENCE);

      // 5. The builder's "Other ingredient" search fills in the name and values and keeps NEVO as source;
      //    changing a value by hand afterwards makes it "typed in".
      await page.click('[data-tab="recipes"]');
      await page.selectOption("#recipeItemSelect", "custom");
      await page.fill("#customIngredientSearchInput", "testappel");
      await page.press("#customIngredientSearchInput", "Enter");
      await page.click("#customIngredientSearchResults .food-result >> nth=0");
      assert.equal(await page.inputValue("#customIngredientNameInput"), "Testappel rauw");
      assert.equal(await page.inputValue("#customIngredientKcalInput"), "50");
      await page.fill("#recipeGramsInput", "100");
      await page.click("#addRecipeIngredientButton");
      assert.match(await page.textContent("#recipeIngredientsList"), /50 kcal.*· NEVO/);
      assert.match(await page.textContent("#recipeMissingNutritionNote"), new RegExp(REFERENCE));

      await page.selectOption("#recipeItemSelect", "custom");
      await page.fill("#customIngredientSearchInput", "testmelk");
      await page.press("#customIngredientSearchInput", "Enter");
      await page.click("#customIngredientSearchResults .food-result >> nth=0");
      await page.fill("#customIngredientKcalInput", "60");
      await page.fill("#recipeGramsInput", "100");
      await page.click("#addRecipeIngredientButton");
      assert.match(await page.textContent("#recipeIngredientsList"), /60 kcal.*· typed in/);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
