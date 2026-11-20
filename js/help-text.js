// The short manual: one section per tab, shown by the ? button in the header (js/info-dialogs.js).
// Keyed by the same tab names as TAB_INFO; a unit test checks that every tab has a section.

export const HELP_SECTIONS = {
  scanner: {
    title: "Scanner",
    lines: [
      "Tap Start scanner and point the camera at a barcode; the product and its nutrition come from Open Food Facts.",
      "No barcode, or not found? Type the item in the form below and add it by hand.",
      "Added items go to the shopping list."
    ]
  },
  list: {
    title: "Shopping list",
    lines: [
      "Search your list, or type a new item and tap Add to put it on the list by name only.",
      "Tap an item when it's in your basket to mark it bought; Edit changes its details.",
      "Bought items get To stock, which moves them to the pantry, so the app knows what you have at home."
    ]
  },
  pantry: {
    title: "Pantry",
    lines: [
      "What you have in stock, with quantities you change with - and +.",
      "Scan to add products straight to the pantry.",
      'Items without nutrition data get "Find nutrition": search NEVO or Open Food Facts by name.',
      "Return puts an item back on the shopping list."
    ]
  },
  recipes: {
    title: "Recipes",
    lines: [
      "Build a recipe from pantry and list items, or ask the AI for suggestions (needs your Anthropic API key in Settings).",
      'Pick a meal next to the suggest button for breakfast, lunch, dinner or snack ideas only; tick "Complex recipes" for elaborate dishes.',
      "Each ingredient shows where its values come from (pantry, NEVO, Open Food Facts or an AI estimate); tap Change to pick another.",
      "The fit badge shows how a serving fits that meal's share of your daily targets.",
      '"Cook this" takes the ingredients out of your pantry; "Ate this" logs a serving on the Today tab.',
      '"Add missing to list" puts the ingredients you lack on the shopping list.'
    ]
  },
  today: {
    title: "Today",
    lines: [
      "What you ate against your daily targets, per meal; step through the days with the arrows.",
      "Add food: tap a recent food to log it again, or search your pantry, NEVO and Open Food Facts, or scan a barcode.",
      'For a meal you can\'t look up, such as one eaten out, use "Enter values by hand" and type the kcal and any macros.',
      "Tap Edit to change an entry's meal or amount; entries without full data are marked."
    ]
  },
  settings: {
    title: "Settings",
    lines: [
      "Your Anthropic API key, the language for AI recipes, and the AI tokens used this month against an optional budget.",
      "Daily targets (with a calculator) and how the day is split over meals.",
      "Import the NEVO table from RIVM to search generic foods by name.",
      "Export a backup now and then: your data lives only in this browser.",
      "What's new and the release history are at the bottom."
    ]
  }
};
