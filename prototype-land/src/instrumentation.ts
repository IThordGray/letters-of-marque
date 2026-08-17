// Instrumentation (§12) for the individual-figure skirmish. Does the player win
// by breaking WILL (routs, flanks) or attrition (kills)? Do they command all
// their figures, or leave some idle? Owns the signal log too.

interface Metrics {
  routsCaused: number; // enemy figures broken by morale
  killsCaused: number; // enemy figures cut/shot down
  flanksLanded: number; // flank/rear hits the player landed
  commandsIssued: number; // move/attack orders the player gave
  rallyUses: number;
  playerLost: number;
  enemyLost: number;
  battleDurationMs: number;
  outcome: string;
}

const metrics: Metrics = {
  routsCaused: 0,
  killsCaused: 0,
  flanksLanded: 0,
  commandsIssued: 0,
  rallyUses: 0,
  playerLost: 0,
  enemyLost: 0,
  battleDurationMs: 0,
  outcome: "",
};

const SIGNAL_CAP = 200;
const signalLines: Array<{ t: number; text: string }> = [];
const listeners: Array<() => void> = [];

export function onSignal(fn: () => void) {
  listeners.push(fn);
}
export function signal(time: number, text: string) {
  signalLines.push({ t: time, text });
  if (signalLines.length > SIGNAL_CAP) signalLines.shift();
  for (const fn of listeners) fn();
}
export function getSignals() {
  return signalLines;
}
export function getMetrics() {
  return metrics;
}

export function countRout(side: "player" | "enemy") {
  if (side === "enemy") metrics.routsCaused++;
}
export function countKill(side: "player" | "enemy") {
  if (side === "enemy") metrics.killsCaused++;
}
export function countLost(side: "player" | "enemy") {
  if (side === "player") metrics.playerLost++;
  else metrics.enemyLost++;
}
export function countFlank(bySide: "player" | "enemy") {
  if (bySide === "player") metrics.flanksLanded++;
}
export function countCommand() {
  metrics.commandsIssued++;
}
export function countRally() {
  metrics.rallyUses++;
}

export function finalize(outcome: string, durationMs: number) {
  metrics.outcome = outcome;
  metrics.battleDurationMs = Math.round(durationMs);
}

export function exportJson() {
  const payload = { exportedAt: new Date().toISOString(), metrics, signalLog: signalLines };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letters-of-marque-land-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
