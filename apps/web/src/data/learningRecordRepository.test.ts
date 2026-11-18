import type { LearningRecordContent, SaveLearningRecordRequest, SessionLearningRecord } from "@physics-lab/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLearningRecordRepository, recordContent } from "./learningRecordRepository";
import { TeacherApiError } from "./teacherApi";
import type { StudentRecordScope } from "./studentRecordScope";

const owner = "student-1";
const sessionId = "session-1";
function accountScope(changes: Partial<StudentRecordScope> = {}): StudentRecordScope {
  const value = { apiNamespace: "https://school.example.test/api", schoolId: "school-1", studentId: owner,
    mode: "account" as const, canWrite: true, label: "学生甲", revision: 1, ...changes };
  return Object.freeze({ ...value, key: `student:${encodeURIComponent(value.apiNamespace)}:${encodeURIComponent(value.schoolId!)}:${encodeURIComponent(value.studentId!)}` });
}
const scope = accountScope();
const blank: LearningRecordContent = { prediction: "", measurements: "", conclusion: "", question: "" };
const content = (text: string): LearningRecordContent => ({ ...blank, prediction: text });

function snapshot(revision = 0, input: LearningRecordContent = blank, mutation = `saved-${revision}`): SessionLearningRecord {
  return {
    session: {
      id: sessionId, schoolId: "school-1", taskId: "task-1", classId: "class-1", learnerId: owner, experimentId: "lens",
      status: "active", startedAt: "2026-11-10T05:00:00.000Z", updatedAt: "2026-11-10T05:00:00.000Z", completedAt: null
    },
    learnerName: "学生甲", taskTitle: "凸透镜实验", className: "八年级一班", lessonTitle: "凸透镜成像",
    record: revision ? { ...recordContent(input), sessionId, learnerId: owner, revision, lastMutationId: mutation, updatedAt: `2026-11-10T06:00:${String(revision).padStart(2, "0")}.000Z` } : null
  };
}

function acknowledgement(input: SaveLearningRecordRequest) {
  return snapshot(input.expectedRevision + 1, input, input.mutationId);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => { resolve = resolveValue; reject = rejectValue; });
  return { promise, resolve, reject };
}

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    entries, failReads: false, failWrites: false, failEnumeration: false,
    get length() { if (this.failEnumeration) throw new Error("enumeration blocked"); return entries.size; },
    key(index: number): string | null { if (this.failEnumeration) throw new Error("enumeration blocked"); return [...entries.keys()][index] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error("storage blocked"); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error("storage full"); entries.set(key, value); }
  };
}

function setup(storage = memoryStorage(), clientId = "tab-a", initialScope = scope) {
  let currentScope = initialScope;
  let nextMutation = 0;
  const save = vi.fn<(id: string, input: SaveLearningRecordRequest) => Promise<SessionLearningRecord>>();
  save.mockImplementation(async (_id, input) => acknowledgement(input));
  const repository = createLearningRecordRepository(storage, {
    saveLearningRecord: save
  }, () => `${clientId}-edit-${++nextMutation}`, clientId, (candidate, write = false) =>
    candidate.key === currentScope.key && candidate.revision === currentScope.revision && candidate.apiNamespace === currentScope.apiNamespace && candidate.schoolId === currentScope.schoolId && candidate.studentId === currentScope.studentId && (!write || currentScope.canWrite));
  repository.remember(initialScope, { ...snapshot(), session: { ...snapshot().session, learnerId: initialScope.studentId!, schoolId: initialScope.schoolId! } });
  return { repository, storage, save,
    getScope: () => currentScope,
    setScope: (next: StudentRecordScope) => { currentScope = next; },
    switchAccount: (id: string) => { currentScope = accountScope({ ...currentScope, studentId: id, revision: currentScope.revision + 1 }); return currentScope; }
  };
}

describe("learning record draft synchronization", () => {
  it("retains the same mutation after a network failure and retries it exactly", async () => {
    const { repository, save } = setup();
    save.mockRejectedValueOnce(new TypeError("offline"));
    const queued = repository.queue(scope, sessionId, content("我的预测"));
    await expect(repository.sync(scope, sessionId)).rejects.toThrow("offline");
    expect(repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    const result = await repository.sync(scope, sessionId);
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
    expect(result.record?.prediction).toBe("我的预测");
    expect(repository.read(scope, sessionId)?.pending).toBeNull();
  });

  it("preserves edits made during an acknowledgement and advances their base revision", async () => {
    const { repository, save } = setup();
    const first = deferred<SessionLearningRecord>();
    const second = deferred<SessionLearningRecord>();
    const secondStarted = deferred<SaveLearningRecordRequest>();
    save.mockImplementationOnce(() => first.promise).mockImplementationOnce((_id, input) => { secondStarted.resolve(input); return second.promise; });
    repository.queue(scope, sessionId, content("初始预测"));
    const syncing = repository.sync(scope, sessionId);
    const newer = repository.queue(scope, sessionId, content("结合观察后的预测"));
    first.resolve(acknowledgement(save.mock.calls[0][1]));
    const sentNext = await secondStarted.promise;
    expect(sentNext).toEqual({ ...newer.pending, expectedRevision: 1 });
    expect(repository.read(scope, sessionId)?.pending).toEqual(sentNext);
    second.resolve(acknowledgement(sentNext));
    const result = await syncing;
    expect(result.record).toMatchObject({ revision: 2, prediction: "结合观察后的预测" });
    expect(repository.read(scope, sessionId)?.pending).toBeNull();
  });

  it("reuses one in-flight promise for repeated sync calls", async () => {
    const { repository, save } = setup();
    const response = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => response.promise);
    repository.queue(scope, sessionId, content("预测"));
    const first = repository.sync(scope, sessionId);
    expect(repository.sync(scope, sessionId)).toBe(first);
    expect(save).toHaveBeenCalledTimes(1);
    response.resolve(acknowledgement(save.mock.calls[0][1]));
    await first;
  });

  it("does not send another account's pending draft", async () => {
    const { repository, storage, save, switchAccount } = setup();
    const queued = repository.queue(scope, sessionId, content("甲的草稿"));
    const before = [...storage.entries];
    const other = switchAccount("student-2");
    await expect(repository.sync(scope, sessionId)).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(save).not.toHaveBeenCalled();
    expect(() => repository.read(scope, sessionId)).toThrow("身份");
    expect([...storage.entries]).toEqual(before);
    expect(before.some(([, raw]) => raw === JSON.stringify(queued.pending))).toBe(true);
    expect(repository.read(other, sessionId)).toBeNull();
  });

  it("stops subsequent saves when the account changes during an in-flight save", async () => {
    const { repository, storage, save, switchAccount, setScope } = setup();
    const response = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => response.promise);
    repository.queue(scope, sessionId, content("第一稿"));
    const syncing = repository.sync(scope, sessionId);
    repository.queue(scope, sessionId, content("第二稿"));
    const before = [...storage.entries]; const other = switchAccount("student-2");
    response.resolve(acknowledgement(save.mock.calls[0][1]));
    await expect(syncing).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(save).toHaveBeenCalledTimes(1);
    expect([...storage.entries]).toEqual(before);
    expect(repository.read(other, sessionId)).toBeNull();
    const restored = accountScope({ revision: 3 }); setScope(restored);
    expect(repository.read(restored, sessionId)?.pending).toMatchObject({ prediction: "第二稿", expectedRevision: 0 });
    expect(repository.read(restored, sessionId)?.server.record).toBeNull();
  });

  it("retains the authored draft and original revision after a server conflict", async () => {
    const { repository, save } = setup();
    const queued = repository.queue(scope, sessionId, content("待核对的草稿"));
    save.mockRejectedValueOnce(new TeacherApiError(409, "RECORD_CONFLICT", "已有更新"));
    await expect(repository.sync(scope, sessionId)).rejects.toMatchObject({ status: 409 });
    repository.remember(scope, snapshot(3, content("另一页已保存")));
    expect(repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    expect(repository.read(scope, sessionId)?.server.record?.revision).toBe(3);
  });

  it("never rebases a new local edit onto an unrelated newer server revision", async () => {
    const { repository, save } = setup();
    const response = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => response.promise).mockRejectedValueOnce(new TeacherApiError(409, "RECORD_CONFLICT", "已有更新"));
    repository.queue(scope, sessionId, content("第一稿"));
    const syncing = repository.sync(scope, sessionId);
    repository.queue(scope, sessionId, content("我的新稿"));
    repository.remember(scope, snapshot(2, content("其他标签的新稿")));
    response.resolve(acknowledgement(save.mock.calls[0][1]));
    await expect(syncing).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
    expect(save.mock.calls[1][1].expectedRevision).toBe(1);
    expect(repository.read(scope, sessionId)).toMatchObject({ server: { record: { revision: 2 } }, pending: { prediction: "我的新稿", expectedRevision: 1 } });
  });
});

describe("monotonic server snapshots and separate tab drafts", () => {
  it("ignores delayed GET versions and active snapshots after completion", () => {
    const { repository } = setup();
    const latest = snapshot(2, content("最新记录"));
    latest.session.status = "completed";
    latest.session.completedAt = "2026-11-10T07:00:00.000Z";
    latest.session.updatedAt = latest.session.completedAt;
    repository.remember(scope, latest);
    const stale = snapshot(1, content("过期记录"));
    expect(repository.remember(scope, stale).server).toEqual(latest);
    expect(repository.remember(scope, snapshot(2, content("最新记录"))).server.session.status).toBe("completed");
  });

  it("merges completion independently from the record revision", () => {
    const { repository } = setup();
    repository.remember(scope, snapshot(3, content("最新文字")));
    const completed = snapshot(2, content("较早文字"));
    completed.session.status = "completed";
    completed.session.completedAt = "2026-11-10T07:00:00.000Z";
    completed.session.updatedAt = completed.session.completedAt;
    const result = repository.remember(scope, completed);
    expect(result.server).toMatchObject({ session: { status: "completed" }, record: { revision: 3, prediction: "最新文字" } });
  });

  it("returns the newer cached snapshot after a delayed save acknowledgement", async () => {
    const { repository, save } = setup();
    const response = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => response.promise);
    repository.queue(scope, sessionId, content("早先提交"));
    const syncing = repository.sync(scope, sessionId);
    const latest = snapshot(2, content("另一页之后保存"));
    latest.session.status = "completed";
    latest.session.completedAt = "2026-11-10T07:00:00.000Z";
    latest.session.updatedAt = latest.session.completedAt;
    repository.remember(scope, latest);
    response.resolve(acknowledgement(save.mock.calls[0][1]));
    await expect(syncing).resolves.toEqual(latest);
    expect(repository.read(scope, sessionId)?.server).toEqual(latest);
  });

  it("keeps two tabs' pending content separate and preserves the losing tab on conflict", async () => {
    const storage = memoryStorage();
    const first = setup(storage, "tab-a");
    const second = setup(storage, "tab-b");
    const a = first.repository.queue(scope, sessionId, content("A 标签草稿"));
    const b = second.repository.queue(scope, sessionId, content("B 标签草稿"));
    expect(first.repository.read(scope, sessionId)?.pending).toEqual(a.pending);
    expect(second.repository.read(scope, sessionId)?.pending).toEqual(b.pending);
    await first.repository.sync(scope, sessionId);
    expect(first.save.mock.calls[0][1].prediction).toBe("A 标签草稿");
    expect(second.repository.read(scope, sessionId)?.pending).toEqual(b.pending);
    expect(second.repository.read(scope, sessionId)?.server.record?.prediction).toBe("A 标签草稿");
    second.save.mockRejectedValueOnce(new TeacherApiError(409, "RECORD_CONFLICT", "已有更新"));
    await expect(second.repository.sync(scope, sessionId)).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
    expect(second.save.mock.calls[0][1]).toEqual(b.pending);
    expect(second.repository.read(scope, sessionId)?.pending).toEqual(b.pending);
    expect(first.repository.read(scope, sessionId)?.pending).toBeNull();
    second.repository.useServer(scope, sessionId);
    expect(second.repository.read(scope, sessionId)?.pending).toBeNull();
  });

  it("restores the same tab draft after creating a new repository, without adopting another tab's draft", () => {
    const first = setup();
    const queued = first.repository.queue(scope, sessionId, content("刷新前草稿"));
    const restored = setup(first.storage, "tab-a");
    const another = setup(first.storage, "tab-b");
    expect(restored.repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    expect(another.repository.read(scope, sessionId)?.pending).toBeNull();
    another.repository.useServer(scope, sessionId);
    expect(restored.repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
  });

  it("bases the first edit on the revision displayed in that tab, not an unseen shared update", async () => {
    const storage = memoryStorage();
    const first = setup(storage, "tab-a");
    const displayed = first.repository.remember(scope, snapshot(1, content("A 页已看到的版本")));
    const second = setup(storage, "tab-b");
    second.repository.queue(scope, sessionId, content("B 页后来保存的版本"));
    await second.repository.sync(scope, sessionId);
    expect(first.repository.read(scope, sessionId)?.server.record?.revision).toBe(2);
    const queued = first.repository.queue(scope, sessionId, content("A 基于旧画面写的新稿"), false, displayed.server.record?.revision ?? 0);
    expect(queued.pending.expectedRevision).toBe(1);
    first.save.mockRejectedValueOnce(new TeacherApiError(409, "RECORD_CONFLICT", "已有更新"));
    await expect(first.repository.sync(scope, sessionId)).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
    expect(first.save.mock.calls[0][1].expectedRevision).toBe(1);
    expect(first.repository.read(scope, sessionId)).toMatchObject({ server: { record: { revision: 2 } }, pending: queued.pending });
    expect(second.repository.read(scope, sessionId)?.pending).toBeNull();
  });
});

describe("cache integrity and storage failures", () => {
  it("distinguishes corrupt JSON, invalid contents and mismatched identity from an absent cache", () => {
    const { repository, storage } = setup();
    const serverKey = [...storage.entries.keys()][0];
    const invalid = ["{", "null", "[]", JSON.stringify({ session: { id: sessionId, learnerId: owner } }), JSON.stringify({ ...snapshot(), record: { prediction: 123 } }), JSON.stringify({ ...snapshot(), session: { ...snapshot().session, learnerId: "another-student" } })];
    for (const raw of invalid) {
      storage.entries.set(serverKey, raw);
      expect(() => repository.read(scope, sessionId)).toThrow();
      expect(storage.entries.get(serverKey)).toBe(raw);
    }
  });

  it("reports corrupt pending data and blocked storage reads instead of treating them as no draft", () => {
    const { repository, storage } = setup();
    repository.queue(scope, sessionId, content("草稿"));
    const draftKey = [...storage.entries.keys()].find((key) => key.includes(":draft:"))!;
    storage.entries.set(draftKey, JSON.stringify({ prediction: "不完整" }));
    expect(() => repository.read(scope, sessionId)).toThrow("不完整");
    storage.failReads = true;
    expect(() => repository.read(scope, sessionId)).toThrow("无法读取");
  });

  it("rejects a failed local draft write instead of reporting that it was saved", () => {
    const { repository, storage } = setup();
    storage.failWrites = true;
    expect(() => repository.queue(scope, sessionId, content("尚未持久化"))).toThrow("storage full");
    expect(repository.read(scope, sessionId)?.pending).toBeNull();
  });

  it("rejects an acknowledgement cache failure and retains the mutation for retry", async () => {
    const { repository, storage, save } = setup();
    const response = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => response.promise);
    const queued = repository.queue(scope, sessionId, content("需要可靠保存"));
    const syncing = repository.sync(scope, sessionId);
    storage.failWrites = true;
    response.resolve(acknowledgement(save.mock.calls[0][1]));
    await expect(syncing).rejects.toThrow("storage full");
    expect(repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    storage.failWrites = false;
    await repository.sync(scope, sessionId);
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
    expect(repository.read(scope, sessionId)?.pending).toBeNull();
  });

  it("does not clear a draft on a mismatched server acknowledgement", async () => {
    const { repository, save } = setup();
    const queued = repository.queue(scope, sessionId, content("本人内容"));
    save.mockResolvedValueOnce(snapshot(1, content("错误内容"), "different-mutation"));
    await expect(repository.sync(scope, sessionId)).rejects.toThrow("不匹配");
    expect(repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    expect(repository.read(scope, sessionId)?.server.record).toBeNull();
  });

  it("retains retryable pending content if clearing it fails after the server snapshot was cached", async () => {
    const { repository, storage, save } = setup();
    const queued = repository.queue(scope, sessionId, content("已经到达后台的内容"));
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key.includes(":draft:") && value === "null") throw new Error("draft cleanup blocked");
      originalSetItem(key, value);
    };
    await expect(repository.sync(scope, sessionId)).rejects.toThrow("draft cleanup blocked");
    expect(repository.read(scope, sessionId)).toMatchObject({ server: { record: { revision: 1 } }, pending: queued.pending });
    storage.setItem = originalSetItem;
    await repository.sync(scope, sessionId);
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
    expect(repository.read(scope, sessionId)?.pending).toBeNull();
  });
});

describe("v3 backend, school and immutable student scope boundaries", () => {
  it.each([
    accountScope({ apiNamespace: "https://other-backend.example.test/api" }),
    accountScope({ schoolId: "other-school" }),
    accountScope({ studentId: "other-student" })
  ])("separates identical session ids for scope $key", (otherScope) => {
    const storage = memoryStorage();
    const first = setup(storage); const other = setup(storage, "tab-a", otherScope);
    const own = first.repository.queue(scope, sessionId, content("甲的草稿"));
    const foreign = other.repository.queue(otherScope, sessionId, content("其他身份草稿"));
    expect(first.repository.read(scope, sessionId)?.pending).toEqual(own.pending);
    expect(other.repository.read(otherScope, sessionId)?.pending).toEqual(foreign.pending);
    expect([...storage.entries.keys()].filter((key) => key.includes(":draft:")).length).toBe(2);
    expect([...storage.entries.keys()].every((key) => key.startsWith("physics-learning-record-v3:"))).toBe(true);
  });

  it("never reads, adopts, migrates or removes unscoped v2 server data and drafts", () => {
    const storage = memoryStorage();
    const oldServer = `physics-learning-record-v2:${owner}:${sessionId}`;
    const oldDraft = `${oldServer}:draft:tab-a`;
    storage.entries.set(oldServer, JSON.stringify(snapshot(5, content("来源不明的旧后台正文"))));
    storage.entries.set(oldDraft, JSON.stringify({ ...content("来源不明旧草稿"), expectedRevision: 5, mutationId: "old" }));
    const get = vi.spyOn(storage, "getItem");
    const { repository } = setup(storage);
    expect(repository.read(scope, sessionId)).toMatchObject({ server: { record: null }, pending: null });
    expect(repository.listDrafts(scope, sessionId)).toEqual([]);
    expect(get.mock.calls.some(([key]) => key.startsWith("physics-learning-record-v2:"))).toBe(false);
    expect(storage.entries.get(oldServer)).toBe(JSON.stringify(snapshot(5, content("来源不明的旧后台正文"))));
    expect(storage.entries.get(oldDraft)).toContain("来源不明旧草稿");
  });

  it("rejects wrong school server snapshots and acknowledgements without changing cached data", async () => {
    const { repository, storage, save } = setup();
    const foreign = { ...snapshot(), session: { ...snapshot().session, schoolId: "other-school" } };
    expect(() => repository.remember(scope, foreign)).toThrow("其他学校");
    const queued = repository.queue(scope, sessionId, content("本人草稿")); const before = [...storage.entries];
    save.mockImplementationOnce(async (_id, input) => ({ ...acknowledgement(input), session: foreign.session }));
    await expect(repository.sync(scope, sessionId)).rejects.toThrow("不匹配");
    expect([...storage.entries]).toEqual(before); expect(repository.read(scope, sessionId)?.pending).toEqual(queued.pending);
    const serverKey = [...storage.entries.keys()].find((key) => !key.includes(":draft:"))!;
    storage.entries.set(serverKey, JSON.stringify(foreign));
    expect(() => repository.read(scope, sessionId)).toThrow("身份");
  });

  it.each([
    accountScope({ revision: 2 }),
    accountScope({ schoolId: "other-school", revision: 2 }),
    accountScope({ apiNamespace: "https://other-backend.example.test/api", revision: 2 }),
    accountScope({ canWrite: false, revision: 2 })
  ])("does not clear a single pending draft after an ACK returns to changed scope $key, revision $revision", async (nextScope) => {
    const { repository, storage, save, setScope } = setup();
    const response = deferred<SessionLearningRecord>(); save.mockImplementationOnce(() => response.promise);
    const queued = repository.queue(scope, sessionId, content("待保存内容")); const before = [...storage.entries];
    const flight = repository.sync(scope, sessionId); setScope(nextScope);
    response.resolve(acknowledgement(queued.pending));
    await expect(flight).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect([...storage.entries]).toEqual(before); expect(save).toHaveBeenCalledTimes(1);
    if (nextScope.key === scope.key) expect(repository.read(nextScope, sessionId)?.pending).toEqual(queued.pending);
  });

  it("uses a new flight after token renewal, retries the original mutation and ignores the earlier ACK", async () => {
    const { repository, storage, save, setScope } = setup();
    const oldReply = deferred<SessionLearningRecord>(); const newReply = deferred<SessionLearningRecord>();
    save.mockImplementationOnce(() => oldReply.promise).mockImplementationOnce(() => newReply.promise);
    const queued = repository.queue(scope, sessionId, content("同一份原始草稿"));
    const oldFlight = repository.sync(scope, sessionId); const renewed = accountScope({ revision: 2 }); setScope(renewed);
    const newFlight = repository.sync(renewed, sessionId);
    expect(newFlight).not.toBe(oldFlight); expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
    const before = [...storage.entries]; oldReply.resolve(acknowledgement(queued.pending));
    await expect(oldFlight).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" }); expect([...storage.entries]).toEqual(before);
    newReply.resolve(acknowledgement(queued.pending)); await newFlight;
    expect(repository.read(renewed, sessionId)).toMatchObject({ server: { record: { revision: 1 } }, pending: null });
  });

  it("allows an expired current identity to read/export drafts but not mutate or transmit them", async () => {
    const { repository, storage, save, setScope } = setup();
    const queued = repository.queue(scope, sessionId, content("过期前草稿")); const before = [...storage.entries];
    const expired = accountScope({ revision: 2, canWrite: false }); setScope(expired);
    expect(repository.read(expired, sessionId)?.pending).toEqual(queued.pending);
    expect(repository.listDrafts(expired, sessionId)[0]?.raw).toBe(JSON.stringify(queued.pending));
    for (const action of [() => repository.remember(expired, snapshot()), () => repository.queue(expired, sessionId, content("新稿")), () => repository.useServer(expired, sessionId)]) {
      expect(action).toThrow("只读");
    }
    await expect(repository.sync(expired, sessionId)).rejects.toMatchObject({ code: "RECORD_READ_ONLY" });
    expect(save).not.toHaveBeenCalled(); expect([...storage.entries]).toEqual(before);
  });

  it("rejects old-scope remember, edits and conflict choices after a renewal", () => {
    const { repository, storage, setScope } = setup(); repository.queue(scope, sessionId, content("草稿"));
    const before = [...storage.entries]; setScope(accountScope({ revision: 2 }));
    for (const action of [() => repository.remember(scope, snapshot(3)), () => repository.queue(scope, sessionId, content("迟到编辑")), () => repository.useServer(scope, sessionId), () => repository.listDrafts(scope, sessionId)]) {
      expect(action).toThrow("身份");
    }
    expect([...storage.entries]).toEqual(before);
  });

  it("checks identity again immediately before writing a remembered response", () => {
    const { repository, storage, setScope } = setup(); const before = [...storage.entries];
    const get = storage.getItem.bind(storage);
    storage.getItem = (key) => { setScope(accountScope({ revision: 2 })); return get(key); };
    expect(() => repository.remember(scope, snapshot(1))).toThrow("身份");
    expect([...storage.entries]).toEqual(before);
  });

  it("does not grant write access when the factory's production guard cannot verify a synthetic scope", () => {
    const storage = memoryStorage();
    const repository = createLearningRecordRepository(storage, { saveLearningRecord: vi.fn() }, () => "mutation", "tab-a");
    expect(() => repository.remember(scope, snapshot())).toThrow("身份");
    expect(storage.entries.size).toBe(0);
  });
});

describe("read-only per-tab draft inventory", () => {
  it("lists current/other-tab pending and damaged bytes without joining other scopes, sessions or legacy data", () => {
    const storage = memoryStorage(); const first = setup(storage, "tab-a"); const other = setup(storage, "tab-b");
    const a = first.repository.queue(scope, sessionId, content("当前标签")); const b = other.repository.queue(scope, sessionId, content("另一个标签"));
    const otherScope = accountScope({ schoolId: "other-school" }); const foreign = setup(storage, "tab-c", otherScope);
    foreign.repository.queue(otherScope, sessionId, content("另一学校"));
    const ownPrefix = [...storage.entries.keys()].find((key) => key.endsWith(":draft:tab-a"))!.replace(/tab-a$/, "");
    storage.entries.set(`${ownPrefix}damaged`, "broken-json"); storage.entries.set(`${ownPrefix}cleared`, "null");
    storage.entries.set(`${ownPrefix}%`, JSON.stringify(a.pending));
    storage.entries.set(ownPrefix.replace(encodeURIComponent(sessionId), "other-session") + "tab-z", JSON.stringify(a.pending));
    storage.entries.set(`physics-learning-record-v2:${owner}:${sessionId}:draft:old`, JSON.stringify(a.pending));
    const before = [...storage.entries]; const drafts = first.repository.listDrafts(scope, sessionId);
    expect(drafts).toHaveLength(4);
    expect(drafts.find((entry) => entry.clientId === "tab-a")).toMatchObject({ isCurrentTab: true, valid: true, raw: JSON.stringify(a.pending), pending: a.pending });
    expect(drafts.find((entry) => entry.clientId === "tab-b")).toMatchObject({ isCurrentTab: false, valid: true, pending: b.pending });
    expect(drafts.find((entry) => entry.clientId === "damaged")).toMatchObject({ raw: "broken-json", valid: false, pending: null, error: expect.any(String) });
    expect(drafts.find((entry) => entry.clientId === "%")).toMatchObject({ raw: JSON.stringify(a.pending), valid: false, pending: null });
    expect([...storage.entries]).toEqual(before);
  });

  it("lists orphaned pending even with no server snapshot and never takes over or clears other tabs", () => {
    const storage = memoryStorage(); const first = setup(storage, "tab-a"); const other = setup(storage, "tab-b");
    first.repository.queue(scope, sessionId, content("当前标签")); const b = other.repository.queue(scope, sessionId, content("仍未同步"));
    first.repository.useServer(scope, sessionId);
    expect(first.repository.listDrafts(scope, sessionId)).toMatchObject([{ clientId: "tab-b", isCurrentTab: false, pending: b.pending }]);
    const serverKey = [...storage.entries.keys()].find((key) => !key.includes(":draft:"))!; storage.entries.delete(serverKey);
    expect(first.repository.read(scope, sessionId)).toBeNull();
    expect(first.repository.listDrafts(scope, sessionId)).toMatchObject([{ clientId: "tab-b", pending: b.pending }]);
  });

  it("throws on enumeration/entry read failure and on identity changes instead of returning an empty inventory", () => {
    const { repository, storage, setScope } = setup(); repository.queue(scope, sessionId, content("仍有草稿"));
    storage.failEnumeration = true; expect(() => repository.listDrafts(scope, sessionId)).toThrow("检查其他标签页");
    storage.failEnumeration = false; storage.failReads = true; expect(() => repository.listDrafts(scope, sessionId)).toThrow("无法读取");
    storage.failReads = false;
    const get = storage.getItem.bind(storage); storage.getItem = (key) => { setScope(accountScope({ revision: 2 })); return get(key); };
    expect(() => repository.listDrafts(scope, sessionId)).toThrow("身份");
  });

  it("preserves empty and non-canonical tab suffixes as invalid exports instead of treating them as this tab", () => {
    const { repository, storage } = setup(); const queued = repository.queue(scope, sessionId, content("草稿"));
    const prefix = [...storage.entries.keys()].find((key) => key.endsWith(":draft:tab-a"))!.replace(/tab-a$/, "");
    for (const suffix of ["", "%74ab-a", "%E6%a0%87%E7%AD%BE"]) storage.entries.set(prefix + suffix, JSON.stringify(queued.pending));
    const before = [...storage.entries]; const drafts = repository.listDrafts(scope, sessionId);
    expect(drafts.filter((entry) => entry.isCurrentTab)).toHaveLength(1);
    expect(drafts.filter((entry) => !entry.isCurrentTab)).toHaveLength(3);
    expect(drafts.filter((entry) => !entry.isCurrentTab).every((entry) => !entry.valid && entry.error && entry.raw === JSON.stringify(queued.pending))).toBe(true);
    expect([...storage.entries]).toEqual(before);
  });

  it("rejects incomplete key enumeration rather than reporting no drafts", () => {
    const { repository, storage } = setup(); repository.queue(scope, sessionId, content("待存"));
    storage.key = () => null;
    expect(() => repository.listDrafts(scope, sessionId)).toThrow("完整检查");
  });

  it.each(["added", "removed", "replaced"] as const)("rejects a %s storage entry during the inventory read", (change) => {
    const { repository, storage } = setup(); const queued = repository.queue(scope, sessionId, content("待存"));
    const draftKey = [...storage.entries.keys()].find((key) => key.includes(":draft:"))!;
    const get = storage.getItem.bind(storage); let changed = false;
    storage.getItem = (key) => {
      const raw = get(key);
      if (key === draftKey && !changed) {
        changed = true;
        if (change !== "added") storage.entries.delete(draftKey);
        if (change !== "removed") storage.entries.set(`${draftKey}-new-tab`, JSON.stringify(queued.pending));
      }
      return raw;
    };
    expect(() => repository.listDrafts(scope, sessionId)).toThrow("发生变化");
  });
});

describe("raw server cache backup", () => {
  it("exports valid, missing, malformed and wrong-school server bytes without repairing or overwriting them", () => {
    const { repository, storage } = setup();
    const serverKey = [...storage.entries.keys()][0];
    expect(repository.readServerCopy(scope, sessionId)).toEqual({ raw: JSON.stringify(snapshot()), valid: true });
    const wrongSchool = { ...snapshot(), session: { ...snapshot().session, schoolId: "foreign" } };
    for (const raw of ["", "broken json", "null", JSON.stringify(wrongSchool)]) {
      storage.entries.set(serverKey, raw); const before = [...storage.entries];
      expect(repository.readServerCopy(scope, sessionId)).toEqual({ raw, valid: false, error: expect.any(String) });
      expect(() => repository.remember(scope, snapshot())).toThrow();
      expect([...storage.entries]).toEqual(before);
    }
    storage.entries.delete(serverKey);
    expect(repository.readServerCopy(scope, sessionId)).toEqual({ raw: null, valid: true });
  });

  it("allows expired-scope backup but rejects stale scopes and unreadable storage", () => {
    const { repository, storage, setScope } = setup();
    const expired = accountScope({ revision: 2, canWrite: false }); setScope(expired);
    expect(repository.readServerCopy(expired, sessionId).valid).toBe(true);
    expect(() => repository.readServerCopy(scope, sessionId)).toThrow("身份");
    storage.failReads = true; expect(() => repository.readServerCopy(expired, sessionId)).toThrow("无法读取");
  });
});

describe("explicit atomic draft recovery", () => {
  it("preserves the selected draft's original CAS base instead of the newer cache or current draft base", async () => {
    const { repository, storage, save } = setup();
    repository.remember(scope, snapshot(5, content("服务器第五版")));
    const current = repository.queue(scope, sessionId, content("本页草稿"));
    const setItem = vi.spyOn(storage, "setItem");
    const restored = repository.restoreDraft(scope, sessionId, content("旧页第二版上的草稿"), 2);
    expect(restored.server.record?.revision).toBe(5);
    expect(restored.pending).toMatchObject({ prediction: "旧页第二版上的草稿", expectedRevision: 2 });
    expect(restored.pending?.mutationId).not.toBe(current.pending?.mutationId);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0][1]).toBe(JSON.stringify(restored.pending));
    save.mockRejectedValueOnce(new TeacherApiError(409, "RECORD_CONFLICT", "已有更新"));
    await expect(repository.sync(scope, sessionId)).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
    expect(save).toHaveBeenCalledWith(sessionId, restored.pending);
    expect(repository.read(scope, sessionId)?.pending).toEqual(restored.pending);
  });

  it("preserves the exact existing draft bytes when the one replacement write fails", () => {
    const { repository, storage } = setup();
    repository.queue(scope, sessionId, content("恢复前本页草稿"));
    const draftKey = [...storage.entries.keys()].find((key) => key.includes(":draft:"))!;
    // Even an invalid current copy is not cleared before an explicit replacement.
    storage.entries.set(draftKey, "{ 原文损坏但仍可导出 ");
    const before = [...storage.entries]; storage.failWrites = true;
    const setItem = vi.spyOn(storage, "setItem");
    expect(() => repository.restoreDraft(scope, sessionId, content("用户明确选择的另一稿"), 0)).toThrow("storage full");
    expect(setItem).toHaveBeenCalledTimes(1);
    expect([...storage.entries]).toEqual(before);
    expect(repository.listDrafts(scope, sessionId)[0].raw).toBe("{ 原文损坏但仍可导出 ");
  });

  it("accepts a blank draft at base zero and validates every field's saved-text limit", () => {
    const { repository, storage } = setup();
    const restored = repository.restoreDraft(scope, sessionId, blank, 0);
    expect(restored.pending).toMatchObject({ ...blank, expectedRevision: 0 });
    const limits = { prediction: 4000, measurements: 12000, conclusion: 8000, question: 4000 } as const;
    for (const field of Object.keys(limits) as Array<keyof typeof limits>) {
      repository.restoreDraft(scope, sessionId, { ...blank, [field]: "字".repeat(limits[field]) }, 0);
      const before = [...storage.entries];
      expect(() => repository.restoreDraft(scope, sessionId, { ...blank, [field]: "字".repeat(limits[field] + 1) }, 0)).toThrow("长度限制");
      expect([...storage.entries]).toEqual(before);
    }
  });

  it("rejects malformed content and unsafe bases without changing any original copies", () => {
    const { repository, storage } = setup(); repository.queue(scope, sessionId, content("现有草稿"));
    const before = [...storage.entries];
    for (const base of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0", null]) {
      expect(() => repository.restoreDraft(scope, sessionId, blank, base as number)).toThrow("版本号");
    }
    for (const candidate of [null, [], {}, { ...blank, question: 123 }, { ...blank, measurements: undefined }]) {
      expect(() => repository.restoreDraft(scope, sessionId, candidate as LearningRecordContent, 0)).toThrow("四段内容");
    }
    expect([...storage.entries]).toEqual(before);
  });

  it("requires a readable valid server cache without deleting an orphaned draft", () => {
    const { repository, storage } = setup(); repository.queue(scope, sessionId, content("仍需保留"));
    const serverKey = [...storage.entries.keys()].find((key) => !key.includes(":draft:"))!;
    storage.entries.delete(serverKey); let before = [...storage.entries];
    expect(() => repository.restoreDraft(scope, sessionId, blank, 0)).toThrow("先读取");
    expect([...storage.entries]).toEqual(before);
    storage.entries.set(serverKey, "invalid server copy"); before = [...storage.entries];
    expect(() => repository.restoreDraft(scope, sessionId, blank, 0)).toThrow("损坏");
    expect([...storage.entries]).toEqual(before);
    storage.failReads = true;
    expect(() => repository.restoreDraft(scope, sessionId, blank, 0)).toThrow("无法读取");
    expect([...storage.entries]).toEqual(before);
  });

  it("rechecks the current writable identity immediately before the restore write", () => {
    const { repository, storage, setScope } = setup(); repository.queue(scope, sessionId, content("原稿"));
    const before = [...storage.entries];
    const expired = accountScope({ revision: 2, canWrite: false }); setScope(expired);
    expect(() => repository.restoreDraft(expired, sessionId, blank, 0)).toThrow("只读");
    expect(() => repository.restoreDraft(scope, sessionId, blank, 0)).toThrow("身份");
    setScope(scope);
    const get = storage.getItem.bind(storage);
    storage.getItem = (key) => { const raw = get(key); setScope(accountScope({ revision: 3 })); return raw; };
    expect(() => repository.restoreDraft(scope, sessionId, blank, 0)).toThrow("身份");
    expect([...storage.entries]).toEqual(before);
  });

  it("rejects a completed session without changing its retained local draft", () => {
    const { repository, storage } = setup(); repository.queue(scope, sessionId, content("完成前遗留的草稿"));
    const completed = snapshot(2);
    completed.session.status = "completed"; completed.session.completedAt = completed.session.updatedAt;
    repository.remember(scope, completed); const before = [...storage.entries];
    expect(() => repository.restoreDraft(scope, sessionId, content("另一页原稿"), 1)).toThrow("已完成");
    expect([...storage.entries]).toEqual(before);
    expect(repository.listDrafts(scope, sessionId)[0].pending?.prediction).toBe("完成前遗留的草稿");
  });
});

describe("page lifetime singleton draft ownership", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let sessionStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
  let sessionValues: Map<string, string>;
  async function loadPage() {
    vi.resetModules();
    const module = await import("./learningRecordRepository");
    const { getStudentRecordScope } = await import("./studentRecordScope");
    const currentScope = getStudentRecordScope();
    expect(currentScope).toMatchObject({ mode: "account", canWrite: true, studentId: owner, schoolId: "school-1" });
    const repository = module.learningRecordRepository();
    expect(module.learningRecordRepository()).toBe(repository);
    return { repository, scope: currentScope };
  }
  beforeEach(() => {
    storage = memoryStorage();
    const payload = { sub: owner, schoolId: "school-1", role: "student", exp: Date.now() / 1000 + 3600 };
    const token = `${btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}.testsignature`;
    storage.entries.set("physics-lab-v2-api-student-token", token);
    sessionValues = new Map([["physics-learning-record-tab-id", "copied-tab-id"]]);
    sessionStorage = {
      getItem: vi.fn((key: string) => sessionValues.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { sessionValues.set(key, value); }),
      removeItem: vi.fn((key: string) => { sessionValues.delete(key); })
    };
    let generated = 0;
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++generated).padStart(12, "0")}`) });
    vi.stubGlobal("window", { localStorage: storage, sessionStorage, location: { origin: "https://frontend.example.test" } });
    vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", scope.apiNamespace);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

  it("keeps two actual module singletons separate even with the same copied sessionStorage tab id", async () => {
    const first = await loadPage(); first.repository.remember(first.scope, snapshot());
    const firstDraft = first.repository.queue(first.scope, sessionId, content("原页内容"));
    const second = await loadPage();
    expect(second.repository.read(second.scope, sessionId)?.pending).toBeNull();
    expect(second.repository.listDrafts(second.scope, sessionId)).toMatchObject([{ isCurrentTab: false, pending: firstDraft.pending }]);
    const secondDraft = second.repository.queue(second.scope, sessionId, content("复制页内容"));
    expect(first.repository.read(first.scope, sessionId)?.pending).toEqual(firstDraft.pending);
    expect(second.repository.read(second.scope, sessionId)?.pending).toEqual(secondDraft.pending);
    expect([...storage.entries.keys()].filter((key) => key.includes(":draft:"))).toHaveLength(2);
    expect(first.repository.listDrafts(first.scope, sessionId).filter((entry) => entry.isCurrentTab)).toHaveLength(1);
    expect(second.repository.listDrafts(second.scope, sessionId).filter((entry) => entry.isCurrentTab)).toHaveLength(1);
    second.repository.useServer(second.scope, sessionId);
    expect(first.repository.read(first.scope, sessionId)?.pending).toEqual(firstDraft.pending);
    expect(sessionStorage.getItem).not.toHaveBeenCalled(); expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.removeItem).not.toHaveBeenCalled();
    expect(sessionValues.get("physics-learning-record-tab-id")).toBe("copied-tab-id");
  });

  it("leaves pre-refresh drafts exportable and explicitly restores them with their original base while retaining every old copy", async () => {
    const beforeRefresh = await loadPage(); beforeRefresh.repository.remember(beforeRefresh.scope, snapshot(2));
    const original = beforeRefresh.repository.queue(beforeRefresh.scope, sessionId, content("刷新前未上传的内容"));
    const oldDraftKey = [...storage.entries.keys()].find((key) => key.includes(":draft:"))!;
    const oldRaw = storage.entries.get(oldDraftKey);
    const refreshed = await loadPage();
    expect(refreshed.repository.read(refreshed.scope, sessionId)?.pending).toBeNull();
    const draft = refreshed.repository.listDrafts(refreshed.scope, sessionId)[0];
    expect(draft).toMatchObject({ isCurrentTab: false, valid: true, raw: oldRaw, pending: original.pending });
    refreshed.repository.remember(refreshed.scope, snapshot(5, content("其他页已上传的新版本")));
    refreshed.repository.queue(refreshed.scope, sessionId, content("本页也有草稿"));
    storage.failWrites = true; const beforeFailure = [...storage.entries];
    expect(() => refreshed.repository.restoreDraft(refreshed.scope, sessionId, recordContent(draft.pending), draft.pending!.expectedRevision)).toThrow("storage full");
    expect([...storage.entries]).toEqual(beforeFailure);
    storage.failWrites = false;
    const restored = refreshed.repository.restoreDraft(refreshed.scope, sessionId, recordContent(draft.pending), draft.pending!.expectedRevision);
    expect(restored.pending).toMatchObject({ prediction: "刷新前未上传的内容", expectedRevision: 2 });
    expect(restored.pending?.mutationId).not.toBe(original.pending?.mutationId);
    expect(restored.server.record?.revision).toBe(5);
    expect(storage.entries.get(oldDraftKey)).toBe(oldRaw);
    expect(refreshed.repository.listDrafts(refreshed.scope, sessionId)).toHaveLength(2);
  });
});
