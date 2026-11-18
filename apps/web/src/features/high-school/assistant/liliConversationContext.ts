import type { LiliDialogueTurn, LiliExperimentContext } from "@physics-lab/contracts";

type DialogueMessage = { id: string; role: "student" | "lili"; text: string; questionContext?: LiliExperimentContext | null; effectiveQuestion?: string };

/** Only completed pairs from this experiment leave the UI; abandoned questions are excluded. */
export function collectLiliRecentDialogue(messages: readonly DialogueMessage[], context: LiliExperimentContext | null): LiliDialogueTurn[] {
  const questions = new Map(messages.filter(message => message.role === "student").map(message => [message.id, message]));
  const result: LiliDialogueTurn[] = [];
  for (const message of messages) {
    if (message.role !== "lili" || (message.questionContext?.experimentId ?? null) !== (context?.experimentId ?? null)) continue;
    const question = questions.get(message.id.replace(/-reply$/u, ""));
    if (!question) continue;
    const questionText = (question.effectiveQuestion ?? question.text).trim().slice(0, 1600);
    const answer = message.text.trim().slice(0, 2400);
    if (questionText && answer) result.push({ experimentId: context?.experimentId ?? null, question: questionText, answer });
  }
  return result.slice(-3);
}

/** Context contains only the contract's JSON data; never retain mutable store references. */
export function captureLiliContext(context: LiliExperimentContext | null): LiliExperimentContext | null {
  return context === null ? null : JSON.parse(JSON.stringify(context)) as LiliExperimentContext;
}

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${fingerprint(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function liliContextChanged(captured: LiliExperimentContext | null, current: LiliExperimentContext | null): boolean {
  return fingerprint(captured) !== fingerprint(current);
}

type SecureRandom = Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">>;

/** randomUUID is absent on some LAN origins; getRandomValues remains usable there. */
export function createLiliConversationId(source: SecureRandom | undefined = globalThis.crypto): string | null {
  try { if (typeof source?.randomUUID === "function") return source.randomUUID(); } catch { /* Try the other secure browser primitive. */ }
  try {
    if (typeof source?.getRandomValues !== "function") return null;
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch { return null; }
}
