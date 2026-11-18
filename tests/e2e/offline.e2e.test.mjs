// Checks the service worker: every app file (including each js/ module) must be cached on install,
// and the app must still start with the network switched off. A module missing from CORE_FILES in
// sw.js would break the app offline, which this test catches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const JS_DIR = fileURLToPath(new URL("../../js/", import.meta.url));

test(
  "service worker caches every app file and the app starts offline",
  { timeout: 60000 },
  async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${server.url}/index.html`);
      // Wait until the service worker has installed and taken control of the page.
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
        timeout: 15000
      });

      const cached = await page.evaluate(async () => {
        const keys = await caches.keys();
        const cache = await caches.open(keys[0]);
        return (await cache.keys()).map((request) => new URL(request.url).pathname);
      });

      const modules = (await readdir(JS_DIR)).filter((file) => file.endsWith(".js"));
      for (const file of [...modules.map((m) => `/js/${m}`), "/index.html"]) {
        assert.ok(cached.includes(file), `${file} is not cached by the service worker`);
      }

      await context.setOffline(true);
      await page.reload();
      await page.waitForFunction(() =>
        document.getElementById("status").textContent.includes("loaded")
      );
      assert.equal(await page.textContent("#status"), "App loaded successfully.");
    } finally {
      await browser.close();
      await server.close();
    }
  }
);
