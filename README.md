# Grocery Scanner

A shopping list and pantry app that runs in the browser and installs as a PWA. Scan barcodes to add
products (looked up in Open Food Facts), track what is in stock, build recipes with nutrition totals,
and get AI recipe suggestions from your own Anthropic API key.

Foods without a barcode (fruit, vegetables, cooked rice) can be searched by name in NEVO, the Dutch food
composition table from RIVM. Each user requests the NEVO file from RIVM and imports it in Settings; the
repository contains no NEVO data, and the tests use a made-up table (`tests/helpers/make-xlsx.mjs`).

The app has **no build step**: GitHub Pages serves the files in this repository as they are.

Planned work and its order are in [ROADMAP.md](ROADMAP.md).

## Structure

| Path                                                                                                                                            | What it holds                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`, `style.css`                                                                                                                       | The page and its styling                                                                                                           |
| `js/main.js`                                                                                                                                    | Entry point: loads stored data, renders every tab, wires up the buttons                                                            |
| `js/state.js`                                                                                                                                   | The values that change while the app runs, shared by all modules                                                                   |
| `js/dom.js`                                                                                                                                     | References to the page elements                                                                                                    |
| `js/format.js`, `js/nutrition.js`, `js/items.js`, `js/storage.js`, `js/product-lookup.js`, `js/recipe-ai.js`, `js/nevo.js`, `js/xlsx-reader.js` | Logic with no page access, covered by unit tests                                                                                   |
| `js/*.js` (the rest)                                                                                                                            | One module per screen area: shopping list, pantry, scanners, recipe builder, saved recipes, AI recipes, settings, tabs, statistics |
| `sw.js`, `sw-register.js`                                                                                                                       | Service worker for offline use                                                                                                     |
| `vendor/`                                                                                                                                       | Third-party code (the barcode scanner library), kept as published                                                                  |
| `tests/`                                                                                                                                        | Unit tests and end-to-end browser tests                                                                                            |

When you add a file under `js/`, also add it to `CORE_FILES` in `sw.js`; the offline test fails if you
forget. Bump `CACHE_VERSION` in `sw.js` on every release.

## Development

Requires Node.js 22.

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

```bash
npm run format
```

`npm test` runs the unit tests and the end-to-end tests. The main end-to-end test drives every flow
in a real browser and compares the result with `tests/e2e/flows.snapshot.json`. When you change
behaviour or wording on purpose, re-record that reference and review its diff:

```bash
UPDATE_SNAPSHOTS=1 npm run test:e2e
```
