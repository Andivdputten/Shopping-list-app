// The "Food database (NEVO)" card in Settings. NEVO 2025/9.0 is included with the app (data/nevo.json, with
// RIVM's permission); a file the user imports (e.g. a newer NEVO version) takes its place until removed.
// Reading the workbook happens here; the NEVO rules themselves live in js/nevo.js.
import { nevoReference, normalizeNevoData, parseNevoRows } from "./nevo.js";
import { saveNevoData } from "./persistence.js";
import { state } from "./state.js";

const byId = (id) => document.getElementById(id);
const BUNDLED_NEVO_URL = "data/nevo.json";

// Where the NEVO foods in use come from: "imported" (the user's own file), "bundled", or null (none yet).
let source = null;
let bundledFailed = false;

// The status and reference lines; Remove only for an imported file, since the included table can't go.
function renderNevoCard(message) {
  const data = state.nevo;
  const count = data ? data.foods.length.toLocaleString("en-GB") : "";
  byId("nevoStatus").textContent =
    message ||
    (source === "imported"
      ? `Imported: NEVO ${data.version}, ${count} foods. Remove it to use the included table again.`
      : source === "bundled"
        ? `Included in the app: NEVO ${data.version}, ${count} foods.`
        : bundledFailed
          ? "The included NEVO table couldn't be loaded (offline on first use?). Try again later, or import a NEVO file."
          : "Loading the included NEVO table...");
  byId("nevoReference").textContent = data ? nevoReference(data.version) : "";
  byId("removeNevoButton").disabled = source !== "imported";
}

// Loads the NEVO table shipped with the app; cached by the service worker, so it also works offline.
async function loadBundledNevo() {
  bundledFailed = false;
  try {
    const response = await fetch(BUNDLED_NEVO_URL);
    const data = response.ok ? normalizeNevoData(await response.json()) : null;
    // An import made while this was loading wins.
    if (data && source !== "imported") {
      state.nevo = data;
      source = "bundled";
    } else if (!data) {
      bundledFailed = true;
    }
  } catch (error) {
    bundledFailed = true;
  }
  renderNevoCard();
}

// The main NEVO sheet is the one named like "NEVO2025"; its large companion sheets are never unpacked.
async function importNevoFile(file) {
  const { openWorkbook } = await import("./xlsx-reader.js");
  const workbook = await openWorkbook(await file.arrayBuffer());
  const sheet =
    workbook.sheetNames.find((name) => /^NEVO\d{4}$/i.test(name)) || workbook.sheetNames[0];
  return parseNevoRows(await workbook.readSheet(sheet));
}

export function initNevoSettings() {
  if (!byId("importNevoButton")) {
    return;
  }
  const input = byId("importNevoInput");
  byId("importNevoButton").addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) {
      return;
    }
    renderNevoCard("Reading the NEVO file...");
    let data;
    try {
      data = await importNevoFile(file);
    } catch (error) {
      renderNevoCard(`Import failed: ${error.message}`);
      return;
    }
    const previous = { nevo: state.nevo, source };
    state.nevo = data;
    source = "imported";
    if (!saveNevoData()) {
      // Keep what was there: an import that can't be stored would vanish on the next start.
      state.nevo = previous.nevo;
      source = previous.source;
      renderNevoCard("Import failed: this browser's storage is full.");
      return;
    }
    renderNevoCard();
  });

  byId("removeNevoButton").addEventListener("click", () => {
    if (
      source !== "imported" ||
      !confirm(
        "Remove the imported NEVO file and use the included table? Values already logged stay as they are."
      )
    ) {
      return;
    }
    state.nevo = null;
    source = null;
    saveNevoData();
    renderNevoCard();
    void loadBundledNevo();
  });

  // A file imported earlier (stored in this browser) is used as is; otherwise the included table loads.
  if (state.nevo) {
    source = "imported";
    renderNevoCard();
  } else {
    renderNevoCard();
    void loadBundledNevo();
  }
}
