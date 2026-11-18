import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue } from "../shared/ScienceLabPrimitives";
import { Activity, Eye, ClipboardList, Save, CheckCircle2, LockKeyhole } from "lucide-react";
import { type EyePosition } from "../measurement/DensityLab";

const thermometerTypes = {
  clinical: { label: "体温计", min: 35, max: 42, division: .1, color: "#e96f5a" },
  lab: { label: "实验室温度计", min: -20, max: 110, division: 1, color: "#ef765b" },
  cold: { label: "低温温度计", min: -50, max: 50, division: 1, color: "#65b7d8" }
} as const;

const thermometerSamples = {
  ice: { label: "冰水混合物", temperature: 0, color: "#74cde3" },
  room: { label: "室温水", temperature: 24, color: "#55b9df" },
  warm: { label: "温水", temperature: 68, color: "#e58d50" }
} as const;

type ThermometerTypeKey = keyof typeof thermometerTypes;

type ThermometerSampleKey = keyof typeof thermometerSamples;

type ThermometerPosition = "above" | "correct" | "bottom" | "wall";

interface ThermometerEvidence { id: number; sample: string; instrument: string; value: number; division: number; }

// This is an accelerated teaching animation, not a calibrated thermal time constant.
// Outside a valid immersion the animation holds its last column position.
const INITIAL_COLUMN_TEMPERATURE = 24;

export function ThermometerLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [typeKey, setTypeKey] = useState<ThermometerTypeKey>();
  const [sampleKey, setSampleKey] = useState<ThermometerSampleKey>();
  const [position, setPosition] = useState<ThermometerPosition>("above");
  const [response, setResponse] = useState({ progress: 0, startTemperature: INITIAL_COLUMN_TEMPERATURE, running: false, revision: 0 });
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [readValue, setReadValue] = useState<number>();
  const [evidence, setEvidence] = useState<ThermometerEvidence[]>([]);
  const [parallaxTrials, setParallaxTrials] = useState<EyePosition[]>([]);
  const [currentSaved, setCurrentSaved] = useState(false);
  const instrument = typeKey ? thermometerTypes[typeKey] : undefined;
  const sample = sampleKey ? thermometerSamples[sampleKey] : undefined;
  const rangeSuitable = Boolean(instrument && sample && sample.temperature >= instrument.min && sample.temperature <= instrument.max);
  const correctPosition = position === "correct";
  const stableProgress = response.progress;
  const stable = rangeSuitable && correctPosition && stableProgress >= 100;
  const canRead = stable && eyePosition === "level";
  const progress = stableProgress / 100;
  const columnTemperature = rangeSuitable && correctPosition && sample
    ? response.startTemperature + (sample.temperature - response.startTemperature) * progress * (2 - progress)
    : response.startTemperature;
  const columnLevel = instrument ? Math.max(0, Math.min(1, (columnTemperature - instrument.min) / (instrument.max - instrument.min))) : 0;
  const indicatedTemperature = instrument ? Math.round(columnTemperature / instrument.division) * instrument.division : 0;
  const visibleTemperature = indicatedTemperature + (eyePosition === "high" ? instrument?.division ?? 0 : eyePosition === "low" ? -(instrument?.division ?? 0) : 0);
  const parallaxComplete = parallaxTrials.includes("high") && parallaxTrials.includes("low");
  useEffect(() => {
    if (!rangeSuitable || !correctPosition || !response.running) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (!active) return;
      setResponse(value => value.revision !== response.revision || !value.running ? value : {
        ...value, progress: Math.min(100, value.progress + 5), running: value.progress + 5 < 100,
      });
    }, 100);
    return () => { active = false; window.clearInterval(timer); };
  }, [correctPosition, rangeSuitable, response.running, response.revision]);
  const resetReading = (startTemperature = columnTemperature, running = false) => {
    setResponse(value => ({ progress: 0, startTemperature, running, revision: value.revision + 1 }));
    setReadValue(undefined); setEyePosition("high"); setParallaxTrials([]); setCurrentSaved(false);
  };
  const chooseInstrument = (key: ThermometerTypeKey) => { setTypeKey(key); setPosition("above"); resetReading(INITIAL_COLUMN_TEMPERATURE); };
  const chooseSample = (key: ThermometerSampleKey) => { setSampleKey(key); setPosition("above"); resetReading(); };
  const place = (next: ThermometerPosition) => {
    if (next === position) return;
    setPosition(next); resetReading(columnTemperature, next === "correct" && rangeSuitable);
  };
  const toggleResponse = () => {
    if (!rangeSuitable || !correctPosition || stable) return;
    setResponse(value => ({ ...value, running: !value.running, revision: value.revision + 1 }));
  };
  const recordTemperature = (alignEye = false) => {
    if (!stable || readValue !== undefined || (!alignEye && !canRead)) return;
    if (alignEye) setEyePosition("level");
    setReadValue(indicatedTemperature);
    recordHarness("configuration.changed", { experiment: "thermal-thermometer", control: "正式温度读数", value: indicatedTemperature, unit: "℃" });
  };
  const save = () => {
    if (!stable || !instrument || !sample || readValue === undefined || !parallaxComplete) return;
    const row={id:Date.now(),sample:sample.label,instrument:instrument.label,value:readValue,division:instrument.division};
    setEvidence((items)=>[row,...items.filter(item=>item.sample!==row.sample)].slice(0,6));
    setCurrentSaved(true);
    recordHarness("configuration.changed",{experiment:"thermal-thermometer",control:"保存温度测量",value:`${row.sample}/${row.instrument}/${row.value}℃`});
  };
  const observeParallax = (next: "high" | "low") => {
    if (!stable || !instrument) return;
    setEyePosition(next);
    setParallaxTrials((items) => items.includes(next) ? items : [...items, next]);
    const observed = indicatedTemperature + (next === "high" ? instrument.division : -instrument.division);
    recordHarness("configuration.changed", { experiment: "thermal-thermometer", control: next === "high" ? "俯视误差演练" : "仰视误差演练", value: observed, unit: "℃" });
  };
  useEffect(() => {
    const issues = !instrument ? ["先根据待测温度选择合适量程的温度计。"] : !sample ? ["选择一种待测液体。"] : !rangeSuitable ? [`${instrument.label}量程${instrument.min}～${instrument.max}℃，不适合当前样品。`] : !correctPosition ? [position === "above" ? "让玻璃泡完全浸入液体。" : position === "bottom" ? "玻璃泡不能接触容器底。" : "玻璃泡不能接触容器壁。"] : !stable ? [response.running ? "保持温度计不动，等待示数稳定。" : "响应示意已暂停；继续响应示意并等待稳定后再读数。"] : readValue === undefined ? ["平视并记录正式温度。"] : !parallaxComplete ? ["再完成俯视和仰视误差演练，比较误差方向。"] : currentSaved ? [] : ["保存本次规范测量证据。"];
    publishApparatusSnapshot({module:"thermal-thermometer",capturedAt:new Date().toISOString(),origin:instrument||sample?"learner":"system",controls:[
      {id:"instrument",label:"温度计",value:instrument?.label??"未选择",source:"control"},{id:"sample",label:"待测液体",value:sample?.label??"未选择",source:"control"},{id:"position",label:"玻璃泡位置",value:position==="correct"?"完全浸入且不碰底壁":position==="above"?"未浸入":position==="bottom"?"接触杯底":"接触杯壁",source:"control"},{id:"eye",label:"读数视线",value:eyePosition==="level"?"平视":eyePosition==="high"?"俯视":"仰视",source:"control"}
    ],apparatus:[
      {id:"range-suitable",label:"量程合适",value:rangeSuitable,source:"apparatus"},{id:"position-correct",label:"玻璃泡位置正确",value:correctPosition,source:"apparatus"},{id:"stable",label:"示数稳定",value:stable,source:"apparatus"},{id:"stable-progress",label:"响应示意进度",value:stableProgress,unit:"%",source:"apparatus"},{id:"response-running",label:"响应示意运行中",value:response.running,source:"apparatus"}
    ],readings:[
      {id:"visible",label:stable?"当前可见示数（视差示意）":"当前示意读数（未稳定）",value:instrument&&sample&&rangeSuitable&&correctPosition?visibleTemperature:null,unit:"℃",source:"reading"},{id:"recorded",label:"正式记录温度",value:readValue??null,unit:"℃",source:"reading"}
    ],derived:[
      {id:"division",label:"分度值",value:instrument?.division??null,unit:"℃",source:"model"},
      {id:"parallax",label:"俯视与仰视误差均已观察",value:parallaxComplete,source:"model"},
      {id:"column-temperature",label:"液柱响应示意温度（非实测）",value:instrument?columnTemperature:null,unit:"℃",source:"model"},
      {id:"response-note",label:"模型范围",value:"加速响应示意，进度不代表真实响应时间；离液或错误放置时暂停，不模拟冷却。视差偏移一格仅用于方向演练。",source:"model"},
      {id:"saved-count",label:"历史保存样品数",value:evidence.length,source:"model"}
    ],validity:{ready:stable&&readValue!==undefined&&parallaxComplete&&currentSaved,issues}});
  },[columnTemperature,correctPosition,currentSaved,evidence.length,eyePosition,instrument,parallaxComplete,position,rangeSuitable,readValue,response.running,sample,stable,stableProgress,visibleTemperature]);
  return <LabFrame field="thermal" experiment="thermal-thermometer" eyebrow="THERMOMETER PRACTICE BAY / 温度计规范实训舱" title="选对量程、放对位置、等到稳定，再平视读数" description="温度测量不只是看液柱高度。先根据待测对象选择量程和分度值合适的温度计；玻璃泡应完全浸入液体且不碰容器底壁，待示数稳定后平视液柱末端。" running={response.running} onToggle={toggleResponse} playLabel="继续响应示意" runningLabel="暂停响应示意" actionDisabled={!rangeSuitable||!correctPosition||stable} disabledLabel={!rangeSuitable?"先选择合适量程":!correctPosition?"先正确放置玻璃泡":"示数已稳定"}>
    <div className="thermometer-selection-console"><section><span><b>01</b>选择温度计</span><div>{(Object.keys(thermometerTypes) as ThermometerTypeKey[]).map(key=><button className={typeKey===key?"active":""} onClick={()=>chooseInstrument(key)} key={key}><i style={{background:thermometerTypes[key].color}}/><strong>{thermometerTypes[key].label}</strong><small>{thermometerTypes[key].min}～{thermometerTypes[key].max}℃ · {thermometerTypes[key].division}℃/格</small></button>)}</div></section><section><span><b>02</b>选择待测对象</span><div>{(Object.keys(thermometerSamples) as ThermometerSampleKey[]).map(key=><button className={sampleKey===key?"active":""} onClick={()=>chooseSample(key)} key={key}><i style={{background:thermometerSamples[key].color}}/><strong>{thermometerSamples[key].label}</strong><small>温度未知 · 待测</small></button>)}</div></section><section><span><b>03</b>量程检查</span><strong className={rangeSuitable?"valid":instrument&&sample?"danger":""}>{!instrument||!sample?"等待选择器材与样品":rangeSuitable?"量程合适，可以测量":`量程不合适：${instrument.min}～${instrument.max}℃`}</strong><small>不能让待测温度超过温度计量程。</small></section></div>
    <div className={`thermometer-lab-sim position-${position} ${stable?"stable":""} ${!rangeSuitable&&instrument&&sample?"range-error":""}`} style={{"--thermometer-level":columnLevel,"--thermometer-color":instrument?.color??"#ef765b","--sample-color":sample?.color??"#55b9df"} as React.CSSProperties}>
      <div className="thermometer-procedure-strip">{["选表查量程","玻璃泡浸入","不碰底和壁","等待稳定","平视读数"].map((label,index)=>{const activeStage=!rangeSuitable?0:!correctPosition?1:!stable?3:readValue===undefined?4:5;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="thermometer-vessel-rig"><span className="thermometer-sample-liquid"/><b>{sample?.label??"待测液体"}</b><em>玻璃泡不能碰底或杯壁</em></div>
      <div className="thermometer-instrument-rig"><span className="thermometer-stem"><i style={{height:`${8+columnLevel*84}%`,transition:"none"}}/><b/></span><div>{Array.from({length:26},(_,index)=><i className={index%5===0?"major":""} key={index}/>)}</div><strong>{instrument?.label??"未选择温度计"}</strong><small>{instrument?`${instrument.min}～${instrument.max}℃ · 分度值 ${instrument.division}℃`:"先检查量程和分度值"}</small></div>
      <div className="thermometer-position-console"><span>玻璃泡位置</span><div><button onClick={()=>place("above")}>未浸入</button><button className={position==="correct"?"active":""} onClick={()=>place("correct")}>正确浸入</button><button onClick={()=>place("bottom")}>碰杯底</button><button onClick={()=>place("wall")}>碰杯壁</button></div><strong className={correctPosition?"valid":""}>{position==="correct"?"完全浸入，且不碰底壁":position==="above"?"玻璃泡还未浸入液体":position==="bottom"?"玻璃泡接触杯底，不能作为液体温度读数":"玻璃泡接触杯壁，不能作为液体温度读数"}</strong></div>
      <div className="thermometer-stability-meter"><span><Activity size={16}/><small>RESPONSE / 加速响应示意</small><strong>{stable?"100% · 已稳定":`${stableProgress}%`}</strong></span><div><i style={{width:`${stableProgress}%`}}/></div><em>{!rangeSuitable?"先选择量程合适的温度计与样品":!correctPosition?"响应示意暂停，正确浸入后才能测量":stable?"保持温度计位置不变并平视读数":response.running?"液柱正在接近待测液体温度":"响应示意已暂停，尚未稳定"}</em></div>
      <div className={`thermometer-eye-console eye-${eyePosition}`}><Eye size={25}/><span><small>{eyePosition==="level"?"视线已与液柱末端相平":eyePosition==="high"?"当前俯视，示数偏大":"当前仰视，示数偏小"}</small><strong>{rangeSuitable&&correctPosition?`${stable?"可见约":"示意约"} ${visibleTemperature.toFixed(instrument&&instrument.division<1?1:0)}℃${stable?"":"（未稳定）"}`:"等待正确浸入与有效量程"}</strong></span><div><button onClick={()=>setEyePosition("high")}>俯视</button><button className={eyePosition==="level"?"active":""} onClick={()=>setEyePosition("level")}>平视</button><button onClick={()=>setEyePosition("low")}>仰视</button></div><button disabled={!canRead||readValue!==undefined} onClick={()=>recordTemperature()}>{readValue!==undefined?`已记录 ${readValue.toFixed(instrument&&instrument.division<1?1:0)}℃`:"读取并记录温度"}</button></div>
      <div className={`thermometer-final-reading ${readValue!==undefined?"complete":""}`}><small>{readValue!==undefined?"MEASUREMENT COMPLETE":"VALID READING"}</small><strong>{readValue!==undefined?`${readValue.toFixed(instrument&&instrument.division<1?1:0)} ℃`:"— —"}</strong><span>{instrument?`分度值 ${instrument.division}℃`:"等待选择温度计"}</span></div>
      {!instrument&&<InteractionCue text="先根据待测对象选择量程合适的温度计"/>}
    </div>
    <p className="thermometer-response-note">液柱从教学初始温度 24℃ 开始，加速响应进度不代表真实时间；取出或错误放置时暂停示意，不模拟冷却。再次浸入后必须重新等待稳定。体温计仅用于量程辨别，本实验不模拟其缩口结构。</p>
    <section className="thermometer-parallax-lab"><header><span><Eye size={17}/><b>视差误差演练</b></span><small>偏移一格为方向演练，不代表真实误差大小</small></header><div><button className={parallaxTrials.includes("high")?"done":""} disabled={!stable} onClick={()=>observeParallax("high")}><b>俯视液柱末端</b><strong>{instrument&&stable?`${(indicatedTemperature+instrument.division).toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>读数偏大</em></button><button className={readValue!==undefined?"done":""} disabled={!stable||!rangeSuitable||!correctPosition||readValue!==undefined} onClick={()=>recordTemperature(true)}><b>平视液柱末端</b><strong>{instrument&&stable?`${indicatedTemperature.toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>规范读数</em></button><button className={parallaxTrials.includes("low")?"done":""} disabled={!stable} onClick={()=>observeParallax("low")}><b>仰视液柱末端</b><strong>{instrument&&stable?`${(indicatedTemperature-instrument.division).toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>读数偏小</em></button></div></section>
    <div className="thermometer-evidence-workbench"><section><header><span><ClipboardList size={17}/><b>规范温度测量记录</b></span><button disabled={!stable||readValue===undefined||!parallaxComplete} onClick={save}><Save size={15}/>保存本次测量</button></header>{evidence.length?<div><b>样品</b><b>温度计</b><b>分度值/℃</b><b>测得温度/℃</b>{evidence.map(row=><div className="thermometer-evidence-row" key={row.id}><strong>{row.sample}</strong><span>{row.instrument}</span><span>{row.division}</span><strong>{row.value.toFixed(row.division<1?1:0)}</strong></div>)}</div>:<p>满足规范测量条件并完成俯视、仰视误差演练后，保存正式读数。</p>}</section><aside><span>本次规范检查</span>{[{label:"量程合适",done:rangeSuitable},{label:"玻璃泡位置正确",done:correctPosition},{label:"示数已经稳定",done:stable},{label:"平视完成读数",done:readValue!==undefined},{label:"视差方向已验证",done:parallaxComplete}].map(item=><i className={item.done?"done":""} key={item.label}>{item.done?<CheckCircle2 size={14}/>:<LockKeyhole size={14}/>} {item.label}</i>)}</aside></div>
  </LabFrame>;
}
