// NEVO end to end on a made-up table: importing the file, searching foods by name (NEVO first, then Open Food
// Facts), logging per gram and per ml with source labels and RIVM's reference, filling a pantry item, removing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";
import { makeFakeNevoXlsx } from "../helpers/make-xlsx.mjs";

const REFERENCE =
  "Based on data from NEVO online version 2099/1.0, RIVM, Bilthoven and other data sources";

test(
  "NEVO foods are imported, searched, logged and fill in pantry items",
  { timeout: 90000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());

    await page.clock.setFixedTime(new Date(2026, 10, 20, 13, 30));
    // This test works on a made-up table, so the NEVO table included with the app is made unavailable.
    await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
    // Open Food Facts name search: one product for "soep"; unreachable for "rijst".
    let offSearches = 0;
    await page.route("https://world.openfoodfacts.org/**", (route) => {
      const url = route.request().url();
      if (!url.includes("/cgi/search.pl")) {
        return route.fulfill({ status: 404, json: { status: 0 } });
      }
      offSearches++;
      if (url.includes("rijst")) {
        return route.abort();
      }
      return route.fulfill({
        json: {
          products: url.includes("soep")
            ? [
                {
                  product_name: "Tomatensoep",
                  brands: "Merk",
                  nutriments: {
                    "energy-kcal_100g": 40,
                    proteins_100g: 1,
                    carbohydrates_100g: 6,
                    fat_100g: 1
                  }
                },
                // Without nutrition data: never offered, as it can't fill anything in.
                { product_name: "Soepgroente", nutriments: {} }
              ]
            : []
        }
      });
    });

    const log = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("grocery_scanner_intake_v1") || "[]"));
    const settle = () => page.waitForTimeout(150);
    const search = async (query) => {
      await page.fill("#logSearchInput", query);
      await page.press("#logSearchInput", "Enter");
      await settle();
      return page.$$eval("#logSearchResults .food-result", (buttons) =>
        buttons.map((button) => button.textContent)
      );
    };

    try {
      await page.goto(`${server.url}/index.html`);
      await page.evaluate(() =>
        localStorage.setItem(
          "grocery_scanner_stock_v1",
          JSON.stringify([{ name: "Testrijst", quantity: 1, unit: "kg" }])
        )
      );
      await page.reload();

      // 1. Without NEVO the search says how to get it, and only Open Food Facts answers.
      await page.click('[data-tab="today"]');
      await page.click("#addFoodButton");
      assert.match(await page.textContent("#logDialog"), /Import the NEVO table in Settings/);
      assert.deepEqual(await search("soep"), [
        "TomatensoepMerk · Open Food Facts · Per 100g: 40 kcal · P 1g · C 6g · F 1g"
      ]);
      await page.click("#logDialog .action-row .secondary-button");

      // 2. Importing the file shows what is imported and the required reference; a wrong file is refused.
      await page.click('[data-tab="settings"]');
      await page.waitForFunction(() =>
        /couldn't be loaded/.test(document.getElementById("nevoStatus").textContent)
      );
      assert.equal(await page.isDisabled("#removeNevoButton"), true);
      await page.setInputFiles("#importNevoInput", {
        name: "notes.xlsx",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a workbook")
      });
      await page.waitForFunction(() =>
        /failed/.test(document.getElementById("nevoStatus").textContent)
      );
      assert.match(await page.textContent("#nevoStatus"), /Import failed: .*not an \.xlsx/);
      await page.setInputFiles("#importNevoInput", {
        name: "NEVO2099.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: makeFakeNevoXlsx()
      });
      await page.waitForFunction(() =>
        /Imported:/.test(document.getElementById("nevoStatus").textContent)
      );
      assert.equal(
        await page.textContent("#nevoStatus"),
        "Imported: NEVO 2099/1.0, 6 foods. Remove it to use the included table again."
      );
      assert.equal(await page.textContent("#nevoReference"), REFERENCE);

      // 3. A NEVO drink is logged in millilitres with its unchanged values; the day shows the reference.
      await page.click('[data-tab="today"]');
      await page.click("#addFoodButton");
      assert.deepEqual(await search("testmelk"), [
        "Testmelk halfvolTest milk semi-skimmed · NEVO 2099/1.0 · Per 100ml: 46 kcal · P 3.4g · C 4.7g · F 1.5g · Fib 0g"
      ]);
      await page.click("#logSearchResults .food-result");
      assert.equal(await page.textContent('label[for="logGramsInput"]'), "Millilitres eaten");
      await page.fill("#logGramsInput", "200");
      await page.click("#logConfirmButton");
      const milk = (await log()).at(-1);
      assert.deepEqual(
        [milk.name, milk.unit, milk.quantity, milk.status, milk.nutritionSource, milk.nevoVersion],
        ["Testmelk halfvol", "ml", 200, "complete", "nevo", "2099/1.0"]
      );
      assert.equal(milk.perUnit.kcal, 0.46);
      assert.match(await page.textContent("#todayEntries"), /200 ml · 92 kcal · NEVO/);
      assert.equal(await page.textContent("#todayNevoReference"), REFERENCE);

      // 4. An Open Food Facts result is labelled as such; a failed online search keeps the NEVO results.
      await page.click("#addFoodButton");
      await search("soep");
      await page.click("#logSearchResults .food-result");
      await page.fill("#logGramsInput", "250");
      await page.click("#logConfirmButton");
      assert.equal((await log()).at(-1).nutritionSource, "off");
      assert.match(await page.textContent("#todayEntries"), /250 g · 100 kcal · Open Food Facts/);
      await page.click("#addFoodButton");
      // The pantry item comes first, then the two NEVO foods.
      assert.deepEqual(
        (await search("testrijst")).map((text) => text.split(/in pantry|Test rice/)[0]),
        ["Testrijst", "Testrijst gekookt", "Testrijst onbereid"]
      );
      assert.match(
        await page.textContent("#logDialog"),
        /couldn't be reached; showing the other results/
      );
      await page.click("#logDialog .action-row .secondary-button");
      assert.equal(offSearches, 4);

      // 5. A pantry item without data gets NEVO values via "Find nutrition", prefilled with its name.
      await page.click('[data-tab="pantry"]');
      await page.click('button[aria-label="Find nutrition for Testrijst"]');
      assert.equal(await page.inputValue("#pantryNutritionSearchInput"), "Testrijst");
      await page.click("#pantryNutritionSearchButton");
      await settle();
      await page.click("#pantryNutritionSearchResults .food-result >> nth=0");
      await page.click("#logConfirmButton");
      const pantryItem = await page.evaluate(
        () => JSON.parse(localStorage.getItem("grocery_scanner_stock_v1"))[0]
      );
      assert.deepEqual(
        [pantryItem.nutrition.kcal100g, pantryItem.nutritionSource, pantryItem.nevoVersion],
        [130, "nevo", "2099/1.0"]
      );
      assert.match(await page.textContent("#stockList"), /Source: NEVO 2099\/1\.0/);
      assert.equal(
        await page.isVisible('button[aria-label="Find nutrition for Testrijst"]'),
        false
      );

      // 6. NEVO stays after a restart but is never part of the backup; Remove clears it.
      await page.reload();
      await page.click('[data-tab="settings"]');
      assert.equal(
        await page.textContent("#nevoStatus"),
        "Imported: NEVO 2099/1.0, 6 foods. Remove it to use the included table again."
      );
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click("#exportDataButton")
      ]);
      const backup = await (await download.createReadStream()).toArray();
      assert.doesNotMatch(Buffer.concat(backup).toString(), /Testappel|nevo_v1/);
      // Remove goes back to the included table (unavailable in this test).
      await page.click("#removeNevoButton");
      await page.waitForFunction(() =>
        /couldn't be loaded/.test(document.getElementById("nevoStatus").textContent)
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("grocery_scanner_nevo_v1")),
        null
      );

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);

test(
  "NEVO 2025/9.0 is included: it loads without an import and is searchable",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://world.openfoodfacts.org/**", (route) =>
      route.fulfill({ json: { products: [] } })
    );
    try {
      await page.goto(`${server.url}/index.html`);
      await page.click('[data-tab="settings"]');
      await page.waitForFunction(() =>
        /Included in the app/.test(document.getElementById("nevoStatus").textContent)
      );
      assert.equal(
        await page.textContent("#nevoStatus"),
        "Included in the app: NEVO 2025/9.0, 2,328 foods."
      );
      assert.equal(
        await page.textContent("#nevoReference"),
        "Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven and other data sources"
      );
      // The included table can't be removed; only an imported file can.
      assert.equal(await page.isDisabled("#removeNevoButton"), true);

      // A real NEVO food is found by name in Add food.
      await page.click('[data-tab="today"]');
      await page.click("#addFoodButton");
      await page.fill("#logSearchInput", "ui");
      await page.press("#logSearchInput", "Enter");
      await page.waitForSelector("#logSearchResults .food-result");
      assert.match(
        await page.textContent("#logSearchResults .food-result >> nth=0"),
        /^Ui rauwOnions raw · NEVO 2025\/9\.0/
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
