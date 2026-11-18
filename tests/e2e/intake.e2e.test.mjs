// The intake log end to end: every way of logging (quick entry, pantry product in grams and in pieces,
// scanned product, product without data, "Ate this", "Cook this" with Undo), editing, deleting,
// past days, and the Today tab's totals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const FAKE_SCANNER = `
  window.__scanners = {};
  window.Html5Qrcode = class {
    constructor(id) { this.id = id; }
    async start(camera, config, onSuccess) { window.__scanners[this.id] = onSuccess; }
    async stop() { delete window.__scanners[this.id]; }
    clear() {}
  };
  window.__fakeScan = (id, code) => window.__scanners[id](code);
`;

const n = (kcal, protein, carbs, fat, fiber) => ({
  kcal100g: kcal,
  protein100g: protein,
  carbs100g: carbs,
  fat100g: fat,
  fiber100g: fiber
});

const STOCK = [
  {
    name: "Yoghurt",
    quantity: 500,
    unit: "g",
    barcode: "8710000000123",
    nutrition: n(60, 4, 5, 2, 0)
  },
  { name: "Eggs", quantity: 6, unit: "pcs", nutrition: n(140, 12, 1, 10, 0) }
];

const OMELET = {
  name: "Omelet",
  servings: 1,
  mealType: "breakfast",
  ingredients: [
    {
      name: "Ei",
      grams: 100,
      displayAmount: "2",
      stockItem: "Eggs",
      nutrition: n(140, 12, 1, 10, 0)
    }
  ]
};

test("logging food in every way adds up on the Today tab", { timeout: 90000 }, async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // 13:30 local time: new entries default to lunch.
  await page.clock.setFixedTime(new Date(2026, 10, 18, 13, 30));
  await page.route("**/vendor/html5-qrcode/html5-qrcode.min.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_SCANNER })
  );
  await page.route("https://world.openfoodfacts.org/**", (route) =>
    route.request().url().includes("8710000000999")
      ? route.fulfill({
          json: {
            status: 1,
            product: {
              product_name: "Chocolade",
              nutriments: {
                "energy-kcal_100g": 530,
                proteins_100g: 7,
                carbohydrates_100g: 55,
                fat_100g: 30
              }
            }
          }
        })
      : route.fulfill({ status: 404, json: { status: 0 } })
  );

  const log = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("grocery_scanner_intake_v1") || "[]"));
  const pantry = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("grocery_scanner_stock_v1")).map(
        (i) => `${i.name} ${i.quantity}`
      )
    );
  const summary = async () =>
    (await log()).map((e) => `${e.date} ${e.meal} ${e.name} ${e.unit}${e.quantity} ${e.status}`);
  const settle = () => page.waitForTimeout(150);

  try {
    await page.goto(`${server.url}/index.html`);
    await page.evaluate(
      ({ stock, recipe }) => {
        localStorage.setItem("grocery_scanner_stock_v1", JSON.stringify(stock));
        localStorage.setItem("grocery_scanner_recipes_v1", JSON.stringify([recipe]));
        localStorage.setItem(
          "grocery_scanner_targets_v1",
          JSON.stringify({ targets: { kcal: 2000 } })
        );
      },
      { stock: STOCK, recipe: OMELET }
    );
    await page.reload();
    await page.click('[data-tab="today"]');
    assert.equal(await page.isVisible("#todayEmptyMessage"), true);

    // 1. Quick entry (meal defaults to lunch at 13:30).
    await page.click("#quickEntryButton");
    await page.fill("#quickNameInput", "Lunch buiten de deur");
    await page.fill("#quickkcalInput", "700");
    await page.fill("#quickproteinInput", "30");
    await page.click("#logConfirmButton");

    // 2. A pantry product in grams, taken from the pantry.
    await page.click("#addProductButton");
    await page.selectOption("#logProductSelect", { label: "Yoghurt" });
    await page.fill("#logGramsInput", "150");
    assert.match(await page.textContent("#logDialog"), /Takes 150 g \(in pantry: 500 g\)/);
    await page.click("#logConfirmButton");
    assert.deepEqual(await pantry(), ["Yoghurt 350", "Eggs 6"]);

    // 3. A scanned product that isn't in the pantry: logged, pantry untouched.
    await page.click("#addProductButton");
    await page.click("#logScanButton");
    await settle();
    await page.evaluate(() => window.__fakeScan("logReader", "8710000000999"));
    await settle();
    assert.match(await page.textContent("#logDialog"), /Not in your pantry: Chocolade/);
    await page.fill("#logGramsInput", "20");
    await page.click("#logConfirmButton");

    // 4. A pantry item counted in pieces: the amount to take is entered by hand.
    await page.click("#addProductButton");
    await page.selectOption("#logProductSelect", { label: "Eggs" });
    await page.fill("#logGramsInput", "100");
    assert.equal(await page.isVisible("#logPantryAmountInput"), true);
    await page.fill("#logPantryAmountInput", "2");
    await page.click("#logConfirmButton");
    assert.deepEqual(await pantry(), ["Yoghurt 350", "Eggs 4"]);

    // 5. A product without any nutrition data: logged, but flagged as not counted.
    await page.click("#addProductButton");
    await page.click("#logScanButton");
    await settle();
    await page.evaluate(() => window.__fakeScan("logReader", "8710000000404"));
    await settle();
    await page.fill("#logGramsInput", "50");
    await page.click("#logConfirmButton");
    assert.match(await page.textContent("#todayNotCounted"), /1 entry is not fully counted/);

    // 6. "Ate this" on a saved recipe: 2 servings at breakfast (the recipe's meal type).
    await page.click('[data-tab="recipes"]');
    await page.click('#savedRecipesList button:text-is("Ate this")');
    await page.fill("#logQuantityInput", "2");
    await page.click("#logConfirmButton");

    // 7. "Cook this" logs 1 serving eaten; Undo removes it and restores the eggs.
    await page.click('#savedRecipesList button:text-is("Cook this")');
    await page.waitForSelector("#cookDialog[open]");
    assert.equal(await page.inputValue("#cookEatenInput"), "1");
    await page.click("#cookConfirmButton");
    assert.equal((await log()).length, 7);
    assert.deepEqual(await pantry(), ["Yoghurt 350", "Eggs 2"]);
    await page.click("#toast .toast-action");
    assert.equal((await log()).length, 6);
    assert.deepEqual(await pantry(), ["Yoghurt 350", "Eggs 4"]);

    assert.deepEqual(await summary(), [
      "2026-11-18 lunch Lunch buiten de deur 1 complete",
      "2026-11-18 lunch Yoghurt g150 complete",
      "2026-11-18 lunch Chocolade g20 complete",
      "2026-11-18 lunch Eggs g100 complete",
      "2026-11-18 lunch Product 8710000000404 g50 unknown",
      "2026-11-18 breakfast Omelet serving2 complete"
    ]);

    // Today's kcal: 700 + 90 (yoghurt) + 106 (chocolate) + 140 (eggs) + 280 (2 omelets) = 1316.
    await page.click('[data-tab="today"]');
    assert.match(await page.textContent("#todayProgress"), /1316 \/ 2000/);
    assert.match(await page.textContent("#todayMeals"), /Breakfast280 \/ 500 kcal/);

    // Edit: 300 g of yoghurt instead of 150 g doubles its kcal (90 → 180).
    await page.click('#todayEntries li:has-text("Yoghurt") button:text-is("Edit")');
    await page.fill("#logQuantityInput", "300");
    await page.click("#logConfirmButton");
    assert.match(await page.textContent("#todayProgress"), /1406 \/ 2000/);

    // Delete the unknown product; the note disappears.
    await page.click('#todayEntries li:has-text("Product 8710000000404") button:text-is("Delete")');
    assert.equal(await page.textContent("#todayNotCounted"), "");

    // A forgotten entry on yesterday goes to yesterday, and shows in the week chart.
    await page.click('button[aria-label="Previous day"]');
    assert.equal(await page.inputValue("#todayDateInput"), "2026-11-17");
    assert.equal(await page.isVisible("#todayEmptyMessage"), true);
    await page.click("#quickEntryButton");
    await page.fill("#quickNameInput", "Pizza");
    await page.fill("#quickkcalInput", "900");
    await page.click("#logConfirmButton");
    assert.equal((await log()).at(-1).date, "2026-11-17");
    await page.click("#todayTodayButton");
    const week = await page.$$eval("#weekChart table tr", (rows) => rows.map((r) => r.textContent));
    assert.deepEqual(week.slice(-2), ["2026-11-17900 kcal", "2026-11-181406 kcal"]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
