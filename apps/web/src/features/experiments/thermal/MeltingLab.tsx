import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { calculateIceMeltingState, analyzeTimedPlateauEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue } from "../shared/ScienceLabPrimitives";
import { Beaker, Gauge, Flame, TimerReset, Save, ClipboardList, RotateCcw } from "lucide-react";
import { useThermalRunClock } from "./useThermalRunClock";
import { appendTimedReading } from "./timedReadings";
import "./thermalRecords.css";

interface MeltingReading { id: number; time: number; temperature: number; phase: "solid" | "melting" | "liquid"; melted: number; }

const meltingPhaseLabels = { solid: "固态冰升温", melting: "冰水共存，正在熔化", liquid: "冰已熔尽，水升温" } as const;
const MELTING_RUN_LIMIT_SECONDS = 150;

export function MeltingLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mass, setMass] = useState(20);
  const [power, setPower] = useState(100);
  const [iceAdded, setIceAdded] = useState(false);
  const [thermometerPlaced, setThermometerPlaced] = useState(false);
  const [bathReady, setBathReady] = useState(false);
  const [prediction, setPrediction] = useState<"rise" | "plateau" | "cool">();
  const clock = useThermalRunClock(MELTING_RUN_LIMIT_SECONDS, 1, 80);
  const { elapsedSeconds: time, running, complete } = clock;
  const [readings, setReadings] = useState<MeltingReading[]>([]);
  const state = calculateIceMeltingState(time, power, mass);
  const setupReady = iceAdded && thermometerPlaced && bathReady;
  const toggleHeat = () => { if (!setupReady || complete) return; clock.toggle(); };
  const saveReading = () => {
    if (!setupReady || time === 0) return;
    const row = { id: Date.now(), time: Math.round(time), temperature: Number(state.temperature.toFixed(1)), phase: state.phase, melted: Number((state.meltedFraction * 100).toFixed(0)) };
    setReadings((items) => appendTimedReading(items, row));
    recordHarness("configuration.changed", { experiment: "thermal-melting", control: "记录熔化读数", value: `${row.time}s/${row.temperature}℃/${meltingPhaseLabels[row.phase]}` });
  };
  const reset = () => { setIceAdded(false); setThermometerPlaced(false); setBathReady(false); setPrediction(undefined); clock.reset(); setReadings([]); };
  const curvePoints = Array.from({length:90},(_,index) => { const sampleTime=index/89*Math.max(1,time); const sample=calculateIceMeltingState(sampleTime,power,mass); return `${35+sampleTime/MELTING_RUN_LIMIT_SECONDS*500},${175-(sample.temperature+12)*1.65}`; }).join(" ");
  const hasSolidWarmingEvidence = readings.some((row) => row.phase === "solid");
  const meltingPlatformEvidence = analyzeTimedPlateauEvidence(readings.filter((row) => row.phase === "melting").map((row) => ({time:row.time,value:row.temperature})),10,.2);
  const hasPlatformEvidence = meltingPlatformEvidence.plateau;
  const meltingConclusionReady = hasSolidWarmingEvidence && hasPlatformEvidence;
  useEffect(() => {
    const issues = complete&&!meltingConclusionReady ? ["本轮已到达150秒观察上限；可补记末次读数。若仍缺升温或跨时平台证据，请重置后重新取样。"] : !iceAdded ? ["先向试管加入碎冰。"] : !thermometerPlaced ? ["放置温度计，玻璃泡应与碎冰充分接触。"] : !bathReady ? ["把试管放入水浴，准备均匀加热。"] : time === 0 ? ["开始加热，并按时间间隔记录温度和状态。"] : !hasSolidWarmingEvidence ? ["先在冰仍低于0℃时保存一组固态升温读数。"] : !hasPlatformEvidence ? ["在熔化阶段记录至少两组温度相近且相隔10秒以上的数据。"] : [];
    publishApparatusSnapshot({ module: "thermal-melting", capturedAt: new Date().toISOString(), origin: iceAdded || time > 0 ? "learner" : "system", controls: [
      { id: "mass", label: "碎冰质量", value: mass, unit: "g", source: "control" }, { id: "power", label: "等效加热功率", value: power, unit: "W", source: "control" }, { id: "prediction", label: "熔化时温度预测", value: prediction === "rise" ? "继续升高" : prediction === "plateau" ? "保持不变" : prediction === "cool" ? "降低" : "未选择", source: "control" }
    ], apparatus: [
      { id: "ice-added", label: "试管已加入碎冰", value: iceAdded, source: "apparatus" }, { id: "thermometer", label: "温度计已放置", value: thermometerPlaced, source: "apparatus" }, { id: "water-bath", label: "水浴装置已准备", value: bathReady, source: "apparatus" }, { id: "heating", label: "正在加热", value: running, source: "apparatus" }, { id: "time", label: "实验时间", value: time, unit: "s", source: "apparatus" }, { id: "observation-complete", label: "已到观察上限，需重置开始新一轮", value: complete, source: "apparatus" }
    ], readings: [
      { id: "temperature", label: "温度计示数", value: setupReady ? state.temperature : null, unit: "℃", source: "reading" }, { id: "phase", label: "物质状态", value: setupReady ? meltingPhaseLabels[state.phase] : "等待装置准备", source: "reading" }, { id: "melted", label: "熔化比例", value: setupReady ? state.meltedFraction * 100 : null, unit: "%", source: "reading" }
    ], derived: [
      { id: "energy-model", label: "热量模型", value: "冰升温：Q=cmΔT；熔化：Q=mL；水升温：Q=cmΔT", source: "model" },
      { id: "model-boundary", label: "模拟边界", value: "标准压强、均匀受热；未计容器吸热和散热波动", source: "model" },
      { id: "stage-evidence", label: "升温段与熔化平台证据齐全", value: meltingConclusionReady, source: "model" }
    ], validity: { ready: meltingConclusionReady, issues } });
  }, [bathReady, complete, hasPlatformEvidence, hasSolidWarmingEvidence, iceAdded, mass, meltingConclusionReady, power, prediction, running, setupReady, state.meltedFraction, state.phase, state.temperature, thermometerPlaced, time]);
  return <LabFrame field="thermal" experiment="thermal-melting" eyebrow="ICE MELTING LOGGER / 冰熔化记录仪" title="定时读温度、看状态，亲手找到 0℃ 熔化平台" description="把碎冰放入试管，用水浴均匀加热并定时记录。模型按冰的比热容 2.1 J/(g·℃)、熔化潜热 334 J/g 和水的比热容 4.2 J/(g·℃)计算；未计容器吸热与环境散热波动。12.5倍加速演示，显示秒数是实验时间；暂停冻结仿真时刻，不模拟冷却。" running={running} onToggle={toggleHeat} playLabel="开始水浴加热" runningLabel="暂停加热读数" actionDisabled={!setupReady || complete} disabledLabel={complete ? "本轮已结束，请重置" : !iceAdded ? "请先加入碎冰" : !thermometerPlaced ? "请先放好温度计" : "请先准备水浴"}>
    {complete && <p className="thermal-run-notice" role="status">本轮已到达 {MELTING_RUN_LIMIT_SECONDS} s 观察上限，可保存末次读数。重新实验会清空当前取样。<button onClick={reset}>重置当前实验</button></p>}
    <div className="melting-setup-console"><section><span><b>01</b>实验条件</span><div><label>碎冰</label>{[20,30,40].map(value=><button className={mass===value?"active":""} disabled={iceAdded} onClick={()=>setMass(value)} key={value}>{value} g</button>)}</div><div><label>功率</label>{[60,100,140].map(value=><button className={power===value?"active":""} disabled={time>0} onClick={()=>setPower(value)} key={value}>{value} W</button>)}</div></section><section><span><b>02</b>组装装置</span><button className={iceAdded?"done":""} disabled={iceAdded} onClick={()=>setIceAdded(true)}><Beaker size={15}/>{iceAdded?"碎冰已装入试管":"向试管加入碎冰"}</button><button className={thermometerPlaced?"done":""} disabled={!iceAdded||thermometerPlaced} onClick={()=>setThermometerPlaced(true)}><Gauge size={15}/>{thermometerPlaced?"温度计已放好":"放置温度计"}</button><button className={bathReady?"done":""} disabled={!thermometerPlaced||bathReady} onClick={()=>setBathReady(true)}><Flame size={15}/>{bathReady?"水浴已准备":"把试管放入水浴"}</button></section><section><span><b>03</b>实验预测</span><p>冰正在熔化时，继续吸热，温度怎样变化？</p><div>{(["rise","plateau","cool"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="rise"?"继续升高":value==="plateau"?"保持不变":"逐渐降低"}</button>)}</div></section></div>
    <div className={`melting-lab-sim phase-${state.phase} ${running?"heating":""}`} style={{"--melted":state.meltedFraction,"--melt-temp":Math.max(0,Math.min(1,(state.temperature+10)/30))} as React.CSSProperties}>
      <div className="melting-procedure-strip">{["装碎冰", "放温度计", "水浴加热", "定时取样", "识别平台"].map((label,index)=>{const activeStage=!iceAdded?0:!thermometerPlaced?1:!bathReady?2:!meltingConclusionReady?3:4;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="melting-water-bath"><span className="bath-water"/><div className="melting-test-tube"><span className="melting-sample">{Array.from({length:9},(_,index)=><i style={{"--ice":index,opacity:Math.max(.08,1-state.meltedFraction*1.3)} as React.CSSProperties} key={index}/>)}</span><em>{meltingPhaseLabels[state.phase]}</em></div><div className="melting-thermometer"><i style={{height:`${18+Math.max(0,Math.min(74,(state.temperature+10)*.74))}%`}}/><strong>{setupReady?`${state.temperature.toFixed(1)}℃`:"— —"}</strong></div></div>
      <div className={`melting-heater-live ${running?"on":""}`}><Flame size={34}/><span><small>WATER BATH HEATER</small><strong>{complete?"本轮观察已结束":running?`${power} W 加热中`:time>0?"加热已暂停":"等待启动"}</strong></span></div>
      <svg viewBox="0 0 570 230" aria-label="冰的熔化温度时间图像"><line x1="35" y1="20" x2="35" y2="190"/><line x1="35" y1="190" x2="545" y2="190"/><line className="melting-zero-line" x1="35" y1="155" x2="545" y2="155"/><text x="4" y="22">T/℃</text><text x="4" y="159">0℃</text><text x="492" y="215">t/s</text>{time>0&&<polyline points={curvePoints}/>} {readings.map(row=><g className="melting-sample-point" key={row.id}><circle cx={35+row.time/150*500} cy={175-(row.temperature+12)*1.65} r="5"/><text x={42+row.time/150*500} y={170-(row.temperature+12)*1.65}>{row.temperature}°</text></g>)}</svg>
      <div className="melting-phase-meter"><span><small>PHASE PROGRESS / 物态进程</small><strong>{state.phase==="solid"?"固态":state.phase==="melting"?`熔化 ${Math.round(state.meltedFraction*100)}%`:"液态"}</strong></span><div><i className={state.phase==="solid"?"active":"done"}>冰升温</i><i className={state.phase==="melting"?"active":state.phase==="liquid"?"done":""}>0℃熔化</i><i className={state.phase==="liquid"?"active":""}>水升温</i></div></div>
      <div className={`melting-live-reading ${meltingConclusionReady?"valid":""}`}><TimerReset size={19}/><span><small>MANUAL SAMPLE / 手动取样</small><strong>{setupReady?`${time.toFixed(0)} s · ${state.temperature.toFixed(1)}℃ · ${meltingPhaseLabels[state.phase]}`:"等待装置准备"}</strong><em>{state.phase==="melting"?"正在吸收熔化潜热，温度保持在0℃。":"建议在固态升温阶段先记录一次，再继续寻找平台。"}</em></span><button disabled={!setupReady||time===0} onClick={saveReading}><Save size={15}/>记录此刻</button></div>
      {!setupReady&&<InteractionCue text={!iceAdded?"先向试管加入碎冰":!thermometerPlaced?"让温度计玻璃泡与碎冰充分接触":"把试管放入水浴中均匀加热"}/>}
    </div>
    <div className="melting-evidence-workbench"><section className="thermal-timed-readings"><header><span><ClipboardList size={17}/><b>温度与状态记录表</b></span><small>{readings.length} 组取样</small></header>{readings.length?<div><b>t/s</b><b>T/℃</b><b>物质状态</b><b>已熔化</b>{readings.map(row=><div className="melting-reading-row" key={row.id}><span>{row.time}</span><strong>{row.temperature.toFixed(1)}</strong><span>{meltingPhaseLabels[row.phase]}</span><strong>{row.melted}%</strong></div>)}</div>:<p>先在冰低于0℃时记录升温点，再在冰水共存阶段记录两个平台点。</p>}</section><aside className={meltingConclusionReady?"ready":""}><span>阶段证据检查</span><strong>{meltingConclusionReady?`已记录固态升温段和跨 ${meltingPlatformEvidence.timeSpan.toFixed(0)} s 的0℃平台。`:complete?"本轮观察已结束；可补记末次读数，若仍缺证据请重置后重新取样。":!hasSolidWarmingEvidence?"还缺少冰低于0℃时的固态升温读数。":`平台点时间跨度 ${meltingPlatformEvidence.timeSpan.toFixed(0)} / 10 s，继续加热后再取样。`}</strong>{prediction&&meltingConclusionReady&&<p>{prediction==="plateau"?"原预测与数据一致。":"数据显示熔化时温度保持不变，请修正原预测。"}</p>}<button onClick={reset}><RotateCcw size={15}/>重置当前实验</button></aside></div>
  </LabFrame>;
}
