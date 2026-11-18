import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ScienceRange, ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { RadioTower, Mic2, Ear, Save, ClipboardList, RotateCcw } from "lucide-react";

type AuditoriumMaterialKey = "hard" | "curtain" | "panel" | "hybrid";

const auditoriumMaterials: Record<AuditoriumMaterialKey, { label: string; alpha: number; note: string }> = {
  hard: { label: "硬质墙面", alpha: .08, note: "反射强，声音持续较久" },
  curtain: { label: "厚重幕布", alpha: .38, note: "中高频吸声较明显" },
  panel: { label: "吸声板", alpha: .62, note: "显著缩短反射声衰减时间" },
  hybrid: { label: "吸声 + 扩散", alpha: .46, note: "兼顾清晰度与空间感" }
};

interface AuditoriumReading { id: number; material: string; volume: number; audience: number; rt60: number; }

export function AuditoriumAcousticsLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [materialKey, setMaterialKey] = useState<AuditoriumMaterialKey>("hard");
  const [volume, setVolume] = useState(1200);
  const [audience, setAudience] = useState(80);
  const [pulse, setPulse] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [readings, setReadings] = useState<AuditoriumReading[]>([]);
  const material = auditoriumMaterials[materialKey];
  const surface = Math.pow(volume, 2 / 3) * 5.4;
  const equivalentAbsorption = 26 + surface * material.alpha + audience * .42;
  const rt60 = Math.max(.18, 0.161 * volume / equivalentAbsorption);
  const speechReady = rt60 >= .55 && rt60 <= 1.15;
  const diagnosis = rt60 > 1.15 ? "混响偏长，连续语音可能相互掩蔽" : rt60 < .55 ? "混响偏短，空间可能显得过于干涩" : "处于教学语音的清晰区间";
  const echoCount = Math.max(2, Math.min(8, Math.round(rt60 * 5)));

  useEffect(() => { if (!pulse) return; const timer = window.setTimeout(() => setPulse(false), 1800); return () => window.clearTimeout(timer); }, [pulse]);
  useEffect(() => {
    publishApparatusSnapshot({
      module: "sound-auditorium", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system",
      controls: [
        { id: "volume", label: "礼堂体积", value: volume, unit: "m³", source: "control" },
        { id: "audience", label: "观众人数", value: audience, unit: "人", source: "control" },
        { id: "material", label: "内衬方案", value: material.label, source: "control" }
      ],
      apparatus: [{ id: "pulse", label: "测试脉冲", value: pulse, source: "apparatus" }],
      readings: [{ id: "rt60", label: "估算混响时间", value: Number(rt60.toFixed(2)), unit: "s", source: "reading" }],
      derived: [{ id: "absorption", label: "等效吸声量", value: Number(equivalentAbsorption.toFixed(0)), source: "model" }],
      validity: { ready: speechReady, issues: speechReady ? [] : [diagnosis] }
    });
  }, [audience, diagnosis, equivalentAbsorption, interacted, material.label, pulse, rt60, speechReady, volume]);
  const saveReading = () => {
    setReadings((items) => [{ id: Date.now(), material: material.label, volume, audience, rt60 }, ...items].slice(0, 5));
    setInteracted(true);
    recordHarness("configuration.changed", { experiment: "sound-auditorium", control: "冻结混响读数", value: `${rt60.toFixed(2)}s` });
  };

  return <LabFrame field="sound" experiment="sound-auditorium" eyebrow="ARCHITECTURAL ACOUSTICS / 建筑声学设计台" title="让最后一排也能听清，而不是只听见“很响”" description="改变空间体积、观众人数与内衬材料，使用简化的 Sabine 关系估算混响时间。该模型用于理解变量方向，不代替建筑声学设计报告。" running={pulse} onToggle={() => { setPulse(true); setInteracted(true); }} playLabel="播放测试脉冲" runningLabel="正在追踪反射声">
    <section className={`auditorium-stage ${pulse ? "is-pulsing" : ""}`} style={{ "--echo-count": echoCount, "--rt": `${Math.min(2.8, Math.max(.6, rt60))}s` } as React.CSSProperties}>
      <header><span><RadioTower size={16} /> IMPULSE RESPONSE / 脉冲响应</span><b>{material.note}</b></header>
      <div className="auditorium-room"><div className="auditorium-curtain" /><div className="auditorium-speaker"><Mic2 size={24} /><i /></div><div className="auditorium-echoes">{Array.from({ length: echoCount }, (_, index) => <i style={{ animationDelay: `${index * .1}s`, opacity: 1 - index / (echoCount + 1) }} key={index} />)}</div><div className="auditorium-audience">{Array.from({ length: 18 }, (_, index) => <i className={index < Math.round(audience / 25) ? "occupied" : ""} key={index} />)}</div><div className="auditorium-back-seat"><Ear size={21} /><span><small>LAST ROW SENSOR</small><b>{diagnosis}</b></span></div></div>
      <aside className={speechReady ? "ready" : "warning"}><small>ESTIMATED RT60</small><strong>{rt60.toFixed(2)}<em>s</em></strong><span><i style={{ left: `${Math.min(100, rt60 / 2.5 * 100)}%` }} /></span><p>语音参考区间 0.55–1.15 s</p></aside>
      {!interacted && <InteractionCue text="播放一次测试脉冲，观察反射声衰减" />}
    </section>
    <section className="auditorium-materials"><header><span><small>MATERIAL LIBRARY</small><b>选择内衬方案</b></span><button type="button" onClick={saveReading}><Save size={14} />冻结当前读数</button></header><div>{(Object.keys(auditoriumMaterials) as AuditoriumMaterialKey[]).map((key) => { const item = auditoriumMaterials[key]; return <button type="button" className={materialKey === key ? "active" : ""} onClick={() => { setMaterialKey(key); setInteracted(true); }} key={key}><span><i style={{ opacity: item.alpha }} /></span><b>{item.label}</b><small>吸声系数线索 α ≈ {item.alpha}</small><em>{item.note}</em></button>; })}</div></section>
    <div className="science-controls"><ScienceRange label="礼堂体积" value={volume} min={500} max={2800} step={50} unit="m³" onChange={setVolume} onInteract={() => setInteracted(true)} /><ScienceRange label="观众人数" value={audience} min={0} max={450} step={10} unit="人" onChange={setAudience} onInteract={() => setInteracted(true)} /><ResultCell label="语音清晰度判断" value={interacted ? diagnosis : "等待测试"} pending={!interacted} /></div>
    {readings.length > 0 && <section className="acoustic-reading-strip"><header><ClipboardList size={15} /><b>DESIGN SNAPSHOTS / 方案对比</b><button type="button" onClick={() => setReadings([])}><RotateCcw size={13} />清空</button></header><div>{readings.map((reading, index) => <article key={reading.id}><small>#{String(readings.length - index).padStart(2, "0")}</small><b>{reading.material}</b><span>{reading.volume} m³ · {reading.audience} 人</span><strong>{reading.rt60.toFixed(2)} s</strong></article>)}</div></section>}
    {interacted && <EvidenceVerdict valid={speechReady} title={speechReady ? "当前方案进入教学语音参考区间" : "当前混响时间需要继续调整"} detail={speechReady ? "接下来可只改变观众人数或材料中的一个，保存两组读数进行公平比较。" : rt60 > 1.15 ? "尝试增加吸声材料或提高上座人数，观察反射声衰减是否加快。" : "尝试减少吸声、增加空间体积，保留适量自然混响。"} />}
  </LabFrame>;
}
