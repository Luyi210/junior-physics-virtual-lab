import type { LiliChatReply, LiliChatRequest } from "@physics-lab/contracts";
import { isCurrentHighSchoolRecordScope, type HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { studentApi } from "../../../data/teacherApi";

export function canRequestLiliNetwork(scope: HighSchoolRecordScope) {
  return scope.key !== null && scope.mode === "account" && scope.authChannel === "student" && scope.canWrite;
}

type Dependencies = {
  isCurrent: (scope: HighSchoolRecordScope) => boolean;
  ask: (request: LiliChatRequest, signal: AbortSignal) => Promise<LiliChatReply>;
};
/** Route by the selected archive, never by a leftover login token in another channel. */
export async function requestLiliForScope(input: {
  scope: HighSchoolRecordScope;
  request: LiliChatRequest;
  signal: AbortSignal;
  localReply: LiliChatReply;
}, dependencies: Dependencies = { isCurrent: isCurrentHighSchoolRecordScope, ask: studentApi.askLili }) {
  const assertCurrent = () => {
    if (input.signal.aborted || !dependencies.isCurrent(input.scope)) throw new Error("档案身份已变化，已停止本次提问。");
  };
  assertCurrent();
  if (!canRequestLiliNetwork(input.scope)) return input.localReply;
  const reply = await dependencies.ask(input.request, input.signal);
  assertCurrent();
  if (!reply || typeof reply.text !== "string" || !reply.text.trim()
    || !["ai", "guided"].includes(reply.mode) || !Array.isArray(reply.sources) || !Array.isArray(reply.suggestions)
    || reply.sources.some(source => !source || typeof source.title !== "string" || typeof source.url !== "string")
    || reply.suggestions.some(question => typeof question !== "string")) {
    throw new Error("回复内容不完整，改用本地实验引导。");
  }
  return reply;
}
