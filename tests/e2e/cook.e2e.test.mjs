// "Cook this": the confirmation screen deducts the right amounts from the pantry, scales them by the
// servings cooked, puts used-up items on the shopping list, and Undo restores everything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const STOCK = [
  { name: "Rijst", quantity: 500, unit: "g" },
  { name: "Halfvolle melk", quantity: 1, unit: "l" },
  { name: "Eggs", quantity: 6, unit: "pcs" },
  { name: "Volkoren pasta", quantity: 1, unit: "pack" }
];

const RECIPE = {
  name: "Rijstpudding",
  servings: 2,
  ingredients: [
    { name: "Rijst", grams: 300, stockItem: "Rijst" },
    { name: "Melk", grams: 200, displayAmount: "2 dl", stockItem: "Halfvolle melk" },
    { name: "Ei", grams: 200, displayAmount: "4", stockItem: "Eggs" },
    { name: "Pasta", grams: 200, stockItem: "Volkoren pasta" },
    { name: "Kaneel", grams: 2, displayAmount: "1 tl", stockItem: null }
  ]
};

const AI_REPLY = {
  ready: [
    {
      name: "Omelet",
      description: "Snel.",
      servings: 1,
      ingredients: [{ name: "Ei", amount: 100, unit: "g", displayAmount: "2", stockItem: "Eggs" }],
      instructions: ["Bak."],
      estimatedMacrosPerServing: { kcal: 150, protein: 12, carbs: 1, fat: 10 }
    }
  ],
  needsExtras: []
};

test("cooking deducts from the pantry and Undo restores it", { timeout: 60000 }, async () => {
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
      json: { content: [{ type: "text", text: JSON.stringify(AI_REPLY) }], stop_reason: "end_turn" }
    })
  );

  const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), key);
  const pantry = async () =>
    (await stored("grocery_scanner_stock_v1")).map(
      (item) => `${item.name} ${item.quantity} ${item.unit}`
    );

  try {
    await page.goto(`${server.url}/index.html`);
    await page.evaluate(
      ({ stock, recipe }) => {
        localStorage.setItem("grocery_scanner_stock_v1", JSON.stringify(stock));
        localStorage.setItem("grocery_scanner_recipes_v1", JSON.stringify([recipe]));
        localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
      },
      { stock: STOCK, recipe: RECIPE }
    );
    await page.reload();
    await page.click('[data-tab="recipes"]');

    // Open the confirmation screen and cook 1 of the recipe's 2 servings.
    await page.click('#savedRecipesList button:text-is("Cook this")');
    await page.waitForSelector("#cookDialog[open]");
    await page.fill("#cookServingsInput", "1");
    const amounts = await page.$$eval("#cookDialog .cook-line", (lines) =>
      lines.map((line) => {
        const input = line.querySelector(".cook-amount");
        return `${line.querySelector(".cook-line-name").textContent}=${input ? input.value : "-"}`;
      })
    );
    assert.deepEqual(amounts, [
      "Rijst=150",
      "Melk → Halfvolle melk=0.1",
      "Ei → Eggs=2",
      // Grams can't come off a pack: the amount is left for you to enter.
      "Pasta → Volkoren pasta=",
      // Not in stock: no amount box.
      "Kaneel=-"
    ]);

    // Use the whole pack of pasta, then confirm.
    await page.fill("#cookDialog .cook-line:nth-child(4) .cook-amount", "1");
    await page.click("#cookConfirmButton");

    assert.deepEqual(await pantry(), ["Rijst 350 g", "Halfvolle melk 0.9 l", "Eggs 4 pcs"]);
    // The used-up pasta went on the shopping list.
    assert.deepEqual(
      (await stored("grocery_scanner_items_v6")).map((item) => item.name),
      ["Volkoren pasta"]
    );

    // Undo restores the pantry and takes the pasta off the list again.
    await page.click("#toast .toast-action");
    assert.deepEqual(await pantry(), [
      "Rijst 500 g",
      "Halfvolle melk 1 l",
      "Eggs 6 pcs",
      "Volkoren pasta 1 pack"
    ]);
    assert.deepEqual(await stored("grocery_scanner_items_v6"), []);

    // Cooking an AI suggestion saves it first; cancelling the screen changes nothing.
    await page.click("#suggestRecipesButton");
    await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
    await page.click('#aiRecipeResults button:text-is("Cook this")');
    await page.waitForSelector("#cookDialog[open]");
    assert.deepEqual(
      (await stored("grocery_scanner_recipes_v1")).map((recipe) => recipe.name),
      ["Rijstpudding", "Omelet"]
    );
    // The saved suggestion remembers which pantry item each ingredient is.
    assert.equal((await stored("grocery_scanner_recipes_v1"))[1].ingredients[0].stockItem, "Eggs");
    await page.click('#cookDialog button:text-is("Cancel")');
    assert.equal(await page.$("#cookDialog[open]"), null);
    assert.equal((await pantry())[2], "Eggs 6 pcs");

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
