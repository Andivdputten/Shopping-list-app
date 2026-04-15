document.addEventListener("DOMContentLoaded", () => {
const STORAGE_KEY = "grocery_scanner_items_v6";
const CATEGORY_ORDER = [
"",
"Produce",
"Dairy",
"Pantry",
"Frozen",
"Drinks",
"Household",
"Personal care"
];

const formTitle = document.getElementById("formTitle");
const itemInput = document.getElementById("itemInput");
const quantityInput = document.getElementById("quantityInput");
const unitInput = document.getElementById("unitInput");
const categoryInput = document.getElementById("categoryInput");
const noteInput = document.getElementById("noteInput");
const barcodePreview = document.getElementById("barcodePreview");
const clearBarcodeButton = document.getElementById("clearBarcodeButton");
const addButton = document.getElementById("addButton");
const cancelEditButton = document.getElementById("cancelEditButton");

const startScannerButton = document.getElementById("startScannerButton");
const stopScannerButton = document.getElementById("stopScannerButton");
const scannerMessage = document.getElementById("scannerMessage");
const readerWrapper = document.getElementById("readerWrapper");

const searchInput = document.getElementById("searchInput");
const filterStatusInput = document.getElementById("filterStatusInput");
const filterCategoryInput = document.getElementById("filterCategoryInput");
const resetFiltersButton = document.getElementById("resetFiltersButton");

const clearButton = document.getElementById("clearButton");
const shoppingSections = document.getElementById("shoppingSections");
const emptyMessage = document.getElementById("emptyMessage");
const statusEl = document.getElementById("status");

if (
!formTitle ||
!itemInput ||
!quantityInput ||
!unitInput ||
!categoryInput ||
!noteInput ||
!barcodePreview ||
!clearBarcodeButton ||
!addButton ||
!cancelEditButton ||
!startScannerButton ||
!stopScannerButton ||
!scannerMessage ||
!readerWrapper ||
!searchInput ||
!filterStatusInput ||
!filterCategoryInput ||
!resetFiltersButton ||
!clearButton ||
!shoppingSections ||
!emptyMessage ||
!statusEl
) {
alert("HTML element missing. Check your index.html IDs.");
return;
}

let items = loadItems();
let editIndex = null;
let pendingBarcode = "";
let html5QrCode = null;
let scannerRunning = false;
let scanLock = false;

renderList();
updateFormMode();
updatePendingBarcodeUI();
setStatus("App loaded successfully.");

addButton.addEventListener("click", submitForm);
cancelEditButton.addEventListener("click", cancelEdit);
clearButton.addEventListener("click", clearAllItems);
clearBarcodeButton.addEventListener("click", clearPendingBarcode);

startScannerButton.addEventListener("click", () => {
void startScanner();
});

stopScannerButton.addEventListener("click", () => {
void stopScanner(false);
});

resetFiltersButton.addEventListener("click", resetFilters);

searchInput.addEventListener("input", renderList);
filterStatusInput.addEventListener("change", renderList);
filterCategoryInput.addEventListener("change", renderList);

itemInput.addEventListener("keydown", handleEnterToSubmit);
quantityInput.addEventListener("keydown", handleEnterToSubmit);
unitInput.addEventListener("keydown", handleEnterToSubmit);
categoryInput.addEventListener("keydown", handleEnterToSubmit);

function handleEnterToSubmit(event) {
if (event.key === "Enter") {
submitForm();
}
}

function submitForm() {
    const name = itemInput.value.trim();
    const quantityRaw = quantityInput.value.trim();
    const unit = unitInput.value.trim();
    const category = categoryInput.value.trim();
    const note = noteInput.value.trim();

    if (name === "") {
      setStatus("Type an item name first.");
      return;
    }

    let quantity = null;

    if (quantityRaw !== "") {
      quantity = Number(quantityRaw);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setStatus("Quantity must be greater than 0.");
        return;
      }
    }

    const duplicateBarcodeIndex = findDuplicateBarcodeIndex(
      pendingBarcode,
      editIndex
    );

    if (duplicateBarcodeIndex !== null) {
      const existingItem = items[duplicateBarcodeIndex];
      startEdit(duplicateBarcodeIndex);
      setStatus(
        `Barcode already belongs to "${existingItem.name}". Loaded existing item for editing instead of creating a duplicate.`
      );
return;
}

    const itemData = {
      name,
      quantity,
      unit,
      category,
      note,
      barcode: pendingBarcode,
      bought: false
    };

    if (editIndex === null) {
      items.push(itemData);
      setStatus(`Added "${name}".`);
    } else {
      itemData.bought = items[editIndex].bought;
      items[editIndex] = itemData;
      setStatus(`Updated "${name}".`);
    }

    saveItems();
    renderList();
    resetForm();
}

function startEdit(index) {
    const item = items[index];

    editIndex = index;
    itemInput.value = item.name;
    quantityInput.value = item.quantity === null ? "" : String(item.quantity);
    unitInput.value = item.unit;
    categoryInput.value = item.category;
    noteInput.value = item.note || "";
    pendingBarcode = typeof item.barcode === "string" ? item.barcode : "";
    updatePendingBarcodeUI();
    updateFormMode();

    itemInput.focus();
    setStatus(`Editing "${item.name}".`);
  }

function cancelEdit() {
if (editIndex === null) {
return;
}

const itemName = items[editIndex] ? items[editIndex].name : "item";
resetForm();
setStatus(`Edit cancelled for "${itemName}".`);
}

function resetForm() {
    editIndex = null;
    itemInput.value = "";
    quantityInput.value = "";
    unitInput.value = "";
    categoryInput.value = "";
    noteInput.value = "";
    pendingBarcode = "";
    updatePendingBarcodeUI();
    updateFormMode();
    itemInput.focus();
  }

function updateFormMode() {
if (editIndex === null) {
formTitle.textContent = "Add item";
addButton.textContent = "Add item";
cancelEditButton.classList.add("hidden");
} else {
formTitle.textContent = "Edit item";
addButton.textContent = "Save changes";
cancelEditButton.classList.remove("hidden");
}
}

function updatePendingBarcodeUI() {
barcodePreview.value = pendingBarcode;
clearBarcodeButton.disabled = pendingBarcode === "";
}

function clearPendingBarcode() {
if (pendingBarcode === "") {
setStatus("There is no barcode to clear.");
return;
}

pendingBarcode = "";
updatePendingBarcodeUI();
setStatus("Pending barcode cleared.");
}

async function startScanner() {
if (scannerRunning) {
setStatus("Scanner already running.");
return;
}

if (!window.isSecureContext) {
scannerMessage.textContent = "Scanner unavailable: page is not using HTTPS.";
setStatus("Camera scanning requires HTTPS.");
return;
}

if (typeof Html5Qrcode === "undefined") {
scannerMessage.textContent = "Scanner unavailable: library failed to load.";
setStatus("Scanner library did not load.");
return;
}

readerWrapper.classList.remove("hidden");
startScannerButton.disabled = true;
stopScannerButton.disabled = true;
scannerMessage.textContent = "Requesting camera access...";

scanLock = false;
html5QrCode = new Html5Qrcode("reader");

try {
await html5QrCode.start(
{ facingMode: "environment" },
{
fps: 10,
qrbox: { width: 280, height: 120 },
aspectRatio: 1.7777778
},
onScanSuccess,
() => {
// Ignore per-frame scan misses.
}
);

scannerRunning = true;
stopScannerButton.disabled = false;
scannerMessage.textContent =
"Scanner running. Point the back camera at a barcode.";
setStatus("Scanner started.");
} catch (error) {
html5QrCode = null;
readerWrapper.classList.add("hidden");
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
scannerMessage.textContent = "Could not start scanner.";
setStatus(getScannerStartErrorMessage(error));
}
}

function onScanSuccess(decodedText) {
if (scanLock) {
return;
}

scanLock = true;
void handleDetectedBarcode(decodedText);
}

async function handleDetectedBarcode(decodedText) {
pendingBarcode = decodedText;
updatePendingBarcodeUI();

await stopScanner(true);

const existingIndex = findItemIndexByBarcode(decodedText);

if (existingIndex !== null) {
const existingItem = items[existingIndex];
startEdit(existingIndex);
scannerMessage.textContent = `Matched existing item: ${existingItem.name}`;
setStatus(
`Barcode matched "${existingItem.name}". Existing item loaded for editing.`
);
return;
}

scannerMessage.textContent = "Looking up product data...";
setStatus("Barcode scanned. Looking up external product data...");

try {
const productData = await lookupProductByBarcode(decodedText);

if (productData !== null) {
applyLookupToForm(productData);

scannerMessage.textContent =
productData.name !== ""
? `External match: ${productData.name}`
: `External match for barcode ${decodedText}`;

setStatus("External product match found. Review the autofill and save.");
return;
}

scannerMessage.textContent = `New barcode ready: ${decodedText}`;
setStatus(
"Barcode not found in your list or external lookup. Fill in the item details manually."
);
} catch (error) {
scannerMessage.textContent = `New barcode ready: ${decodedText}`;
setStatus(
"Barcode scanned, but external lookup failed. Fill in the item details manually."
);
}
}

async function stopScanner(autoStopped) {
if (!html5QrCode) {
scannerRunning = false;
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
readerWrapper.classList.add("hidden");

if (autoStopped) {
scannerMessage.textContent = `Barcode ready for next save: ${pendingBarcode}`;
} else {
scannerMessage.textContent = "Scanner stopped.";
setStatus("Scanner stopped.");
}

return;
}

try {
if (scannerRunning) {
await html5QrCode.stop();
}
} catch (error) {
// Ignore stop errors and continue cleanup.
}

try {
html5QrCode.clear();
} catch (error) {
// Ignore clear errors during cleanup.
}

html5QrCode = null;
scannerRunning = false;
scanLock = false;
startScannerButton.disabled = false;
stopScannerButton.disabled = true;
readerWrapper.classList.add("hidden");

if (autoStopped) {
scannerMessage.textContent = `Barcode ready for next save: ${pendingBarcode}`;
} else {
scannerMessage.textContent = "Scanner stopped.";
setStatus("Scanner stopped.");
}
}

function getScannerStartErrorMessage(error) {
const message =
error && typeof error.message === "string"
? error.message
: String(error || "");

if (message.includes("NotAllowedError")) {
return "Camera permission was denied.";
}

if (message.includes("NotFoundError")) {
return "No usable camera was found.";
}

if (message.includes("NotReadableError")) {
return "Camera is busy or blocked by another app.";
}

return "Could not start the scanner.";
}

async function lookupProductByBarcode(barcode) {
const fields = [
"product_name",
"product_name_en",
"brands",
"quantity",
"categories_tags",
    "nutrition_grades"
].join(",");

const url =
`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
`?fields=${encodeURIComponent(fields)}`;

const response = await fetch(url);

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
    nutriScore: normalizeNutriScore(product.nutrition_grades)
};
}

function applyLookupToForm(productData) {
if (productData.name !== "" && itemInput.value.trim() === "") {
itemInput.value = productData.name;
}

if (productData.category !== "" && categoryInput.value.trim() === "") {
categoryInput.value = productData.category;
}

const generatedNote = buildLookupNote(productData);

if (generatedNote !== "" && noteInput.value.trim() === "") {
noteInput.value = generatedNote;
}
}

function buildLookupNote(productData) {
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

function mapOffCategoryToAppCategory(categoriesTags) {
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

function normalizeNutriScore(value) {
if (typeof value !== "string") {
return "";
}

const trimmed = value.trim().toLowerCase();

if (["a", "b", "c", "d", "e"].includes(trimmed)) {
return trimmed;
}

return "";
}

function normalizeText(value) {
return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
for (const value of values) {
if (typeof value === "string" && value.trim() !== "") {
return value.trim();
}
}

return "";
}

function findItemIndexByBarcode(barcode) {
if (typeof barcode !== "string" || barcode.trim() === "") {
return null;
}

const normalizedBarcode = barcode.trim();

const index = items.findIndex((item) => {
return (
typeof item.barcode === "string" &&
item.barcode.trim() === normalizedBarcode
);
});

return index === -1 ? null : index;
}

function findDuplicateBarcodeIndex(barcode, ignoreIndex) {
const matchIndex = findItemIndexByBarcode(barcode);

if (matchIndex === null) {
return null;
}

if (ignoreIndex !== null && matchIndex === ignoreIndex) {
return null;
}

return matchIndex;
}

function toggleBought(index) {
items[index].bought = !items[index].bought;
saveItems();
renderList();

const stateText = items[index].bought ? "bought" : "not bought";
setStatus(`Marked "${items[index].name}" as ${stateText}.`);
}

function deleteItem(index) {
const removedItem = items[index].name;
items.splice(index, 1);

if (editIndex === index) {
resetForm();
} else if (editIndex !== null && index < editIndex) {
editIndex -= 1;
updateFormMode();
}

saveItems();
renderList();
setStatus(`Removed "${removedItem}".`);
}

function clearAllItems() {
if (items.length === 0) {
setStatus("There is nothing to clear.");
return;
}

items = [];
resetForm();
saveItems();
renderList();
setStatus("All items cleared.");
}

function resetFilters() {
searchInput.value = "";
filterStatusInput.value = "all";
filterCategoryInput.value = "all";
renderList();
setStatus("Filters reset.");
}

function renderList() {
shoppingSections.innerHTML = "";

const filteredEntries = getFilteredEntries();

if (filteredEntries.length === 0) {
emptyMessage.style.display = "block";
return;
}

emptyMessage.style.display = "none";

const toBuyEntries = filteredEntries.filter((entry) => !entry.item.bought);
const boughtEntries = filteredEntries.filter((entry) => entry.item.bought);

if (toBuyEntries.length > 0) {
shoppingSections.appendChild(createStatusSection("To buy", toBuyEntries));
}

if (boughtEntries.length > 0) {
shoppingSections.appendChild(createStatusSection("Bought", boughtEntries));
}
}

function getFilteredEntries() {
const searchValue = searchInput.value.trim().toLowerCase();
const statusValue = filterStatusInput.value;
const categoryValue = filterCategoryInput.value;

return items
.map((item, index) => ({ item, index }))
.filter(({ item }) => {
const searchText = [item.name, item.note, item.barcode]
.join(" ")
.toLowerCase();

const matchesSearch =
searchValue === "" || searchText.includes(searchValue);

const matchesStatus =
statusValue === "all" ||
(statusValue === "to-buy" && !item.bought) ||
(statusValue === "bought" && item.bought);

const normalizedCategory = normalizeCategory(item.category);
const matchesCategory =
categoryValue === "all" || normalizedCategory === categoryValue;

return matchesSearch && matchesStatus && matchesCategory;
});
}

function createStatusSection(title, entries) {
const wrapper = document.createElement("section");
wrapper.className = "status-section";

const heading = document.createElement("h3");
heading.className = "status-heading";
heading.textContent = `${title} (${entries.length})`;

wrapper.appendChild(heading);

const groupedEntries = groupEntriesByCategory(entries);

CATEGORY_ORDER.forEach((category) => {
const categoryEntries = groupedEntries[category] || [];

if (categoryEntries.length === 0) {
return;
}

wrapper.appendChild(
createCategoryBlock(getCategoryLabel(category), categoryEntries)
);
});

return wrapper;
}

function groupEntriesByCategory(entries) {
const grouped = {};

entries.forEach((entry) => {
const key = normalizeCategory(entry.item.category);

if (!grouped[key]) {
grouped[key] = [];
}

grouped[key].push(entry);
});

return grouped;
}

function createCategoryBlock(title, entries) {
const wrapper = document.createElement("div");
wrapper.className = "category-block";

const heading = document.createElement("h4");
heading.className = "category-heading";
heading.textContent = `${title} (${entries.length})`;

const list = document.createElement("ul");
list.className = "shopping-list";

entries.forEach(({ item, index }) => {
const li = document.createElement("li");

const itemButton = document.createElement("button");
itemButton.className = "item-button";

if (item.bought) {
itemButton.classList.add("bought");
}

itemButton.addEventListener("click", () => {
toggleBought(index);
});

const nameSpan = document.createElement("span");
nameSpan.className = "item-name";
nameSpan.textContent = item.name;
itemButton.appendChild(nameSpan);

const metaText = buildMetaText(item);
if (metaText !== "") {
const metaSpan = document.createElement("span");
metaSpan.className = "item-meta";
metaSpan.textContent = metaText;
itemButton.appendChild(metaSpan);
}

if (item.note !== "") {
        const noteSpan = document.createElement("span");
        noteSpan.className = "item-note";
        noteSpan.textContent = item.note;
        itemButton.appendChild(noteSpan);
      }

      if (item.barcode !== "") {
        const barcodeSpan = document.createElement("span");
        barcodeSpan.className = "item-barcode";
        barcodeSpan.textContent = `Barcode: ${item.barcode}`;
        itemButton.appendChild(barcodeSpan);
      }

const categoryLabel = document.createElement("span");
categoryLabel.className = "item-category";
categoryLabel.textContent = getCategoryLabel(item.category);
itemButton.appendChild(categoryLabel);

const actions = document.createElement("div");
actions.className = "item-actions";

const editButton = document.createElement("button");
editButton.className = "edit-button";
editButton.textContent = "Edit";
editButton.addEventListener("click", () => {
startEdit(index);
});

const deleteButton = document.createElement("button");
deleteButton.className = "delete-button";
deleteButton.textContent = "Delete";
deleteButton.addEventListener("click", () => {
deleteItem(index);
});

actions.appendChild(editButton);
actions.appendChild(deleteButton);

li.appendChild(itemButton);
li.appendChild(actions);
list.appendChild(li);
});

wrapper.appendChild(heading);
wrapper.appendChild(list);

return wrapper;
}

function normalizeCategory(category) {
if (typeof category !== "string") {
return "";
}

const trimmed = category.trim();

if (CATEGORY_ORDER.includes(trimmed)) {
return trimmed;
}

return "";
}

function getCategoryLabel(category) {
const normalized = normalizeCategory(category);
return normalized === "" ? "Uncategorised" : normalized;
}

function buildMetaText(item) {
const hasQuantity = typeof item.quantity === "number" && item.quantity > 0;
const hasUnit = typeof item.unit === "string" && item.unit.trim() !== "";

if (hasQuantity && hasUnit) {
return `${formatQuantity(item.quantity)} ${item.unit}`;
}

if (hasQuantity) {
return `${formatQuantity(item.quantity)}`;
}

return "";
}

function formatQuantity(quantity) {
return String(quantity);
}

function saveItems() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadItems() {
    const savedItems = localStorage.getItem(STORAGE_KEY);

    if (!savedItems) {
return [];
}

    try {
      const parsedItems = JSON.parse(savedItems);

      if (!Array.isArray(parsedItems)) {
        return [];
      }

      return parsedItems
        .filter((item) => {
          return (
            typeof item === "object" &&
            item !== null &&
            typeof item.name === "string" &&
            (typeof item.quantity === "number" || item.quantity === null) &&
            typeof item.unit === "string" &&
            typeof item.category === "string" &&
            typeof item.note === "string" &&
            typeof item.bought === "boolean"
          );
        })
        .map((item) => {
          return {
            ...item,
            barcode: typeof item.barcode === "string" ? item.barcode : ""
          };
        });
    } catch (error) {
      return [];
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
}
});
