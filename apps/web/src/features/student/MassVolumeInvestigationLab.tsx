import { useEffect, useMemo, useState } from "react";
import { analyzeInvariantEvidence, analyzeMeasurementError, analyzeProportionalEvidence, calculateBalanceReading, calculateMassVolumeSample } from "@physics-lab/physics";
import { Activity, RotateCcw, Save, Scale } from "lucide-react";
import { publishApparatusSnapshot } from "../harness/tutorialBridge";
import { useHarnessStore } from "../harness/harnessStore";
import { EvidenceVerdict, FactorEvidenceStatus, InteractionCue, LabFrame, ResultCell } from "./ScienceLabPrimitives";

const materials = {
  aluminum: { label: "铝", density: 2.7, color: "#aeb9bb" },
  wood: { label: "硬木", density: .8, color: "#9b7447" },
  plastic: { label: "塑料", density: 1.2, color: "#8f78c9" }
} as const;

type MaterialKey = keyof typeof materials;
type Prediction = "double" | "same" | "half";

interface MassVolumeReading {
  id: number;
  material: MaterialKey;
  volume: number;
  firstMass: number;
  secondMass: number;
  mass: number;
  ratio: number;
}

export function MassVolumeInvestigationLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [materialKey, setMaterialKey] = useState<MaterialKey>("aluminum");
  const [volume, setVolume] = useState(20);
  const [prediction, setPrediction] = useState<Prediction>();
  const [firstZeroed, setFirstZeroed] = useState(false);
  const [sampleReady, setSampleReady] = useState(false);
  const [firstReading, setFirstReading] = useState<number>();
  const [sampleRemoved, setSampleRemoved] = useState(false);
  const [repeatZeroed, setRepeatZeroed] = useState(false);
  const [secondReading, setSecondReading] = useState<number>();
  const [zeroErrorObserved, setZeroErrorObserved] = useState(false);
  const [showZeroError, setShowZeroError] = useState(false);
  const [readings, setReadings] = useState<MassVolumeReading[]>([]);

  const material = materials[materialKey];
  const ideal = calculateMassVolumeSample(material.density, volume);
  const firstInstrumentReading = calculateBalanceReading(ideal.massGrams, .04, .1).readingGrams;
  const secondInstrumentReading = calculateBalanceReading(ideal.massGrams, .06, .1).readingGrams;
  const offsetInstrumentReading = calculateBalanceReading(ideal.massGrams, .46, .1).readingGrams;
  const repeatedValues = [firstReading, secondReading].filter((value): value is number => value !== undefined);
  const repeatability = analyzeInvariantEvidence(repeatedValues, .02, 2);
  const repeatReady = repeatability.stable && firstReading !== undefined && secondReading !== undefined;
  const averageMass = repeatReady ? (firstReading + secondReading) / 2 : undefined;
  const currentReadings = useMemo(() => readings.filter((row) => row.material === materialKey), [materialKey, readings]);
  const proportionalEvidence = analyzeProportionalEvidence(currentReadings.map((row) => ({ x: row.volume, y: row.mass })));
  const zeroErrorRestored = zeroErrorObserved && !showZeroError;
  const learningReady = proportionalEvidence.proportional && zeroErrorRestored;
  const savedAtCurrentVolume = currentReadings.some((row) => row.volume === volume);
  const offsetRatio = offsetInstrumentReading / volume;
  const offsetError = analyzeMeasurementError(offsetRatio, material.density, .01);
  const stage = !firstZeroed ? 0 : !sampleReady ? 1 : firstReading === undefined ? 2 : !sampleRemoved ? 3 : !repeatZeroed ? 4 : secondReading === undefined ? 5 : 6;
  const graphMaximumMass = material.density * 100 * 1.08;
  const pointCoordinates = [...currentReadings]
    .sort((a, b) => a.volume - b.volume)
    .map((row) => `${35 + row.volume / 100 * 240},${150 - row.mass / graphMaximumMass * 125}`)
    .join(" ");
  const anomalyX = 35 + volume / 100 * 240;
  const anomalyY = 150 - offsetInstrumentReading / graphMaximumMass * 125;

  const resetTrial = () => {
    setFirstZeroed(false);
    setSampleReady(false);
    setFirstReading(undefined);
    setSampleRemoved(false);
    setRepeatZeroed(false);
    setSecondReading(undefined);
    setShowZeroError(false);
  };

  const runNextStep = () => {
    if (!firstZeroed) setFirstZeroed(true);
    else if (!sampleReady) setSampleReady(true);
    else if (firstReading === undefined) setFirstReading(firstInstrumentReading);
    else if (!sampleRemoved) setSampleRemoved(true);
    else if (!repeatZeroed) setRepeatZeroed(true);
    else if (secondReading === undefined) setSecondReading(secondInstrumentReading);
  };

  const savePoint = () => {
    if (!repeatReady || averageMass === undefined || showZeroError) return;
    const row: MassVolumeReading = {
      id: Date.now(),
      material: materialKey,
      volume,
      firstMass: firstReading,
      secondMass: secondReading,
      mass: averageMass,
      ratio: averageMass / volume
    };
    setReadings((items) => [...items.filter((item) => item.material !== materialKey || item.volume !== volume), row].slice(-15));
    recordHarness("configuration.changed", { experiment: "measurement-mass-volume", control: "保存复称描点", value: `${material.label}/${volume}cm³/${averageMass.toFixed(2)}g` });
  };

  const observeZeroError = () => {
    if (!repeatReady) return;
    setZeroErrorObserved(true);
    setShowZeroError(true);
    recordHarness("configuration.changed", { experiment: "measurement-mass-volume", control: "未清零异常点诊断", value: `${offsetInstrumentReading.toFixed(1)}g/${offsetRatio.toFixed(3)}g/cm³` });
  };

  useEffect(() => {
    const issues = learningReady ? [] : !firstZeroed ? ["先检查空盘示数并将电子天平清零。"] : !sampleReady ? ["按当前体积切取同种材料样品。"] : firstReading === undefined ? ["把样品放上秤盘，等示数稳定后记录第一次质量。"] : !sampleRemoved ? ["取下样品，让秤盘重新回到空载状态。"] : !repeatZeroed ? ["第二次称量前重新检查零点。"] : secondReading === undefined ? ["重新放上同一样品，完成第二次独立称量。"] : !repeatReady ? ["两次示数差异过大，应检查零点并重测。"] : !zeroErrorObserved ? ["完成一次未清零异常点诊断，观察纵轴截距为何不再接近零。"] : showZeroError ? ["异常方向已观察；恢复规范零点后再保存正式数据。"] : !proportionalEvidence.enoughPoints ? ["至少测量同种材料的三个不同体积。"] : ["检查各点m/V是否稳定，并排除异常点。"];
    publishApparatusSnapshot({
      module: "measurement-mass-volume",
      capturedAt: new Date().toISOString(),
      origin: firstZeroed || sampleReady || readings.length ? "learner" : "system",
      controls: [
        { id: "material", label: "当前同种材料", value: material.label, source: "control" },
        { id: "volume", label: "样品体积", value: volume, unit: "cm³", source: "control" },
        { id: "prediction", label: "体积加倍预测", value: prediction === "double" ? "质量加倍" : prediction === "same" ? "质量不变" : prediction === "half" ? "质量减半" : "未选择", source: "control" }
      ],
      apparatus: [
        { id: "first-zero", label: "第一次称量已清零", value: firstZeroed, source: "apparatus" },
        { id: "sample", label: "当前样品已制备", value: sampleReady, source: "apparatus" },
        { id: "sample-removed", label: "两次称量之间已取下样品", value: sampleRemoved, source: "apparatus" },
        { id: "repeat-zero", label: "复称前已重新清零", value: repeatZeroed, source: "apparatus" }
      ],
      readings: [
        { id: "first-mass", label: "第一次质量", value: firstReading ?? null, unit: "g", source: "reading" },
        { id: "second-mass", label: "第二次质量", value: secondReading ?? null, unit: "g", source: "reading" },
        { id: "average-mass", label: "两次平均质量", value: averageMass ?? null, unit: "g", source: "reading" },
        { id: "ratio", label: "质量体积比", value: averageMass === undefined ? null : averageMass / volume, unit: "g/cm³", source: "reading" }
      ],
      derived: [
        { id: "repeatability", label: "独立复称结果稳定", value: repeatReady, source: "model" },
        { id: "zero-error", label: "未清零异常点已诊断", value: zeroErrorObserved, source: "model" },
        { id: "zero-restored", label: "异常诊断后已恢复规范零点", value: zeroErrorRestored, source: "model" },
        { id: "proportional", label: "当前材料m与V正比证据", value: proportionalEvidence.proportional, source: "model" },
        { id: "dataset-boundary", label: "图线数据边界", value: `仅包含${material.label}样品`, source: "model" }
      ],
      validity: { ready: learningReady, issues }
    });
  }, [averageMass, firstReading, firstZeroed, learningReady, material.label, prediction, proportionalEvidence.enoughPoints, proportionalEvidence.proportional, readings.length, repeatReady, repeatZeroed, sampleReady, sampleRemoved, secondReading, showZeroError, volume, zeroErrorObserved, zeroErrorRestored]);

  return <LabFrame
    field="measurement"
    experiment="measurement-mass-volume"
    eyebrow="MASS–VOLUME METROLOGY LINE / 质量—体积计量线"
    title="同一块材料切成不同体积，每个描点都要经得起复称"
    description="固定材料，只改变样品体积。每个正式点先清零称量，再取下样品、重新清零并独立复称，最终用平均质量描点；未清零诊断只显示异常点，不污染正式数据。"
    running={false}
    onToggle={runNextStep}
    playLabel={["第一次清零", "切取当前样品", "第一次称量", "取下样品", "复称前清零", "第二次称量", "本组复称完成"][stage]}
    actionDisabled={stage === 6}
    disabledLabel="保存描点或更换体积"
  >
    <div className="mv-inquiry-console">
      <section><b>PREDICTION / 预测</b><span>同种物质体积加倍，质量会怎样？</span><div>{(["double", "same", "half"] as Prediction[]).map((value) => <button className={prediction === value ? "active" : ""} onClick={() => setPrediction(value)} key={value}>{value === "double" ? "加倍" : value === "same" ? "不变" : "减半"}</button>)}</div></section>
      <section><b>DATASET BOUNDARY / 数据边界</b><strong>当前图线只接收：{material.label}</strong><span>切换材料会切换数据集，不会把不同物质混成一条直线。</span></section>
    </div>

    <FactorEvidenceStatus className="mv-procedure-strip" items={[
      { label: "清零", done: firstZeroed },
      { label: "制样", done: sampleReady },
      { label: "初测", done: firstReading !== undefined },
      { label: "取下", done: sampleRemoved },
      { label: "再清零", done: repeatZeroed },
      { label: "复称", done: secondReading !== undefined }
    ]}/>

    <div className={`mv-lab-rig ${showZeroError ? "show-zero-error" : ""}`}>
      <div className="mv-sample-cutter"><span>SPECIMEN CUTTER / 定体积制样器</span><div style={{ width: `${65 + volume * .9}px`, height: `${55 + volume * .45}px`, background: material.color }}/><b>{sampleReady ? `${material.label} · ${volume} cm³ 样品已制备` : "等待切取当前体积样品"}</b></div>
      <div className="mv-digital-balance"><Scale size={24}/><small>DIGITAL BALANCE · 0.1 g</small><strong>{showZeroError ? offsetInstrumentReading.toFixed(1) : secondReading?.toFixed(1) ?? firstReading?.toFixed(1) ?? "— —"} g</strong><em>{showZeroError ? "ZERO OFFSET +0.5 g" : repeatZeroed || firstZeroed ? "ZERO CHECKED" : "ZERO REQUIRED"}</em></div>
      <svg viewBox="0 0 300 180" role="img" aria-label={`${material.label}质量体积图像，正式点${currentReadings.length}个`}>
        <line x1="35" y1="150" x2="285" y2="150"/><line x1="35" y1="15" x2="35" y2="150"/>
        {currentReadings.length > 1 && <polyline points={pointCoordinates}/>}
        {currentReadings.map((row) => <circle cx={35 + row.volume / 100 * 240} cy={150 - row.mass / graphMaximumMass * 125} r="6" key={row.id}/>)}
        {showZeroError && <circle className="mv-anomaly-point" cx={anomalyX} cy={anomalyY} r="8"/>}
        <text x="250" y="170">V/cm³</text><text x="4" y="20">m/g</text><text x="43" y="32">当前数据集：{material.label}</text>
      </svg>
      <div className="mv-live-result"><small>REPEATABILITY / 复称一致性</small><strong>{repeatReady && averageMass !== undefined ? `${firstReading.toFixed(1)} g 与 ${secondReading.toFixed(1)} g → 平均 ${averageMass.toFixed(2)} g` : firstReading !== undefined ? `第一次 ${firstReading.toFixed(1)} g · 等待独立复称` : "完成两次独立称量后才可描点"}</strong><em>{repeatReady ? `两次相差 ${Math.abs(firstReading - secondReading).toFixed(1)} g，在仪器允许范围内` : "分度值 0.1 g；复称前必须再次检查零点"}</em></div>
      {!firstZeroed && <InteractionCue text="从检查空载示数并按下清零开始"/>}
    </div>

    <div className="mv-controls">
      <section><b>同种材料数据集</b><div>{(Object.keys(materials) as MaterialKey[]).map((key) => <button className={materialKey === key ? "active" : ""} onClick={() => { if (key === materialKey) return; setMaterialKey(key); resetTrial(); }} key={key}>{materials[key].label}<small>{readings.filter((row) => row.material === key).length}点</small></button>)}</div></section>
      <section><b>样品体积 V / cm³</b><div>{[10, 20, 40, 60, 80].map((value) => <button className={volume === value ? "active" : ""} onClick={() => { setVolume(value); resetTrial(); }} key={value}>{value}</button>)}</div></section>
      <section><b>当前操作</b><div><button className={firstZeroed ? "done" : ""} disabled={firstZeroed} onClick={() => setFirstZeroed(true)}>第一次清零</button><button disabled={!firstZeroed || sampleReady} onClick={() => setSampleReady(true)}>切取样品</button><button disabled={!sampleReady || firstReading !== undefined} onClick={() => setFirstReading(firstInstrumentReading)}>第一次称量</button><button disabled={firstReading === undefined || sampleRemoved} onClick={() => setSampleRemoved(true)}>取下样品</button><button className={repeatZeroed ? "done" : ""} disabled={!sampleRemoved || repeatZeroed} onClick={() => setRepeatZeroed(true)}>再次清零</button><button disabled={!repeatZeroed || secondReading !== undefined} onClick={() => setSecondReading(secondInstrumentReading)}>独立复称</button></div></section>
      <aside><button disabled={!repeatReady || showZeroError} onClick={savePoint}><Save size={15}/>{showZeroError ? "先恢复规范零点" : savedAtCurrentVolume ? "更新正式描点" : "保存正式描点"}</button><button onClick={resetTrial}><RotateCcw size={14}/>重做当前体积</button></aside>
    </div>

    <section className={`mv-zero-error-lab ${zeroErrorObserved ? "complete" : ""}`}>
      <header><span><Activity size={17}/><b>ZERO-OFFSET DIAGNOSTIC / 零点偏移异常诊断</b></span><small>红色空心点不写入正式数据</small></header>
      <div className="mv-zero-error-body"><span><strong>故意不清零，空盘残留 +0.5 g</strong><em>所有质量读数整体偏大，m—V 图像将不再接近通过原点。</em></span><ResultCell label="错误质量示数" value={repeatReady ? `${offsetInstrumentReading.toFixed(1)} g` : "先完成规范复称"} pending={!repeatReady}/><ResultCell label="错误 m/V" value={repeatReady ? `${offsetRatio.toFixed(3)} g/cm³` : "等待诊断"} pending={!repeatReady}/><button className={zeroErrorObserved ? "done" : ""} disabled={!repeatReady} onClick={observeZeroError}>{zeroErrorObserved ? "重新显示异常点" : "制造未清零异常点"}</button><button disabled={!showZeroError} onClick={() => setShowZeroError(false)}>恢复规范零点</button></div>
      {zeroErrorObserved && <EvidenceVerdict valid={false} title="未清零会产生整体偏高的系统误差" detail={`当前异常点的m/V偏高 ${Math.abs(offsetError.percentError).toFixed(1)}%；它只用于诊断，正式图线仍只采用两次规范称量的平均值。`}/>}
    </section>

    <div className="mv-evidence-ledger">
      <b>V/cm³</b><b>初测/g</b><b>复称/g</b><b>平均m/g</b><b>m/V</b>
      {currentReadings.length ? currentReadings.map((row) => <div key={row.id}><span>{row.volume}</span><span>{row.firstMass.toFixed(1)}</span><span>{row.secondMass.toFixed(1)}</span><strong>{row.mass.toFixed(2)}</strong><strong>{row.ratio.toFixed(3)}</strong></div>) : <p>当前“{material.label}”数据集还没有正式点。完成两次独立称量后保存第一组。</p>}
    </div>
    {currentReadings.length >= 2 && <EvidenceVerdict valid={learningReady} title={learningReady ? `${material.label}的三点证据支持 m 与 V 成正比` : proportionalEvidence.proportional ? "正比图线已形成，还需完成零点偏移诊断" : `当前只有 ${proportionalEvidence.distinctXCount} 个不同体积点`} detail={proportionalEvidence.proportional ? `各组m/V最大相对偏差为 ${((proportionalEvidence.maxRelativeDeviation ?? 0) * 100).toFixed(2)}%，图线斜率约 ${proportionalEvidence.meanRatio?.toFixed(3)} g/cm³；${prediction === "double" ? "你的体积加倍预测与证据一致。" : "请依据图线修正或确认原预测。"}` : "至少测量三个不同体积，每个点都应使用两次规范称量的平均质量。"}/>}
  </LabFrame>;
}
