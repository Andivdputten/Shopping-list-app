// Builds data/nevo.json, the NEVO subset shipped with the app, from RIVM's NEVO workbook (.xlsx).
// Usage: node tools/build-nevo-data.mjs path/to/NEVO2025_v9.0.xlsx
// It uses the app's own reader and parser, so the values are exactly those an import would give: unchanged
// from NEVO, only the columns the app needs. See data/README.md for the source and the required reference.
import { readFileSync, writeFileSync } from "node:fs";
import { parseNevoRows } from "../js/nevo.js";
import { openWorkbook } from "../js/xlsx-reader.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node tools/build-nevo-data.mjs path/to/NEVO.xlsx");
  process.exit(1);
}
const file = readFileSync(path);
const workbook = await openWorkbook(
  file.buffer.slice(file.byteOffset, file.byteOffset + file.length)
);
// The main sheet is the one named like "NEVO2025", as in the Settings import.
const sheet =
  workbook.sheetNames.find((name) => /^NEVO\d{4}$/i.test(name)) || workbook.sheetNames[0];
const data = parseNevoRows(await workbook.readSheet(sheet));
writeFileSync(new URL("../data/nevo.json", import.meta.url), JSON.stringify(data));
console.log(`NEVO ${data.version}: ${data.foods.length} foods written to data/nevo.json`);
