// Reading a recipe answer while it is still arriving (streaming), so each recipe can be shown the moment it is
// complete instead of after the whole answer. No page or state access, so it is unit-tested.

// The complete recipe objects found so far in the array under `key` ("ready" or "needsExtras") of a JSON
// answer that may be cut off anywhere. A recipe only counts once its closing brace has arrived; anything
// unfinished is ignored until a later call. Strings are tracked, so braces inside text don't confuse it.
export function completeRecipes(partialJson, key) {
  const found = [];
  // Each open container: { type: "{" | "[", key, start }; key = the property this container belongs to.
  const stack = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let lastString = null;
  let pendingKey = null;

  for (let i = 0; i < partialJson.length; i++) {
    const char = partialJson[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
        lastString = partialJson.slice(stringStart + 1, i);
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      stringStart = i;
    } else if (char === ":") {
      // The string just before a colon is a property name.
      pendingKey = lastString;
    } else if (char === "{" || char === "[") {
      stack.push({ type: char, key: pendingKey, start: i });
      pendingKey = null;
    } else if (char === "}" || char === "]") {
      const closed = stack.pop();
      const parent = stack[stack.length - 1];
      // A recipe: an object directly inside the array under `key`, which itself sits in the root object.
      if (
        closed &&
        closed.type === "{" &&
        parent &&
        parent.type === "[" &&
        parent.key === key &&
        stack.length === 2
      ) {
        try {
          found.push(JSON.parse(partialJson.slice(closed.start, i + 1)));
        } catch (error) {
          // Not valid on its own (shouldn't happen with structured outputs); the final parse decides.
        }
      }
    } else if (char === ",") {
      pendingKey = null;
    }
  }
  return found;
}

// Splits a stream of server-sent events into its events; returns the complete events and the unfinished
// rest, to be prepended to the next chunk. Each event: { event, data } with data parsed from JSON.
export function parseServerEvents(buffer) {
  const events = [];
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop();
  blocks.forEach((block) => {
    let event = "message";
    const dataLines = [];
    block.split(/\r?\n/).forEach((line) => {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    });
    if (dataLines.length > 0) {
      try {
        events.push({ event, data: JSON.parse(dataLines.join("\n")) });
      } catch (error) {
        // A malformed event is skipped; the final answer is still checked as a whole.
      }
    }
  });
  return { events, rest };
}
