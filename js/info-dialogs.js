// The release notes ("What's new" once after an update, and the history in Settings) and the per-tab help
// behind the ? button in the header. Texts come from js/release-notes.js and js/help-text.js as plain text.
import {
  INTAKE_STORAGE_KEY,
  RECIPE_STORAGE_KEY,
  RELEASE_SEEN_STORAGE_KEY,
  STOCK_STORAGE_KEY,
  STORAGE_KEY
} from "./constants.js";
import { HELP_SECTIONS } from "./help-text.js";
import { RELEASE_NOTES, shouldShowWhatsNew } from "./release-notes.js";

const byId = (id) => document.getElementById(id);

// Opens the info dialog with a title and a Close button; fill(body) adds the content.
function openInfoDialog(title, fill) {
  const dialog = byId("infoDialog");
  dialog.innerHTML = "";
  const heading = document.createElement("h2");
  heading.id = "infoDialogTitle";
  heading.textContent = title;
  const body = document.createElement("div");
  body.className = "info-body";
  fill(body);
  const actions = document.createElement("div");
  actions.className = "action-row";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "primary-button";
  close.id = "infoCloseButton";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  actions.appendChild(close);
  dialog.append(heading, body, actions);
  if (!dialog.open) {
    dialog.showModal();
  }
  return dialog;
}

function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// A heading and bullet list: one release, or one help section.
function addSection(body, headingText, subText, lines) {
  const section = document.createElement("section");
  section.className = "info-section";
  // No heading when the dialog title already names the section (the help for one tab).
  if (headingText) {
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    section.appendChild(heading);
  }
  if (subText) {
    const sub = document.createElement("p");
    sub.className = "hint-text";
    sub.textContent = subText;
    section.appendChild(sub);
  }
  const list = document.createElement("ul");
  lines.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  });
  section.appendChild(list);
  body.appendChild(section);
}

const addRelease = (body, release) =>
  addSection(
    body,
    release.title,
    `${release.version} · ${formatDate(release.date)}`,
    release.notes
  );

export function openWhatsNew() {
  openInfoDialog("What's new", (body) => addRelease(body, RELEASE_NOTES[0]));
}

export function openReleaseHistory() {
  openInfoDialog("Release history", (body) =>
    RELEASE_NOTES.forEach((release) => addRelease(body, release))
  );
}

// The help for one tab, with a button that swaps it for the full guide (all tabs, in tab order).
export function openHelp(tabName) {
  const section = HELP_SECTIONS[tabName] || HELP_SECTIONS.scanner;
  openInfoDialog(`Help: ${section.title}`, (body) => {
    addSection(body, "", "", section.lines);
    const full = document.createElement("button");
    full.type = "button";
    full.className = "secondary-button";
    full.id = "fullGuideButton";
    full.textContent = "Show the full guide";
    full.addEventListener("click", () => {
      byId("infoDialogTitle").textContent = "How to use the app";
      body.innerHTML = "";
      Object.values(HELP_SECTIONS).forEach((each) => addSection(body, each.title, "", each.lines));
    });
    body.appendChild(full);
  });
}

function currentTab() {
  const active = document.querySelector('.tab-button[aria-current="page"]');
  return active ? active.dataset.tab : "scanner";
}

// The seen version lives on this device only; storage errors (private mode) just mean no pop-up.
function readSeenVersion() {
  try {
    return localStorage.getItem(RELEASE_SEEN_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

export function initInfoDialogs() {
  const current = RELEASE_NOTES[0].version;
  byId("helpButton").addEventListener("click", () => openHelp(currentTab()));
  byId("whatsNewButton").addEventListener("click", openWhatsNew);
  byId("releaseHistoryButton").addEventListener("click", openReleaseHistory);
  byId("appVersionText").textContent = `Version ${current}, ${formatDate(RELEASE_NOTES[0].date)}.`;

  // Existing data tells an update apart from a first visit for users from before release notes existed.
  const hasExistingData = [
    STORAGE_KEY,
    STOCK_STORAGE_KEY,
    RECIPE_STORAGE_KEY,
    INTAKE_STORAGE_KEY
  ].some((key) => localStorage.getItem(key) !== null);
  if (
    shouldShowWhatsNew({
      lastSeenVersion: readSeenVersion(),
      currentVersion: current,
      hasExistingData
    })
  ) {
    openWhatsNew();
  }
  try {
    localStorage.setItem(RELEASE_SEEN_STORAGE_KEY, current);
  } catch (error) {
    // Not stored: the notes may show again next time, which is harmless.
  }
}
