import { describe, expect, it, vi } from "vitest";
import { createLiliGuidance } from "@physics-lab/harness/lili";
import type { HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { requestLiliForScope } from "./liliRequest";

const student: HighSchoolRecordScope = { key: "account:school:student:a", mode: "account", label: "学生A", canWrite: true, authChannel: "student", revision: 1 };
const localReply = createLiliGuidance("怎样控制变量？", null);
const request = { conversationId: "scope-test", question: "怎样控制变量？", context: null };
function input(scope = student, signal = new AbortController().signal) { return { scope, request, signal, localReply }; }

describe("Lili follows the selected archive identity", () => {
  it.each([
    undefined,
    { text: "", mode: "ai", sources: [], suggestions: [] },
    { text: "   ", mode: "ai", sources: [], suggestions: [] },
    { text: "不完整的回复", mode: "ai" },
    { text: "不完整的来源", mode: "ai", sources: [null], suggestions: [] },
    { text: "不完整的建议", mode: "ai", sources: [], suggestions: [null] },
  ])("rejects malformed upstream content so the conversation can provide its local answer: %j", async reply => {
    await expect(requestLiliForScope(input(), { isCurrent: () => true, ask: vi.fn().mockResolvedValue(reply) })).rejects.toThrow("回复内容不完整");
  });

  it.each([
    { ...student, key: "guest", mode: "guest" as const, authChannel: null },
    { ...student, key: "demo", mode: "demo" as const, authChannel: null },
    { ...student, key: "teacher:a", authChannel: "teacher" as const },
    { ...student, canWrite: false },
  ])("keeps $key locally guided even if a student token remains in storage", async (scope) => {
    const ask = vi.fn();
    expect(await requestLiliForScope(input(scope), { isCurrent: () => true, ask })).toBe(localReply);
    expect(ask).not.toHaveBeenCalled();
  });

  it("sends only the selected current student's request and signal", async () => {
    const reply = { ...localReply, text: "当前学生的回复" };
    const ask = vi.fn().mockResolvedValue(reply);
    const captured = input();
    expect(await requestLiliForScope(captured, { isCurrent: () => true, ask })).toBe(reply);
    expect(ask).toHaveBeenCalledOnce();
    expect(ask).toHaveBeenCalledWith(request, captured.signal);
  });

  it("rejects a stale or unselected archive before any request", async () => {
    const ask = vi.fn();
    await expect(requestLiliForScope(input(), { isCurrent: () => false, ask })).rejects.toThrow("档案身份已变化");
    expect(ask).not.toHaveBeenCalled();
  });

  it("discards a completed reply when the user changed while waiting", async () => {
    let current = true;
    const ask = vi.fn(async () => { current = false; return localReply; });
    await expect(requestLiliForScope(input(), { isCurrent: () => current, ask })).rejects.toThrow("档案身份已变化");
  });

  it("discards an aborted request even if the upstream ignores the abort signal", async () => {
    const controller = new AbortController();
    const ask = vi.fn(async () => { controller.abort(); return localReply; });
    await expect(requestLiliForScope(input(student, controller.signal), { isCurrent: () => true, ask })).rejects.toThrow("已停止");
  });
});
