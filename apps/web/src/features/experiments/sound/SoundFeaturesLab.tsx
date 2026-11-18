import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { analyzeControlledComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ScienceRange, ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Activity, Focus, RotateCcw, Waves, ClipboardList, Save } from "lucide-react";
import { useClock } from "../shared/useClock";
import { useTonePlayback } from "./useTonePlayback";
import "./tonePlayback.css";

const soundTimbreNames = { sine: "纯音", triangle: "柔和复合音", square: "明亮复合音" } as const;

type SoundFeatureFactor = "frequency" | "amplitude" | "timbre";

const soundFeatureLabels: Record<SoundFeatureFactor,{ control:string; observation:string }> = {
  frequency: { control: "频率 f", observation: "音调与周期" },
  amplitude: { control: "振幅 A", observation: "响度与波高" },
  timbre: { control: "波形", observation: "音色与形状" }
};

export function SoundLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [frequency, setFrequency] = useState(330);
  const [amplitude, setAmplitude] = useState(42);
  const [timbre, setTimbre] = useState<"sine" | "triangle" | "square">("sine");
  const [baseline, setBaseline] = useState<{ frequency: number; amplitude: number; timbre: "sine" | "triangle" | "square" }>();
  const [interacted, setInteracted] = useState(false);
  const [featureEvidence, setFeatureEvidence] = useState<SoundFeatureFactor[]>([]);
  const playback = useTonePlayback({ frequency, amplitude, timbre }, (running) => {
    recordHarness("simulation.toggled", { experiment: "sound-features", running, action: running ? "低音量试听已启动" : "试听已停止" });
  });
  const { playing } = playback;
  const phase = useClock(playing, 0.075);
  const waveValue = (angle: number, kind: typeof timbre) => kind === "sine" ? Math.sin(angle) : kind === "triangle" ? 2 / Math.PI * Math.asin(Math.sin(angle)) : Math.sign(Math.sin(angle));
  const points = Array.from({ length: 101 }, (_, i) => { const x = i * 7.8; const y = 120 + waveValue(i / 100 * Math.PI * 2 * (frequency / 55) + phase * Math.PI * 2, timbre) * amplitude; return `${x},${y}`; }).join(" ");
  const baselinePoints = baseline ? Array.from({ length: 101 }, (_, i) => { const x = i * 7.8; const y = 120 + waveValue(i / 100 * Math.PI * 2 * (baseline.frequency / 55), baseline.timbre) * baseline.amplitude; return `${x},${y}`; }).join(" ") : "";
  const pitch = frequency < 275 ? "音调较低" : frequency < 495 ? "音调中等" : "音调较高";
  const loudness = amplitude < 28 ? "响度较小" : amplitude < 54 ? "响度中等" : "响度较大";
  const periodMilliseconds = 1000 / frequency;
  const soundComparison = baseline ? analyzeControlledComparison(
    [baseline.frequency, baseline.amplitude, baseline.timbre],
    [frequency, amplitude, timbre],
    0,
    0
  ) : undefined;
  const currentFeature: SoundFeatureFactor | undefined = soundComparison?.valid ? (["frequency","amplitude","timbre"] as const)[soundComparison.changedIndexes[0]!] : undefined;
  const soundLearningReady = featureEvidence.length === 3;
  const toggleSound = () => {
    setInteracted(true);
    playback.toggle();
  };
  useEffect(() => {
    publishApparatusSnapshot({
      module: "sound-features",
      capturedAt: new Date().toISOString(),
      origin: interacted ? "learner" : "system",
      controls: [
        { id: "frequency", label: "振动频率", value: frequency, unit: "Hz", source: "control" },
        { id: "amplitude", label: "相对振幅", value: amplitude, unit: "%", source: "control" }
      ],
      apparatus: [
        { id: "source-on", label: "声源实际播放", value: playing, source: "apparatus" }, { id: "playback-status", label: "试听状态", value: playback.status, source: "apparatus" }, { id: "playback-message", label: "试听提示", value: playback.message, source: "apparatus" }, { id: "timbre", label: "声源音色", value: soundTimbreNames[timbre], source: "apparatus" }, { id: "baseline", label: "已保存基准", value: Boolean(baseline), source: "apparatus" }
      ],
      readings: [
        { id: "pitch", label: "音调观察", value: interacted ? pitch : "等待操作", source: "reading" },
        { id: "wave-height", label: "波形相对高度", value: interacted ? amplitude : null, unit: "%", source: "reading" }, { id: "loudness", label: "响度观察", value: interacted ? loudness : "等待操作", source: "reading" },
        { id: "period", label: "振动周期", value: interacted ? periodMilliseconds : null, unit: "ms", source: "reading" }
      ],
      derived: [
        { id: "cycles", label: "时间窗内相对周期数", value: Math.round(frequency / 55), unit: "周期/视窗", source: "model" },
        { id: "baseline-comparison", label: "基准与当前只改变一项", value: soundComparison?.valid ?? false, source: "model" },
        { id: "frequency-evidence", label: "频率—音调证据", value: featureEvidence.includes("frequency"), source: "model" },
        { id: "amplitude-evidence", label: "振幅—响度证据", value: featureEvidence.includes("amplitude"), source: "model" },
        { id: "timbre-evidence", label: "波形—音色证据", value: featureEvidence.includes("timbre"), source: "model" }
      ],
      validity: { ready: soundLearningReady, issues: soundLearningReady ? [] : !interacted ? ["先启动声源或改变一个参数，生成第一组波形。"] : !baseline ? ["先保存当前波形作为基准。"] : soundComparison?.valid ? [`记录本次${soundFeatureLabels[currentFeature!].control}单变量对照。`] : [soundComparison?.changedIndexes.length === 0 ? "基准与当前完全相同，请只改变一个条件。" : "相对基准同时改变了多个条件，请调回其中一项。"] }
    });
  }, [amplitude, baseline, currentFeature, featureEvidence, frequency, interacted, loudness, periodMilliseconds, pitch, playback.message, playback.status, playing, soundComparison?.changedIndexes.length, soundComparison?.valid, soundLearningReady, timbre]);
  const interact = () => setInteracted(true);
  const recordFeatureComparison = () => {
    if (!currentFeature) return;
    setFeatureEvidence((items) => Array.from(new Set([...items,currentFeature])));
    recordHarness("configuration.changed", { experiment: "sound-features", control: "记录三要素证据", value: `${soundFeatureLabels[currentFeature].control}→${soundFeatureLabels[currentFeature].observation}` });
  };
  return <LabFrame field="sound" experiment="sound-features" eyebrow="ACOUSTIC OSCILLOSCOPE / 声学示波器" title="波形变高、变密、变形，分别意味着什么？" description="先保存一条基准波形，再只改变频率、振幅或声源波形中的一个。试听采用很低的输出增益，仍请保持设备音量适中。" running={playing} onToggle={toggleSound} playLabel={playback.buttonLabel} runningLabel="停止试听" recordToggleEvent={false}>
    <p className={`tone-playback-status ${playback.status}`} role="status" aria-live="polite" aria-busy={playback.pending}>{playback.message}</p>
    <div className="sound-sim sound-oscilloscope"><div className={`speaker ${playing ? "playing" : ""}`} style={{ "--vibration": `${Math.max(2, amplitude / 10)}px` } as React.CSSProperties}><i /><b /></div><div className="oscilloscope-label"><Activity size={15} /><span>CH 01 · TIME TRACE / 时间波形</span><b>{soundTimbreNames[timbre]}</b></div><svg viewBox="0 0 780 240" preserveAspectRatio="none">{baseline && <polyline className="baseline-wave" points={baselinePoints} />}<polyline points={interacted ? points : "0,120 780,120"} /></svg><div className="sound-particles">{playing && Array.from({ length: 12 }, (_, i) => <i style={{ animationDelay: `${-i * .13}s`, opacity: amplitude / 70 }} key={i} />)}</div><div className={`sound-readout ${interacted ? "" : "awaiting-reading"}`}><span>{baseline ? "当前 / 基准对照" : interacted ? "当前时间波形" : "等待声源"}</span><strong>{interacted ? `${pitch} · ${loudness}` : "— —"}</strong><small>{interacted ? `${frequency.toFixed(0)} Hz · T ${periodMilliseconds.toFixed(2)} ms · A ${amplitude}%` : "先启动或调整参数"}</small></div>{!interacted && <InteractionCue text="调整参数生成波形，也可低音量试听" />}</div>
    <div className="sound-comparison-console"><section><span><small>CONTROL VARIABLE / 对照实验</small><b>{baseline ? `基准：${baseline.frequency} Hz · A ${baseline.amplitude}% · ${soundTimbreNames[baseline.timbre]}` : "还没有保存基准波形"}</b></span><button type="button" onClick={() => { setBaseline({ frequency, amplitude, timbre }); setInteracted(true); recordHarness("configuration.changed", { control: "基准波形", value: `${frequency}Hz/A${amplitude}/${timbre}` }); }}><Focus size={15} />{baseline ? "更新基准" : "保存当前为基准"}</button>{baseline && <button type="button" onClick={() => setBaseline(undefined)}><RotateCcw size={14} />清除</button>}</section><div>{(["sine", "triangle", "square"] as const).map((kind) => <button className={timbre === kind ? "active" : ""} type="button" onClick={() => { setTimbre(kind); setInteracted(true); recordHarness("configuration.changed", { control: "声源波形", value: kind }); }} key={kind}><Waves size={15} /><span><small>{kind.toUpperCase()}</small><b>{soundTimbreNames[kind]}</b></span></button>)}</div></div>
    <div className="science-controls"><ScienceRange label="振动频率" value={frequency} min={110} max={715} step={11} unit="Hz" onChange={setFrequency} onInteract={interact} /><ScienceRange label="相对振幅" value={amplitude} min={8} max={70} step={1} unit="%" onChange={setAmplitude} onInteract={interact} /><ResultCell label="证据提醒" value={baseline ? "只改变一个条件，再与灰色基准波比较" : "先保存一条基准波形"} pending={!baseline} /></div>
    <section className="sound-feature-matrix"><header><span><ClipboardList size={16}/><b>THREE-FACTOR EVIDENCE / 三要素证据矩阵</b></span><button disabled={!currentFeature} onClick={recordFeatureComparison}><Save size={14}/>{currentFeature ? `记录${soundFeatureLabels[currentFeature].control}对照` : "先形成单变量对照"}</button></header><div>{(Object.keys(soundFeatureLabels) as SoundFeatureFactor[]).map((factor,index) => <article className={featureEvidence.includes(factor) ? "complete" : currentFeature === factor ? "ready" : ""} key={factor}><span>0{index + 1}</span><small>控制量</small><strong>{soundFeatureLabels[factor].control}</strong><i>→</i><small>观察量</small><b>{soundFeatureLabels[factor].observation}</b><em>{featureEvidence.includes(factor) ? "证据已记录" : currentFeature === factor ? "当前可记录" : "等待对照"}</em></article>)}</div></section>
    {baseline && <EvidenceVerdict valid={soundLearningReady} title={soundLearningReady ? "频率、振幅与波形三项证据已闭环" : soundComparison?.valid ? "当前是合格单变量对照，记录后继续下一项" : "基准已保存，但对照条件还不合格"} detail={soundLearningReady ? "三个独立对照分别支持：频率影响音调和周期，振幅影响响度与波高，不同波形对应不同音色。" : soundComparison?.valid ? `本次只改变了${soundFeatureLabels[currentFeature!].control}；记录后更新基准，再研究尚未完成的条件。` : soundComparison?.changedIndexes.length === 0 ? "请改变频率、振幅或音色中的一个。" : "当前同时改变了两项或三项，请恢复其他控制量。"} />}
  </LabFrame>;
}
