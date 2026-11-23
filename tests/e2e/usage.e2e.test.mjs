// AI usage end to end: each answer's reported tokens add up in Settings with an estimated cost and a bar
// per day; a monthly token budget shows the share used, warns from 80%, and is remembered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const REPLY = {
  ready: [
    {
      name: "Rijst puur",
      description: "",
      servings: 1,
      mealType: "dinner",
      ingredients: [
        {
          name: "Rijst",
          amount: 100,
          unit: "g",
          displayAmount: null,
          stockItem: "Rijst",
          searchName: "rice white raw",
          estimatedPer100g: { kcal: 350, protein: 7, carbs: 77, fat: 1, fiber: 1 }
        }
      ],
      instructions: ["Kook."],
      estimatedMacrosPerServing: { kcal: 350, protein: 7, carbs: 77, fat: 1, fiber: 1 }
    }
  ],
  needsExtras: []
};

test(
  "AI usage adds up in Settings, with a cost estimate and a budget",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.clock.setFixedTime(new Date(2026, 10, 20, 12, 0));
    // Each answer reports 10,000 input and 30,000 output tokens: 0.001 + 0.015 = $0.016 at list price;
    // a suggestion makes two requests (stock-only and extras).
    // AI recipe values here are fixed test numbers, so the NEVO table included with the app is left out
    // (tests/e2e/nevo.e2e.test.mjs covers it).
    await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
    await page.route("https://api.anthropic.com/**", (route) =>
      route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: {
          content: [{ type: "text", text: JSON.stringify(REPLY) }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10000, output_tokens: 30000 }
        }
      })
    );
    await page.route("https://world.openfoodfacts.org/**", (route) =>
      route.fulfill({ json: { products: [] } })
    );
    const totals = () => page.textContent("#usageTotals");

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
      await page.click('[data-tab="settings"]');
      assert.equal(await totals(), "No AI requests yet this month.");
      assert.equal(await page.locator("#usageBudget").count(), 0);

      // Two suggestions, so four requests.
      await page.click('[data-tab="recipes"]');
      for (let i = 0; i < 2; i++) {
        await page.click("#suggestRecipesButton");
        await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
      }
      await page.click('[data-tab="settings"]');
      assert.equal(
        await totals(),
        "160,000 tokens (40,000 in · 120,000 out) · about $0.06 · 4 requests"
      );
      // Today's bar is drawn; earlier days of the month are empty.
      assert.equal(await page.locator("#usageChart rect.usage-out").count(), 1);
      assert.match(
        await page.textContent("#usageChart title >> nth=19"),
        /2026-11-20: 40,000 in, 120,000 out/
      );

      // A budget of 200,000 tokens: 80% used, so the warning shows; it is remembered after a restart.
      await page.fill("#tokenBudgetInput", "200000");
      await page.dispatchEvent("#tokenBudgetInput", "change");
      assert.equal(
        await page.textContent("#usageBudget"),
        "80% of your 200,000-token budget: nearly used up."
      );
      await page.reload();
      await page.click('[data-tab="settings"]');
      assert.equal(await page.inputValue("#tokenBudgetInput"), "200000");

      // The connection test counts too: 200,000 of 200,000 is the whole budget.
      await page.click("#testApiKeyButton");
      await page.waitForFunction(() =>
        /200,000 tokens/.test(document.getElementById("usageTotals").textContent)
      );
      assert.match(
        await page.textContent("#usageBudget"),
        /100% of your 200,000-token budget: budget used up\./
      );

      // Clearing the budget removes the bar.
      await page.fill("#tokenBudgetInput", "");
      await page.dispatchEvent("#tokenBudgetInput", "change");
      assert.equal(await page.locator("#usageBudget").count(), 0);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
