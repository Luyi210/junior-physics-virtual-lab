export type ExperimentKind =
  | "lens"
  | "circuit"
  | "balance"
  | "density"
  | "lever"
  | "friction"
  | "boiling";

export interface ExperimentProject<TState = unknown> {
  id: string;
  title: string;
  kind: ExperimentKind;
  schemaVersion: 1;
  state: TState;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentRecord<TValues = Record<string, number | string>> {
  id: string;
  projectId: string;
  capturedAt: string;
  values: TValues;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}
