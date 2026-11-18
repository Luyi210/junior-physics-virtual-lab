import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect } from "react";
import { calculateWaterBoilingPoint, calculateHeatingTemperature, analyzeTimedPlateauEvidence, analyzeTargetVariableComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Beaker, Gauge, TimerReset, Save, ClipboardList, RotateCcw } from "lucide-react";
import { useThermalRunClock } from "./useThermalRunClock";
import { appendTimedReading } from "./timedReadings";
import "./thermalRecords.css";

interface ThermalReading { id: number; time: number; temperature: number; phase: string; }

const boilingEnvironments = {
  highland: { label: "高原低压", pressure: 75 },
  standard: { label: "标准大气压", pressure: 101.325 },
  pressurized: { label: "增压环境", pressure: 150 }
} as const;

type BoilingEnvironmentKey = keyof typeof boilingEnvironments;

interface BoilingRunEvidence { id:number; environment:BoilingEnvironmentKey; label:string; pressure:number; boilingPoint:number; timeToBoil:number; mass:number; power:number; }

const BOILING_RUN_LIMIT_SECONDS = 360;

export function ThermalLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const clock = useThermalRunClock(BOILING_RUN_LIMIT_SECONDS, 1.2, 50);
  const { elapsedSeconds: time, running, complete } = clock;
  const [power, setPower] = useState(800);
  const [mass, setMass] = useState(200);
  const [environmentKey,setEnvironmentKey]=useState<BoilingEnvironmentKey>("standard");
  const [waterAdded, setWaterAdded] = useState(false);
  const [thermometerPlaced, setThermometerPlaced] = useState(false);
  const [hasHeated, setHasHeated] = useState(false);
  const [prediction, setPrediction] = useState<"rise" | "plateau" | "cool">();
  const [readings, setReadings] = useState<ThermalReading[]>([]);
  const [runEvidence,setRunEvidence]=useState<BoilingRunEvidence[]>([]);
  const environment=boilingEnvironments[environmentKey];
  const boilingPoint=calculateWaterBoilingPoint(environment.pressure);
  const temperature = calculateHeatingTemperature(time, power, mass,25,boilingPoint);
  const setupReady = waterAdded && thermometerPlaced;
  const phase = !hasHeated ? "等待加热" : temperature >= boilingPoint-.2 ? "沸腾平台" : "持续升温";
  const warmingEvidence = readings.some((row) => row.phase === "持续升温");
  const boilingPlatformEvidence = analyzeTimedPlateauEvidence(readings.filter((row) => row.phase === "沸腾平台").map((row) => ({time:row.time,value:row.temperature})),10,.3);
  const boilingEvidence = boilingPlatformEvidence.plateau;
  const boilingConclusionReady = warmingEvidence && boilingEvidence;
  const pressureComparisons=useMemo(()=>runEvidence.flatMap((newer,index)=>runEvidence.slice(index+1).map(older=>({newer,older,comparison:analyzeTargetVariableComparison([older.mass,older.power,older.pressure],[newer.mass,newer.power,newer.pressure],older.boilingPoint,newer.boilingPoint,2,20,"same-direction",.2)}))),[runEvidence]);
  const pressureEvidence=pressureComparisons.find(item=>item.comparison.validTargetComparison);
  const boilingPressureEvidenceReady=Boolean(pressureEvidence);
  const graphPoints = Array.from({ length: 60 }, (_, i) => { const sampleTime = i / 59 * Math.max(1, time); const sampleTemperature = calculateHeatingTemperature(sampleTime, power, mass,25,boilingPoint); return `${35 + sampleTime / BOILING_RUN_LIMIT_SECONDS * 485},${190 - (sampleTemperature - 20) * 1.75}`; }).join(" ");
  const boilingLineY=190-(boilingPoint-20)*1.75;
  const toggleHeat = () => {
    if (!setupReady || complete) return;
    clock.toggle();
    if (!running) { setHasHeated(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "酒精灯", value: "点燃" }); }
  };
  const saveReading = () => {
    if (!setupReady || !hasHeated || time === 0) return;
    const row = { id: Date.now(), time: Number(time.toFixed(0)), temperature: Number(temperature.toFixed(1)), phase };
    setReadings((items) => appendTimedReading(items, row));
    recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "温度读数", value: `${row.time}s/${row.temperature}℃`, phase });
  };
  const resetRun = () => { clock.reset(); setWaterAdded(false); setThermometerPlaced(false); setHasHeated(false); setPrediction(undefined); setReadings([]); };
  const chooseEnvironment=(key:BoilingEnvironmentKey)=>{setEnvironmentKey(key);resetRun();recordHarness("configuration.changed",{experiment:"thermal-boiling",control:"外界气压环境",value:`${boilingEnvironments[key].label}/${boilingEnvironments[key].pressure}kPa`});};
  const saveRun=()=>{if(!boilingConclusionReady)return;const timeToBoil=(boilingPoint-25)*4.2*mass/(.85*power);const row={id:Date.now(),environment:environmentKey,label:environment.label,pressure:environment.pressure,boilingPoint,timeToBoil,mass,power};setRunEvidence(items=>[row,...items.filter(item=>item.environment!==row.environment||item.mass!==row.mass||item.power!==row.power)].slice(0,8));recordHarness("configuration.changed",{experiment:"thermal-boiling",control:"保存完整沸腾曲线",value:`${row.label}/${row.pressure}kPa/${row.boilingPoint.toFixed(1)}℃`});};
  useEffect(() => {
    const issues = boilingPressureEvidenceReady?[]:complete&&!boilingConclusionReady?["本轮已到达360秒观察上限；可补记末次读数。若仍缺升温或跨时平台证据，请重置后重新取样。"]:!waterAdded ? ["先向烧杯加入定量的水。"] : !thermometerPlaced ? ["放入温度计，确保玻璃泡浸入水中且不碰杯底。"] : !hasHeated ? ["装置准备完成，可以点燃酒精灯。"] : !warmingEvidence ? ["先在沸腾前记录至少一组升温数据。"] : !boilingEvidence ? ["继续加热，在当前气压对应的沸腾平台记录相隔10秒以上的两组温度。"] : !runEvidence.some(item=>item.environment===environmentKey&&item.mass===mass&&item.power===power)?["保存当前完整曲线，再保持水量和火力不变切换另一种气压环境。"]:["保持水量和火力不变，切换气压至少相差20 kPa的环境并完成第二条曲线。"];
    publishApparatusSnapshot({
      module: "thermal-boiling", capturedAt: new Date().toISOString(), origin: waterAdded || thermometerPlaced || hasHeated ? "learner" : "system",
      controls: [
        { id: "heater-power", label: "加热器等效功率", value: power, unit: "W", source: "control" },
        { id: "water-mass", label: "水的质量", value: mass, unit: "g", source: "control" },
        { id: "pressure", label: "外界气压", value: environment.pressure, unit: "kPa", source: "control" },
        { id: "prediction", label: "沸腾后温度预测", value: prediction === "rise" ? "继续升高" : prediction === "plateau" ? "基本不变" : prediction === "cool" ? "逐渐降低" : "未选择", source: "control" }
      ],
      apparatus: [
        { id: "water-added", label: "烧杯已加水", value: waterAdded, source: "apparatus" },
        { id: "thermometer-placed", label: "温度计已正确放置", value: thermometerPlaced, source: "apparatus" },
        { id: "heating", label: "酒精灯正在加热", value: running, source: "apparatus" },
        { id: "elapsed-time", label: "实验时间", value: time, unit: "s", source: "apparatus" },
        { id: "observation-complete", label: "已到观察上限，需重置开始新一轮", value: complete, source: "apparatus" },
        { id: "saved-readings", label: "已记录读数", value: readings.length, unit: "组", source: "apparatus" }
      ],
      readings: [
        { id: "temperature", label: "温度计示数", value: hasHeated ? temperature : null, unit: "℃", source: "reading" },
        { id: "phase", label: "当前阶段", value: phase, source: "reading" }
      ],
      derived: [
        { id: "model", label: "升温模型", value: "ηPt=cmΔT；达到当前气压对应沸点后保持平台", source: "model" },
        { id: "boiling-point", label: "当前气压水的沸点", value: boilingPoint, unit: "℃", source: "model" },
        { id: "boiling-platform", label: "当前曲线升温与平台证据齐全", value: boilingConclusionReady, source: "model" },
        { id: "pressure-evidence", label: "固定水量火力的气压—沸点证据", value: boilingPressureEvidenceReady, source: "model" }
      ],
      validity: { ready: boilingPressureEvidenceReady, issues }
    });
  }, [boilingConclusionReady, boilingEvidence, boilingPoint, boilingPressureEvidenceReady, complete, environment.pressure, environmentKey, hasHeated, mass, phase, power, prediction, readings.length, runEvidence, running, temperature, thermometerPlaced, time, warmingEvidence, waterAdded]);
  return <LabFrame field="thermal" experiment="thermal-boiling" eyebrow="BOILING OBSERVATION STATION / 沸腾观察台" title="先找到沸腾平台，再用两种气压解释沸点为什么变化" description="按 ηPt=cmΔT 模拟升温，达到当前外界气压对应的沸点后温度保持平台。保持水量和火力不变，比较高原、标准大气压或增压环境；火力影响到达沸点的快慢，气压决定沸点高低。未计容器吸热和蒸发质量变化。24倍加速演示，显示秒数是实验时间；暂停冻结仿真时刻，不模拟冷却。" running={running} onToggle={toggleHeat} playLabel="点燃酒精灯" runningLabel="暂停加热读数" actionDisabled={!setupReady || complete} disabledLabel={complete ? "本轮已结束，请重置" : !waterAdded ? "请先向烧杯加水" : "请先放好温度计"}>
    {complete && <p className="thermal-run-notice" role="status">本轮已到达 {BOILING_RUN_LIMIT_SECONDS} s 观察上限，可保存末次读数。重新实验会清空当前取样，已保存的气压对照保留。<button onClick={resetRun}>重置当前实验</button></p>}
    <div className="thermal-setup-console">
      <section><span><b>01</b><small>选择实验条件</small></span><div><label>水量</label>{[150, 200, 300].map((value) => <button className={mass === value ? "active" : ""} disabled={waterAdded} onClick={() => setMass(value)} key={value}>{value} g</button>)}</div><div><label>火力</label>{[500, 800, 1100].map((value) => <button className={power === value ? "active" : ""} disabled={hasHeated} onClick={() => setPower(value)} key={value}>{value} W</button>)}</div><div className="thermal-pressure-options"><label>气压</label>{(Object.keys(boilingEnvironments) as BoilingEnvironmentKey[]).map(key=><button className={environmentKey===key?"active":""} disabled={hasHeated} onClick={()=>chooseEnvironment(key)} key={key}><b>{boilingEnvironments[key].label}</b><small>{boilingEnvironments[key].pressure} kPa</small></button>)}</div></section>
      <section><span><b>02</b><small>组装实验装置</small></span><button className={waterAdded ? "done" : ""} disabled={waterAdded} onClick={() => { setWaterAdded(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "烧杯", value: `加入${mass}g水` }); }}><Beaker size={16} />{waterAdded ? `已加入 ${mass} g 水` : "向烧杯加水"}</button><button className={thermometerPlaced ? "done" : ""} disabled={!waterAdded || thermometerPlaced} onClick={() => { setThermometerPlaced(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "温度计", value: "正确放置" }); }}><Gauge size={16} />{thermometerPlaced ? "温度计已放好" : "放入温度计"}</button></section>
      <section><span><b>03</b><small>先预测再观察</small></span><p>水沸腾后继续加热，温度会怎样？</p><div className="thermal-prediction-buttons">{(["rise", "plateau", "cool"] as const).map((value) => <button className={prediction === value ? "active" : ""} onClick={() => { setPrediction(value); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "实验预测", value }); }} key={value}>{value === "rise" ? "继续升高" : value === "plateau" ? "基本不变" : "逐渐降低"}</button>)}</div></section>
    </div>
    <div className={`thermal-sim thermal-observation-station ${setupReady ? "ready" : "setting-up"}`}>
      <div className="thermal-stage-label"><span>LIVE EXPERIMENT · {environment.pressure} kPa</span><b>{complete ? "本轮观察已结束" : running ? "正在加热" : hasHeated ? "加热已暂停" : setupReady ? "等待点火" : "装置准备中"}</b></div>
      <div className={`beaker-water ${waterAdded ? "filled" : "empty"} ${temperature >= boilingPoint-.2 ? "boiling" : "warming"}`} style={{ "--water-temp": `${temperature}%` } as React.CSSProperties}><div className="water-level" style={{ height: waterAdded ? `${35 + mass / 8}%` : "0%" }} />{hasHeated && Array.from({ length: temperature >= boilingPoint-.2 ? 15 : 6 }, (_, i) => <i style={{ animationDelay: `${-i * .18}s`, animationPlayState: running ? "running" : "paused", left: `${12 + (i * 23) % 76}%` }} key={i} />)}<small>{waterAdded ? `${mass} g · 沸点约 ${boilingPoint.toFixed(1)}℃` : "空烧杯"}</small></div>
      <div className={`flame ${running ? "on" : ""}`}><i /><i /><i /></div>
      <div className={`thermometer ${thermometerPlaced ? "placed" : "parked"}`}><i style={{ height: `${temperature * .75}%` }} /><span>{thermometerPlaced ? hasHeated ? `${temperature.toFixed(1)}℃` : "25.0℃" : "未放置"}</span></div>
      <svg viewBox="0 0 540 220" aria-label="水的温度时间图像"><line x1="35" y1="20" x2="35" y2="195"/><line x1="35" y1="195" x2="520" y2="195"/><text x="6" y="25">T/℃</text>{hasHeated && <><line className="boil-line" x1="35" y1={boilingLineY} x2="520" y2={boilingLineY}/><polyline points={graphPoints}/><text x="42" y={boilingLineY-6}>{boilingPoint.toFixed(1)}℃</text>{readings.map((row) => <g className="thermal-record-point" key={row.id}><circle cx={35 + row.time / BOILING_RUN_LIMIT_SECONDS * 485} cy={190 - (row.temperature - 20) * 1.75} r="5"/><text x={41 + row.time / BOILING_RUN_LIMIT_SECONDS * 485} y={185 - (row.temperature - 20) * 1.75}>{row.temperature}°</text></g>)}</>}<text x="442" y="212">时间 / s</text></svg>
      <div className={`thermal-live-reading ${hasHeated ? "" : "awaiting-reading"}`}><TimerReset size={19} /><span><small>秒表 / 温度计</small><strong>{hasHeated ? `${time.toFixed(0)} s　·　${temperature.toFixed(1)} ℃` : "— —"}</strong></span><button disabled={!setupReady || !hasHeated || time === 0} onClick={saveReading}><Save size={15} />记录此刻读数</button></div>
      {!setupReady && <InteractionCue text={!waterAdded ? "先向烧杯加入定量的水" : "让温度计玻璃泡浸入水中且不碰杯底"} />}
    </div>
    <div className="thermal-evidence-workbench">
      <section className={`thermal-reading-ledger thermal-timed-readings ${readings.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>温度—时间记录表</b></span><small>{readings.length}/3 组最低证据</small></header>{readings.length ? <div><b>t / s</b><b>T / ℃</b><b>实验阶段</b>{readings.map((row) => <div className="thermal-reading-row" key={row.id}><span>{row.time}</span><strong>{row.temperature.toFixed(1)}</strong><span>{row.phase}</span></div>)}</div> : <p>点火后在不同时间点击“记录此刻读数”，图像上会同步出现观测点。</p>}</section>
      <aside className={boilingConclusionReady ? "ready" : ""}><span>当前曲线证据</span><strong>{boilingConclusionReady ? `已记录跨 ${boilingPlatformEvidence.timeSpan.toFixed(0)} s 的 ${boilingPoint.toFixed(1)}℃ 沸腾平台。` : complete ? "本轮观察已结束；可补记末次读数，若仍缺证据请重置后重新取样。" : !warmingEvidence ? "先记录一组沸腾前的升温数据。" : `平台点时间跨度 ${boilingPlatformEvidence.timeSpan.toFixed(0)} / 10 s，继续加热后再记录。`}</strong>{prediction && boilingConclusionReady && <p>{prediction === "plateau" ? "你的预测与实验现象一致。" : "实际曲线出现平台，请根据证据修正原预测。"}</p>}<button disabled={!boilingConclusionReady} onClick={saveRun}><Save size={15}/>保存完整曲线</button><button onClick={resetRun}><RotateCcw size={15} />重置当前实验</button></aside>
    </div>
    <section className={`boiling-pressure-evidence ${boilingPressureEvidenceReady?"complete":""}`}><header><span><Gauge size={17}/><b>PRESSURE–BOILING POINT / 气压—沸点对照</b></span><small>{boilingPressureEvidenceReady?"固定水量和火力的强对照已建立":"至少保存两个不同气压环境"}</small></header>{runEvidence.length?<div><b>环境</b><b>气压/kPa</b><b>水量/g</b><b>火力/W</b><b>沸点/℃</b><b>到达沸点/s</b>{runEvidence.map(row=><div className="boiling-run-row" key={row.id}><strong>{row.label}</strong><span>{row.pressure}</span><span>{row.mass}</span><span>{row.power}</span><strong>{row.boilingPoint.toFixed(1)}</strong><span>{row.timeToBoil.toFixed(0)}</span></div>)}</div>:<p>先完成并保存当前升温—沸腾平台曲线，再保持水量、火力不变切换气压。</p>}{runEvidence.length>0&&<EvidenceVerdict valid={boilingPressureEvidenceReady} title={boilingPressureEvidenceReady?"气压越高，水的沸点越高":"还不能直接比较这几条曲线"} detail={boilingPressureEvidenceReady&&pressureEvidence?`${pressureEvidence.older.label}与${pressureEvidence.newer.label}的外界气压相差 ${Math.abs(pressureEvidence.comparison.targetChange).toFixed(1)} kPa，沸点同向改变 ${Math.abs(pressureEvidence.newer.boilingPoint-pressureEvidence.older.boilingPoint).toFixed(1)}℃；水量和加热功率保持不变。`:"保持水量和火力不变，只切换气压至少相差20 kPa的环境，并完成第二条曲线。"}/>}</section>
  </LabFrame>;
}
