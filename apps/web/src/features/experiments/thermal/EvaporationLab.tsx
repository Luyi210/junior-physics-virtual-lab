import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect } from "react";
import { calculateEvaporationTrial, analyzeControlledComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, FactorEvidenceStatus, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { RotateCcw, Save } from "lucide-react";
import { useThermalRunClock } from "./useThermalRunClock";
import { appendEvaporationEvidence, createEvaporationEvidence, evaporationComparisonPrompt, evaporationReading, type EvaporationEvidence } from "./evaporationEvidence";
import { EvaporationEvidenceLedger } from "./EvaporationEvidenceLedger";

const INITIAL_WATER_MASS_GRAMS = 50;

export function EvaporationLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [temperature, setTemperature] = useState(25);
  const [area, setArea] = useState(100);
  const [airflow, setAirflow] = useState(0);
  const [duration, setDuration] = useState(60);
  const [prediction, setPrediction] = useState<string>();
  const [evidence, setEvidence] = useState<EvaporationEvidence[]>([]);
  const [saved, setSaved] = useState(false);
  const clock = useThermalRunClock(duration, 2, 200);
  const { elapsedSeconds: elapsed, running, complete: done } = clock;
  const result = calculateEvaporationTrial(INITIAL_WATER_MASS_GRAMS, temperature, area, airflow, elapsed);
  const reading = evaporationReading(INITIAL_WATER_MASS_GRAMS, result.remainingMassGrams, elapsed);
  const evaporationPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.temperature,evidence[1]!.area,evidence[1]!.airflow],[evidence[0]!.temperature,evidence[0]!.area,evidence[0]!.airflow],evidence[1]!.rate,evidence[0]!.rate,.0001):undefined;
  const evaporationComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,comparison:analyzeControlledComparison([older.temperature,older.area,older.airflow],[newer.temperature,newer.area,newer.airflow],older.rate,newer.rate,.0001)}))),[evidence]);
  const temperatureEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===0&&comparison.outcomeDirection===(newer.temperature>older.temperature?"increase":"decrease"));
  const areaEvaporationEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===1&&comparison.outcomeDirection===(newer.area>older.area?"increase":"decrease"));
  const airflowEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===2&&comparison.outcomeDirection===(newer.airflow>older.airflow?"increase":"decrease"));
  const evaporationEvidenceReady=Boolean(temperatureEvidence&&areaEvaporationEvidence&&airflowEvidence);
  const evaporationPredictionMatched=prediction==="升温更快"?Boolean(temperatureEvidence):prediction==="面积更大更快"?Boolean(areaEvaporationEvidence):prediction==="风更快更快"?Boolean(airflowEvidence):false;
  const evaporationConclusion=evaporationEvidenceReady?{valid:true,title:"蒸发三因素证据完整",detail:`升高水温、增大液面面积、加快空气流动均使蒸发速率增大。${evaporationPredictionMatched?"你选择的预测已得到验证。":"请依据三条证据回顾预测。"}`} : temperatureEvidence&&areaEvaporationEvidence?{valid:false,title:"温度与面积证据已完成，还缺空气流动",detail:"保持温度和面积不变，只改变风速再测量。"}:temperatureEvidence&&airflowEvidence?{valid:false,title:"温度与风速证据已完成，还缺液面面积",detail:"保持温度和风速不变，只改变液面面积再测量。"}:areaEvaporationEvidence&&airflowEvidence?{valid:false,title:"面积与风速证据已完成，还缺温度",detail:"保持面积和风速不变，只改变水温再测量。"}:!evaporationPair?undefined:!evaporationPair.valid?{valid:false,...evaporationComparisonPrompt(evaporationPair.changedIndexes.length)}:{valid:false,title:"已形成一条单因素证据",detail:"继续复用基准，补齐温度、液面面积和空气流动三项因素。"};
  const reset = () => { clock.reset(); setSaved(false); };
  const save = () => {
    if (!done || saved) return;
    const row = createEvaporationEvidence({ id: Date.now(), temperature, area, airflow, elapsedSeconds: elapsed, durationSeconds: duration,
      initialMassGrams: INITIAL_WATER_MASS_GRAMS, remainingMassGrams: result.remainingMassGrams });
    if (!row) return;
    setEvidence((rows) => appendEvaporationEvidence(rows, row));
    setSaved(true);
    recordHarness("configuration.changed", { experiment: "thermal-evaporation", control: "保存蒸发称量", value: `${row.temperature}℃/${row.area}cm²/${row.airflow}m/s/${row.durationSeconds}s/${row.loss.toFixed(3)}g/${row.rate.toFixed(3)}g/min` });
  };
  useEffect(()=>publishApparatusSnapshot({module:"thermal-evaporation",capturedAt:new Date().toISOString(),origin:elapsed||evidence.length?"learner":"system",controls:[{id:"temperature",label:"水温",value:temperature,unit:"℃",source:"control"},{id:"area",label:"液面面积",value:area,unit:"cm²",source:"control"},{id:"airflow",label:"空气流速",value:airflow,unit:"m/s",source:"control"},{id:"duration",label:"本轮设定时长",value:duration,unit:"s",source:"control"},{id:"prediction",label:"预测",value:prediction??"未选择",source:"control"}],apparatus:[{id:"timer",label:"已计时",value:elapsed,unit:"s",source:"apparatus"},{id:"running",label:"正在计时",value:running,source:"apparatus"},{id:"completed",label:"本轮计时完成",value:done,source:"apparatus"},{id:"saved",label:"本轮称量已保存",value:saved,source:"apparatus"}],readings:[{id:"initial-mass",label:"本轮初始质量",value:reading.initialMassGrams,unit:"g",source:"reading"},{id:"remaining-mass",label:"天平当前示数",value:reading.remainingMassGrams,unit:"g",source:"reading"},{id:"loss",label:"按天平读数计算的质量减少",value:elapsed>0?reading.loss:null,unit:"g",source:"reading"},{id:"rate",label:"按失重与计时计算的平均速率",value:reading.rate,unit:"g/min",source:"reading"}],derived:[{id:"boundary",label:"模型边界",value:"固定水样与环境下的教学比较模型；天平读数分辨率0.001g，平均速率由同一份读数和计时换算",source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:evaporationPair?.valid??false,source:"model"},{id:"temperature-evidence",label:"温度因素证据",value:Boolean(temperatureEvidence),source:"model"},{id:"area-evidence",label:"液面面积因素证据",value:Boolean(areaEvaporationEvidence),source:"model"},{id:"airflow-evidence",label:"空气流动因素证据",value:Boolean(airflowEvidence),source:"model"}],validity:{ready:evaporationEvidenceReady,issues:evaporationEvidenceReady?[]:done&&!saved?["保存本轮计时与称量，再重置并改变一个条件"]:!done&&evidence.length===0?["完成第一组定时称量"]:evidence.length<2?["保存基准后，每次只改变一个条件"]:!temperatureEvidence?["还缺温度因素证据"]:!areaEvaporationEvidence?["还缺液面面积因素证据"]:["还缺空气流动因素证据"]}}),[area,areaEvaporationEvidence,airflow,airflowEvidence,done,duration,elapsed,evidence.length,evaporationEvidenceReady,evaporationPair?.valid,prediction,reading.initialMassGrams,reading.remainingMassGrams,reading.loss,reading.rate,running,saved,temperature,temperatureEvidence]);
  const controls = [
    { label: "温度/℃", values: [15, 25, 40], current: temperature, set: setTemperature },
    { label: "面积/cm²", values: [50, 100, 200], current: area, set: setArea },
    { label: "风速/m/s", values: [0, 1, 2], current: airflow, set: setAirflow },
    { label: "时间/s", values: [30, 60, 120], current: duration, set: setDuration }
  ];
  return <LabFrame field="thermal" experiment="thermal-evaporation" eyebrow="EVAPORATION MASS BENCH / 蒸发称量台" title="用定时质量差计算蒸发快慢"
    description="统一使用50 g水样，一次只改变温度、液面面积或空气流速。按天平初末读数与计时计算平均速率，数值用于固定环境中的趋势比较。10倍加速演示；显示秒数是实验时间，暂停时冻结读数。"
    running={running} onToggle={clock.toggle} playLabel="开始定时蒸发" runningLabel="暂停计时" actionDisabled={done} disabledLabel="本轮计时完成，请重置">
    <p className="thermal-run-notice" role={done ? "status" : undefined}>
      {done ? saved ? "本轮称量已保存。重置后可开始下一轮，历史记录保留。" : "本轮计时已完成，请先保存称量。重置会清除当前未保存的读数。" : "改变条件会重置本轮计时与水样，已保存的记录保留。"}
      <button onClick={reset}><RotateCcw size={14} />重置本轮计时</button>
    </p>
    <div className="evap-inquiry-console"><section><b>先预测</b><span>{["升温更快", "面积更大更快", "风更快更快"].map((value) => <button className={prediction === value ? "active" : ""} onClick={() => setPrediction(value)} key={value}>{value}</button>)}</span></section>
      <section><b>三因素公平比较</b><strong>{evaporationEvidenceReady ? "温度 · 面积 · 空气流动均已验证" : `${Number(Boolean(temperatureEvidence)) + Number(Boolean(areaEvaporationEvidence)) + Number(Boolean(airflowEvidence))} / 3 项完成`}</strong></section></div>
    <div className="evap-mass-rig">
      <div className="evap-fan-live" style={{ "--fan-duration": `${Math.max(.3, 2 - airflow * .5)}s` } as React.CSSProperties}>
        {[0, 120, 240].map((angle) => <i style={{ "--blade-angle": `${angle}deg`, animationPlayState: running && airflow > 0 ? "running" : "paused" } as React.CSSProperties} key={angle} />)}<b>{airflow} m/s</b>
      </div>
      <div className="evap-tray-live" style={{ width: `${130 + area / 2}px` }}><i style={{ animationPlayState: running ? "running" : "paused" }} /><span>{temperature}℃ · {area}cm²</span></div>
      <div className="evap-balance-live"><small>MICRO BALANCE · 0.001 g</small><strong>{reading.remainingMassGrams.toFixed(3)} g</strong><em>{elapsed}/{duration}s</em></div>
      <div className="evap-live-result">按读数计算的质量减少<strong>{reading.loss.toFixed(3)} g</strong>
        <small>{reading.rate === null ? "计时开始后计算平均速率" : `平均速率 ${reading.rate.toFixed(3)} g/min`}</small>
        <small>失重 ÷ 实验秒数 × 60</small>
      </div>
    </div>
    <div className="evap-controls">{controls.map((control) => <section key={control.label}><b>{control.label}</b><div>{control.values.map((value) =>
      <button className={control.current === value ? "active" : ""} disabled={running} onClick={() => { control.set(value); reset(); }} key={value}>{value}</button>)}</div></section>)}
      <aside><button disabled={!done || saved} onClick={save}><Save size={15} />{saved ? "本轮已保存" : "保存称量"}</button></aside>
    </div>
    <FactorEvidenceStatus className="evap-factor-status" items={[{ label: "温度", done: Boolean(temperatureEvidence) }, { label: "液面面积", done: Boolean(areaEvaporationEvidence) }, { label: "空气流动", done: Boolean(airflowEvidence) }]} />
    <EvaporationEvidenceLedger records={evidence} />
    {evaporationConclusion && <EvidenceVerdict valid={evaporationConclusion.valid} title={evaporationConclusion.title} detail={evaporationConclusion.detail} />}
  </LabFrame>;
}
