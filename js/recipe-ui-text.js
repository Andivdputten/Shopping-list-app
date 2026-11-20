// ============================================================================
// Texts for the AI recipe section, in each language offered under
// Settings -> Recipe language. Kept in its own module so all translations
// live in one place.
// ============================================================================

// Picks the singular or plural form, so each language can word counts naturally.
const plural = (n, one, many) => (n === 1 ? one : many);

const TEXTS = {
  en: {
    // Logging what you ate
    servingsEaten: "Servings you ate (0 = don't log)",
    ateThis: "Ate this",
    // Fit badge against the daily targets
    meals: { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" },
    fitGood: (meal) => `Good fit for ${meal}`,
    fitOver: (meal, pct) => `Too much for ${meal} (+${pct}% kcal)`,
    fitUnder: (meal, pct) => `Too little for ${meal} (−${pct}% kcal)`,
    highIn: (macro) => `high in ${macro}`,
    lowIn: (macro) => `low in ${macro}`,
    setMealType: "Set a meal type to see how it fits your targets",
    fiber: "fibre",
    // "Cook this" dialog
    cookThis: "Cook this",
    cookTitle: (name) => `Cook ${name}`,
    servingsCooked: "Servings cooked",
    cookAddUsedUp: "Add used-up items to the shopping list",
    cookConfirm: "Cook and deduct",
    cancel: "Cancel",
    notInStock: "not in stock",
    unknownQuantity: "amount in pantry unknown, nothing deducted",
    enterAmount: "enter amount",
    inPantry: (amount, unit) => `in pantry: ${amount} ${unit}`,
    short: (amount, unit) => `${amount} ${unit} short`,
    cooked: (name) => `Cooked ${name}`,
    undo: "Undo",
    undone: "Cooking undone",
    sectionTitle: "AI recipe suggestions",
    sectionHint: "Get recipe ideas based on what's currently in your pantry stock.",
    preferencesPlaceholder: "Optional: e.g. vegetarian, quick meals, spicy",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Any meal",
    complexToggle: "Complex recipes (more technique and time)",
    mealChoiceLabel: "Meal",
    suggestButton: "Suggest recipes from my stock",
    groupReady: (n) => `Ready to cook (${n})`,
    groupExtras: (n) => `Needs a few extra ingredients (${n})`,
    selectRecipe: (name) => `Select ${name}`,
    serves: (s, missing) =>
      `Serves ${s} — ` +
      (missing > 0
        ? `needs ${missing} extra ${plural(missing, "ingredient", "ingredients")}`
        : "you have everything"),
    protein: "protein",
    carbs: "carbs",
    fat: "fat",
    sourceCalculated: "Per serving — calculated per ingredient (pantry, NEVO or Open Food Facts).",
    sourceEstimated:
      "Per serving — estimated by AI (add nutrition data to matching items for precise numbers).",
    sourcePartlyEstimated: "Per serving — calculated per ingredient; some values are AI estimates.",
    sourcePartial: "Per serving — calculated, but some ingredients have no nutrition data.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "pantry",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "AI estimate",
      manual: "typed in",
      none: "no data"
    },
    changeSource: "Change",
    changeSourceTitle: (name) => `Nutrition for ${name}`,
    useEstimate: "Use the AI estimate",
    saveChoice: "Save",
    pickFirst: "Search and choose a food, or use the AI estimate.",
    saveRecipe: "Save recipe",
    alreadySaved: "Already saved",
    saved: "Saved ✓",
    addMissing: "Add missing to list",
    addedToList: "Added to list ✓",
    alreadyOnList: "Already on list ✓",
    selectAll: "Select all",
    saveSelected: (n) => (n > 0 ? `Save selected (${n})` : "Save selected"),
    saveAll: (n) => (n > 0 ? `Save all (${n})` : "Save all"),
    selectFirst: "Select at least one recipe first.",
    oneAlreadySaved: (name) => `"${name}" is already saved.`,
    thoseAlreadySaved: "Those recipes are already saved.",
    nameExists: (name) => `A saved recipe named "${name}" already exists.`,
    savedOne: (name) => `Saved "${name}" to your recipes.`,
    savedMany: (n, skipped) =>
      `Saved ${n} ${plural(n, "recipe", "recipes")}` +
      (skipped > 0 ? ` (${skipped} already existed, skipped).` : "."),
    forRecipe: (name) => `For ${name}`,
    addedCount: (n) =>
      `Added ${n} missing ${plural(n, "ingredient", "ingredients")} to your shopping list.`,
    allOnList: "Those ingredients are already on your shopping list.",
    needKey: "Add an API key in Settings first.",
    thinking: "Thinking...",
    asking: "Asking the AI for recipe ideas based on your stock...",
    gotRecipes: (total, ready, extras) =>
      `Got ${total} recipe ${plural(total, "idea", "ideas")}: ${ready} ready to cook, ${extras} needing extras.`,
    noneExtras: " None needed extra ingredients this time; tap the button below for some that do.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Suggest recipes with a few extra ingredients",
    gotExtras: (n) => `Added ${n} recipe${plural(n, "", "s")} with extra ingredients.`
  },

  nl: {
    // Logging what you ate
    servingsEaten: "Porties die je hebt gegeten (0 = niet loggen)",
    ateThis: "Gegeten",
    // Fit badge against the daily targets
    meals: { breakfast: "ontbijt", lunch: "lunch", dinner: "avondeten", snack: "tussendoortje" },
    fitGood: (meal) => `Past goed bij ${meal}`,
    fitOver: (meal, pct) => `Te veel voor ${meal} (+${pct}% kcal)`,
    fitUnder: (meal, pct) => `Te weinig voor ${meal} (−${pct}% kcal)`,
    highIn: (macro) => `veel ${macro}`,
    lowIn: (macro) => `weinig ${macro}`,
    setMealType: "Kies een maaltijdtype om te zien hoe het bij je doelen past",
    fiber: "vezels",
    // "Cook this" dialog
    cookThis: "Dit koken",
    cookTitle: (name) => `${name} koken`,
    servingsCooked: "Aantal porties gekookt",
    cookAddUsedUp: "Opgebruikte producten op de boodschappenlijst zetten",
    cookConfirm: "Koken en aftrekken",
    cancel: "Annuleren",
    notInStock: "niet op voorraad",
    unknownQuantity: "hoeveelheid in voorraad onbekend, niets afgetrokken",
    enterAmount: "vul hoeveelheid in",
    inPantry: (amount, unit) => `op voorraad: ${amount} ${unit}`,
    short: (amount, unit) => `${amount} ${unit} te weinig`,
    cooked: (name) => `${name} gekookt`,
    undo: "Ongedaan maken",
    undone: "Koken ongedaan gemaakt",
    sectionTitle: "AI-receptsuggesties",
    sectionHint: "Krijg receptideeën op basis van wat er nu in je voorraad staat.",
    preferencesPlaceholder: "Optioneel: bijv. vegetarisch, snelle maaltijden, pittig",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Elke maaltijd",
    complexToggle: "Uitgebreide recepten (meer techniek en tijd)",
    mealChoiceLabel: "Maaltijd",
    suggestButton: "Recepten voorstellen uit mijn voorraad",
    groupReady: (n) => `Klaar om te koken (${n})`,
    groupExtras: (n) => `Nog een paar ingrediënten nodig (${n})`,
    selectRecipe: (name) => `Selecteer ${name}`,
    serves: (s, missing) =>
      `Voor ${s} ${plural(s, "persoon", "personen")} — ` +
      (missing > 0
        ? `nog ${missing} ${plural(missing, "ingrediënt", "ingrediënten")} nodig`
        : "je hebt alles in huis"),
    protein: "eiwit",
    carbs: "koolhydraten",
    fat: "vet",
    sourceCalculated: "Per portie — per ingrediënt berekend (voorraad, NEVO of Open Food Facts).",
    sourceEstimated:
      "Per portie — geschat door AI (voeg voedingswaarden toe aan je producten voor exacte cijfers).",
    sourcePartlyEstimated:
      "Per portie — per ingrediënt berekend; sommige waarden zijn AI-schattingen.",
    sourcePartial:
      "Per portie — berekend, maar van sommige ingrediënten zijn geen voedingswaarden bekend.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "voorraad",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "AI-schatting",
      manual: "zelf ingevuld",
      none: "geen gegevens"
    },
    changeSource: "Wijzig",
    changeSourceTitle: (name) => `Voedingswaarden voor ${name}`,
    useEstimate: "Gebruik de AI-schatting",
    saveChoice: "Opslaan",
    pickFirst: "Zoek en kies een product, of gebruik de AI-schatting.",
    saveRecipe: "Recept opslaan",
    alreadySaved: "Al opgeslagen",
    saved: "Opgeslagen ✓",
    addMissing: "Ontbrekende op lijst zetten",
    addedToList: "Op lijst gezet ✓",
    alreadyOnList: "Staat al op lijst ✓",
    selectAll: "Alles selecteren",
    saveSelected: (n) => (n > 0 ? `Selectie opslaan (${n})` : "Selectie opslaan"),
    saveAll: (n) => (n > 0 ? `Alles opslaan (${n})` : "Alles opslaan"),
    selectFirst: "Selecteer eerst minstens één recept.",
    oneAlreadySaved: (name) => `"${name}" is al opgeslagen.`,
    thoseAlreadySaved: "Die recepten zijn al opgeslagen.",
    nameExists: (name) => `Er is al een opgeslagen recept met de naam "${name}".`,
    savedOne: (name) => `"${name}" opgeslagen bij je recepten.`,
    savedMany: (n, skipped) =>
      `${n} ${plural(n, "recept", "recepten")} opgeslagen` +
      (skipped > 0 ? ` (${skipped} bestond${plural(skipped, "", "en")} al, overgeslagen).` : "."),
    forRecipe: (name) => `Voor ${name}`,
    addedCount: (n) =>
      `${n} ${plural(n, "ontbrekend ingrediënt", "ontbrekende ingrediënten")} op je boodschappenlijst gezet.`,
    allOnList: "Die ingrediënten staan al op je boodschappenlijst.",
    needKey: "Voeg eerst een API-sleutel toe bij Settings.",
    thinking: "Bezig...",
    asking: "De AI zoekt receptideeën op basis van je voorraad...",
    gotRecipes: (total, ready, extras) =>
      `${total} ${plural(total, "receptidee", "receptideeën")}: ${ready} klaar om te koken, ${extras} met extra ingrediënten.`,
    noneExtras:
      " Deze keer had geen enkel recept extra ingrediënten nodig; tik op de knop hieronder voor recepten die dat wel hebben.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Recepten met een paar extra ingrediënten voorstellen",
    gotExtras: (n) => `${n} ${plural(n, "recept", "recepten")} met extra ingrediënten toegevoegd.`
  },

  de: {
    // Logging what you ate
    servingsEaten: "Gegessene Portionen (0 = nicht eintragen)",
    ateThis: "Gegessen",
    // Fit badge against the daily targets
    meals: { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snack: "Snack" },
    fitGood: (meal) => `Passt gut: ${meal}`,
    fitOver: (meal, pct) => `Zu viel: ${meal} (+${pct}% kcal)`,
    fitUnder: (meal, pct) => `Zu wenig: ${meal} (−${pct}% kcal)`,
    highIn: (macro) => `viel ${macro}`,
    lowIn: (macro) => `wenig ${macro}`,
    setMealType: "Wähle eine Mahlzeit, um zu sehen, wie es zu deinen Zielen passt",
    fiber: "Ballaststoffe",
    // "Cook this" dialog
    cookThis: "Das kochen",
    cookTitle: (name) => `${name} kochen`,
    servingsCooked: "Gekochte Portionen",
    cookAddUsedUp: "Aufgebrauchtes auf die Einkaufsliste setzen",
    cookConfirm: "Kochen und abziehen",
    cancel: "Abbrechen",
    notInStock: "nicht vorrätig",
    unknownQuantity: "Menge im Vorrat unbekannt, nichts abgezogen",
    enterAmount: "Menge eingeben",
    inPantry: (amount, unit) => `im Vorrat: ${amount} ${unit}`,
    short: (amount, unit) => `${amount} ${unit} zu wenig`,
    cooked: (name) => `${name} gekocht`,
    undo: "Rückgängig",
    undone: "Kochen rückgängig gemacht",
    sectionTitle: "KI-Rezeptvorschläge",
    sectionHint: "Erhalte Rezeptideen auf Grundlage deines aktuellen Vorrats.",
    preferencesPlaceholder: "Optional: z. B. vegetarisch, schnelle Gerichte, scharf",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Jede Mahlzeit",
    complexToggle: "Aufwendige Rezepte (mehr Technik und Zeit)",
    mealChoiceLabel: "Mahlzeit",
    suggestButton: "Rezepte aus meinem Vorrat vorschlagen",
    groupReady: (n) => `Bereit zum Kochen (${n})`,
    groupExtras: (n) => `Braucht noch ein paar Zutaten (${n})`,
    selectRecipe: (name) => `${name} auswählen`,
    serves: (s, missing) =>
      `Für ${s} ${plural(s, "Person", "Personen")} — ` +
      (missing > 0
        ? `${missing} ${plural(missing, "Zutat fehlt", "Zutaten fehlen")}`
        : "du hast alles da"),
    protein: "Eiweiß",
    carbs: "Kohlenhydrate",
    fat: "Fett",
    sourceCalculated: "Pro Portion — je Zutat berechnet (Vorrat, NEVO oder Open Food Facts).",
    sourceEstimated:
      "Pro Portion — von der KI geschätzt (füge passenden Artikeln Nährwerte hinzu für genaue Zahlen).",
    sourcePartlyEstimated: "Pro Portion — je Zutat berechnet; einige Werte sind KI-Schätzungen.",
    sourcePartial: "Pro Portion — berechnet, aber für einige Zutaten fehlen Nährwerte.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "Vorrat",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "KI-Schätzung",
      manual: "selbst eingegeben",
      none: "keine Daten"
    },
    changeSource: "Ändern",
    changeSourceTitle: (name) => `Nährwerte für ${name}`,
    useEstimate: "KI-Schätzung verwenden",
    saveChoice: "Speichern",
    pickFirst: "Suche und wähle ein Lebensmittel oder verwende die KI-Schätzung.",
    saveRecipe: "Rezept speichern",
    alreadySaved: "Bereits gespeichert",
    saved: "Gespeichert ✓",
    addMissing: "Fehlende auf die Liste",
    addedToList: "Auf der Liste ✓",
    alreadyOnList: "Schon auf der Liste ✓",
    selectAll: "Alle auswählen",
    saveSelected: (n) => (n > 0 ? `Auswahl speichern (${n})` : "Auswahl speichern"),
    saveAll: (n) => (n > 0 ? `Alle speichern (${n})` : "Alle speichern"),
    selectFirst: "Wähle zuerst mindestens ein Rezept aus.",
    oneAlreadySaved: (name) => `"${name}" ist bereits gespeichert.`,
    thoseAlreadySaved: "Diese Rezepte sind bereits gespeichert.",
    nameExists: (name) => `Ein gespeichertes Rezept namens "${name}" gibt es schon.`,
    savedOne: (name) => `"${name}" in deinen Rezepten gespeichert.`,
    savedMany: (n, skipped) =>
      `${n} ${plural(n, "Rezept", "Rezepte")} gespeichert` +
      (skipped > 0 ? ` (${skipped} schon vorhanden, übersprungen).` : "."),
    forRecipe: (name) => `Für ${name}`,
    addedCount: (n) =>
      `${n} fehlende ${plural(n, "Zutat", "Zutaten")} zur Einkaufsliste hinzugefügt.`,
    allOnList: "Diese Zutaten stehen schon auf deiner Einkaufsliste.",
    needKey: "Füge zuerst unter Settings einen API-Schlüssel hinzu.",
    thinking: "Denke nach...",
    asking: "Die KI sucht Rezeptideen anhand deines Vorrats...",
    gotRecipes: (total, ready, extras) =>
      `${total} ${plural(total, "Rezeptidee", "Rezeptideen")}: ${ready} sofort kochbar, ${extras} mit zusätzlichen Zutaten.`,
    noneExtras:
      " Diesmal brauchte kein Rezept zusätzliche Zutaten; tippe unten auf den Knopf für Rezepte, die welche brauchen.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Rezepte mit ein paar zusätzlichen Zutaten vorschlagen",
    gotExtras: (n) => `${n} ${plural(n, "Rezept", "Rezepte")} mit zusätzlichen Zutaten hinzugefügt.`
  },

  fr: {
    // Logging what you ate
    servingsEaten: "Portions mangées (0 = ne pas enregistrer)",
    ateThis: "Mangé",
    // Fit badge against the daily targets
    meals: { breakfast: "petit-déjeuner", lunch: "déjeuner", dinner: "dîner", snack: "en-cas" },
    fitGood: (meal) => `Convient bien : ${meal}`,
    fitOver: (meal, pct) => `Trop : ${meal} (+${pct} % kcal)`,
    fitUnder: (meal, pct) => `Pas assez : ${meal} (−${pct} % kcal)`,
    highIn: (macro) => `riche en ${macro}`,
    lowIn: (macro) => `pauvre en ${macro}`,
    setMealType: "Choisissez un type de repas pour voir s'il correspond à vos objectifs",
    fiber: "fibres",
    // "Cook this" dialog
    cookThis: "Cuisiner",
    cookTitle: (name) => `Cuisiner ${name}`,
    servingsCooked: "Portions cuisinées",
    cookAddUsedUp: "Ajouter les produits épuisés à la liste de courses",
    cookConfirm: "Cuisiner et déduire",
    cancel: "Annuler",
    notInStock: "pas en stock",
    unknownQuantity: "quantité en stock inconnue, rien déduit",
    enterAmount: "saisir la quantité",
    inPantry: (amount, unit) => `en stock : ${amount} ${unit}`,
    short: (amount, unit) => `il manque ${amount} ${unit}`,
    cooked: (name) => `${name} cuisiné`,
    undo: "Annuler",
    undone: "Cuisson annulée",
    sectionTitle: "Suggestions de recettes par l'IA",
    sectionHint: "Obtenez des idées de recettes selon ce qu'il y a dans votre stock.",
    preferencesPlaceholder: "Facultatif : ex. végétarien, repas rapides, épicé",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Tous les repas",
    complexToggle: "Recettes élaborées (plus de technique et de temps)",
    mealChoiceLabel: "Repas",
    suggestButton: "Proposer des recettes avec mon stock",
    groupReady: (n) => `Prêt à cuisiner (${n})`,
    groupExtras: (n) => `Il manque quelques ingrédients (${n})`,
    selectRecipe: (name) => `Sélectionner ${name}`,
    serves: (s, missing) =>
      `Pour ${s} ${plural(s, "personne", "personnes")} — ` +
      (missing > 0
        ? `${missing} ${plural(missing, "ingrédient manquant", "ingrédients manquants")}`
        : "vous avez tout"),
    protein: "protéines",
    carbs: "glucides",
    fat: "lipides",
    sourceCalculated: "Par portion — calculé par ingrédient (réserve, NEVO ou Open Food Facts).",
    sourceEstimated:
      "Par portion — estimé par l'IA (ajoutez des valeurs nutritionnelles à vos articles pour des chiffres précis).",
    sourcePartlyEstimated:
      "Par portion — calculé par ingrédient ; certaines valeurs sont des estimations de l'IA.",
    sourcePartial:
      "Par portion — calculé, mais certains ingrédients n'ont pas de valeurs nutritionnelles.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "réserve",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "estimation IA",
      manual: "saisi à la main",
      none: "aucune donnée"
    },
    changeSource: "Modifier",
    changeSourceTitle: (name) => `Valeurs nutritionnelles pour ${name}`,
    useEstimate: "Utiliser l'estimation de l'IA",
    saveChoice: "Enregistrer",
    pickFirst: "Cherchez et choisissez un aliment, ou utilisez l'estimation de l'IA.",
    saveRecipe: "Enregistrer la recette",
    alreadySaved: "Déjà enregistrée",
    saved: "Enregistrée ✓",
    addMissing: "Ajouter les manquants à la liste",
    addedToList: "Ajouté à la liste ✓",
    alreadyOnList: "Déjà sur la liste ✓",
    selectAll: "Tout sélectionner",
    saveSelected: (n) => (n > 0 ? `Enregistrer la sélection (${n})` : "Enregistrer la sélection"),
    saveAll: (n) => (n > 0 ? `Tout enregistrer (${n})` : "Tout enregistrer"),
    selectFirst: "Sélectionnez d'abord au moins une recette.",
    oneAlreadySaved: (name) => `"${name}" est déjà enregistrée.`,
    thoseAlreadySaved: "Ces recettes sont déjà enregistrées.",
    nameExists: (name) => `Une recette nommée "${name}" existe déjà.`,
    savedOne: (name) => `"${name}" ajoutée à vos recettes.`,
    savedMany: (n, skipped) =>
      `${n} ${plural(n, "recette enregistrée", "recettes enregistrées")}` +
      (skipped > 0
        ? ` (${skipped} ${plural(skipped, "existait déjà", "existaient déjà")}, ignorée${plural(skipped, "", "s")}).`
        : "."),
    forRecipe: (name) => `Pour ${name}`,
    addedCount: (n) =>
      `${n} ${plural(n, "ingrédient manquant ajouté", "ingrédients manquants ajoutés")} à votre liste de courses.`,
    allOnList: "Ces ingrédients sont déjà sur votre liste de courses.",
    needKey: "Ajoutez d'abord une clé API dans Settings.",
    thinking: "Réflexion...",
    asking: "L'IA cherche des idées de recettes selon votre stock...",
    gotRecipes: (total, ready, extras) =>
      `${total} ${plural(total, "idée", "idées")} de recette : ${ready} ${plural(ready, "prête", "prêtes")} à cuisiner, ${extras} avec des ingrédients en plus.`,
    noneExtras:
      " Cette fois, aucune recette n'avait besoin d'ingrédients en plus ; appuyez sur le bouton ci-dessous pour en obtenir.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Suggérer des recettes avec quelques ingrédients en plus",
    gotExtras: (n) =>
      `${n} ${plural(n, "recette ajoutée", "recettes ajoutées")} avec des ingrédients en plus.`
  },

  es: {
    // Logging what you ate
    servingsEaten: "Raciones que comiste (0 = no registrar)",
    ateThis: "Lo comí",
    // Fit badge against the daily targets
    meals: { breakfast: "desayuno", lunch: "almuerzo", dinner: "cena", snack: "tentempié" },
    fitGood: (meal) => `Encaja bien: ${meal}`,
    fitOver: (meal, pct) => `Demasiado: ${meal} (+${pct}% kcal)`,
    fitUnder: (meal, pct) => `Poco: ${meal} (−${pct}% kcal)`,
    highIn: (macro) => `alto en ${macro}`,
    lowIn: (macro) => `bajo en ${macro}`,
    setMealType: "Elige un tipo de comida para ver cómo encaja con tus objetivos",
    fiber: "fibra",
    // "Cook this" dialog
    cookThis: "Cocinar esto",
    cookTitle: (name) => `Cocinar ${name}`,
    servingsCooked: "Raciones cocinadas",
    cookAddUsedUp: "Añadir lo agotado a la lista de la compra",
    cookConfirm: "Cocinar y descontar",
    cancel: "Cancelar",
    notInStock: "no está en la despensa",
    unknownQuantity: "cantidad en despensa desconocida, no se descuenta nada",
    enterAmount: "introduce la cantidad",
    inPantry: (amount, unit) => `en despensa: ${amount} ${unit}`,
    short: (amount, unit) => `faltan ${amount} ${unit}`,
    cooked: (name) => `${name} cocinado`,
    undo: "Deshacer",
    undone: "Cocción deshecha",
    sectionTitle: "Sugerencias de recetas con IA",
    sectionHint: "Obtén ideas de recetas según lo que tienes en tu despensa.",
    preferencesPlaceholder: "Opcional: p. ej. vegetariano, comidas rápidas, picante",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Cualquier comida",
    complexToggle: "Recetas elaboradas (más técnica y tiempo)",
    mealChoiceLabel: "Comida",
    suggestButton: "Sugerir recetas con mi despensa",
    groupReady: (n) => `Listo para cocinar (${n})`,
    groupExtras: (n) => `Faltan algunos ingredientes (${n})`,
    selectRecipe: (name) => `Seleccionar ${name}`,
    serves: (s, missing) =>
      `Para ${s} ${plural(s, "persona", "personas")} — ` +
      (missing > 0
        ? `${plural(missing, "falta", "faltan")} ${missing} ${plural(missing, "ingrediente", "ingredientes")}`
        : "tienes todo"),
    protein: "proteínas",
    carbs: "carbohidratos",
    fat: "grasas",
    sourceCalculated: "Por ración — calculado por ingrediente (despensa, NEVO u Open Food Facts).",
    sourceEstimated:
      "Por ración — estimado por la IA (añade datos nutricionales a tus productos para cifras exactas).",
    sourcePartlyEstimated:
      "Por ración — calculado por ingrediente; algunos valores son estimaciones de la IA.",
    sourcePartial:
      "Por ración — calculado, pero algunos ingredientes no tienen datos nutricionales.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "despensa",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "estimación IA",
      manual: "introducido a mano",
      none: "sin datos"
    },
    changeSource: "Cambiar",
    changeSourceTitle: (name) => `Valores nutricionales de ${name}`,
    useEstimate: "Usar la estimación de la IA",
    saveChoice: "Guardar",
    pickFirst: "Busca y elige un alimento, o usa la estimación de la IA.",
    saveRecipe: "Guardar receta",
    alreadySaved: "Ya guardada",
    saved: "Guardada ✓",
    addMissing: "Añadir faltantes a la lista",
    addedToList: "Añadido a la lista ✓",
    alreadyOnList: "Ya en la lista ✓",
    selectAll: "Seleccionar todo",
    saveSelected: (n) => (n > 0 ? `Guardar selección (${n})` : "Guardar selección"),
    saveAll: (n) => (n > 0 ? `Guardar todo (${n})` : "Guardar todo"),
    selectFirst: "Selecciona al menos una receta primero.",
    oneAlreadySaved: (name) => `"${name}" ya está guardada.`,
    thoseAlreadySaved: "Esas recetas ya están guardadas.",
    nameExists: (name) => `Ya existe una receta guardada llamada "${name}".`,
    savedOne: (name) => `"${name}" guardada en tus recetas.`,
    savedMany: (n, skipped) =>
      `${n} ${plural(n, "receta guardada", "recetas guardadas")}` +
      (skipped > 0
        ? ` (${skipped} ya ${plural(skipped, "existía", "existían")}, ${plural(skipped, "omitida", "omitidas")}).`
        : "."),
    forRecipe: (name) => `Para ${name}`,
    addedCount: (n) =>
      `${n} ${plural(n, "ingrediente añadido", "ingredientes añadidos")} a tu lista de la compra.`,
    allOnList: "Esos ingredientes ya están en tu lista de la compra.",
    needKey: "Añade primero una clave API en Settings.",
    thinking: "Pensando...",
    asking: "La IA busca ideas de recetas según tu despensa...",
    gotRecipes: (total, ready, extras) =>
      `${total} ${plural(total, "idea", "ideas")} de receta: ${ready} ${plural(ready, "lista", "listas")} para cocinar, ${extras} con ingredientes extra.`,
    noneExtras:
      " Esta vez ninguna receta necesitaba ingredientes extra; toca el botón de abajo para obtener algunas.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Sugerir recetas con algunos ingredientes extra",
    gotExtras: (n) =>
      `${plural(n, "Se añadió", "Se añadieron")} ${n} ${plural(n, "receta", "recetas")} con ingredientes extra.`
  },
  pt: {
    // Logging what you ate
    servingsEaten: "Porções que você comeu (0 = não registrar)",
    ateThis: "Comi",
    // Fit badge against the daily targets
    meals: { breakfast: "café da manhã", lunch: "almoço", dinner: "jantar", snack: "lanche" },
    fitGood: (meal) => `Combina bem com o ${meal}`,
    fitOver: (meal, pct) => `Demais para o ${meal} (+${pct}% kcal)`,
    fitUnder: (meal, pct) => `Pouco para o ${meal} (−${pct}% kcal)`,
    highIn: (macro) => `alto teor de ${macro}`,
    lowIn: (macro) => `baixo teor de ${macro}`,
    setMealType: "Escolha um tipo de refeição para ver como ela se encaixa nas suas metas",
    fiber: "fibras",
    // "Cook this" dialog
    cookThis: "Cozinhar",
    cookTitle: (name) => `Cozinhar ${name}`,
    servingsCooked: "Porções preparadas",
    cookAddUsedUp: "Adicionar itens esgotados à lista de compras",
    cookConfirm: "Cozinhar e descontar",
    cancel: "Cancelar",
    notInStock: "não está na despensa",
    unknownQuantity: "quantidade na despensa desconhecida, nada descontado",
    enterAmount: "informe a quantidade",
    inPantry: (amount, unit) => `na despensa: ${amount} ${unit}`,
    short: (amount, unit) => `faltam ${amount} ${unit}`,
    cooked: (name) => `Receita preparada: ${name}`,
    undo: "Desfazer",
    undone: "Preparo desfeito",
    sectionTitle: "Sugestões de receitas com IA",
    sectionHint: "Receba ideias de receitas com base no que você tem na despensa.",
    preferencesPlaceholder: "Opcional: ex. vegetariano, refeições rápidas, picante",
    // The meal-type choice next to the suggest button; "any" asks for a mix, as before.
    anyMeal: "Qualquer refeição",
    complexToggle: "Receitas elaboradas (mais técnica e tempo)",
    mealChoiceLabel: "Refeição",
    suggestButton: "Sugerir receitas com a minha despensa",
    groupReady: (n) => `Pronto para cozinhar (${n})`,
    groupExtras: (n) => `Faltam alguns ingredientes (${n})`,
    selectRecipe: (name) => `Selecionar ${name}`,
    serves: (s, missing) =>
      `Rende ${s} ${plural(s, "porção", "porções")} — ` +
      (missing > 0
        ? `${plural(missing, "falta", "faltam")} ${missing} ${plural(missing, "ingrediente", "ingredientes")}`
        : "você tem tudo"),
    protein: "proteína",
    carbs: "carboidratos",
    fat: "gordura",
    sourceCalculated: "Por porção — calculado por ingrediente (despensa, NEVO ou Open Food Facts).",
    sourceEstimated:
      "Por porção — estimado pela IA (adicione dados nutricionais aos seus produtos para números exatos).",
    sourcePartlyEstimated:
      "Por porção — calculado por ingrediente; alguns valores são estimativas da IA.",
    sourcePartial: "Por porção — calculado, mas alguns ingredientes não têm dados nutricionais.",
    // Where an ingredient's values come from, shown next to it.
    sourceLabels: {
      pantry: "despensa",
      nevo: "NEVO",
      off: "Open Food Facts",
      estimated: "estimativa da IA",
      manual: "digitado à mão",
      none: "sem dados"
    },
    changeSource: "Alterar",
    changeSourceTitle: (name) => `Valores nutricionais de ${name}`,
    useEstimate: "Usar a estimativa da IA",
    saveChoice: "Salvar",
    pickFirst: "Pesquise e escolha um alimento, ou use a estimativa da IA.",
    saveRecipe: "Salvar receita",
    alreadySaved: "Já salva",
    saved: "Salva ✓",
    addMissing: "Adicionar faltantes à lista",
    addedToList: "Adicionado à lista ✓",
    alreadyOnList: "Já está na lista ✓",
    selectAll: "Selecionar tudo",
    saveSelected: (n) => (n > 0 ? `Salvar selecionadas (${n})` : "Salvar selecionadas"),
    saveAll: (n) => (n > 0 ? `Salvar todas (${n})` : "Salvar todas"),
    selectFirst: "Selecione pelo menos uma receita primeiro.",
    oneAlreadySaved: (name) => `"${name}" já está salva.`,
    thoseAlreadySaved: "Essas receitas já estão salvas.",
    nameExists: (name) => `Já existe uma receita salva chamada "${name}".`,
    savedOne: (name) => `"${name}" foi salva nas suas receitas.`,
    savedMany: (n, skipped) =>
      `${n} ${plural(n, "receita salva", "receitas salvas")}` +
      (skipped > 0
        ? ` (${skipped} já ${plural(skipped, "existia", "existiam")}, ${plural(skipped, "ignorada", "ignoradas")}).`
        : "."),
    forRecipe: (name) => `Para ${name}`,
    addedCount: (n) =>
      `${n} ${plural(n, "ingrediente adicionado", "ingredientes adicionados")} à sua lista de compras.`,
    allOnList: "Esses ingredientes já estão na sua lista de compras.",
    needKey: "Adicione primeiro uma chave de API em Settings.",
    thinking: "Pensando...",
    asking: "A IA está buscando ideias de receitas com base na sua despensa...",
    gotRecipes: (total, ready, extras) =>
      `${total} ${plural(total, "ideia", "ideias")} de receita: ${ready} ${plural(ready, "pronta", "prontas")} para cozinhar, ${extras} com ingredientes extras.`,
    noneExtras:
      " Desta vez nenhuma receita precisava de ingredientes extras; toque no botão abaixo para receber algumas.",
    // The follow-up request when no suggestion needed extra ingredients.
    moreWithExtras: "Sugerir receitas com alguns ingredientes extras",
    gotExtras: (n) =>
      `${n} ${plural(n, "receita adicionada", "receitas adicionadas")} com ingredientes extras.`
  }
};

// The language codes with a full set of texts; a unit test checks each one has every English text.
export const UI_LANGUAGES = Object.keys(TEXTS);

// Returns the text set for a language code, falling back to English for unknown codes.
export function forLanguage(code) {
  return TEXTS[code] || TEXTS.en;
}
