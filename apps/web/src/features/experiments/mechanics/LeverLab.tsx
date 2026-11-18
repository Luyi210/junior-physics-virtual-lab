import { lazy, useState, useEffect, Suspense } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { calculateLever, calculateLeverForceLine, analyzeInvariantEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Focus, Gauge, Save, ClipboardList } from "lucide-react";
import { ScienceModuleLoading } from "../shared/ScienceModuleLoading";
import { appendLeverForceLineTrial, compareLeverForceLineTrials, createLeverForceLineTrial, hasLeverForceLineTrial, type LeverForceLineTrial } from "./leverForceLineEvidence";

const LeverForceLineDiagnostic = lazy(async () => {
  const module = await import("./LeverForceLineDiagnostic");
  return { default: module.LeverForceLineDiagnostic };
});

interface LeverEvidence { id: number; leftForce: number; leftArm: number; rightForce: number; rightArm: number; }

const leverChallenges = [
  { id: "equal", label: "等力找位置", note: "两侧钩码相同，寻找等力臂", leftForce: 2, leftArm: 4, rightForce: 2, rightArm: 2 },
  { id: "small", label: "小力撬重物", note: "右侧力较小，需要更长力臂", leftForce: 4, leftArm: 3, rightForce: 2, rightArm: 3 },
  { id: "inverse", label: "反算挂码数", note: "悬点已定，调整右侧钩码", leftForce: 3, leftArm: 6, rightForce: 2, rightArm: 4 }
] as const;

export function LeverLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [challengeId, setChallengeId] = useState<(typeof leverChallenges)[number]["id"]>("equal");
  const [leftForce, setLeftForce] = useState(2);
  const [leftArm, setLeftArm] = useState(4);
  const [rightForce, setRightForce] = useState(2);
  const [rightArm, setRightArm] = useState(2);
  const [zeroOffset, setZeroOffset] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [evidence, setEvidence] = useState<LeverEvidence[]>([]);
  const [forceLineAngle, setForceLineAngle] = useState(90);
  const [forceLineTrials, setForceLineTrials] = useState<readonly LeverForceLineTrial[]>([]);
  const lever = calculateLever(leftForce, leftArm, rightForce, rightArm);
  const forceLine = calculateLeverForceLine(rightForce, rightArm, forceLineAngle);
  const calibrated = Math.abs(zeroOffset) < .01;
  const tilt = calibrated ? Math.max(-11, Math.min(11, lever.difference * 1.2)) : zeroOffset;
  const balanced = calibrated && lever.balanced;
  const challenge = leverChallenges.find((item) => item.id === challengeId) ?? leverChallenges[0];
  const leverInvariant = analyzeInvariantEvidence(evidence.map((row) => (row.leftForce * row.leftArm) / (row.rightForce * row.rightArm)));
  const forceLineComparison = compareLeverForceLineTrials(forceLineTrials);
  const forceLineEvidenceReady = forceLineComparison.ready;
  const leverLearningReady = calibrated && leverInvariant.stable && forceLineEvidenceReady;
  useEffect(() => {
    if (!playing || !calibrated) return;
    const target = Math.max(1, Math.min(9, lever.leftMoment / rightForce));
    const timer = window.setInterval(() => setRightArm((value) => {
      const distance = target - value;
      if (Math.abs(distance) <= .05) { setPlaying(false); return Number(target.toFixed(1)); }
      return Number((value + Math.sign(distance) * Math.min(.1, Math.abs(distance))).toFixed(1));
    }), 50);
    return () => clearInterval(timer);
  }, [calibrated, lever.leftMoment, playing, rightForce]);
  useEffect(() => {
    publishApparatusSnapshot({
      module: "mechanics-lever", capturedAt: new Date().toISOString(), origin: calibrated || evidence.length > 0 ? "learner" : "system",
      controls: [
        { id: "challenge", label: "探究任务", value: challenge.label, source: "control" },
        { id: "left-force", label: "左侧钩码重力", value: leftForce, unit: "N", source: "control" },
        { id: "left-arm", label: "左力臂", value: leftArm, unit: "格", source: "control" },
        { id: "right-force", label: "右侧钩码重力", value: rightForce, unit: "N", source: "control" },
        { id: "right-arm", label: "右力臂", value: rightArm, unit: "格", source: "control" },
        { id: "force-line-angle", label: "弹簧测力计拉力夹角", value: forceLineAngle, unit: "°", source: "control" }
      ],
      apparatus: [
        { id: "calibrated", label: "空杠杆已调平", value: calibrated, source: "apparatus" },
        { id: "auto-adjust", label: "自动微调", value: playing, source: "apparatus" },
        { id: "saved-groups", label: "已记录平衡组数", value: evidence.length, unit: "组", source: "apparatus" }
      ],
      readings: [
        { id: "left-moment", label: "左侧力矩", value: calibrated ? lever.leftMoment : null, unit: "N·格", source: "reading" },
        { id: "right-moment", label: "右侧力矩", value: calibrated ? lever.rightMoment : null, unit: "N·格", source: "reading" },
        { id: "balance", label: "杠杆状态", value: !calibrated ? "等待调平" : balanced ? "水平平衡" : tilt > 0 ? "右端下沉" : "左端下沉", source: "reading" },
        { id: "perpendicular-arm", label: "斜拉有效力臂", value: forceLine.perpendicularArm, unit: "格", source: "reading" }
      ],
      derived: [
        { id: "moment-difference", label: "力矩差", value: calibrated ? lever.difference : null, unit: "N·格", source: "model" },
        { id: "moment-invariant", label: "三组力矩比稳定", value: leverInvariant.stable, source: "model" },
        { id: "force-line-comparison", label: "90°与30°作用线对照完成", value: forceLineEvidenceReady, source: "model" }
      ],
      validity: { ready: leverLearningReady, issues: leverLearningReady ? [] : !calibrated ? ["实验前先调节平衡螺母，使空杠杆水平。"] : !leverInvariant.stable ? (!balanced ? ["继续调整钩码数量或悬挂位置，直到杠杆水平。"] : !leverInvariant.enoughPoints ? ["至少记录三组不同配置的平衡数据。"] : ["检查每组F₁l₁与F₂l₂的比值是否接近1。"]) : ["保持力和悬点距离不变，分别记录90°与30°斜拉作用线。"] }
    });
  }, [balanced, calibrated, challenge.label, evidence.length, forceLine.perpendicularArm, forceLineAngle, forceLineEvidenceReady, leftArm, leftForce, lever.difference, lever.leftMoment, lever.rightMoment, leverInvariant.enoughPoints, leverInvariant.stable, leverLearningReady, playing, rightArm, rightForce, tilt]);
  const chooseChallenge = (next: (typeof leverChallenges)[number]) => {
    setChallengeId(next.id); setLeftForce(next.leftForce); setLeftArm(next.leftArm); setRightForce(next.rightForce); setRightArm(next.rightArm); setZeroOffset(2); setPlaying(false);
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "探究任务", value: next.label });
  };
  const adjust = (setter: React.Dispatch<React.SetStateAction<number>>, value: number, min: number, max: number, control: string) => {
    setter((current) => Number(Math.max(min, Math.min(max, current + value)).toFixed(1)));
    setPlaying(false); recordHarness("control.changed", { experiment: "mechanics-lever", control, step: value });
  };
  const saveBalance = () => {
    if (!balanced) return;
    if (evidence.some((row) => row.leftForce === leftForce && row.leftArm === leftArm && row.rightForce === rightForce && row.rightArm === rightArm)) return;
    const row = { id: Date.now(), leftForce, leftArm, rightForce, rightArm };
    setEvidence((items) => [row, ...items].slice(0, 6));
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "记录平衡数据", value: `${leftForce}×${leftArm}=${rightForce}×${rightArm}` });
  };
  const recordForceLine = () => {
    if (hasLeverForceLineTrial(forceLineTrials, rightForce, rightArm, forceLineAngle)) return;
    const trial = createLeverForceLineTrial(crypto.randomUUID(), rightForce, rightArm, forceLineAngle);
    setForceLineTrials((items) => appendLeverForceLineTrial(items, trial));
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "记录作用线", force: trial.force, pivotDistance: trial.pivotDistance, angle: trial.angle, perpendicularArm: trial.perpendicularArm, moment: trial.moment, value: `F=${trial.force}N / r=${trial.pivotDistance}格 / ${trial.angle}° / l=${trial.perpendicularArm.toFixed(2)}格 / M=${trial.moment.toFixed(2)}N·格` });
  };
  return <LabFrame field="mechanics" experiment="mechanics-lever" eyebrow="LEVER BALANCE BENCH / 杠杆平衡台" title="先调平，再挂码：让平衡与作用线都有证据" description="先用竖直钩码归纳杠杆平衡条件，再用弹簧测力计做斜拉诊断。第二部分会显示支点到力的作用线的垂直距离，纠正把杆长直接当作力臂的常见错误。" running={playing} onToggle={() => setPlaying((value) => !value)} playLabel="辅助微调右侧悬点" runningLabel="停止辅助微调" actionDisabled={!calibrated} disabledLabel="请先调平空杠杆">
    <div className="lever-challenge-tabs">{leverChallenges.map((item, index) => <button className={challengeId === item.id ? "active" : ""} onClick={() => chooseChallenge(item)} key={item.id}><b>挑战 0{index + 1}</b><span>{item.label}<small>{item.note}</small></span></button>)}</div>
    <div className={`lever-sim lever-balance-bench ${calibrated ? "calibrated" : "calibrating"}`}>
      <div className="lever-procedure"><span className={calibrated ? "done" : "active"}><b>01</b>空杆调平</span><i /><span className={calibrated ? "active" : ""}><b>02</b>挂码调节</span><i /><span className={evidence.length ? "done" : ""}><b>03</b>记录证据</span></div>
      <div className="lever-scale">{Array.from({ length: 19 }, (_, i) => <i data-mark={Math.abs(i - 9)} key={i} />)}</div>
      <div className="lever-beam" style={{ transform: `translate(-50%,-50%) rotate(${tilt}deg)` }}>
        {calibrated && <><span className="lever-hanger left" style={{ left: `${50 - leftArm * 4.5}%` }}><i />{Array.from({ length: Math.round(leftForce * 2) }, (_, index) => <b style={{ top: `${32 + index * 7}px` }} key={index} />)}<em>{leftForce} N</em></span>
        <span className="lever-hanger right" style={{ left: `${50 + rightArm * 4.5}%` }}><i />{Array.from({ length: Math.round(rightForce * 2) }, (_, index) => <b style={{ top: `${32 + index * 7}px` }} key={index} />)}<em>{rightForce} N</em></span></>}
      </div>
      <div className="fulcrum"><i /></div><div className="lever-plumb-line" />
      {!calibrated && <div className="lever-calibration-panel"><span><Focus size={18} /><small>STEP 01 · ZERO ADJUST</small><strong>右端偏低，向左调节平衡螺母</strong></span><div><button onClick={() => setZeroOffset((value) => Math.max(0, value - .5))}>平衡螺母向左</button><output>{zeroOffset === 0 ? "已水平" : `偏差 ${zeroOffset.toFixed(1)}°`}</output><button onClick={() => setZeroOffset((value) => Math.min(4, value + .5))}>向右</button></div></div>}
      <div className={`balance-status ${balanced ? "balanced" : ""} ${calibrated ? "" : "awaiting-reading"}`}><Gauge size={21} /><strong>{!calibrated ? "空杠杆尚未调平" : balanced ? "杠杆水平平衡" : tilt > 0 ? "右端下沉" : "左端下沉"}</strong><span>{calibrated ? `左 ${lever.leftMoment.toFixed(1)} N·格　/　右 ${lever.rightMoment.toFixed(1)} N·格` : "先完成零点校准，再读取力矩"}</span></div>
    </div>
    <div className="lever-manual-controls">
      <article><header><span>LEFT / 左侧钩码</span><strong>F₁l₁ = {lever.leftMoment.toFixed(1)}</strong></header><div><label>钩码重力</label><button onClick={() => adjust(setLeftForce, -.5, .5, 6, "左侧钩码")}>−</button><output>{leftForce.toFixed(1)} N</output><button onClick={() => adjust(setLeftForce, .5, .5, 6, "左侧钩码")}>＋</button></div><div><label>悬挂格数</label><button onClick={() => adjust(setLeftArm, -.5, 1, 9, "左侧悬点")}>←</button><output>{leftArm.toFixed(1)} 格</output><button onClick={() => adjust(setLeftArm, .5, 1, 9, "左侧悬点")}>→</button></div></article>
      <article><header><span>RIGHT / 右侧钩码</span><strong>F₂l₂ = {lever.rightMoment.toFixed(1)}</strong></header><div><label>钩码重力</label><button onClick={() => adjust(setRightForce, -.5, .5, 6, "右侧钩码")}>−</button><output>{rightForce.toFixed(1)} N</output><button onClick={() => adjust(setRightForce, .5, .5, 6, "右侧钩码")}>＋</button></div><div><label>悬挂格数</label><button onClick={() => adjust(setRightArm, -.5, 1, 9, "右侧悬点")}>←</button><output>{rightArm.toFixed(1)} 格</output><button onClick={() => adjust(setRightArm, .5, 1, 9, "右侧悬点")}>→</button></div></article>
      <aside><span>当前任务</span><strong>{challenge.label}</strong><p>{balanced ? "已经水平，可以保存这一组实验数据。" : calibrated ? "观察下沉方向，再决定改变力还是力臂。" : "调平时杠杆上不应悬挂钩码。"}</p><button disabled={!balanced || evidence.some((row) => row.leftForce === leftForce && row.leftArm === leftArm && row.rightForce === rightForce && row.rightArm === rightArm)} onClick={saveBalance}><Save size={15} />记录平衡数据</button></aside>
    </div>
    <Suspense fallback={<ScienceModuleLoading title="杠杆作用线诊断装置" />}><LeverForceLineDiagnostic
        force={rightForce}
        pivotDistance={rightArm}
        angle={forceLineAngle}
        trials={forceLineTrials}
        perpendicularArm={forceLine.perpendicularArm}
        moment={forceLine.moment}
        comparison={forceLineComparison}
        invariantReady={leverInvariant.stable}
        onAngleChange={setForceLineAngle}
        onRecord={recordForceLine}
      /></Suspense>
    <div className={`lever-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>平衡实验记录</b></span><small>{evidence.length ? `已保存 ${evidence.length} 组` : "至少记录 3 组不同配置，寻找共同关系"}</small></header>{evidence.length ? <div className="lever-table"><b>序号</b><b>F₁/N</b><b>l₁/格</b><b>F₂/N</b><b>l₂/格</b><b>检验</b>{evidence.map((row, index) => <div className="lever-table-row" key={row.id}><span>{evidence.length - index}</span><span>{row.leftForce.toFixed(1)}</span><span>{row.leftArm.toFixed(1)}</span><span>{row.rightForce.toFixed(1)}</span><span>{row.rightArm.toFixed(1)}</span><strong>{(row.leftForce * row.leftArm).toFixed(1)} = {(row.rightForce * row.rightArm).toFixed(1)}</strong></div>)}</div> : <p>当 F₁l₁ 与 F₂l₂ 足够接近时，“记录平衡数据”按钮会解锁。</p>}</div>
    {evidence.length > 0 && <EvidenceVerdict valid={leverLearningReady} title={!calibrated ? "当前空杠杆尚未调平" : leverLearningReady ? "平衡条件与斜拉力臂证据均已完成" : leverInvariant.stable ? "平衡条件成立，还需完成斜拉作用线诊断" : "证据仍不足以归纳平衡条件"} detail={!calibrated ? "已保存的历史记录保留；本次配置需要先调平空杠杆，再挂码操作。" : leverInvariant.enoughPoints ? `各组 F₁l₁÷F₂l₂ 的最大相对偏差为 ${((leverInvariant.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%；${forceLineEvidenceReady ? "已保存的同F、同r作用线对照支持按垂直距离确定力臂。" : forceLineComparison.reason}` : `当前只有 ${leverInvariant.pointCount} 组不同配置，还需记录 ${3 - leverInvariant.pointCount} 组。`} />}
  </LabFrame>;
}
