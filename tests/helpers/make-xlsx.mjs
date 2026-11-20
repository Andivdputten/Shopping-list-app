// Builds a minimal .xlsx file in memory for tests, so no real NEVO data has to be committed to the repo.
// Strings go to the shared-strings file, numbers stay numeric cells, like a spreadsheet program writes them.
import { crc32, deflateRawSync } from "node:zlib";

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach(({ name, data, store }) => {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(data);
    const body = store ? raw : deflateRawSync(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(store ? 0 : 8, 8);
    header.writeUInt32LE(crc32(raw), 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    locals.push(header, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += header.length + nameBytes.length + body.length;
  });
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const escapeXml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );

function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

// sheets: { "Sheet name": [[cell, ...], ...] }; null or "" cells are left out, as Excel does.
export function makeXlsx(sheets) {
  const strings = [];
  const stringIndex = (value) => {
    let index = strings.indexOf(value);
    if (index === -1) {
      index = strings.push(value) - 1;
    }
    return index;
  };
  const names = Object.keys(sheets);
  const sheetFiles = names.map((name, sheetNumber) => {
    const rows = sheets[name]
      .map((row, r) => {
        const cells = row
          .map((value, c) => {
            if (value === null || value === undefined || value === "") {
              return "";
            }
            const ref = `${columnName(c)}${r + 1}`;
            return typeof value === "number"
              ? `<c r="${ref}"><v>${value}</v></c>`
              : `<c r="${ref}" t="s"><v>${stringIndex(String(value))}</v></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    return {
      name: `xl/worksheets/sheet${sheetNumber + 1}.xml`,
      data: `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`
    };
  });
  const workbook = `<?xml version="1.0"?><workbook xmlns:r="r"><sheets>${names
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets></workbook>`;
  const relations = `<?xml version="1.0"?><Relationships>${names
    .map(
      (_, i) => `<Relationship Id="rId${i + 1}" Type="ws" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("")}</Relationships>`;
  const shared = `<?xml version="1.0"?><sst>${strings
    .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
    .join("")}</sst>`;
  return zip([
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: relations, store: true },
    { name: "xl/sharedStrings.xml", data: shared },
    ...sheetFiles
  ]);
}

// A made-up table in NEVO's layout (header names as in NEVO 2025), with invented foods and values.
export const FAKE_NEVO_HEADER = [
  "NEVO-versie/NEVO-version",
  "Voedingsmiddelgroep",
  "Food group",
  "NEVO-code",
  "Voedingsmiddelnaam/Dutch food name",
  "Engelse naam/Food name",
  "Synoniem",
  "Hoeveelheid/Quantity",
  "ENERCJ (kJ)",
  "ENERCC (kcal)",
  "PROT (g)",
  "PROTPL (g)",
  "FAT (g)",
  "CHO (g)",
  "FIBT (g)"
];

const food = (code, nl, en, synonym, quantity, kcal, protein, fat, carbs, fiber) => [
  "NEVO-Online 2099 1.0",
  "Testgroep",
  "Test group",
  code,
  nl,
  en,
  synonym,
  quantity,
  kcal === null ? null : kcal * 4,
  kcal,
  protein,
  protein,
  fat,
  carbs,
  fiber
];

export const FAKE_NEVO_ROWS = [
  FAKE_NEVO_HEADER,
  food(1, "Testappel rauw", "Test apple raw", "", "per 100g", 50, 0.5, 0.2, 11, 2.2999999999999998),
  food(2, "Testappelmoes", "Test apple sauce", "", "per 100g", 80, 0.2, 0.1, 19, null),
  food(
    3,
    "Testrijst gekookt",
    "Test rice boiled",
    "Witte testrijst",
    "per 100g",
    130,
    2.5,
    0.3,
    28,
    0.4
  ),
  food(4, "Testrijst onbereid", "Test rice uncooked", "", "per 100g", 350, 7, 0.6, 77, 1.1),
  food(5, "Testmelk halfvol", "Test milk semi-skimmed", "", "per 100ml", 46, 3.4, 1.5, 4.7, 0),
  food(6, "Crème testfraîche", "Test crème fraîche", "", "per 100g", 300, 2, 30, 3, 0)
];

export function makeFakeNevoXlsx() {
  return makeXlsx({ NEVO2099: FAKE_NEVO_ROWS, NEVO2099_Details: [["Bron"], ["niet nodig"]] });
}
