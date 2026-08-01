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

  // Exposed as window.RecipeAI — the only surface app.js should talk to.
  window.RecipeAI = {
    hasApiKey,
    getApiKey,
    setApiKey,
    clearApiKey,
    testConnection
  };
})();
