// Release notes, newest first, and the rule for when "What's new" opens by itself.
// Every release adds one entry here; a unit test checks the newest version equals CACHE_VERSION in sw.js.

export const RELEASE_NOTES = [
  {
    version: "v33",
    date: "2026-11-20",
    title: "Recipe nutrition per ingredient",
    notes: [
      "AI recipes take each ingredient's values from your pantry, else NEVO, else Open Food Facts; only what can't be found uses the AI's estimate.",
      'Every ingredient shows its source; tap "Change" to pick another food or the AI estimate.',
      '"Other ingredient" in the recipe builder can search NEVO and Open Food Facts to fill in its values.',
      "Saved recipes keep each ingredient's source, and recipes with AI estimates are marked as estimated when you log them."
    ]
  },
  {
    version: "v32",
    date: "2026-11-20",
    title: "Release notes and help",
    notes: [
      'After an update, "What\'s new" shows what changed, once. Settings has the full release history.',
      "The new ? button in the header explains the tab you are on, with a full guide one tap away."
    ]
  },
  {
    version: "v31",
    date: "2026-11-20",
    title: "Food search with NEVO",
    notes: [
      "Import the NEVO table from RIVM in Settings to search generic foods such as fruit, vegetables and cooked rice by name.",
      "Add product on the Today tab searches NEVO and Open Food Facts; NEVO drinks are logged in millilitres.",
      'Pantry items without nutrition data get "Find nutrition".',
      "Logged food shows where its values came from (NEVO or Open Food Facts)."
    ]
  },
  {
    version: "v30",
    date: "2026-11-19",
    title: "Today tab updates straight away",
    notes: ["Changes to your targets or meal split now show on the Today tab immediately."]
  },
  {
    version: "v29",
    date: "2026-11-18",
    title: "kcal follows from your macros",
    notes: [
      "The daily kcal target is now calculated from protein, carbs and fat (4, 4 and 9 kcal per gram) and can't be typed in."
    ]
  },
  {
    version: "v28",
    date: "2026-11-18",
    title: "Intake log and the Today tab",
    notes: [
      "The new Today tab shows what you ate against your targets, per meal, for any day.",
      'Log food after cooking, with "Ate this" on a saved recipe, from the pantry, by barcode or as a quick entry.',
      "A 7-day chart shows kcal per day against your target.",
      "Food without nutrition data is flagged, never counted as zero."
    ]
  },
  {
    version: "v27",
    date: "2026-11-18",
    title: "Brazilian Portuguese",
    notes: ["AI recipes can now be written in Brazilian Portuguese."]
  },
  {
    version: "v26",
    date: "2026-11-18",
    title: "Daily targets, meal types and the fit badge",
    notes: [
      "Daily targets in Settings, with a calculator from your body data and activity level.",
      "Recipes have a meal type: breakfast, lunch, dinner or snack; set how your day is split over the meals.",
      "Each recipe shows how well a serving fits that meal's share of your targets (kcal within 10%)."
    ]
  },
  {
    version: "v25",
    date: "2026-11-18",
    title: "Fibre",
    notes: [
      "Fibre is tracked next to kcal, protein, carbs and fat, from scans, by hand and in recipes."
    ]
  },
  {
    version: "v24",
    date: "2026-11-18",
    title: "Cook this",
    notes: [
      '"Cook this" takes a recipe\'s ingredients out of your pantry, scaled to the servings you cook.',
      "Used-up items can go straight onto the shopping list, and Undo puts everything back."
    ]
  },
  {
    version: "v23",
    date: "2026-11-18",
    title: "Recipe builder fix",
    notes: ["Pressing Enter in the recipe builder no longer adds an item to the shopping list."]
  },
  {
    version: "v22",
    date: "2026-11-18",
    title: "Behind the scenes",
    notes: [
      "The app's code was reorganised and is now tested automatically; nothing changes for you."
    ]
  },
  {
    version: "v21",
    date: "2026-11-18",
    title: "Recipe section in your language",
    notes: [
      "The whole AI recipe section follows the recipe language, not just the recipes.",
      '"Add missing to list" now confirms that the ingredients were added.'
    ]
  },
  {
    version: "v20",
    date: "2026-11-18",
    title: "Better AI recipes",
    notes: [
      "AI recipes use Claude Haiku 5.5 and come back in a fixed format, so a reply can no longer be unreadable.",
      'Ingredients are shown in kitchen measures with grams in brackets, such as "1 egg (50 g)".',
      "Choose the language of AI recipes in Settings."
    ]
  },
  {
    version: "v19",
    date: "2026-11-18",
    title: "Backup",
    notes: [
      "Export and import a backup of your list, pantry and recipes in Settings.",
      "AI requests time out instead of hanging, with clearer error messages."
    ]
  },
  {
    version: "v18",
    date: "2026-11-18",
    title: "Fixes and security",
    notes: [
      "Saved recipes no longer lose ingredients after a reload.",
      "Pantry matching and offline updates are more reliable.",
      "The app is better protected against injected scripts."
    ]
  },
  {
    version: "v1–v17",
    date: "2026-10-13",
    title: "The first versions",
    notes: [
      "May to October 2026: barcode scanning with Open Food Facts, the shopping list and pantry, the recipe builder and the first AI recipe suggestions."
    ]
  }
];

// Whether "What's new" opens by itself: once after an update, never on a first visit (nothing is new
// then). An existing user from before release notes has no seen version yet, but does have data.
export function shouldShowWhatsNew({ lastSeenVersion, currentVersion, hasExistingData }) {
  if (lastSeenVersion === currentVersion) {
    return false;
  }
  return lastSeenVersion !== null || hasExistingData;
}
