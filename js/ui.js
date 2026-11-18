// Small page-wide helpers: the status line and the pop-up message.
import { statusEl, toastEl } from "./dom.js";
import { state } from "./state.js";

export function showToast(message) {
  toastEl.textContent = `✓ ${message}`;
  toastEl.classList.add("visible");

  if (state.toastTimer !== null) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(() => {
    toastEl.classList.remove("visible");
    state.toastTimer = null;
  }, 2600);
}

export function setStatus(message) {
  statusEl.textContent = message;
}
