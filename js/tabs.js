// Bottom tab navigation and the item-count badges on the tabs.
import { TAB_INFO } from "./constants.js";
import {
  listTabBadge,
  pageSubtitle,
  pageTitle,
  pantryTabBadge,
  tabButtons,
  tabPanels
} from "./dom.js";
import { stopPantryScanner } from "./pantry-scanner.js";
import { stopScanner } from "./scanner.js";
import { state } from "./state.js";

export function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });

  // Stop the camera automatically when leaving the scanner tab,
  // so it doesn't keep running (and draining battery) in the background.
  switchTab("scanner");
}

export function switchTab(tabName) {
  const info = TAB_INFO[tabName] || TAB_INFO.scanner;

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  pageTitle.textContent = info.title;
  pageSubtitle.textContent = info.subtitle;

  if (tabName !== "scanner" && state.scannerRunning) {
    void stopScanner(false);
  }

  if (tabName !== "pantry" && (state.pantryScannerRunning || state.pantryScanner)) {
    void stopPantryScanner();
  }

  // "auto" jumps straight to the top (style.css sets no smooth scrolling); the old "instant" check was always false.
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function updateTabBadges() {
  const toBuyCount = state.items.filter((item) => !item.bought).length;
  setBadge(listTabBadge, toBuyCount);
  setBadge(pantryTabBadge, state.stockItems.length);
}

export function setBadge(badgeEl, count) {
  if (count > 0) {
    badgeEl.textContent = count > 99 ? "99+" : String(count);
    badgeEl.classList.remove("hidden");
  } else {
    badgeEl.classList.add("hidden");
  }
}
