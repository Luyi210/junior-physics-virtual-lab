import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect } from "react";
import { analyzeBottomContactBuoyancyError, analyzeControlledComparison, analyzeTargetVariableComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Focus, Gauge, Save, ClipboardList, AlertTriangle } from "lucide-react";
import { buoyancyGeometry } from "./buoyancyGeometry";
import "./BuoyancyLab.css";

const buoyancyObjects = {
  aluminum: { label: "铝柱", density: 2.7, volume: 100, color: "#aeb9bb" },
  stone: { label: "石柱", density: 2.5, volume: 120, color: "#78817d" },
  iron: { label: "铁柱", density: 7.8, volume: 60, color: "#4c5b5f" }
} as const;

const buoyancyLiquids = {
  oil: { label: "植物油", density: .8, color: "#d8b95e" },
  water: { label: "清水", density: 1, color: "#55b9df" },
  brine: { label: "浓盐水", density: 1.2, color: "#83d7df" }
} as const;

type BuoyancyObjectKey = keyof typeof buoyancyObjects;

type BuoyancyLiquidKey = keyof typeof buoyancyLiquids;

interface BuoyancyEvidence { id: number; object: string; liquid: string; liquidDensity: number; gravity: number; apparent: number; buoyancy: number; }

export function BuoyancyLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [objectKey, setObjectKey] = useState<BuoyancyObjectKey>("aluminum");
  const [liquidKey, setLiquidKey] = useState<BuoyancyLiquidKey>("water");
  const [zeroed, setZeroed] = useState(false);
  const [airRecorded, setAirRecorded] = useState(false);
  const [depth, setDepth] = useState(0);
  const [liquidReading, setLiquidReading] = useState<number>();
  const [touchingBottom, setTouchingBottom] = useState(false);
  const [bottomErrorObserved, setBottomErrorObserved] = useState(false);
  const [evidence, setEvidence] = useState<BuoyancyEvidence[]>([]);
  const object = buoyancyObjects[objectKey];
  const liquid = buoyancyLiquids[liquidKey];
  const gravity = object.density * object.volume / 100;
  const geometry = buoyancyGeometry({ objectVolumeCm3: object.volume, immersionPercent: depth, touchingBottom });
  const buoyancy = liquid.density * geometry.displacedVolumeCm3 / 100;
  const apparentWeight = Math.max(0, gravity - buoyancy);
  const bottomSupport = Math.min(apparentWeight * .4, gravity * .3);
  const bottomApparentWeight = Math.max(0, apparentWeight - bottomSupport);
  const visibleApparentWeight = touchingBottom ? bottomApparentWeight : apparentWeight;
  const bottomError = analyzeBottomContactBuoyancyError(gravity, apparentWeight, bottomApparentWeight);
  const fullyImmersed = depth === 100;
  const canCalculate = airRecorded && liquidReading !== undefined;
  const measuredBuoyancy = liquidReading === undefined ? null : gravity - liquidReading;
  const buoyancyPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.object,evidence[1]!.liquidDensity],[evidence[0]!.object,evidence[0]!.liquidDensity],evidence[1]!.buoyancy,evidence[0]!.buoyancy,.001):undefined;
  const liquidComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>analyzeTargetVariableComparison([older.object,older.liquidDensity],[newer.object,newer.liquidDensity],older.buoyancy,newer.buoyancy,1,.2,"same-direction",.001))),[evidence]);
  const liquidEvidence=liquidComparisons.find(comparison=>comparison.validTargetComparison);
  const buoyancyEvidenceReady=Boolean(liquidEvidence);
  const buoyancyConclusion=liquidEvidence?{valid:true,title:"液体密度强对照成立：物体保持不变",detail:`液体密度变化 ${Math.abs(liquidEvidence.targetChange).toFixed(1)} g/cm³，完全浸没时测得的浮力随液体密度同向变化。`} : !buoyancyPair?undefined:!buoyancyPair.valid?{valid:false,title:"最近两组同时更换了物体和液体",detail:"本任务研究液体密度的影响，请使用同一个物体，只更换液体。"}:buoyancyPair.changedIndexes[0]===0?{valid:false,title:"这组比较更换了物体",detail:"允许保留探索数据，但不能作为本任务结论；请固定物体，只更换密度至少相差 0.2 g/cm³ 的液体。"}:{valid:false,title:"液体已单独更换，但数据趋势需要复核",detail:"确认物体完全浸没、不碰杯底并静止后读数，再重新测量。"};
  const resetRun = (nextObject = objectKey, nextLiquid = liquidKey) => {
    setObjectKey(nextObject); setLiquidKey(nextLiquid); setZeroed(false); setAirRecorded(false); setDepth(0); setLiquidReading(undefined); setTouchingBottom(false);
  };
  const lower = () => {
    if (!airRecorded) return;
    const next = Math.min(100, depth + 25);
    setDepth(next); setLiquidReading(undefined); setTouchingBottom(false);
    recordHarness("control.changed", { experiment: "mechanics-buoyancy", control: "浸入程度", value: next, unit: "%" });
  };
  const recordLiquidReading = () => {
    if (!fullyImmersed || touchingBottom) return;
    setLiquidReading(apparentWeight);
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "液中示数F'", value: apparentWeight.toFixed(2), unit: "N" });
  };
  const toggleBottomContact = () => {
    if (!fullyImmersed) return;
    const next = !touchingBottom;
    setTouchingBottom(next);
    if (next) setBottomErrorObserved(true);
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "杯底接触误差", value: next ? `碰底示数${bottomApparentWeight.toFixed(2)}N` : "物体已提离杯底" });
  };
  const save = () => {
    if (!canCalculate || !bottomErrorObserved || measuredBuoyancy === null || liquidReading === undefined) return;
    const row = { id: Date.now(), object: object.label, liquid: liquid.label, liquidDensity: liquid.density, gravity, apparent: liquidReading, buoyancy: measuredBuoyancy };
    setEvidence((items) => [row, ...items.filter((item) => !(item.object === row.object && item.liquid === row.liquid))].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "保存浮力数据", value: `${row.object}/${row.liquid}/${row.buoyancy.toFixed(2)}N` });
  };
  useEffect(() => {
    const issues = buoyancyEvidenceReady ? [] : !zeroed ? ["先检查弹簧测力计是否归零。"] : !airRecorded ? ["物体静止悬挂在空气中时，记录重力G。"] : !fullyImmersed ? ["逐步下放物体，直到完全浸没且不碰杯底。"] : liquidReading === undefined ? [touchingBottom ? "物体碰底时存在杯底支持力，必须提离杯底后再记录F'。" : "物体稳定后锁存液体中的正式示数F'。"] : !bottomErrorObserved ? ["完成一次碰底错误演练，比较示数和浮力误差方向。"] : evidence.length < 2 ? ["保存本组后，保持物体不变并更换另一种液体。"] : buoyancyPair&&!buoyancyPair.valid?["最近两组同时更换了物体和液体。"]:buoyancyPair?.changedIndexes[0]===0?["最近两组更换了物体；本任务需要固定物体、只换液体。"]:["复核完全浸没、不碰底和静止读数条件。"];
    publishApparatusSnapshot({ module: "mechanics-buoyancy", capturedAt: new Date().toISOString(), origin: zeroed || airRecorded || depth > 0 ? "learner" : "system", controls: [
      { id: "object", label: "待测物体", value: object.label, source: "control" }, { id: "object-volume", label: "物体体积", value: object.volume, unit: "cm³", source: "control" }, { id: "liquid", label: "液体", value: liquid.label, source: "control" }, { id: "liquid-density", label: "液体密度", value: liquid.density, unit: "g/cm³", source: "control" }, { id: "depth", label: "浸入程度", value: depth, unit: "%", source: "control" }
    ], apparatus: [
      { id: "zeroed", label: "测力计已校零", value: zeroed, source: "apparatus" }, { id: "air-recorded", label: "空气中示数已记录", value: airRecorded, source: "apparatus" }, { id: "fully-immersed", label: "物体完全浸没", value: fullyImmersed, source: "apparatus" }, { id: "touching-bottom", label: "物体接触杯底", value: touchingBottom, source: "apparatus" }
    ], readings: [
      { id: "gravity", label: "空气中重力G", value: airRecorded ? gravity : null, unit: "N", source: "reading" }, { id: "visible-force", label: "测力计当前示数", value: zeroed ? visibleApparentWeight : null, unit: "N", source: "reading" }, { id: "apparent-weight", label: "已锁存正式示数F'", value: liquidReading ?? null, unit: "N", source: "reading" }, { id: "buoyancy", label: "称重法浮力G−F'", value: measuredBuoyancy, unit: "N", source: "reading" }
    ], derived: [
      { id: "formula", label: "称重法", value: "F浮=G−F'", source: "model" }, { id: "partial-model", label: "部分浸入模型", value: "同形直柱体：排开体积随浸入百分比线性增加", source: "model" }, { id: "bottom-error", label: "碰底支持力误差已诊断", value: bottomErrorObserved, source: "model" },{id:"latest-comparison",label:"最近两组公平比较",value:buoyancyPair?.valid??false,source:"model"},{id:"liquid-density-evidence",label:"同一物体的液体密度强对照",value:buoyancyEvidenceReady,source:"model"}
    ], validity: { ready: buoyancyEvidenceReady, issues } });
  }, [airRecorded, bottomErrorObserved, buoyancyEvidenceReady, buoyancyPair?.changedIndexes, buoyancyPair?.valid, canCalculate, depth, evidence.length, fullyImmersed, gravity, liquid.density, liquid.label, liquidReading, measuredBuoyancy, object.label, object.volume, touchingBottom, visibleApparentWeight, zeroed]);
  return <LabFrame field="mechanics" experiment="mechanics-buoyancy" eyebrow="BUOYANCY WEIGHING RIG / 浮力称重台" title="把“变轻了多少”真正测出来，而不是只看上浮或下沉" description="先测物体在空气中的重力 G，再逐步浸入液体并观察弹簧测力计示数。物体完全浸没、静止且不碰容器时记录 F′，最后用 F浮=G−F′ 计算。取 g=10 N/kg。" running={false} onToggle={lower} playLabel="下放物体一档" actionDisabled={!airRecorded || fullyImmersed} disabledLabel={!airRecorded ? "先记录空气中重力" : "物体已完全浸没"}>
    <div className="buoyancy-selection-console"><section><span><b>01</b>选择物体</span><div>{(Object.keys(buoyancyObjects) as BuoyancyObjectKey[]).map((key) => <button className={objectKey === key ? "active" : ""} onClick={() => resetRun(key, liquidKey)} key={key}><i style={{ background: buoyancyObjects[key].color }} /><strong>{buoyancyObjects[key].label}</strong><small>{buoyancyObjects[key].volume} cm³</small></button>)}</div></section><section><span><b>02</b>选择液体</span><div>{(Object.keys(buoyancyLiquids) as BuoyancyLiquidKey[]).map((key) => <button className={liquidKey === key ? "active" : ""} onClick={() => resetRun(objectKey, key)} key={key}><i style={{ background: buoyancyLiquids[key].color }} /><strong>{buoyancyLiquids[key].label}</strong><small>ρ={buoyancyLiquids[key].density}</small></button>)}</div></section><section><span><b>03</b>仪器准备</span><button className={zeroed ? "done" : ""} disabled={zeroed} onClick={() => { setZeroed(true); recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "弹簧测力计", value: "校零完成" }); }}><Focus size={15} />{zeroed ? "测力计已校零" : "检查并校零"}</button></section></div>
    <div className={`buoyancy-lab-sim buoyancy-rig-v2 depth-${depth} ${fullyImmersed ? "fully-immersed" : ""} ${touchingBottom ? "touching-bottom" : ""}`}>
      <div className="buoyancy-procedure-strip">{["测力计校零", "测空气中重力", "逐步浸入", "锁存F′", "碰底诊断", "计算对照"].map((label, index) => { const activeStage = !zeroed ? 0 : !airRecorded ? 1 : !fullyImmersed ? 2 : liquidReading === undefined ? 3 : !bottomErrorObserved ? 4 : 5; return <span className={index < activeStage ? "done" : index === activeStage ? "active" : ""} key={label}><b>{index < activeStage ? "✓" : index + 1}</b>{label}</span>; })}</div>
      <BuoyancyApparatus geometry={geometry} objectLabel={object.label} objectColor={object.color} liquidLabel={liquid.label} liquidColor={liquid.color} liquidDensity={liquid.density} gravity={gravity} buoyancy={buoyancy} support={touchingBottom ? bottomError.supportForce : 0} reading={zeroed ? visibleApparentWeight : null} />
      <div className="buoyancy-depth-meter"><span><small>IMMERSION / 浸入程度</small><strong>{depth}%</strong></span><div>{[0,25,50,75,100].map((value) => <i className={depth >= value ? "filled" : ""} key={value}><b>{value}</b></i>)}</div></div>
      <div className={`buoyancy-live-reading ${canCalculate ? "valid" : ""} ${touchingBottom ? "danger" : ""}`}><Gauge size={19} /><span><small>{touchingBottom ? "BOTTOM CONTACT / 杯底接触" : fullyImmersed ? "FULLY IMMERSED / 完全浸没" : "LIVE FORCE / 实时受力"}</small><strong>{!zeroed ? "先校零" : !airRecorded ? `空气中示数 ${gravity.toFixed(2)} N` : `测力计当前示数 ${visibleApparentWeight.toFixed(2)} N`}</strong><em>{touchingBottom ? "杯底支持力使测力计示数偏小，此时禁止记录正式数据。" : liquidReading !== undefined ? `正式 F′ 已锁存为 ${liquidReading.toFixed(2)} N，后续瞬时变化不会改写它。` : fullyImmersed ? "物体静止、完全浸没且不碰底，可锁存正式示数。" : depth > 0 ? "浸入体积增加，排开液体的体积随之增加。" : "先保存空气中的重力基准。"}</em></span></div>
      {!zeroed && <InteractionCue text="实验前检查弹簧测力计指针是否归零" />}
      <p className="buoyancy-rig-caption">等截面直柱体与容器的示意图，外形尺寸不用于测量。浸入高度比例与排液体积比例一致；完全浸没后继续下放，排液体积不再增加。图中只标部分力的方向，物体还受到悬线拉力；箭长不表示大小。</p>
    </div>
    <div className="buoyancy-operation-dock"><section><span>空气中基准</span><strong>{airRecorded ? `G = ${gravity.toFixed(2)} N` : "等待记录"}</strong><button disabled={!zeroed || airRecorded} onClick={() => { setAirRecorded(true); recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "空气中重力G", value: gravity.toFixed(2), unit: "N" }); }}><Save size={15} />记录空气中重力</button></section><section><span>浸入控制</span><strong>{depth === 0 ? "物体在液面上方" : depth < 100 ? `已浸入 ${depth}%` : touchingBottom ? "完全浸没并接触杯底" : "完全浸没且保持悬空"}</strong><div><button disabled={!airRecorded || depth === 0} onClick={() => { setDepth((value) => Math.max(0, value - 25)); setLiquidReading(undefined); setTouchingBottom(false); }}>上提一档</button><button disabled={!airRecorded || fullyImmersed} onClick={lower}>下放一档</button></div></section><section><span>正式示数与误差</span><strong>{touchingBottom ? `错误示数 ${bottomApparentWeight.toFixed(2)} N` : liquidReading !== undefined ? `F′ 已锁存 ${liquidReading.toFixed(2)} N` : fullyImmersed ? "等待稳定读数" : "完全浸没后读取"}</strong><div><button className={touchingBottom ? "danger" : ""} disabled={!fullyImmersed} onClick={toggleBottomContact}>{touchingBottom ? "提离杯底" : "下放至碰底"}</button><button disabled={!fullyImmersed || touchingBottom || liquidReading !== undefined} onClick={recordLiquidReading}><Save size={15} />锁存 F′</button></div></section><aside><span>称重法计算</span><strong>{measuredBuoyancy !== null && liquidReading !== undefined ? `${gravity.toFixed(2)} − ${liquidReading.toFixed(2)} = ${measuredBuoyancy.toFixed(2)} N` : "F浮 = G − F′"}</strong><button disabled={!canCalculate || !bottomErrorObserved} onClick={save}><ClipboardList size={15} />{!bottomErrorObserved ? "先完成碰底诊断" : "保存本组证据"}</button></aside></div>
    <section className={`buoyancy-bottom-diagnostic ${bottomErrorObserved ? "observed" : ""} ${touchingBottom ? "active" : ""}`}>
      <header><span><AlertTriangle size={17} /><b>BOTTOM-CONTACT ERROR / 碰底误差诊断</b></span><small>{bottomErrorObserved ? "错误机理已识别" : "完成一次错误演练后才可提交"}</small></header>
      <div>
        <article><span>悬空正式示数 F′</span><strong>{fullyImmersed ? `${apparentWeight.toFixed(2)} N` : "— —"}</strong><small>只受重力、浮力和拉力</small></article>
        <article><span>碰底错误示数</span><strong>{bottomErrorObserved ? `${bottomApparentWeight.toFixed(2)} N` : "待演练"}</strong><small>杯底额外提供向上的支持力</small></article>
        <article><span>若误用碰底示数</span><strong>{bottomErrorObserved ? `${bottomError.erroneousBuoyancy.toFixed(2)} N` : "G − F′错误"}</strong><small>{bottomErrorObserved ? `会高估 ${bottomError.absoluteError.toFixed(2)} N（${bottomError.percentError?.toFixed(0) ?? 0}%）` : "结论方向等待验证"}</small></article>
      </div>
      {bottomErrorObserved && <EvidenceVerdict valid={!touchingBottom} title={touchingBottom ? "当前仍处于错误状态：请先提离杯底" : "已确认：碰底会让称重法浮力偏大"} detail={`杯底支持力 N=${bottomError.supportForce.toFixed(2)} N，使弹簧测力计示数减小同样的量；代入 G−F′ 后，这部分支持力会被误算成浮力。`} />}
    </section>
    <div className={`buoyancy-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>同一物体的液体密度证据</b></span><small>{buoyancyEvidenceReady?"液体密度强对照已建立":evidence.length?`有效数据 ${evidence.length} 组 · 还需固定物体换液体`:"固定物体，只更换液体"}</small></header>{evidence.length ? <div><b>组次</b><b>物体</b><b>液体</b><b>G / N</b><b>F′ / N</b><b>F浮 / N</b>{evidence.map((row, index) => <div className="buoyancy-evidence-row" key={row.id}><span>{evidence.length-index}</span><strong>{row.object}</strong><strong>{row.liquid}<small>ρ={row.liquidDensity.toFixed(1)}</small></strong><span>{row.gravity.toFixed(2)}</span><span>{row.apparent.toFixed(2)}</span><strong>{row.buoyancy.toFixed(2)}</strong></div>)}</div> : <p>完成空气中和液体中的读数并保存基准；随后保持同一物体，只更换另一种液体。</p>}{buoyancyConclusion&&<EvidenceVerdict valid={buoyancyConclusion.valid} title={buoyancyConclusion.title} detail={buoyancyConclusion.detail}/>}</div>
  </LabFrame>;
}

export function BuoyancyApparatus({ geometry, objectLabel, objectColor, liquidLabel, liquidColor, liquidDensity, gravity, buoyancy, support, reading }: { geometry: ReturnType<typeof buoyancyGeometry>; objectLabel: string; objectColor: string; liquidLabel: string; liquidColor: string; liquidDensity: number; gravity: number; buoyancy: number; support: number; reading: number | null }) {
  const { vessel, object, surfaceY } = geometry;
  const submergedTop = Math.max(object.top, surfaceY);
  const submergedHeight = Math.max(0, object.bottom - submergedTop);
  const middle = object.top + object.height / 2;
  return <svg className="buoyancy-apparatus-drawing" viewBox={geometry.viewBox} role="img" aria-label={`${objectLabel}浸入 ${geometry.submergedFraction * 100}%，排开液体 ${geometry.displacedVolumeCm3} cm³，${support > 0 ? "已碰杯底" : "保持悬空"}。${reading === null ? "测力计待校零" : `测力计示数 ${reading.toFixed(2)} N`}。`} data-displaced-volume={geometry.displacedVolumeCm3}>
    <text x="290" y="27" textAnchor="middle" className="buoyancy-drawing-title">弹簧测力计 · 0–5 N</text>
    <rect x="255" y="42" width="70" height="173" rx="8" fill="#dbe3de" stroke="#9aafad" strokeWidth="3" />
    {Array.from({ length: 11 }, (_, index) => <g key={index}><path d={`M268 ${68 + index * 10}h${index % 2 ? 12 : 19}`} stroke="#4a6668" />{index % 2 === 0 && <text x="314" y={72 + index * 10} textAnchor="end" className="buoyancy-gauge-number">{index / 2}</text>}</g>)}
    {reading !== null && <path d={`M263 ${68 + reading / 5 * 100}h33`} stroke="#bf674b" strokeWidth="3" />}
    <text x="290" y="196" textAnchor="middle" className="buoyancy-gauge-number">{reading === null ? "未校零" : `${reading.toFixed(2)} N`}</text>
    <path d="M290 215v9" stroke="#aebfba" strokeWidth="3" /><circle cx="290" cy="232" r="8" fill="#405c60" stroke="#aebfba" strokeWidth="2" /><text x="312" y="236" className="buoyancy-drawing-note">调节悬线下放</text>
    <rect x={vessel.left} y={surfaceY} width={vessel.right - vessel.left} height={vessel.bottom - surfaceY} fill={liquidColor} opacity=".5" />
    <path d={`M${vessel.left - 4} ${vessel.top - 6}V${vessel.bottom + 4}H${vessel.right + 4}V${vessel.top - 6}`} fill="none" stroke="#a3bbbd" strokeWidth="8" strokeLinejoin="round" />
    <path d={`M${geometry.suspension.x} ${geometry.suspension.top}V${geometry.suspension.bottom}`} stroke="#d5dfd8" strokeWidth="1.5" />
    <rect x={object.left} y={object.top} width={object.width} height={object.height} fill={objectColor} stroke={support > 0 ? "#f3a08a" : "#d6e0d9"} strokeWidth="2" />
    {submergedHeight > 0 && <rect x={object.left} y={submergedTop} width={object.width} height={submergedHeight} fill={liquidColor} opacity=".25" />}
    <text x="290" y={middle + 4} textAnchor="middle" className="buoyancy-drawing-object-label">{objectLabel}</text>
    <path d={`M${vessel.left} ${surfaceY}H${vessel.right}`} stroke="#d4f1f0" strokeWidth="2" />
    <text x={vessel.left + 10} y={surfaceY - 9} className="buoyancy-drawing-note">液面</text>
    <g className="buoyancy-drawing-forces"><path d={`M475 ${middle - 10}v62m-5-7 5 7 5-7`} fill="none" stroke="#eac275" strokeWidth="2" /><text x="475" y={middle + 68} textAnchor="middle">G {gravity.toFixed(2)} N</text>{buoyancy > 0 && <><path d={`M530 ${middle + 30}v-62m-5 7 5-7 5 7`} fill="none" stroke="#96e3e5" strokeWidth="2" /><text x="530" y={middle - 44} textAnchor="middle">F浮 {buoyancy.toFixed(2)} N</text></>}{support > 0 && <text x="290" y={vessel.bottom - 10} textAnchor="middle" fill="#ffd1bd">杯底支持力 N = {support.toFixed(2)} N ↑</text>}</g>
    <text x="290" y="578" textAnchor="middle" className="buoyancy-drawing-note">{liquidLabel} · ρ液 = {liquidDensity} g/cm³</text>
    <text x="470" y="620" textAnchor="middle" className="buoyancy-drawing-note">部分力方向示意 · 箭长不表示大小</text>
  </svg>;
}
