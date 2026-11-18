// Small page-wide helpers: the status line and the pop-up message.
import { statusEl, toastEl } from "./dom.js";
import { state } from "./state.js";

// Shows a short pop-up at the bottom of the screen. An optional action ({ label, onClick, durationMs })
// adds a button, such as Undo, and keeps the pop-up up longer so there is time to tap it.
export function showToast(message, action) {
  toastEl.textContent = `✓ ${message}`;
  toastEl.classList.toggle("has-action", Boolean(action));

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      hideToast();
      action.onClick();
    });
    toastEl.appendChild(button);
  }

  toastEl.classList.add("visible");

  if (state.toastTimer !== null) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(hideToast, action ? action.durationMs || 10000 : 2600);
}

function hideToast() {
  toastEl.classList.remove("visible");
  if (state.toastTimer !== null) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
}

export function setStatus(message) {
  statusEl.textContent = message;
}
