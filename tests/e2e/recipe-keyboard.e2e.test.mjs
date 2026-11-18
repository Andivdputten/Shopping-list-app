// Pressing Enter in the recipe builder must act on the recipe, never on the shopping-list form
// on the Scanner tab (which it used to submit, adding stray items to the shopping list).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

test(
  "Enter in the recipe builder adds ingredients and never touches the shopping list",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();

    const shoppingListLength = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grocery_scanner_items_v6") || "[]").length
      );
    const ingredientNames = () =>
      page.$$eval("#recipeIngredientsList .item-name", (spans) => spans.map((s) => s.textContent));

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate(() =>
        localStorage.setItem(
          "grocery_scanner_stock_v1",
          JSON.stringify([{ name: "Rijst", quantity: 500, unit: "g" }])
        )
      );
      await page.reload();
      await page.click('[data-tab="scanner"]');
      // Leftover text in the shopping-list form: the old bug would have saved this as an item.
      await page.fill("#itemInput", "Should not be added");
      await page.click('[data-tab="recipes"]');

      // Enter in the recipe name, servings and serving label fields does nothing to the shopping list.
      for (const field of [
        "#recipeNameInput",
        "#recipeServingsInput",
        "#recipeServingLabelInput"
      ]) {
        await page.focus(field);
        await page.keyboard.press("Enter");
      }
      assert.equal(
        await shoppingListLength(),
        0,
        "Enter in a recipe field added a shopping-list item"
      );

      // Enter in the grams field adds the selected ingredient to the recipe.
      await page.selectOption("#recipeItemSelect", { label: "Rijst (no nutrition data)" });
      await page.fill("#recipeGramsInput", "150");
      await page.press("#recipeGramsInput", "Enter");
      assert.deepEqual(await ingredientNames(), ["Rijst"]);

      // The same works for a custom ingredient, from its name field.
      await page.selectOption("#recipeItemSelect", "custom");
      await page.fill("#customIngredientNameInput", "Ui");
      await page.fill("#recipeGramsInput", "100");
      await page.press("#customIngredientNameInput", "Enter");
      assert.deepEqual(await ingredientNames(), ["Rijst", "Ui"]);

      assert.equal(await shoppingListLength(), 0);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
