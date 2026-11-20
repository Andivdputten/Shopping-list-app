// Looks up scanned barcodes in Open Food Facts and converts the answer to the app's item format.
import { firstNonEmpty, normalizeText, pickFirstNumber } from "./format.js";
import { normalizeNutrition } from "./nutrition.js";

export async function lookupProductByBarcode(barcode) {
  const fields = [
    "product_name",
    "product_name_en",
    "brands",
    "quantity",
    "categories_tags",
    "nutrition_grades",
    "nutriments"
  ].join(",");

  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
    `?fields=${encodeURIComponent(fields)}`;

  const response = await fetch(url);

  if (response.status === 404) {
    // Open Food Facts uses 404 for "no product with this barcode",
    // which is a normal, expected outcome — not a lookup failure.
    return null;
  }

  if (!response.ok) {
    throw new Error(`Lookup failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data || data.status !== 1 || !data.product) {
    return null;
  }

  const product = data.product;

  return {
    name: firstNonEmpty(
      normalizeText(product.product_name),
      normalizeText(product.product_name_en),
      ""
    ),
    brand: normalizeText(product.brands),
    packageQuantity: normalizeText(product.quantity),
    category: mapOffCategoryToAppCategory(product.categories_tags),
    nutriScore: normalizeNutriScore(product.nutrition_grades),
    nutrition: extractNutritionFromOffProduct(product)
  };
}

export function buildLookupNote(productData) {
  const lines = [];

  if (productData.brand !== "") {
    lines.push(`Brand: ${productData.brand}`);
  }

  if (productData.packageQuantity !== "") {
    lines.push(`Pack size: ${productData.packageQuantity}`);
  }

  if (productData.nutriScore !== "") {
    lines.push(`Nutri-Score: ${productData.nutriScore.toUpperCase()}`);
  }

  return lines.join("\n");
}

export function mapOffCategoryToAppCategory(categoriesTags) {
  if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) {
    return "";
  }

  const text = categoriesTags.join(" ").toLowerCase();

  if (
    text.includes("en:fruits") ||
    text.includes("en:vegetables") ||
    text.includes("en:fresh-vegetables") ||
    text.includes("en:fresh-fruits") ||
    text.includes("en:produce")
  ) {
    return "Produce";
  }

  if (
    text.includes("en:milk") ||
    text.includes("en:cheeses") ||
    text.includes("en:yogurts") ||
    text.includes("en:butter") ||
    text.includes("en:cream") ||
    text.includes("en:dairy")
  ) {
    return "Dairy";
  }

  if (
    text.includes("en:frozen-foods") ||
    text.includes("en:frozen-pizzas") ||
    text.includes("en:frozen-desserts") ||
    text.includes("en:ice-creams")
  ) {
    return "Frozen";
  }

  if (
    text.includes("en:beverages") ||
    text.includes("en:drinks") ||
    text.includes("en:waters") ||
    text.includes("en:juices") ||
    text.includes("en:sodas") ||
    text.includes("en:soft-drinks") ||
    text.includes("en:teas") ||
    text.includes("en:coffees") ||
    text.includes("en:energy-drinks")
  ) {
    return "Drinks";
  }

  return "Pantry";
}

export function normalizeNutriScore(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toLowerCase();

  if (["a", "b", "c", "d", "e"].includes(trimmed)) {
    return trimmed;
  }

  return "";
}

export function extractNutritionFromOffProduct(product) {
  const nutriments =
    product &&
    typeof product === "object" &&
    product.nutriments &&
    typeof product.nutriments === "object"
      ? product.nutriments
      : {};

  return normalizeNutrition({
    kcal100g: pickFirstNumber(nutriments["energy-kcal_100g"], nutriments["energy-kcal"]),
    protein100g: pickFirstNumber(nutriments.proteins_100g),
    carbs100g: pickFirstNumber(nutriments.carbohydrates_100g),
    fat100g: pickFirstNumber(nutriments.fat_100g),
    fiber100g: pickFirstNumber(nutriments.fiber_100g)
  });
}

// Products whose names match a search, from Open Food Facts' full-text search (needs a connection).
// Only products with nutrition data are returned, since the search is used to fill in nutrition.
export async function searchProductsByName(query, limit = 10) {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1" +
    `&page_size=${limit}&fields=product_name,brands,nutriments` +
    `&search_terms=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }
  const data = await response.json();
  return (Array.isArray(data.products) ? data.products : [])
    .map((product) => ({
      name: normalizeText(product.product_name),
      brand: normalizeText(product.brands),
      nutrition: extractNutritionFromOffProduct(product)
    }))
    .filter((product) => product.name !== "" && product.nutrition.kcal100g !== null);
}
