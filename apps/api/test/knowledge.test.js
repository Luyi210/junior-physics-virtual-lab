import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { createGuangguangService } from "../src/guangguang.js";
import { createKnowledgeCitations, getPhysicsKnowledgeStats, retrievePhysicsKnowledge } from "../src/knowledge.js";

test("knowledge index turns the existing curriculum into typed chunks and graph relations", () => {
  const stats = getPhysicsKnowledgeStats();
  assert.equal(stats.version, "kg-rag-v2");
  assert.equal(stats.experiments, 36);
  assert.ok(stats.chunks >= 350);
  assert.ok(stats.graphVertices >= 380);
  assert.ok(stats.graphEdges >= 450);
  assert.equal(stats.verticesByKind.experiment, 36);
  assert.equal(stats.verticesByKind.misconception, 41);
  assert.ok(stats.edgesByType.requires >= 70);
  assert.ok(stats.edgesByType["cross-domain"] >= 1);
});

test("retrieval prioritizes a matching misconception inside the current experiment", () => {
  const retrieval = retrievePhysicsKnowledge({
    question: "入射角是不是光线和镜面的夹角？",
    audience: "student",
    context: { area: "optics", module: "reflection" }
  });
  assert.equal(retrieval.mode, "hybrid-context-kg-v2");
  assert.equal(retrieval.results[0].sourceId, "optics.reflection:misconception:angle-from-mirror");
  assert.ok(retrieval.results[0].reasons.includes("当前实验"));
  assert.ok(retrieval.graphPaths.some((path) => path.from === "reflection"));
});

test("retrieval uses aliases and live module context for apparatus troubleshooting", () => {
  const retrieval = retrievePhysicsKnowledge({
    question: "我的灯泡怎么不亮？",
    audience: "student",
    context: { area: "circuit", module: "circuit-basic" }
  });
  assert.equal(retrieval.results[0].module, "circuit-basic");
  assert.equal(retrieval.results[0].contentType, "method");
  assert.ok(retrieval.results.some((result) => result.content.includes("逐步推进")));
});

test("retrieval turns live apparatus issues into a guided next step", () => {
  const retrieval = retrievePhysicsKnowledge({
    question: "现在怎么办？",
    audience: "student",
    context: {
      apparatus: {
        current: {
          module: "circuit-basic",
          origin: "learner",
          controls: [],
          apparatus: [{ id: "switch", label: "开关闭合", value: true, source: "apparatus" }],
          readings: [],
          derived: [],
          validity: { ready: false, issues: ["灯泡不亮，请检查电路是否断路。"] }
        }
      }
    }
  });
  assert.equal(retrieval.plan.primaryIntent, "troubleshooting");
  assert.equal(retrieval.plan.answerStrategy, "guided-next-step");
  assert.equal(retrieval.contextSummary.module, "circuit-basic");
  assert.equal(retrieval.contextSummary.evidenceStatus, "incomplete");
  assert.equal(retrieval.results[0].module, "circuit-basic");
  assert.equal(retrieval.results[0].contentType, "method");
  assert.ok(retrieval.results[0].reasons.some((reason) => reason.startsWith("实验状态:")));
});

test("retrieval moves from setup guidance to evidence reasoning when the apparatus is ready", () => {
  const retrieval = retrievePhysicsKnowledge({
    question: "我能得出什么结论？",
    audience: "student",
    context: {
      apparatus: {
        current: {
          module: "thermal-boiling",
          origin: "learner",
          controls: [],
          apparatus: [],
          readings: [{ id: "temperature", label: "沸腾温度", value: 100, unit: "℃", source: "reading" }],
          derived: [],
          validity: { ready: true, issues: [] }
        }
      },
      observations: [{ text: "继续加热时温度保持在100℃附近" }]
    }
  });
  assert.equal(retrieval.plan.primaryIntent, "evidence");
  assert.equal(retrieval.plan.answerStrategy, "answer-with-evidence");
  assert.equal(retrieval.contextSummary.stage, "ready");
  assert.equal(retrieval.results[0].contentType, "evidence");
});

test("retrieval asks for missing context instead of guessing and prioritizes safety when needed", () => {
  const ambiguous = retrievePhysicsKnowledge({ question: "现在怎么办？", audience: "student" });
  assert.equal(ambiguous.plan.clarificationRequired, true);
  assert.equal(ambiguous.plan.answerStrategy, "clarify-context");
  assert.ok(ambiguous.confidence <= 0.35);

  const unsafe = retrievePhysicsKnowledge({
    question: "能不能直接用导线连接电池两端？",
    audience: "student",
    context: { module: "circuit-basic", area: "circuit" }
  });
  assert.equal(unsafe.plan.safetyRelevant, true);
  assert.equal(unsafe.plan.answerStrategy, "safety-first");
  assert.equal(unsafe.results[0].module, "circuit-basic");
});

test("cross-topic questions retrieve connected knowledge from more than one experiment", () => {
  const retrieval = retrievePhysicsKnowledge({ question: "杠杆和天平有什么联系？", audience: "student" });
  const modules = new Set(retrieval.results.map((result) => result.module));
  assert.ok(modules.has("mechanics-lever"));
  assert.ok(modules.has("measurement-balance"));
});

test("the initial six-domain retrieval benchmark keeps the expected experiment in the top three", async () => {
  const evaluationUrl = new URL("../../../config/knowledge/rag-evaluation-v1.json", import.meta.url);
  const cases = JSON.parse(await readFile(evaluationUrl, "utf8"));
  assert.ok(cases.length >= 20);
  for (const item of cases) {
    const retrieval = retrievePhysicsKnowledge({ question: item.question, audience: "student" });
    const topModules = retrieval.results.slice(0, 3).map((result) => result.module);
    assert.ok(topModules.includes(item.expectedModule), `${item.id}: expected ${item.expectedModule}, received ${topModules.join(", ")}`);
  }
});

test("citations are compact and Guangguang exposes RAG readiness in service status", async () => {
  const retrieval = retrievePhysicsKnowledge({
    question: "沸腾以后温度为什么不再升高？",
    audience: "teacher",
    context: { area: "thermal", module: "thermal-boiling" }
  });
  const citations = createKnowledgeCitations(retrieval, 2);
  assert.equal(citations.length, 2);
  assert.ok(citations.every((citation) => citation.sourceId && citation.title && citation.section));

  const service = createGuangguangService(loadConfig({ guangguangEnabled: false, deepseekApiKey: "" }));
  const status = service.status();
  assert.equal(status.rag.enabled, true);
  assert.equal(status.rag.mode, "hybrid-context-kg-v2");
  assert.equal(status.rag.experiments, 36);
  assert.ok(status.rag.chunks >= 350);
  await service.close();
});
