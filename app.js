document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "grocery_scanner_items_v4";

  const formTitle = document.getElementById("formTitle");
  const itemInput = document.getElementById("itemInput");
  const quantityInput = document.getElementById("quantityInput");
  const unitInput = document.getElementById("unitInput");
  const addButton = document.getElementById("addButton");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const clearButton = document.getElementById("clearButton");
  const shoppingList = document.getElementById("shoppingList");
  const emptyMessage = document.getElementById("emptyMessage");
  const statusEl = document.getElementById("status");

  if (
    !formTitle ||
    !itemInput ||
    !quantityInput ||
    !unitInput ||
    !addButton ||
    !cancelEditButton ||
    !clearButton ||
    !shoppingList ||
    !emptyMessage ||
    !statusEl
  ) {
    alert("HTML element missing. Check your index.html IDs.");
    return;
  }

  let items = loadItems();
  let editIndex = null;

  renderList();
  updateFormMode();
  setStatus("App loaded successfully.");

  addButton.addEventListener("click", submitForm);
  cancelEditButton.addEventListener("click", cancelEdit);
  clearButton.addEventListener("click", clearAllItems);

  itemInput.addEventListener("keydown", handleEnterToSubmit);
  quantityInput.addEventListener("keydown", handleEnterToSubmit);
  unitInput.addEventListener("keydown", handleEnterToSubmit);

  function handleEnterToSubmit(event) {
    if (event.key === "Enter") {
      submitForm();
    }
  }

  function submitForm() {
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

    const itemData = {
      name,
      quantity,
      unit,
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

      itemButton.appendChild(nameSpan);

      const metaText = buildMetaText(item);
      if (metaText !== "") {
        const metaSpan = document.createElement("span");
        metaSpan.className = "item-meta";
        metaSpan.textContent = metaText;
        itemButton.appendChild(metaSpan);
      }

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