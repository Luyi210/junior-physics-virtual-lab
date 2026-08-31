import { emptyProgress, type ResearchSession, type TaskId } from "./researchModel";

const STORAGE_KEY = "physics-optics-poe-research-v1";

export function loadResearchSession(): ResearchSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as ResearchSession | null;
    if (value?.schemaVersion !== 1) return null;
    const taskIds: TaskId[] = ["reflection", "bench", "dispersion", "correction"];
    const tasks = Object.fromEntries(taskIds.map((taskId) => {
      const merged = { ...emptyProgress(), ...value.tasks[taskId] };
      if (merged.stage === "explain" && merged.revisedPrediction === undefined) merged.stage = "reconsider";
      return [taskId, merged];
    })) as ResearchSession["tasks"];
    return {
      ...value,
      tasks
    };
  } catch {
    return null;
  }
}

export function saveResearchSession(session: ResearchSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearResearchSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportResearchJson(session: ResearchSession) {
  download(`optics-research-${session.participantId}.json`, JSON.stringify(session, null, 2), "application/json");
}

export function exportResearchCsv(session: ResearchSession) {
  const rows = [[
    "participant_id", "task", "stage", "prediction", "prediction_reason", "initial_confidence", "observation_conflict", "revised_prediction", "revised_correct", "revised_confidence", "revision_reason", "trials", "hints_used", "evidence_score", "reasoning_score", "transfer", "transfer_correct", "completed_at"
  ]];
  for (const [task, progress] of Object.entries(session.tasks)) {
    rows.push([
      session.participantId,
      task,
      progress.stage,
      progress.prediction ?? "",
      progress.predictionReason,
      String(progress.initialConfidence),
      progress.observationConflict ?? "",
      progress.revisedPrediction ?? "",
      String(progress.revisedCorrect ?? ""),
      String(progress.revisedConfidence ?? ""),
      progress.revisionReason,
      String(progress.trials.length),
      String(progress.hintsUsed),
      String(progress.evidenceScore),
      String(progress.reasoningScore),
      progress.transfer ?? "",
      String(progress.transferCorrect ?? ""),
      progress.completedAt ?? ""
    ]);
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  download(`optics-research-${session.participantId}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}
