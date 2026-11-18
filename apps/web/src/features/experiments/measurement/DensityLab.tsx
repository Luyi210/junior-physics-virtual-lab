import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { calculateDensity, analyzeMeasurementError } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ResultCell } from "../shared/ScienceLabPrimitives";
import { Scale, Eye, Save, Activity, RotateCcw, ClipboardList } from "lucide-react";
import { densityGeometry, type DensityImmersionCondition } from "./densityGeometry";
import "./DensityLab.css";

const densitySamples = {
  aluminum: { name: "铝块", density: 2.7, volume: 20, color: "#9ba8ad" },
  iron: { name: "铁块", density: 7.8, volume: 12, color: "#485760" },
  stone: { name: "石块", density: 2.5, volume: 25, color: "#68747b" }
} as const;

type DensitySampleKey = keyof typeof densitySamples;

export type EyePosition = "high" | "level" | "low";

interface DensityEvidence { id: number; sample: string; mass: number; v1: number; v2: number; density: number; }

export function DensityLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [sampleKey, setSampleKey] = useState<DensitySampleKey>();
  const [massMeasured, setMassMeasured] = useState(false);
  const [waterAdded, setWaterAdded] = useState(false);
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [v1, setV1] = useState<number>();
  const [immersed, setImmersed] = useState(false);
  const [immersionCondition, setImmersionCondition] = useState<DensityImmersionCondition>("correct");
  const [v2, setV2] = useState<number>();
  const [calculated, setCalculated] = useState(false);
  const [evidence, setEvidence] = useState<DensityEvidence[]>([]);
  const [errorTrials, setErrorTrials] = useState<string[]>([]);
  const sample = sampleKey ? densitySamples[sampleKey] : undefined;
  const mass = sample ? sample.density * sample.volume : 0;
  const actualV1 = 50;
  const actualV2 = sample ? actualV1 + sample.volume : actualV1;
  const geometry = densityGeometry({ waterAdded, sampleVolumeCm3: sample?.volume ?? null, immersed, condition: immersionCondition });
  const visibleVolume = geometry.volumeMl + (eyePosition === "high" ? 2 : eyePosition === "low" ? -2 : 0);
  const objectVolume = v1 !== undefined && v2 !== undefined ? v2 - v1 : undefined;
  const measuredDensity = objectVolume && massMeasured ? calculateDensity(mass, objectVolume) : undefined;
  const complete = calculated && measuredDensity !== undefined;
  const errorAnalysisComplete = errorTrials.includes("bubbles") && errorTrials.includes("partial");
  const highV2Density = sample ? calculateDensity(mass, sample.volume + 2) : 0;
  const lowV2Density = sample ? calculateDensity(mass, sample.volume - 2) : 0;
  const highV2Error = sample ? analyzeMeasurementError(highV2Density, sample.density) : undefined;
  const lowV2Error = sample ? analyzeMeasurementError(lowV2Density, sample.density) : undefined;
  const stage = !sample ? 0 : !massMeasured ? 1 : !waterAdded || v1 === undefined ? 2 : !immersed || v2 === undefined ? 3 : !calculated ? 4 : 5;
  const resetMeasurement = (nextSample?: DensitySampleKey) => { setSampleKey(nextSample); setMassMeasured(false); setWaterAdded(false); setEyePosition("high"); setV1(undefined); setImmersed(false); setImmersionCondition("correct"); setV2(undefined); setCalculated(false); setErrorTrials([]); };
  const readVolume = () => {
    if (eyePosition !== "level" || !waterAdded) return;
    if (immersed && immersionCondition === "correct") { setV2(actualV2); recordHarness("configuration.changed", { experiment: "measurement-density", control: "记录V₂", value: actualV2, unit: "mL" }); }
    else if (!immersed) { setV1(actualV1); recordHarness("configuration.changed", { experiment: "measurement-density", control: "记录V₁", value: actualV1, unit: "mL" }); }
  };
  const observeImmersionError = (condition: Exclude<DensityImmersionCondition,"correct">) => {
    if (!complete || !sample) return;
    setImmersed(true);
    setImmersionCondition(condition);
    setEyePosition("level");
    setErrorTrials((items) => items.includes(condition) ? items : [...items,condition]);
    recordHarness("configuration.changed", { experiment: "measurement-density", control: condition === "bubbles" ? "气泡附着误差演练" : "未完全浸没误差演练", value: condition === "bubbles" ? highV2Density : lowV2Density, unit: "g/cm³" });
  };
  const save = () => {
    if (!sample || !complete || !errorAnalysisComplete || v1 === undefined || v2 === undefined || measuredDensity === undefined) return;
    const row = { id: Date.now(), sample: sample.name, mass, v1, v2, density: measuredDensity };
    setEvidence((items) => [row, ...items.filter((item) => item.sample !== sample.name)].slice(0, 5));
    recordHarness("configuration.changed", { experiment: "measurement-density", control: "保存密度结果", value: `${sample.name}/${measuredDensity.toFixed(2)}g/cm³` });
  };
  useEffect(() => {
    const issues = evidence.length ? [] : !sample ? ["先选择一个不吸水、能完全浸没的待测样品。"] : !massMeasured ? ["先用天平测出样品质量。"] : !waterAdded ? ["向量筒加入适量水。"] : v1 === undefined ? [eyePosition === "level" ? "读取并记录初始体积V₁。" : "视线应与凹液面最低处相平。"] : !immersed ? ["用细线让样品完全浸没，且不要接触筒底。"] : v2 === undefined ? [immersionCondition !== "correct" ? "排除气泡或未完全浸没的错误状态后，再记录正式V₂。" : eyePosition === "level" ? "读取并记录末体积V₂。" : "调整视线到与凹液面最低处相平。"] : !calculated ? ["用ρ=m/(V₂−V₁)计算密度。"] : !errorAnalysisComplete ? ["分别制造气泡附着和未完全浸没，观察液面与密度误差方向。"] : ["恢复正确浸没状态并保存本次规范测量证据。"];
    publishApparatusSnapshot({ module: "measurement-density", capturedAt: new Date().toISOString(), origin: sample ? "learner" : "system", controls: [
      { id: "sample", label: "待测材料", value: sample?.name ?? "未选择", source: "control" }, { id: "eye-position", label: "读数视线", value: eyePosition === "level" ? "平视" : eyePosition === "high" ? "俯视" : "仰视", source: "control" }, { id: "immersion-condition", label: "浸没状态", value: !immersed ? "未浸入" : immersionCondition === "correct" ? "完全浸没且无气泡" : immersionCondition === "bubbles" ? "表面附着气泡" : "未完全浸没", source: "control" }
    ], apparatus: [
      { id: "mass-measured", label: "质量已测量", value: massMeasured, source: "apparatus" }, { id: "water-added", label: "量筒已加水", value: waterAdded, source: "apparatus" }, { id: "immersed", label: "样品完全浸没", value: immersed && immersionCondition !== "partial", source: "apparatus" }, { id: "stage", label: "当前步骤", value: stage + 1, source: "apparatus" }
    ], readings: [
      { id: "mass", label: "样品质量", value: massMeasured ? mass : null, unit: "g", source: "reading" }, { id: "v1", label: "初始体积V₁", value: v1 ?? null, unit: "mL", source: "reading" }, { id: "v2", label: "末体积V₂", value: v2 ?? null, unit: "mL", source: "reading" }, { id: "density", label: "计算密度", value: complete ? measuredDensity ?? null : null, unit: "g/cm³", source: "reading" }
    ], derived: [
      { id: "formula", label: "密度公式", value: "ρ=m/(V₂−V₁)", source: "model" },
      { id: "error-analysis", label: "气泡与部分浸没误差已验证", value: errorAnalysisComplete, source: "model" }, { id: "formal-v2-lock", label: "正式V₂不被错误演练改写", value: v2 !== undefined, source: "model" }
    ], validity: { ready: evidence.length > 0, issues } });
  }, [calculated, complete, errorAnalysisComplete, evidence.length, eyePosition, immersed, immersionCondition, mass, massMeasured, measuredDensity, sample, stage, v1, v2, waterAdded]);
  return <LabFrame field="measurement" experiment="measurement-density" eyebrow="DENSITY MEASUREMENT LINE / 固体密度测量线" title="每一个读数都亲手完成，密度才不是自动出现的答案" description="按真实实验顺序测质量和体积。量筒读数必须平视凹液面最低处；样品应完全浸没、排除表面气泡且不能碰底。正式体积用锁存的 V₂−V₁ 得到，错误演练不会改写规范结果。" running={immersed} onToggle={() => { setImmersed((value) => !value); setImmersionCondition("correct"); setV2(undefined); setCalculated(false); }} playLabel="用细线完全浸没" runningLabel="从量筒取出样品" actionDisabled={!sample || !massMeasured || v1 === undefined} disabledLabel={!sample ? "请先选择样品" : !massMeasured ? "请先称量质量" : "请先记录 V₁"}>
    <div className="density-sample-selector">{(Object.keys(densitySamples) as DensitySampleKey[]).map((key, index) => <button className={sampleKey === key ? "active" : ""} onClick={() => { resetMeasurement(key); recordHarness("configuration.changed", { experiment: "measurement-density", control: "待测材料", value: densitySamples[key].name }); }} key={key}><b>样品 0{index + 1}</b><i style={{ background: densitySamples[key].color }} /><span><strong>{densitySamples[key].name}</strong><small>未知密度 · 待测</small></span></button>)}</div>
    <div className={`density-sim density-measurement-line density-rig-v2 stage-${stage} immersion-${immersionCondition}`}>
      <div className="density-procedure-strip">{["选择样品", "测质量", "读 V₁", "浸没读 V₂", "计算密度", "保存证据"].map((label, index) => <span className={index < stage ? "done" : index === stage ? "active" : ""} key={label}><b>{index < stage ? "✓" : index + 1}</b>{label}</span>)}</div>
      <div className="density-balance-station"><div className="density-digital-scale"><Scale size={26} /><span className="scale-platform">{sample && <i style={{ background: sample.color }} />}</span><output>{massMeasured ? `${mass.toFixed(1)} g` : "— — g"}</output><small>DIGITAL BALANCE</small></div><button disabled={!sample || massMeasured} onClick={() => { setMassMeasured(true); recordHarness("configuration.changed", { experiment: "measurement-density", control: "天平称量", value: mass, unit: "g" }); }}>{massMeasured ? "质量已记录" : "测量并记录质量"}</button></div>
      <div className="density-cylinder-station density-cylinder-v2"><DensityCylinder geometry={geometry} sampleName={sample?.name} sampleColor={sample?.color} eyePosition={eyePosition} visibleVolume={visibleVolume} /><button disabled={!sample || !massMeasured || waterAdded} onClick={() => setWaterAdded(true)}>{waterAdded ? "已加入 50 mL 水" : "向量筒加入适量水"}</button><p className="density-cylinder-caption">等截面样品示意，外形尺寸不用于测量。刻度读凹液面最低处；部分浸没演练露出 2 cm³。</p></div>
      <div className={`density-eye-reader eye-${eyePosition}`}><Eye size={27} /><span><small>{immersionCondition==="bubbles"?"错误：样品表面附着气泡":immersionCondition==="partial"?"错误：样品没有完全浸没":eyePosition === "level" ? "视线已与凹液面相平" : eyePosition === "high" ? "当前俯视，会产生读数偏差" : "当前仰视，会产生读数偏差"}</small><strong>{waterAdded ? `可见刻度约 ${visibleVolume.toFixed(0)} mL` : "等待量筒加水"}</strong></span><div><button onClick={() => setEyePosition("high")}>俯视</button><button className={eyePosition === "level" ? "active" : ""} onClick={() => setEyePosition("level")}>平视</button><button onClick={() => setEyePosition("low")}>仰视</button></div><button className="density-read-button" disabled={!waterAdded || eyePosition !== "level" || immersionCondition!=="correct" || immersed && v2 !== undefined || !immersed && v1 !== undefined} onClick={readVolume}>{immersed ? v2 !== undefined ? `正式 V₂ 已锁存 ${v2} mL` : immersionCondition!=="correct"?"先排除浸没错误":"记录末体积 V₂" : v1 !== undefined ? `V₁ 已记录 ${v1} mL` : "记录初始体积 V₁"}</button></div>
      <div className={`density-result ${complete ? "complete" : "awaiting-reading"}`}><small>{complete ? "MEASUREMENT COMPLETE" : `CURRENT STEP 0${stage + 1}`}</small><strong>{complete && measuredDensity !== undefined ? `${measuredDensity.toFixed(2)} g/cm³` : "— —"}</strong><span>{objectVolume !== undefined ? `${mass.toFixed(1)} ÷ (${v2}−${v1})` : "ρ = m / (V₂−V₁)"}</span></div>
      {!sample && <InteractionCue text="选择一个待测样品，启动完整测量流程" />}
    </div>
    <div className="density-calculation-console"><ResultCell label="样品质量 m" value={massMeasured ? `${mass.toFixed(1)} g` : "等待称量"} pending={!massMeasured} /><ResultCell label="初始体积 V₁" value={v1 !== undefined ? `${v1} mL` : "等待平视读数"} pending={v1 === undefined} /><ResultCell label="末体积 V₂" value={v2 !== undefined ? `${v2} mL（已锁存）` : "等待完全浸没"} pending={v2 === undefined} /><ResultCell label="物体体积 V₂−V₁" value={objectVolume !== undefined ? `${objectVolume} cm³` : "等待两个体积读数"} pending={objectVolume === undefined} /><button disabled={objectVolume === undefined || !massMeasured || calculated} onClick={() => setCalculated(true)}>{calculated ? "密度计算完成" : "代入公式计算密度"}</button><button disabled={!complete||!errorAnalysisComplete||immersionCondition!=="correct"} onClick={save}><Save size={15} />{immersionCondition!=="correct"?"先恢复规范浸没":"保存本次结果"}</button></div>
    <section className="measurement-error-lab"><header><span><Activity size={17}/><b>浸没操作误差诊断</b></span><small>真实改变装置液面，正式 V₂ 保持锁存</small></header><div><button className={errorTrials.includes("bubbles")?"done":""} disabled={!complete||!sample} onClick={()=>observeImmersionError("bubbles")}><span><b>让样品表面附着气泡</b><em>气泡也排开水 → V₂−V₁ 偏大</em></span><strong>{highV2Error?`${highV2Density.toFixed(2)} g/cm³ · 密度偏低 ${Math.abs(highV2Error.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button><button className={errorTrials.includes("partial")?"done":""} disabled={!complete||!sample} onClick={()=>observeImmersionError("partial")}><span><b>让样品露出液面一部分</b><em>排水体积不足 → V₂−V₁ 偏小</em></span><strong>{lowV2Error?`${lowV2Density.toFixed(2)} g/cm³ · 密度偏高 ${Math.abs(lowV2Error.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button></div><button className="density-restore-condition" disabled={!complete||immersionCondition==="correct"} onClick={()=>setImmersionCondition("correct")}><RotateCcw size={14}/>排除气泡并恢复完全浸没</button></section>
    <div className={`density-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>材料密度记录</b></span><small>{evidence.length ? `已完成 ${evidence.length} 种材料` : "完成一种后可更换样品继续测量"}</small></header>{evidence.length ? <div><b>材料</b><b>m / g</b><b>V₁ / mL</b><b>V₂ / mL</b><b>V物 / cm³</b><b>ρ / (g/cm³)</b>{evidence.map((row) => <div className="density-evidence-row" key={row.id}><strong>{row.sample}</strong><span>{row.mass.toFixed(1)}</span><span>{row.v1}</span><span>{row.v2}</span><span>{row.v2 - row.v1}</span><strong>{row.density.toFixed(2)}</strong></div>)}</div> : <p>完成称量、两次平视读数和公式计算后，保存第一种材料的密度。</p>}</div>
  </LabFrame>;
}

export function DensityCylinder({ geometry, sampleName, sampleColor, eyePosition, visibleVolume }: { geometry: ReturnType<typeof densityGeometry>; sampleName?: string; sampleColor?: string; eyePosition: EyePosition; visibleVolume: number }) {
  const { object, surfaceY, volumeMl } = geometry;
  const submergedTop = object ? Math.max(object.top, surfaceY) : 0;
  const submergedHeight = object ? Math.max(0, object.bottom - submergedTop) : 0;
  const description = !object ? "尚未选择样品" : geometry.submergedFraction === 0 ? `${sampleName}未浸入水中` : geometry.fullyImmersed ? `${sampleName}完全浸没且不接触筒底` : `${sampleName}部分浸没，露出 2 cm³`;
  // The meniscus rises at the walls; its central minimum and scale share one y.
  const meniscus = `M32 ${surfaceY - 5}Q38 ${surfaceY} 48 ${surfaceY}H110Q120 ${surfaceY} 126 ${surfaceY - 5}`;
  return <svg className="density-cylinder-drawing" viewBox={geometry.viewBox} role="img" aria-label={`100 mL 量筒，液面最低处对应 ${volumeMl} mL。${description}${geometry.bubbleVolumeMl ? "，附着气泡另排开 2 mL 水" : ""}。`} data-volume-ml={volumeMl} data-submerged-volume-cm3={geometry.submergedVolumeCm3}>
    <path d="M28 42V354H130V42" fill="rgba(149,193,204,.05)" stroke="#a7babb" strokeWidth="8" strokeLinejoin="round" />
    {volumeMl > 0 && <path d={`${meniscus}V350H32Z`} fill="#50b2d9" opacity=".55" />}
    {object && <>
      <path d={`M${object.left + object.width / 2} 0V${object.top}`} fill="none" stroke="#c4d8d8" strokeWidth="1.2" />
      <rect x={object.left} y={object.top} width={object.width} height={object.height} fill={sampleColor} stroke="#d5e2dc" strokeWidth="1.5" />
      {submergedHeight > 0 && <rect x={object.left} y={submergedTop} width={object.width} height={submergedHeight} fill="#7bd3ee" opacity=".25" />}
      {geometry.bubbleVolumeMl > 0 && Array.from({ length: 5 }, (_, index) => <circle key={index} cx={object.left + (index % 2 ? object.width : 0)} cy={object.top + 6 + index * (object.height - 12) / 4} r="4" fill="#baddeb" fillOpacity=".45" stroke="#e8fbff" />)}
    </>}
    {volumeMl > 0 && <path d={meniscus} fill="none" stroke="#bcf1f9" strokeWidth="1.5" />}
    {geometry.ticks.map((tick) => <g key={tick.volumeMl} data-tick-ml={tick.volumeMl}><path d={`M${tick.major ? 107 : 115} ${tick.y}H126`} stroke={tick.major ? "#deeeeb" : "#9bbabf"} strokeWidth={tick.major ? 1.5 : 1} />{tick.major && <text x="138" y={tick.y + 3.5} className="density-scale-number">{tick.volumeMl}</text>}</g>)}
    <text x="148" y="32" textAnchor="middle" className="density-cylinder-note">mL</text>
    <text x="90" y="376" textAnchor="middle" className="density-cylinder-reading">{volumeMl > 0 ? `目测约 ${visibleVolume.toFixed(0)} mL` : "空量筒"}</text>
    <text x="90" y="393" textAnchor="middle" className="density-cylinder-note">{eyePosition === "level" ? "平视凹液面最低处" : eyePosition === "high" ? "俯视读数偏大" : "仰视读数偏小"}</text>
  </svg>;
}
