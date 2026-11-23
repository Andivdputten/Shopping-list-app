# Data from NEVO (RIVM)

`data/nevo.json` contains data from **NEVO-online version 2025/9.0**, the Dutch food composition table
of RIVM (Rijksinstituut voor Volksgezondheid en Milieu), Bilthoven.

> Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven and other data sources

## What comes from NEVO

Everything in `data/nevo.json`. For each of the 2,328 foods it keeps only the columns the app uses,
with the values exactly as NEVO gives them (not rounded, rescaled or edited):

| Field in `nevo.json`    | NEVO column                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `version`               | NEVO-versie/NEVO-version                                        |
| `code`                  | NEVO-code                                                       |
| `nameNl`                | Voedingsmiddelnaam/Dutch food name                              |
| `nameEn`                | Engelse naam/Food name                                          |
| `synonym`               | Synoniem                                                        |
| `group`                 | Food group                                                      |
| `unit`                  | Hoeveelheid/Quantity (`g` for "per 100g", `ml` for "per 100ml") |
| `nutrition.kcal100g`    | ENERCC (kcal)                                                   |
| `nutrition.protein100g` | PROT (g)                                                        |
| `nutrition.carbs100g`   | CHO (g)                                                         |
| `nutrition.fat100g`     | FAT (g)                                                         |
| `nutrition.fiber100g`   | FIBT (g)                                                        |

An empty NEVO value is `null` (unknown), never 0. Nothing else in this repository comes from NEVO: values
from Open Food Facts, the user's pantry, manual entry or AI estimates are kept and labelled separately in
the app.

## Use and permission

- Use is subject to RIVM's
  [conditions for use of NEVO online 2025/9.0](https://www.rivm.nl/sites/default/files/2025-11/Conditions-of-use-NEVO-online-2025-dataset_0.pdf).
- In November 2026 RIVM confirmed by email that this use is allowed, including publishing this subset in
  this public repository, provided it is clear what comes from NEVO and the reference text above is
  given. The app shows the reference wherever NEVO values are used in a calculation.

## Updating

RIVM announces new NEVO versions in its food newsletter ("nieuwsbrief voeding", under publications on
rivm.nl), with lists of foods added and removed. To update: request the new dataset from RIVM, then run

```bash
node tools/build-nevo-data.mjs path/to/NEVO.xlsx
```

and update the version in this file. Until the app is updated, users can import a newer file themselves
in Settings.
