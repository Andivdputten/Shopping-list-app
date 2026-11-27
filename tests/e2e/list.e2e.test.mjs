// The shopping list's Plan and Shop modes with real clicks and keys: reading amounts in the add box,
// aisles from the pantry, adding to an item already on the list, steppers, the item sheet with Undo,
// "running low" suggestions, the remembered mode, and the error shown when storage is full.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const STOCK = [
  // Restocked to 10, 2 left: at or below ceil(0.2 * 10) = 2, so running low.
  { name: "Eggs", quantity: 2, unit: "pcs", category: "Dairy", restockQuantity: 10 },
  // Restocked to 6, 3 left: above ceil(1.2) = 2, so not low.
  { name: "Apples", quantity: 3, unit: "pcs", category: "Produce", restockQuantity: 6 },
  // No restock amount known: never suggested.
  { name: "Rice", quantity: 1, unit: "pack", category: "Pantry" }
];

test("shopping list: plan, shop and done shopping", { timeout: 90000 }, async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));

  const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), key);
  const rows = () =>
    page.$$eval("#shoppingSections .plan-row", (list) =>
      list.map((row) => row.innerText.replace(/\s+/g, " ").trim())
    );

  try {
    await page.goto(`${server.url}/index.html`);
    await page.evaluate((stock) => {
      localStorage.setItem("grocery_scanner_stock_v1", JSON.stringify(stock));
    }, STOCK);
    await page.reload();
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    await page.click('[data-tab="list"]');
    assert.equal(await page.textContent("#pageSubtitle"), "Nothing to buy");

    // Empty list: only the pantry item that is running low is suggested; Shop can't be chosen yet.
    assert.equal(await page.isDisabled("#shopModeButton"), true);
    const lowChips = await page.$$eval("#shoppingSections .chip", (chips) =>
      chips.map((chip) => chip.textContent)
    );
    assert.deepEqual(lowChips, ["+ Eggs2 pcs left"]);
    // It goes on the list with what brings it back to its last restock: 10 - 2 = 8.
    await page.click('#shoppingSections .chip:has-text("Eggs")');
    assert.deepEqual(await rows(), ["Edit Eggs − 8 pcs +"]);

    // "2 l milk": amount and unit are read; "apples" gets its aisle from the pantry.
    await page.fill("#listAddInput", "2 l milk");
    assert.match(await page.textContent("#listAddPreview"), /Milk.*2 l.*No aisle/);
    await page.press("#listAddInput", "Enter");
    await page.fill("#listAddInput", "3 apples");
    assert.match(await page.textContent("#listAddPreview"), /Apples.*3.*Producefrom pantry/);
    await page.click("#listAddButton");
    assert.equal(await page.textContent("#pageSubtitle"), "3 to buy");

    // The same name again: the main button adds to the item instead of making a copy.
    await page.fill("#listAddInput", "milk 1l");
    assert.equal(await page.textContent("#listAddButton"), "Make it 3 l");
    assert.match(await page.textContent("#listAddPreview"), /Milk is already on your list \(2 l\)/);
    await page.press("#listAddInput", "Enter");
    assert.equal((await stored("grocery_scanner_items_v6")).length, 3);

    // Counted items get − and +, with − stopping at 1; litres open the sheet instead.
    await page.click('[aria-label="One more, Apples"]');
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute("aria-label")),
      "One more, Apples"
    );
    await page.click('[aria-label="One fewer, Apples"]');
    await page.click('[aria-label="One fewer, Apples"]');
    await page.click('[aria-label="One fewer, Apples"]');
    assert.equal(await page.isDisabled('[aria-label="One fewer, Apples (1 is the least)"]'), true);
    assert.match((await rows()).join(" | "), /Apples − 1 \+/);

    // Amount in litres: the sheet offers presets; picking one and an aisle, then Save.
    await page.click('[aria-label="Amount, Milk, 3 l. Change"]');
    await page.waitForSelector("#listItemDialog[open]");
    await page.click('#listItemPresets button:text-is("1.5 l")');
    await page.check('#listItemAisles input[value="Dairy"]');
    await page.click("#listItemSaveButton");
    assert.equal(await page.isVisible("#listItemDialog"), false);
    const milk = (await stored("grocery_scanner_items_v6")).find((item) => item.name === "Milk");
    assert.deepEqual([milk.quantity, milk.unit, milk.category], [1.5, "l", "Dairy"]);
    // The aisle is remembered on this device for next time.
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("grocery_scanner_aisle_memory_v1"))
      ),
      { milk: "Dairy" }
    );

    // Escape closes the sheet without saving and puts focus back on the row.
    await page.click('#shoppingSections .plan-row-main:has-text("Eggs")');
    await page.fill("#listItemName", "Changed");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("listItemDialog").open);
    assert.match(await page.evaluate(() => document.activeElement.textContent), /Eggs/);

    // Delete from the sheet, then Undo puts it back in the same place.
    const before = await rows();
    await page.click('#shoppingSections .plan-row-main:has-text("Apples")');
    await page.click("#listItemDeleteButton");
    assert.equal((await rows()).length, 2);
    assert.equal(await page.textContent("#toast"), "Apples deletedUndo");
    await page.click("#toast .toast-action");
    assert.deepEqual(await rows(), before);

    // Shop: tick two of three, then "Done shopping" moves them after the confirmation.
    await page.click("#shopModeButton");
    assert.equal(await page.isVisible("#listAddBox"), false);
    await page.click('.shop-row:has-text("Milk") input');
    await page.click('.shop-row:has-text("Eggs") input');
    assert.equal(await page.textContent(".shop-progress-label"), "2 of 3 in your basket");
    assert.equal(await page.textContent("#listActionButton"), "Done shopping · move 2 to pantry");
    await page.click("#listActionButton");
    await page.waitForSelector("#moveDialog[open]");
    assert.deepEqual(
      await page.$$eval("#moveList li", (items) => items.map((li) => li.textContent)),
      ["Eggs2 → 10 pcs", "MilkNew · 1.5 l"]
    );
    assert.equal(
      await page.textContent("#moveStayNote"),
      "1 item you didn't tick stays on your list."
    );
    await page.click("#moveConfirmButton");

    const stock = await stored("grocery_scanner_stock_v1");
    const eggs = stock.find((item) => item.name === "Eggs");
    // 2 in stock + 8 bought: the restock level becomes the new amount.
    assert.deepEqual([eggs.quantity, eggs.restockQuantity], [10, 10]);
    const newMilk = stock.find((item) => item.name === "Milk");
    assert.deepEqual([newMilk.quantity, newMilk.unit, newMilk.restockQuantity], [1.5, "l", 1.5]);
    assert.deepEqual(
      (await stored("grocery_scanner_items_v6")).map((item) => item.name),
      ["Apples"]
    );

    // The mode is remembered on this device.
    await page.reload();
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    await page.click('[data-tab="list"]');
    assert.equal(await page.getAttribute("#shopModeButton", "aria-pressed"), "true");

    // Storage full: the change is undone on both lists and the error explains it.
    await page.click('.shop-row:has-text("Apples") input');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "grocery_scanner_stock_v1") {
          throw new DOMException("full", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    await page.click("#listActionButton");
    await page.click("#moveConfirmButton");
    assert.equal(await page.isVisible("#listSaveError"), true);
    assert.deepEqual(
      (await stored("grocery_scanner_items_v6")).map((item) => item.name),
      ["Apples"]
    );
    // The pantry's Apples (3 pcs) didn't get the 1 from the list.
    assert.equal(
      (await stored("grocery_scanner_stock_v1")).find((item) => item.name === "Apples").quantity,
      3
    );
    assert.equal(await page.textContent(".shop-progress-label"), "1 of 1 in your basket");

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
