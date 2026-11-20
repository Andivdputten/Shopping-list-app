// NEVO (Dutch food composition table, RIVM): turns the imported workbook's rows into foods and searches them.
// No page or state access, so every rule is unit-tested; values are kept exactly as NEVO gives them (licence).

// RIVM's conditions require this reference wherever NEVO values are used in a calculation.
export function nevoReference(version) {
  return `Based on data from NEVO online version ${version}, RIVM, Bilthoven and other data sources`;
}

// "NEVO-Online 2025 9.0" → "2025/9.0", the form RIVM's reference uses; anything else stays as written.
export function nevoVersionLabel(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const match = /(\d{4})\s+(\d+(?:\.\d+)*)/.exec(text);
  return match ? `${match[1]}/${match[2]}` : text;
}

// Columns are found by their header (NEVO's component codes), not position, so a new NEVO version that
// adds or moves columns still imports. Headers are matched on how they start.
const COLUMNS = {
  version: "NEVO-versie",
  group: "Food group",
  code: "NEVO-code",
  nameNl: "Voedingsmiddelnaam",
  nameEn: "Engelse naam",
  synonym: "Synoniem",
  quantity: "Hoeveelheid",
  kcal: "ENERCC",
  protein: "PROT (",
  fat: "FAT (",
  carbs: "CHO (",
  fiber: "FIBT"
};
const REQUIRED = ["code", "nameNl", "kcal", "protein", "fat", "carbs"];

const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

// Lower case without accents or punctuation, so "Crème fraîche" is found by "creme fraiche".
export function searchText(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// The foods in the main NEVO sheet (header row first). Throws when the sheet isn't a NEVO table.
// An empty value stays null (unknown), never 0; "per 100ml" foods get unit "ml", all others "g".
export function parseNevoRows(rows) {
  const header = (rows[0] || []).map(text);
  const index = {};
  Object.entries(COLUMNS).forEach(([key, start]) => {
    index[key] = header.findIndex((label) => label.startsWith(start));
  });
  if (REQUIRED.some((key) => index[key] === -1)) {
    throw new Error(
      "This file isn't a NEVO table: the NEVO-code, name, kcal or macro columns are missing."
    );
  }

  const cell = (row, key) => (index[key] === -1 ? null : row[index[key]]);
  const foods = rows
    .slice(1)
    .map((row) => ({
      code: number(cell(row, "code")),
      nameNl: text(cell(row, "nameNl")),
      nameEn: text(cell(row, "nameEn")),
      synonym: text(cell(row, "synonym")),
      group: text(cell(row, "group")),
      unit: /ml/i.test(text(cell(row, "quantity"))) ? "ml" : "g",
      nutrition: {
        kcal100g: number(cell(row, "kcal")),
        protein100g: number(cell(row, "protein")),
        carbs100g: number(cell(row, "carbs")),
        fat100g: number(cell(row, "fat")),
        fiber100g: number(cell(row, "fiber"))
      }
    }))
    .filter((food) => food.code !== null && food.nameNl !== "");

  if (foods.length === 0) {
    throw new Error("This NEVO table has no foods.");
  }
  const firstRow = rows[1] || [];
  return { version: nevoVersionLabel(text(cell(firstRow, "version"))), foods };
}

// Validates stored NEVO data; anything malformed means "no NEVO imported" rather than a broken search.
export function normalizeNevoData(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof raw.version !== "string" ||
    !Array.isArray(raw.foods)
  ) {
    return null;
  }
  const foods = raw.foods.filter(
    (food) =>
      food &&
      typeof food.code === "number" &&
      typeof food.nameNl === "string" &&
      food.nameNl !== "" &&
      food.nutrition &&
      typeof food.nutrition === "object"
  );
  return foods.length > 0 ? { version: raw.version, foods } : null;
}

// Foods whose names (Dutch, English or synonym) contain every word of the query, best first: a name that
// starts with the query, then one whose first word matches, then word starts, then inside a word (Dutch
// compounds: "rijst" finds "Zilvervliesrijst"); shorter names first within each.
export function searchNevo(foods, query, limit = 20) {
  return rankNevo(foods, query, limit).map((result) => result.food);
}

// The matches with their rank (0 = a name's first word is the query's first word ... 4 = inside a word).
function rankNevo(foods, query, limit) {
  const words = searchText(query).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const phrase = words.join(" ");
  const stem = stemWord;
  const stems = words.map(stem);

  return foods
    .map((food) => {
      const names = [food.nameNl, food.nameEn, food.synonym].map(searchText).filter(Boolean);
      const tokens = names.join(" ").split(" ");
      if (!stems.every((word) => tokens.some((token) => token.includes(word)))) {
        return null;
      }
      // A name whose first word is exactly the query's first word ("ei" → "Ei kippen- rauw") beats
      // names that merely start with it ("Eierkoek"), so the plain food comes before its products.
      const firstWords = names.map((name) => name.split(" ")[0]);
      const rank = firstWords.some((word) => stem(word) === stems[0])
        ? 0
        : names.some((name) => name.startsWith(phrase))
          ? 1
          : firstWords.some((word) => word.startsWith(stems[0]))
            ? 2
            : stems.every((word) => tokens.some((token) => token.startsWith(word)))
              ? 3
              : 4;
      return { food, rank, length: food.nameNl.length };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.length - b.length)
    .slice(0, limit);
}

// English plurals count as the same word ("apples" finds "apple", "onion" ranks "Onions raw" first).
function stemWord(word) {
  return word.length > 3 ? word.replace(/e?s$/, "") : word;
}

// Words that only say how a food is prepared or packed; on their own they never identify a food.
const STATE_WORDS = new Set(
  "raw cooked boiled fried baked roasted grilled steamed stewed prepared unprepared uncooked dried dry fresh frozen canned tinned average av w wo with without and in".split(
    " "
  )
);

// NEVO's wording for a few common words, so "canned tomatoes" meets "Tomatoes tinned" and uncooked
// rice or pasta meets NEVO's "raw".
const SAME_WORDS = { tinned: "canned", uncooked: "raw" };
const matchWord = (word) => {
  const stem = stemWord(word);
  return SAME_WORDS[stem] || stem;
};

// The single best NEVO food for an ingredient name (e.g. the AI's English search name), or null.
// Word order is ignored, as NEVO's English names put the food first ("Oil olive", "Cheese Parmesan").
// Best, in order: most food words matched exactly ("egg" is the word Egg, not the start of Eggplant);
// most food words matched at all; the query's first food word among them ("salmon fillet" is salmon);
// a name that starts with a food word ("Butter salted", not "Peanut butter");
// the name most covered by the query ("Tomatoes tinned" over a long dish that mentions tomato); the
// shortest name. State words such as "raw" help rank but never make a match on their own.
export function bestNevoMatch(foods, query) {
  const words = [...new Set(searchText(query).split(" ").filter(Boolean).map(matchWord))];
  const firstFoodWord = words.find((word) => !STATE_WORDS.has(word));
  if (!firstFoodWord) {
    return null;
  }
  let best = null;
  foods.forEach((food) => {
    [food.nameEn, food.nameNl, food.synonym].forEach((name) => {
      const tokens = searchText(name).split(" ").filter(Boolean).map(matchWord);
      if (tokens.length === 0) {
        return;
      }
      const matched = words.filter((word) => tokens.some((token) => token.startsWith(word)));
      const foodWords = matched.filter((word) => !STATE_WORDS.has(word));
      if (foodWords.length === 0) {
        return;
      }
      const exact = foodWords.filter((word) => tokens.includes(word)).length;
      const covered = tokens.filter((token) =>
        matched.some((word) => token.startsWith(word))
      ).length;
      const score = [
        exact,
        foodWords.length,
        foodWords.includes(firstFoodWord) ? 1 : 0,
        foodWords.some((word) => tokens[0].startsWith(word)) ? 1 : 0,
        covered / tokens.length,
        -food.nameNl.length
      ];
      if (!best || compareScores(score, best.score) > 0) {
        best = { food, score };
      }
    });
  });
  return best ? best.food : null;
}

function compareScores(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}
