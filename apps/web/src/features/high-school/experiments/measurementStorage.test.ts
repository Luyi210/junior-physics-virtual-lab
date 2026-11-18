import { describe, expect, it, vi } from "vitest";
import { HIGH_SCHOOL_EXPERIMENTS } from "@physics-lab/physics";
import { createMeasurementStore, getScopedMeasurementStore, readLegacyMeasurements } from "./measurementStorage";
import { measurementsToCsv, type HighSchoolMeasurement } from "./workbench";

const experimentId = "uniform-acceleration";
const legacyKey = `physics-high-school-measurements-v1:${experimentId}`;
const definition = HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === experimentId)!;
function record(id: string): HighSchoolMeasurement {
  return { id, createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: 1, parameters: { initialVelocity: -2, acceleration: .8, duration: 5 }, metrics: [{ key: "position", label: "位移", unit: "m", value: -1.6 }] };
}
function memoryStorage(entries = new Map<string, string>()) {
  return {
    entries, failReads: false, failWrites: false, failRemoves: false,
    beforeSet: undefined as ((key: string) => void) | undefined,
    afterSet: undefined as ((key: string) => void) | undefined,
    get length() { return entries.size; },
    key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error("blocked"); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error("full"); this.beforeSet?.(key); entries.set(key, value); this.afterSet?.(key); },
    removeItem(key: string) { if (this.failRemoves) throw new Error("blocked"); entries.delete(key); }
  };
}
const ids = (store: ReturnType<typeof createMeasurementStore>) => store.read().records.map((entry) => entry.id);

describe("high-school measurement persistence", () => {
  it("preserves interleaved additions from tabs that started with the same snapshot", () => {
    const storage = memoryStorage();
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    expect(ids(a)).toEqual([]);
    expect(ids(b)).toEqual([]);
    a.append(record("a"));
    b.append(record("b"));
    a.append(record("c"));
    expect(ids(createMeasurementStore(experimentId, storage))).toEqual(["a", "b", "c"]);
  });

  it("does not resurrect a stale tab's saved records after another tab clears", () => {
    const storage = memoryStorage();
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    a.append(record("old"));
    b.read();
    expect(b.clear().cleared).toBe(true);
    a.append(record("new"));
    expect(ids(b)).toEqual(["new"]);
  });

  it("a clear also invalidates writes already in flight under the previous generation", () => {
    const storage = memoryStorage();
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    storage.beforeSet = (key) => {
      if (key.includes(":record:")) { storage.beforeSet = undefined; b.clear(); }
    };
    a.append(record("before-clear"));
    expect(ids(a)).toEqual([]);
    a.append(record("after-clear"));
    expect(ids(b)).toEqual(["after-clear"]);
  });

  it("keeps failed writes available for export and retries them on the next addition", () => {
    const storage = memoryStorage();
    const store = createMeasurementStore(experimentId, storage);
    storage.failWrites = true;
    expect(store.append(record("a"))).toMatchObject({ failed: true, records: [{ id: "a" }] });
    storage.failWrites = false;
    expect(store.append(record("b")).failed).toBe(false);
    expect(ids(createMeasurementStore(experimentId, storage))).toEqual(["a", "b"]);
  });

  it("explicitly retries the 120th scoped record with its original ID without adding a 121st or rewriting saved entries", () => {
    const storage = memoryStorage();
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    for (let index = 0; index < 119; index++) store.append(record(`saved-${index}`));
    const persistedBefore = [...storage.entries];
    storage.failWrites = true;
    const pendingRecord = record("pending-120");
    expect(store.append(pendingRecord)).toMatchObject({ failed: true });
    expect(store.read().records).toHaveLength(120);
    storage.failWrites = false;
    const written: string[] = [];
    storage.beforeSet = (key) => { written.push(key); };
    const recovered = store.retryPending();
    expect(recovered.failed).toBe(false);
    expect(recovered.records).toHaveLength(120);
    expect(recovered.records.find((entry) => entry.id === pendingRecord.id)).toEqual(pendingRecord);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain(":record:initial:pending-120");
    for (const [key, value] of persistedBefore) expect(storage.getItem(key)).toBe(value);
    expect(getScopedMeasurementStore(experimentId, "owner", memoryStorage(storage.entries)).read().records).toEqual(recovered.records);
    expect(store.retryPending()).toEqual(recovered);
    expect(written).toHaveLength(1);
  });

  it("does not flush on read and keeps pending records when the retry generation cannot be read", () => {
    const storage = memoryStorage();
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    storage.failWrites = true; store.append(record("pending")); storage.failWrites = false;
    expect(store.read()).toEqual({ failed: true, records: [record("pending")] });
    expect(storage.entries.size).toBe(0);
    storage.failReads = true;
    expect(store.retryPending()).toEqual({ failed: true, records: [record("pending")] });
    expect(storage.entries.size).toBe(0);
    storage.failReads = false;
    expect(store.retryPending()).toEqual({ failed: false, records: [record("pending")] });
  });

  it("retains unflushed records after partial retry failure and retries only the remaining original IDs", () => {
    const storage = memoryStorage();
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    storage.failWrites = true; store.append(record("a")); store.append(record("b"));
    expect(store.retryPending()).toEqual({ failed: true, records: [record("a"), record("b")] });
    storage.failWrites = false;
    const written: string[] = [];
    storage.afterSet = (key) => { written.push(key); storage.failWrites = true; };
    expect(store.retryPending()).toEqual({ failed: true, records: [record("a"), record("b")] });
    expect(ids(getScopedMeasurementStore(experimentId, "owner", memoryStorage(storage.entries)))).toEqual(["a"]);
    storage.afterSet = (key) => { written.push(key); }; storage.failWrites = false;
    expect(store.retryPending()).toEqual({ failed: false, records: [record("a"), record("b")] });
    expect(written.map((key) => key.split(":").at(-1))).toEqual(["a", "b"]);
  });

  it("does not revive pending records after another tab clears before retry", () => {
    const storage = memoryStorage(); const otherStorage = memoryStorage(storage.entries);
    const a = getScopedMeasurementStore(experimentId, "owner", storage);
    const b = getScopedMeasurementStore(experimentId, "owner", otherStorage);
    storage.failWrites = true; a.append(record("old-pending")); storage.failWrites = false;
    expect(b.clear().cleared).toBe(true); b.append(record("new-generation"));
    const before = [...storage.entries];
    expect(a.retryPending()).toEqual({ failed: false, records: [record("new-generation")] });
    expect([...storage.entries]).toEqual(before);
    expect(a.retryPending()).toEqual(b.read());
  });

  it("lets an interleaved clear win and rechecks the generation before the next pending write", () => {
    const storage = memoryStorage(); const otherStorage = memoryStorage(storage.entries);
    const a = getScopedMeasurementStore(experimentId, "owner", storage);
    const b = getScopedMeasurementStore(experimentId, "owner", otherStorage);
    storage.failWrites = true; a.append(record("old-a")); a.append(record("old-b")); storage.failWrites = false;
    storage.beforeSet = (key) => {
      if (key.includes(":record:")) { storage.beforeSet = undefined; b.clear(); b.append(record("fresh")); }
    };
    expect(a.retryPending()).toEqual({ failed: false, records: [record("fresh")] });
    expect(b.read().records).toEqual([record("fresh")]);
    expect([...storage.entries.keys()].some((key) => key.endsWith(":old-b"))).toBe(false);
    expect(a.retryPending()).toEqual(b.read());
  });

  it("retries only the requested owner and includes another tab's additions without rewriting them", () => {
    const storage = memoryStorage(); const otherStorage = memoryStorage(storage.entries);
    const owner = getScopedMeasurementStore(experimentId, "owner", storage);
    const otherOwner = getScopedMeasurementStore(experimentId, "other-owner", storage);
    storage.failWrites = true; owner.append(record("pending")); otherOwner.append(record("other-pending")); storage.failWrites = false;
    const otherTab = getScopedMeasurementStore(experimentId, "owner", otherStorage);
    otherTab.append(record("concurrent"));
    const saved = [...storage.entries];
    expect(owner.retryPending()).toEqual({ failed: false, records: [record("concurrent"), record("pending")] });
    expect(otherOwner.read()).toEqual({ failed: true, records: [record("other-pending")] });
    for (const [key, value] of saved) expect(storage.getItem(key)).toBe(value);
    expect(getScopedMeasurementStore(experimentId, "other-owner", otherStorage).read().records).toEqual([]);
  });

  it("cleanup from an earlier clear cannot delete additions after a later clear", () => {
    const storage = memoryStorage();
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    a.append(record("old"));
    storage.afterSet = (key) => {
      if (key.endsWith(":generation")) {
        storage.afterSet = undefined;
        b.clear();
        b.append(record("new"));
      }
    };
    a.clear();
    expect(ids(a)).toEqual(["new"]);
  });

  it("does not replay unsaved entries after another tab explicitly clears", () => {
    const storage = memoryStorage();
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    storage.failWrites = true;
    a.append(record("unsaved"));
    storage.failWrites = false;
    b.clear();
    a.append(record("new"));
    expect(ids(b)).toEqual(["new"]);
  });

  it("preserves records when reads or the clear marker write fail", () => {
    const storage = memoryStorage();
    const store = createMeasurementStore(experimentId, storage);
    store.append(record("a"));
    storage.failReads = true;
    expect(store.read()).toMatchObject({ failed: true, records: [{ id: "a" }] });
    storage.failReads = false;
    storage.failWrites = true;
    expect(store.clear()).toMatchObject({ cleared: false, failed: true, records: [{ id: "a" }] });
    storage.failWrites = false;
    expect(ids(createMeasurementStore(experimentId, storage))).toEqual(["a"]);
  });

  it("migrates v1 once with stable IDs and preserved experimental conditions", () => {
    const storage = memoryStorage();
    storage.setItem(legacyKey, JSON.stringify([record("a"), record("b")]));
    const a = createMeasurementStore(experimentId, storage);
    const b = createMeasurementStore(experimentId, storage);
    expect(a.read()).toEqual({ failed: false, records: [record("a"), record("b")] });
    expect(ids(b)).toEqual(["a", "b"]);
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("retains the legacy copy and all its rows if migration runs out of storage", () => {
    const storage = memoryStorage();
    const original = JSON.stringify([record("a"), record("b")]);
    storage.setItem(legacyKey, original);
    storage.failWrites = true;
    const store = createMeasurementStore(experimentId, storage);
    expect(store.read()).toEqual({ failed: true, records: [record("a"), record("b")] });
    expect(storage.getItem(legacyKey)).toBe(original);
    storage.failWrites = false;
    expect(store.read().failed).toBe(false);
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("does not overwrite corrupted legacy data with an empty array", () => {
    const storage = memoryStorage();
    storage.setItem(legacyKey, "{unfinished");
    expect(createMeasurementStore(experimentId, storage).read()).toEqual({ records: [], failed: true });
    expect(storage.getItem(legacyKey)).toBe("{unfinished");
  });

  it("clear remains effective when cleanup fails and an old v1 copy still exists", () => {
    const storage = memoryStorage();
    const store = createMeasurementStore(experimentId, storage);
    store.append(record("old"));
    storage.setItem(legacyKey, JSON.stringify([record("legacy")]));
    storage.failRemoves = true;
    expect(store.clear()).toMatchObject({ cleared: true, records: [] });
    expect(ids(createMeasurementStore(experimentId, storage))).toEqual([]);
  });

  it("rejects invalid stored timestamps and keeps different experiments isolated", () => {
    const storage = memoryStorage();
    storage.setItem(legacyKey, JSON.stringify([{ ...record("bad"), createdAt: "\t=1+1" }]));
    const store = createMeasurementStore(experimentId, storage);
    expect(store.read()).toEqual({ failed: true, records: [] });
    createMeasurementStore("pendulum", storage).append(record("other"));
    expect(ids(store)).toEqual([]);
    expect(store.matchesKey("physics-high-school-measurements-v2:pendulum:generation")).toBe(false);
    expect(store.matchesKey(legacyKey)).toBe(true);
  });
});

describe("measurement CSV safety", () => {
  it("keeps metrics added after an older record was saved", () => {
    const older = record("a");
    const newer = { ...record("b"), metrics: [...record("b").metrics, { key: "velocity", label: "新增速度", unit: "m/s", value: .8 }] };
    const rows = measurementsToCsv([older, newer], definition).split("\r\n");
    expect(rows[0]).toContain("新增速度 / m/s");
    expect(rows[1]).toMatch(/,""$/);
    expect(rows[2]).toMatch(/,"0.8"$/);
  });

  it.each(["=1+1", "\t=1+1", " \r\n+1+1", "\u0000@SUM(1)", "  -1+1"])("neutralizes spreadsheet formula prefix %j", (value) => {
    const csv = measurementsToCsv([{ ...record("a"), createdAt: value }], definition);
    expect(csv).toContain(`"'${value}"`);
  });

  it("escapes persisted metric labels while retaining negative numeric measurements", () => {
    const csv = measurementsToCsv([{ ...record("a"), metrics: [{ key: "position", label: '\t=HYPERLINK("example")', unit: "", value: -1.6 }] }], definition);
    expect(csv).toContain('"\'\t=HYPERLINK(""example"")"');
    expect(csv).toContain('"-1.6"');
    expect(csv).not.toContain("'-1.6");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});

describe("owner-scoped v3 high-school archives", () => {
  const scopes = ["guest", "demo", "account:backend-a:school-a:student-1", "account:backend-a:school-b:student-1", "account:backend-b:school-a:student-1", "account:backend-a:school-a:student-2"];

  it("isolates guest, demo and same-ID accounts across schools and backend origins", () => {
    const storage = memoryStorage();
    for (const [index, scope] of scopes.entries()) getScopedMeasurementStore(experimentId, scope, storage).append(record(`owner-${index}`));
    for (const [index, scope] of scopes.entries()) expect(ids(getScopedMeasurementStore(experimentId, scope, storage))).toEqual([`owner-${index}`]);
    expect([...storage.entries.keys()].every((key) => key.startsWith("physics-high-school-measurements-v3:"))).toBe(true);
    getScopedMeasurementStore(experimentId, scopes[2]!, storage).clear();
    expect(ids(getScopedMeasurementStore(experimentId, scopes[2]!, storage))).toEqual([]);
    expect(ids(getScopedMeasurementStore(experimentId, scopes[3]!, storage))).toEqual(["owner-3"]);
    expect(ids(getScopedMeasurementStore(experimentId, scopes[0]!, storage))).toEqual(["owner-0"]);
  });

  it("keeps experiment namespaces and injected storage instances separate", () => {
    const storage = memoryStorage();
    const otherStorage = memoryStorage();
    const a = getScopedMeasurementStore("pendulum", "a:b", storage);
    a.append(record("a"));
    const otherScope = getScopedMeasurementStore("b:pendulum", "a", storage);
    expect(ids(otherScope)).toEqual([]);
    expect(ids(getScopedMeasurementStore("pendulum", "a:b", otherStorage))).toEqual([]);
    const aKey = [...storage.entries.keys()][0]!;
    expect(otherScope.matchesKey(aKey)).toBe(false);
    expect(a.matchesKey(aKey)).toBe(true);
  });

  it("does not create a shared null archive or allow blocked writes", () => {
    const storage = memoryStorage();
    for (const scope of [null, ""]) {
      const store = getScopedMeasurementStore(experimentId, scope, storage);
      expect(store.read()).toEqual({ records: [], failed: false });
      expect(() => store.append(record("blocked"))).toThrow(/归属/);
      expect(store.retryPending()).toEqual({ records: [], failed: true });
      expect(store.recoverPending("not-an-owner-token")).toMatchObject({ records: [], failed: true, recoveredCount: 0, error: expect.any(String) });
      expect(store.clear().cleared).toBe(false);
      expect(store.matchesKey(null)).toBe(false);
    }
    expect(storage.entries.size).toBe(0);
  });

  it("retains failed records under their original owner across switching and cache pressure", () => {
    const storage = memoryStorage();
    storage.failWrites = true;
    getScopedMeasurementStore(experimentId, "owner-a", storage).append(record("unsaved-a"));
    getScopedMeasurementStore(experimentId, "owner-b", storage).append(record("unsaved-b"));
    for (let index = 0; index < 120; index++) getScopedMeasurementStore(experimentId, `unused-${index}`, storage).read();
    const a = getScopedMeasurementStore(experimentId, "owner-a", storage);
    expect(a.read()).toMatchObject({ failed: true, records: [{ id: "unsaved-a" }] });
    expect(ids(getScopedMeasurementStore(experimentId, "owner-b", storage))).toEqual(["unsaved-b"]);
    storage.failWrites = false;
    a.append(record("saved-a"));
    expect(a.read().failed).toBe(false);
    expect(ids(a)).toEqual(["saved-a", "unsaved-a"]);
    expect(getScopedMeasurementStore(experimentId, "owner-b", storage).read().failed).toBe(true);
    a.clear();
    expect(ids(getScopedMeasurementStore(experimentId, "owner-b", storage))).toEqual(["unsaved-b"]);
  });

  it("an earlier clean handle reuses its owner cache after eviction before a failed write", () => {
    const storage = memoryStorage();
    const oldHandle = getScopedMeasurementStore(experimentId, "returning", storage);
    oldHandle.read();
    for (let index = 0; index < 120; index++) getScopedMeasurementStore(experimentId, `clean-${index}`, storage).read();
    const secondHandle = getScopedMeasurementStore(experimentId, "returning", storage);
    secondHandle.read();
    storage.failWrites = true;
    oldHandle.append(record("from-old"));
    secondHandle.append(record("from-new"));
    expect(ids(getScopedMeasurementStore(experimentId, "returning", storage))).toEqual(["from-new", "from-old"]);
  });

  it("keeps every pending owner even when more than 100 archives have failed writes", () => {
    const storage = memoryStorage();
    storage.failWrites = true;
    for (let index = 0; index < 105; index++) getScopedMeasurementStore(experimentId, `pending-${index}`, storage).append(record(`r-${index}`));
    for (let index = 0; index < 105; index++) expect(ids(getScopedMeasurementStore(experimentId, `pending-${index}`, storage))).toEqual([`r-${index}`]);
  });

  it("reads legacy v1 and current v2 in place without importing either into a new owner", () => {
    const storage = memoryStorage();
    storage.setItem(legacyKey, JSON.stringify([record("v1")]));
    storage.setItem(`physics-high-school-measurements-v2:${experimentId}:record:initial:v2`, JSON.stringify(record("v2")));
    const original = [...storage.entries];
    storage.failWrites = true; storage.failRemoves = true;
    expect(readLegacyMeasurements(experimentId, storage)).toEqual({ failed: false, records: [record("v1"), record("v2")] });
    for (const scope of scopes) expect(ids(getScopedMeasurementStore(experimentId, scope, storage))).toEqual([]);
    expect([...storage.entries]).toEqual(original);
    storage.failWrites = false; storage.failRemoves = false;
    getScopedMeasurementStore(experimentId, "guest", storage).append(record("guest-new"));
    getScopedMeasurementStore(experimentId, "guest", storage).clear();
    for (const [key, value] of original) expect(storage.getItem(key)).toBe(value);
    expect(readLegacyMeasurements(experimentId, storage).records.map((entry) => entry.id)).toEqual(["v1", "v2"]);
  });

  it("honors an old clear generation and leaves corrupt recovery bytes untouched", () => {
    const storage = memoryStorage();
    const prefix = `physics-high-school-measurements-v2:${experimentId}:`;
    storage.setItem(legacyKey, JSON.stringify([record("cleared-v1")]));
    storage.setItem(`${prefix}record:initial:old`, JSON.stringify(record("cleared-v2")));
    storage.setItem(`${prefix}generation`, "after-clear");
    storage.setItem(`${prefix}record:after-clear:current`, JSON.stringify(record("current")));
    storage.setItem(`${prefix}record:after-clear:bad`, "{broken");
    const before = [...storage.entries];
    expect(readLegacyMeasurements(experimentId, storage)).toEqual({ failed: true, records: [record("current")] });
    expect([...storage.entries]).toEqual(before);
  });
});

describe("explicit recovery for measurements whose generation was unreadable", () => {
  function fixture(incoming = [record("incoming")]) {
    const storage = memoryStorage();
    const otherStorage = memoryStorage(storage.entries);
    const other = getScopedMeasurementStore(experimentId, "owner", otherStorage);
    other.clear(); // The marker is deliberately not the absent-marker initial generation.
    other.append(record("persisted"));
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    storage.failReads = true;
    for (const entry of incoming) store.append(entry);
    storage.failReads = false;
    return { storage, otherStorage, store, other };
  }

  it("keeps the first unknown-generation addition separate through read/retry, then explicitly restores its original payload", () => {
    const incoming = { ...record("incoming"), manual: { provenance: "virtual-manual", readings: [{ key: "endTimeSeconds", value: 10.01, unit: "s" }] } };
    const { storage, store, other } = fixture([incoming]);
    const before = [...storage.entries];
    const preview = store.read();
    expect(preview).toEqual({ records: [record("persisted")], failed: true, recovery: { records: [incoming], reviewToken: expect.any(String) } });
    expect(store.retryPending()).toEqual(preview);
    expect([...storage.entries]).toEqual(before);
    expect(measurementsToCsv(preview.recovery!.records, definition)).toContain('"-1.6"');
    const recovered = store.recoverPending(preview.recovery!.reviewToken);
    expect(recovered).toEqual({ records: [incoming, record("persisted")], failed: false, recoveredCount: 1 });
    expect(other.read().records).toEqual(recovered.records);
    expect([...storage.entries.keys()].filter((key) => key.endsWith(":incoming"))).toHaveLength(1);
    expect(store.recoverPending(preview.recovery!.reviewToken)).toMatchObject({ recoveredCount: 0, error: expect.any(String) });
  });

  it("never assigns a new unreadable-generation record to a previously cached generation", () => {
    const storage = memoryStorage(); const otherStorage = memoryStorage(storage.entries);
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    const other = getScopedMeasurementStore(experimentId, "owner", otherStorage);
    store.read();
    storage.failWrites = true; store.append(record("known-pending")); storage.failWrites = false;
    storage.failReads = true;
    const failed = store.append(record("unknown-new"));
    expect(failed).toEqual({ records: [record("known-pending")], failed: true, recovery: { records: [record("unknown-new")], reviewToken: null } });
    other.clear(); other.append(record("fresh"));
    expect(store.retryPending()).toEqual(failed);
    storage.failReads = false;
    const preview = store.read();
    expect(preview.records).toEqual([record("fresh")]); // Known old pending still obeys clear-wins.
    expect(preview.recovery?.records).toEqual([record("unknown-new")]);
    expect(store.retryPending()).toEqual(preview);
  });

  it("treats unavailable browser storage as unknown and exposes an exportable copy with no recovery token", () => {
    vi.stubGlobal("window", undefined);
    try {
      const store = createMeasurementStore("without-browser-storage");
      const expected = { records: [], failed: true, recovery: { records: [record("offline")], reviewToken: null } };
      expect(store.append(record("offline"))).toEqual(expected);
      expect(store.read()).toEqual(expected);
      expect(store.retryPending()).toEqual(expected);
      expect(store.clear()).toEqual({ ...expected, cleared: false });
      expect(store.recoverPending(null)).toMatchObject({ ...expected, recoveredCount: 0, error: expect.any(String) });
      expect(measurementsToCsv(store.read().recovery!.records, definition)).toContain('"-1.6"');
    } finally { vi.unstubAllGlobals(); }
  });

  it("keeps recovery copies after local and other-tab clears, invalidating each earlier reviewed target", () => {
    const { store, other, storage } = fixture();
    const firstToken = store.read().recovery!.reviewToken;
    const cleared = store.clear();
    expect(cleared).toMatchObject({ cleared: true, records: [], recovery: { records: [record("incoming")] } });
    expect(cleared.recovery!.reviewToken).not.toBe(firstToken);
    expect(store.recoverPending(firstToken).recoveredCount).toBe(0);
    const secondToken = store.read().recovery!.reviewToken;
    other.clear();
    const before = [...storage.entries];
    const refused = store.recoverPending(secondToken);
    expect(refused).toMatchObject({ records: [], recoveredCount: 0, error: expect.stringContaining("目标档案"), recovery: { records: [record("incoming")] } });
    expect([...storage.entries]).toEqual(before);
    expect(store.recoverPending(refused.recovery!.reviewToken).recoveredCount).toBe(1);
  });

  it("returns immutable recovery copies and stable tokens until the exact collection or readable target changes", () => {
    const incoming = { ...record("incoming"), manual: { readings: [1, 2] } };
    const { store, storage } = fixture([incoming]);
    incoming.parameters.acceleration = 999;
    incoming.manual.readings.push(3);
    const preview = store.read();
    expect(preview.recovery!.records[0]).toMatchObject({ parameters: { acceleration: .8 }, manual: { readings: [1, 2] } });
    preview.recovery!.records[0]!.parameters.acceleration = 777;
    expect(store.read().recovery!.records[0]!.parameters.acceleration).toBe(.8);
    const token = preview.recovery!.reviewToken;
    expect(store.read().recovery!.reviewToken).toBe(token);
    storage.failReads = true;
    expect(store.read().recovery!.reviewToken).toBeNull();
    storage.failReads = false;
    const nextToken = store.read().recovery!.reviewToken;
    expect(nextToken).not.toBe(token);
    expect(store.recoverPending(token).recoveredCount).toBe(0);
    storage.failReads = true; store.append(record("second")); storage.failReads = false;
    const before = [...storage.entries];
    expect(store.recoverPending(nextToken).recoveredCount).toBe(0);
    expect([...storage.entries]).toEqual(before);
    expect(store.read().recovery!.records).toHaveLength(2);
  });

  it("binds preview tokens to the owner and store instance, not just IDs or content", () => {
    const { store, storage } = fixture();
    const token = store.read().recovery!.reviewToken;
    const secondOwner = getScopedMeasurementStore(experimentId, "other-owner", storage);
    storage.failReads = true; secondOwner.append(record("incoming")); storage.failReads = false;
    secondOwner.read();
    const secondView = getScopedMeasurementStore(experimentId, "owner", memoryStorage(storage.entries));
    const before = [...storage.entries];
    expect(secondOwner.recoverPending(token).recoveredCount).toBe(0);
    expect(secondView.recoverPending(token).recoveredCount).toBe(0);
    expect([...storage.entries]).toEqual(before);
    expect(secondOwner.read().recovery!.records).toEqual([record("incoming")]);
  });

  it("retains all recovery collections across more than 100 owner caches without assigning them to active records", () => {
    const storage = memoryStorage(); storage.failReads = true;
    for (let index = 0; index < 105; index++) getScopedMeasurementStore(experimentId, `unknown-${index}`, storage).append(record(`r-${index}`));
    storage.failReads = false;
    for (let index = 0; index < 105; index++) {
      const snapshot = getScopedMeasurementStore(experimentId, `unknown-${index}`, storage).read();
      expect(snapshot.records).toEqual([]);
      expect(snapshot.recovery!.records).toEqual([record(`r-${index}`)]);
      expect(snapshot.recovery!.reviewToken).toEqual(expect.any(String));
    }
    expect(storage.entries.size).toBe(0);
  });

  it("retains unsuccessful items after a partial restore and requires a new preview for only the remainder", () => {
    const { store, storage, other } = fixture([record("a"), record("b")]);
    const token = store.read().recovery!.reviewToken;
    const writes: string[] = [];
    storage.afterSet = (key) => { writes.push(key); storage.failWrites = true; };
    const partial = store.recoverPending(token);
    expect(partial).toMatchObject({ recoveredCount: 1, failed: true, error: expect.any(String), records: [record("a"), record("persisted")], recovery: { records: [record("b")] } });
    expect(partial.recovery!.reviewToken).not.toBe(token);
    expect(other.read().records).toEqual(partial.records);
    storage.afterSet = (key) => { writes.push(key); }; storage.failWrites = false;
    expect(store.recoverPending(token).recoveredCount).toBe(0);
    expect(store.recoverPending(partial.recovery!.reviewToken)).toEqual({ records: [record("a"), record("b"), record("persisted")], failed: false, recoveredCount: 1 });
    expect(writes.map((key) => key.split(":").at(-1))).toEqual(["a", "b"]);
  });

  it("keeps an uncertain successful write until a fresh explicit same-content confirmation, without duplicating it", () => {
    const { store, storage } = fixture();
    const token = store.read().recovery!.reviewToken;
    const writes: string[] = [];
    storage.afterSet = (key) => { writes.push(key); storage.failReads = true; };
    const uncertain = store.recoverPending(token);
    expect(uncertain).toMatchObject({ recoveredCount: 0, failed: true, error: expect.any(String), recovery: { records: [record("incoming")], reviewToken: null } });
    storage.failReads = false; storage.afterSet = (key) => { writes.push(key); };
    const fresh = store.read();
    expect(fresh.recovery!.records).toEqual([record("incoming")]);
    expect(store.recoverPending(fresh.recovery!.reviewToken)).toEqual({ records: [record("incoming"), record("persisted")], failed: false, recoveredCount: 1 });
    expect(writes).toHaveLength(1);
  });

  it.each(["beforeSet", "afterSet"] as const)("retains every unconfirmed item when another tab clears at %s", (hook) => {
    const { store, storage, other } = fixture([record("a"), record("b")]);
    const token = store.read().recovery!.reviewToken;
    const writes: string[] = [];
    storage[hook] = (key) => {
      writes.push(key); storage[hook] = undefined;
      other.clear(); other.append(record("fresh"));
    };
    const refused = store.recoverPending(token);
    expect(refused).toMatchObject({ recoveredCount: 0, records: [record("fresh")], error: expect.stringContaining("目标档案"), recovery: { records: [record("a"), record("b")] } });
    expect(writes).toHaveLength(1);
    expect(other.read().records).toEqual([record("fresh")]);
    expect([...storage.entries.keys()].some((key) => key.endsWith(":b"))).toBe(false);
    expect(store.recoverPending(refused.recovery!.reviewToken).recoveredCount).toBe(2);
  });

  it.each([JSON.stringify({ ...record("incoming"), timeSeconds: 123 }), "{corrupt"])("refuses an existing same-ID conflict without overwriting its bytes: %s", (bytes) => {
    const { store, storage } = fixture();
    const token = store.read().recovery!.reviewToken;
    const generationKey = [...storage.entries.keys()].find((key) => key.endsWith(":generation"))!;
    const key = `${generationKey.slice(0, -"generation".length)}record:${storage.getItem(generationKey)}:incoming`;
    storage.setItem(key, bytes);
    const refused = store.recoverPending(token);
    expect(refused).toMatchObject({ recoveredCount: 0, error: expect.stringContaining("同编号"), recovery: { records: [record("incoming")] } });
    expect(storage.getItem(key)).toBe(bytes);
  });

  it("accepts existing same-content JSON with different property order without writing it again", () => {
    const { store, storage, other } = fixture();
    const token = store.read().recovery!.reviewToken;
    const entry = record("incoming");
    other.append({ metrics: entry.metrics, parameters: entry.parameters, timeSeconds: entry.timeSeconds, createdAt: entry.createdAt, id: entry.id });
    storage.beforeSet = () => { throw new Error("must not write identical content"); };
    expect(store.recoverPending(token)).toEqual({ records: [entry, record("persisted")], failed: false, recoveredCount: 1 });
  });

  it("preserves both unknown same-ID versions and refuses to choose one silently", () => {
    const first = record("incoming");
    const second = { ...record("incoming"), timeSeconds: 2 };
    const { store, storage } = fixture([first, second, first]);
    const preview = store.read();
    expect(preview.recovery!.records).toEqual([first, second]);
    const before = [...storage.entries];
    expect(store.recoverPending(preview.recovery!.reviewToken)).toMatchObject({ recoveredCount: 0, error: expect.stringContaining("同编号"), recovery: { records: [first, second] } });
    expect([...storage.entries]).toEqual(before);
  });

  it("does not bypass recovery by appending the same unknown ID after storage becomes readable", () => {
    const { store, storage } = fixture();
    const before = [...storage.entries];
    const replayed = store.append(record("incoming"));
    expect(replayed.records).toEqual([record("persisted")]);
    expect(replayed.recovery!.records).toEqual([record("incoming")]);
    expect([...storage.entries]).toEqual(before);
    const conflicting = { ...record("incoming"), timeSeconds: 2 };
    expect(store.append(conflicting).recovery!.records).toEqual([record("incoming"), conflicting]);
    expect([...storage.entries]).toEqual(before);
  });

  it("does not overwrite a different known pending record with the same ID during recovery", () => {
    const storage = memoryStorage();
    const store = getScopedMeasurementStore(experimentId, "owner", storage);
    storage.failWrites = true; store.append(record("same-id")); storage.failWrites = false;
    storage.failReads = true;
    const unknown = { ...record("same-id"), timeSeconds: 2 };
    store.append(unknown); storage.failReads = false;
    const preview = store.read();
    expect(preview.records).toEqual([record("same-id")]);
    const refused = store.recoverPending(preview.recovery!.reviewToken);
    expect(refused).toMatchObject({ recoveredCount: 0, error: expect.stringContaining("同编号"), records: [record("same-id")], recovery: { records: [unknown] } });
    expect(storage.entries.size).toBe(0);
  });

  it("does not apply the new-record limit to explicit restoration and never truncates other saved records", () => {
    const { store, other } = fixture();
    for (let index = 0; index < 119; index++) other.append(record(`saved-${index}`));
    const preview = store.read();
    expect(preview.records).toHaveLength(120);
    const restored = store.recoverPending(preview.recovery!.reviewToken);
    expect(restored.records).toHaveLength(121);
    expect(restored.recoveredCount).toBe(1);
    expect(restored.recovery).toBeUndefined();
    expect(other.read().records).toEqual(restored.records);
  });
});
