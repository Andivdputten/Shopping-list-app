document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "grocery_scanner_items";

  const itemInput = document.getElementById("itemInput");
  const addButton = document.getElementById("addButton");
  const clearButton = document.getElementById("clearButton");
  const shoppingList = document.getElementById("shoppingList");
  const emptyMessage = document.getElementById("emptyMessage");
  const statusEl = document.getElementById("status");

  if (
    !itemInput ||
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

  addButton.addEventListener("click", () => {
    alert("Add button tapped");
    addItem();
  });

  clearButton.addEventListener("click", clearAllItems);

  itemInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addItem();
    }
  });

  function addItem() {
    const value = itemInput.value.trim();

    if (value === "") {
      setStatus("Type an item name first.");
      return;
    }

    items.push(value);
    saveItems();
    renderList();

    itemInput.value = "";
    itemInput.focus();
    setStatus(`Added "${value}".`);
  }

  function deleteItem(index) {
    const removedItem = items[index];
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

      const span = document.createElement("span");
      span.className = "item-text";
      span.textContent = item;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        deleteItem(index);
      });

      li.appendChild(span);
      li.appendChild(deleteButton);
      shoppingList.appendChild(li);
    });
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

      if (Array.isArray(parsedItems)) {
        return parsedItems;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }
});