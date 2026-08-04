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
let latestSnapshot: ExperimentSnapshot | undefined;

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
