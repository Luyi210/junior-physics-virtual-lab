import { useEffect, useMemo, useState } from "react";
import { Activity, Pause, Play, RotateCcw, Save } from "lucide-react";
import { analyzeLongitudinalParticleSnapshot } from "@physics-lab/physics";
import { useHarnessStore } from "../harness/harnessStore";

interface ParticleSnapshot {
  id: number;
  phase: number;
  selectedParticle: number;
  displacements: number[];
  compressionCenter: number;
  rarefactionCenter: number;
}

const particleEquilibriumPositions = Array.from({ length: 15 }, (_, index) => 25 + index * 29);
const particleWavelength = 29 * Math.PI * 2 / .62;

export function SoundParticleMicroscope({ onSnapshotCountChange, onPropagationReadyChange }: { onSnapshotCountChange?: (count: number) => void; onPropagationReadyChange?: (ready: boolean) => void }) {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState(0);
  const [selectedParticle, setSelectedParticle] = useState(7);
  const [snapshots, setSnapshots] = useState<ParticleSnapshot[]>([]);
  const [propagationAnswer, setPropagationAnswer] = useState<"right" | "left" | "stationary">();
  const recordHarness = useHarnessStore((state) => state.record);

  useEffect(() => onSnapshotCountChange?.(snapshots.length), [onSnapshotCountChange, snapshots.length]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const motionPaused = paused || reducedMotion;
  useEffect(() => {
    if (motionPaused) return;
    const timer = window.setInterval(() => setPhase((value) => (value + .11) % (Math.PI * 2)), 45);
    return () => window.clearInterval(timer);
  }, [motionPaused]);

  const selectedParticleShift = selectedParticle * .62;
  const wavePoints = useMemo(() => Array.from({ length: 81 }, (_, index) => {
    const samplePhase = index / 80 * Math.PI * 2;
    return `${35 + index / 80 * 360},${55 - Math.sin(samplePhase - selectedParticleShift) * 30}`;
  }).join(" "), [selectedParticleShift]);
  const markerX = 35 + phase / (Math.PI * 2) * 360;
  const markerY = 55 - Math.sin(phase - selectedParticleShift) * 30;
  const phaseAdvance = snapshots.length ? (phase - snapshots.at(-1)!.phase + Math.PI * 2) % (Math.PI * 2) : null;
  const snapshotTimingReady = phaseAdvance === null || phaseAdvance >= .55 && phaseAdvance <= 2.4;
  const saveSnapshot = () => {
    if (!snapshotTimingReady) return;
    const displacements = Array.from({ length: 15 }, (_, index) => Math.sin(phase - index * .62) * 7);
    const analysis = analyzeLongitudinalParticleSnapshot(particleEquilibriumPositions, displacements.map((value) => value * 1.35));
    const snapshot = {
      id: Date.now(),
      phase,
      selectedParticle,
      displacements,
      compressionCenter: analysis.compressionCenter,
      rarefactionCenter: analysis.rarefactionCenter
    };
    setSnapshots((items) => [...items.slice(-1), snapshot]);
    setPropagationAnswer(undefined);
    recordHarness("configuration.changed", { experiment: "sound-medium", control: "保存粒子分布快照", value: `相位${phase.toFixed(2)}rad/跟踪粒子${selectedParticle + 1}` });
  };
  const rawZoneShift = snapshots.length === 2 ? snapshots[1]!.compressionCenter - snapshots[0]!.compressionCenter : 0;
  const compareZoneShift = snapshots.length === 2
    ? ((rawZoneShift + particleWavelength / 2) % particleWavelength + particleWavelength) % particleWavelength - particleWavelength / 2
    : 0;
  const observedPropagation = compareZoneShift > 2 ? "right" : compareZoneShift < -2 ? "left" : "stationary";
  const propagationReady = snapshots.length === 2 && propagationAnswer === observedPropagation;
  useEffect(() => onPropagationReadyChange?.(propagationReady), [onPropagationReadyChange, propagationReady]);
  const answerPropagation = (answer: "right" | "left" | "stationary") => {
    setPropagationAnswer(answer);
    recordHarness("configuration.changed", { experiment: "sound-medium", control: "疏密区域传播判断", value: answer === "right" ? "向右传播" : answer === "left" ? "向左传播" : "停在原处" });
  };

  return <section className={`sound-particle-microscope ${motionPaused ? "paused" : ""}`} aria-label="空气粒子微观放大窗">
    <header><span><Activity size={16}/><b>MICRO VIEW / 空气粒子微观放大</b></span><div><button type="button" disabled={!snapshotTimingReady} title={!snapshotTimingReady ? phaseAdvance !== null && phaseAdvance > 2.4 ? "已间隔过久，请清空后重新取样" : "让动画再运行片刻，形成清晰的时间间隔" : ""} onClick={saveSnapshot}><Save size={14}/>{snapshotTimingReady ? "保存当前快照" : phaseAdvance !== null && phaseAdvance > 2.4 ? "间隔过久" : "等待不同时刻"}</button>{motionPaused && <button type="button" onClick={() => setPhase((value) => (value + .75) % (Math.PI * 2))}><Activity size={14}/>步进一帧</button>}<button type="button" disabled={reducedMotion} title={reducedMotion ? "系统已开启减少动态效果，可使用步进一帧观察" : ""} onClick={() => setPaused((value) => !value)}>{motionPaused ? <Play size={14}/> : <Pause size={14}/>} {reducedMotion ? "系统静态模式" : paused ? "继续动画" : "暂停观察"}</button></div></header>
    <div className="particle-equilibrium-track">{Array.from({ length: 15 }, (_, index) => {
      const displacement = Math.sin(phase - index * .62) * 7;
      return <button type="button" className={selectedParticle === index ? "selected" : ""} aria-label={`观察第${index + 1}个空气粒子`} onClick={() => setSelectedParticle(index)} key={index}><b style={{ transform: `translateX(${displacement}px)` }}/><em>{index + 1}</em></button>;
    })}</div>
    <div className="particle-displacement-plot"><svg viewBox="0 0 430 110" preserveAspectRatio="none" aria-label={`第${selectedParticle + 1}个粒子的位移时间图`}><line x1="35" y1="55" x2="405" y2="55"/><line x1="35" y1="12" x2="35" y2="96"/><polyline points={wavePoints}/><line className="time-cursor" x1={markerX} y1="15" x2={markerX} y2="95"/><circle cx={markerX} cy={markerY} r="5"/><text x="5" y="18">位移</text><text x="392" y="105">时间</text></svg><span><small>TRACKED PARTICLE / 跟踪粒子</small><strong>第 {selectedParticle + 1} 个粒子</strong><em>曲线游标与左侧粒子瞬时位移同步；暂停后可逐项比较。</em></span></div>
    {snapshots.length > 0 && <div className="particle-snapshot-ledger"><header><span><small>SPATIAL SNAPSHOT / 同一时刻的空间分布</small><strong>{snapshots.length < 2 ? "再保存另一个明显不同的时刻，比较疏密区怎样移动" : "蓝框是密部，虚线框是疏部；比较它们的位置变化"}</strong></span><button type="button" onClick={() => { setSnapshots([]); setPropagationAnswer(undefined); }}><RotateCcw size={13}/>清空</button></header><div>{snapshots.map((snapshot, snapshotIndex) => <article key={snapshot.id}><span>快照 {snapshotIndex + 1} · 相位 {snapshot.phase.toFixed(2)} rad</span><svg viewBox="0 0 460 76" preserveAspectRatio="none" aria-label={`粒子分布快照${snapshotIndex + 1}`}><line x1="20" y1="38" x2="440" y2="38"/><g className="compression-zone"><rect x={snapshot.compressionCenter-25} y="10" width="50" height="56" rx="5"/><text x={snapshot.compressionCenter} y="9">密部</text></g><g className="rarefaction-zone"><rect x={snapshot.rarefactionCenter-25} y="13" width="50" height="50" rx="5"/><text x={snapshot.rarefactionCenter} y="73">疏部</text></g>{snapshot.displacements.map((displacement, index) => { const equilibriumX = particleEquilibriumPositions[index]!; const currentX = equilibriumX + displacement * 1.35; return <g className={snapshot.selectedParticle === index ? "tracked" : ""} key={index}><line className="equilibrium" x1={equilibriumX} y1="17" x2={equilibriumX} y2="59"/><circle cx={currentX} cy="38" r={snapshot.selectedParticle === index ? 5 : 3.5}/></g>; })}</svg></article>)}</div>{snapshots.length === 2 && <section className={`particle-propagation-question ${propagationReady ? "correct" : propagationAnswer ? "incorrect" : ""}`}><span><small>COMPARE & EXPLAIN / 比较后判断</small><strong>从快照 1 到快照 2，密部整体向哪里传播？</strong></span><div>{(["right","left","stationary"] as const).map((answer) => <button className={propagationAnswer === answer ? "selected" : ""} type="button" onClick={() => answerPropagation(answer)} key={answer}>{answer === "right" ? "向右" : answer === "left" ? "向左" : "停在原处"}</button>)}</div><em>{!propagationAnswer ? "观察蓝色密部的位置，不要只盯住某一个粒子。" : propagationReady ? "判断正确：疏密区域在传播，而单个粒子仍在平衡位置附近往复。" : `再比较蓝框位置：本组快照显示密部${observedPropagation === "right" ? "向右" : observedPropagation === "left" ? "向左" : "基本未移动"}。`}</em></section>}</div>}
    <footer><span><i/>竖线：粒子的平衡位置</span><span><i/>亮点：空气粒子，只在附近往复</span><strong>相邻粒子的振动相位依次错开 → 疏密区域向右传播，物质没有整体搬运</strong></footer>
  </section>;
}
