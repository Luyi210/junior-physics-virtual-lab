import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useRef, useEffect } from "react";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Activity, AlertTriangle, Play, Save, ClipboardList, RotateCcw } from "lucide-react";
import { createMicrophoneCapture } from "./microphoneCapture";

interface MicrophoneSnapshot { id: number; level: number; frequency: number; }

type MicrophoneStatus = "idle" | "requesting" | "active" | "denied" | "unsupported" | "demo";

export function LiveMicrophoneLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [status, setStatus] = useState<MicrophoneStatus>("idle");
  const [level, setLevel] = useState(0);
  const [frequency, setFrequency] = useState(0);
  const [wavePoints, setWavePoints] = useState("0,90 760,90");
  const [snapshots, setSnapshots] = useState<MicrophoneSnapshot[]>([]);
  const [capture] = useState(() => createMicrophoneCapture());
  const runningMode = useRef<"microphone" | "demo" | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const active = status === "active" || status === "demo";
  const levelLabel = level < 5 ? "环境较安静" : level < 18 ? "普通说话线索" : level < 38 ? "声音较强" : "瞬时强声";
  const pitchLabel = frequency <= 0 ? "等待稳定周期" : frequency < 250 ? "低频成分较突出" : frequency < 1000 ? "中频成分较突出" : "高频成分较突出";

  const recordStopped = () => {
    const mode = runningMode.current;
    runningMode.current = null;
    if (mode) recordHarness("simulation.toggled", { experiment: "sound-microphone", running: false, action: mode === "demo" ? "模拟信号已停止" : "麦克风采集已停止" });
  };
  const stopMicrophone = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    capture.stop();
    recordStopped();
    rafRef.current = null;
    setStatus("idle"); setLevel(0); setFrequency(0); setWavePoints("0,90 760,90");
  };

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    capture.stop();
    // Navigation may already have selected another learning session. Cleanup
    // releases resources without appending an event to that session.
    runningMode.current = null;
  }, [capture]);

  useEffect(() => {
    if (status !== "demo") return;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const demoLevel = 14 + Math.sin(frame * .38) * 8 + (frame % 13 === 0 ? 18 : 0);
      const demoFrequency = 220 + Math.sin(frame * .17) * 75;
      const points = Array.from({ length: 96 }, (_, index) => `${index * 8},${90 + Math.sin(index * .34 + frame * .3) * demoLevel * .9}`).join(" ");
      setLevel(Math.max(0, demoLevel)); setFrequency(Math.max(0, demoFrequency)); setWavePoints(points);
    }, 90);
    return () => window.clearInterval(timer);
  }, [status]);

  const startMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
    setStatus("requesting");
    const request = capture.start();
    try {
      const result = await request.ready;
      if (!request.isCurrent() || !result) return;
      const { context, analyser } = result;
      const timeData = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      lastUpdateRef.current = 0;
      setStatus("active");
      runningMode.current = "microphone";
      recordHarness("simulation.toggled", { experiment: "sound-microphone", running: true, action: "麦克风采集已启动" });
      recordHarness("configuration.changed", { experiment: "sound-microphone", control: "麦克风", value: "enabled" });
      const sample = (now: number) => {
        if (!request.isCurrent()) return;
        analyser.getByteTimeDomainData(timeData); analyser.getByteFrequencyData(frequencyData);
        if (now - lastUpdateRef.current > 70) {
          lastUpdateRef.current = now;
          let squareSum = 0;
          for (const value of timeData) { const centered = (value - 128) / 128; squareSum += centered * centered; }
          const rms = Math.sqrt(squareSum / timeData.length);
          let peakIndex = 0; let peakValue = 0;
          for (let index = 2; index < frequencyData.length; index += 1) { if (frequencyData[index]! > peakValue) { peakValue = frequencyData[index]!; peakIndex = index; } }
          const nextFrequency = peakValue > 22 ? peakIndex * context.sampleRate / analyser.fftSize : 0;
          const points = Array.from({ length: 96 }, (_, index) => { const sampleIndex = Math.floor(index / 95 * (timeData.length - 1)); return `${index * 8},${90 + ((timeData[sampleIndex]! - 128) / 128) * 78}`; }).join(" ");
          setLevel(Math.min(100, rms * 260)); setFrequency(nextFrequency); setWavePoints(points);
        }
        rafRef.current = requestAnimationFrame(sample);
      };
      rafRef.current = requestAnimationFrame(sample);
    } catch {
      if (!request.isCurrent()) return;
      capture.stop();
      recordStopped();
      setStatus("denied");
    }
  };
  const toggleMicrophone = () => { if (active || status === "requesting") stopMicrophone(); else void startMicrophone(); };
  const startDemo = () => {
    stopMicrophone(); setStatus("demo"); runningMode.current = "demo";
    recordHarness("simulation.toggled", { experiment: "sound-microphone", running: true, action: "模拟信号已启动" });
    recordHarness("configuration.changed", { experiment: "sound-microphone", control: "信号模式", value: "demo" });
  };
  const freezeReading = () => {
    if (!active) return;
    setSnapshots((items) => [{ id: Date.now(), level, frequency }, ...items].slice(0, 5));
    recordHarness("configuration.changed", { experiment: "sound-microphone", control: "冻结读数", value: `${level.toFixed(1)}%/${frequency.toFixed(0)}Hz` });
  };
  useEffect(() => {
    publishApparatusSnapshot({
      module: "sound-microphone", capturedAt: new Date().toISOString(), origin: active ? "learner" : "system",
      controls: [{ id: "mode", label: "采集模式", value: status, source: "control" }],
      apparatus: [{ id: "microphone", label: "麦克风采集", value: status === "active", source: "apparatus" }],
      readings: [
        { id: "level", label: "相对声强线索", value: active ? Number(level.toFixed(1)) : null, unit: "%", source: "reading" },
        { id: "frequency", label: "主频线索", value: active && frequency > 0 ? Number(frequency.toFixed(0)) : null, unit: "Hz", source: "reading" }
      ],
      derived: [{ id: "samples", label: "已冻结证据", value: snapshots.length, unit: "组", source: "model" }],
      validity: { ready: snapshots.length >= 2, issues: snapshots.length >= 2 ? [] : [active ? "至少冻结两组不同声音的读数。" : "先启用麦克风或模拟信号。"] }
    });
  }, [active, frequency, level, snapshots.length, status]);

  return <LabFrame field="sound" experiment="sound-microphone" eyebrow="LIVE ACOUSTIC INPUT / 实时声学采集" title="让真实声音进入实验，而不是只看预设动画" description="浏览器只在当前设备上计算波形与频率线索，不录音、不保存原始声音，也不会把音频上传到服务器。请避免突然对着麦克风发出过强声音。" running={active} onToggle={toggleMicrophone} recordToggleEvent={false} playLabel={status === "requesting" ? "取消麦克风请求" : "启用本机麦克风"} runningLabel={status === "demo" ? "停止模拟信号" : "停止麦克风"}>
    <section className={`live-mic-stage ${active ? "is-live" : ""}`} style={{ "--live-level": `${Math.max(2, level)}%` } as React.CSSProperties}>
      <header><span><i /> {status === "active" ? "MIC INPUT ONLINE" : status === "demo" ? "DEMO SIGNAL ONLINE" : "INPUT STANDBY"}</span><b>LOCAL PROCESSING · AUDIO NOT STORED</b></header>
      <div className="live-waveform"><div className="live-grid" /><svg viewBox="0 0 760 180" preserveAspectRatio="none"><polyline points={wavePoints} /></svg><span><Activity size={15} /> TIME DOMAIN / 时间波形</span>{!active && <InteractionCue text="启用麦克风，说话或轻拍手掌" />}</div>
      <aside><div className="live-level-ring"><span style={{ transform: `rotate(${Math.min(220, level * 2.2) - 110}deg)` }} /><strong>{level.toFixed(0)}<em>%</em></strong><small>相对强度</small></div><div className="live-frequency"><small>DOMINANT FREQUENCY CLUE</small><strong>{frequency > 0 ? frequency.toFixed(0) : "— —"}<em>{frequency > 0 ? "Hz" : ""}</em></strong><span>{pitchLabel}</span></div></aside>
      <footer><span><b>LEVEL</b>{levelLabel}</span><span><b>PRIVACY</b>本机实时计算</span><span><b>EVIDENCE</b>{snapshots.length} 组已冻结</span></footer>
    </section>
    {(status === "denied" || status === "unsupported") && <section className="microphone-fallback"><AlertTriangle size={20} /><span><b>{status === "unsupported" ? "当前浏览器不支持实时麦克风接口" : "没有获得麦克风权限"}</b><small>你可以在浏览器地址栏恢复权限后重试，或先用模拟信号体验波形与读数。</small></span><button type="button" onClick={startDemo}><Play size={14} />使用模拟信号</button></section>}
    <section className="microphone-challenges"><header><span><small>REAL-WORLD TASKS</small><b>三个声音证据挑战</b></span><button type="button" disabled={!active} onClick={freezeReading}><Save size={14} />冻结当前读数</button></header><div><article><b>01 / 说一句话</b><p>观察波形如何随音节不断改变，主频线索是否稳定。</p></article><article><b>02 / 轻拍手掌</b><p>寻找短促而幅度较大的瞬态波形，不要靠麦克风过近。</p></article><article><b>03 / 发出稳定音</b><p>用哼唱或乐器保持音高，观察频率线索能否相对稳定。</p></article></div></section>
    <div className="science-controls"><ResultCell label="相对强度" value={active ? `${level.toFixed(1)}% · ${levelLabel}` : "等待声音"} pending={!active} /><ResultCell label="主频线索" value={active && frequency > 0 ? `${frequency.toFixed(0)} Hz · ${pitchLabel}` : "等待稳定周期"} pending={!active} /><ResultCell label="数据边界" value="线索读数，不等同专业声级计" /></div>
    {snapshots.length > 0 && <section className="acoustic-reading-strip"><header><ClipboardList size={15} /><b>CAPTURED EVIDENCE / 声音证据</b><button type="button" onClick={() => setSnapshots([])}><RotateCcw size={13} />清空</button></header><div>{snapshots.map((item, index) => <article key={item.id}><small>#{String(snapshots.length - index).padStart(2, "0")}</small><b>{item.level < 10 ? "较弱声音" : item.level < 30 ? "中等声音" : "较强瞬态"}</b><span>相对强度 {item.level.toFixed(1)}%</span><strong>{item.frequency > 0 ? `${item.frequency.toFixed(0)} Hz` : "非周期声"}</strong></article>)}</div></section>}
    {snapshots.length > 0 && <EvidenceVerdict valid={snapshots.length >= 2} title={snapshots.length >= 2 ? "已经形成可比较的真实声音证据" : "已冻结第一组读数"} detail={snapshots.length >= 2 ? "比较两组的波形、相对强度和主频线索，再说明哪些差异对应响度、音调或声音的瞬态特征。" : "换一种声音再冻结一次，才能形成比较。"} />}
  </LabFrame>;
}
