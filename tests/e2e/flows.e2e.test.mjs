// End-to-end safety net: drives every main flow of the app in a real browser and compares
// what is on screen and in storage after each step with a recorded reference (flows.snapshot.json).
// Any change in behaviour or wording shows up as a diff. Re-record on purpose with: UPDATE_SNAPSHOTS=1 npm run test:e2e
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const SNAPSHOT_FILE = fileURLToPath(new URL("./flows.snapshot.json", import.meta.url));

// Stand-in for the camera scanner library: headless browsers have no camera, so tests "scan" by
// calling window.__fakeScan(readerId, barcode), which triggers the app's normal scan callback.
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

// Open Food Facts answers for the barcodes used below; any other barcode is "not found".
const PRODUCTS = {
  8710000000001: {
    product_name: "Halfvolle melk",
    brands: "Testmerk",
    quantity: "1 l",
    categories_tags: ["en:dairies", "en:milks"],
    nutrition_grades: "a",
    nutriments: {
      "energy-kcal_100g": 46,
      proteins_100g: 3.5,
      carbohydrates_100g: 4.8,
      fat_100g: 1.5
    }
  },
  8710000000002: {
    product_name: "Volkoren pasta",
    brands: "Testmerk",
    quantity: "500 g",
    categories_tags: ["en:pastas"],
    nutrition_grades: "a",
    nutriments: {
      "energy-kcal_100g": 350,
      proteins_100g: 13,
      carbohydrates_100g: 64,
      fat_100g: 2.5
    }
  }
};

// Mocked AI answer: one recipe that only uses stock, one that needs extra ingredients.
const AI_REPLY = {
  ready: [
    {
      name: "Pasta met melk",
      description: "Romige pasta.",
      servings: 2,
      ingredients: [
        { name: "Pasta", amount: 200, unit: "g", displayAmount: null, stockItem: "Volkoren pasta" },
        { name: "Melk", amount: 100, unit: "g", displayAmount: "1 dl", stockItem: "Halfvolle melk" }
      ],
      instructions: ["Kook de pasta 10 minuten.", "Roer de melk erdoor."],
      estimatedMacrosPerServing: { kcal: 400, protein: 15, carbs: 70, fat: 4 }
    }
  ],
  needsExtras: [
    {
      name: "Pasta met ui",
      description: "Pasta met gebakken ui.",
      servings: 2,
      ingredients: [
        { name: "Pasta", amount: 200, unit: "g", displayAmount: null, stockItem: "Volkoren pasta" },
        { name: "Ui", amount: 150, unit: "g", displayAmount: "1", stockItem: null },
        { name: "Olijfolie", amount: 28, unit: "g", displayAmount: "2 el", stockItem: null }
      ],
      instructions: ["Bak de ui.", "Meng met de pasta."],
      estimatedMacrosPerServing: { kcal: 450, protein: 14, carbs: 72, fat: 12 }
    }
  ]
};

// Everything a step can change: visible text of the main areas plus all stored data.
async function capture(page) {
  return page.evaluate(() => {
    const text = (id) => {
      const el = document.getElementById(id);
      return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
    };
    const value = (id) => document.getElementById(id).value;
    const storage = {};
    Object.keys(localStorage)
      .sort()
      .forEach((key) => {
        const raw = localStorage.getItem(key);
        try {
          storage[key] = JSON.parse(raw);
        } catch {
          storage[key] = raw;
        }
      });
    return {
      title: text("pageTitle"),
      status: text("status"),
      formTitle: text("formTitle"),
      form: [
        "itemInput",
        "quantityInput",
        "unitInput",
        "categoryInput",
        "noteInput",
        "nutritionKcalInput",
        "nutritionProteinInput",
        "nutritionCarbsInput",
        "nutritionFatInput",
        "nutritionAmountInput"
      ].map(value),
      barcodePreview: text("barcodePreview"),
      scannerMessage: text("scannerMessage"),
      shoppingSections: text("shoppingSections"),
      badges: [text("listTabBadge"), text("pantryTabBadge")],
      stockList: text("stockList"),
      pantryScanMessage: text("pantryScanMessage"),
      pantryUnknownText: text("pantryUnknownText"),
      recipeEditorModeText: text("recipeEditorModeText"),
      recipeBuilderMessage: text("recipeBuilderMessage"),
      recipeItemOptions: [...document.getElementById("recipeItemSelect").options].map(
        (o) => o.textContent
      ),
      recipeIngredientsList: text("recipeIngredientsList"),
      recipeTotals: text("recipeTotals"),
      savedRecipesList: text("savedRecipesList"),
      aiSection: [text("aiSectionTitle"), text("aiSectionHint"), text("suggestRecipesButton")],
      aiSuggestStatus: text("aiSuggestStatus"),
      aiRecipeResults: text("aiRecipeResults"),
      apiKeyStatus: text("apiKeyStatus"),
      backupStatus: text("backupStatus"),
      stats: [
        text("pantryMacroLegend"),
        text("pantryMacroCoverage"),
        text("listMacroLegend"),
        text("listMacroCoverage")
      ],
      toast: text("toast"),
      storage
    };
  });
}

test("main flows match the recorded reference", { timeout: 120000 }, async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // The mocked "product not found" answers are real 404s, which the browser always logs; they are expected.
    const fromProductLookup = (message.location().url || "").includes("openfoodfacts.org");
    if (message.type() === "error" && !fromProductLookup) errors.push(message.text());
  });

  await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"));
  await page.route("**/vendor/html5-qrcode/html5-qrcode.min.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_SCANNER })
  );
  await page.route("https://world.openfoodfacts.org/**", (route) => {
    const barcode = new URL(route.request().url()).pathname.split("/").pop();
    const product = PRODUCTS[barcode];
    return product
      ? route.fulfill({ json: { status: 1, product } })
      : route.fulfill({ status: 404, json: { status: 0 } });
  });
  // AI recipe values here are fixed test numbers, so the NEVO table included with the app is left out
  // (tests/e2e/nevo.e2e.test.mjs covers it).
  await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
  await page.route("https://api.anthropic.com/**", (route) => {
    const body = JSON.parse(route.request().postData());
    const text = body.output_config && body.output_config.format ? JSON.stringify(AI_REPLY) : "OK";
    return route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: {
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "text", text }
        ],
        stop_reason: "end_turn"
      }
    });
  });

  // Dialogs (confirm) are answered from this queue, in order; an empty queue means "cancel".
  const dialogAnswers = [];
  page.on("dialog", (dialog) => (dialogAnswers.shift() ? dialog.accept() : dialog.dismiss()));

  const steps = [];
  const record = async (name) => steps.push({ name, ...(await capture(page)) });

  // DOM helpers that work regardless of which tab is visible.
  const click = (selector) => page.evaluate((s) => document.querySelector(s).click(), selector);
  const clickButton = (containerId, label, nth = 0) =>
    page.evaluate(
      ({ containerId, label, nth }) => {
        const buttons = [...document.getElementById(containerId).querySelectorAll("button")].filter(
          (b) => b.textContent.trim() === label
        );
        if (!buttons[nth]) throw new Error(`No button "${label}" #${nth} in #${containerId}`);
        buttons[nth].click();
      },
      { containerId, label, nth }
    );
  const setValue = (id, value) =>
    page.evaluate(
      ({ id, value }) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { id, value }
    );
  const tab = (name) => click(`[data-tab="${name}"]`);
  const settle = () => page.waitForTimeout(150);
  // Waits until a button is clickable again. The app disables these buttons while a request runs,
  // so this is the reliable "finished" signal; matching status text was not, because the
  // in-progress message contains the same words as the result message.
  const waitUntilEnabled = (id) =>
    page.waitForFunction((buttonId) => !document.getElementById(buttonId).disabled, id);
  const scan = async (readerId, barcode) => {
    await page.evaluate(({ r, b }) => window.__fakeScan(r, b), { r: readerId, b: barcode });
    await settle();
  };

  try {
    await page.goto(`${server.url}/index.html`);
    await settle();
    await record("start");

    // Shopping list: quick add, search filter.
    await tab("list");
    await setValue("searchInput", "Appels");
    await click("#quickAddButton");
    await record("quick add");
    await setValue("searchInput", "zzz");
    await record("search with no match");
    await setValue("searchInput", "");

    // Scanner: known product, rescan of the same product, unknown product.
    await tab("scanner");
    await click("#startScannerButton");
    await settle();
    await scan("reader", "8710000000001");
    await record("scan known product");
    await setValue("quantityInput", "2");
    await click("#addButton");
    await record("add scanned product");
    await click("#startScannerButton");
    await settle();
    await scan("reader", "8710000000001");
    await record("rescan existing product");
    await click("#cancelEditButton");
    await click("#startScannerButton");
    await settle();
    await scan("reader", "8710000000099");
    await record("scan unknown product");
    await setValue("itemInput", "Mysterie");
    await setValue("categoryInput", "Pantry");
    await click("#addButton");
    await record("add unknown product by hand");
    await click("#startScannerButton");
    await settle();
    await scan("reader", "8710000000002");
    await click("#addButton");
    await record("add second known product");

    // List: mark bought, move to stock, edit, delete.
    await tab("list");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("#shoppingSections .item-button")].find((b) =>
        b.textContent.includes("Halfvolle melk")
      );
      button.click();
    });
    await record("mark bought");
    await clickButton("shoppingSections", "To stock");
    await record("move to stock");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("#shoppingSections .item-button")].find((b) =>
        b.textContent.includes("Volkoren pasta")
      );
      button.click();
    });
    await clickButton("shoppingSections", "To stock");
    await record("move pasta to stock");
    await clickButton("shoppingSections", "Edit");
    await setValue("itemInput", "Rode appels");
    await setValue("noteInput", "Elstar");
    await click("#addButton");
    await record("edit item");
    await clickButton("shoppingSections", "Delete", 1);
    await record("delete item");

    // Pantry: quantity controls, pantry scanner with known, unknown and skipped barcodes, return to list.
    await tab("pantry");
    await page.evaluate(() =>
      document.querySelector('[aria-label="Increase Halfvolle melk quantity"]').click()
    );
    await record("increase quantity");
    await page.evaluate(() =>
      document.querySelector('[aria-label="Decrease Volkoren pasta quantity"]').click()
    );
    await record("decrease quantity");
    await page.evaluate(() => {
      const input = document.querySelector('[aria-label="Volkoren pasta quantity"]');
      input.value = "750";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await record("set quantity");
    await click("#pantryScanButton");
    await settle();
    await scan("pantryReader", "8710000000001");
    await record("pantry scan known product");
    await scan("pantryReader", "8710000000077");
    await record("pantry scan unknown product");
    await setValue("pantryUnknownNameInput", "Kruidenmix");
    await click("#pantryUnknownAddButton");
    await record("pantry name unknown product");
    await scan("pantryReader", "8710000000066");
    await click("#pantryUnknownSkipButton");
    await record("pantry skip unknown product");
    await click("#pantryScanStopButton");
    await settle();
    await clickButton("stockList", "Return", 2);
    await record("return stock item to list");

    // Recipe builder: stock ingredient, custom ingredient, save, duplicate, view, load, edit, delete.
    await tab("recipes");
    await page.evaluate(() => {
      const select = document.getElementById("recipeItemSelect");
      const option = [...select.options].find((o) => o.textContent.startsWith("Volkoren pasta"));
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await setValue("recipeGramsInput", "250");
    await click("#addRecipeIngredientButton");
    await record("builder add stock ingredient");
    await setValue("recipeItemSelect", "custom");
    await setValue("customIngredientNameInput", "Tomatensaus");
    await setValue("customIngredientKcalInput", "40");
    await setValue("customIngredientProteinInput", "1.5");
    await setValue("customIngredientCarbsInput", "7");
    await setValue("customIngredientFatInput", "0.5");
    await setValue("recipeGramsInput", "200");
    await click("#addRecipeIngredientButton");
    await setValue("recipeNameInput", "Pasta rood");
    await setValue("recipeServingsInput", "2");
    await setValue("recipeServingLabelInput", "bord");
    await setValue("recipeInstructionsInput", "Kook de pasta.\nVerwarm de saus.");
    await record("builder filled in");
    await click("#saveRecipeButton");
    await record("builder save");
    await click("#duplicateRecipeButton");
    await record("builder duplicate");
    await click("#saveRecipeButton");
    await record("save duplicate");
    await clickButton("savedRecipesList", "View");
    await record("view saved recipe");
    await clickButton("savedRecipesList", "Load");
    await setValue("recipeServingsInput", "3");
    await click("#saveRecipeButton");
    await record("edit saved recipe");
    await clickButton("savedRecipesList", "Delete", 1);
    await record("delete saved recipe");
    await clickButton("recipeIngredientsList", "Remove");
    await record("builder remove ingredient");
    await click("#cancelRecipeEditButton");
    await record("builder cancel edit");

    // AI recipes: without key, then with key in English and Dutch, save and add missing.
    await click("#suggestRecipesButton");
    await record("ai without key");
    await setValue("apiKeyInput", "sk-ant-test");
    await click("#saveApiKeyButton");
    await click("#testApiKeyButton");
    await waitUntilEnabled("testApiKeyButton");
    await record("settings test connection");
    await tab("recipes");
    await click("#suggestRecipesButton");
    await waitUntilEnabled("suggestRecipesButton");
    await record("ai suggestions english");
    await clickButton("aiRecipeResults", "Save recipe");
    await record("ai save one");
    await clickButton("aiRecipeResults", "Add missing to list");
    await record("ai add missing");
    await setValue("recipeLanguageSelect", "nl");
    await click("#suggestRecipesButton");
    await waitUntilEnabled("suggestRecipesButton");
    await record("ai suggestions dutch");
    await clickButton("aiRecipeResults", "Alles opslaan (1)");
    await record("ai save all dutch");

    // Settings: backup export and import, clearing data with cancel and confirm.
    await tab("settings");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      click("#exportDataButton")
    ]);
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    steps.push({ name: "exported backup", file: download.suggestedFilename(), exported });
    await tab("pantry");
    await click("#clearStockButton");
    await record("clear stock cancelled");
    dialogAnswers.push(true);
    await click("#clearStockButton");
    await record("clear stock confirmed");
    dialogAnswers.push(true);
    await tab("list");
    await click("#clearButton");
    await record("clear list confirmed");
    await tab("settings");
    dialogAnswers.push(true);
    await Promise.all([
      page.waitForEvent("load"),
      page.setInputFiles("#importDataInput", await download.path())
    ]);
    await settle();
    await record("after import");
  } finally {
    await browser.close();
    await server.close();
  }

  assert.deepEqual(errors, [], "the page logged errors");

  if (process.env.UPDATE_SNAPSHOTS) {
    await writeFile(SNAPSHOT_FILE, `${JSON.stringify(steps, null, 2)}\n`);
    return;
  }

  const expected = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8"));
  assert.equal(steps.length, expected.length, "number of recorded steps changed");
  steps.forEach((step, i) =>
    assert.deepEqual(step, expected[i], `step "${expected[i].name}" differs`)
  );
});
