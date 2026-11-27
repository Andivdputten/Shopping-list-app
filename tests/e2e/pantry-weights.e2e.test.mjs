// Pantry amounts for AI recipes, on the user's own case: "Long grain rice, 1 pack" (5 kg) and "Ei, 30 pcs".
// A weight per pack is set in the pantry; the AI sees numbered items with total weights and answers with
// numbers; an exact name match is ticked even when the AI says "not in stock"; cooking deducts packs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const STOCK = [
  { name: "Long grain rice", quantity: 1, unit: "pack" },
  { name: "Ei", quantity: 30, unit: "pcs" }
];

const ingredient = (name, amount, stockId) => ({
  name,
  amount,
  unit: "g",
  displayAmount: null,
  stockId,
  searchName: name,
  estimatedPer100g: { kcal: 150, protein: 5, carbs: 20, fat: 5, fiber: 1 }
});
// A Dutch recipe: rice by number, and "Ei" left unmatched by the AI (the safety net ticks it).
const REPLY = {
  ready: [
    {
      name: "Gebakken rijst met ei",
      description: "",
      servings: 2,
      mealType: "dinner",
      ingredients: [ingredient("Rijst", 300, 1), ingredient("Ei", 120, null)],
      instructions: ["Kook de rijst.", "Bak het ei."],
      estimatedMacrosPerServing: { kcal: 500, protein: 15, carbs: 60, fat: 15, fiber: 2 }
    }
  ],
  needsExtras: []
};

test(
  "pack weights reach the AI, numbers become ticks, and cooking deducts packs",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const prompts = [];
    await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
    await page.route("https://api.anthropic.com/**", (route) => {
      prompts.push(route.request().postDataJSON().messages[0].content);
      return route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: { content: [{ type: "text", text: JSON.stringify(REPLY) }], stop_reason: "end_turn" }
      });
    });
    await page.route("https://world.openfoodfacts.org/**", (route) =>
      route.fulfill({ json: { products: [] } })
    );
    const pantry = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("grocery_scanner_stock_v1")).map(
          (i) => `${i.name} ${i.quantity} ${i.unit} ${i.packGrams}`
        )
      );

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate((stock) => {
        localStorage.setItem("grocery_scanner_stock_v1", JSON.stringify(stock));
        localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
      }, STOCK);
      await page.reload();

      // 1. Set the weight of the rice pack (5 kg) and of one egg (60 g) in the pantry.
      await page.click('[data-tab="pantry"]');
      await page.click('button[aria-label="Set weight per pack for Long grain rice"]');
      await page.fill("#packGramsDialogInput", "5000");
      await page.click("#logConfirmButton");
      await page.click('button[aria-label="Set weight per pcs for Ei"]');
      await page.fill("#packGramsDialogInput", "60");
      await page.click("#logConfirmButton");
      assert.match(await page.textContent("#stockList"), /5000 g per pack/);
      assert.match(await page.textContent("#stockList"), /60 g per pcs/);
      assert.deepEqual(await pantry(), ["Long grain rice 1 pack 5000", "Ei 30 pcs 60"]);
      assert.equal(
        await page.textContent('button[aria-label="Set weight per pack for Long grain rice"]'),
        "Weight"
      );

      // 2. The AI gets numbered items with their total weight.
      await page.click('[data-tab="recipes"]');
      await page.click("#suggestRecipesButton");
      await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
      assert.match(
        prompts[0],
        /- \[1\] Long grain rice \(1 pack of 5000 g each = 5000 g in total\)/
      );
      assert.match(prompts[0], /- \[2\] Ei \(30 pcs of 60 g each = 1800 g in total\)/);

      // 3. Both are ticked: rice by its number, egg by its exact name although the AI said "not in stock".
      const flags = await page.$$eval("#aiRecipeResults .ai-ingredient-flag", (spans) =>
        spans.map((span) => span.textContent)
      );
      assert.deepEqual(flags, ["✓", "✓"]);
      assert.match(await page.textContent("#aiRecipeResults"), /Ready to cook \(1\)/);

      // 4. Cooking deducts 300 g of rice as 0.06 pack and 120 g of egg as 2 pieces, without typing.
      await page.click('#aiRecipeResults button:text-is("Cook this")');
      await page.waitForSelector("#cookDialog[open]");
      const amounts = await page.$$eval("#cookDialog .cook-amount", (inputs) =>
        inputs.map((i) => i.value)
      );
      assert.deepEqual(amounts, ["0.06", "2"]);
      await page.click("#cookConfirmButton");
      assert.deepEqual(await pantry(), ["Long grain rice 0.94 pack 5000", "Ei 28 pcs 60"]);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
