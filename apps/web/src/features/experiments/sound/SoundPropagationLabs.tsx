import { lazy, useState, useEffect, Suspense } from "react";
import { ClipboardList, Save, Ear, Activity, Cable, Mic2, Volume2, Shield, VolumeX, Gauge, RadioTower, TimerReset } from "lucide-react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { analyzeControlledComparison, analyzeTargetVariableComparison, analyzeProportionalEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, EvidenceVerdict, ScienceRange, ResultCell } from "../shared/ScienceLabPrimitives";
import { type ScienceModuleMeta } from "../catalog/scienceCatalog";
import { conceptConfigs } from "../shared/ConceptLab";
import { ScienceModuleLoading } from "../shared/ScienceModuleLoading";

const SoundParticleMicroscope = lazy(async () => {
  const module = await import("./SoundParticleMicroscope");
  return { default: module.SoundParticleMicroscope };
});

export function SoundConceptLab({ module }: { module: ScienceModuleMeta }) {
  if (module.key === "sound-medium") return <SoundMediumLab />;
  if (module.key === "sound-noise") return <SoundNoiseLab />;
  return <SoundEchoLab />;
}

function SoundEvidenceLedger({ title, columns, rows, onSave, saveDisabled }: { title: string; columns: string[]; rows: string[][]; onSave: () => void; saveDisabled: boolean }) {
  return <section className={`sound-measurement-ledger ${rows.length ? "" : "empty"}`}><header><span><ClipboardList size={16} /><b>{title}</b></span><button type="button" disabled={saveDisabled} onClick={onSave}><Save size={14} />保存当前读数</button></header>{rows.length ? <div style={{ "--sound-columns": columns.length + 1 } as React.CSSProperties}><b>组次</b>{columns.map((column) => <b key={column}>{column}</b>)}{rows.map((row, index) => <div className="sound-measurement-row" key={`${index}-${row.join("-")}`}><span>{index + 1}</span>{row.map((value, valueIndex) => <strong key={`${valueIndex}-${value}`}>{value}</strong>)}</div>)}</div> : <p>保存第一组作为基准，再按提示改变条件形成证据。</p>}</section>;
}

interface SoundMediumEvidence { id: number; air: number; distance: number; intensity: number; }

type StringPhoneCondition = "slack" | "taut" | "pinched";

const stringPhoneConditions: Record<StringPhoneCondition,{label:string;signal:number;note:string}> = {
  slack: { label:"棉线松弛", signal:18, note:"振动难以沿松弛棉线连续传递" },
  taut: { label:"棉线绷紧", signal:90, note:"杯底振动沿绷紧棉线传到接收杯" },
  pinched: { label:"手捏住棉线", signal:5, note:"传播通路被手指强烈阻尼" }
};

function SoundMediumLab() {
  const config = conceptConfigs["sound-medium"];
  const [air, setAir] = useState(config.initialA);
  const [distance, setDistance] = useState(config.initialB);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [microSnapshotCount, setMicroSnapshotCount] = useState(0);
  const [microPropagationReady, setMicroPropagationReady] = useState(false);
  const [evidence, setEvidence] = useState<SoundMediumEvidence[]>([]);
  const [phoneCondition,setPhoneCondition]=useState<StringPhoneCondition>("slack");
  const [phoneEvidence,setPhoneEvidence]=useState<StringPhoneCondition[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(air, distance);
  const particles = Math.max(0, Math.round(air / 5));
  const mediumPair = evidence.length >= 2 ? analyzeControlledComparison(
    [evidence.at(-2)!.air, evidence.at(-2)!.distance],
    [evidence.at(-1)!.air, evidence.at(-1)!.distance],
    evidence.at(-2)!.intensity,
    evidence.at(-1)!.intensity
  ) : undefined;
  const airContrast = evidence.length >= 2 ? analyzeTargetVariableComparison(
    [evidence.at(-2)!.air, evidence.at(-2)!.distance],
    [evidence.at(-1)!.air, evidence.at(-1)!.distance],
    evidence.at(-2)!.intensity,
    evidence.at(-1)!.intensity,
    0,
    40
  ) : undefined;
  const mediumChangedIndex = mediumPair?.changedIndexes[0];
  const airDifference = airContrast?.targetChange ?? 0;
  const airContrastReady = Boolean(airContrast?.validTargetComparison);
  const solidMediumReady = phoneEvidence.length === 3;
  const soundMediumLearningReady = airContrastReady && solidMediumReady;
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => { setAir((value) => value <= 0 ? 100 : Math.max(0, value - 2)); setInteracted(true); }, 85); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-medium", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "air", label: "空气保留程度", value: air, unit: "%", source: "control" }, { id: "distance", label: "接收距离", value: distance, unit: "m", source: "control" }
    ], apparatus: [{ id: "alarm", label: "闹钟振动", value: true, source: "apparatus" }, { id: "pump", label: "抽气扫描", value: running, source: "apparatus" }, { id: "micro-snapshots", label: "微观粒子分布快照", value: microSnapshotCount, unit: "张", source: "apparatus" }, { id:"string-phone-condition",label:"棉线电话状态",value:stringPhoneConditions[phoneCondition].label,source:"apparatus" }], readings: [
      { id: "intensity", label: "接收相对强度", value: interacted ? result.value : null, unit: result.unit, source: "reading" }, { id: "status", label: "听觉状态", value: interacted ? result.status : "等待操作", source: "reading" }, { id:"string-phone-signal",label:"棉线电话接收信号",value:stringPhoneConditions[phoneCondition].signal,unit:"%",source:"reading" }
    ], derived: [
      { id: "explanation", label: "证据解释", value: interacted ? result.detail : "等待形成对照", source: "model" },
      { id: "comparison", label: "最近两组公平比较", value: mediumPair?.valid ?? false, source: "model" },
      { id: "air-contrast", label: "固定距离的强空气量对照", value: airContrastReady, source: "model" },
      { id: "micro-propagation", label: "疏密区域传播判断正确", value: microPropagationReady, source: "model" },
      { id:"solid-medium",label:"固体棉线三状态对照",value:solidMediumReady,source:"model" }
    ], validity: { ready: soundMediumLearningReady, issues: soundMediumLearningReady ? [] : !airContrastReady ? (!interacted ? ["先抽走一部分空气，观察声源与接收端。"] : evidence.length < 2 ? ["保存基准组后，保持距离不变并让空气量相差至少40%。"] : !mediumPair?.valid ? ["最近两组同时改变了空气量和距离。"] : mediumChangedIndex !== 0 ? ["本任务要验证介质作用：保持距离不变，只改变空气量。"] : Math.abs(airDifference) < 40 ? ["空气量差异还不够明显，请让两组至少相差40%。"] : ["检查空气减少时接收强度是否随之减弱。"]) : ["依次记录棉线松弛、绷紧和手捏住三种状态，比较固体传声通路。"] } });
  }, [air, airContrastReady, airDifference, distance, evidence.length, interacted, mediumChangedIndex, mediumPair?.outcomeDirection, mediumPair?.valid, microPropagationReady, microSnapshotCount, phoneCondition, result.detail, result.status, result.unit, result.value, running, solidMediumReady, soundMediumLearningReady]);
  const change = (kind: "air" | "distance", value: number) => { setRunning(false); setInteracted(true); if (kind === "air") setAir(value); else setDistance(value); recordHarness("control.changed", { control: kind === "air" ? "空气保留程度" : "接收距离", value, unit: kind === "air" ? "%" : "m" }); };
  const saveEvidence = () => {
    if (!interacted || evidence.some((row) => row.air === air && row.distance === distance)) return;
    setEvidence((rows) => [...rows, { id: Date.now(), air, distance, intensity: result.value }].slice(-6));
    recordHarness("configuration.changed", { experiment: "sound-medium", control: "保存传声读数", value: `${air}%/${distance}m/${result.value.toFixed(1)}` });
  };
  return <LabFrame field="sound" experiment="sound-medium" eyebrow="BELL JAR / 玻璃罩传声" title="闹钟一直在振动，声音为什么会渐渐消失？" description="把声源是否振动、玻璃罩内是否有介质分开观察。抽气并不会让闹钟停止，而是改变振动传到接收器的条件。" running={running} onToggle={() => { setRunning(!running); setInteracted(true); }} playLabel="自动抽气" runningLabel="暂停抽气">
    <div className={`sound-apparatus sound-medium-apparatus ${air < 3 ? "near-vacuum" : ""}`} style={{ "--air": air / 100 } as React.CSSProperties}>
      <div className="sound-medium-status"><span><i />SOURCE STATUS</span><b>闹钟持续振动</b><small>改变的是传播条件，不是声源</small></div>
      <div className="bell-jar"><div className="alarm-clock"><i /><b /><span>声源</span></div><div className="air-particles">{Array.from({ length: particles }, (_, index) => <i style={{ "--particle-x": `${10 + (index * 37) % 78}%`, "--particle-y": `${14 + (index * 53) % 66}%`, "--particle-phase": `${-(((index * 37) % 78) / 78) * .72}s` } as React.CSSProperties} key={index} />)}</div><small className="particle-motion-note">粒子原地振动 · 疏密相位向前传递</small><span className="jar-pressure">AIR {air.toFixed(0)}%</span></div>
      <div className="medium-wave-path">{Array.from({ length: 5 }, (_, index) => <i style={{ "--ring": index } as React.CSSProperties} key={index} />)}</div>
      <div className="sound-receiver" style={{ right: `${5 + (1 - distance / 12) * 16}%` }}><Ear size={30} /><span><small>RECEIVER</small><strong>{interacted ? result.status : "等待比较"}</strong></span><i><b style={{ height: `${Math.min(100, result.value)}%` }} /></i></div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Activity size={18} /><span><small>当前证据</small><strong>{interacted ? `${air.toFixed(0)}% 空气 · ${distance.toFixed(1)} m · ${result.value.toFixed(1)} 相对强度` : "先改变空气量或距离"}</strong><em>{interacted ? air < 3 ? "声源仍振动，但几乎没有空气传递机械振动。" : "比较时注意一次只改变空气量或距离。" : "装置尚未形成第一组读数"}</em></span></div>
      {!interacted && <InteractionCue text="先抽走一部分空气，观察声源和接收端" />}
    </div>
    <Suspense fallback={<ScienceModuleLoading title="声波粒子显微镜" />}><SoundParticleMicroscope onSnapshotCountChange={setMicroSnapshotCount} onPropagationReadyChange={setMicroPropagationReady} /></Suspense>
    <section className={`string-phone-lab condition-${phoneCondition} ${solidMediumReady?"complete":""}`}><header><span><Cable size={17}/><b>STRING TELEPHONE / 固体传声诊断</b></span><small>{solidMediumReady?"三种通路状态已完成":"同一声源，只改变棉线状态"}</small></header><div className="string-phone-apparatus"><article><Mic2 size={25}/><span><small>SOURCE CUP</small><strong>发声纸杯</strong></span></article><div className="string-phone-line"><i/><b>{phoneCondition==="pinched"?"手指捏住":phoneCondition==="taut"?"绷紧棉线":"松弛棉线"}</b></div><article><Ear size={25}/><span><small>RECEIVER CUP</small><strong>接收 {stringPhoneConditions[phoneCondition].signal}%</strong></span></article></div><div className="string-phone-controls">{(Object.keys(stringPhoneConditions) as StringPhoneCondition[]).map(condition=><button className={phoneCondition===condition?"active":phoneEvidence.includes(condition)?"done":""} onClick={()=>setPhoneCondition(condition)} key={condition}><strong>{stringPhoneConditions[condition].label}</strong><small>{stringPhoneConditions[condition].note}</small></button>)}<button className="record" disabled={phoneEvidence.includes(phoneCondition)} onClick={()=>{setPhoneEvidence(items=>Array.from(new Set([...items,phoneCondition])));recordHarness("configuration.changed",{experiment:"sound-medium",control:"棉线电话传声",value:`${stringPhoneConditions[phoneCondition].label}/${stringPhoneConditions[phoneCondition].signal}%`});}}><Save size={14}/>记录当前接收信号</button></div>{phoneEvidence.length>0&&<EvidenceVerdict valid={solidMediumReady} title={solidMediumReady?"绷紧固体棉线能够传递振动":"继续补齐三种棉线状态"} detail={solidMediumReady?"同一声源下，绷紧棉线接收最强；松线传递较弱，捏住棉线会吸收振动。说明固体可以传声，但需要连续、合适的机械振动通路。":`已记录 ${phoneEvidence.length}/3 种状态，保持纸杯和距离不变。`}/>}</section>
    <div className="science-controls"><ScienceRange label="空气保留程度" value={air} min={0} max={100} step={1} unit="%" onChange={(value) => change("air", value)} /><ScienceRange label="接收距离" value={distance} min={1} max={12} step={.5} unit="m" onChange={(value) => change("distance", value)} /><ResultCell label="接收状态" value={interacted ? result.status : "等待第一次操作"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="玻璃罩传声记录" columns={["空气/%", "距离/m", "相对强度"]} rows={evidence.map((row) => [row.air.toFixed(0), row.distance.toFixed(1), row.intensity.toFixed(1)])} onSave={saveEvidence} saveDisabled={!interacted || evidence.some((row) => row.air === air && row.distance === distance)} />
    {evidence.length > 0 && <EvidenceVerdict valid={soundMediumLearningReady} title={soundMediumLearningReady ? "空气与固体两条介质证据均已完成" : airContrastReady?"空气介质证据成立，还需完成棉线电话":"还没有形成足够有力的空气介质证据"} detail={soundMediumLearningReady?"玻璃罩对照说明空气减少时传声减弱；棉线电话对照说明绷紧固体能传递振动，而通路受阻会使信号显著减弱。":evidence.length < 2 ? "把当前组作为基准，保持接收距离不变，再让空气量至少相差40%。" : !mediumPair?.valid ? "请把接收距离调回上一组，只改变空气量。" : mediumChangedIndex !== 0 ? "改变距离只能研究传播衰减，不能直接验证介质是否必要。" : airContrastReady?"依次记录棉线松弛、绷紧和手捏住三种状态。":Math.abs(airDifference) < 40 ? `两组空气量只相差 ${Math.abs(airDifference).toFixed(0)}%，继续扩大差异。` : `距离保持不变，空气量变化 ${Math.abs(airDifference).toFixed(0)}%，接收强度随空气减少而减弱。`} />}
  </LabFrame>;
}

const noiseMeasures = [
  { id: "source", label: "声源控制", note: "安装消声器", attenuation: 12, icon: Volume2 },
  { id: "path", label: "传播阻隔", note: "升起隔音屏", attenuation: 18, icon: Shield },
  { id: "receiver", label: "接收防护", note: "佩戴防护耳罩", attenuation: 15, icon: Ear }
] as const;

interface SoundNoiseEvidence { id: number; measure: string; label: string; sourceLevel: number; receiverLevel: number; attenuation: number; }

function SoundNoiseLab() {
  const config = conceptConfigs["sound-noise"];
  const [sourceLevel, setSourceLevel] = useState(config.initialA);
  const [activeMeasures, setActiveMeasures] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [evidence, setEvidence] = useState<SoundNoiseEvidence[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const attenuation = noiseMeasures.filter((item) => activeMeasures.includes(item.id)).reduce((sum, item) => sum + item.attenuation, 0);
  const result = config.calculate(sourceLevel, attenuation);
  const testedMeasures = new Set(evidence.map((row) => row.measure));
  const noiseEvidenceReady = testedMeasures.size === noiseMeasures.length && evidence.every((row) => row.sourceLevel === sourceLevel);
  useEffect(() => { if (!running) return; const states: string[][] = [[], ["source"], ["path"], ["receiver"], ["source", "path", "receiver"]]; let index = 0; const timer = window.setInterval(() => { index = (index + 1) % states.length; setActiveMeasures(states[index]); setInteracted(true); }, 1100); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-noise", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "source-level", label: "声源处声级", value: sourceLevel, unit: "dB", source: "control" }, { id: "attenuation", label: "总等效衰减", value: attenuation, unit: "dB", source: "control" }
    ], apparatus: noiseMeasures.map((item) => ({ id: item.id, label: item.label, value: activeMeasures.includes(item.id), source: "apparatus" as const })), readings: [
      { id: "receiver-level", label: "接收处声级", value: interacted ? result.value : null, unit: "dB", source: "reading" }, { id: "status", label: "接收状态", value: interacted ? result.status : "等待操作", source: "reading" }
    ], derived: [
      { id: "boundary", label: "模型说明", value: result.detail, source: "model" },
      { id: "three-links", label: "三环节单独测试完成", value: noiseEvidenceReady, source: "model" }
    ], validity: { ready: noiseEvidenceReady, issues: noiseEvidenceReady ? [] : !interacted ? ["至少启用一种控制噪声的措施。"] : activeMeasures.length !== 1 ? ["每次只启用一种措施，才能比较三个控制环节。"] : [`还需单独测试 ${noiseMeasures.length - testedMeasures.size} 个控制环节。`] } });
  }, [activeMeasures, attenuation, evidence.length, interacted, noiseEvidenceReady, result.detail, result.status, result.value, sourceLevel, testedMeasures.size]);
  const toggleMeasure = (id: string) => { setRunning(false); setInteracted(true); setActiveMeasures((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); recordHarness("configuration.changed", { control: "噪声控制环节", value: id }); };
  const saveEvidence = () => {
    if (activeMeasures.length !== 1 || testedMeasures.has(activeMeasures[0]!)) return;
    const measure = noiseMeasures.find((item) => item.id === activeMeasures[0])!;
    setEvidence((rows) => [...rows, { id: Date.now(), measure: measure.id, label: measure.label, sourceLevel, receiverLevel: result.value, attenuation }]);
    recordHarness("configuration.changed", { experiment: "sound-noise", control: "保存单措施读数", value: `${measure.label}/${result.value.toFixed(0)}dB` });
  };
  return <LabFrame field="sound" experiment="sound-noise" eyebrow="NOISE CONTROL / 三道防线" title="同一种噪声，在哪个环节减弱更有效？" description="依次尝试声源、传播途中和接收端措施。接收处声级按等效声级差比较，不把分贝当作普通百分比相减。" running={running} onToggle={() => { setRunning(!running); setInteracted(true); }} playLabel="自动轮换措施" runningLabel="暂停比较">
    <div className="sound-apparatus sound-noise-apparatus" style={{ "--noise-level": Math.max(0, Math.min(1, result.value / 110)) } as React.CSSProperties}>
      <div className="noise-route"><article className={activeMeasures.includes("source") ? "protected" : ""}><i><Volume2 size={27} /></i><span><small>01 / SOURCE</small><b>交通声源</b><em>{activeMeasures.includes("source") ? "消声器已启用 −12 dB" : `${sourceLevel.toFixed(0)} dB`}</em></span></article><div className={`noise-barrier ${activeMeasures.includes("path") ? "raised" : ""}`}><Shield size={28} /><span>{activeMeasures.includes("path") ? "隔音屏工作中" : "传播路径开放"}</span></div><div className="noise-wave-stream">{Array.from({ length: 7 }, (_, index) => <i style={{ "--wave": index } as React.CSSProperties} key={index} />)}</div><article className={activeMeasures.includes("receiver") ? "protected" : ""}><i>{activeMeasures.includes("receiver") ? <VolumeX size={27} /> : <Ear size={27} />}</i><span><small>03 / RECEIVER</small><b>接收位置</b><em>{interacted ? `${result.value.toFixed(0)} dB` : "等待措施"}</em></span></article></div>
      <div className="noise-measure-panel">{noiseMeasures.map((item) => { const MeasureIcon = item.icon; const active = activeMeasures.includes(item.id); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleMeasure(item.id)} key={item.id}><MeasureIcon size={18} /><span><small>{item.label}</small><b>{item.note}</b></span><em>{active ? `−${item.attenuation} dB` : "点击启用"}</em></button>; })}</div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Gauge size={18} /><span><small>接收处声级</small><strong>{interacted ? `${sourceLevel.toFixed(0)} − ${attenuation} = ${result.value.toFixed(0)} dB` : "先选择一种控制措施"}</strong><em>{interacted ? result.status : "从声源、传播途中或接收端开始"}</em></span></div>
    </div>
    <div className="science-controls"><ScienceRange label="声源处声级" value={sourceLevel} min={40} max={110} step={1} unit="dB" onChange={(value) => { setRunning(false); setInteracted(true); setSourceLevel(value); setEvidence([]); }} /><ResultCell label="等效衰减量" value={interacted ? `${attenuation} dB` : "等待选择措施"} pending={!interacted} /><ResultCell label="接收处" value={interacted ? `${result.value.toFixed(0)} dB · ${result.status}` : "等待第一次操作"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="三环节降噪对照" columns={["单独措施", "衰减/dB", "接收处/dB"]} rows={evidence.map((row) => [row.label, row.attenuation.toFixed(0), row.receiverLevel.toFixed(0)])} onSave={saveEvidence} saveDisabled={activeMeasures.length !== 1 || testedMeasures.has(activeMeasures[0] ?? "")} />
    {evidence.length > 0 && <EvidenceVerdict valid={noiseEvidenceReady} title={noiseEvidenceReady ? "三种控制环节已经完成同源对照" : "继续逐项测试，暂不比较组合措施"} detail={noiseEvidenceReady ? `${[...evidence].sort((a, b) => b.attenuation - a.attenuation)[0]!.label}在当前模型中的单项衰减最大；实际工程通常综合使用。` : `已完成 ${testedMeasures.size}/3 项，保持声源声级不变且每次只开启一种措施。`} />}
  </LabFrame>;
}

interface SoundEchoEvidence { id: number; time: number; speed: number; distance: number; }

function SoundEchoLab() {
  const config = conceptConfigs["sound-echo"];
  const [time, setTime] = useState(config.initialA);
  const [speed, setSpeed] = useState(config.initialB);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [evidence, setEvidence] = useState<SoundEchoEvidence[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(time, speed);
  const targetPosition = 47 + Math.min(38, result.value / 45 * 38);
  const echoEvidence = analyzeProportionalEvidence(evidence.map((row) => ({ x: row.time, y: row.distance })));
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-echo", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "echo-time", label: "回声往返时间", value: time, unit: "ms", source: "control" }, { id: "sound-speed", label: "介质中的声速", value: speed, unit: "m/s", source: "control" }
    ], apparatus: [{ id: "pulse", label: "超声脉冲", value: running, source: "apparatus" }], readings: [
      { id: "distance", label: "目标距离", value: interacted ? result.value : null, unit: "m", source: "reading" }, { id: "round-trip", label: "声波总路程", value: interacted ? result.value * 2 : null, unit: "m", source: "reading" }
    ], derived: [
      { id: "formula", label: "计算关系", value: `${speed} × ${(time / 1000).toFixed(3)} ÷ 2`, source: "model" },
      { id: "time-distance", label: "同介质距离与往返时间成正比", value: echoEvidence.proportional, source: "model" }
    ], validity: { ready: echoEvidence.proportional, issues: !interacted ? ["发射一次脉冲或改变往返时间。"] : !echoEvidence.enoughPoints ? ["保持介质声速不变，记录三个不同往返时间。"] : !echoEvidence.proportional ? ["检查距离与往返时间的比值是否稳定。"] : [] } });
  }, [echoEvidence.enoughPoints, echoEvidence.proportional, evidence.length, interacted, result.value, running, speed, time]);
  const change = (kind: "time" | "speed", value: number) => { setInteracted(true); if (kind === "time") setTime(value); else { setSpeed(value); setEvidence([]); } recordHarness("control.changed", { control: kind === "time" ? "回声往返时间" : "介质中的声速", value, unit: kind === "time" ? "ms" : "m/s" }); };
  const saveEvidence = () => {
    if (!interacted || evidence.some((row) => row.time === time)) return;
    setEvidence((rows) => [...rows, { id: Date.now(), time, speed, distance: result.value }].slice(-6));
    recordHarness("configuration.changed", { experiment: "sound-echo", control: "保存测距点", value: `${time}ms/${result.value.toFixed(2)}m` });
  };
  return <LabFrame field="sound" experiment="sound-echo" eyebrow="ULTRASONIC RANGE / 超声测距" title="回声计时器测到的，为什么是两段路程？" description="发射脉冲，沿着“去程—反射—回程”追踪声音。仪器记录的是完整往返时间，目标距离只取总路程的一半。" running={running} onToggle={() => { setRunning((value) => !value); setInteracted(true); }} playLabel="发射超声脉冲" runningLabel="停止连续发射">
    <div className={`sound-apparatus sound-echo-apparatus ${running ? "is-pulsing" : ""}`} style={{ "--target-x": `${targetPosition}%`, "--echo-duration": `${Math.max(.8, time / 35)}s` } as React.CSSProperties}>
      <div className="echo-grid-label"><RadioTower size={17} /><span>ULTRASONIC PATH TRACKER</span><b>{speed.toFixed(0)} m/s</b></div><div className="echo-emitter"><RadioTower size={34} /><span><small>TX / RX</small><b>发射与接收</b></span></div><div className="echo-target"><i /><span><small>TARGET</small><b>反射目标</b></span></div>
      <div className="echo-path outbound"><i /><span>去程 s</span></div><div className="echo-path inbound"><i /><span>回程 s</span></div><div className="echo-pulse outbound-pulse" /><div className="echo-pulse inbound-pulse" />
      <div className="echo-timer"><TimerReset size={22} /><span><small>ROUND TRIP TIME</small><strong>{interacted ? `${time.toFixed(0)} ms` : "— —"}</strong></span></div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Activity size={18} /><span><small>距离计算</small><strong>{interacted ? `${speed.toFixed(0)} × ${(time / 1000).toFixed(3)} ÷ 2 = ${result.value.toFixed(2)} m` : "发射一次脉冲"}</strong><em>{interacted ? `声波总路程 ${(result.value * 2).toFixed(2)} m，目标单程距离 ${result.value.toFixed(2)} m。` : "观察去程和回程两条路径"}</em></span></div>
      {!interacted && <InteractionCue text="发射一次脉冲，追踪去程与回程" />}
    </div>
    <div className="science-controls"><ScienceRange label="回声往返时间" value={time} min={2} max={120} step={1} unit="ms" onChange={(value) => change("time", value)} /><ScienceRange label="介质中的声速" value={speed} min={300} max={1500} step={10} unit="m/s" onChange={(value) => change("speed", value)} /><ResultCell label="目标距离" value={interacted ? `${result.value.toFixed(2)} m` : "等待发射脉冲"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="超声测距数据" columns={["往返时间/ms", "声速/(m/s)", "距离/m"]} rows={evidence.map((row) => [row.time.toFixed(0), row.speed.toFixed(0), row.distance.toFixed(2)])} onSave={saveEvidence} saveDisabled={!interacted || evidence.some((row) => row.time === time)} />
    {evidence.length > 0 && <EvidenceVerdict valid={echoEvidence.proportional} title={echoEvidence.proportional ? "三点证据支持同介质中的时间—距离关系" : "测量点还不足以支持比例关系"} detail={echoEvidence.enoughPoints ? `距离/往返时间的最大相对偏差为 ${((echoEvidence.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%；计算中仍需除以2。` : `保持声速 ${speed} m/s 不变，还需记录 ${3 - echoEvidence.distinctXCount} 个不同时间点。`} />}
  </LabFrame>;
}
