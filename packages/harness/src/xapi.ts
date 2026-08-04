import type { HarnessEvent, HarnessEventType, HarnessSession, HarnessValue } from "./types";

export interface XAPIStatement {
  actor: {
    objectType: "Agent";
    account: { homePage: string; name: string };
  };
  verb: {
    id: string;
    display: { "zh-CN": string; "en-US": string };
  };
  object: {
    objectType: "Activity";
    id: string;
    definition: {
      name: { "zh-CN": string };
      type: string;
    };
  };
  result?: {
    response?: string;
    extensions?: Record<string, Record<string, HarnessValue>>;
  };
  context: {
    extensions: Record<string, string>;
  };
  timestamp: string;
  version: "1.0.3";
}

const namespace = "https://junior-physics-lab.local/xapi";

const verbs: Record<HarnessEventType, XAPIStatement["verb"]> = {
  "module.entered": { id: "http://adlnet.gov/expapi/verbs/experienced", display: { "zh-CN": "进入了", "en-US": "experienced" } },
  "control.changed": { id: `${namespace}/verbs/adjusted`, display: { "zh-CN": "调节了", "en-US": "adjusted" } },
  "simulation.toggled": { id: "http://adlnet.gov/expapi/verbs/interacted", display: { "zh-CN": "操作了", "en-US": "interacted" } },
  "configuration.changed": { id: `${namespace}/verbs/configured`, display: { "zh-CN": "配置了", "en-US": "configured" } },
  "scene.navigated": { id: `${namespace}/verbs/navigated`, display: { "zh-CN": "观察了", "en-US": "navigated" } },
  "view.changed": { id: `${namespace}/verbs/viewed`, display: { "zh-CN": "切换视角查看了", "en-US": "viewed" } },
  "observation.created": { id: "http://adlnet.gov/expapi/verbs/commented", display: { "zh-CN": "记录了观察", "en-US": "commented" } },
  "insight.read": { id: "http://id.tincanapi.com/verb/viewed", display: { "zh-CN": "阅读了提示", "en-US": "viewed" } },
  "dialogue.asked": { id: "http://adlnet.gov/expapi/verbs/asked", display: { "zh-CN": "提出了问题", "en-US": "asked" } }
};

function activityId(area: string, module: string) {
  return `${namespace}/activities/${encodeURIComponent(area)}/${encodeURIComponent(module)}`;
}

function responseFor(event: HarnessEvent): string | undefined {
  if (event.type === "observation.created" && typeof event.payload.text === "string") return event.payload.text;
  if (event.type === "dialogue.asked" && typeof event.payload.question === "string") return event.payload.question;
  const control = typeof event.payload.control === "string" ? event.payload.control : undefined;
  const value = event.payload.value;
  const unit = typeof event.payload.unit === "string" ? ` ${event.payload.unit}` : "";
  if (control && value !== undefined && value !== null) return `${control}=${String(value)}${unit}`;
  return undefined;
}

export function harnessSessionToXAPIStatements(session: HarnessSession): XAPIStatement[] {
  let activeModule = `${session.area}-overview`;
  return [...session.events]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map((event) => {
      if (event.type === "module.entered" && typeof event.payload.module === "string") activeModule = event.payload.module;
      const response = responseFor(event);
      const result: XAPIStatement["result"] | undefined = response || Object.keys(event.payload).length
        ? {
            ...(response ? { response } : {}),
            ...(Object.keys(event.payload).length ? { extensions: { [`${namespace}/extensions/payload`]: event.payload } } : {})
          }
        : undefined;
      return {
        actor: { objectType: "Agent", account: { homePage: namespace, name: session.learnerId } },
        verb: verbs[event.type],
        object: {
          objectType: "Activity",
          id: activityId(session.area, activeModule),
          definition: {
            name: { "zh-CN": activeModule },
            type: "http://adlnet.gov/expapi/activities/simulation"
          }
        },
        ...(result ? { result } : {}),
        context: {
          extensions: {
            [`${namespace}/extensions/area`]: session.area,
            [`${namespace}/extensions/event-type`]: event.type,
            [`${namespace}/extensions/session-id`]: session.id
          }
        },
        timestamp: event.occurredAt,
        version: "1.0.3"
      };
    });
}

export function harnessSessionsToXAPIStatements(sessions: HarnessSession[]): XAPIStatement[] {
  return sessions.flatMap(harnessSessionToXAPIStatements).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
