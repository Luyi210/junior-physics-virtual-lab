import type { HarnessArea } from "@physics-lab/harness";

export interface ExperimentNotebookEntry {
  id: string;
  area: HarnessArea;
  module: string;
  experimentTitle: string;
  whatIDid: string;
  whatIObserved: string;
  whatILearned: string;
  question: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "physics-lab-v2-experiment-notebook";

const areas = new Set(["optics", "lens", "sound", "mechanics", "circuit", "thermal", "measurement"]);
function isEntry(value: unknown): value is ExperimentNotebookEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return ["id", "area", "module", "experimentTitle", "whatIDid", "whatIObserved", "whatILearned", "question", "createdAt", "updatedAt"]
    .every((field) => typeof entry[field] === "string")
    && areas.has(entry.area as string) && Boolean(entry.id && entry.module && entry.experimentTitle)
    && Number.isFinite(Date.parse(entry.createdAt as string)) && Number.isFinite(Date.parse(entry.updatedAt as string));
}

function readEntries(): ExperimentNotebookEntry[] {
  if (typeof window === "undefined") return [];
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new Error("本机记录格式损坏，原始内容仍保留，暂未覆盖。请先导出浏览器数据后再处理。"); }
  if (!Array.isArray(parsed) || !parsed.every(isEntry)) throw new Error("本机记录字段不完整，原始内容仍保留，暂未覆盖。请先保留浏览器数据后再处理。");
  return parsed;
}

function writeEntries(entries: ExperimentNotebookEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const experimentNotebookRepository = {
  findAll() {
    return readEntries().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  save(entry: ExperimentNotebookEntry) {
    if (!isEntry(entry)) throw new Error("实验记录内容不完整，未保存。");
    const entries = readEntries();
    const index = entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) entries[index] = entry;
    else entries.push(entry);
    writeEntries(entries);
    window.dispatchEvent(new CustomEvent("physics-notebook-updated"));
    return entry;
  },

  remove(id: string) {
    writeEntries(readEntries().filter((entry) => entry.id !== id));
    window.dispatchEvent(new CustomEvent("physics-notebook-updated"));
  }
};
