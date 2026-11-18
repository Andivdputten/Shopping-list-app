# Macro Scanner: Roadmap

Nov 18, 2026 · @Andi

## Where the app stands (v23, repo checked 18 Nov 2026)

The app works end to end for shopping, scanning, pantry, AI recipes and backup. Still missing is the link between recipes, stock and daily targets.

- **Shopping list and pantry:** quick-add by title, editing, scanned items go into stock, manual +/- stock quantities, confirmation before clearing the list or pantry.
- **Scanning:** Open Food Facts lookup with a local barcode cache, batch scanning, a scan button in the Pantry tab, an "\[item\] added" toast, and the scanner library now self-hosted.
- **Statistics:** macro pie charts for pantry and shopping list in Settings.
- **Recipes:** manual builder (pantry, list and custom ingredients), AI generation with "ready now" and "needs a few extras" groups, kitchen measures ("1 egg (50 g)"), "Add missing to list", save one or many, cooking instructions kept.
- **AI:** Claude Haiku 5.5 with structured JSON output, request timeouts, clearer error messages, a recipe language setting (English, Dutch, German, French, Spanish), and saved recipes excluded from new suggestions.
- **Backup:** export and import of list, pantry and recipes as one JSON file; the API key is never included.
- **Engineering:** app split into ES modules, unit and end-to-end tests, a GitHub Actions workflow, a README, a Content-Security-Policy, service worker at v23.

## Core features still to build

None of these four is in the repo yet. Daily targets and an intake log are the biggest gap against the original idea: the app tracks macros but has no goal to measure them against.

- [ ] **Cook this → deduct from pantry.** A button on a recipe that subtracts its ingredients from stock. Edge cases: ingredient not in stock, quantity in a different unit than the pantry (g vs pieces), and per-recipe vs per-serving amounts.
- [ ] **Daily macro targets.** Set kcal, protein, carbs and fat goals in Settings. Rank and filter recipes by fit, and pass the targets (and what is left today) to the AI prompt in `js/recipe-ai.js`.
- [ ] **Daily intake log and dashboard.** Log a recipe or a scanned product as eaten, and show eaten vs target per day. Keep per-100g and per-serving values explicit when logging.
- [ ] **Complex recipes option.** A toggle that asks the AI for more elaborate recipes (more steps and techniques). Build it as a plain toggle now; the premium gate comes with the store release.

## Data and quality

Backup and cleanup are done, and the AI work is half done. Nutrition sources and the meal-type filter remain.

- [x] **Backup, export and import.** In Settings: one JSON file with list, pantry and recipes. Import is validated, confirmed, and rolled back if storage is full.
- [ ] **More nutrition sources.** Add NEVO next to Open Food Facts, because Open Food Facts has gaps for Dutch products. voedingswaardetabel.nl only if its terms allow reuse; check before building anything.
- [x] **AI recipe refinement, done part.** Recipe language setting, request timeouts and clearer errors, stock quantities respected, saved recipes not suggested again. Note that ingredient matching became stricter (no more "egg" matching "eggplant"), not fuzzier.
- [ ] **AI recipe refinement: meal-type filter.** A breakfast, lunch or dinner choice. Today there is only the free-text preferences field.
- [ ] **AI recipe refinement: fallback for extras.** Only if a real-key test shows the model leaves "needsExtras" empty; structured output guarantees the field exists, not that it is filled.
- [x] **Cleanup.** The stray `Icons/Temp` file is removed.

## Recommended build order

Backup is done; build cook-and-deduct next, then targets and the intake log together. The rest follows by value.

| Step | Item                              | Status      | Why in this position                                                        |
| ---- | --------------------------------- | ----------- | --------------------------------------------------------------------------- |
| 1    | Cook this → deduct from pantry    | Open        | Small, and connects recipes to stock for the first time                     |
| 2    | Daily macro targets               | Open        | Core of the original idea; unlocks ranking and AI prompts                   |
| 3    | Daily intake log and dashboard    | Open        | Without it, targets can only rank recipes, not show what is left today      |
| 4    | Backup, export, import            | Done        | Protects the data before it grows and before any move to a store app        |
| 5    | NEVO as a second nutrition source | Open        | Fixes missing macro data for Dutch products                                 |
| 6    | Complex recipes toggle            | Open        | Simple once the prompt handles targets                                      |
| 7    | AI recipe refinement              | Partly done | Meal-type filter and the extras fallback remain, best tuned with a real key |
| 8    | Cleanup (`Icons/Temp`)            | Done        | Removed in the backup commit                                                |

## Parked: store-app transition

Not on the current roadmap by decision. Android-first (Google Play), iOS later; no Mac available.

- [ ] Capacitor wrapper (branch `capacitor-setup`, appId `io.github.andivdputten.macroscanner`, webDir `docs`)
- [ ] Backend for the AI calls, plus In-App Purchase (the AI code is isolated in `js/recipe-ai.js` for this swap)
- [ ] Native ML Kit barcode scanner replacing the html5-qrcode WebView scanner
- [ ] Security work and a separate security doc (groundwork done: Content-Security-Policy, self-hosted scanner library, service worker no longer caches failed or cross-origin responses)
- [ ] Store listing and launch

## Risks and open questions

- **Unverified AI behaviour.** Structured output guarantees the "needsExtras" field exists, not that it is filled. The repo has no evidence of a real-key check; run one, and add a second request if the group comes back empty.
- **Per-serving vs per-100g.** The most likely source of wrong macros in targets, the intake log and cook-and-deduct. Store the basis explicitly with every value.
- **Missing nutrition data.** Open Food Facts often lacks values; scanned items without nutrition must be flagged, not counted as zero.
- **Local-only data.** Export exists but is manual, and there is no sync between devices. Export before clearing site data or switching phone.
- **Release hygiene.** Bump `CACHE_VERSION` in `sw.js` on every release (now v23) and add new files under `js/` to `CORE_FILES`; the offline test fails if you forget. Deliberate behaviour or wording changes need the end-to-end snapshot re-recorded.
- **Open:** is voedingswaardetabel.nl allowed as a data source? Should targets be per day only, or per meal as well?
