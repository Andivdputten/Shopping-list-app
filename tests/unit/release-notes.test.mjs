// Unit tests for the release notes (js/release-notes.js) and the per-tab help (js/help-text.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAB_INFO } from "../../js/constants.js";
import { HELP_SECTIONS } from "../../js/help-text.js";
import { RELEASE_NOTES, shouldShowWhatsNew } from "../../js/release-notes.js";

test("the newest release note is for the version the service worker ships", () => {
  const sw = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");
  const cacheVersion = /const CACHE_VERSION = "(v\d+)"/.exec(sw)[1];
  assert.equal(RELEASE_NOTES[0].version, cacheVersion);
});

test("release notes are well-formed and newest first", () => {
  RELEASE_NOTES.forEach((release) => {
    assert.match(release.version, /^v\d+(–v\d+)?$/);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(release.title.length > 0);
    assert.ok(release.notes.length > 0 && release.notes.every((note) => note.length > 0));
  });
  const numbers = RELEASE_NOTES.map((release) => Number(/^v(\d+)/.exec(release.version)[1]));
  assert.deepEqual(
    numbers,
    [...numbers].sort((a, b) => b - a)
  );
  const dates = RELEASE_NOTES.map((release) => release.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("What's new opens once after an update, never on a first visit", () => {
  const show = (lastSeenVersion, hasExistingData) =>
    shouldShowWhatsNew({ lastSeenVersion, currentVersion: "v32", hasExistingData });
  assert.equal(show(null, false), false);
  assert.equal(show(null, true), true);
  assert.equal(show("v31", true), true);
  assert.equal(show("v32", true), false);
});

test("every tab has a help section", () => {
  assert.deepEqual(Object.keys(HELP_SECTIONS).sort(), Object.keys(TAB_INFO).sort());
  Object.values(HELP_SECTIONS).forEach((section) => {
    assert.ok(section.title.length > 0 && section.lines.length > 0);
  });
});
