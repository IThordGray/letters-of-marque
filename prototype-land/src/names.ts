import { pick } from "./math";
import type { Perks } from "./types";

const SURNAMES = [
  "Ferrer",
  "Hollis",
  "Doyle",
  "Marsh",
  "Kane",
  "Sabbatini",
  "Wren",
  "Ludlow",
  "Cato",
  "Vane",
  "Rourke",
  "Bishop",
  "Teach",
  "Calloway",
  "Sharpe",
  "Ordonez",
];

const RANK = ["Capt.", "Lt.", "Sgt.", "Bosun", "Quartermaster"];

export function makeDrawer<T>(pool: readonly T[]): () => T {
  const bag = [...pool];
  return () => {
    if (bag.length === 0) bag.push(...pool);
    const i = Math.floor(Math.random() * bag.length);
    return bag.splice(i, 1)[0];
  };
}

export function makeSurnameDrawer() {
  return makeDrawer(SURNAMES);
}

export function officerName(surname: string): string {
  return `${pick(RANK)} ${surname}`;
}

export function squadName(surname: string): string {
  return `${surname}'s band`;
}

export function statWord(v: number): string {
  if (v >= 78) return "superb";
  if (v >= 62) return "good";
  if (v >= 45) return "fair";
  if (v >= 30) return "poor";
  return "wretched";
}

export function perkList(p: Perks): string[] {
  const out: string[] = [];
  if (p.deadEye) out.push("Dead-eye");
  if (p.cutthroat) out.push("Cutthroat");
  if (p.ironWill) out.push("Iron Will");
  if (p.oldSalt) out.push("Old Salt");
  return out;
}
