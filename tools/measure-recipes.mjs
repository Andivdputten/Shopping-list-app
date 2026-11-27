// Measures the app's real AI recipe requests: time to the first recipe, total time, tokens, cost, and how
// many ingredients were matched to the pantry. It sends exactly the app's requests (buildRecipeRequest), with
// and without streaming, normal and "complex". Each run makes the two requests the app makes (stock-only and
// extras) at the same time; one run of all four variants is 8 requests, about $0.02-0.05 at list price.
//
// Usage (needs Node 22.21 or later):
//   ANTHROPIC_API_KEY=sk-ant-... node tools/measure-recipes.mjs [--runs 2] [--dry-run]
// In a Claude Code cloud session, prefix NODE_USE_ENV_PROXY=1 so Node's fetch uses the network proxy, and
// allow api.anthropic.com in the environment's network settings. --dry-run prints the requests, sends nothing.
import { MODEL, applyStockIds, buildRecipeRequest, sanitizeRecipe } from "../js/recipe-ai.js";
import { completeRecipes, parseServerEvents } from "../js/recipe-stream.js";
import { usageCost } from "../js/token-usage.js";

// A pantry like the app's owner has, with the pack weights the app now stores.
const STOCK = [
  { name: "Long grain rice", quantity: 1, unit: "pack", packGrams: 5000 },
  { name: "Ei", quantity: 30, unit: "pcs", packGrams: 60 },
  { name: "Halfvolle melk", quantity: 1, unit: "l" },
  { name: "Kipfilet", quantity: 500, unit: "g" },
  { name: "Uien", quantity: 4, unit: "pcs", packGrams: 150 },
  { name: "Tomaten in blik", quantity: 2, unit: "pcs", packGrams: 400 },
  { name: "Volkoren pasta", quantity: 1, unit: "pack", packGrams: 500 },
  { name: "Geraspte kaas", quantity: 200, unit: "g" },
  { name: "Olijfolie", quantity: 1, unit: "bottle", packGrams: 500 },
  { name: "Paprika", quantity: 2, unit: "pcs", packGrams: 160 }
];

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1]) || 1;
const dryRun = args.includes("--dry-run");
const apiKey = process.env.ANTHROPIC_API_KEY || "";

if (!dryRun && apiKey === "") {
  console.error("Set ANTHROPIC_API_KEY (a separate key with a spending limit), or use --dry-run.");
  process.exit(1);
}

// One request; returns timings (ms), usage, stop reason and the group's recipes.
async function measure(request, group, stream) {
  const started = performance.now();
  let firstRecipeAt = null;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: MODEL, ...request, ...(stream ? { stream: true } : {}) })
  });
  if (!response.ok) {
    return { error: `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}` };
  }

  let text = "";
  let usage = {};
  let stopReason = null;
  if (stream) {
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      const parsed = parseServerEvents(buffer + decoder.decode(chunk, { stream: true }));
      buffer = parsed.rest;
      for (const { event, data } of parsed.events) {
        if (event === "message_start") {
          usage = { ...data.message.usage };
        } else if (event === "content_block_delta" && data.delta.type === "text_delta") {
          text += data.delta.text;
          if (firstRecipeAt === null && completeRecipes(text, group).length > 0) {
            firstRecipeAt = performance.now() - started;
          }
        } else if (event === "message_delta") {
          stopReason = data.delta.stop_reason;
          usage = { ...usage, ...data.usage };
        } else if (event === "error") {
          return { error: data.error.message };
        }
      }
    }
  } else {
    const data = await response.json();
    text = (data.content.find((block) => block.type === "text") || {}).text || "";
    usage = data.usage;
    stopReason = data.stop_reason;
  }
  const total = performance.now() - started;

  let recipes = [];
  try {
    const parsed = JSON.parse(text);
    recipes = (parsed[group] || []).map((raw) => sanitizeRecipe(raw, group)).filter(Boolean);
    applyStockIds(recipes, STOCK);
  } catch (error) {
    // Cut off or not JSON: reported through the stop reason and a recipe count of 0.
  }
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients);
  return {
    firstRecipeAt: stream ? firstRecipeAt : total,
    total,
    usage,
    stopReason,
    recipes: recipes.length,
    matched: ingredients.filter((ingredient) => ingredient.stockItem).length,
    ingredients: ingredients.length,
    names: recipes.map((recipe) => recipe.name)
  };
}

const seconds = (ms) => (ms === null || ms === undefined ? "-" : `${(ms / 1000).toFixed(1)} s`);

for (const stream of [false, true]) {
  for (const complex of [false, true]) {
    for (let run = 1; run <= runs; run++) {
      const label = `${stream ? "stream" : "no stream"}, ${complex ? "complex" : "normal"}, run ${run}`;
      const requests = ["ready", "needsExtras"].map((group) => ({
        group,
        request: buildRecipeRequest({
          stockList: STOCK,
          preferences: "",
          avoidNames: [],
          mealType: "dinner",
          group,
          complex,
          language: "nl"
        })
      }));
      if (dryRun) {
        console.log(`\n=== ${label} ===`);
        requests.forEach(({ group, request }) => {
          console.log(`--- ${group} ---\n${request.messages[0].content}`);
        });
        continue;
      }
      // Both halves at the same time, as in the app: the wait is that of the slower one.
      const started = performance.now();
      const results = await Promise.all(
        requests.map(({ group, request }) => measure(request, group, stream))
      );
      const wall = performance.now() - started;
      console.log(`\n=== ${label}: ${seconds(wall)} until all recipes ===`);
      results.forEach((result, i) => {
        const group = requests[i].group;
        if (result.error) {
          console.log(`  ${group}: ERROR ${result.error}`);
          return;
        }
        const { cost } = usageCost(result.usage, MODEL);
        console.log(
          `  ${group}: first recipe ${seconds(result.firstRecipeAt)}, all ${seconds(result.total)}, ` +
            `${result.usage.input_tokens} in / ${result.usage.output_tokens} out tokens, ` +
            `$${(cost || 0).toFixed(4)}, stop: ${result.stopReason}, ${result.recipes} recipes, ` +
            `${result.matched}/${result.ingredients} ingredients matched to the pantry`
        );
        console.log(`    ${result.names.join(" | ")}`);
      });
    }
  }
}
