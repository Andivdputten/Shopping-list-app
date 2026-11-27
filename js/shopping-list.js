// The shopping list, in two modes. Plan builds the list: an add box that reads amounts ("2 l milk"),
// steppers for counted items and an edit sheet. Shop is for the store: big tick boxes, progress, and
// "Done shopping", which moves the ticked items to the pantry after a confirmation.
// Items are found by their id, never by their position, so Undo and moves can't hit the wrong item.
import { findSameNameItem, mergedAmount, parseAddInput } from "./add-parser.js";
import { rememberAisle, suggestAisle } from "./aisle-memory.js";
import { CATEGORY_ORDER, LIST_MODE_STORAGE_KEY, STOCK_STORAGE_KEY } from "./constants.js";
import {
  clearButton,
  listEls,
  listMacroChart,
  listMacroCoverage,
  listMacroLegend,
  shoppingSections
} from "./dom.js";
import { buildMetaText } from "./format.js";
import { resetForm } from "./item-form.js";
import {
  createShoppingItem,
  createStockItem,
  isCountableUnit,
  isRunningLow,
  markRestocked,
  mergeStockItems,
  normalizeCategory,
  touchItem
} from "./items.js";
import { initItemSheet, openItemSheet } from "./list-item-sheet.js";
import { findMatchingStockIndex, renderStockList } from "./pantry.js";
import { saveItems, saveListAndStock, setSaveFailureHandler } from "./persistence.js";
import { renderRecipeBuilder, renderRecipeItemOptions } from "./recipe-builder.js";
import { renderSavedRecipes } from "./saved-recipes.js";
import { state } from "./state.js";
import { renderMacroStatBlock } from "./statistics.js";
import { refreshSubtitle, setSubtitleProvider, updateTabBadges } from "./tabs.js";
import { setStatus, showToast } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function icon(pathData) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function indexOfId(id) {
  return state.items.findIndex((item) => item.id === id);
}

function amountText(quantity, unit) {
  return buildMetaText({ quantity, unit });
}

function toBuyCount() {
  return state.items.filter((item) => !item.bought).length;
}

// After a redraw the old buttons are gone; this puts the keyboard focus back on the new one.
function focusAfterRender(selector, fallback) {
  const target = shoppingSections.querySelector(selector) || fallback;
  if (target && typeof target.focus === "function") {
    target.focus();
  }
}

function rowSelector(id) {
  return `[data-id="${CSS.escape(id)}"]`;
}

// ---------------------------------------------------------------------------
// Mode (Plan or Shop), remembered on this device
// ---------------------------------------------------------------------------

let storedMode = null;

function readStoredMode() {
  try {
    return localStorage.getItem(LIST_MODE_STORAGE_KEY) === "shop" ? "shop" : "plan";
  } catch (error) {
    return "plan";
  }
}

// An empty list can only be planned.
function currentMode() {
  if (storedMode === null) {
    storedMode = readStoredMode();
  }
  return state.items.length === 0 ? "plan" : storedMode;
}

function setMode(mode) {
  storedMode = mode;
  try {
    localStorage.setItem(LIST_MODE_STORAGE_KEY, mode);
  } catch (error) {
    // Not remembering the mode only means the list opens in Plan next time.
  }
  renderList();
}

// The header subtitle while the List tab is open.
export function listSubtitle() {
  if (state.items.length === 0) {
    return "Nothing to buy";
  }
  const toBuy = toBuyCount();
  return toBuy === 0 ? "Everything's in your basket" : `${toBuy} to buy`;
}

// ---------------------------------------------------------------------------
// Start-up wiring
// ---------------------------------------------------------------------------

export function initShoppingList() {
  setSubtitleProvider("list", listSubtitle);
  initItemSheet();

  listEls.planModeButton.addEventListener("click", () => setMode("plan"));
  listEls.shopModeButton.addEventListener("click", () => setMode("shop"));

  listEls.listAddInput.addEventListener("input", renderAddBox);
  listEls.listAddInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      addFromInput(false);
    }
  });
  listEls.listAddButton.addEventListener("click", () => addFromInput(false));

  listEls.listActionButton.addEventListener("click", () => {
    if (currentMode() === "plan") {
      setMode("shop");
      listEls.shopModeButton.focus();
    } else {
      openMoveDialog();
    }
  });

  listEls.moveCancelButton.addEventListener("click", () => listEls.moveDialog.close());
  listEls.moveConfirmButton.addEventListener("click", moveBoughtToPantry);
  listEls.moveDialog.addEventListener("close", () => {
    if (listEls.moveDialog.open) {
      return;
    }
    const back = listEls.listActionBar.classList.contains("hidden")
      ? listEls.listAddInput
      : listEls.listActionButton;
    back.focus();
  });

  initListMenu();

  setSaveFailureHandler(showSaveError);
  listEls.listSaveRetryButton.addEventListener("click", () => {
    if (saveListAndStock()) {
      listEls.listSaveError.classList.add("hidden");
      setStatus("Your list and pantry are saved.");
      showToast("Saved");
    }
  });
}

function initListMenu() {
  const button = listEls.listMenuButton;
  const menu = listEls.listMenu;
  const close = (returnFocus) => {
    menu.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) {
      button.focus();
    }
  };

  button.addEventListener("click", () => {
    const opening = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !opening);
    button.setAttribute("aria-expanded", String(opening));
    if (opening) {
      clearButton.focus();
    }
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close(true);
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.classList.contains("hidden") && !event.target.closest(".list-menu-wrap")) {
      close(false);
    }
  });
  clearButton.addEventListener("click", () => {
    close(false);
    clearAllItems();
    listEls.listAddInput.focus();
  });
}

function showSaveError(key) {
  const what = key === STOCK_STORAGE_KEY ? "your last pantry change" : "your last change";
  listEls.listSaveErrorText.textContent =
    `This device's storage for the app is full, so ${what} will be gone after a reload. ` +
    "Export a backup and remove old recipes in Settings to make room, then try again.";
  listEls.listSaveError.classList.remove("hidden");
  setStatus("Couldn't save: the browser storage is full.");
}

// ---------------------------------------------------------------------------
// Lookups used by the Scanner form
// ---------------------------------------------------------------------------

export function findItemIndexByBarcode(barcode) {
  if (typeof barcode !== "string" || barcode.trim() === "") {
    return null;
  }

  const normalizedBarcode = barcode.trim();

  const index = state.items.findIndex((item) => {
    return typeof item.barcode === "string" && item.barcode.trim() === normalizedBarcode;
  });

  return index === -1 ? null : index;
}

export function findDuplicateBarcodeIndex(barcode, ignoreIndex) {
  const matchIndex = findItemIndexByBarcode(barcode);

  if (matchIndex === null) {
    return null;
  }

  if (ignoreIndex !== null && matchIndex === ignoreIndex) {
    return null;
  }

  return matchIndex;
}

// ---------------------------------------------------------------------------
// Adding
// ---------------------------------------------------------------------------

// What the add box would do with the text typed so far, or null when nothing is typed.
function planAdd() {
  const parsed = parseAddInput(listEls.listAddInput.value);
  if (parsed.name === "") {
    return null;
  }
  const existing = findSameNameItem(state.items, parsed.name);
  return {
    parsed,
    existing,
    merge: existing ? mergedAmount(existing, parsed) : null,
    aisle: suggestAisle(parsed.name, state.stockItems)
  };
}

function renderAddBox() {
  const plan = planAdd();
  const button = listEls.listAddButton;
  const preview = listEls.listAddPreview;
  preview.innerHTML = "";

  if (!plan) {
    button.disabled = true;
    button.textContent = "Add";
    preview.classList.add("hidden");
    listEls.listAddInput.removeAttribute("aria-describedby");
    return;
  }

  const { parsed, existing, merge, aisle } = plan;
  button.disabled = false;
  if (existing && merge) {
    button.textContent = `Make it ${amountText(merge.quantity, merge.unit)}`;
  } else if (existing) {
    button.textContent = "Add anyway";
  } else {
    button.textContent = "Add";
  }

  preview.classList.remove("hidden");
  listEls.listAddInput.setAttribute("aria-describedby", "listAddPreview");

  preview.appendChild(el("p", "list-add-label", "Will be added as"));
  const chips = el("div", "chips");
  chips.appendChild(el("span", "chip chip-static chip-on", parsed.name));
  if (parsed.quantity !== null) {
    chips.appendChild(
      el("span", "chip chip-static chip-on", amountText(parsed.quantity, parsed.unit))
    );
  }
  const aisleChip = el("span", "chip chip-static" + (aisle ? " chip-on" : ""));
  aisleChip.textContent = aisle ? aisle.category : "No aisle";
  if (aisle) {
    aisleChip.appendChild(
      el("span", "chip-note", aisle.source === "pantry" ? "from pantry" : "as before")
    );
  }
  chips.appendChild(aisleChip);
  preview.appendChild(chips);

  if (existing) {
    const warning = el("div", "dupe-warning");
    const existingAmount = buildMetaText(existing);
    warning.appendChild(
      el(
        "strong",
        "",
        `${existing.name} is already on your list${existingAmount ? ` (${existingAmount})` : ""}.`
      )
    );
    if (merge) {
      const separate = el("button", "dupe-button", "Add as a separate item instead");
      separate.type = "button";
      separate.addEventListener("click", () => addFromInput(true));
      warning.appendChild(separate);
    }
    preview.appendChild(warning);
  }
}

// Adds what is typed in the add box. With the same name already on the list and amounts that can be
// added up, the main action adds to that item ("Make it 4 l"); `separate` forces a new item instead.
function addFromInput(separate) {
  const plan = planAdd();
  if (!plan) {
    return;
  }
  const { parsed, existing, merge, aisle } = plan;

  if (existing && merge && !separate) {
    existing.quantity = merge.quantity;
    existing.unit = merge.unit;
    touchItem(existing);
    setStatus(`Updated "${existing.name}" to ${amountText(merge.quantity, merge.unit)}.`);
    showToast(`${existing.name} is now ${amountText(merge.quantity, merge.unit)}`);
  } else {
    state.items.push(
      createShoppingItem({
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        category: aisle ? aisle.category : ""
      })
    );
    setStatus(`Added "${parsed.name}" to your shopping list.`);
    showToast(`${parsed.name} added to your list`);
  }

  listEls.listAddInput.value = "";
  saveItems();
  renderList();
  renderAddBox();
  listEls.listAddInput.focus();
}

// A "running low" chip in the empty list: the pantry item goes on the list with the amount that brings
// it back to its last restock level (2 eggs left of 10: buy 8), in the pantry's unit.
function addFromPantry(stockItem) {
  const topUp = Math.round((stockItem.restockQuantity - stockItem.quantity) * 1000) / 1000;
  state.items.push(
    createShoppingItem({
      ...stockItem,
      id: undefined,
      updatedAt: undefined,
      quantity: topUp > 0 ? topUp : null,
      restockQuantity: null
    })
  );
  saveItems();
  renderList();
  setStatus(`Added "${stockItem.name}" to your shopping list.`);
  showToast(`${stockItem.name} added to your list`);
  listEls.listAddInput.focus();
}

// ---------------------------------------------------------------------------
// Changing and removing items
// ---------------------------------------------------------------------------

function stepItem(id, delta) {
  const index = indexOfId(id);
  if (index === -1) {
    return;
  }
  const item = state.items[index];
  const next = Math.round(((item.quantity || 0) + delta) * 1000) / 1000;
  if (next < 1) {
    return;
  }
  item.quantity = next;
  touchItem(item);
  saveItems();
  renderList();
  setStatus(`"${item.name}" is now ${buildMetaText(item)}.`);
  const which = delta > 0 ? "more" : "fewer";
  const other = delta > 0 ? "fewer" : "more";
  focusAfterRender(
    `${rowSelector(id)} [data-step="${which}"]:not(:disabled)`,
    shoppingSections.querySelector(`${rowSelector(id)} [data-step="${other}"]`)
  );
}

function toggleBought(id) {
  const index = indexOfId(id);
  if (index === -1) {
    return;
  }
  const item = state.items[index];
  item.bought = !item.bought;
  touchItem(item);
  saveItems();
  renderList();
  setStatus(`Marked "${item.name}" as ${item.bought ? "bought" : "not bought"}.`);
  focusAfterRender(`${rowSelector(id)} input[type="checkbox"]`);
}

function openSheetFor(id, opener) {
  const index = indexOfId(id);
  if (index === -1) {
    return;
  }
  openItemSheet(state.items[index], {
    opener,
    onSave: (fields) => saveFromSheet(id, fields),
    onDelete: () => deleteItemById(id)
  });
}

function saveFromSheet(id, fields) {
  const index = indexOfId(id);
  if (index === -1) {
    return;
  }
  const existing = state.items[index];
  // createShoppingItem() keeps the id, barcode and other fields and resets "bought"; put that back.
  const updated = createShoppingItem({ ...existing, ...fields });
  updated.bought = existing.bought;
  state.items[index] = touchItem(updated);
  rememberAisle(updated.name, updated.category);
  saveItems();
  renderList();
  setStatus(`Updated "${updated.name}".`);
  showToast(`${updated.name} updated`);
  focusAfterRender(`${rowSelector(id)} .plan-row-main`, listEls.listAddInput);
}

function deleteItemById(id) {
  const index = indexOfId(id);
  if (index === -1) {
    return;
  }
  const [removed] = state.items.splice(index, 1);
  if (state.editId === removed.id) {
    resetForm();
  }
  saveItems();
  renderList();
  setStatus(`Removed "${removed.name}".`);
  showToast(
    `${removed.name} deleted`,
    { label: "Undo", onClick: () => undoDelete(removed, index) },
    { icon: false }
  );
  listEls.listAddInput.focus();
}

function undoDelete(item, index) {
  if (indexOfId(item.id) !== -1) {
    return;
  }
  state.items.splice(Math.min(index, state.items.length), 0, item);
  saveItems();
  renderList();
  setStatus(`Put "${item.name}" back on your list.`);
  focusAfterRender(`${rowSelector(item.id)} .plan-row-main`);
}

export function clearAllItems() {
  if (state.items.length === 0) {
    setStatus("There is nothing to clear.");
    return;
  }

  // Ask before wiping the whole list, because there is no undo and no backup.
  if (
    !window.confirm(
      `Delete all ${state.items.length} item${state.items.length === 1 ? "" : "s"} from your shopping list? This can't be undone.`
    )
  ) {
    setStatus("Clear cancelled.");
    return;
  }

  state.items = [];
  resetForm();
  saveItems();
  renderList();
  setStatus("All items cleared.");
}

// ---------------------------------------------------------------------------
// Done shopping: ticked items to the pantry
// ---------------------------------------------------------------------------

// What moving one item does to the pantry, for the confirmation: [plain text, highlighted text].
function describeMove(item) {
  const index = findMatchingStockIndex(item);
  const amount = buildMetaText(item);
  if (index === null) {
    return ["", amount ? `New · ${amount}` : "New"];
  }
  const stockItem = state.stockItems[index];
  const merged = mergeStockItems(stockItem, item);
  if (typeof merged.quantity === "number" && merged.quantity !== stockItem.quantity) {
    const before = typeof stockItem.quantity === "number" ? stockItem.quantity : 0;
    return [`${before} → `, buildMetaText(merged)];
  }
  return ["Already in pantry", ""];
}

function openMoveDialog() {
  const bought = state.items.filter((item) => item.bought);
  if (bought.length === 0) {
    return;
  }

  listEls.moveDialogTitle.textContent = `Move ${plural(bought.length, "item")} to your pantry?`;
  listEls.moveList.innerHTML = "";
  bought.forEach((item) => {
    const li = el("li");
    li.appendChild(el("span", "move-name", item.name));
    const [plain, strong] = describeMove(item);
    const tag = el("span", "move-tag", plain);
    if (strong) {
      tag.appendChild(el("b", "", strong));
    }
    li.appendChild(tag);
    listEls.moveList.appendChild(li);
  });

  const staying = state.items.length - bought.length;
  listEls.moveStayNote.textContent =
    staying === 0
      ? ""
      : `${plural(staying, "item")} you didn't tick ${staying === 1 ? "stays" : "stay"} on your list.`;
  listEls.moveStayNote.classList.toggle("hidden", staying === 0);
  listEls.moveConfirmButton.textContent = `Move ${bought.length} to pantry`;
  listEls.moveDialog.showModal();
  listEls.moveConfirmButton.focus();
}

// Moves every ticked item into the pantry (adding to matching stock) in one save of both lists.
// If the save fails, both lists go back to how they were and the error banner explains why.
function moveBoughtToPantry() {
  const itemsBefore = state.items;
  const stockBefore = state.stockItems;
  const moving = itemsBefore.filter((item) => item.bought);
  if (moving.length === 0) {
    listEls.moveDialog.close();
    return;
  }

  state.stockItems = [...stockBefore];
  moving.forEach((item) => {
    const index = findMatchingStockIndex(item);
    if (index === null) {
      const idTaken = state.stockItems.some((stockItem) => stockItem.id === item.id);
      const added = createStockItem({ ...item, id: idTaken ? undefined : item.id });
      state.stockItems.push(touchItem(markRestocked(added, null)));
    } else {
      const quantityBefore = state.stockItems[index].quantity;
      state.stockItems[index] = touchItem(
        markRestocked(mergeStockItems(state.stockItems[index], item), quantityBefore)
      );
    }
  });
  state.items = itemsBefore.filter((item) => !item.bought);

  if (!saveListAndStock()) {
    state.items = itemsBefore;
    state.stockItems = stockBefore;
    listEls.moveDialog.close();
    renderList();
    renderStockList();
    return;
  }

  if (moving.some((item) => item.id === state.editId)) {
    resetForm();
  }
  listEls.moveDialog.close();
  renderList();
  renderStockList();
  setStatus(`Moved ${plural(moving.length, "item")} to your pantry.`);
  showToast(`${plural(moving.length, "item")} moved to your pantry`);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export function renderList() {
  updateTabBadges();
  renderMacroStatBlock(state.items, listMacroChart, listMacroLegend, listMacroCoverage);
  renderRecipeItemOptions();
  renderRecipeBuilder();
  renderSavedRecipes();
  refreshSubtitle("list");

  const mode = currentMode();
  renderModeBar(mode);
  listEls.listAddBox.classList.toggle("hidden", mode === "shop");

  shoppingSections.innerHTML = "";
  if (mode === "shop") {
    renderShop();
  } else if (state.items.length === 0) {
    renderEmpty();
  } else {
    renderPlan();
  }
  renderActionBar(mode);
}

function renderModeBar(mode) {
  const empty = state.items.length === 0;
  listEls.planModeButton.setAttribute("aria-pressed", String(mode === "plan"));
  listEls.shopModeButton.setAttribute("aria-pressed", String(mode === "shop"));
  const toBuy = toBuyCount();
  listEls.shopModeButton.textContent = toBuy === 0 ? "Shop" : `Shop · ${toBuy}`;
  listEls.shopModeButton.disabled = empty;
  if (empty) {
    listEls.shopModeButton.setAttribute("aria-describedby", "shopModeHint");
  } else {
    listEls.shopModeButton.removeAttribute("aria-describedby");
  }
}

function renderActionBar(mode) {
  const bar = listEls.listActionBar;
  const button = listEls.listActionButton;
  const toBuy = toBuyCount();
  const bought = state.items.length - toBuy;

  if (mode === "plan" && toBuy > 0) {
    button.textContent = `Start shopping · ${plural(toBuy, "item")}`;
    button.className = "primary-button";
    bar.classList.remove("hidden");
  } else if (mode === "shop" && bought > 0) {
    button.textContent = `Done shopping · move ${bought} to pantry`;
    // The main action once everything is ticked; a quieter button while still shopping.
    button.className = toBuy === 0 ? "primary-button" : "tonal-button";
    bar.classList.remove("hidden");
  } else {
    button.textContent = "";
    bar.classList.add("hidden");
  }
}

// Items grouped by aisle, in the store order of CATEGORY_ORDER; items without an aisle come first.
function groupByAisle(items) {
  const groups = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  items.forEach((item) => groups.get(normalizeCategory(item.category)).push(item));
  return [...groups.entries()]
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([category, groupItems]) => ({
      label: category === "" ? "No aisle" : category,
      items: groupItems
    }));
}

function renderPlan() {
  const card = el("section", "card plan-card");
  card.setAttribute("aria-label", "Your shopping list");
  groupByAisle(state.items).forEach((group) => {
    const heading = el("h3", "aisle-heading");
    heading.appendChild(el("span", "", group.label));
    heading.appendChild(el("span", "aisle-count", String(group.items.length)));
    card.appendChild(heading);
    const list = el("ul", "plan-list");
    group.items.forEach((item) => list.appendChild(createPlanRow(item)));
    card.appendChild(list);
  });
  shoppingSections.appendChild(card);
}

function createPlanRow(item) {
  const li = el("li", "plan-row");
  li.dataset.id = item.id;

  const main = el("button", "plan-row-main");
  main.type = "button";
  main.appendChild(el("span", "sr-only", "Edit "));
  main.appendChild(el("span", "plan-row-name", item.name));
  const details = [];
  if (item.note) {
    details.push(item.note);
  }
  if (item.bought) {
    details.push("In your basket");
  }
  if (item.barcode) {
    details.push("Scanned");
  }
  if (details.length > 0) {
    main.appendChild(el("span", "plan-row-sub", details.join(" · ")));
  }
  main.addEventListener("click", () => openSheetFor(item.id, main));
  li.appendChild(main);

  const hasQuantity = typeof item.quantity === "number" && item.quantity > 0;
  if (hasQuantity && isCountableUnit(item.unit)) {
    li.appendChild(createStepper(item));
  } else {
    const amount = el("button", "amount-button");
    amount.type = "button";
    if (hasQuantity) {
      amount.appendChild(el("span", "", buildMetaText(item)));
      amount.appendChild(icon("M6 9l6 6 6-6"));
      amount.setAttribute("aria-label", `Amount, ${item.name}, ${buildMetaText(item)}. Change`);
    } else {
      amount.classList.add("ghost");
      amount.textContent = "Set amount";
      amount.setAttribute("aria-label", `Set amount, ${item.name}`);
    }
    amount.addEventListener("click", () => openSheetFor(item.id, amount));
    li.appendChild(amount);
  }
  return li;
}

function createStepper(item) {
  const stepper = el("span", "stepper");
  const minus = el("button", "stepper-button", "−");
  minus.type = "button";
  minus.dataset.step = "fewer";
  minus.disabled = item.quantity <= 1;
  minus.setAttribute(
    "aria-label",
    minus.disabled ? `One fewer, ${item.name} (1 is the least)` : `One fewer, ${item.name}`
  );
  minus.addEventListener("click", () => stepItem(item.id, -1));

  const value = el("span", "stepper-value", buildMetaText(item));

  const plus = el("button", "stepper-button", "+");
  plus.type = "button";
  plus.dataset.step = "more";
  plus.setAttribute("aria-label", `One more, ${item.name}`);
  plus.addEventListener("click", () => stepItem(item.id, 1));

  stepper.appendChild(minus);
  stepper.appendChild(value);
  stepper.appendChild(plus);
  return stepper;
}

function renderEmpty() {
  const card = el("section", "card list-empty");
  const glyph = el("div", "list-empty-glyph");
  glyph.appendChild(
    icon("M9 6h11M9 12h11M9 18h11M4.5 6l.75.75L6.5 5M4.5 12l.75.75L6.5 11M4.5 18l.75.75L6.5 17")
  );
  card.appendChild(glyph);
  card.appendChild(el("h3", "", "Your shopping list is empty"));
  card.appendChild(el("p", "", "Type what you need above, or scan a product on the Scanner tab."));

  const low = state.stockItems.filter(
    (stockItem) => isRunningLow(stockItem) && !findSameNameItem(state.items, stockItem.name)
  );
  if (low.length > 0) {
    card.appendChild(el("p", "list-add-label", "Running low in your pantry"));
    const chips = el("div", "chips chips-center");
    low.forEach((stockItem) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.appendChild(document.createTextNode(`+ ${stockItem.name}`));
      chip.appendChild(el("span", "chip-note", `${buildMetaText(stockItem)} left`));
      chip.setAttribute(
        "aria-label",
        `Add ${stockItem.name} to your list. ${buildMetaText(stockItem)} left in your pantry`
      );
      chip.addEventListener("click", () => addFromPantry(stockItem));
      chips.appendChild(chip);
    });
    card.appendChild(chips);
  }
  shoppingSections.appendChild(card);
}

function renderShop() {
  const total = state.items.length;
  const bought = total - toBuyCount();

  const progress = el("div", "shop-progress");
  const label = el("p", "shop-progress-label", `${bought} of ${total} in your basket`);
  label.id = "shopProgressLabel";
  const bar = el("div", "shop-progress-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-labelledby", "shopProgressLabel");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(total));
  bar.setAttribute("aria-valuenow", String(bought));
  const fill = el("span", "shop-progress-fill");
  fill.style.width = `${Math.round((bought / total) * 100)}%`;
  bar.appendChild(fill);
  progress.appendChild(label);
  progress.appendChild(bar);
  shoppingSections.appendChild(progress);

  if (bought === total) {
    const done = el("section", "card list-all-done");
    const badge = el("div", "list-empty-glyph round");
    badge.appendChild(icon("M5 12.5l4.5 4.5L19 7.5"));
    done.appendChild(badge);
    done.appendChild(el("h3", "", "Everything's in your basket"));
    done.appendChild(
      el("p", "", "Move it to your pantry so recipes and cooking know what you have.")
    );
    shoppingSections.appendChild(done);
  }

  groupByAisle(state.items).forEach((group) => {
    shoppingSections.appendChild(el("h3", "shop-aisle", group.label));
    const list = el("ul", "card shop-list");
    group.items.forEach((item) => {
      const li = el("li");
      li.dataset.id = item.id;
      const row = el("label", "shop-row");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = item.bought;
      box.addEventListener("change", () => toggleBought(item.id));
      const name = el("span", "shop-name", item.name);
      if (item.note) {
        name.appendChild(el("span", "shop-note", item.note));
      }
      row.appendChild(box);
      row.appendChild(name);
      const amount = buildMetaText(item);
      if (amount) {
        row.appendChild(el("span", "shop-amount", amount));
      }
      li.appendChild(row);
      list.appendChild(li);
    });
    shoppingSections.appendChild(list);
  });
}
