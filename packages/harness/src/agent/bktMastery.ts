import type { LearnerMemoryScope } from "./learnerMemory.ts";

export interface BktSkillDefinition {
  id: string;
  scope: LearnerMemoryScope;
  label: string;
  experimentIds: string[];
  route: string;
  pInit: number;
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

export interface BktSkillState {
  skillId: string;
  mastery: number; // 0..1
  attempts: number;
  correctCount: number;
  updatedAt: string;
}

export interface BktSkillSnapshot {
  skillId: string;
  label: string;
  route: string;
  mastery: number;
  masteryPercent: number;
  attempts: number;
  correctCount: number;
  status: "mastered" | "practicing" | "needs-focus" | "unassessed";
}

export const BKT_SKILL_CATALOG: readonly BktSkillDefinition[] = [
  // Junior High
  { id: "junior-lens-imaging", scope: "junior", label: "凸透镜成像规律", experimentIds: ["lens", "lens-imaging", "optics-lens"], route: "/lab/lens", pInit: 0.35, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-optics-ray", scope: "junior", label: "光的反射与折射", experimentIds: ["reflection", "refraction", "light", "optics"], route: "/student/explore/light", pInit: 0.4, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-sound-wave", scope: "junior", label: "声音三要素与传播", experimentIds: ["sound", "sound-features"], route: "/student/explore/sound", pInit: 0.42, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-mechanics-force", scope: "junior", label: "杠杆与滑动摩擦力", experimentIds: ["mechanics", "mechanics-lever", "mechanics-friction"], route: "/student/explore/mechanics", pInit: 0.35, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-buoyancy", scope: "junior", label: "浮力与阿基米德原理", experimentIds: ["mechanics-buoyancy", "buoyancy"], route: "/student/explore/mechanics", pInit: 0.3, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-circuit-ohm", scope: "junior", label: "欧姆定律与串并联电路", experimentIds: ["circuit", "circuit-ohm", "electricity"], route: "/student/explore/circuit", pInit: 0.32, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-thermal", scope: "junior", label: "物态变化与热现象", experimentIds: ["thermal", "thermal-boiling"], route: "/student/explore/thermal", pInit: 0.4, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "junior-density", scope: "junior", label: "天平与密度测量", experimentIds: ["measurement", "measurement-density"], route: "/student/explore/measurement", pInit: 0.38, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  // High School
  { id: "hs-pendulum", scope: "high-school", label: "单摆测重力加速度", experimentIds: ["pendulum"], route: "/high-school/experiments/pendulum", pInit: 0.35, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-double-slit", scope: "high-school", label: "双缝干涉测波长", experimentIds: ["double-slit"], route: "/high-school/experiments/double-slit", pInit: 0.32, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-newton-second-law", scope: "high-school", label: "牛顿第二定律探究", experimentIds: ["newton-second-law", "uniform-acceleration"], route: "/high-school/experiments/newton-second-law", pInit: 0.35, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-projectile", scope: "high-school", label: "平抛与斜抛运动", experimentIds: ["projectile-motion"], route: "/high-school/experiments/projectile-motion", pInit: 0.36, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-spring-force", scope: "high-school", label: "胡克定律与力的合成", experimentIds: ["spring-force", "force-composition"], route: "/high-school/experiments/spring-force", pInit: 0.38, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-mechanical-energy", scope: "high-school", label: "机械能与动量守恒", experimentIds: ["mechanical-energy", "momentum-conservation"], route: "/high-school/experiments/mechanical-energy", pInit: 0.32, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-circuit-capacitor", scope: "high-school", label: "电动势内阻与电容器", experimentIds: ["emf-internal-resistance", "capacitor-charge", "multimeter", "transformer-ratio"], route: "/high-school/experiments/capacitor-charge", pInit: 0.3, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 },
  { id: "hs-modern-em", scope: "high-school", label: "电磁感应与光电效应", experimentIds: ["electromagnetic-induction", "charged-particle", "photoelectric-effect", "refractive-index"], route: "/high-school/experiments/photoelectric-effect", pInit: 0.32, pTransit: 0.22, pSlip: 0.12, pGuess: 0.25 }
];

export function listSkillsForScope(scope: LearnerMemoryScope): BktSkillDefinition[] {
  return BKT_SKILL_CATALOG.filter((item) => item.scope === scope);
}

export function resolveSkillIdForExperiment(
  scope: LearnerMemoryScope,
  experimentId: string | null | undefined
): string {
  const scoped = listSkillsForScope(scope);
  if (experimentId) {
    const exact = scoped.find((skill) => skill.experimentIds.includes(experimentId));
    if (exact) return exact.id;
    const partial = scoped.find((skill) => skill.experimentIds.some((id) => experimentId.includes(id) || id.includes(experimentId)));
    if (partial) return partial.id;
  }
  return scoped[0]!.id;
}

/** Standard Bayesian Knowledge Tracing (Corbett & Anderson / OATutor BKT) single-step update. */
export function updateBktSkill(
  currentStates: readonly BktSkillState[],
  skillId: string,
  correct: boolean,
  now = new Date().toISOString()
): BktSkillState[] {
  const safeStates = Array.isArray(currentStates) ? currentStates : [];
  const def = BKT_SKILL_CATALOG.find((item) => item.id === skillId);
  if (!def) return [...safeStates];

  const existing = safeStates.find((item) => item.skillId === skillId);
  const pL = existing ? existing.mastery : def.pInit;
  const pS = def.pSlip;
  const pG = def.pGuess;
  const pT = def.pTransit;

  const pKnownGivenObs = correct
    ? (pL * (1 - pS)) / Math.max(1e-9, pL * (1 - pS) + (1 - pL) * pG)
    : (pL * pS) / Math.max(1e-9, pL * pS + (1 - pL) * (1 - pG));

  const rawNext = pKnownGivenObs + (1 - pKnownGivenObs) * pT;
  const nextMastery = Number(Math.min(0.99, Math.max(0.02, rawNext)).toFixed(4));

  const updated: BktSkillState = {
    skillId,
    mastery: nextMastery,
    attempts: (existing?.attempts ?? 0) + 1,
    correctCount: (existing?.correctCount ?? 0) + (correct ? 1 : 0),
    updatedAt: now
  };

  return [updated, ...safeStates.filter((item) => item.skillId !== skillId)];
}

export function getBktMasterySnapshots(
  states: readonly BktSkillState[],
  scope: LearnerMemoryScope
): BktSkillSnapshot[] {
  const safeStates = Array.isArray(states) ? states : [];
  const byId = new Map(safeStates.map((item) => [item.skillId, item]));
  return listSkillsForScope(scope).map((def) => {
    const state = byId.get(def.id);
    const mastery = state ? state.mastery : def.pInit;
    const masteryPercent = Math.round(mastery * 100);
    const status: BktSkillSnapshot["status"] = !state?.attempts
      ? "unassessed"
      : mastery >= 0.85
      ? "mastered"
      : mastery >= 0.55
        ? "practicing"
        : "needs-focus";
    return {
      skillId: def.id,
      label: def.label,
      route: def.route,
      mastery,
      masteryPercent,
      attempts: state?.attempts ?? 0,
      correctCount: state?.correctCount ?? 0,
      status
    };
  });
}

/** OATutor-style lowest-mastery-first heuristic for selecting the weakest skill to practice next. */
export function selectWeakestSkill(
  states: readonly BktSkillState[],
  scope: LearnerMemoryScope
): BktSkillSnapshot {
  const snapshots = getBktMasterySnapshots(states, scope);
  const attempted = snapshots.filter((skill) => skill.attempts > 0);
  return [...(attempted.length ? attempted : snapshots)].sort((a, b) => a.mastery - b.mastery)[0]!;
}
