import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { calculateDensity, analyzeMeasurementError, analyzeInvariantEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Scale, ArrowRight, Eye, Save, Activity, ClipboardList } from "lucide-react";
import { type EyePosition } from "./DensityLab";

const liquidDensitySamples = {
  alcohol: { label: "酒精样品", density: .8, color: "#9acbd5" },
  water: { label: "清水样品", density: 1, color: "#55b9df" },
  brine: { label: "盐水样品", density: 1.2, color: "#80d4dd" }
} as const;

type LiquidDensityKey = keyof typeof liquidDensitySamples;

interface LiquidDensityEvidence { id: number; liquid: string; empty: number; total: number; volume: number; density: number; }

export function LiquidDensityLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [liquidKey, setLiquidKey] = useState<LiquidDensityKey>();
  const [targetVolume, setTargetVolume] = useState(100);
  const [emptyMassReading, setEmptyMassReading] = useState<number>();
  const [filled, setFilled] = useState(false);
  const [totalMassReading, setTotalMassReading] = useState<number>();
  const [transferred, setTransferred] = useState(false);
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [volumeRead, setVolumeRead] = useState<number>();
  const [calculated, setCalculated] = useState(false);
  const [evidence, setEvidence] = useState<LiquidDensityEvidence[]>([]);
  const [errorTrials, setErrorTrials] = useState<string[]>([]);
  const emptyMass = 50;
  const liquid = liquidKey ? liquidDensitySamples[liquidKey] : undefined;
  const liquidMass = liquid ? liquid.density * targetVolume : 0;
  const emptyMeasured = emptyMassReading !== undefined;
  const totalMeasured = totalMassReading !== undefined;
  const beakerContainsLiquid = filled && !transferred;
  const currentBeakerMass = emptyMass + (beakerContainsLiquid ? liquidMass : 0);
  const measuredLiquidMass = emptyMassReading !== undefined && totalMassReading !== undefined ? totalMassReading - emptyMassReading : undefined;
  const visibleVolume = targetVolume + (eyePosition === "high" ? 2 : eyePosition === "low" ? -2 : 0);
  const measuredDensity = volumeRead && measuredLiquidMass !== undefined ? calculateDensity(measuredLiquidMass, volumeRead) : undefined;
  const complete = calculated && measuredDensity !== undefined;
  const errorAnalysisComplete = errorTrials.includes("residue") && errorTrials.includes("parallax");
  const retainedVolume = targetVolume * .95;
  const residueDensity = liquid ? calculateDensity(liquidMass, retainedVolume) : 0;
  const parallaxDensity = liquid ? calculateDensity(liquidMass, targetVolume + 2) : 0;
  const residueError = liquid ? analyzeMeasurementError(residueDensity, liquid.density) : undefined;
  const parallaxError = liquid ? analyzeMeasurementError(parallaxDensity, liquid.density) : undefined;
  const currentLiquidEvidence = liquid ? evidence.filter((row) => row.liquid === liquid.label) : [];
  const densityRepeatability = analyzeInvariantEvidence(currentLiquidEvidence.map((row) => row.density), .02, 2);
  const stage = !liquid ? 0 : !emptyMeasured ? 1 : !filled ? 2 : !totalMeasured ? 3 : !transferred || volumeRead === undefined ? 4 : !calculated ? 5 : 6;
  const resetRun = (next?: LiquidDensityKey) => { setLiquidKey(next); setEmptyMassReading(undefined); setFilled(false); setTotalMassReading(undefined); setTransferred(false); setEyePosition("high"); setVolumeRead(undefined); setCalculated(false); setErrorTrials([]); };
  const save = () => {
    if (!liquid || !complete || !errorAnalysisComplete || emptyMassReading === undefined || totalMassReading === undefined || volumeRead === undefined || measuredDensity === undefined || evidence.some((row) => row.liquid === liquid.label && row.volume === volumeRead)) return;
    const row = { id: Date.now(), liquid: liquid.label, empty: emptyMassReading, total: totalMassReading, volume: volumeRead, density: measuredDensity };
    setEvidence((items) => [row, ...items.filter((item) => item.liquid !== row.liquid || item.volume !== row.volume)].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "measurement-liquid-density", control: "保存液体密度", value: `${row.liquid}/${row.density.toFixed(2)}g/cm³` });
  };
  useEffect(() => {
    const issues = densityRepeatability.stable ? [] : !liquid ? ["先选择一种待测液体。"] : !emptyMeasured ? ["先称量干燥空烧杯质量m₁。"] : !filled ? ["向烧杯加入适量待测液体。"] : !totalMeasured ? ["称量烧杯和液体的总质量m₂。"] : !transferred ? ["把液体倒入量筒测量体积。"] : volumeRead === undefined ? [eyePosition === "level" ? "记录量筒中液体体积V。" : "调整视线与凹液面最低处相平。"] : !calculated ? ["计算液体质量m₂−m₁，再除以体积V。"] : !errorAnalysisComplete ? ["完成烧杯残留与俯视读数两种误差诊断。"] : ["保存本组后，选择同一种液体的另一个体积重新完整测量。"];
    publishApparatusSnapshot({ module: "measurement-liquid-density", capturedAt: new Date().toISOString(), origin: liquid ? "learner" : "system", controls: [
      { id: "liquid", label: "待测液体", value: liquid?.label ?? "未选择", source: "control" }, { id: "target-volume", label: "取液体积", value: targetVolume, unit: "mL", source: "control" }, { id: "eye", label: "量筒读数视线", value: eyePosition === "level" ? "平视" : eyePosition === "high" ? "俯视" : "仰视", source: "control" }
    ], apparatus: [
      { id: "empty-measured", label: "空杯质量已测", value: emptyMeasured, source: "apparatus" }, { id: "filled", label: "烧杯当前有液体", value: beakerContainsLiquid, source: "apparatus" }, { id: "total-measured", label: "总质量已测", value: totalMeasured, source: "apparatus" }, { id: "transferred", label: "液体已倒入量筒", value: transferred, source: "apparatus" }
    ], readings: [
      { id: "m1", label: "已记录的空烧杯质量m₁", value: emptyMassReading ?? null, unit: "g", source: "reading" }, { id: "m2", label: "已记录的烧杯和液体总质量m₂", value: totalMassReading ?? null, unit: "g", source: "reading" }, { id: "current-balance", label: "天平当前示数", value: emptyMeasured && (!filled || totalMeasured) ? currentBeakerMass : null, unit: "g", source: "reading" }, { id: "volume", label: "液体体积V", value: volumeRead ?? null, unit: "mL", source: "reading" }, { id: "density", label: "液体密度", value: complete ? measuredDensity ?? null : null, unit: "g/cm³", source: "reading" }
    ], derived: [
      { id: "formula", label: "差量法", value: "ρ=(m₂−m₁)/V", source: "model" }, { id: "transfer-boundary", label: "规范结果假设液体全部转入量筒", value: true, source: "model" },
      { id: "error-analysis", label: "残留与视差误差已诊断", value: errorAnalysisComplete, source: "model" },
      { id: "repeatability", label: "不同取液体积测得密度稳定", value: densityRepeatability.stable, source: "model" }
    ], validity: { ready: densityRepeatability.stable, issues } });
  }, [beakerContainsLiquid, calculated, complete, currentBeakerMass, densityRepeatability.stable, emptyMassReading, emptyMeasured, errorAnalysisComplete, eyePosition, filled, liquid, measuredDensity, targetVolume, totalMassReading, totalMeasured, transferred, volumeRead]);
  return <LabFrame field="measurement" experiment="measurement-liquid-density" eyebrow="LIQUID DENSITY LINE / 液体密度测量线" title="先扣掉烧杯，再让质量差与体积相遇" description="按差量法依次测空烧杯质量 m₁、烧杯和液体总质量 m₂，再把液体全部转入量筒并平视读取 V。模拟不计烧杯内残留液体，最后按 ρ=(m₂−m₁)/V 计算。" running={transferred} onToggle={() => { if (!transferred) { setTransferred(true); setVolumeRead(undefined); } else { setTransferred(false); setVolumeRead(undefined); setCalculated(false); } }} playLabel="把液体倒入量筒" runningLabel="倒回烧杯重新读数" actionDisabled={!totalMeasured} disabledLabel="请先完成两次称量">
    <div className="liquid-density-selector"><section><span><b>01</b>待测液体</span><div>{(Object.keys(liquidDensitySamples) as LiquidDensityKey[]).map((key) => <button className={liquidKey === key ? "active" : ""} onClick={() => resetRun(key)} key={key}><i style={{background:liquidDensitySamples[key].color}}/><strong>{liquidDensitySamples[key].label}</strong><small>密度未知</small></button>)}</div></section><section><span><b>02</b>取液体积</span><div>{[80,100,120].map((value) => <button className={targetVolume===value?"active":""} disabled={filled} onClick={()=>setTargetVolume(value)} key={value}>{value} mL</button>)}</div></section><section><span><b>03</b>差量思路</span><strong>液体质量 = 总质量 − 空杯质量</strong><small>两次称量必须使用同一个干燥烧杯。</small></section></div>
    <div className={`liquid-density-sim stage-${stage} ${transferred?"transferred":""}`} style={{"--liquid-density-color":liquid?.color??"#55b9df"} as React.CSSProperties}>
      <div className="liquid-density-procedure">{["选液体", "称空杯", "装液复称", "倒入量筒", "平视读数", "差量计算", "保存证据"].map((label,index)=><span className={index<stage?"done":index===stage?"active":""} key={label}><b>{index<stage?"✓":index+1}</b>{label}</span>)}</div>
      <div className="liquid-balance-station"><div className="liquid-digital-balance"><Scale size={25}/><span className={`liquid-beaker-on-scale ${beakerContainsLiquid?"filled":""}`}><i/></span><output aria-label="天平当前示数">{!emptyMeasured?"— — g":filled&&!totalMeasured?"等待复称":`${currentBeakerMass.toFixed(1)} g`}</output><small>{transferred?"液体已转出，空杯放回天平":"天平当前示数"}</small></div><div><button disabled={!liquid||emptyMeasured} onClick={()=>setEmptyMassReading(currentBeakerMass)}>称量空烧杯 m₁</button><button disabled={!emptyMeasured||filled} onClick={()=>setFilled(true)}>向烧杯加入液体</button><button disabled={!filled||totalMeasured} onClick={()=>setTotalMassReading(currentBeakerMass)}>称量总质量 m₂</button></div></div>
      <div className="liquid-transfer-path"><span className={`transfer-beaker ${transferred?"pouring":""}`} aria-hidden="true"><i style={{height:beakerContainsLiquid?"60%":"0%"}}/></span><ArrowRight size={24}/><small>同一烧杯的转移示意 · {transferred?"液体已全部转入":filled?"等待转移":"尚未装液"}</small></div>
      <div className="liquid-cylinder-station"><div className="liquid-density-cylinder"><span style={{height:transferred?`${25+targetVolume*.48}%`:"0%"}}/>{Array.from({length:16},(_,index)=><i className={index%5===0?"major":""} style={{bottom:`${6+index*5.8}%`}} key={index}/>) }<b>{transferred?`目测约 ${visibleVolume.toFixed(0)} mL`:"空量筒"}</b></div></div>
      <div className={`liquid-eye-console eye-${eyePosition}`}><Eye size={25}/><span><small>{eyePosition==="level"?"视线与凹液面最低处相平":eyePosition==="high"?"当前俯视，读数会偏大":"当前仰视，读数会偏小"}</small><strong>{transferred?`可见读数约 ${visibleVolume.toFixed(0)} mL`:"等待液体倒入量筒"}</strong></span><div><button onClick={()=>setEyePosition("high")}>俯视</button><button className={eyePosition==="level"?"active":""} onClick={()=>setEyePosition("level")}>平视</button><button onClick={()=>setEyePosition("low")}>仰视</button></div><button disabled={!transferred||eyePosition!=="level"||volumeRead!==undefined} onClick={()=>{setVolumeRead(targetVolume);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"量筒体积V",value:targetVolume,unit:"mL"});}}>{volumeRead!==undefined?`V 已记录 ${volumeRead} mL`:"记录液体体积 V"}</button></div>
      <div className={`liquid-density-result ${complete?"complete":""}`}><small>{complete?"MEASUREMENT COMPLETE":`CURRENT STEP 0${stage+1}`}</small><strong>{complete&&measuredDensity!==undefined?`${measuredDensity.toFixed(2)} g/cm³`:"— —"}</strong><span>{volumeRead!==undefined?`(${totalMassReading?.toFixed(1)}−${emptyMassReading?.toFixed(1)})÷${volumeRead}`:"ρ=(m₂−m₁)/V"}</span></div>
      {!liquid&&<InteractionCue text="先选择一种待测液体，启动差量法测量"/>}
    </div>
    <div className="liquid-density-calculation"><ResultCell label="已记录空杯质量 m₁" value={emptyMassReading!==undefined?`${emptyMassReading.toFixed(1)} g`:"等待称量"} pending={!emptyMeasured}/><ResultCell label="已记录总质量 m₂" value={totalMassReading!==undefined?`${totalMassReading.toFixed(1)} g`:"等待复称"} pending={!totalMeasured}/><ResultCell label="液体质量 m₂−m₁" value={measuredLiquidMass!==undefined?`${measuredLiquidMass.toFixed(1)} g`:"等待质量差"} pending={!totalMeasured}/><ResultCell label="量筒体积 V" value={volumeRead!==undefined?`${volumeRead} mL`:"等待平视读数"} pending={volumeRead===undefined}/><button disabled={!totalMeasured||volumeRead===undefined||calculated} onClick={()=>setCalculated(true)}>{calculated?"密度计算完成":"代入差量公式"}</button><button disabled={!complete||!errorAnalysisComplete||Boolean(liquid&&volumeRead!==undefined&&evidence.some(row=>row.liquid===liquid.label&&row.volume===volumeRead))} onClick={save}><Save size={15}/>保存本次结果</button></div>
    <section className="measurement-error-lab"><header><span><Activity size={17}/><b>差量法系统误差诊断</b></span><small>规范结果保持不变，错误方案单独推演</small></header><div><button className={errorTrials.includes("residue")?"done":""} disabled={!complete||!liquid} onClick={()=>{setErrorTrials(items=>items.includes("residue")?items:[...items,"residue"]);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"烧杯残留误差演练",value:residueDensity,unit:"g/cm³"});}}><span><b>烧杯残留 5% 液体</b><em>质量仍取原质量差，量筒体积变小</em></span><strong>{residueError?`${residueDensity.toFixed(2)} g/cm³ · 结果偏高 ${Math.abs(residueError.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button><button className={errorTrials.includes("parallax")?"done":""} disabled={!complete||!liquid} onClick={()=>{setErrorTrials(items=>items.includes("parallax")?items:[...items,"parallax"]);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"俯视量筒误差演练",value:parallaxDensity,unit:"g/cm³"});}}><span><b>俯视使体积多读 2 mL</b><em>质量差不变，分母偏大</em></span><strong>{parallaxError?`${parallaxDensity.toFixed(2)} g/cm³ · 结果偏低 ${Math.abs(parallaxError.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button></div></section>
    <div className={`liquid-density-evidence ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>液体密度测量记录</b></span><small>{liquid?`${liquid.label}复测 ${currentLiquidEvidence.length}/2 组`:"选择液体后用两个体积复测"}</small></header>{evidence.length?<div><b>液体</b><b>m₁/g</b><b>m₂/g</b><b>m液/g</b><b>V/mL</b><b>ρ/(g/cm³)</b>{evidence.map(row=><div className="liquid-density-row" key={row.id}><strong>{row.liquid}</strong><span>{row.empty.toFixed(1)}</span><span>{row.total.toFixed(1)}</span><span>{(row.total-row.empty).toFixed(1)}</span><span>{row.volume}</span><strong>{row.density.toFixed(2)}</strong></div>)}</div>:<p>完成第一组后，保持同一种液体，选择另一个体积从空杯称量开始复测。</p>}</div>
    {currentLiquidEvidence.length>0&&<EvidenceVerdict valid={densityRepeatability.stable} title={densityRepeatability.stable?"不同取液体积得到的密度稳定":"还需要第二个不同体积的独立测量"} detail={densityRepeatability.stable?`两组密度平均值 ${densityRepeatability.meanValue?.toFixed(2)} g/cm³，最大相对偏差 ${((densityRepeatability.maxRelativeDeviation??0)*100).toFixed(2)}%。`:"重新选择同一种液体与另一个体积，完整重复空杯称量、装液复称、转移和平视读数。"}/>}
  </LabFrame>;
}
