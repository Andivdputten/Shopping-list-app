# Macro Scanner: Roadmap

Nov 18, 2026 · @Andi

## Where the app stands (v30, repo checked 18 Nov 2026)

The app works end to end for shopping, scanning, pantry, AI recipes, cooking, daily targets, the intake log and backup. Next on the list is a second nutrition source (NEVO).

- **Shopping list and pantry:** quick-add by title, editing, scanned items go into stock, manual +/- stock quantities, confirmation before clearing the list or pantry.
- **Scanning:** Open Food Facts lookup with a local barcode cache, batch scanning, a scan button in the Pantry tab, an "\[item\] added" toast, and the scanner library self-hosted.
- **Recipes:** manual builder (pantry, list and custom ingredients) with a meal type, AI generation with "ready now" and "needs a few extras" groups, kitchen measures ("1 egg (50 g)"), "Add missing to list", save one or many, cooking instructions kept.
- **Cooking:** "Cook this" deducts a recipe's ingredients from the pantry (servings scale, units convert, shortfalls flagged), puts used-up items on the shopping list, and has Undo.
- **Targets:** daily targets for kcal, protein, carbs, fat and fibre with a calculator (Mifflin-St Jeor); kcal is calculated from the macros; a meal split; a fit badge on every recipe against its meal's share.
- **Intake log:** a Today tab with progress per target and per meal, a 7-day chart, and four ways to log (after cooking, "Ate this", a product from the pantry or by barcode, quick entry). Missing nutrition data is flagged, never counted as zero.
- **AI:** Claude Haiku 5.5 with structured JSON output, request timeouts, clearer error messages, recipe languages (English, Dutch, German, French, Spanish, Brazilian Portuguese), and saved recipes excluded from new suggestions.
- **Statistics:** macro pie charts for pantry and shopping list in Settings, with fibre.
- **Backup:** export and import of list, pantry, recipes, targets and the intake log as one JSON file; the API key is never included.
- **Engineering:** ES modules, unit and end-to-end tests run on every pull request, a README, a Content-Security-Policy, service worker at v30.

## Core features still to build

Three of the four are done (pull requests 8, 9, 11 and 12). Only the complex recipes option remains.

- [x] **Cook this → deduct from pantry.** Done: a confirmation screen with servings, unit conversion (pieces and packs entered by hand), shortfalls, used-up items to the shopping list, and Undo. Saved recipes remember which pantry item each ingredient is.
- [x] **Daily macro targets.** Done: targets for kcal, protein, carbs, fat and fibre, a calculator, kcal calculated from the macros, a meal split, and a fit badge per recipe (kcal within 10% of the meal's share). Ranking by fit and sending targets to the AI were left out by choice.
- [x] **Daily intake log and dashboard.** Done: a Today tab with progress per target and per meal, any day, a 7-day chart, and logging after cooking, from saved recipes, from the pantry or a barcode, or as a quick entry. Entries store their basis (per serving or per gram).
- [ ] **Complex recipes option.** A toggle that asks the AI for more elaborate recipes (more steps and techniques). Build it as a plain toggle now; the premium gate comes with the store release.

## Data and quality

Backup, fibre tracking and cleanup are done, and the AI work is mostly done. A second nutrition source and the meal-type filter remain.

- [x] **Backup, export and import.** In Settings: one JSON file with list, pantry, recipes, targets and the intake log. Import is validated, confirmed, and rolled back if storage is full.
- [x] **Fibre tracking.** Fibre per 100 g from Open Food Facts and manual entry, in recipes, AI estimates, statistics, targets and the intake log.
- [ ] **More nutrition sources.** Add NEVO next to Open Food Facts, because Open Food Facts has gaps for Dutch products. voedingswaardetabel.nl only if its terms allow reuse; check before building anything.
- [x] **AI recipe refinement, done part.** Recipe languages (now including Brazilian Portuguese), request timeouts and clearer errors, stock quantities respected, saved recipes not suggested again, and a meal type on every recipe. Ingredient matching became stricter (no more "egg" matching "eggplant"), not fuzzier.
- [ ] **AI recipe refinement: meal-type filter.** A breakfast, lunch, dinner or snack choice when asking for suggestions. Recipes already carry a meal type, so this mainly needs the choice and the prompt.
- [ ] **AI recipe refinement: fallback for extras.** Only if a real-key test shows the model leaves "needsExtras" empty; structured output guarantees the field exists, not that it is filled.
- [x] **Cleanup.** The stray `Icons/Temp` file is removed.

## Requested additions (18 Nov 2026)

Five items added after the intake log shipped. The Today-tab fix is done (pull request 13); the other four aren't built yet. (A scanner in Quick entry was dropped: Add product already scans barcodes.)

- [x] **Meal split changes show on the Today tab.** Done in pull request 13: the Today tab now redraws when it opens and when targets or the meal split are saved.
- [ ] **Release notes pop-up.** A button in Settings that shows the notes of the newest release only.
- [ ] **Release notes history.** A button in Settings that lists every release, newest first. Needs one release-notes file in the repo, updated with each release.
- [ ] **How to use the app.** A button in Settings that opens a short guide, one section per tab.
- [ ] **AI token balance graph (to investigate).** A normal API key can't read the remaining credit; that needs an admin key, which must not live in a browser app. Feasible instead: count the tokens each recipe request uses (the API returns them) and show usage against a monthly budget you set.

## Recommended build order

Steps 1 to 4 and 8 are done. NEVO is next, starting with a licence check; the release notes and the guide are small and can be slotted in at any time.

| Step | Item                                    | Status         | Why in this position                                                        |
| ---- | --------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| 1    | Cook this → deduct from pantry          | Done           | Connected recipes to stock for the first time                               |
| 2    | Daily macro targets                     | Done           | Core of the original idea; enables the fit badge                            |
| 3    | Daily intake log and dashboard          | Done           | Shows what is left today against the targets                                |
| 4    | Backup, export, import                  | Done           | Protects the data before it grows and before any move to a store app        |
| 5    | NEVO as a second nutrition source       | Open (next)    | Fixes missing macro data for Dutch products                                 |
| 6    | Complex recipes toggle                  | Open           | Small prompt change                                                         |
| 7    | AI recipe refinement                    | Partly done    | Meal-type filter and the extras fallback remain, best tuned with a real key |
| 8    | Cleanup (`Icons/Temp`)                  | Done           | Removed in the backup commit                                                |
| 9    | Release notes, history and how-to guide | Open           | Small; makes each release and the app's features visible                    |
| 10   | AI token usage graph                    | To investigate | Shows usage against your own budget, not the real balance                   |

## Parked: store-app transition

Not on the current roadmap by decision. Android-first (Google Play), iOS later; no Mac available.

- [ ] Capacitor wrapper (branch `capacitor-setup`, appId `io.github.andivdputten.macroscanner`, webDir `docs`)
- [ ] Backend for the AI calls, plus In-App Purchase (the AI code is isolated in `js/recipe-ai.js` for this swap)
- [ ] Native ML Kit barcode scanner replacing the html5-qrcode WebView scanner
- [ ] Security work and a separate security doc (groundwork done: Content-Security-Policy, self-hosted scanner library, service worker no longer caches failed or cross-origin responses)
- [ ] Store listing and launch

## Risks and open questions

- **Unverified AI behaviour.** Structured output guarantees the "needsExtras" field exists, not that it is filled. The repo has no evidence of a real-key check; run one, and add a second request if the group comes back empty.
- **Per-serving vs per-100g.** Handled: every log entry stores its basis (per serving or per gram) and its values at log time. Remaining simplification: 1 ml is counted as 1 g (oil is about 10% off).
- **Missing nutrition data.** Entries without data, or with only partial recipe data, are flagged and never counted as zero. Gap: an entry with kcal but no macros (e.g. a quick entry of only kcal) counts as complete, so low protein, carbs or fat totals aren't explained. Fix: mark it partial when a nutrient with a target is missing.
- **Local-only data.** Export (now including targets and the intake log) is manual, and there is no sync between devices. Export before clearing site data or switching phone.
- **Release hygiene.** Bump `CACHE_VERSION` in `sw.js` on every release (now v30) and add new files under `js/` to `CORE_FILES`; the offline test fails if you forget. Deliberate behaviour or wording changes need the end-to-end snapshot re-recorded.
- **Language.** The recipe section follows the recipe language (six languages); the Today tab, its dialogs and the rest of the app are English only.
- **Open:** is voedingswaardetabel.nl allowed as a data source? (Per-meal targets: answered, as a share of the daily targets per meal type.)
