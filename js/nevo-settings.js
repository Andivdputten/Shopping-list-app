// The "Food database (NEVO)" card in Settings: imports the user's NEVO .xlsx file, shows what is imported
// and removes it. Reading the workbook happens here; the NEVO rules themselves live in js/nevo.js.
import { nevoReference, parseNevoRows } from "./nevo.js";
import { saveNevoData } from "./persistence.js";
import { state } from "./state.js";

const byId = (id) => document.getElementById(id);

// The status and reference lines, and Remove only when there is something to remove.
function renderNevoCard(message) {
  const data = state.nevo;
  byId("nevoStatus").textContent =
    message ||
    (data
      ? `NEVO ${data.version}: ${data.foods.length.toLocaleString("en-GB")} foods imported.`
      : "No NEVO file imported.");
  byId("nevoReference").textContent = data ? nevoReference(data.version) : "";
  byId("removeNevoButton").disabled = !data;
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
    const previous = state.nevo;
    state.nevo = data;
    if (!saveNevoData()) {
      // Keep what was there: an import that can't be stored would vanish on the next start.
      state.nevo = previous;
      renderNevoCard("Import failed: this browser's storage is full.");
      return;
    }
    renderNevoCard();
  });

  byId("removeNevoButton").addEventListener("click", () => {
    if (
      !state.nevo ||
      !confirm("Remove the imported NEVO foods? Values already logged stay as they are.")
    ) {
      return;
    }
    state.nevo = null;
    saveNevoData();
    renderNevoCard();
  });

  renderNevoCard();
}
