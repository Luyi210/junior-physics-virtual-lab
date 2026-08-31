import type { HarnessApparatusContext, HarnessApparatusSnapshot } from "@physics-lab/harness";

export type TutorialModule = "dispersion";

export type TutorialTarget =
  | "experiment"
  | "source"
  | "light-picker"
  | "prism"
  | "screen"
  | "screen-distance"
  | "result";

export interface DispersionTutorialState {
  prismAngle: number;
  screenDistance: number;
  slitWidth: number;
  lightMode: "white" | "red" | "green" | "blue" | "rgb";
  sourceOn: boolean;
}

export type TutorialCommand =
  | { type: "widget_setState"; module: TutorialModule; state: Partial<DispersionTutorialState> }
  | { type: "widget_highlight"; module: TutorialModule; target: TutorialTarget }
  | { type: "widget_clearHighlight"; module: TutorialModule };

export interface ExperimentSnapshot {
  module: TutorialModule;
  state: DispersionTutorialState;
  origin: "learner" | "tutorial";
}

const commandEvent = "physics-lab:tutorial-command";
const snapshotEvent = "physics-lab:experiment-snapshot";
const apparatusSnapshotEvent = "physics-lab:apparatus-snapshot";
let latestSnapshot: ExperimentSnapshot | undefined;
const apparatusHistory = new Map<string, HarnessApparatusContext>();
const apparatusSnapshotSources = new Map<string, "explicit" | "dom">();

export function dispatchTutorialCommand(command: TutorialCommand) {
  window.dispatchEvent(new CustomEvent<TutorialCommand>(commandEvent, { detail: command }));
}

export function subscribeTutorialCommands(listener: (command: TutorialCommand) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<TutorialCommand>).detail);
  window.addEventListener(commandEvent, handler);
  return () => window.removeEventListener(commandEvent, handler);
}

export function publishExperimentSnapshot(snapshot: ExperimentSnapshot) {
  latestSnapshot = snapshot;
  window.dispatchEvent(new CustomEvent<ExperimentSnapshot>(snapshotEvent, { detail: snapshot }));
}

export function getLatestExperimentSnapshot(module: TutorialModule) {
  return latestSnapshot?.module === module ? latestSnapshot : undefined;
}

export function subscribeExperimentSnapshots(listener: (snapshot: ExperimentSnapshot) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<ExperimentSnapshot>).detail);
  window.addEventListener(snapshotEvent, handler);
  return () => window.removeEventListener(snapshotEvent, handler);
}

function snapshotSignature(snapshot: HarnessApparatusSnapshot) {
  return JSON.stringify({
    module: snapshot.module,
    controls: snapshot.controls,
    apparatus: snapshot.apparatus,
    readings: snapshot.readings,
    derived: snapshot.derived,
    validity: snapshot.validity
  });
}

export function publishApparatusSnapshot(snapshot: HarnessApparatusSnapshot, source: "explicit" | "dom" = "explicit") {
  const existing = apparatusHistory.get(snapshot.module);
  if (existing && snapshotSignature(existing.current) === snapshotSignature(snapshot)) return;
  const context: HarnessApparatusContext = { previous: existing?.current, current: snapshot };
  apparatusHistory.set(snapshot.module, context);
  apparatusSnapshotSources.set(snapshot.module, source);
  window.dispatchEvent(new CustomEvent<HarnessApparatusContext>(apparatusSnapshotEvent, { detail: context }));
}

export function getApparatusContext(module: string) {
  return apparatusHistory.get(module);
}

export function subscribeApparatusSnapshots(listener: (context: HarnessApparatusContext) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<HarnessApparatusContext>).detail);
  window.addEventListener(apparatusSnapshotEvent, handler);
  return () => window.removeEventListener(apparatusSnapshotEvent, handler);
}

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function elementLabel(element: Element, fallback: string) {
  const explicit = element.getAttribute("aria-label") || element.getAttribute("data-label");
  if (explicit) return compactText(explicit).slice(0, 48);
  const label = element.closest("label");
  const named = label?.querySelector("b, span, small")?.textContent;
  return (compactText(named) || fallback).slice(0, 48);
}

function parseControlValue(input: HTMLInputElement | HTMLSelectElement) {
  if (input instanceof HTMLInputElement && input.type === "checkbox") return input.checked;
  const number = Number(input.value);
  return input instanceof HTMLInputElement && input.type === "range" && Number.isFinite(number) ? number : input.value;
}

function unitFromOutput(input: Element) {
  const output = input.closest("label")?.querySelector("output")?.textContent ?? "";
  return compactText(output).replace(/^[-+]?\d+(?:\.\d+)?\s*/, "").slice(0, 12) || undefined;
}

/**
 * 为尚未手写状态适配器的实验读取页面中的语义化控件和读数。
 * 显式状态适配器始终优先，因此精密实验不会被 DOM 快照覆盖。
 */
export function captureApparatusSnapshotFromDom(module: string, rootSelector: string) {
  if (apparatusSnapshotSources.get(module) === "explicit") return getApparatusContext(module);
  const root = document.querySelector(rootSelector);
  if (!root) return undefined;

  const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[type="range"], input[type="checkbox"], select')).slice(0, 12).map((input, index) => ({
    id: input.id || `control-${index}-${elementLabel(input, "实验条件")}`,
    label: elementLabel(input, `实验条件 ${index + 1}`),
    value: parseControlValue(input),
    unit: unitFromOutput(input),
    source: "control" as const
  }));

  const selectedButtons = Array.from(root.querySelectorAll<HTMLElement>('button.active, button.selected, button.source-active, button[aria-pressed="true"]')).slice(0, 8).map((button, index) => ({
    id: `selection-${index}-${compactText(button.textContent).slice(0, 20)}`,
    label: "当前选择",
    value: compactText(button.textContent).slice(0, 60),
    source: "apparatus" as const
  }));

  const readingSelectors = [
    ".law-readout", ".observation-output", ".science-result-cell", ".sound-readout",
    ".balance-status", ".circuit-live-readouts > div", ".concept-reading", ".density-result",
    ".lens-reading-strip article", ".lens-reading-strip > div", ".magnification-readout",
    ".celestial-readout", ".mirror-reading", ".instrument-view + div"
  ].join(",");
  const seen = new Set<string>();
  const readings = Array.from(root.querySelectorAll<HTMLElement>(readingSelectors)).map((element, index) => {
    const label = compactText(element.querySelector("span, small")?.textContent) || `装置读数 ${index + 1}`;
    const rawValue = compactText(element.querySelector("strong, output, b")?.textContent) || compactText(element.textContent);
    const key = `${label}|${rawValue}`;
    if (!rawValue || seen.has(key)) return undefined;
    seen.add(key);
    return { id: `reading-${index}-${label.slice(0, 18)}`, label: label.slice(0, 48), value: rawValue.slice(0, 120), source: "reading" as const };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 10);

  const cue = compactText(root.querySelector<HTMLElement>(".interaction-cue strong")?.textContent);
  const guidance = compactText(root.querySelector<HTMLElement>(".circuit-guidance strong, .balance-live-guidance strong")?.textContent);
  const awaitingCount = root.querySelectorAll(".awaiting-reading").length;
  const modelBoundary = compactText(root.querySelector<HTMLElement>(".concept-model-boundary")?.textContent);
  const issues = [guidance, cue].filter(Boolean).slice(0, 2);
  const existing = apparatusHistory.get(module);
  const snapshot: HarnessApparatusSnapshot = {
    module,
    capturedAt: new Date().toISOString(),
    origin: existing ? "learner" : "system",
    controls,
    apparatus: selectedButtons,
    readings,
    derived: modelBoundary ? [{ id: "model-boundary", label: "模型边界", value: modelBoundary, source: "model" }] : [],
    validity: { ready: readings.length > 0 && awaitingCount === 0, issues }
  };
  publishApparatusSnapshot(snapshot, "dom");
  return getApparatusContext(module);
}
