// Unit tests for reading a streamed recipe answer (js/recipe-stream.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { completeRecipes, parseServerEvents } from "../../js/recipe-stream.js";

const answer = JSON.stringify({
  ready: [
    {
      name: "Rijst {met} ei",
      instructions: ['Zeg "klaar" en roer'],
      ingredients: [{ name: "Rijst" }]
    },
    { name: "Omelet", instructions: ["Bak."], ingredients: [] },
    { name: "Pap", instructions: [], ingredients: [{ name: "Melk" }] }
  ],
  needsExtras: []
});

test("only complete recipes are taken from an answer that is still arriving", () => {
  const names = (text) => completeRecipes(text, "ready").map((recipe) => recipe.name);
  // At every cut-off point, the recipes found are exactly those whose closing brace has arrived.
  const ends = ["Rijst {met} ei", "Omelet", "Pap"].map((name) => {
    const at = answer.indexOf(name);
    return answer.indexOf("]}", at) + 2;
  });
  for (let cut = 0; cut <= answer.length; cut++) {
    const expected = ["Rijst {met} ei", "Omelet", "Pap"].filter((_, i) => ends[i] <= cut);
    assert.deepEqual(names(answer.slice(0, cut)), expected, `cut at ${cut}`);
  }
  // Braces and quotes inside text don't confuse it.
  assert.equal(completeRecipes(answer, "ready")[0].instructions[0], 'Zeg "klaar" en roer');
});

test("recipes are only taken from the asked-for group", () => {
  const extras = JSON.stringify({ ready: [], needsExtras: [{ name: "Kip", ingredients: [] }] });
  assert.deepEqual(completeRecipes(extras, "ready"), []);
  assert.deepEqual(
    completeRecipes(extras, "needsExtras").map((r) => r.name),
    ["Kip"]
  );
  // Objects deeper inside a recipe (ingredients) are never mistaken for recipes.
  assert.equal(completeRecipes(answer, "ingredients").length, 0);
});

test("server-sent events are split into complete events plus the unfinished rest", () => {
  const stream =
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"re"}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content';
  const { events, rest } = parseServerEvents(stream);
  assert.deepEqual(
    events.map((e) => e.event),
    ["message_start", "content_block_delta"]
  );
  assert.equal(events[1].data.delta.text, '{"re');
  assert.equal(rest, 'event: content_block_delta\ndata: {"type":"content');
  // A ping or malformed event is handled without breaking the rest.
  assert.equal(
    parseServerEvents("event: ping\ndata: {}\n\nevent: x\ndata: {bad\n\n").events.length,
    1
  );
});
