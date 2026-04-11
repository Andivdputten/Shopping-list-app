document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "grocery_scanner_items_v4";

  const itemInput = document.getElementById("itemInput");
  const quantityInput = document.getElementById("quantityInput");
  const unitInput = document.getElementById("unitInput");
  const addButton = document.getElementById("addButton");
  const clearButton = document.getElementById("clearButton");
  const shoppingList = document.getElementById("shoppingList");
  const emptyMessage = document.getElementById("emptyMessage");
  const statusEl = document.getElementById("status");

  if (
    !itemInput ||
    !quantityInput ||
    !unitInput ||
    !addButton ||
    !clearButton ||
    !shoppingList ||
    !emptyMessage ||
    !statusEl
  ) {
    alert("HTML element missing. Check your index.html IDs.");
    return;
  }

  let items = loadItems();

  renderList();
  setStatus("App loaded successfully.");

  addButton.addEventListener("click", addItem);
  clearButton.addEventListener("click", clearAllItems);

  itemInput.addEventListener("keydown", handleEnterToAdd);
  quantityInput.addEventListener("keydown", handleEnterToAdd);
  unitInput.addEventListener("keydown", handleEnterToAdd);

  function handleEnterToAdd(event) {
    if (event.key === "Enter") {
      addItem();
    }
  }

  function addItem() {
    const name = itemInput.value.trim();
    const quantityRaw = quantityInput.value.trim();
    const unit = unitInput.value.trim();

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

    items.push({
      name,
      quantity,
      unit,
      bought: false
    });

    saveItems();
    renderList();

    itemInput.value = "";
    quantityInput.value = "";
    unitInput.value = "pcs";
    itemInput.focus();

    setStatus(`Added "${name}".`);
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
    saveItems();
    renderList();
    setStatus("All items cleared.");
  }

  function renderList() {
    shoppingList.innerHTML = "";

    if (items.length === 0) {
      emptyMessage.style.display = "block";
      return;
    }

    emptyMessage.style.display = "none";

    items.forEach((item, index) => {
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

      const metaSpan = document.createElement("span");
      metaSpan.className = "item-meta";

      const metaText = buildMetaText(item);
      metaSpan.textContent = metaText;

      itemButton.appendChild(nameSpan);

      if (metaText !== "") {
        itemButton.appendChild(metaSpan);
      }

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        deleteItem(index);
      });

      li.appendChild(itemButton);
      li.appendChild(deleteButton);
      shoppingList.appendChild(li);
    });
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

      return parsedItems.filter((item) => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof item.name === "string" &&
          (typeof item.quantity === "number" || item.quantity === null) &&
          typeof item.unit === "string" &&
          typeof item.bought === "boolean"
        );
      });
    } catch (error) {
      return [];
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }
});