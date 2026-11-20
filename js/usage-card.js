// The "AI usage this month" part of the Settings AI card: tokens in and out, an estimated cost, the share
// of an optional monthly token budget, and a bar per day. The rules live in js/token-usage.js.
import { TOKEN_BUDGET_STORAGE_KEY, TOKEN_USAGE_STORAGE_KEY } from "./constants.js";
import { dateKey } from "./intake.js";
import { RecipeAI } from "./recipe-ai.js";
import { addUsage, budgetStatus, monthDays, monthTotals, normalizeUsage } from "./token-usage.js";

const byId = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
const formatTokens = (value) => Math.round(value).toLocaleString("en-GB");

// Under a cent shows as "< $0.01", so a few cheap requests don't read as free.
export function formatCost(cost) {
  if (cost === 0) {
    return "$0.00";
  }
  return cost < 0.01 ? "< $0.01" : `$${cost.toFixed(2)}`;
}

// Storage can fail (private mode, full); usage then just isn't kept, which never blocks a request.
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function writeValue(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    // Not stored: the count only lives until the app is closed.
  }
}

let usage = {};
let budget = null;

function svg(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

// Stacked bars per day of this month: input tokens (light) under output tokens (dark), with tooltips
// and a hidden table for screen readers. Output costs five times as much, so it gets the strong colour.
function renderChart(container, days) {
  container.innerHTML = "";
  const width = 320;
  const top = 8;
  const bottom = 92;
  const slot = width / 31;
  const max = Math.max(1, ...days.map((day) => day.input + day.output));
  const y = (tokens) => bottom - (tokens / max) * (bottom - top);
  const chart = svg("svg", {
    viewBox: `0 0 ${width} 110`,
    class: "usage-chart",
    role: "img",
    "aria-label": "AI tokens per day this month"
  });
  chart.appendChild(svg("line", { x1: 0, x2: width, y1: bottom, y2: bottom, class: "week-axis" }));
  days.forEach((day, index) => {
    const x = index * slot + 1;
    const group = svg("g", {});
    const title = svg("title", {});
    title.textContent = `${day.date}: ${formatTokens(day.input)} in, ${formatTokens(day.output)} out`;
    group.appendChild(title);
    group.appendChild(
      svg("rect", { x: index * slot, y: 0, width: slot, height: 110, class: "week-hit" })
    );
    if (day.input > 0) {
      group.appendChild(
        svg("rect", {
          x,
          y: y(day.input),
          width: slot - 2,
          height: bottom - y(day.input),
          class: "usage-in"
        })
      );
    }
    if (day.output > 0) {
      const outTop = y(day.input + day.output);
      group.appendChild(
        svg("rect", {
          x,
          y: outTop,
          width: slot - 2,
          height: y(day.input) - outTop,
          class: "usage-out"
        })
      );
    }
    // Day numbers on the 1st, every 7 days and the last day shown, so the axis stays readable.
    const dayNumber = Number(day.date.slice(8));
    if (dayNumber === 1 || dayNumber % 7 === 0 || index === days.length - 1) {
      const label = svg("text", {
        x: index * slot + slot / 2,
        y: bottom + 14,
        class: "week-label",
        "text-anchor": "middle"
      });
      label.textContent = String(dayNumber);
      group.appendChild(label);
    }
    chart.appendChild(group);
  });
  container.appendChild(chart);

  const legend = document.createElement("p");
  legend.className = "hint-text usage-legend";
  legend.innerHTML = "";
  [
    ["usage-in", "input tokens"],
    ["usage-out", "output tokens"]
  ].forEach(([className, text]) => {
    const dot = document.createElement("span");
    dot.className = `usage-dot ${className}`;
    legend.append(dot, ` ${text}  `);
  });
  container.appendChild(legend);

  const table = document.createElement("table");
  table.className = "sr-only";
  days.forEach((day) => {
    const row = table.insertRow();
    row.insertCell().textContent = day.date;
    row.insertCell().textContent = `${formatTokens(day.input)} input, ${formatTokens(day.output)} output tokens`;
  });
  container.appendChild(table);
}

export function renderUsageCard() {
  const summary = byId("usageSummary");
  if (!summary) {
    return;
  }
  const today = dateKey(new Date());
  const totals = monthTotals(usage, today);
  const status = budgetStatus(totals, budget);
  summary.innerHTML = "";

  const line = document.createElement("p");
  line.className = "status-text";
  line.id = "usageTotals";
  line.textContent =
    totals.requests === 0
      ? "No AI requests yet this month."
      : `${formatTokens(totals.input + totals.output)} tokens (${formatTokens(totals.input)} in · ` +
        `${formatTokens(totals.output)} out) · about ${formatCost(totals.cost)} · ` +
        `${totals.requests} request${totals.requests === 1 ? "" : "s"}`;
  summary.appendChild(line);

  if (status.level !== "none") {
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const fill = document.createElement("div");
    // Amber from 80%, red when used up, so the bar says the same as the line under it.
    fill.className = `progress-fill${
      status.level === "over" ? " over" : status.level === "warning" ? " warning" : ""
    }`;
    fill.style.width = `${Math.min(100, Math.round(status.share * 100))}%`;
    bar.appendChild(fill);
    const label = document.createElement("p");
    label.className = `hint-text usage-budget usage-${status.level}`;
    label.id = "usageBudget";
    label.textContent =
      `${Math.round(status.share * 100)}% of your ${formatTokens(budget)}-token budget` +
      (status.level === "over"
        ? ": budget used up."
        : status.level === "warning"
          ? ": nearly used up."
          : ".");
    summary.append(bar, label);
  }

  renderChart(byId("usageChart"), monthDays(usage, today));
}

export function initUsageCard() {
  if (!byId("usageSummary")) {
    return;
  }
  usage = normalizeUsage(readJson(TOKEN_USAGE_STORAGE_KEY));
  const storedBudget = readJson(TOKEN_BUDGET_STORAGE_KEY);
  budget = typeof storedBudget === "number" && storedBudget > 0 ? storedBudget : null;
  const input = byId("tokenBudgetInput");
  input.value = budget === null ? "" : String(budget);
  input.addEventListener("change", () => {
    const value = Number(input.value);
    budget =
      input.value.trim() !== "" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    writeValue(TOKEN_BUDGET_STORAGE_KEY, budget);
    renderUsageCard();
  });

  // Every AI answer (suggestions, the extras follow-up, the connection test) adds its tokens to today.
  RecipeAI.onUsage((reported, model) => {
    usage = addUsage(usage, dateKey(new Date()), reported, model);
    writeValue(TOKEN_USAGE_STORAGE_KEY, usage);
    renderUsageCard();
  });
  renderUsageCard();
}
