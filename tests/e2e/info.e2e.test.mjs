// Release notes and help end to end: no pop-up on a first visit, "What's new" once after an update (also for
// users from before release notes), the Settings buttons, and the ? help per tab with the full guide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";
import { RELEASE_NOTES } from "../../js/release-notes.js";

const CURRENT = RELEASE_NOTES[0];

test(
  "release notes show once after an update and help follows the tab",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const dialogOpen = () => page.evaluate(() => document.getElementById("infoDialog").open);
    const dialogText = () => page.textContent("#infoDialog");
    const close = () => page.click("#infoCloseButton");

    try {
      // 1. A first visit: nothing is new, so no pop-up; the version is remembered.
      await page.goto(`${server.url}/index.html`);
      assert.equal(await dialogOpen(), false);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("grocery_scanner_release_seen_v1")),
        CURRENT.version
      );

      // 2. An update from an older version shows the newest notes once, not again after a reload.
      await page.evaluate(() => localStorage.setItem("grocery_scanner_release_seen_v1", "v31"));
      await page.reload();
      assert.equal(await dialogOpen(), true);
      assert.match(await dialogText(), new RegExp(`What's new${CURRENT.title}${CURRENT.version}`));
      await close();
      await page.reload();
      assert.equal(await dialogOpen(), false);

      // 3. A user from before release notes (data, but no seen version) also gets the notes once.
      await page.evaluate(() => {
        localStorage.removeItem("grocery_scanner_release_seen_v1");
        localStorage.setItem("grocery_scanner_items_v6", "[]");
      });
      await page.reload();
      assert.equal(await dialogOpen(), true);
      await close();

      // 4. Settings: What's new shows only the newest release; the history shows every release, newest first.
      await page.click('[data-tab="settings"]');
      assert.match(
        await page.textContent("#appVersionText"),
        new RegExp(`Version ${CURRENT.version},`)
      );
      await page.click("#whatsNewButton");
      assert.equal(await page.locator("#infoDialog .info-section").count(), 1);
      await close();
      await page.click("#releaseHistoryButton");
      const titles = await page.$$eval("#infoDialog .info-section h3", (h) =>
        h.map((x) => x.textContent)
      );
      assert.deepEqual(
        titles,
        RELEASE_NOTES.map((release) => release.title)
      );
      await close();

      // 5. The ? button shows the help for the tab you're on, and the full guide shows every tab.
      await page.click("#helpButton");
      assert.equal(await page.textContent("#infoDialogTitle"), "Help: Settings");
      await close();
      await page.click('[data-tab="today"]');
      await page.click("#helpButton");
      assert.equal(await page.textContent("#infoDialogTitle"), "Help: Today");
      assert.match(await dialogText(), /Enter values by hand/);
      await page.click("#fullGuideButton");
      assert.equal(await page.textContent("#infoDialogTitle"), "How to use the app");
      const guide = await page.$$eval("#infoDialog .info-section h3", (h) =>
        h.map((x) => x.textContent)
      );
      assert.deepEqual(guide, [
        "Scanner",
        "Shopping list",
        "Pantry",
        "Recipes",
        "Today",
        "Settings"
      ]);
      await close();
      assert.equal(await dialogOpen(), false);

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
