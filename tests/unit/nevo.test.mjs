// Unit tests for the workbook reader (js/xlsx-reader.js) and the NEVO rules (js/nevo.js), on a made-up table.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nevoReference,
  nevoVersionLabel,
  normalizeNevoData,
  parseNevoRows,
  searchNevo,
  searchText
} from "../../js/nevo.js";
import { openWorkbook } from "../../js/xlsx-reader.js";
import { FAKE_NEVO_ROWS, makeFakeNevoXlsx, makeXlsx } from "../helpers/make-xlsx.mjs";

const arrayBuffer = (buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length);

test("the workbook reader lists sheets and reads strings, numbers and empty cells", async () => {
  const workbook = await openWorkbook(arrayBuffer(makeFakeNevoXlsx()));
  assert.deepEqual(workbook.sheetNames, ["NEVO2099", "NEVO2099_Details"]);
  const rows = await workbook.readSheet("NEVO2099");
  assert.equal(rows.length, FAKE_NEVO_ROWS.length);
  assert.equal(rows[0][4], "Voedingsmiddelnaam/Dutch food name");
  assert.equal(rows[1][4], "Testappel rauw");
  assert.equal(rows[1][14], 2.2999999999999998);
  assert.equal(rows[1][6], null);
  // Empty cells at the end of a row are left out, as spreadsheet programs write them.
  assert.equal(rows[2].length, 14);
  assert.equal(rows[6][4], "Crème testfraîche");
});

test("the workbook reader refuses files that aren't .xlsx and unknown sheets", async () => {
  await assert.rejects(openWorkbook(new ArrayBuffer(100)), /not an \.xlsx/);
  const workbook = await openWorkbook(arrayBuffer(makeXlsx({ Blad1: [["a"]] })));
  await assert.rejects(workbook.readSheet("NEVO2099"), /no sheet/);
});

test("NEVO rows become foods with values unchanged, unknown values null and liquids per ml", () => {
  const { version, foods } = parseNevoRows(FAKE_NEVO_ROWS);
  assert.equal(version, "2099/1.0");
  assert.equal(foods.length, 6);
  assert.deepEqual(foods[0], {
    code: 1,
    nameNl: "Testappel rauw",
    nameEn: "Test apple raw",
    synonym: "",
    group: "Test group",
    unit: "g",
    nutrition: {
      kcal100g: 50,
      protein100g: 0.5,
      carbs100g: 11,
      fat100g: 0.2,
      fiber100g: 2.2999999999999998
    }
  });
  assert.equal(foods[1].nutrition.fiber100g, null);
  assert.equal(foods[4].unit, "ml");
});

test("columns are found by header, so a reordered table still imports; other tables are refused", () => {
  const reordered = FAKE_NEVO_ROWS.map((row) => [...row].reverse());
  assert.deepEqual(parseNevoRows(reordered).foods, parseNevoRows(FAKE_NEVO_ROWS).foods);
  assert.throws(
    () =>
      parseNevoRows([
        ["Naam", "kcal"],
        ["Appel", 50]
      ]),
    /isn't a NEVO table/
  );
  assert.throws(() => parseNevoRows([FAKE_NEVO_ROWS[0]]), /no foods/);
});

test("the version label and reference follow RIVM's required wording", () => {
  assert.equal(nevoVersionLabel("NEVO-Online 2025 9.0"), "2025/9.0");
  assert.equal(nevoVersionLabel("something else"), "something else");
  assert.equal(
    nevoReference("2025/9.0"),
    "Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven and other data sources"
  );
});

test("stored NEVO data is validated; anything malformed counts as not imported", () => {
  const data = parseNevoRows(FAKE_NEVO_ROWS);
  assert.deepEqual(normalizeNevoData(JSON.parse(JSON.stringify(data))), data);
  assert.equal(normalizeNevoData(null), null);
  assert.equal(normalizeNevoData({ version: "x", foods: [] }), null);
  assert.equal(normalizeNevoData({ version: "x", foods: [{ code: "1" }] }), null);
});

test("search matches words in Dutch, English and synonyms, ignoring accents, best first", () => {
  const { foods } = parseNevoRows(FAKE_NEVO_ROWS);
  const names = (query) => searchNevo(foods, query).map((food) => food.nameNl);
  assert.equal(searchText("  Crème-Fraîche!"), "creme fraiche");
  assert.deepEqual(names("testappel"), ["Testappel rauw", "Testappelmoes"]);
  assert.deepEqual(names("test rice"), ["Testrijst gekookt", "Testrijst onbereid"]);
  assert.deepEqual(names("witte"), ["Testrijst gekookt"]);
  // Inside a word comes last: "rijst" in the compound "Testrijst".
  assert.deepEqual(names("rijst"), ["Testrijst gekookt", "Testrijst onbereid"]);
  // English plurals match; equal ranks put the shorter name first.
  assert.deepEqual(names("test apples"), ["Testappelmoes", "Testappel rauw"]);
  assert.deepEqual(names("melk"), ["Testmelk halfvol"]);
  assert.deepEqual(names("zuurkool"), []);
  assert.deepEqual(names("rauw testap"), ["Testappel rauw"]);
  assert.deepEqual(names("creme"), ["Crème testfraîche"]);
  assert.deepEqual(names("   "), []);
  assert.equal(searchNevo(foods, "test", 2).length, 2);
});
