// Guards the recipe-section translations: a text missing in one language would show up blank or as
// "undefined" on screen, so every language must have exactly the English set of texts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { forLanguage, UI_LANGUAGES } from "../../js/recipe-ui-text.js";
import { RecipeAI } from "../../js/recipe-ai.js";

const english = forLanguage("en");

test("every language has every English text, of the same kind (text or function)", () => {
  for (const code of UI_LANGUAGES) {
    const texts = forLanguage(code);
    assert.deepEqual(Object.keys(texts).sort(), Object.keys(english).sort(), `${code} keys`);
    for (const key of Object.keys(english)) {
      assert.equal(typeof texts[key], typeof english[key], `${code}.${key}`);
    }
    assert.deepEqual(
      Object.keys(texts.meals).sort(),
      Object.keys(english.meals).sort(),
      `${code} meals`
    );
  }
});

test("the languages offered for AI recipes are exactly the translated ones", () => {
  assert.deepEqual(Object.keys(RecipeAI.recipeLanguages).sort(), [...UI_LANGUAGES].sort());
  assert.ok(UI_LANGUAGES.includes("pt"));
  assert.equal(RecipeAI.recipeLanguages.pt, "Brazilian Portuguese");
});
