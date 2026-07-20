import { appendHarnessEvent, appendObservation } from "./session";
import type { HarnessEventInput, HarnessSession, LearningAssistant } from "./types";

export function processHarnessEvent(session: HarnessSession, input: HarnessEventInput, assistant: LearningAssistant): HarnessSession {
  const appended = appendHarnessEvent(session, input);
  const insights = assistant.respond(appended.session, appended.event);
  return { ...appended.session, insights: [...appended.session.insights, ...insights] };
}

export function createHarnessObservation(session: HarnessSession, text: string, assistant: LearningAssistant): HarnessSession {
  const appended = appendObservation(session, text);
  return processHarnessEvent(appended.session, {
    type: "observation.created",
    payload: { observationId: appended.observation.id, text: appended.observation.text },
    occurredAt: appended.observation.createdAt
  }, assistant);
}

export function markInsightRead(session: HarnessSession, insightId: string): HarnessSession {
  return {
    ...session,
    insights: session.insights.map((insight) => insight.id === insightId ? { ...insight, read: true } : insight)
  };
}
