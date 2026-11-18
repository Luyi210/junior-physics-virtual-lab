import type { HighSchoolMeasurement } from "./workbench";
import { checkedCapacitorRecord } from "./capacitorEvidence";

export type MeasurementStorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
type StorageAccess = MeasurementStorageAccess;
/** Records saved while the archive generation was unreadable are never silently assigned. */
export interface MeasurementRecovery {
  records: HighSchoolMeasurement[];
  /** An opaque preview acknowledgement, invalidated by an unreadable/changed target or collection. */
  reviewToken: string | null;
}
export interface MeasurementSnapshot { records: HighSchoolMeasurement[]; failed: boolean; recovery?: MeasurementRecovery }
export interface MeasurementRecoveryResult extends MeasurementSnapshot { recoveredCount: number; error?: string }
export interface MeasurementStore {
  read(): MeasurementSnapshot;
  append(record: HighSchoolMeasurement): MeasurementSnapshot;
  retryPending(): MeasurementSnapshot;
  recoverPending(reviewToken: string | null): MeasurementRecoveryResult;
  clear(): MeasurementSnapshot & { cleared: boolean };
  matchesKey(key: string | null): boolean;
}
const storageKeys = (storage: StorageAccess) => Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key !== null);
const resolveStorage = (supplied?: StorageAccess) => supplied ?? (typeof window === "undefined" ? undefined : window.localStorage);

export function isMeasurement(value: unknown): value is HighSchoolMeasurement {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && record.id.length > 0
    && typeof record.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.createdAt) && Number.isFinite(Date.parse(record.createdAt))
    && typeof record.timeSeconds === "number" && Number.isFinite(record.timeSeconds) && record.timeSeconds >= 0
    && record.parameters !== null && typeof record.parameters === "object" && !Array.isArray(record.parameters)
    && Object.values(record.parameters).every((number) => typeof number === "number" && Number.isFinite(number))
    && Array.isArray(record.metrics) && record.metrics.every((metric: unknown) => {
      if (!metric || typeof metric !== "object") return false;
      const entry = metric as Record<string, unknown>;
      return typeof entry.key === "string" && typeof entry.label === "string" && typeof entry.unit === "string" && typeof entry.value === "number" && Number.isFinite(entry.value);
    });
}

function isMeasurementForExperiment(value: unknown, experimentId: string): value is HighSchoolMeasurement {
  if (!isMeasurement(value)) return false;
  if (experimentId !== 'capacitor-charge') return !Object.hasOwn(value, 'capacitorHistory');
  try { checkedCapacitorRecord(value); return true; } catch { return false; }
}

function merged(...groups: HighSchoolMeasurement[][]) {
  return [...new Map(groups.flat().map((record) => [record.id, record])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// Compare the complete JSON payload, including manual readings and their provenance.
// Object property insertion order must not create a false same-ID conflict.
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
}
const copyRecord = (record: HighSchoolMeasurement): HighSchoolMeasurement => JSON.parse(JSON.stringify(record));

/** Independent record keys prevent one tab from overwriting another tab's additions.
 * Clearing changes the generation before cleanup; stale tabs never rewrite old snapshots.
 */
function createStore(prefix: string, legacyKey: string | null, suppliedStorage: StorageAccess | undefined, experimentId: string) {
  const validRecord = (value: unknown): value is HighSchoolMeasurement => isMeasurementForExperiment(value, experimentId);
  const generationKey = `${prefix}generation`;
  const getStorage = () => resolveStorage(suppliedStorage);
  // null means unobserved, whereas "initial" means an actual successful read found no marker.
  let generation: string | null = null;
  let snapshot: HighSchoolMeasurement[] = [];
  const pending = new Map<string, HighSchoolMeasurement>();
  // Key by full payload: even two conflicting records with the same ID remain exportable.
  const recovery = new Map<string, HighSchoolMeasurement>();
  let review: { generation: string; fingerprint: string; token: string } | null = null;
  const recordPrefix = (target = generation) => `${prefix}record:${target}:`;
  const recordKey = (id: string, target = generation) => `${recordPrefix(target)}${encodeURIComponent(id)}`;
  const useGeneration = (next: string) => {
    if (next !== generation) { generation = next; pending.clear(); snapshot = []; review = null; }
  };
  const recoveryFingerprint = () => JSON.stringify([...recovery.keys()].sort());
  function result(failed: boolean, targetReadable = false): MeasurementSnapshot {
    if (!targetReadable) review = null;
    if (recovery.size === 0) { review = null; return { records: snapshot, failed }; }
    const fingerprint = recoveryFingerprint();
    if (targetReadable && generation !== null && (review?.generation !== generation || review.fingerprint !== fingerprint)) {
      review = { generation, fingerprint, token: crypto.randomUUID() };
    }
    return {
      records: snapshot, failed: true,
      recovery: {
        records: [...recovery.values()].map(copyRecord).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
        reviewToken: review?.token ?? null
      }
    };
  }

  function read(): MeasurementSnapshot {
    try {
      const storage = getStorage();
      if (!storage) return result(true);
      useGeneration(storage.getItem(generationKey) ?? "initial");
      let failed = false;
      let legacy: HighSchoolMeasurement[] = [];
      // A clear marker permanently suppresses migration of old v1 snapshots.
      if (generation === "initial" && legacyKey !== null) {
        const raw = storage.getItem(legacyKey);
        if (raw !== null) {
          try {
            const value: unknown = JSON.parse(raw);
            if (!Array.isArray(value)) throw new Error("Invalid legacy records");
            legacy = value.filter(validRecord);
            if (legacy.length !== value.length) failed = true;
            for (const record of legacy) {
              if (storage.getItem(recordKey(record.id)) === null) storage.setItem(recordKey(record.id), JSON.stringify(record));
            }
            // Leave malformed/partially migrated input available for recovery.
            if (!failed) storage.removeItem(legacyKey);
          } catch { failed = true; }
        }
      }
      const saved: HighSchoolMeasurement[] = [];
      for (const key of storageKeys(storage).filter((key) => key.startsWith(recordPrefix()))) {
        try {
          const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
          if (validRecord(value)) saved.push(value);
          else failed = true;
        } catch { failed = true; }
      }
      const latestGeneration = storage.getItem(generationKey) ?? "initial";
      if (latestGeneration !== generation) { useGeneration(latestGeneration); return result(true); }
      snapshot = merged(legacy, saved, [...pending.values()]);
      return result(failed || pending.size > 0, !failed);
    } catch {
      snapshot = merged(snapshot, [...pending.values()]);
      return result(true);
    }
  }

  function append(record: HighSchoolMeasurement): MeasurementSnapshot {
    if (!validRecord(record)) throw new TypeError("Invalid experiment measurement");
    const entry = copyRecord(record);
    read();
    // Replaying an unknown ID through append must not bypass explicit recovery.
    if ([...recovery.values()].some((unknown) => unknown.id === entry.id)) {
      const fingerprint = canonicalJson(entry);
      if (!recovery.has(fingerprint)) { recovery.set(fingerprint, entry); review = null; }
      return read();
    }
    let confirmedGeneration = false;
    try {
      const storage = getStorage();
      if (!storage) throw new Error("Storage unavailable");
      useGeneration(storage.getItem(generationKey) ?? "initial");
      confirmedGeneration = true;
      pending.set(entry.id, entry);
      snapshot = merged(snapshot, [entry]);
      // Retry this tab's unsaved entries without writing any stale saved records.
      for (const [id, entry] of pending) {
        storage.setItem(recordKey(id), JSON.stringify(entry));
        pending.delete(id);
      }
    } catch {
      if (confirmedGeneration) {
        pending.set(entry.id, entry);
        snapshot = merged(snapshot, [entry]);
      } else {
        // A cached generation is insufficient: another tab may have cleared meanwhile.
        recovery.set(canonicalJson(entry), entry);
        review = null;
      }
    }
    return read();
  }

  /** Retry original pending IDs without creating a measurement or consuming a new-record slot. */
  function retryPending(): MeasurementSnapshot {
    let failed = false;
    try {
      const storage = getStorage();
      if (!storage) throw new Error("Storage unavailable");
      // A clear in another tab invalidates this generation's pending recovery copy.
      // If its marker cannot be read, do not guess a generation or write anything.
      useGeneration(storage.getItem(generationKey) ?? "initial");
      for (const [id, entry] of pending) {
        const latestGeneration = storage.getItem(generationKey) ?? "initial";
        if (latestGeneration !== generation) { useGeneration(latestGeneration); break; }
        storage.setItem(recordKey(id), JSON.stringify(entry));
        pending.delete(id);
      }
    } catch { failed = true; }
    const next = read();
    return { ...next, failed: failed || next.failed };
  }

  /** Explicitly save the exact previewed recovery collection into its previewed target. */
  function recoverPending(reviewToken: string | null): MeasurementRecoveryResult {
    const acknowledged = review;
    if (!reviewToken || !acknowledged || reviewToken !== acknowledged.token || acknowledged.fingerprint !== recoveryFingerprint()) {
      return { ...read(), recoveredCount: 0, error: "待恢复读数或目标档案已变化，请重新查看后确认保存。" };
    }
    let recoveredCount = 0;
    let error: string | undefined;
    // Every attempt consumes its token, including partial failure. A new preview is required.
    review = null;
    try {
      const storage = getStorage();
      if (!storage) throw new Error("本机存储当前不可读取；待恢复读数仍保留，请先导出备份。");
      const assertTarget = () => {
        const current = storage.getItem(generationKey) ?? "initial";
        if (current !== acknowledged.generation) {
          useGeneration(current);
          throw new Error("目标档案已被其他页面清空或改变；待恢复读数仍保留，请重新查看目标后确认。");
        }
      };
      assertTarget();
      const batch = [...recovery];
      if (new Set(batch.map(([, entry]) => entry.id)).size !== batch.length) {
        throw new Error("待恢复集合含同编号的不同读数，不能覆盖保存；所有版本仍保留，请分别导出核对。");
      }
      for (const [fingerprint, entry] of batch) {
        assertTarget();
        const pendingEntry = pending.get(entry.id);
        if (pendingEntry && canonicalJson(pendingEntry) !== fingerprint) {
          throw new Error("当前档案已有同编号的不同未写入读数，未覆盖；待恢复读数仍保留，请导出核对。");
        }
        const key = recordKey(entry.id, acknowledged.generation);
        const existing = storage.getItem(key);
        let identical = false;
        if (existing !== null) {
          try { identical = canonicalJson(JSON.parse(existing)) === fingerprint; } catch { /* Corrupt bytes are a conflict, not an empty slot. */ }
          if (!identical) throw new Error("目标档案已有同编号的不同或损坏读数，未覆盖；待恢复读数仍保留，请导出核对。");
        }
        assertTarget();
        if (!identical) storage.setItem(key, JSON.stringify(entry));
        // Do not remove the only recovery copy until both destination and complete content
        // are confirmed. A clear or an unreadable marker after setItem leaves it here.
        assertTarget();
        const written = storage.getItem(key);
        if (written === null || canonicalJson(JSON.parse(written)) !== fingerprint) {
          throw new Error("保存后的读数无法确认或已变化；待恢复副本仍保留，请重新查看后重试。");
        }
        assertTarget();
        recovery.delete(fingerprint);
        if (pendingEntry) pending.delete(entry.id);
        recoveredCount++;
      }
    } catch (cause) {
      error = cause instanceof Error && /待恢复|目标档案/.test(cause.message)
        ? cause.message : "本机保存或核对失败；未确认的待恢复读数仍保留，请先导出备份后重试。";
    }
    const next = read();
    return { ...next, failed: next.failed || error !== undefined, recoveredCount, ...(error ? { error } : {}) };
  }

  function clear(): MeasurementSnapshot & { cleared: boolean } {
    try {
      const storage = getStorage();
      if (!storage) throw new Error("Storage unavailable");
      const staleKeys = storageKeys(storage).filter((key) => key === legacyKey || key.startsWith(`${prefix}record:`));
      const next = crypto.randomUUID();
      storage.setItem(generationKey, next);
      useGeneration(next);
      // Cleanup is optional for correctness: the persisted generation hides old keys.
      try {
        // Only remove keys observed before this clear. A later clear/addition in
        // another tab may already have established a newer generation.
        for (const key of staleKeys) storage.removeItem(key);
      } catch { /* A later clear can reclaim inaccessible stale keys. */ }
      return { ...read(), cleared: true };
    } catch { return { ...result(true), cleared: false }; }
  }

  return { read, append, retryPending, recoverPending, clear, matchesKey: (key: string | null) => key === null || key === legacyKey || key.startsWith(prefix), hasPending: () => pending.size > 0 || recovery.size > 0 };
}

/** Compatibility entry point for the original unscoped archive. New UI must use v3 scopes. */
export function createMeasurementStore(experimentId: string, suppliedStorage?: StorageAccess): MeasurementStore {
  return createStore(`physics-high-school-measurements-v2:${experimentId}:`, `physics-high-school-measurements-v1:${experimentId}`, suppliedStorage, experimentId);
}

type CachedStore = ReturnType<typeof createStore>;
type StoreCache = { entries: Map<string, CachedStore>; active: Map<CachedStore, number> };
const defaultCache: StoreCache = { entries: new Map(), active: new Map() };
const suppliedCaches = new WeakMap<StorageAccess, StoreCache>();
const CACHE_LIMIT = 100;

function pruneCache(cache: StoreCache) {
  for (const [key, store] of cache.entries) {
    if (cache.entries.size <= CACHE_LIMIT) break;
    // Pending records are the only recovery copy. Never evict them or an in-flight operation.
    if (!store.hasPending() && !cache.active.has(store)) cache.entries.delete(key);
  }
}

/** v3 scopes never read, migrate or clear old v1/v2 data. Scope keys are opaque owner identities. */
export function getScopedMeasurementStore(experimentId: string, scopeKey: string | null, suppliedStorage?: StorageAccess): MeasurementStore {
  if (scopeKey === null || scopeKey.length === 0) return {
    read: () => ({ records: [], failed: false }),
    append: () => { throw new Error("尚未选择档案归属，不能保存读数。"); },
    retryPending: () => ({ records: [], failed: true }),
    recoverPending: () => ({ records: [], failed: true, recoveredCount: 0, error: "尚未选择档案归属，不能恢复读数。" }),
    clear: () => ({ records: [], failed: true, cleared: false }),
    matchesKey: () => false
  };
  let cache = defaultCache;
  if (suppliedStorage) {
    const existing = suppliedCaches.get(suppliedStorage);
    cache = existing ?? { entries: new Map(), active: new Map() };
    if (!existing) suppliedCaches.set(suppliedStorage, cache);
  }
  const cacheKey = JSON.stringify([scopeKey, experimentId]);
  const prefix = `physics-high-school-measurements-v3:${encodeURIComponent(scopeKey)}:${encodeURIComponent(experimentId)}:`;
  function withStore<T>(action: (store: CachedStore) => T): T {
    const store = cache.entries.get(cacheKey) ?? createStore(prefix, null, suppliedStorage, experimentId);
    cache.entries.delete(cacheKey);
    cache.entries.set(cacheKey, store);
    cache.active.set(store, (cache.active.get(store) ?? 0) + 1);
    try { return action(store); }
    finally {
      const depth = cache.active.get(store)! - 1;
      if (depth) cache.active.set(store, depth); else cache.active.delete(store);
      pruneCache(cache);
    }
  }
  // These handles resolve the canonical owner store on every operation, so an old clean
  // handle cannot acquire orphaned pending records after its cached store was evicted.
  return {
    read: () => withStore((store) => store.read()),
    append: (record) => withStore((store) => store.append(record)),
    retryPending: () => withStore((store) => store.retryPending()),
    recoverPending: (token) => withStore((store) => store.recoverPending(token)),
    clear: () => withStore((store) => store.clear()),
    matchesKey: (key) => key === null || key.startsWith(prefix)
  };
}

/** Read old archives in place. In particular, this function performs no migration or cleanup. */
export function readLegacyMeasurements(experimentId: string, suppliedStorage?: StorageAccess): MeasurementSnapshot {
  const records: HighSchoolMeasurement[] = [];
  let failed = false;
  try {
    const storage = resolveStorage(suppliedStorage);
    if (!storage) return { records, failed };
    const prefix = `physics-high-school-measurements-v2:${experimentId}:`;
    const generation = storage.getItem(`${prefix}generation`) ?? "initial";
    if (generation === "initial") {
      const raw = storage.getItem(`physics-high-school-measurements-v1:${experimentId}`);
      if (raw !== null) {
        try {
          const value: unknown = JSON.parse(raw);
          if (!Array.isArray(value)) throw new Error("Invalid legacy records");
          records.push(...value.filter((entry) => isMeasurementForExperiment(entry, experimentId)));
          if (records.length !== value.length) failed = true;
        } catch { failed = true; }
      }
    }
    for (const key of storageKeys(storage).filter((key) => key.startsWith(`${prefix}record:${generation}:`))) {
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
        if (isMeasurementForExperiment(value, experimentId)) records.push(value); else failed = true;
      } catch { failed = true; }
    }
  } catch { failed = true; }
  return { records: merged(records), failed };
}
