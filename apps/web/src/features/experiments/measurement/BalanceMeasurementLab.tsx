import { useState, useEffect } from "react";
import { Scale, Info, ArrowRight, RotateCcw, Pipette, Gauge, ClipboardList, Save } from "lucide-react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { analyzeInvariantEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { PhysicsFieldMotif } from "../../../shared/components/PhysicsFieldMotif";
import { ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";

const trayBalanceWeights = [
  { id: "weight-100", mass: 100 },
  { id: "weight-50", mass: 50 },
  { id: "weight-20-a", mass: 20 },
  { id: "weight-20-b", mass: 20 },
  { id: "weight-10", mass: 10 },
  { id: "weight-5", mass: 5 }
] as const;

type TrayBalanceWeightId = typeof trayBalanceWeights[number]["id"];

const balanceGuideSteps = [
  { number: "01", title: "归零检查", short: "游码必须先回到零刻度", detail: "把天平放在水平桌面，确认托盘空着，再将游码移到标尺左端的零刻度。没有归零就调平，会把游码的质量误当成天平本身的不平衡。", notice: "调平前：空盘、游码归零。" },
  { number: "02", title: "调节平衡", short: "指针左偏右调，右偏左调", detail: "只在空载时调节平衡螺母。指针偏左，就把螺母向右调；指针偏右，就向左调。反复微调，直到指针对准分度盘中央。", notice: "称量开始以后，不再调平衡螺母。" },
  { number: "03", title: "左物右码", short: "待测物放左盘，砝码放右盘", detail: "把待测物轻放在左盘，用镊子夹取砝码放入右盘。砝码不能用手直接拿，潮湿物体和化学药品也不能直接接触托盘。", notice: "记忆口诀：左物右码。" },
  { number: "04", title: "先大后小", short: "从大砝码开始逐级试放", detail: "估计物体质量后，先放较大的砝码，再逐步换用较小的砝码。右盘过重就取下或换小，左盘过重就继续添加，直到只差很小的质量。", notice: "增减砝码时动作要轻，并用镊子操作。" },
  { number: "05", title: "游码微调", short: "砝码接近后再移动游码", detail: "当最小砝码仍不能让天平平衡时，保持砝码组合不变，缓慢向右移动游码。观察指针摆动，直到指针回到中央。", notice: "游码相当于给右盘增加一个很小的质量。" },
  { number: "06", title: "正确读数", short: "物体质量＝砝码总质量＋游码示数", detail: "天平平衡后，先把右盘所有砝码质量相加，再读取游码左边缘所对的刻度。两者之和就是物体质量，最后用镊子收回砝码并让游码归零。", notice: "读数要带单位 g，并记录到合适的小数位。" }
] as const;

function BalanceUsageGuide({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = balanceGuideSteps[stepIndex];
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const next = () => stepIndex === balanceGuideSteps.length - 1 ? onClose() : setStepIndex((index) => index + 1);

  return <div className="balance-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className={`balance-guide-dialog guide-step-${stepIndex + 1}`} role="dialog" aria-modal="true" aria-labelledby="balance-guide-title">
      <button className="balance-guide-close" onClick={onClose} aria-label="关闭托盘天平使用教学">×</button>
      <aside className="balance-guide-visual">
        <div className="balance-guide-plate"><span>INSTRUMENT MANUAL</span><strong>托盘天平</strong><small>操作教学 · 六步完成称量</small></div>
        <div className="balance-guide-apparatus" aria-hidden="true">
          <div className="guide-dial"><i /></div>
          <div className="guide-column" />
          <div className="guide-beam"><i /><i /></div>
          <div className="guide-pan left"><span>物</span></div>
          <div className="guide-pan right"><span>码</span></div>
          <div className="guide-base"><Scale size={22} /></div>
          <div className="guide-rider"><i /></div>
          <b className="guide-highlight highlight-zero">归零</b><b className="guide-highlight highlight-nut">平衡螺母</b><b className="guide-highlight highlight-object">左盘放物</b><b className="guide-highlight highlight-weight">右盘放码</b><b className="guide-highlight highlight-rider">移动游码</b><b className="guide-highlight highlight-reading">平衡读数</b>
        </div>
        <div className="balance-guide-formula"><small>READING RULE / 读数规则</small><strong>m<sub>物</sub> = m<sub>砝码</sub> + m<sub>游码</sub></strong></div>
      </aside>
      <main className="balance-guide-content">
        <div className="balance-guide-heading"><span>HOW TO USE / 使用教学</span><b>{step.number} / 06</b><h2 id="balance-guide-title">{step.title}</h2><strong>{step.short}</strong></div>
        <p>{step.detail}</p>
        <div className="balance-guide-notice"><Info size={18} /><span><small>这一点最重要</small><strong>{step.notice}</strong></span></div>
        <nav className="balance-guide-stepper" aria-label="托盘天平教学步骤">{balanceGuideSteps.map((item, index) => <button className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} onClick={() => setStepIndex(index)} aria-label={`第${index + 1}步：${item.title}`} key={item.number}><b>{index < stepIndex ? "✓" : item.number}</b><span>{item.title}</span></button>)}</nav>
        <footer><button onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}>上一步</button><span>也可以点击步骤编号直接查看</span><button className="primary" onClick={next}>{stepIndex === balanceGuideSteps.length - 1 ? "我会了，开始实验" : <>下一步 <ArrowRight size={16} /></>}</button></footer>
      </main>
    </section>
  </div>;
}

export function BalanceMeasurementLab() {
  const objectMass = 137.5;
  const recordHarness = useHarnessStore((state) => state.record);
  const [guideOpen, setGuideOpen] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem("physics-balance-guide-seen") !== "1");
  const [rider, setRider] = useState(.6);
  const [nutOffset, setNutOffset] = useState(.8);
  const [objectPlaced, setObjectPlaced] = useState(false);
  const [selectedWeightIds, setSelectedWeightIds] = useState<TrayBalanceWeightId[]>([]);
  const [measurements, setMeasurements] = useState<number[]>([]);
  const [trialSaved, setTrialSaved] = useState(false);
  const [tweezersHeld, setTweezersHeld] = useState(false);
  const [weightOrderWarning, setWeightOrderWarning] = useState(false);
  const [weightHandlingObserved, setWeightHandlingObserved] = useState(false);
  const weightsTotal = trayBalanceWeights.filter((weight) => selectedWeightIds.includes(weight.id)).reduce((total, weight) => total + weight.mass, 0);
  // Loading is allowed only after empty-pan zeroing, and the nut is locked while
  // loaded. Moving the rider during weighing therefore preserves that calibration.
  const calibrated = Math.abs(nutOffset) <= .05 && (objectPlaced || rider <= .05);
  const massDifference = objectPlaced ? weightsTotal + rider - objectMass : 0;
  const balanceSignal = objectPlaced ? massDifference / 5 + nutOffset : nutOffset + rider * .22;
  const beamTilt = Math.max(-7, Math.min(7, balanceSignal * 1.45));
  const balanced = objectPlaced && Math.abs(massDifference) < .06 && Math.abs(nutOffset) <= .05;
  const leftPanY = -beamTilt * 3.25;
  const rightPanY = beamTilt * 3.25;
  const repeatability = analyzeInvariantEvidence(measurements, .002, 2);

  const stage = !calibrated ? 0 : !objectPlaced ? 1 : !balanced ? 2 : 3;
  const guidance = !calibrated
    ? rider > .05 ? "先把游码移到标尺左端的零刻度，再调节平衡螺母。" : nutOffset > .05 ? "指针偏右，请向左调节平衡螺母。" : "指针偏左，请向右调节平衡螺母。"
    : !objectPlaced ? "空载已经平衡。现在把待测金属块放在左盘。"
      : balanced ? "指针回到中央：砝码总质量加游码示数，就是物体质量。"
        : massDifference > 0 ? "右盘偏重：取下较大的砝码，或把游码向左移动。"
          : weightsTotal === 0 ? "左盘下沉：按照“先大后小”的顺序向右盘添加砝码。"
            : objectMass - weightsTotal > 5 ? "左盘仍偏重：继续由大到小添加或更换砝码。" : "已经接近平衡：停止加大砝码，移动游码进行微调。";

  useEffect(() => {
    const pointer = Math.abs(beamTilt) <= .08 ? "对中" : beamTilt > 0 ? "右偏" : "左偏";
    publishApparatusSnapshot({
      module: "measurement-balance",
      capturedAt: new Date().toISOString(),
      origin: calibrated || objectPlaced || selectedWeightIds.length > 0 || rider !== .6 || nutOffset !== .8 ? "learner" : "system",
      controls: [
        { id: "rider", label: "游码示数", value: rider, unit: "g", source: "control" },
        { id: "nut-offset", label: "平衡螺母偏移", value: nutOffset, unit: "格", source: "control" }
      ],
      apparatus: [
        { id: "calibrated", label: "空载调平", value: calibrated, source: "apparatus" },
        { id: "object-placed", label: "待测物已放置", value: objectPlaced, source: "apparatus" },
        { id: "weights-total", label: "砝码总质量", value: weightsTotal, unit: "g", source: "apparatus" },
        { id: "tweezers", label: "镊子已拿起", value: tweezersHeld, source: "apparatus" },
        { id: "proper-weight-handling", label: "使用镊子取放砝码", value: weightHandlingObserved, source: "apparatus" },
        { id: "pointer", label: "指针状态", value: pointer, source: "apparatus" },
        { id: "balanced", label: "称量平衡", value: balanced, source: "apparatus" }
      ],
      readings: [
        { id: "measured-mass", label: "测得质量", value: balanced ? weightsTotal + rider : null, unit: "g", source: "reading" }
      ],
      derived: [
        { id: "stage", label: "操作阶段", value: stage + 1, source: "model" },
        { id: "guidance", label: "当前操作建议", value: guidance, source: "model" },
        { id: "repeatability", label: "两次独立称量一致", value: repeatability.stable, source: "model" }
      ],
      validity: {
        ready: repeatability.stable,
        issues: repeatability.stable ? [] : !balanced ? [guidance] : !trialSaved ? ["保存本次平衡读数。"] : ["取下物体并重新归零调平，再完成第二次独立称量。"]
      }
    });
  }, [balanced, beamTilt, calibrated, guidance, nutOffset, objectPlaced, repeatability.stable, rider, selectedWeightIds, stage, trialSaved, tweezersHeld, weightHandlingObserved, weightsTotal]);

  const adjustNut = (delta: number) => {
    if (objectPlaced) return;
    const next = Math.max(-1.2, Math.min(1.2, Math.round((nutOffset + delta) * 10) / 10));
    setNutOffset(next);
    recordHarness("control.changed", { experiment: "measurement-balance", control: "平衡螺母", value: next, unit: "格" });
  };
  const changeRider = (value: number) => {
    setRider(value);
    recordHarness("control.changed", { experiment: "measurement-balance", control: "游码示数", value, unit: "g" });
  };
  const toggleObject = () => {
    if (!objectPlaced && !calibrated) return;
    setObjectPlaced((placed) => !placed);
    setSelectedWeightIds([]);
    setRider(0);
    setTrialSaved(false);
    setTweezersHeld(false);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "待测物", value: objectPlaced ? "取下" : "放入左盘" });
  };
  const toggleWeight = (id: TrayBalanceWeightId, mass: number) => {
    if (!objectPlaced || !tweezersHeld) return;
    const selected = selectedWeightIds.includes(id);
    if (!selected) {
      const selectedMasses = trayBalanceWeights.filter((weight) => selectedWeightIds.includes(weight.id)).map((weight) => weight.mass);
      if ((selectedMasses.length === 0 && mass < 50) || selectedMasses.some((selectedMass) => selectedMass < mass)) setWeightOrderWarning(true);
    }
    setWeightHandlingObserved(true);
    setSelectedWeightIds(selected ? selectedWeightIds.filter((weightId) => weightId !== id) : [...selectedWeightIds, id]);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: `${mass}g砝码`, value: selected ? "取下" : "放入右盘" });
  };
  const saveMeasurement = () => {
    if (!balanced || trialSaved) return;
    const value = Number((weightsTotal + rider).toFixed(1));
    setMeasurements((items) => [...items, value].slice(-2));
    setTrialSaved(true);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "保存独立称量", value, unit: "g" });
  };
  const startRepeat = () => {
    setObjectPlaced(false); setSelectedWeightIds([]); setRider(.4); setNutOffset(-.7); setTrialSaved(false); setTweezersHeld(false); setWeightOrderWarning(false);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "重复称量", value: "重新归零调平" });
  };
  const reset = () => {
    setRider(.6);
    setNutOffset(.8);
    setObjectPlaced(false);
    setSelectedWeightIds([]);
    setMeasurements([]);
    setTrialSaved(false);
    setTweezersHeld(false);
    setWeightOrderWarning(false);
    setWeightHandlingObserved(false);
    recordHarness("simulation.toggled", { experiment: "measurement-balance", running: false, action: "重新开始" });
  };

  return <div className="science-lab tray-balance-lab">
    {guideOpen && <BalanceUsageGuide onClose={() => { window.sessionStorage.setItem("physics-balance-guide-seen", "1"); setGuideOpen(false); }} />}
    <header data-tutorial-spotlight="module"><div><span>BALANCE LAB / 托盘天平实训台</span><h1>不显示答案，你能把这块金属的质量测出来吗？</h1><p>像真实实验一样完成归零、调平、放物、加砝码和移动游码；保存第一次结果后取下物体，重新独立操作一次，用重复读数检查测量是否可靠。</p></div><PhysicsFieldMotif field="measurement" className="science-lab-physics" /><div className="science-lab-header-actions"><button onClick={() => setGuideOpen(true)}><Info size={16} />使用教学</button><button onClick={reset}><RotateCcw size={16} />重新开始</button></div></header>
    <div className={`balance-lab-sim stage-${stage} ${balanced ? "is-balanced" : ""}`} style={{ "--balance-angle": `${beamTilt}deg`, "--left-pan-y": `${leftPanY}px`, "--right-pan-y": `${rightPanY}px`, "--pointer-shift": `${beamTilt * 4}px` } as React.CSSProperties}>
      <div className="balance-procedure-strip" aria-label="实验步骤">
        {["游码归零并调平", "左物右码", "先砝码后游码", "平衡读数"].map((label, index) => <span className={index < stage ? "done" : index === stage ? "active" : ""} key={label}><b>{index < stage ? "✓" : index + 1}</b>{label}</span>)}
      </div>
      <div className="tray-balance-workbench">
        <div className="tray-balance-apparatus" aria-label="可交互托盘天平装置">
          <div className="tray-balance-dial"><span>左偏</span><div>{Array.from({ length: 13 }, (_, index) => <i className={index === 6 ? "zero" : ""} key={index} />)}</div><span>右偏</span><b style={{ transform: `translateX(calc(-50% + ${beamTilt * 4}px)) rotate(${beamTilt * 2.2}deg)` }} /></div>
          <div className="tray-balance-column"><i /></div>
          <div className="tray-balance-beam" style={{ transform: `translateX(-50%) rotate(${beamTilt}deg)` }}><i className="beam-nut left" /><i className="beam-nut right" /><span className="beam-center" /></div>
          <div className="tray-pan left" style={{ transform: `translateY(${leftPanY}px)` }}><i className="pan-cable" /><span>{objectPlaced ? <b className="unknown-sample"><small>待测</small><strong>?</strong></b> : <em>左盘放物</em>}</span></div>
          <div className="tray-pan right" style={{ transform: `translateY(${rightPanY}px)` }}><i className="pan-cable" /><span>{selectedWeightIds.length ? selectedWeightIds.map((id, index) => { const weight = trayBalanceWeights.find((item) => item.id === id)!; return <b className="pan-weight" style={{ "--weight-index": index } as React.CSSProperties} key={id}>{weight.mass}</b>; }) : <em>右盘放砝码</em>}</span></div>
          <div className="tray-balance-base"><Scale size={23} /><span>托盘天平</span><small>最大称量 200 g · 分度值 0.1 g</small></div>
        </div>
        <aside className="balance-operation-dock">
          <section className={!calibrated ? "active" : "done"}><header><b>01</b><span><small>ZERO & LEVEL</small><strong>归零与调平</strong></span></header><p>空载时先移动游码到零刻度，再用左右按钮调节平衡螺母。</p><div className="balance-nut-controls"><button onClick={() => adjustNut(-.1)} disabled={objectPlaced}>← 向左调</button><output>{Math.abs(nutOffset) <= .05 ? "指针对中" : nutOffset > 0 ? `右偏 ${Math.abs(nutOffset).toFixed(1)} 格` : `左偏 ${Math.abs(nutOffset).toFixed(1)} 格`}</output><button onClick={() => adjustNut(.1)} disabled={objectPlaced}>向右调 →</button></div></section>
          <section className={stage === 1 ? "active" : objectPlaced ? "done" : ""}><header><b>02</b><span><small>LEFT OBJECT</small><strong>左盘放待测物</strong></span></header><p>调平完成后才能放物。称量过程中不要再碰平衡螺母。</p><button className="balance-object-button" onClick={toggleObject} disabled={!calibrated && !objectPlaced}>{objectPlaced ? "取下物体，重新称量" : calibrated ? "把金属块放入左盘" : "完成调平后解锁"}</button></section>
          <section className={stage === 2 ? "active" : balanced ? "done" : ""}><header><b>03</b><span><small>WEIGHT BOX</small><strong>镊子取码 · 先大后小</strong></span></header><p className={weightOrderWarning ? "balance-order-warning" : ""}>{weightOrderWarning ? "刚才先用了小砝码或又回到更大砝码。读数仍保留，但更规范的操作是从大到小逐级试放。" : "先拿起镊子，再从大砝码开始逐级试放；砝码不能直接用手拿。"}</p><button className={`balance-tweezers-button ${tweezersHeld ? "active" : ""}`} disabled={!objectPlaced} onClick={() => setTweezersHeld((value) => !value)}><Pipette size={18} aria-hidden="true" />{tweezersHeld ? "镊子已拿起 · 可以取放砝码" : "拿起砝码镊子"}</button><div className="balance-weight-buttons">{trayBalanceWeights.map((weight) => <button className={selectedWeightIds.includes(weight.id) ? "selected" : ""} onClick={() => toggleWeight(weight.id, weight.mass)} disabled={!objectPlaced || !tweezersHeld} aria-pressed={selectedWeightIds.includes(weight.id)} key={weight.id}><i /><strong>{weight.mass}</strong><small>g</small></button>)}</div></section>
        </aside>
      </div>
      <div className="balance-rider-console">
        <div className="balance-rider-heading"><span><small>POISE SCALE / 游码标尺</small><strong>{rider.toFixed(1)} g</strong></span><p>{!calibrated ? "调平前必须归零" : objectPlaced ? "砝码接近后，用游码完成最后微调" : "空载调平阶段"}</p></div>
        <div className="balance-rider-scale"><div>{Array.from({ length: 51 }, (_, index) => <i className={index % 10 === 0 ? "major" : index % 5 === 0 ? "middle" : ""} key={index} />)}</div><span className="rider-labels"><b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5 g</b></span><input aria-label="移动游码" type="range" min="0" max="5" step="0.1" value={rider} onChange={(event) => changeRider(Number(event.target.value))} /></div>
      </div>
      <div className={`balance-live-guidance ${balanced ? "success" : ""}`}><Gauge size={21} /><span><small>{balanced ? "MEASUREMENT COMPLETE / 测量完成" : `CURRENT STEP / 当前步骤 ${stage + 1}`}</small><strong>{guidance}</strong></span></div>
    </div>
    <div className="science-controls balance-results"><ResultCell label="右盘砝码总质量" value={objectPlaced ? `${weightsTotal.toFixed(0)} g` : "等待放置物体"} pending={!objectPlaced} /><ResultCell label="游码示数" value={objectPlaced ? `${rider.toFixed(1)} g` : calibrated ? "等待称量" : "先归零调平"} pending={!objectPlaced} /><ResultCell label="待测物质量" value={balanced ? `${(weightsTotal + rider).toFixed(1)} g` : "平衡后解锁"} pending={!balanced} /></div>
    <section className="balance-repeatability"><header><span><ClipboardList size={16} /><b>重复称量检查</b></span><div><button disabled={!balanced || trialSaved} onClick={saveMeasurement}><Save size={14} />保存本次读数</button><button disabled={!trialSaved || measurements.length >= 2} onClick={startRepeat}><RotateCcw size={14} />重新独立称量</button></div></header><div>{[0,1].map((index) => <article className={measurements[index] !== undefined ? "done" : ""} key={index}><small>第 {index + 1} 次</small><strong>{measurements[index] !== undefined ? `${measurements[index]!.toFixed(1)} g` : "等待测量"}</strong></article>)}</div></section>
    {measurements.length > 0 && <EvidenceVerdict valid={repeatability.stable} title={repeatability.stable ? "两次独立称量结果一致" : "第一次读数已保存，还需要重新操作一次"} detail={repeatability.stable ? `平均测得质量为 ${repeatability.meanValue?.toFixed(1)} g，两次读数的最大相对偏差为 ${((repeatability.maxRelativeDeviation ?? 0) * 100).toFixed(2)}%。` : "取下物体后，游码重新归零、再次调平，再放物称量；不要直接重复点击保存。"} />}
  </div>;
}
