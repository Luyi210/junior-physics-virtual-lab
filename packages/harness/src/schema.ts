import type {
  HarnessArea,
  HarnessDialogueMessage,
  HarnessEvent,
  HarnessEventType,
  HarnessInsight,
  HarnessObservation,
  HarnessSession,
  HarnessValue
} from "./types";

export interface HarnessValidationError {
  path: string;
  message: string;
}

export type HarnessValidationResult =
  | { valid: true; value: HarnessSession }
  | { valid: false; errors: HarnessValidationError[] };

const areas = new Set<HarnessArea>(["optics", "lens", "sound", "mechanics", "circuit", "thermal", "measurement"]);
const eventTypes = new Set<HarnessEventType>([
  "module.entered",
  "control.changed",
  "simulation.toggled",
  "configuration.changed",
  "scene.navigated",
  "view.changed",
  "observation.created",
  "insight.read",
  "dialogue.asked"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isHarnessValue(value: unknown): value is HarnessValue {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function pushString(errors: HarnessValidationError[], value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) errors.push({ path, message: "必须是非空字符串" });
}

function validateEvent(value: unknown, path: string, errors: HarnessValidationError[]): value is HarnessEvent {
  if (!isRecord(value)) {
    errors.push({ path, message: "必须是事件对象" });
    return false;
  }
  pushString(errors, value.id, `${path}.id`);
  pushString(errors, value.sessionId, `${path}.sessionId`);
  if (!areas.has(value.area as HarnessArea)) errors.push({ path: `${path}.area`, message: "未知物理领域" });
  if (!eventTypes.has(value.type as HarnessEventType)) errors.push({ path: `${path}.type`, message: "未知事件类型" });
  if (!isDateString(value.occurredAt)) errors.push({ path: `${path}.occurredAt`, message: "必须是有效时间" });
  if (!isRecord(value.payload) || Object.values(value.payload).some((item) => !isHarnessValue(item))) {
    errors.push({ path: `${path}.payload`, message: "事件参数只能包含字符串、数字、布尔值或 null" });
  }
  return true;
}

function validateObservation(value: unknown, path: string, errors: HarnessValidationError[]): value is HarnessObservation {
  if (!isRecord(value)) {
    errors.push({ path, message: "必须是观察记录对象" });
    return false;
  }
  pushString(errors, value.id, `${path}.id`);
  pushString(errors, value.text, `${path}.text`);
  if (!isDateString(value.createdAt)) errors.push({ path: `${path}.createdAt`, message: "必须是有效时间" });
  if (!areas.has(value.area as HarnessArea)) errors.push({ path: `${path}.area`, message: "未知物理领域" });
  if (value.relatedEventId !== undefined && typeof value.relatedEventId !== "string") errors.push({ path: `${path}.relatedEventId`, message: "必须是字符串" });
  return true;
}

function validateInsight(value: unknown, path: string, errors: HarnessValidationError[]): value is HarnessInsight {
  if (!isRecord(value)) {
    errors.push({ path, message: "必须是提示对象" });
    return false;
  }
  ["id", "ruleId", "title", "message", "relatedEventId"].forEach((key) => pushString(errors, value[key], `${path}.${key}`));
  if (!["orientation", "question", "method", "connection"].includes(String(value.kind))) errors.push({ path: `${path}.kind`, message: "未知提示类型" });
  if (!isDateString(value.createdAt)) errors.push({ path: `${path}.createdAt`, message: "必须是有效时间" });
  if (typeof value.read !== "boolean") errors.push({ path: `${path}.read`, message: "必须是布尔值" });
  return true;
}

function validateDialogue(value: unknown, path: string, errors: HarnessValidationError[]): value is HarnessDialogueMessage {
  if (!isRecord(value)) {
    errors.push({ path, message: "必须是对话消息对象" });
    return false;
  }
  ["id", "text", "module"].forEach((key) => pushString(errors, value[key], `${path}.${key}`));
  if (!["learner", "assistant"].includes(String(value.role))) errors.push({ path: `${path}.role`, message: "未知对话角色" });
  if (!isDateString(value.createdAt)) errors.push({ path: `${path}.createdAt`, message: "必须是有效时间" });
  if (value.followUps !== undefined && (!Array.isArray(value.followUps) || value.followUps.some((item) => typeof item !== "string"))) {
    errors.push({ path: `${path}.followUps`, message: "追问建议必须是字符串数组" });
  }
  return true;
}

/**
 * Repairs the only supported legacy shape: early local sessions without an
 * explicit schemaVersion or optional arrays. It never mutates the stored value.
 */
export function migrateHarnessSession(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    schemaVersion: value.schemaVersion ?? 1,
    events: Array.isArray(value.events) ? value.events : [],
    observations: Array.isArray(value.observations) ? value.observations : [],
    insights: Array.isArray(value.insights) ? value.insights : []
  };
}

export function validateHarnessSession(input: unknown): HarnessValidationResult {
  const value = migrateHarnessSession(input);
  const errors: HarnessValidationError[] = [];
  if (!isRecord(value)) return { valid: false, errors: [{ path: "$", message: "学习会话必须是对象" }] };

  pushString(errors, value.id, "$.id");
  pushString(errors, value.learnerId, "$.learnerId");
  if (value.schemaVersion !== 1) errors.push({ path: "$.schemaVersion", message: "当前仅支持版本 1" });
  if (!areas.has(value.area as HarnessArea)) errors.push({ path: "$.area", message: "未知物理领域" });
  if (!isDateString(value.startedAt)) errors.push({ path: "$.startedAt", message: "必须是有效时间" });
  if (!isDateString(value.updatedAt)) errors.push({ path: "$.updatedAt", message: "必须是有效时间" });

  if (!Array.isArray(value.events)) errors.push({ path: "$.events", message: "必须是数组" });
  else value.events.forEach((item, index) => validateEvent(item, `$.events[${index}]`, errors));
  if (!Array.isArray(value.observations)) errors.push({ path: "$.observations", message: "必须是数组" });
  else value.observations.forEach((item, index) => validateObservation(item, `$.observations[${index}]`, errors));
  if (!Array.isArray(value.insights)) errors.push({ path: "$.insights", message: "必须是数组" });
  else value.insights.forEach((item, index) => validateInsight(item, `$.insights[${index}]`, errors));
  if (value.dialogue !== undefined) {
    if (!Array.isArray(value.dialogue)) errors.push({ path: "$.dialogue", message: "必须是数组" });
    else value.dialogue.forEach((item, index) => validateDialogue(item, `$.dialogue[${index}]`, errors));
  }

  return errors.length ? { valid: false, errors } : { valid: true, value: value as unknown as HarnessSession };
}

export function parseHarnessSession(input: unknown): HarnessSession | undefined {
  const result = validateHarnessSession(input);
  return result.valid ? result.value : undefined;
}
