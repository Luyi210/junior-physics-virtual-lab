import { memo, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, ChevronDown, Download, Pause, Play, Plus, RotateCcw, Ruler, SkipForward, Square, Timer, Trash2 } from "lucide-react";
import { assessDoubleSlitScreen, calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement, HIGH_SCHOOL_EXPERIMENTS, MANUAL_SCREEN_RESOLUTION_MM, MANUAL_TIME_RESOLUTION_SECONDS, quantizeManualScreenPositionMm, quantizeManualTimeSeconds, simulateHighSchoolExperiment, type HighSchoolSimulation, type ManualMeasurementResult } from "@physics-lab/physics/high-school";
import { formatMeasurement } from "../experiments/workbench";
import { useManualMeasurements, type ManualMeasurementRecord } from "../experiments/useManualMeasurements";
import { beginVirtualTiming, isManualReadingRecorded, manualObservationConditionKey, manualReadingSignature, observeVirtualTiming, type VirtualTimingRun } from "./manualInstrumentState";
import { MeasurementRecoveryPanel } from "./MeasurementRecoveryPanel";
import "./ManualMeasurementPanel.css";

type ManualExperimentId = "pendulum" | "double-slit";
type SaveReading = (result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) => boolean;
interface InstrumentProps {
  parameters: Record<string, number>;
  timeSeconds: number;
  simulation: HighSchoolSimulation;
  onSave: SaveReading;
  limitReached: boolean;
  records: ManualMeasurementRecord[];
  recoveryRecords?: ManualMeasurementRecord[];
  recordWritable: boolean;
}
interface ManualMeasurementPanelProps extends Omit<InstrumentProps, "onSave" | "limitReached" | "records" | "recoveryRecords"> {
  experimentId: ManualExperimentId;
  scopeKey: string | null;
  canWrite: () => boolean;
  canRead: () => boolean;
  clockRunning: boolean;
  onClockToggle: () => void;
  onClockStep: () => void;
  resetToken: number;
  onRecordsChange?: (records: ManualMeasurementRecord[]) => void;
}

export function ManualMeasurementPanel({ experimentId, scopeKey, canWrite, canRead, onRecordsChange, ...props }: ManualMeasurementPanelProps) {
  const headingId = useId();
  const { records, recovery, storageError, excludedCount, actionError, save, clear, retryPending, recoverPending, exportCsv, exportRecoveryCsv, exportRecoveryBackup } = useManualMeasurements(experimentId, scopeKey, canWrite, canRead);
  const recoveryCount = recovery ? recovery.records.length + recovery.excludedCount : 0;
  const limitReached = records.length + recoveryCount >= 120;
  const [notice, setNotice] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { onRecordsChange?.(records); }, [records, onRecordsChange]);
  const onSave: SaveReading = (result, parameters, timeSeconds) => {
    try {
      const outcome = save(result, parameters, timeSeconds);
      setNotice(outcome.error ?? (outcome.pendingRecovery ? "这次读数暂存在待恢复区，请核对后显式恢复。当前档案和力力尚未使用这些读数。" : outcome.failed ? "本机保存遇到问题，请先导出当前手动记录，避免刷新后丢失。" : outcome.saved ? "这次手动读数和当时的实验条件已保存。" : "未新增记录，请检查读数或先导出现有记录。"));
      return outcome.saved;
    } catch (error) {
      setNotice(error instanceof Error ? `未能保存：${error.message}` : "未能保存这次手动读数，请检查记录内容。");
      return false;
    }
  };
  function retrySave() {
    const outcome = retryPending();
    setNotice(outcome.error ?? (outcome.failed ? "本机存储仍有异常，当前记录保留，请先导出 CSV。" : "已重新检查本机记录并重试保存，当前未检测到存储错误。"));
  }
  function recoverReadings(reviewToken: string) {
    const outcome = recoverPending(reviewToken);
    setNotice(outcome.error ? `${outcome.recoveredCount > 0 ? `本次已恢复 ${outcome.recoveredCount} 条。` : ""}${outcome.error}` : outcome.failed ? `本次已恢复 ${outcome.recoveredCount} 条，存储仍有异常。请重新核对待恢复区并导出备份。` : `本次已恢复 ${outcome.recoveredCount} 条手动读数；原始读数与实验条件保持不变。`);
  }
  return <section className="hs-manual-panel" aria-labelledby={headingId}>
    <header className="hs-manual-heading"><div><span className="hs-kicker">虚拟仪器 / 手动读数</span><h2 id={headingId}>{experimentId === "pendulum" ? "自己计时，读出一次往返。" : "自己读尺，量出条纹间距。"}</h2><p>{experimentId === "pendulum" ? "选择计时起止点，数完整周期，再用自己的读数求周期。" : "在虚拟屏上定位两条亮纹，数清中间的间隔，再估计波长。"}这些是虚拟仪器手动读数，独立保存，不属于真实器材实测。</p></div>{experimentId === "pendulum" ? <Timer size={31} strokeWidth={1.3} aria-hidden="true" /> : <Ruler size={31} strokeWidth={1.3} aria-hidden="true" />}</header>
    {experimentId === "pendulum" ? <PendulumManualInstrument {...props} onSave={onSave} limitReached={limitReached} records={records} recoveryRecords={recovery?.records} /> : <DoubleSlitManualInstrument {...props} onSave={onSave} limitReached={limitReached} records={records} recoveryRecords={recovery?.records} />}
    <div className="hs-manual-records"><header><div><h3>手动读数档案<span>{records.length} / 120</span></h3><p>起止读数、计数和实验条件一并保留，与自动模型采样分开。</p></div><div className="hs-record-actions"><button type="button" className="hs-button" onClick={exportCsv} disabled={!records.length}><Download size={15} aria-hidden="true" />导出手动读数 CSV</button><button type="button" className="hs-icon-button" onClick={() => setConfirmClear(true)} disabled={!props.recordWritable || !records.length} aria-label="清空本实验手动读数"><Trash2 size={17} /></button></div></header>
      {notice && <p className="hs-manual-notice" role="status">{notice}</p>}
      {recoveryCount > 0 && <p className="hs-manual-notice">另有 {recoveryCount} 条待恢复读数独立保留，并计入 120 条新增上限；尚未加入当前档案。</p>}
      {actionError && <p className="hs-manual-storage-error" role="alert">{actionError}</p>}
      {storageError && <div className="hs-manual-storage-error" role="alert"><p>本机手动记录读取或保存异常。请先导出 CSV 保留副本；存储恢复后可重试，无需新增读数。</p><button type="button" className="hs-button" disabled={!props.recordWritable} onClick={retrySave}><RotateCcw size={14} aria-hidden="true" />重试本机保存</button></div>}
      {excludedCount > 0 && <p className="hs-manual-storage-error">有 {excludedCount} 条无法读取的手动记录，未列入当前档案。</p>}
      {confirmClear && props.recordWritable && <div className="hs-clear-confirm"><span>清空当前档案中的 {records.length} 条手动读数？自动模型记录和待恢复区保留。</span><button type="button" onClick={() => { const cleared = clear(); setNotice(cleared ? "当前档案中的手动读数已清空。" : "清空失败，现有手动读数已保留。"); setConfirmClear(false); }}>确认清空</button><button type="button" onClick={() => setConfirmClear(false)}>保留记录</button></div>}
      <ManualMeasurementHistory records={records} experimentId={experimentId} />
    </div>
    {recovery && <MeasurementRecoveryPanel records={recovery.records} definition={HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === experimentId)!} reviewToken={recovery.reviewToken} writable={props.recordWritable} onExport={exportRecoveryCsv} onRecover={recoverReadings} kind="manual" excludedCount={recovery.excludedCount} onExportBackup={exportRecoveryBackup} />}
  </section>;
}

function useManualObservation(records: ManualMeasurementRecord[], onSave: SaveReading, recoveryRecords: ManualMeasurementRecord[] = []) {
  const [savedInObservation, setSavedInObservation] = useState<ReadonlySet<string>>(() => new Set());
  return {
    restart: () => setSavedInObservation(new Set()),
    isRecorded: (result: ManualMeasurementResult, parameters: Record<string, number>) => isManualReadingRecorded(savedInObservation, records, result, parameters),
    isPendingRecovery: (result: ManualMeasurementResult, parameters: Record<string, number>) => isManualReadingRecorded(savedInObservation, recoveryRecords, result, parameters),
    save: (result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) => {
      if (!onSave(result, parameters, timeSeconds)) return false;
      const signature = manualReadingSignature(result, parameters);
      setSavedInObservation((previous) => new Set([...previous, signature]));
      return true;
    }
  };
}

function PendulumManualInstrument({ parameters, timeSeconds, simulation, clockRunning, onClockToggle, onClockStep, resetToken, onSave, limitReached, records, recoveryRecords, recordWritable }: InstrumentProps & Pick<ManualMeasurementPanelProps, "clockRunning" | "onClockToggle" | "onClockStep" | "resetToken">) {
  const countId = useId();
  const observation = useManualObservation(records, onSave, recoveryRecords);
  const run = useRef<VirtualTimingRun | null>(null);
  const [timing, setTiming] = useState(false);
  const [capture, setCapture] = useState<(VirtualTimingRun & { endTimeSeconds: number }) | null>(null);
  const [periodCount, setPeriodCount] = useState("");
  const [timingNotice, setTimingNotice] = useState("");
  const parameterKey = JSON.stringify(parameters);
  const observedResetToken = useRef(resetToken);
  useEffect(() => {
    if (observedResetToken.current !== resetToken) {
      observedResetToken.current = resetToken;
      run.current = null;
      setTiming(false); setCapture(null); setPeriodCount("");
      setTimingNotice("物理时间已重新定位，请重新选择计时起止时刻。");
      return;
    }
    if (!run.current) return;
    const observed = observeVirtualTiming(run.current, timeSeconds, parameters, resetToken);
    run.current = observed.run;
    if (!observed.run) { setTiming(false); setCapture(null); setPeriodCount(""); setTimingNotice(observed.reason); }
  }, [parameterKey, timeSeconds, resetToken]);

  function startTiming() {
    run.current = beginVirtualTiming(timeSeconds, parameters, resetToken);
    observation.restart();
    setCapture(null); setPeriodCount(""); setTiming(true); setTimingNotice("");
  }
  function stopTiming() {
    if (!run.current) return;
    const observed = observeVirtualTiming(run.current, timeSeconds, parameters, resetToken);
    run.current = null; setTiming(false);
    if (!observed.run) { setCapture(null); setPeriodCount(""); setTimingNotice(observed.reason); return; }
    setCapture({ ...observed.run, endTimeSeconds: timeSeconds });
    setTimingNotice("起止读数已锁定。请按实际观察填写完整周期数；停止计时不会暂停摆动。");
  }
  const calculation = useMemo(() => {
    if (!capture || !periodCount.trim()) return { result: null, error: "" };
    try { return { result: calculatePendulumTimingMeasurement({ startTimeSeconds: capture.startTimeSeconds, endTimeSeconds: capture.endTimeSeconds, periodCount: Number(periodCount), length: capture.parameters.length, amplitudeDegrees: capture.parameters.amplitudeDegrees }), error: "" }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "请检查起止时刻和完整周期数。" }; }
  }, [capture, periodCount]);
  const comparison = useMemo(() => capture ? simulateHighSchoolExperiment("pendulum", capture.parameters, 0).metrics.find((metric) => metric.key === "period") : undefined, [capture]);
  const activeStart = run.current?.startTimeSeconds ?? capture?.startTimeSeconds;
  const bobX = 135 + simulation.state.x / parameters.length * 110;
  const bobY = 28 - simulation.state.y / parameters.length * 110;
  const atEnd = timeSeconds >= simulation.durationSeconds;

  return <div className="hs-manual-instrument"><div className="hs-manual-observation">
    <div className="hs-manual-timing-stage"><svg viewBox="0 0 270 202" role="img" aria-label="当前摆球位置，虚线标记平衡位置。以同一位置、同一运动方向作为计时起止标准。"><path d="M84 20H186M135 28V159" stroke="#8d9b7b" strokeDasharray="4 5" /><path d={`M135 28L${bobX} ${bobY}`} stroke="#526d49" strokeWidth="2" /><circle cx="135" cy="28" r="4" fill="#526d49" /><circle cx={bobX} cy={bobY} r="12" fill="#b66c40" stroke="#7d4b2e" strokeWidth="1.5" /><path d="M124 160H146" stroke="#a46f42" /><text x="135" y="187" textAnchor="middle">平衡位置 · 起止须同向经过</text></svg><div className="hs-manual-timer"><span>当前虚拟时钟</span><strong>{quantizeManualTimeSeconds(timeSeconds).toFixed(2)}<small>s</small></strong><div><span>开始读数</span><b>{activeStart === undefined ? "—" : `${quantizeManualTimeSeconds(activeStart).toFixed(2)} s`}</b></div><div><span>停止读数</span><b>{capture ? `${quantizeManualTimeSeconds(capture.endTimeSeconds).toFixed(2)} s` : "—"}</b></div><p>{timing ? "正在等待你选择停止时机" : capture ? "本次起止读数已锁定" : "先观察，再选择计时起点"}</p></div></div>
    <div className="hs-manual-motion-controls"><span>观察摆动</span><button type="button" onClick={onClockToggle}>{clockRunning ? <Pause size={14} /> : <Play size={14} />}{clockRunning ? "暂停摆动" : atEnd ? "重新播放" : "播放摆动"}</button><button type="button" onClick={onClockStep} disabled={atEnd}><SkipForward size={14} />单步定位</button></div>
    <div className="hs-manual-timer-controls"><button type="button" className="hs-button hs-primary" onClick={startTiming} disabled={timing || atEnd}><Timer size={16} />{capture ? "重新开始计时" : "开始计时"}</button><button type="button" className="hs-button" onClick={stopTiming} disabled={!timing}><Square size={13} />停止计时</button></div>
    <p className="hs-manual-resolution">秒表显示间隔 {MANUAL_TIME_RESOLUTION_SECONDS} s；仿真时间按 1/60 s 推进。暂停时不累计时间，显示位数不代表测量精度。</p>
    {timingNotice && <p className="hs-manual-instrument-notice" role="status">{timingNotice}</p>}
    {timing && atEnd && <p className="hs-manual-instrument-notice" role="status">观察窗口已结束。系统没有判断完整周期数；若未在预定的同向位置结束，请重新播放并重新计时。</p>}
  </div><div className="hs-manual-entry"><span className="hs-manual-step">读数 → 计数 → 计算</span><h3>一次完整往返，才是一个周期。</h3><p>建议在平衡位置开始，起点记 0；再次同向经过时记 1。连续观察 5–10 个完整往返后，点击“停止计时”。</p><label className="hs-manual-field" htmlFor={countId}><span>实际数到的完整周期数 N</span><input id={countId} type="number" min="1" max="100" step="1" inputMode="numeric" value={periodCount} onChange={(event) => setPeriodCount(event.target.value)} placeholder="由你计数后填写" /><small>不是经过中点的总次数；当前观察窗为 {formatMeasurement(simulation.durationSeconds)} s。</small></label>
    {capture && <p className="hs-manual-captured-conditions">本次计时条件：摆长 {formatMeasurement(capture.parameters.length)} m，释放摆角 {formatMeasurement(capture.parameters.amplitudeDegrees)}°。结果始终使用这次计时的条件。</p>}
    {calculation.error && <p className="hs-manual-validation" role="alert">{calculation.error}</p>}
    {calculation.result && capture ? <ManualResult result={calculation.result} limitReached={limitReached} readOnly={!recordWritable} recorded={observation.isRecorded(calculation.result, capture.parameters)} pendingRecovery={observation.isPendingRecovery(calculation.result, capture.parameters)} onSave={() => observation.save(calculation.result!, capture.parameters, capture.endTimeSeconds)} comparison={comparison ? `同条件非线性模型周期：${formatMeasurement(comparison.value, 4)} ${comparison.unit}。仅作对照，不会回填手动起止读数。` : ""} /> : <p className="hs-manual-result-placeholder">完成起止计时并填写完整周期数后，这里显示按手动读数计算的周期。</p>}
  </div></div>;
}

function DoubleSlitManualInstrument({ parameters, timeSeconds, simulation, onSave, limitReached, records, recoveryRecords, recordWritable }: InstrumentProps) {
  const id = useId();
  const observation = useManualObservation(records, onSave, recoveryRecords);
  const [positions, setPositions] = useState({ left: "", right: "" });
  const [intervalCount, setIntervalCount] = useState("");
  const [activeMarker, setActiveMarker] = useState<"left" | "right">("left");
  const [notice, setNotice] = useState("");
  const parametersKey = manualObservationConditionKey("double-slit-positions", parameters);
  const previousParameters = useRef(parametersKey);
  const positionsAreCurrent = previousParameters.current === parametersKey;
  useEffect(() => {
    if (previousParameters.current !== parametersKey) { previousParameters.current = parametersKey; observation.restart(); setPositions({ left: "", right: "" }); setIntervalCount(""); setNotice("双缝条件已改变，请在新屏幕上重新定位。已保存的手动记录保留。"); }
  }, [parametersKey]);
  const intensity = simulation.series.find((series) => series.key === "intensity");
  const screenCapability = useMemo(() => assessDoubleSlitScreen({ wavelengthNm: parameters.wavelengthNm, slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance }), [parameters.wavelengthNm, parameters.slitSeparationMm, parameters.screenDistance]);
  const calculation = useMemo(() => {
    if (!screenCapability.canMeasureFringeSpacing || !positionsAreCurrent || !positions.left.trim() || !positions.right.trim() || !intervalCount.trim()) return { result: null, error: "" };
    try { return { result: calculateDoubleSlitPositionMeasurement({ leftPositionMm: Number(positions.left), rightPositionMm: Number(positions.right), intervalCount: Number(intervalCount), slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance }), error: "" }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "请检查亮纹位置和间隔数。" }; }
  }, [screenCapability.canMeasureFringeSpacing, positionsAreCurrent, positions, intervalCount, parameters.slitSeparationMm, parameters.screenDistance]);
  const positionNumber = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= -20 && Number(value) <= 20 ? quantizeManualScreenPositionMm(Number(value)) : null;
  const left = positionsAreCurrent ? positionNumber(positions.left) : null;
  const right = positionsAreCurrent ? positionNumber(positions.right) : null;
  const setPosition = (marker: "left" | "right", value: number) => { const next = String(quantizeManualScreenPositionMm(value)); setPositions((current) => current[marker] === next ? current : { ...current, [marker]: next }); setNotice(""); };
  function restartReading() { observation.restart(); setPositions({ left: "", right: "" }); setIntervalCount(""); setActiveMarker("left"); setNotice("已开始下一次读尺。请重新定位和计数；即使读数相同，这次观察也可独立记录，历史档案保留。"); }
  return <div className="hs-manual-instrument"><div className="hs-manual-observation">
    <div className="hs-manual-screen-toolbar"><div role="group" aria-label="选择要定位的亮纹标记"><button type="button" aria-pressed={activeMarker === "left"} onClick={() => setActiveMarker("left")}>定位 A · 左亮纹</button><button type="button" aria-pressed={activeMarker === "right"} onClick={() => setActiveMarker("right")}>定位 B · 右亮纹</button></div><span>点击或拖动屏幕，移动所选标记</span></div>
    <ManualDoubleSlitScreen points={intensity?.points ?? []} left={left} right={right} activeMarker={activeMarker} onPosition={setPosition} />
    {!screenCapability.canMeasureFringeSpacing && <p className="hs-manual-instrument-notice" role="status">当前可见屏区不足两条亮纹，暂不能完成这项读尺。请减小屏距 L 或增大缝间距 d，再重新定位。</p>}
    <p className="hs-manual-resolution">位置显示间隔 {MANUAL_SCREEN_RESOLUTION_MM} mm。也可用下方滑块方向键逐格移动；屏幕不会自动吸附到理论亮纹。</p>
    <button type="button" className="hs-button hs-manual-restart" onClick={restartReading}><RotateCcw size={14} aria-hidden="true" />开始下一次读尺</button>
    <div className="hs-manual-position-controls">{(["left", "right"] as const).map((marker, index) => <div key={marker}><label htmlFor={`${id}-${marker}-range`}>{index === 0 ? "A · 左亮纹坐标" : "B · 右亮纹坐标"}<b>{positions[marker].trim() ? `${positions[marker]} mm` : "尚未定位"}</b></label><input id={`${id}-${marker}-range`} type="range" min="-20" max="20" step={MANUAL_SCREEN_RESOLUTION_MM} value={marker === "left" ? left ?? -5 : right ?? 5} aria-valuetext={positions[marker].trim() ? `${positions[marker]} 毫米` : "尚未定位，移动滑块选择位置"} onChange={(event) => { setActiveMarker(marker); setPosition(marker, Number(event.target.value)); }} /><input type="number" aria-label={`${index === 0 ? "左" : "右"}亮纹坐标，毫米`} min="-20" max="20" step={MANUAL_SCREEN_RESOLUTION_MM} value={positions[marker]} placeholder="读数 / mm" onChange={(event) => { setActiveMarker(marker); setPositions((current) => ({ ...current, [marker]: event.target.value })); setNotice(""); }} onBlur={() => { const value = positionNumber(positions[marker]); if (value !== null) setPosition(marker, value); }} /></div>)}</div>
    {notice && <p className="hs-manual-instrument-notice" role="status">{notice}</p>}
  </div><div className="hs-manual-entry"><span className="hs-manual-step">定位 → 数间隔 → 估计</span><h3>数间隔，不是数亮纹条数。</h3><p>选择靠近屏幕中心的两条亮纹，尽量定位在亮纹中心。从第 1 条到第 6 条亮纹，共有 5 个相邻间隔。</p><dl className="hs-manual-given"><div><dt>缝间距 d</dt><dd>{formatMeasurement(parameters.slitSeparationMm)} mm</dd></div><div><dt>屏距 L</dt><dd>{formatMeasurement(parameters.screenDistance)} m</dd></div></dl><label className="hs-manual-field" htmlFor={`${id}-intervals`}><span>A、B 之间的相邻亮纹间隔数 N</span><input id={`${id}-intervals`} type="number" min="1" max="100" step="1" inputMode="numeric" value={intervalCount} onChange={(event) => setIntervalCount(event.target.value)} placeholder="由你观察后填写" /><small>两端都算在内的亮纹条数减 1；系统不自动识别亮纹。</small></label>
    {calculation.error && <p className="hs-manual-validation" role="alert">{calculation.error}</p>}
    {calculation.result ? <ManualResult result={calculation.result} limitReached={limitReached} readOnly={!recordWritable} recorded={observation.isRecorded(calculation.result, parameters)} pendingRecovery={observation.isPendingRecovery(calculation.result, parameters)} onSave={() => observation.save(calculation.result!, parameters, timeSeconds)} comparison={`本组已设定的模型波长：${formatMeasurement(parameters.wavelengthNm)} nm。计算只用手动坐标、间隔数、缝间距和屏距，该值不会回填读数。`} /> : <p className="hs-manual-result-placeholder">{screenCapability.canMeasureFringeSpacing ? "定位两条亮纹并填写间隔数后，这里显示平均条纹间距和近轴估计波长。" : "先调整实验条件，让可见屏区中出现至少两条亮纹，再继续读尺。"}</p>}
  </div></div>;
}

const ManualDoubleSlitScreen = memo(function ManualDoubleSlitScreen({ points, left, right, activeMarker, onPosition }: { points: HighSchoolSimulation["series"][number]["points"]; left: number | null; right: number | null; activeMarker: "left" | "right"; onPosition: (marker: "left" | "right", position: number) => void }) {
  const screenId = useId();
  const drag = useRef<{ pointerId: number; marker: "left" | "right" } | null>(null);
  const gradient = useMemo(() => <linearGradient id={screenId} x1="0" x2="1" y1="0" y2="0">{points.map((point, index) => <stop key={index} offset={`${(point.x + 20) / 40 * 100}%`} stopColor="#eacb89" stopOpacity={.03 + Math.max(0, Math.min(1, point.y)) * .97} />)}</linearGradient>, [points, screenId]);
  function locate(event: PointerEvent<SVGSVGElement>, marker: "left" | "right") {
    const transform = event.currentTarget.getScreenCTM();
    if (!transform) return;
    const cursor = event.currentTarget.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY;
    const position = cursor.matrixTransform(transform.inverse());
    onPosition(marker, Math.min(20, Math.max(-20, (position.x - 40) / 640 * 40 - 20)));
  }
  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  }
  return <svg className="hs-manual-screen" viewBox="0 0 720 225" role="img" aria-label={`虚拟双缝屏和毫米尺。当前定位${activeMarker === "left" ? "左亮纹 A" : "右亮纹 B"}。屏幕从负 20 到正 20 毫米；可用下方带标签滑块或坐标输入完成同样操作。`} onPointerDown={(event) => { if (event.button !== 0) return; drag.current = { pointerId: event.pointerId, marker: activeMarker }; event.currentTarget.setPointerCapture(event.pointerId); locate(event, activeMarker); }} onPointerMove={(event) => { if (drag.current?.pointerId === event.pointerId) locate(event, drag.current.marker); }} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
    <defs>{gradient}</defs><rect x="40" y="45" width="640" height="100" fill="#12231b" /><rect x="40" y="45" width="640" height="100" fill={`url(#${screenId})`} /><path d="M40 154H680" stroke="#89987b" />
    {Array.from({ length: 41 }, (_, index) => { const position = index - 20; const x = 40 + index * 16; return <g key={index}><path d={`M${x} 154v${position % 5 === 0 ? 12 : 6}`} stroke="#89987b" />{position % 5 === 0 && <text x={x} y="183" textAnchor="middle">{position}</text>}</g>; })}
    {([{ key: "left", value: left, label: "A" }, { key: "right", value: right, label: "B" }] as const).map((marker) => marker.value !== null && <g key={marker.key}><path d={`M${40 + (marker.value + 20) * 16} 37V153`} stroke={marker.key === "left" ? "#f6f3d9" : "#ef9b59"} strokeWidth="2" strokeDasharray={activeMarker === marker.key ? undefined : "5 3"} /><text x={Math.max(62, Math.min(658, 40 + (marker.value + 20) * 16))} y={marker.key === "left" ? 17 : 34} textAnchor="middle" className="hs-manual-screen-marker">{`${marker.label} ${marker.value.toFixed(1)} mm`}</text></g>)}
    <text x="680" y="211" textAnchor="end">屏上位置 / mm · 向右为正</text>
  </svg>;
});

function ManualResult({ result, onSave, limitReached, readOnly, recorded, pendingRecovery, comparison }: { result: ManualMeasurementResult; onSave: () => boolean; limitReached: boolean; readOnly: boolean; recorded: boolean; pendingRecovery: boolean; comparison: string }) {
  return <div className="hs-manual-result"><span>按这次手动读数计算</span><dl>{result.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMeasurement(metric.value, 4)}<small>{metric.unit}</small></dd></div>)}</dl><button type="button" className="hs-button hs-primary" disabled={readOnly || limitReached || recorded || pendingRecovery} onClick={onSave}>{recorded ? <Check size={16} /> : pendingRecovery ? <RotateCcw size={16} /> : <Plus size={16} />}{recorded ? "本次读数已记录" : pendingRecovery ? "本次读数待恢复" : "保存这次手动读数"}</button>{readOnly && <p>当前档案不可写，请先确认档案归属或重新登录，再保存读数。</p>}{recorded ? <p>本轮相同读数已在档案中；开始下一次观察后，可以记录独立的重复测量。</p> : pendingRecovery && <p>本次读数已单独保留在待恢复区，尚未加入当前档案。请核对后恢复，无需重复保存。</p>}{limitReached && <p>当前档案与待恢复读数合计已达 120 条新增上限，请先导出并整理。</p>}<ul className="hs-manual-result-warnings">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><details><summary>计算方法与适用条件<ChevronDown size={14} /></summary><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>{comparison && <details className="hs-manual-comparison"><summary>展开后对照模型<ChevronDown size={14} /></summary><p>{comparison}</p></details>}</div>;
}

const ManualMeasurementHistory = memo(function ManualMeasurementHistory({ records, experimentId }: { records: ReturnType<typeof useManualMeasurements>["records"]; experimentId: ManualExperimentId }) {
  const parameters = HIGH_SCHOOL_EXPERIMENTS.find((definition) => definition.id === experimentId)!.parameters;
  if (!records.length) return <div className="hs-manual-history-empty">还没有手动读数。完成上方计时或读尺，再保存这次观察。</div>;
  return <div className="hs-table-scroll" tabIndex={0} aria-label="手动读数记录，可横向滚动"><table><thead><tr><th scope="col">序号</th><th scope="col">{experimentId === "pendulum" ? "开始 / s" : "左亮纹 / mm"}</th><th scope="col">{experimentId === "pendulum" ? "停止 / s" : "右亮纹 / mm"}</th><th scope="col">{experimentId === "pendulum" ? "完整周期数" : "相邻间隔数"}</th><th scope="col">按手动读数计算</th><th scope="col">本次条件与说明</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><th scope="row">{index + 1}</th><td>{formatMeasurement(record.manual.readings[experimentId === "pendulum" ? "startTimeSeconds" : "leftPositionMm"], 2)}</td><td>{formatMeasurement(record.manual.readings[experimentId === "pendulum" ? "endTimeSeconds" : "rightPositionMm"], 2)}</td><td>{record.manual.readings[experimentId === "pendulum" ? "periodCount" : "intervalCount"]}</td><td><dl className="hs-manual-history-values">{record.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMeasurement(metric.value, 4)} {metric.unit}</dd></div>)}</dl></td><td><details><summary>查看条件与说明</summary><dl>{parameters.map((parameter) => <div key={parameter.key}><dt>{parameter.label}</dt><dd>{formatMeasurement(record.parameters[parameter.key])} {parameter.unit}</dd></div>)}</dl><p>来源：虚拟仪器手动读数；显示间隔 {record.manual.resolution.value} {record.manual.resolution.unit}。</p><ul>{record.manual.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details></td></tr>)}</tbody></table></div>;
});
