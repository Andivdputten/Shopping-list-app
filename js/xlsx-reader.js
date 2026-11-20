// Reads rows from one sheet of an .xlsx file in the browser, without a library: an .xlsx is a ZIP of XML files.
// Used to import the NEVO workbook; it only unpacks the files it needs, so the large source sheets are skipped.

const decoder = new TextDecoder("utf-8");

// The files in a ZIP archive by name, read from its central directory (at the end of the file).
function listZipEntries(view) {
  // The end-of-central-directory record is in the last 64 KB (22 bytes plus an optional comment).
  let end = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error("This is not an .xlsx file.");
  }

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The .xlsx file is damaged.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(
      new Uint8Array(view.buffer, view.byteOffset + offset + 46, nameLength)
    );
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true)
    });
    offset +=
      46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return entries;
}

// One file's text: stored as is (method 0) or deflated (method 8), inflated with the browser's own decompressor.
async function readZipText(view, entries, name) {
  const entry = entries.get(name);
  if (!entry) {
    return null;
  }
  const local = entry.localOffset;
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, entry.compressedSize);
  if (entry.method === 0) {
    return decoder.decode(bytes);
  }
  if (entry.method !== 8) {
    throw new Error("The .xlsx file uses an unsupported compression.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, code) => {
    if (code[0] === "#") {
      return String.fromCodePoint(
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      );
    }
    return ENTITIES[code.toLowerCase()];
  });
}

// The text of every <t> inside a shared string or inline string (rich text is split into runs).
function textRuns(xml) {
  let text = "";
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    text += match[1];
  }
  return decodeXml(text);
}

// "A" → 0, "Z" → 25, "AA" → 26: the column of a cell reference such as "AB12".
function columnIndex(reference) {
  const letters = /^[A-Z]+/.exec(reference)[0];
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseRows(sheetXml, sharedStrings) {
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const inner = cell[2] || "";
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes);
      const type = (/\bt="(\w+)"/.exec(attributes) || [])[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner);
      let value = null;
      if (type === "s" && raw) {
        value = sharedStrings[Number(raw[1])] ?? null;
      } else if (type === "inlineStr") {
        value = textRuns(inner);
      } else if ((type === "str" || type === "e") && raw) {
        value = decodeXml(raw[1]);
      } else if (type === "b" && raw) {
        value = raw[1] === "1";
      } else if (raw) {
        value = Number(raw[1]);
      }
      // A cell without a reference follows the previous one.
      row[reference ? columnIndex(reference[1]) : row.length] = value;
    }
    rows.push(Array.from(row, (value) => (value === undefined ? null : value)));
  }
  return rows;
}

// The sheet names of an .xlsx (an ArrayBuffer), in workbook order, and a reader for one sheet's rows.
// Each row is an array indexed by column; empty cells are null and trailing empty cells are left out.
export async function openWorkbook(buffer) {
  const view = new DataView(buffer);
  const entries = listZipEntries(view);
  const workbook = await readZipText(view, entries, "xl/workbook.xml");
  const relations = await readZipText(view, entries, "xl/_rels/workbook.xml.rels");
  if (!workbook || !relations) {
    throw new Error("This is not an .xlsx file.");
  }

  const targets = new Map();
  for (const match of relations.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[1]);
    const target = /\bTarget="([^"]+)"/.exec(match[1]);
    if (id && target) {
      targets.set(id[1], target[1]);
    }
  }
  const sheets = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /\bname="([^"]*)"/.exec(match[1]);
    const id = /\br:id="([^"]+)"/.exec(match[1]);
    const target = id && targets.get(id[1]);
    if (name && target) {
      // Targets are relative to xl/ unless they start at the archive root.
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      sheets.push({ name: decodeXml(name[1]), path });
    }
  }

  let sharedStrings = null;
  return {
    sheetNames: sheets.map((sheet) => sheet.name),
    async readSheet(name) {
      const sheet = sheets.find((candidate) => candidate.name === name);
      if (!sheet) {
        throw new Error(`The workbook has no sheet "${name}".`);
      }
      if (sharedStrings === null) {
        const xml = (await readZipText(view, entries, "xl/sharedStrings.xml")) || "";
        sharedStrings = Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g), (match) =>
          textRuns(match[1])
        );
      }
      return parseRows((await readZipText(view, entries, sheet.path)) || "", sharedStrings);
    }
  };
}
