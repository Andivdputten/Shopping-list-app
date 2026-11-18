// The nutrition statistics charts on the Settings tab.
import {
  listMacroChart,
  listMacroCoverage,
  listMacroLegend,
  pantryMacroChart,
  pantryMacroCoverage,
  pantryMacroLegend
} from "./dom.js";
import { buildMacroDonutSvg, calculateMacroTotals } from "./nutrition.js";
import { state } from "./state.js";

export function renderMacroStatBlock(itemArray, chartEl, legendEl, coverageEl) {
  const { totals, includedCount, totalCount } = calculateMacroTotals(itemArray);

  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const macroKcalTotal = proteinKcal + carbsKcal + fatKcal;

  if (macroKcalTotal <= 0) {
    chartEl.innerHTML = '<div class="macro-chart-empty">No nutrition data available yet</div>';
    legendEl.innerHTML = "";
    coverageEl.textContent =
      totalCount === 0 ? "" : `0 of ${totalCount} item${totalCount === 1 ? "" : "s"} counted.`;
    return;
  }

  chartEl.innerHTML = buildMacroDonutSvg(proteinKcal, carbsKcal, fatKcal);

  const round1 = (value) => Math.round(value * 10) / 10;
  const pct = (kcal) => Math.round((kcal / macroKcalTotal) * 100);

  legendEl.innerHTML = "";

  const totalRow = document.createElement("div");
  totalRow.className = "macro-legend-total";
  totalRow.textContent = `${Math.round(totals.kcal)} kcal total`;
  legendEl.appendChild(totalRow);

  const rows = [
    { label: "Protein", value: totals.protein, color: "#2e7d32", kcal: proteinKcal },
    { label: "Carbs", value: totals.carbs, color: "#f59e0b", kcal: carbsKcal },
    { label: "Fat", value: totals.fat, color: "#dc2626", kcal: fatKcal }
  ];

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "macro-legend-row";

    const dot = document.createElement("span");
    dot.className = "macro-legend-dot";
    dot.style.background = row.color;

    const label = document.createElement("span");
    label.className = "macro-legend-label";
    label.textContent = row.label;

    const value = document.createElement("span");
    value.className = "macro-legend-value";
    value.textContent = `${round1(row.value)}g (${pct(row.kcal)}%)`;

    rowEl.appendChild(dot);
    rowEl.appendChild(label);
    rowEl.appendChild(value);
    legendEl.appendChild(rowEl);
  });

  coverageEl.textContent = `Based on ${includedCount} of ${totalCount} item${totalCount === 1 ? "" : "s"} with known amount and nutrition data.`;
}

export function renderNutritionStatistics() {
  renderMacroStatBlock(state.stockItems, pantryMacroChart, pantryMacroLegend, pantryMacroCoverage);
  renderMacroStatBlock(state.items, listMacroChart, listMacroLegend, listMacroCoverage);
}
