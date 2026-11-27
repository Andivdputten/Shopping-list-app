// Unit tests for saving the list and pantry (js/persistence.js): failures are reported, never thrown,
// and moving items between the two is all-or-nothing.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STOCK_STORAGE_KEY, STORAGE_KEY } from "../../js/constants.js";

const store = new Map();
let failOnKey = null;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    if (key === failOnKey) {
      throw new Error("QuotaExceededError");
    }
    store.set(key, String(value));
  },
  removeItem: (key) => store.delete(key)
};

const { saveItems, saveListAndStock, saveStockItems, setSaveFailureHandler } =
  await import("../../js/persistence.js");
const { state } = await import("../../js/state.js");

const failures = [];
setSaveFailureHandler((key) => failures.push(key));

beforeEach(() => {
  store.clear();
  failOnKey = null;
  failures.length = 0;
  state.items = [{ name: "Melk" }];
  state.stockItems = [{ name: "Rijst" }];
});

test("a save the browser refuses returns false and is reported instead of thrown", () => {
  assert.equal(saveItems(), true);
  failOnKey = STORAGE_KEY;
  assert.equal(saveItems(), false);
  assert.deepEqual(failures, [STORAGE_KEY]);
  failOnKey = STOCK_STORAGE_KEY;
  assert.equal(saveStockItems(), false);
  assert.deepEqual(failures, [STORAGE_KEY, STOCK_STORAGE_KEY]);
});

test("saving list and pantry together writes both, or puts both back", () => {
  store.set(STORAGE_KEY, JSON.stringify([{ name: "Melk" }]));
  store.set(STOCK_STORAGE_KEY, JSON.stringify([]));

  // Moving "Melk" to the pantry: the list write works, the pantry write fails.
  state.items = [];
  state.stockItems = [{ name: "Melk" }];
  failOnKey = STOCK_STORAGE_KEY;
  assert.equal(saveListAndStock(), false);
  assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)), [{ name: "Melk" }]);
  assert.deepEqual(JSON.parse(store.get(STOCK_STORAGE_KEY)), []);
  assert.deepEqual(failures, [STORAGE_KEY]);

  failOnKey = null;
  assert.equal(saveListAndStock(), true);
  assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)), []);
  assert.deepEqual(JSON.parse(store.get(STOCK_STORAGE_KEY)), [{ name: "Melk" }]);
});

test("rolling back removes a key that didn't exist before", () => {
  failOnKey = STOCK_STORAGE_KEY;
  assert.equal(saveListAndStock(), false);
  assert.equal(store.has(STORAGE_KEY), false);
  assert.equal(store.has(STOCK_STORAGE_KEY), false);
});
