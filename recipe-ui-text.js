// ============================================================================
// Texts for the AI recipe section, in each language offered under
// Settings -> Recipe language. Kept in its own file so app.js doesn't grow
// further and all translations live in one place.
// ============================================================================

(function () {
  // Picks the singular or plural form, so each language can word counts naturally.
  const plural = (n, one, many) => (n === 1 ? one : many);

  const TEXTS = {
    en: {
      sectionTitle: "AI recipe suggestions",
      sectionHint: "Get recipe ideas based on what's currently in your pantry stock.",
      preferencesPlaceholder: "Optional: e.g. vegetarian, quick meals, spicy",
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
      sourceCalculated: "Per serving — calculated from your saved nutrition data.",
      sourceEstimated:
        "Per serving — estimated by AI (add nutrition data to matching items for precise numbers).",
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
      noneExtras: " None needed extra ingredients this time. Tap the button again for more variety."
    },

    nl: {
      sectionTitle: "AI-receptsuggesties",
      sectionHint: "Krijg receptideeën op basis van wat er nu in je voorraad staat.",
      preferencesPlaceholder: "Optioneel: bijv. vegetarisch, snelle maaltijden, pittig",
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
      sourceCalculated: "Per portie — berekend met je opgeslagen voedingswaarden.",
      sourceEstimated:
        "Per portie — geschat door AI (voeg voedingswaarden toe aan je producten voor exacte cijfers).",
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
      noneExtras: " Deze keer had geen enkel recept extra ingrediënten nodig. Tik nogmaals voor meer variatie."
    },

    de: {
      sectionTitle: "KI-Rezeptvorschläge",
      sectionHint: "Erhalte Rezeptideen auf Grundlage deines aktuellen Vorrats.",
      preferencesPlaceholder: "Optional: z. B. vegetarisch, schnelle Gerichte, scharf",
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
      sourceCalculated: "Pro Portion — berechnet aus deinen gespeicherten Nährwerten.",
      sourceEstimated:
        "Pro Portion — von der KI geschätzt (füge passenden Artikeln Nährwerte hinzu für genaue Zahlen).",
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
      noneExtras: " Diesmal brauchte kein Rezept zusätzliche Zutaten. Tippe erneut für mehr Abwechslung."
    },

    fr: {
      sectionTitle: "Suggestions de recettes par l'IA",
      sectionHint: "Obtenez des idées de recettes selon ce qu'il y a dans votre stock.",
      preferencesPlaceholder: "Facultatif : ex. végétarien, repas rapides, épicé",
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
      sourceCalculated: "Par portion — calculé à partir de vos valeurs nutritionnelles enregistrées.",
      sourceEstimated:
        "Par portion — estimé par l'IA (ajoutez des valeurs nutritionnelles à vos articles pour des chiffres précis).",
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
        (skipped > 0 ? ` (${skipped} ${plural(skipped, "existait déjà", "existaient déjà")}, ignorée${plural(skipped, "", "s")}).` : "."),
      forRecipe: (name) => `Pour ${name}`,
      addedCount: (n) =>
        `${n} ${plural(n, "ingrédient manquant ajouté", "ingrédients manquants ajoutés")} à votre liste de courses.`,
      allOnList: "Ces ingrédients sont déjà sur votre liste de courses.",
      needKey: "Ajoutez d'abord une clé API dans Settings.",
      thinking: "Réflexion...",
      asking: "L'IA cherche des idées de recettes selon votre stock...",
      gotRecipes: (total, ready, extras) =>
        `${total} ${plural(total, "idée", "idées")} de recette : ${ready} ${plural(ready, "prête", "prêtes")} à cuisiner, ${extras} avec des ingrédients en plus.`,
      noneExtras: " Cette fois, aucune recette n'avait besoin d'ingrédients en plus. Appuyez à nouveau pour plus de variété."
    },

    es: {
      sectionTitle: "Sugerencias de recetas con IA",
      sectionHint: "Obtén ideas de recetas según lo que tienes en tu despensa.",
      preferencesPlaceholder: "Opcional: p. ej. vegetariano, comidas rápidas, picante",
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
      sourceCalculated: "Por ración — calculado con tus datos nutricionales guardados.",
      sourceEstimated:
        "Por ración — estimado por la IA (añade datos nutricionales a tus productos para cifras exactas).",
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
        (skipped > 0 ? ` (${skipped} ya ${plural(skipped, "existía", "existían")}, ${plural(skipped, "omitida", "omitidas")}).` : "."),
      forRecipe: (name) => `Para ${name}`,
      addedCount: (n) =>
        `${n} ${plural(n, "ingrediente añadido", "ingredientes añadidos")} a tu lista de la compra.`,
      allOnList: "Esos ingredientes ya están en tu lista de la compra.",
      needKey: "Añade primero una clave API en Settings.",
      thinking: "Pensando...",
      asking: "La IA busca ideas de recetas según tu despensa...",
      gotRecipes: (total, ready, extras) =>
        `${total} ${plural(total, "idea", "ideas")} de receta: ${ready} ${plural(ready, "lista", "listas")} para cocinar, ${extras} con ingredientes extra.`,
      noneExtras: " Esta vez ninguna receta necesitaba ingredientes extra. Toca de nuevo para más variedad."
    }
  };

  // Returns the text set for a language code, falling back to English for unknown codes.
  window.RecipeUiText = {
    forLanguage(code) {
      return TEXTS[code] || TEXTS.en;
    }
  };
})();
