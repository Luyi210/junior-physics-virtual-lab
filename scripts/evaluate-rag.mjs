import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { retrievePhysicsKnowledge } from "../apps/api/src/knowledge.js";

const root = resolve(import.meta.dirname, "..");
const files = ["rag-evaluation-v1.json", "rag-evaluation-v2.json"];
const cases = (await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(root, "config/knowledge", file), "utf8"))))).flat();

let reciprocalRankTotal = 0;
let moduleCases = 0;
let topOneHits = 0;
let topThreeHits = 0;
let intentHits = 0;
let intentCases = 0;
const failures = [];

for (const item of cases) {
  const retrieval = retrievePhysicsKnowledge({
    question: item.question,
    audience: item.audience ?? "student",
    context: item.context ?? {},
    limit: 8
  });
  const modules = retrieval.results.map((result) => result.module);
  if (item.expectedModule) {
    moduleCases += 1;
    const rank = modules.indexOf(item.expectedModule);
    if (rank === 0) topOneHits += 1;
    if (rank >= 0 && rank < 3) topThreeHits += 1;
    if (rank >= 0) reciprocalRankTotal += 1 / (rank + 1);
    if (rank < 0 || rank >= (item.expectedTopK ?? 3)) failures.push(`${item.id}: ${item.expectedModule} 未进入前 ${item.expectedTopK ?? 3}`);
  }
  if (item.expectedIntent) {
    intentCases += 1;
    if (retrieval.plan.primaryIntent === item.expectedIntent) intentHits += 1;
    else failures.push(`${item.id}: 意图应为 ${item.expectedIntent}，实际为 ${retrieval.plan.primaryIntent}`);
  }
  if (item.expectedStrategy && retrieval.plan.answerStrategy !== item.expectedStrategy) {
    failures.push(`${item.id}: 策略应为 ${item.expectedStrategy}，实际为 ${retrieval.plan.answerStrategy}`);
  }
  if (typeof item.expectedClarification === "boolean" && retrieval.plan.clarificationRequired !== item.expectedClarification) {
    failures.push(`${item.id}: clarificationRequired 应为 ${item.expectedClarification}`);
  }
  if (item.expectedContentType && retrieval.results[0]?.contentType !== item.expectedContentType) {
    failures.push(`${item.id}: 首条类型应为 ${item.expectedContentType}，实际为 ${retrieval.results[0]?.contentType ?? "空"}`);
  }
}

const percentage = (value, total) => total ? `${(value / total * 100).toFixed(1)}%` : "n/a";
console.log(`RAG 评价集：${cases.length} 题（模块题 ${moduleCases}，意图题 ${intentCases}）`);
console.log(`Recall@1 ${percentage(topOneHits, moduleCases)} · Recall@3 ${percentage(topThreeHits, moduleCases)} · MRR ${(reciprocalRankTotal / Math.max(1, moduleCases)).toFixed(3)} · Intent ${percentage(intentHits, intentCases)}`);
if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("全部硬性验收条件通过。");
}
