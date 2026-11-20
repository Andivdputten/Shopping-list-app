// When no AI suggestion needs extra ingredients, a button asks for 3 that do; nothing is requested
// until it is tapped, and the new recipes are added below the ones already shown. Also covers the
// remembered "Complex recipes" switch, which applies to both requests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const recipe = (name, ingredients) => ({
  name,
  description: "",
  servings: 1,
  mealType: "dinner",
  ingredients: ingredients.map(([ingredientName, stockItem]) => ({
    name: ingredientName,
    amount: 100,
    unit: "g",
    displayAmount: null,
    stockItem,
    searchName: ingredientName,
    estimatedPer100g: { kcal: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 }
  })),
  instructions: ["Kook."],
  estimatedMacrosPerServing: { kcal: 300, protein: 10, carbs: 40, fat: 8, fiber: 2 }
});

// First answer: the "extras" recipe only uses stock, so after matching nothing needs extras.
const FIRST = {
  ready: [recipe("Rijst puur", [["Rijst", "Rijst"]])],
  needsExtras: [recipe("Rijst met melk", [["Melk", "Melk"]])]
};
const FOLLOW_UP = {
  ready: [],
  needsExtras: [
    recipe("Rijst met kip", [
      ["Rijst", "Rijst"],
      ["Kip", null]
    ])
  ]
};

test(
  "a follow-up request adds recipes that need extra ingredients",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const prompts = [];
    await page.route("https://api.anthropic.com/**", (route) => {
      prompts.push(route.request().postDataJSON().messages[0].content);
      // The first suggestion makes two requests (stock-only and extras); the button makes a third.
      const reply = prompts.length <= 2 ? FIRST : FOLLOW_UP;
      return route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn" }
      });
    });
    await page.route("https://world.openfoodfacts.org/**", (route) =>
      route.fulfill({ json: { products: [] } })
    );

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate(() => {
        localStorage.setItem(
          "grocery_scanner_stock_v1",
          JSON.stringify([
            { name: "Rijst", quantity: 500, unit: "g" },
            { name: "Melk", quantity: 1, unit: "l" }
          ])
        );
        localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
      });
      await page.reload();
      await page.click('[data-tab="recipes"]');
      // The "Complex recipes" switch is off by default, and stays on after a restart once turned on.
      assert.equal(await page.isChecked("#aiComplexToggle"), false);
      await page.check("#aiComplexToggle");
      await page.reload();
      await page.click('[data-tab="recipes"]');
      assert.equal(await page.isChecked("#aiComplexToggle"), true);
      await page.click("#suggestRecipesButton");
      await page.waitForSelector("#moreExtrasButton");

      // Both recipes turn out ready; the status says so and only one request was made.
      assert.match(await page.textContent("#aiSuggestStatus"), /tap the button below/);
      assert.equal(prompts.length, 2);

      await page.click("#moreExtrasButton");
      await page.waitForFunction(() =>
        document.getElementById("aiRecipeResults").textContent.includes("Rijst met kip")
      );
      assert.equal(prompts.length, 3);
      assert.match(prompts[2], /"ready": leave this empty/);
      // Both requests ask for elaborate recipes while the switch is on.
      assert.match(prompts[0], /Make every recipe elaborate/);
      assert.match(prompts[2], /Make every recipe elaborate/);
      // The recipes already on screen are listed so they aren't suggested again.
      assert.match(prompts[2], /- Rijst puur/);
      assert.match(prompts[2], /- Rijst met melk/);

      const text = await page.textContent("#aiRecipeResults");
      assert.match(text, /Ready to cook \(2\)/);
      assert.match(text, /Needs a few extra ingredients \(1\)/);
      assert.match(
        await page.textContent("#aiSuggestStatus"),
        /Added 1 recipe with extra ingredients\./
      );
      // An extras recipe is now shown, so the button is gone.
      assert.equal(await page.locator("#moreExtrasButton").count(), 0);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);

test(
  "when one of the two requests fails, the other half is still shown",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // The stock-only request is cut off at the token limit; the extras request answers normally.
    await page.route("https://api.anthropic.com/**", (route) => {
      const prompt = route.request().postDataJSON().messages[0].content;
      const extras = /"ready": leave this empty/.test(prompt);
      return route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: extras
          ? {
              content: [{ type: "text", text: JSON.stringify(FOLLOW_UP) }],
              stop_reason: "end_turn"
            }
          : { content: [{ type: "text", text: "{" }], stop_reason: "max_tokens" }
      });
    });
    await page.route("https://world.openfoodfacts.org/**", (route) =>
      route.fulfill({ json: { products: [] } })
    );

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate(() => {
        localStorage.setItem(
          "grocery_scanner_stock_v1",
          JSON.stringify([{ name: "Rijst", quantity: 500, unit: "g" }])
        );
        localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
      });
      await page.reload();
      await page.click('[data-tab="recipes"]');
      await page.click("#suggestRecipesButton");
      await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);

      assert.match(await page.textContent("#aiRecipeResults"), /Rijst met kip/);
      assert.match(
        await page.textContent("#aiSuggestStatus"),
        /\(The AI's answer was too long and got cut off\./
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
