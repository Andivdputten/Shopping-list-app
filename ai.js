// ============================================================================
// RecipeAI service module
// ----------------------------------------------------------------------------
// This file is the ONLY place that knows how recipe suggestions actually get
// generated. Today that means calling Anthropic's API directly from the
// browser using a key the user supplies and stores locally (Anthropic's
// supported "bring your own key" pattern for personal/client-side tools,
// via the anthropic-dangerous-direct-browser-access header).
//
// If this app later moves to an App Store build with a managed backend
// (e.g. a subscription that covers API usage, which Apple requires to be
// sold through In-App Purchase rather than a user-supplied key), only the
// internals of generateRecipes() / testConnection() below need to change —
// callers just get a rejected promise or a result object either way.
// UI code (app.js) should never call fetch() or touch the API key directly;
// it only calls the functions exposed on window.RecipeAI.
// ============================================================================

(function () {
  const API_KEY_STORAGE_KEY = "grocery_scanner_anthropic_key_v1";
  const API_URL = "https://api.anthropic.com/v1/messages";
  const MODEL = "claude-haiku-4-5-20251001";
  const ANTHROPIC_VERSION = "2023-06-01";

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  }

  function setApiKey(key) {
    const trimmed = typeof key === "string" ? key.trim() : "";
    if (trimmed === "") {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } else {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    }
  }

  function hasApiKey() {
    return getApiKey() !== "";
  }

  function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  async function callClaude(messages, maxTokens) {
    const apiKey = getApiKey();

    if (apiKey === "") {
      return { ok: false, errorType: "no_key", message: "No API key saved yet." };
    }

    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          messages
        })
      });
    } catch (error) {
      // Network failure, offline, or a CORS-level rejection.
      return {
        ok: false,
        errorType: "network",
        message: "Couldn't reach the API. Check your internet connection and try again."
      };
    }

    if (response.status === 401) {
      return {
        ok: false,
        errorType: "auth",
        message: "That API key was rejected. Double-check it's correct and active."
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        errorType: "rate_limit",
        message: "Rate limit or usage cap hit. Wait a bit and try again."
      };
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = errorBody && errorBody.error && errorBody.error.message
          ? errorBody.error.message
          : "";
      } catch (parseError) {
        // Ignore — body wasn't valid JSON, we'll fall back to a generic message.
      }
      return {
        ok: false,
        errorType: "api_error",
        message: detail !== "" ? detail : `Request failed with status ${response.status}.`
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      return {
        ok: false,
        errorType: "parse_error",
        message: "Got a response but couldn't read it."
      };
    }

    const textBlock = Array.isArray(data.content)
      ? data.content.find((block) => block.type === "text")
      : null;

    if (!textBlock || typeof textBlock.text !== "string") {
      return {
        ok: false,
        errorType: "parse_error",
        message: "The response didn't contain any text."
      };
    }

    return { ok: true, text: textBlock.text };
  }

  async function testConnection() {
    const result = await callClaude(
      [{ role: "user", content: "Reply with exactly one word: OK" }],
      16
    );

    if (!result.ok) {
      return result;
    }

    return { ok: true, message: "Connected successfully." };
  }

  function stripJsonFences(text) {
    return text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizeStockItemField(value) {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();

    if (lower === "" || lower === "null" || lower === "none" || lower === "n/a") {
      return null;
    }

    return trimmed;
  }

  function sanitizeRecipe(raw, group) {
    if (typeof raw !== "object" || raw === null) {
      return null;
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name === "") {
      return null;
    }

    const servings = isFiniteNumber(raw.servings) && raw.servings > 0 ? raw.servings : 1;

    const ingredients = Array.isArray(raw.ingredients)
      ? raw.ingredients
          .map((ing) => {
            if (typeof ing !== "object" || ing === null) {
              return null;
            }
            const ingName = typeof ing.name === "string" ? ing.name.trim() : "";
            if (ingName === "") {
              return null;
            }
            return {
              name: ingName,
              amount: isFiniteNumber(ing.amount) ? ing.amount : null,
              unit: typeof ing.unit === "string" ? ing.unit.trim() : "g",
              // string = the exact stock item the AI says this is,
              // null = the AI says it's not in stock,
              // undefined = the AI didn't say (older response format)
              stockItem: normalizeStockItemField(ing.stockItem)
            };
          })
          .filter(Boolean)
      : [];

    if (ingredients.length === 0) {
      return null;
    }

    const instructions = Array.isArray(raw.instructions)
      ? raw.instructions.filter((step) => typeof step === "string" && step.trim() !== "")
      : [];

    const macros = raw.estimatedMacrosPerServing;
    const estimatedMacrosPerServing =
      typeof macros === "object" && macros !== null
        ? {
            kcal: isFiniteNumber(macros.kcal) ? macros.kcal : null,
            protein: isFiniteNumber(macros.protein) ? macros.protein : null,
            carbs: isFiniteNumber(macros.carbs) ? macros.carbs : null,
            fat: isFiniteNumber(macros.fat) ? macros.fat : null
          }
        : { kcal: null, protein: null, carbs: null, fat: null };

    return {
      name,
      group: group === "needsExtras" ? "needsExtras" : "ready",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      servings,
      ingredients,
      instructions,
      estimatedMacrosPerServing
    };
  }

  async function generateRecipes(stockItems, preferences) {
    const stockList = Array.isArray(stockItems) ? stockItems : [];

    if (stockList.length === 0) {
      return {
        ok: false,
        errorType: "no_stock",
        message: "Add some items to your pantry stock first, then try again."
      };
    }

    const stockLines = stockList
      .map((item) => {
        const qty = typeof item.quantity === "number" ? item.quantity : "";
        const unit = typeof item.unit === "string" ? item.unit : "";
        const amountText = [qty, unit].filter((part) => part !== "").join(" ");
        return amountText !== "" ? `- ${item.name} (${amountText})` : `- ${item.name}`;
      })
      .join("\n");

    const preferenceText =
      typeof preferences === "string" && preferences.trim() !== ""
        ? `\n\nUser preferences to respect if possible: ${preferences.trim()}`
        : "";

    const prompt = `Here is the food currently in my kitchen stock (name and amount):
${stockLines}
${preferenceText}

Suggest 6 recipes in two groups:
1. "ready": 3 recipes that use ONLY items from my stock list above. Do not list water, salt or black pepper as ingredients (I always have those).
2. "needsExtras": 3 recipes built around what I have in stock, where each recipe also needs 1 to 3 ingredients that are NOT in my stock list (for example a fresh vegetable, a sauce or a spice). Every recipe in this group must contain at least one ingredient that is not in my stock list.

Make the recipes varied (different cuisines or meal types) and practical for home cooking. Use reasonable serving sizes.

For every ingredient, give "amount" as a plain number of grams (unit "g"). Convert things like cups or tablespoons to an approximate gram weight yourself, since these amounts are used for nutrition calculations.

For every ingredient also give "stockItem": the exact name of the matching item from my stock list above, copied exactly as written, or null if I don't have it. Stock names can be in a different language than your recipe, so match by meaning (for example "Halfvolle melk" is milk). Only match when it really is the same ingredient: "tomato sauce" is not "tomato", and "peanut butter" is not "butter".

Respond with ONLY a JSON object (no markdown code fences, no commentary before or after) in exactly this shape:
{
  "ready": [
    {
      "name": "Recipe name",
      "description": "One sentence description",
      "servings": 2,
      "ingredients": [
        { "name": "Ingredient name", "amount": 150, "unit": "g", "stockItem": "Exact stock name or null" }
      ],
      "instructions": ["Step 1", "Step 2"],
      "estimatedMacrosPerServing": { "kcal": 450, "protein": 20, "carbs": 55, "fat": 15 }
    }
  ],
  "needsExtras": [ /* same recipe shape */ ]
}`;

    const result = await callClaude([{ role: "user", content: prompt }], 6000);

    if (!result.ok) {
      return result;
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFences(result.text));
    } catch (error) {
      return {
        ok: false,
        errorType: "parse_error",
        message: "The AI's response wasn't valid JSON. Try again."
      };
    }

    const rawRecipes = [];

    if (Array.isArray(parsed)) {
      // Older/simple format: a flat array of recipes.
      parsed.forEach((raw) => rawRecipes.push({ raw, group: "ready" }));
    } else if (typeof parsed === "object" && parsed !== null) {
      ["ready", "needsExtras"].forEach((group) => {
        if (Array.isArray(parsed[group])) {
          parsed[group].forEach((raw) => rawRecipes.push({ raw, group }));
        }
      });
    } else {
      return {
        ok: false,
        errorType: "parse_error",
        message: "The AI's response wasn't in the expected format. Try again."
      };
    }

    const recipes = rawRecipes
      .map((entry) => sanitizeRecipe(entry.raw, entry.group))
      .filter(Boolean);

    if (recipes.length === 0) {
      return {
        ok: false,
        errorType: "parse_error",
        message: "No usable recipes came back. Try again."
      };
    }

    return { ok: true, recipes };
  }

  // Exposed as window.RecipeAI — the only surface app.js should talk to.
  window.RecipeAI = {
    hasApiKey,
    getApiKey,
    setApiKey,
    clearApiKey,
    testConnection,
    generateRecipes
  };
})();
