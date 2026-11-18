// Unit tests for the Open Food Facts lookup (js/product-lookup.js), with fetch replaced by a stub.
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { lookupProductByBarcode, mapOffCategoryToAppCategory } from "../../js/product-lookup.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const respond = (status, body) => {
  globalThis.fetch = async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  });
};

test("a found product is converted to the app's format", async () => {
  respond(200, {
    status: 1,
    product: {
      product_name: "Halfvolle melk",
      brands: "Merk",
      quantity: "1 l",
      categories_tags: ["en:dairies", "en:milks"],
      nutrition_grades: "a",
      nutriments: {
        "energy-kcal_100g": 46,
        proteins_100g: 3.5,
        carbohydrates_100g: 4.8,
        fat_100g: 1.5,
        fiber_100g: 0.2
      }
    }
  });
  const product = await lookupProductByBarcode("8710000000001");
  assert.equal(product.name, "Halfvolle melk");
  assert.equal(product.category, "Dairy");
  assert.deepEqual(product.nutrition, {
    kcal100g: 46,
    protein100g: 3.5,
    carbs100g: 4.8,
    fat100g: 1.5,
    fiber100g: 0.2
  });
});

test("an unknown barcode is 'not found', a server error is a failure", async () => {
  respond(404, { status: 0 });
  assert.equal(await lookupProductByBarcode("1"), null);
  respond(500, {});
  await assert.rejects(lookupProductByBarcode("1"));
});

test("Open Food Facts categories map onto the app's categories", () => {
  assert.equal(mapOffCategoryToAppCategory(["en:fresh-vegetables"]), "Produce");
  assert.equal(mapOffCategoryToAppCategory([]), "");
});
