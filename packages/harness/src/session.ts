import type { HarnessArea, HarnessEvent, HarnessEventInput, HarnessObservation, HarnessSession } from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createHarnessSession(area: HarnessArea, learnerId = "local-learner", now = new Date().toISOString()): HarnessSession {
  return {
    id: `harness-${learnerId}-${area}`,
    schemaVersion: 1,
    learnerId,
    area,
    startedAt: now,
    updatedAt: now,
    events: [],
    observations: [],
    insights: []
  };
}

export function appendHarnessEvent(session: HarnessSession, input: HarnessEventInput): { session: HarnessSession; event: HarnessEvent } {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const event: HarnessEvent = {
    id: createId("event"),
    sessionId: session.id,
    area: session.area,
    type: input.type,
    occurredAt,
    payload: input.payload ?? {}
  };
  return {
    event,
    session: { ...session, updatedAt: occurredAt, events: [...session.events, event] }
  };
}

export function appendObservation(session: HarnessSession, text: string, now = new Date().toISOString()): { session: HarnessSession; observation: HarnessObservation } {
  const observation: HarnessObservation = {
    id: createId("observation"),
    text: text.trim(),
    createdAt: now,
    area: session.area,
    relatedEventId: session.events.at(-1)?.id
  };
  return {
    observation,
    session: { ...session, updatedAt: now, observations: [...session.observations, observation] }
  };
}
