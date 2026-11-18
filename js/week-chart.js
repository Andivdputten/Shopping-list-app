// The "Last 7 days" chart on the Today tab: kcal per day as bars, with the daily kcal target as a line.
// One series, so one colour and no legend; the shown day gets the only value label; every bar has a
// tooltip, and a hidden table gives screen readers the same numbers.
import { kcalPerDay } from "./intake.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 320;
const HEIGHT = 160;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 130;
const BAR_WIDTH = 24;

function svgElement(tag, attributes) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

// A bar with a 4px rounded top and a square base on the baseline.
function barPath(x, top, bottom, width) {
  const r = Math.min(4, (bottom - top) / 2, width / 2);
  return [
    `M${x},${bottom}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${bottom}`,
    "Z"
  ].join(" ");
}

function dayLabel(date) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).toLocaleDateString("en-GB", { weekday: "short" });
  return { weekday, day: String(day) };
}

export function renderWeekChart(container, entries, shownDate, kcalTarget) {
  container.innerHTML = "";
  const days = kcalPerDay(entries, shownDate, 7);
  const max = Math.max(1, kcalTarget || 0, ...days.map((d) => d.kcal)) * 1.1;
  const y = (kcal) => PLOT_BOTTOM - (kcal / max) * (PLOT_BOTTOM - PLOT_TOP);
  const slot = WIDTH / days.length;

  const svg = svgElement("svg", {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: "week-chart",
    role: "img",
    "aria-label": `kcal per day for the 7 days up to ${shownDate}`
  });

  // Baseline in a recessive grey.
  svg.appendChild(
    svgElement("line", { x1: 0, x2: WIDTH, y1: PLOT_BOTTOM, y2: PLOT_BOTTOM, class: "week-axis" })
  );

  days.forEach((day, i) => {
    const x = i * slot + (slot - BAR_WIDTH) / 2;
    const group = svgElement("g", { class: "week-day" });
    const label = dayLabel(day.date);
    const title = svgElement("title", {});
    title.textContent = `${label.weekday} ${label.day}: ${Math.round(day.kcal)} kcal`;
    group.appendChild(title);
    // An invisible hit area the full height of the slot, so the tooltip is easy to reach on a phone.
    group.appendChild(
      svgElement("rect", { x: i * slot, y: 0, width: slot, height: HEIGHT, class: "week-hit" })
    );
    if (day.kcal > 0) {
      group.appendChild(
        svgElement("path", {
          d: barPath(x, y(day.kcal), PLOT_BOTTOM, BAR_WIDTH),
          class: "week-bar"
        })
      );
    }
    const isShown = day.date === shownDate;
    if (isShown && day.kcal > 0) {
      const value = svgElement("text", {
        x: x + BAR_WIDTH / 2,
        y: y(day.kcal) - 5,
        class: "week-value",
        "text-anchor": "middle"
      });
      value.textContent = String(Math.round(day.kcal));
      group.appendChild(value);
    }
    const weekday = svgElement("text", {
      x: i * slot + slot / 2,
      y: PLOT_BOTTOM + 14,
      class: isShown ? "week-label week-label-shown" : "week-label",
      "text-anchor": "middle"
    });
    weekday.textContent = label.weekday;
    const dayNumber = svgElement("text", {
      x: i * slot + slot / 2,
      y: PLOT_BOTTOM + 26,
      class: isShown ? "week-label week-label-shown" : "week-label",
      "text-anchor": "middle"
    });
    dayNumber.textContent = label.day;
    group.append(weekday, dayNumber);
    svg.appendChild(group);
  });

  // The daily target as a dashed line, labelled at the right end.
  if (kcalTarget) {
    svg.appendChild(
      svgElement("line", {
        x1: 0,
        x2: WIDTH,
        y1: y(kcalTarget),
        y2: y(kcalTarget),
        class: "week-target"
      })
    );
    const targetLabel = svgElement("text", {
      x: WIDTH - 2,
      y: y(kcalTarget) - 4,
      class: "week-target-label",
      "text-anchor": "end"
    });
    targetLabel.textContent = `target ${Math.round(kcalTarget)}`;
    svg.appendChild(targetLabel);
  }
  container.appendChild(svg);

  // The same numbers as a table for screen readers.
  const table = document.createElement("table");
  table.className = "sr-only";
  const caption = document.createElement("caption");
  caption.textContent = "kcal per day";
  table.appendChild(caption);
  days.forEach((day) => {
    const row = table.insertRow();
    row.insertCell().textContent = day.date;
    row.insertCell().textContent = `${Math.round(day.kcal)} kcal`;
  });
  container.appendChild(table);
}
