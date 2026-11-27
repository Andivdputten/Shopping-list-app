// Streamed AI answers end to end: recipe requests ask for a stream, the server-sent events are read into
// recipes, usage comes from the stream's events, and recipes completed before an answer is cut off stay.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startStaticServer } from "./static-server.mjs";

const recipe = (name, stockId) => ({
  name,
  description: "",
  servings: 1,
  mealType: "dinner",
  ingredients: [
    {
      name: "Rijst",
      amount: 100,
      unit: "g",
      displayAmount: null,
      stockId,
      searchName: "rice white raw",
      estimatedPer100g: { kcal: 350, protein: 7, carbs: 77, fat: 1, fiber: 1 }
    }
  ],
  instructions: ["Kook."],
  estimatedMacrosPerServing: { kcal: 350, protein: 7, carbs: 77, fat: 1, fiber: 1 }
});

// The answer text as server-sent events in small pieces, like the API streams it.
function sse(text, { stopReason = "end_turn", input = 1000, output = 2000 } = {}) {
  const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
  let body = event("message_start", {
    type: "message_start",
    message: { usage: { input_tokens: input, output_tokens: 1 } }
  });
  body += event("content_block_start", { type: "content_block_start", index: 0 });
  for (let i = 0; i < text.length; i += 37) {
    body += event("content_block_delta", {
      type: "content_block_delta",
      delta: { type: "text_delta", text: text.slice(i, i + 37) }
    });
    if (i % 370 === 0) {
      body += event("ping", { type: "ping" });
    }
  }
  body += event("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason },
    usage: { output_tokens: output }
  });
  body += event("message_stop", { type: "message_stop" });
  return body;
}

async function run(t, { extrasCutOff }) {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const streamFlags = [];
  await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
  await page.route("https://world.openfoodfacts.org/**", (route) =>
    route.fulfill({ json: { products: [] } })
  );
  await page.route("https://api.anthropic.com/**", (route) => {
    const body = route.request().postDataJSON();
    streamFlags.push(body.stream === true);
    const extras = /"ready": leave this empty/.test(body.messages[0].content);
    let text;
    let options = {};
    if (!extras) {
      text = JSON.stringify({
        ready: [recipe("Rijst puur", 1), recipe("Rijstpap", 1)],
        needsExtras: []
      });
    } else {
      const full = JSON.stringify({
        ready: [],
        needsExtras: [
          recipe("Rijst met kip", null),
          recipe("Rijst met tofu", null),
          recipe("Rijst met vis", null)
        ]
      });
      // Cut off in the middle of the third recipe, as the API does at the token limit.
      text = extrasCutOff ? full.slice(0, full.indexOf("Rijst met vis") + 20) : full;
      options = extrasCutOff ? { stopReason: "max_tokens" } : {};
    }
    return route.fulfill({
      headers: { "access-control-allow-origin": "*", "content-type": "text/event-stream" },
      body: sse(text, options)
    });
  });

  await page.goto(`${server.url}/index.html`);
  await page.evaluate(() => {
    localStorage.setItem(
      "grocery_scanner_stock_v1",
      JSON.stringify([{ name: "Long grain rice", quantity: 1, unit: "pack", packGrams: 5000 }])
    );
    localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
  });
  await page.reload();
  await page.click('[data-tab="recipes"]');
  await page.click("#suggestRecipesButton");
  await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
  const names = await page.$$eval("#aiRecipeResults .ai-recipe-card h3", (h) =>
    h.map((x) => x.textContent)
  );
  const status = await page.textContent("#aiSuggestStatus");
  await page.click('[data-tab="settings"]');
  const usage = await page.textContent("#usageTotals");
  await browser.close();
  await server.close();
  return { names, status, usage, streamFlags, errors };
}

test(
  "streamed answers become recipes, and usage is read from the stream",
  { timeout: 60000 },
  async (t) => {
    const result = await run(t, { extrasCutOff: false });
    assert.deepEqual(result.streamFlags, [true, true]);
    assert.deepEqual(result.names.sort(), [
      "Rijst met kip",
      "Rijst met tofu",
      "Rijst met vis",
      "Rijst puur",
      "Rijstpap"
    ]);
    // Stock numbers in a streamed answer still become pantry links: the rice recipes are ready to cook.
    assert.equal(result.status, "Got 5 recipe ideas: 2 ready to cook, 3 needing extras.");
    assert.equal(result.usage, "6,000 tokens (2,000 in · 4,000 out) · about < $0.01 · 2 requests");
    assert.deepEqual(result.errors, []);
  }
);

test(
  "recipes completed before an answer is cut off stay on screen",
  { timeout: 60000 },
  async (t) => {
    const result = await run(t, { extrasCutOff: true });
    // The third extras recipe was cut off; the two before it are kept, plus both ready recipes.
    assert.deepEqual(result.names.sort(), [
      "Rijst met kip",
      "Rijst met tofu",
      "Rijst puur",
      "Rijstpap"
    ]);
    assert.match(result.status, /\(The AI's answer was too long and got cut off\./);
    assert.deepEqual(result.errors, []);
  }
);

test("each recipe is shown while the rest is still being written", { timeout: 60000 }, async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/data/nevo.json", (route) => route.fulfill({ json: {} }));
  await page.route("https://world.openfoodfacts.org/**", (route) =>
    route.fulfill({ json: { products: [] } })
  );

  // A slow stream: the API's answer arrives in pieces with pauses, and the last piece only when the test
  // calls window.__finishStream(), so the page can be checked half-way.
  const answers = {
    ready: sse(
      JSON.stringify({ ready: [recipe("Rijst puur", 1), recipe("Rijstpap", 1)], needsExtras: [] })
    ),
    extras: sse(JSON.stringify({ ready: [], needsExtras: [recipe("Rijst met kip", null)] }))
  };
  await page.addInitScript((answers) => {
    const realFetch = window.fetch;
    let release;
    const held = new Promise((resolve) => (release = resolve));
    window.__finishStream = () => release();
    window.fetch = (url, init) => {
      if (!String(url).startsWith("https://api.anthropic.com")) {
        return realFetch(url, init);
      }
      const extras = /"ready": leave this empty/.test(JSON.parse(init.body).messages[0].content);
      const text = extras ? answers.extras : answers.ready;
      // The ready half: up to the end of the piece in which the second recipe starts (so the first one is
      // complete and the second isn't), then the rest only when released.
      const cut = extras ? text.length : text.indexOf("\n\n", text.indexOf("Rijstpap")) + 2;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(text.slice(0, cut)));
          if (cut < text.length) {
            await held;
            controller.enqueue(encoder.encode(text.slice(cut)));
          }
          controller.close();
        }
      });
      return Promise.resolve(
        new Response(stream, { headers: { "content-type": "text/event-stream" } })
      );
    };
  }, answers);

  try {
    await page.goto(`${server.url}/index.html`);
    await page.evaluate(() => {
      localStorage.setItem(
        "grocery_scanner_stock_v1",
        JSON.stringify([{ name: "Long grain rice", quantity: 1, unit: "pack", packGrams: 5000 }])
      );
      localStorage.setItem("grocery_scanner_anthropic_key_v1", "sk-ant-test");
    });
    await page.reload();
    await page.click('[data-tab="recipes"]');
    await page.click("#suggestRecipesButton");

    // Half-way: the first recipe and the extras recipe are shown, the second ready one isn't written yet,
    // and the status line counts along.
    await page.waitForFunction(
      () => document.querySelectorAll("#aiRecipeResults .ai-recipe-card").length === 2
    );
    const halfway = await page.$$eval("#aiRecipeResults .ai-recipe-card h3", (h) =>
      h.map((x) => x.textContent).sort()
    );
    assert.deepEqual(halfway, ["Rijst met kip", "Rijst puur"]);
    assert.match(await page.textContent("#aiSuggestStatus"), /^Writing recipe 3 of 6… \d+ s$/);
    assert.equal(await page.isDisabled("#suggestRecipesButton"), true);

    // The rest arrives: all three are shown and the usual summary replaces the progress line.
    await page.evaluate(() => window.__finishStream());
    await page.waitForFunction(() => !document.getElementById("suggestRecipesButton").disabled);
    assert.equal(await page.locator("#aiRecipeResults .ai-recipe-card").count(), 3);
    assert.equal(
      await page.textContent("#aiSuggestStatus"),
      "Got 3 recipe ideas: 2 ready to cook, 1 needing extras."
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
