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

function readEntries(): ExperimentNotebookEntry[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as ExperimentNotebookEntry[] : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: ExperimentNotebookEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const experimentNotebookRepository = {
  findAll() {
    return readEntries().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  save(entry: ExperimentNotebookEntry) {
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
