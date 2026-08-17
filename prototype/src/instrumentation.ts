// Instrumentation is required, not optional (§11). The playtest is a
// measurement. Everything the gate criteria care about is counted here, and
// the same module owns the signal log because interpretation events feed both.

export type InterpType =
  | "irons"
  | "defection"
  | "rejoin"
  | "disobey"
  | "comply-return"
  | "unnerved"
  | "rake"
  | "strike"
  | "cohesion-break"
  | "promote";

interface Metrics {
  // THE key failure signal: attempts to command a single ship inside a group.
  individualSelectAttempts: number;
  cameraRotations: number;
  cameraRotationsWindAligned: number;
  pauseCount: number;
  totalPausedMs: number;
  orderChangesByGroup: Record<string, number>;
  generalChaseUses: number;
  battleDurationMs: number;
  outcome: string;
  interpretationEvents: Record<InterpType, number>;
}

const metrics: Metrics = {
  individualSelectAttempts: 0,
  cameraRotations: 0,
  cameraRotationsWindAligned: 0,
  pauseCount: 0,
  totalPausedMs: 0,
  orderChangesByGroup: {},
  generalChaseUses: 0,
  battleDurationMs: 0,
  outcome: "",
  interpretationEvents: {
    irons: 0,
    defection: 0,
    rejoin: 0,
    disobey: 0,
    "comply-return": 0,
    unnerved: 0,
    rake: 0,
    strike: 0,
    "cohesion-break": 0,
    promote: 0,
  },
};

const SIGNAL_CAP = 200;
const signalLines: Array<{ t: number; text: string }> = [];
const listeners: Array<() => void> = [];

export function onSignal(fn: () => void) {
  listeners.push(fn);
}
function notify() {
  for (const fn of listeners) fn();
}

// Plain-language line for the scrolling signal panel.
export function signal(time: number, text: string) {
  signalLines.push({ t: time, text });
  if (signalLines.length > SIGNAL_CAP) signalLines.shift();
  notify();
}

// A visible interpretation event: logs a line AND increments the metric.
export function interp(time: number, type: InterpType, text: string) {
  metrics.interpretationEvents[type]++;
  signal(time, text);
}

export function getSignals() {
  return signalLines;
}
export function getMetrics() {
  return metrics;
}

// -- Counters ----------------------------------------------------------------
export function countIndividualAttempt() {
  metrics.individualSelectAttempts++;
}
export function countCameraRotation(windAligned: boolean) {
  metrics.cameraRotations++;
  if (windAligned) metrics.cameraRotationsWindAligned++;
}
export function countOrderChange(groupId: number) {
  const k = String(groupId);
  metrics.orderChangesByGroup[k] = (metrics.orderChangesByGroup[k] ?? 0) + 1;
}
export function countGeneralChase() {
  metrics.generalChaseUses++;
}

// -- Pause bookkeeping -------------------------------------------------------
let pausedSince = 0;
export function markPaused(nowMs: number) {
  metrics.pauseCount++;
  pausedSince = nowMs;
}
export function markResumed(nowMs: number) {
  if (pausedSince) metrics.totalPausedMs += nowMs - pausedSince;
  pausedSince = 0;
}

export function finalize(outcome: string, durationMs: number) {
  metrics.outcome = outcome;
  metrics.battleDurationMs = Math.round(durationMs);
}

// JSON download offered at battle end (§11).
export function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    metrics,
    signalLog: signalLines,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letters-of-marque-session-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
