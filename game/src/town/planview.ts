// Drawing the ground plan. Render only — every decision was made in plan.ts.

import type { Town } from "./types";
import type { Plan, Vec, PlanBuilding } from "./plan";
import { planTown } from "./plan";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const poly = (pts: Vec[]) => pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" ");
const path = (pts: Vec[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" ");

// A building is a rectangle standing square to its street, which is why the town
// reads as streets with houses on them rather than as scattered boxes.
function building(b: PlanBuilding): string {
  const deg = ((b.rot * 180) / Math.PI).toFixed(1);
  const cls = `bd is-${b.state}${b.zone === "dwelling" ? " is-house" : ""}`;
  return (
    `<g class="${cls}" transform="translate(${b.x.toFixed(0)},${b.y.toFixed(0)}) rotate(${deg})">` +
    `<title>${esc(b.label)}</title>` +
    `<rect x="${(-b.w / 2).toFixed(0)}" y="${(-b.h / 2).toFixed(0)}" width="${b.w.toFixed(0)}" height="${b.h.toFixed(0)}" />` +
    // A ridge line down the roof: cheap, and it makes a box read as a building.
    `<line x1="${(-b.w / 2 + 6).toFixed(0)}" y1="0" x2="${(b.w / 2 - 6).toFixed(0)}" y2="0" class="bd-ridge" />` +
    `</g>`
  );
}

export function renderPlan(town: Town, plan?: Plan): string {
  const p = plan ?? planTown(town);
  const v = p.view;
  return `<svg class="townplan" viewBox="${v.x.toFixed(0)} ${v.y.toFixed(0)} ${v.w.toFixed(0)} ${v.h.toFixed(0)}" role="img" aria-label="the ground at ${esc(town.name)}">
    <rect class="pl-ground" x="${v.x.toFixed(0)}" y="${v.y.toFixed(0)}" width="${v.w.toFixed(0)}" height="${v.h.toFixed(0)}" />
    <polygon class="pl-water" points="${poly(p.water)}" />
    ${p.fields
      .map(
        (f) =>
          `<g class="fd ${f.ruin ? "is-ruin" : ""}"><title>${esc(f.label)}</title>` +
          `<circle cx="${f.at.x.toFixed(0)}" cy="${f.at.y.toFixed(0)}" r="${f.r.toFixed(0)}" />` +
          `<text x="${f.at.x.toFixed(0)}" y="${(f.at.y + 4).toFixed(0)}">${esc(f.label)}</text></g>`,
      )
      .join("")}
    ${p.roads
      .map((r) => `<path class="rd is-${r.kind}" style="stroke-width:${r.width}" d="${path(r.pts)}" />`)
      .join("")}
    <circle class="pl-plaza" cx="${p.plaza.x.toFixed(0)}" cy="${p.plaza.y.toFixed(0)}" r="58" />
    ${p.buildings.map(building).join("")}
    ${p.wall.map((seg) => `<path class="pl-wall" d="${path(seg)}" />`).join("")}
    <text class="pl-mark" x="${p.quay.x.toFixed(0)}" y="${(p.quay.y + 34).toFixed(0)}">the quay</text>
    <text class="pl-mark" x="${p.plaza.x.toFixed(0)}" y="${(p.plaza.y + 4).toFixed(0)}">the plaza</text>
  </svg>`;
}
