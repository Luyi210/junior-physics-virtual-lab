import { analyzeControlledComparison, analyzeTargetVariableComparison, calculateSolidPressure } from "@physics-lab/physics";

export interface PressureEvidence { id: number; force: number; area: number; pressure: number; indentation: number; }
export type PressurePrediction = "deeper" | "same" | "shallower" | undefined;

/** Match the displayed depth ruler: hidden digits cannot prove a visible change. */
export function pressureIndentationReading(value: number) { return Number(value.toFixed(1)); }

export function createPressureEvidence(id: number, force: number, area: number): PressureEvidence {
  if (![id, force, area].every(Number.isFinite) || force < 0 || area <= 0) throw new RangeError("压力与面积必须是有效读数");
  const result = calculateSolidPressure(force, area);
  return Object.freeze({ id, force, area, pressure: result.pressurePascals, indentation: pressureIndentationReading(result.indentationMillimeters) });
}

export function analyzePressureEvidence(evidence: readonly PressureEvidence[]) {
  const comparisons = evidence.flatMap((newer, index) => evidence.slice(index + 1).map((older) => {
    const before = [older.force, older.area], after = [newer.force, newer.area];
    const pressureForce = analyzeTargetVariableComparison(before, after, older.pressure, newer.pressure, 0, 25, "same-direction", .001);
    const pressureArea = analyzeTargetVariableComparison(before, after, older.pressure, newer.pressure, 1, 15, "opposite-direction", .001);
    const indentationForce = analyzeTargetVariableComparison(before, after, pressureIndentationReading(older.indentation), pressureIndentationReading(newer.indentation), 0, 25, "same-direction", .001);
    const indentationArea = analyzeTargetVariableComparison(before, after, pressureIndentationReading(older.indentation), pressureIndentationReading(newer.indentation), 1, 15, "opposite-direction", .001);
    return { newer, older, pressureForce, pressureArea, indentationForce, indentationArea };
  }));
  const forceEvidence = comparisons.find((pair) => pair.pressureForce.validTargetComparison && pair.indentationForce.validTargetComparison);
  const areaEvidence = comparisons.find((pair) => pair.pressureArea.validTargetComparison && pair.indentationArea.validTargetComparison);
  const saturationBlocked = comparisons.some((pair) => (pair.pressureForce.validTargetComparison || pair.pressureArea.validTargetComparison)
    && pressureIndentationReading(pair.older.indentation) >= 18 && pressureIndentationReading(pair.newer.indentation) >= 18);
  const latest = evidence.length >= 2 ? analyzeControlledComparison([evidence[1]!.force, evidence[1]!.area], [evidence[0]!.force, evidence[0]!.area], evidence[1]!.pressure, evidence[0]!.pressure) : undefined;
  return { forceEvidence, areaEvidence, saturationBlocked, latest, ready: Boolean(forceEvidence && areaEvidence) };
}

export function pressureEvidenceVerdict(analysis: ReturnType<typeof analyzePressureEvidence>, prediction: PressurePrediction) {
  if (analysis.ready) return { valid: true, title: "压强双因素证据完整", detail: `已保存的可辨压痕对照中，固定面积增大压力，压强和压痕增大；固定压力减小面积，压强和压痕增大。${prediction === "deeper" ? "在这些对照条件下，面积预测与证据一致。" : "请依据这些对照修正预测。"}${analysis.saturationBlocked ? "另有18.0 mm饱和组，它们不能证明压痕继续增大。" : ""}` };
  if (analysis.saturationBlocked) return { valid: false, title: "压强有变化，但压痕已到教学模型上限", detail: "这组计算压强不同，压痕却同为18.0 mm；不能据此判定压痕更深或面积预测得到验证。请减小载荷或选较大受力面，保存能分辨压痕变化的单变量对照。" };
  if (analysis.forceEvidence) return { valid: false, title: "压力因素已验证，还缺受力面积证据", detail: "保持压力不变，翻转长方体，让受力面积至少变化15 cm²；避免两次压痕都达到18.0 mm上限。" };
  if (analysis.areaEvidence) return { valid: false, title: "受力面积已验证，还缺压力证据", detail: "保持受力面不变，让压力至少变化25 N，并观察可辨的压痕变化。" };
  if (!analysis.latest) return undefined;
  if (!analysis.latest.valid) return { valid: false, title: "这两组不能直接比较", detail: analysis.latest.changedIndexes.length ? "压力和面积同时变化，请固定其中一个条件。" : "这两组条件相同，还不能说明某个因素的作用。" };
  return { valid: false, title: "对照的可见效果还不足", detail: "计算压强变化不能代替压痕读数；请在未饱和范围保存可分辨的单变量对照。" };
}
