import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Download, Pause, Play, Plus, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getHighSchoolExperiment, highSchoolVolumes } from "@physics-lab/knowledge/high-school";
import { createCapacitorHistory, switchCapacitorMode, validatedHighSchoolParameters, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment, type HighSchoolExperimentDefinition } from "@physics-lab/physics";
import type { CapacitorHistory, CapacitorMode } from "@physics-lab/contracts";
import { publishHighSchoolContext } from "../../../data/highSchoolContext";
import { getHighSchoolRecordScope, isCurrentHighSchoolRecordScope, subscribeHighSchoolRecordScope, type HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { HighSchoolHeader } from "../components/HighSchoolHeader";
import { PrecisionReadingPractice } from "../components/PrecisionReadingPractice";
import { InquiryGuide } from "../components/InquiryGuide";
import { LifeConnectionCard } from "../components/LifeConnectionCard";
import { expandedProtocols } from "../experiments/expandedProtocols";
import { ExperimentPlaybackStatus, WorkbenchNavigation } from "../components/WorkbenchChrome";
import { CollisionLearningPanel } from "../components/flagship/CollisionLearningPanel";
import { RefractionLearningPanel } from "../components/flagship/RefractionLearningPanel";
import { MultimeterControlPanel } from "../components/flagship/MultimeterControlPanel";
import { ExperimentReadings } from "../components/ExperimentReadings";
import { ExperimentViewport } from "../components/ExperimentViewport";
import { ExperimentPlot } from "../components/ExperimentPlot";
import { MeasurementAnalysisPanel } from "../components/MeasurementAnalysisPanel";
import { MeasurementRecoveryPanel } from "../components/MeasurementRecoveryPanel";
import { ManualMeasurementPanel } from "../components/ManualMeasurementPanel";
import { MechanicalEnergyMeasurementPanel } from "../components/MechanicalEnergyMeasurementPanel";
import { SpringLoadControl } from "../components/SpringLoadControl";
import { ForceCompositionControl } from "../components/ForceCompositionControl";
import { CapacitorSwitchControl } from "../components/CapacitorSwitchControl";
import { CapacitorHistoryDetails } from "../components/CapacitorHistoryDetails";
import { ExperimentParameterControl } from "../components/ExperimentParameterControl";
import { HighSchoolRecordScopePanel } from "../components/HighSchoolRecordScopePanel";
import { HighSchoolClassroomPanel } from "../components/HighSchoolClassroomPanel";
import { LegacyHighSchoolRecords } from "../components/LegacyHighSchoolRecords";
import { measurementColumns, measurementColumnKey, savedMetric, createTrajectory, formatMeasurement, formatParameterValue, measurementsToCsv, sceneDescriptions } from "../experiments/workbench";
import { formatMetric, metricState } from "../experiments/measurementPresentation";
import { getScopedMeasurementStore } from "../experiments/measurementStorage";
import { useExperimentClock } from "../experiments/useExperimentClock";
import { manualRecordsToContext } from "../experiments/manualContext";
import type { ManualMeasurementRecord } from "../experiments/useManualMeasurements";
import "./HighSchoolPages.css";
import "../styles/HighSchoolTheme.css";
import "../styles/HighSchoolMobile.css";
import "./HighSchoolWorkbench.css";

// A physical y quantity can appear against more than one x quantity.
function seriesIdentity(series: { key: string; xKey: string }) {
  return JSON.stringify([series.xKey, series.key]);
}

export function HighSchoolExperimentPage() {
  const { experimentId = "" } = useParams();
  const scope = useSyncExternalStore(subscribeHighSchoolRecordScope, getHighSchoolRecordScope, getHighSchoolRecordScope);
  const definition = HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === experimentId);
  const catalog = getHighSchoolExperiment(experimentId);
  if (!definition || catalog?.status !== "ready") return <div className="hs-page hs-lab-theme hs-cosmic-theme"><HighSchoolHeader /><main className="hs-unavailable"><BookOpen size={42} /><span className="hs-kicker">高中实验目录</span><h1>{catalog ? `${catalog.name}正在筹备。` : "还没有找到这个实验。"}</h1><p>{catalog?.learningGoal ?? "回到目录，选择已经开放的实验继续探索。"}</p><Link className="hs-button hs-primary" to="/high-school"><ArrowLeft size={16} />返回实验目录</Link></main></div>;
  return <HighSchoolWorkbench key={`${definition.id}:${scope.key ?? "blocked"}`} definition={definition} scope={scope} />;
}

export function HighSchoolWorkbench({ definition, scope }: { definition: HighSchoolExperimentDefinition; scope: HighSchoolRecordScope }) {
  const id = definition.id;
  const catalog = getHighSchoolExperiment(id);
  const [parameters, setParameters] = useState(() => defaultHighSchoolParameters(id));
  const [parameterResetToken, setParameterResetToken] = useState(0);
  const [capacitorHistory, setCapacitorHistory] = useState<CapacitorHistory | undefined>(() => id === "capacitor-charge" ? createCapacitorHistory(crypto.randomUUID()) : undefined);
  // The observation window depends on R/C, never on a later switching segment.
  const initial = useMemo(() => simulateHighSchoolExperiment(id, parameters, 0, id === "capacitor-charge" ? createCapacitorHistory("window") : undefined), [id, parameters]);
  const playbackRate = id === "transformer-ratio" ? 1 / parameters.frequency : 1;
  const clock = useExperimentClock(initial.durationSeconds, playbackRate);
  const [clockResetToken, setClockResetToken] = useState(0);
  const simulation = useMemo(() => simulateHighSchoolExperiment(id, parameters, clock.time, capacitorHistory), [id, parameters, clock.time, capacitorHistory]);
  const trajectory = useMemo(() => createTrajectory(id, parameters, initial.durationSeconds), [id, parameters, initial.durationSeconds]);
  const [seriesId, setSeriesId] = useState(() => initial.series[0] ? seriesIdentity(initial.series[0]) : "");
  const [measurementStore] = useState(() => getScopedMeasurementStore(id, scope.key));
  const [measurementSnapshot, setMeasurementSnapshot] = useState(() => measurementStore.read());
  const records = measurementSnapshot.records;
  const recordMetrics = measurementColumns(records);
  const recovery = measurementSnapshot.recovery;
  const retainedRecordCount = records.length + (recovery?.records.length ?? 0);
  const validInstrumentReading = simulation.state.readingValid !== 0;
  const [manualRecords, setManualRecords] = useState<ManualMeasurementRecord[]>([]);
  const storageError = measurementSnapshot.failed;
  const [notice, setNotice] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const selectedSeries = simulation.series.find((series) => seriesIdentity(series) === seriesId) ?? simulation.series[0];
  const contextTick = clock.running ? Math.floor(clock.time / playbackRate * 5) : clock.time;
  const contextSamples = useMemo(() => records.slice(-30).map(({ id: recordId, timeSeconds, parameters: recordParameters, capacitorHistory: savedHistory }) => ({ id: recordId, timeSeconds, parameters: recordParameters, ...(savedHistory ? { capacitorHistory: savedHistory } : {}) })), [records]);
  const manualContext = useMemo(() => manualRecordsToContext(id, manualRecords), [id, manualRecords]);
  const canWrite = useCallback(() => isCurrentHighSchoolRecordScope(scope, true), [scope]);
  const canRead = useCallback(() => isCurrentHighSchoolRecordScope(scope), [scope]);

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (measurementStore.matchesKey(event.key)) setMeasurementSnapshot(measurementStore.read());
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [measurementStore]);
  useEffect(() => {
    publishHighSchoolContext({ experimentId: id, parameters, timeSeconds: clock.time, recordCount: records.length, samples: contextSamples, ...(capacitorHistory ? { capacitorHistory } : {}), ...manualContext }, scope);
  }, [id, parameters, contextTick, clock.running, records.length, contextSamples, capacitorHistory, manualContext, scope]);
  useEffect(() => () => { publishHighSchoolContext(null, scope); }, [scope]);

  function restartCapacitorRun() { if (id === "capacitor-charge") setCapacitorHistory(createCapacitorHistory(crypto.randomUUID())); }
  function resetClock() { clock.reset(); restartCapacitorRun(); setClockResetToken((token) => token + 1); }
  function toggleClock() {
    if (!clock.running && clock.time >= initial.durationSeconds) { restartCapacitorRun(); setClockResetToken((token) => token + 1); }
    clock.toggle();
  }
  function changeCapacitorMode(mode: CapacitorMode) {
    if (!capacitorHistory || clock.time >= initial.durationSeconds) return;
    try { setCapacitorHistory(switchCapacitorMode({ resistanceKOhm: parameters.resistanceKOhm, capacitanceMicrofarads: parameters.capacitanceMicrofarads, emf: parameters.emf }, capacitorHistory, clock.time, mode)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "当前无法切换，请保留读数后重新开始。"); }
  }
  function changeParameters(patch: Record<string, number>) {
    const entries = Object.entries(patch);
    if (!entries.length || entries.some(([key, value]) => !Number.isFinite(value) || !definition.parameters.some((item) => item.key === key))) return;
    const bounded = Object.fromEntries(entries.map(([key, value]) => {
      const parameter = definition.parameters.find((item) => item.key === key)!;
      return [key, Math.min(parameter.max, Math.max(parameter.min, value))];
    }));
    let next: Record<string, number>;
    try { next = validatedHighSchoolParameters(id, { ...parameters, ...bounded }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "当前器材条件无效，已保留原设置。"); return; }
    resetClock();
    // Dragging changes direction and magnitude in one state transition.
    setParameters(next);
  }
  function changeParameter(key: string, value: number) { changeParameters({ [key]: value }); }
  function resetExperiment() {
    resetClock();
    setParameters(defaultHighSchoolParameters(id));
    // Recreate numeric editors even when their committed value was already the
    // default, so an incomplete draft and its validation message are discarded.
    setParameterResetToken((token) => token + 1);
    setNotice("已恢复默认条件，已有实验记录保留。");
  }
  function recordMeasurement() {
    if (!canWrite()) { setNotice("档案身份已变化或当前只读，请确认归属后再记录。"); return; }
    if (!validInstrumentReading) { setNotice("当前接法、量程或装置状态无法取得有效读数，请先按装置提示修正。"); return; }
    if (retainedRecordCount >= 120) return;
    const recordId = crypto.randomUUID();
    const next = measurementStore.append({ id: recordId, createdAt: new Date().toISOString(), timeSeconds: clock.time, parameters: { ...parameters }, metrics: simulation.metrics.map((metric) => ({ ...metric })), ...(capacitorHistory ? { capacitorHistory } : {}) });
    setMeasurementSnapshot(next);
    setNotice(next.recovery?.records.some((record) => record.id === recordId)
      ? "这组读数暂留在待恢复区。请先导出副本，待本机档案可读取后核对并恢复。"
      : next.failed ? `已保留第 ${next.records.length} 次读数，但本机保存未完成，请先导出或重试。`
        : `已记录第 ${next.records.length} 次读数，实验条件一并保留。`);
  }
  function retrySavingMeasurements() {
    if (!canWrite()) { setNotice("档案身份已变化或当前只读，未重试保存。请确认归属后再操作。"); return; }
    const next = measurementStore.retryPending();
    setMeasurementSnapshot(next);
    setNotice(next.recovery?.records.length ? `待恢复区保留了 ${next.recovery.records.length} 条读数，请核对后恢复；关闭页面前请导出副本。` : next.failed
      ? "本机记录仍有读取或保存异常。当前读数已保留，请先导出 CSV，避免刷新后丢失。"
      : `本机保存检查已通过，当前档案共 ${next.records.length} 条读数。`);
  }
  function recoverMeasurements(reviewToken: string) {
    if (!canWrite()) { setNotice("档案身份已变化或当前只读，未恢复读数。请确认归属后再操作。"); return; }
    const next = measurementStore.recoverPending(reviewToken);
    setMeasurementSnapshot(next);
    setNotice(next.error
      ? `${next.recoveredCount ? `已保存 ${next.recoveredCount} 条。` : ""}${next.error} ${next.recovery?.records.length ? `剩余 ${next.recovery.records.length} 条待恢复副本仍保留，请先导出。` : "当前档案已刷新，请核对记录。"}`
      : `已将 ${next.recoveredCount} 条待恢复读数存入当前档案，原编号与实验条件保留。`);
  }
  function exportRecoveryCsv() {
    if (!canRead()) { setNotice("档案身份已变化，未导出旧档案的待恢复读数。"); return; }
    if (!recovery?.records.length) return;
    const url = URL.createObjectURL(new Blob([measurementsToCsv(recovery.records, definition)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.title}-待恢复模型读数.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearMeasurements() {
    if (!canWrite()) { setConfirmClear(false); setNotice("档案身份已变化或当前只读，未清空记录。"); return; }
    const next = measurementStore.clear();
    setMeasurementSnapshot(next);
    setConfirmClear(false);
    setNotice(next.cleared ? `当前实验的本机记录已清空，其他标签页会同步更新。${next.recovery ? "待恢复副本仍保留，请单独核对或导出。" : ""}` : "暂时无法清空本机记录，原有读数已保留。");
  }
  function exportCsv() {
    if (!isCurrentHighSchoolRecordScope(scope)) { setNotice("档案身份已变化，请在当前档案中重新导出。"); return; }
    const url = URL.createObjectURL(new Blob([measurementsToCsv(records, definition)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.title}-实验记录.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="hs-page hs-experiment-page hs-lab-theme hs-cosmic-theme"><HighSchoolHeader experiment />
    <main className="hs-workbench">
      <div className="hs-breadcrumb"><Link to="/high-school">实验目录</Link><span>/</span><span>{highSchoolVolumes.find((volume) => volume.id === catalog?.volume)?.name}</span><span>/</span><span>{definition.field}</span></div>
      <header className="hs-experiment-heading"><div><span className="hs-kicker">{catalog?.chapter ?? "高中物理探究"}</span><h1>{definition.title}</h1><p>{catalog?.learningGoal ?? definition.description}</p></div><span className="hs-open-badge"><i />可交互实验</span></header>
      <HighSchoolRecordScopePanel scope={scope} />
      <HighSchoolClassroomPanel experimentId={id} scope={scope} />
      <WorkbenchNavigation />
      {expandedProtocols[id] && <details className="hs-prelab-guide"><summary><span><BookOpen size={16} />本次探究 · 从一个问题开始</span><small>查看步骤与预测</small><ChevronDown size={16} /></summary><InquiryGuide key={id} experimentId={id} /></details>}

      <div className="hs-lab-layout" id="hs-stage"><section className="hs-lab-main hs-apparatus-console" aria-label="装置与计时"><ExperimentViewport experimentId={id} parameters={parameters} simulation={simulation} trajectory={trajectory} onParametersChange={changeParameters} capacitorMode={simulation.capacitor?.mode} onCapacitorModeChange={changeCapacitorMode} capacitorSwitchDisabled={clock.time >= initial.durationSeconds} />
        <div className="hs-playbar"><div className="hs-clock"><small>{initial.durationSeconds > 0 ? "实验时间" : "稳态实验"}</small><strong>{initial.durationSeconds > 0 ? <>{clock.time.toFixed(id === "transformer-ratio" ? 4 : 2)}<span> / {initial.durationSeconds.toFixed(id === "transformer-ratio" ? 4 : 2)} s</span></> : "即时读数"}</strong></div><div className="hs-play-controls"><button className="hs-play-toggle" type="button" disabled={initial.durationSeconds <= 0} onClick={toggleClock} aria-label={clock.running ? "暂停实验" : "播放实验"}>{clock.running ? <Pause size={17} /> : <Play size={17} />}{clock.running ? "暂停" : "播放"}</button><button type="button" disabled={initial.durationSeconds <= 0 || clock.time >= initial.durationSeconds} onClick={clock.step} title={id === "transformer-ratio" ? "前进1/60个交流周期（按实际频率换算秒）" : "前进一个固定时间步（1/60 秒）"}><SkipForward size={16} />单步</button><button type="button" disabled={initial.durationSeconds <= 0} onClick={resetClock}><RotateCcw size={15} />重新计时</button></div></div>
        <ExperimentPlaybackStatus time={clock.time} duration={initial.durationSeconds} running={clock.running} />
      </section>
      <aside className="hs-controls" id="hs-conditions" aria-labelledby="hs-controls-title"><header><span className="hs-console-label">条件控制台</span><h2 id="hs-controls-title" tabIndex={-1}>先改变一个变量。</h2><p>设定条件，观察变化，再记录一组可比较的读数。</p></header><div className="hs-parameter-list">{definition.parameters.map((parameter) => <ExperimentParameterControl key={`${parameter.key}:${parameterResetToken}`} parameter={parameter} value={parameters[parameter.key]} onChange={(value) => changeParameter(parameter.key, value)} />)}</div><button className="hs-button hs-primary hs-record-button" type="button" onClick={recordMeasurement} disabled={!scope.canWrite || retainedRecordCount >= 120 || !validInstrumentReading}><Plus size={17} />记录这组读数<span>{retainedRecordCount} / 120</span></button><button className="hs-reset-parameters" type="button" onClick={resetExperiment}><RotateCcw size={13} />恢复默认条件</button><p className="hs-control-note">{initial.durationSeconds > 0 ? "调整条件后重新计时，已有记录保留，便于比较。" : "调整条件后立即更新静态读数，已有记录保留。"}待恢复读数也计入本页新增上限。</p>{simulation.warnings.length > 0 && <div className="hs-model-warning" role="note">{simulation.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}</aside>
      <section className="hs-observation-console" id="hs-readings" aria-labelledby="hs-readings-title">
        <header className="hs-observation-heading"><div><span className="hs-console-label">观察与读数</span><h2 id="hs-readings-title">把变化，看清楚。</h2></div><span className="hs-reading-provenance">当前条件 · 模型计算</span></header>
        <ExperimentReadings simulation={simulation} />
        {id === "momentum-conservation" && <CollisionLearningPanel parameters={parameters} simulation={simulation} onChange={changeParameters} />}
        {id === "refractive-index" && <RefractionLearningPanel parameters={parameters} simulation={simulation} onChange={changeParameters} />}
        {id === "multimeter" && <MultimeterControlPanel parameters={parameters} simulation={simulation} onChange={changeParameters} />}
        {id === "transformer-ratio" && <p className="hs-control-note">演示速度：每秒展示 1 个交流周期；物理频率为 {parameters.frequency} Hz，单步为 1/60 周期。时间、曲线和保存读数均使用实际物理秒，三周期后停止。</p>}
        {id === "spring-force" && <SpringLoadControl massGrams={parameters.loadMassGrams} onChange={(value) => changeParameter("loadMassGrams", value)} />}
        {id === "force-composition" && <ForceCompositionControl parameters={parameters} simulation={simulation} onChange={changeParameters} onRecord={recordMeasurement} recordDisabled={!scope.canWrite || retainedRecordCount >= 120} />}
        {id === "capacitor-charge" && capacitorHistory && simulation.capacitor && <><CapacitorSwitchControl parameters={parameters} simulation={simulation} mode={simulation.capacitor.mode} onModeChange={changeCapacitorMode} switchDisabled={clock.time >= initial.durationSeconds} /><p className="hs-control-note">切换开关保留电压与电荷；暂停只停止计时。重新计时或调整 R、C、E 会从 0 V 接电源开始新一轮，已保存记录保留。本轮观察窗为 20RC，到时不会强制充满或放空。最多保留 32 段切换，达到上限后先保存读数再重新开始。</p><CapacitorHistoryDetails history={capacitorHistory} timeSeconds={clock.time} /></>}
        {id === "precision-length" && <PrecisionReadingPractice key={`${parameters.instrument}:${parameters.objectLengthMm}:${parameters.zeroErrorMm}`} instrument={parameters.instrument} contactMode={parameters.contactMode} indicatedLengthMm={simulation.state.indicatedLengthMm} zeroReadingMm={simulation.state.zeroReadingMm} />}
        <p className="hs-apparatus-caption">{sceneDescriptions[id]}{initial.durationSeconds > 0 ? " 动画按固定时间步推进，切换视图不改变实验进度。" : " 本实验为稳态模型，调整参数后立即得到新的工作点。"}</p>
      </section></div>

      <LifeConnectionCard experimentId={id} />

      <div className="hs-evidence-layout" id="hs-graphs"><section className="hs-chart-panel" aria-labelledby="hs-chart-title"><header className="hs-panel-heading"><span>01 / 图像与关系</span><h2 id="hs-chart-title">读出变化的规律。</h2></header><div className="hs-chart-tabs" role="group" aria-label="选择数据图像">{simulation.series.map((series) => <button key={seriesIdentity(series)} type="button" aria-pressed={Boolean(selectedSeries && seriesIdentity(series) === seriesIdentity(selectedSeries))} onClick={() => setSeriesId(seriesIdentity(series))}>{series.label}</button>)}</div>{selectedSeries && <ExperimentPlot key={`${seriesIdentity(selectedSeries)}:${JSON.stringify(parameters)}:${JSON.stringify(capacitorHistory)}`} series={selectedSeries} historyOnly={id === "capacitor-charge"} currentPoint={!validInstrumentReading || (id === "photoelectric-effect" && selectedSeries.key === "stoppingVoltage" && !simulation.state.emissionAllowed) || (id === "force-composition" && !simulation.state.angleBetweenDefined) ? undefined : { x: simulation.state[selectedSeries.xKey], y: simulation.state[selectedSeries.key] }} probeAtX={selectedSeries.xKey === "time" && id !== "capacitor-charge" ? (time) => { const state = simulateHighSchoolExperiment(id, parameters, time).state; return state.readingValid === 0 ? null : { x: state.time, y: state[selectedSeries.key] }; } : undefined} />}{id === "force-composition" && !selectedSeries && <p className="hs-control-note">任一分力为零时，两力夹角未定义，暂不绘制 R²—cosθ 关系。先设两个非零分力，再比较不同夹角。</p>}</section>
        <section className="hs-model-panel" aria-labelledby="hs-model-title"><header className="hs-panel-heading"><span>02 / 模型与边界</span><h2 id="hs-model-title">这次实验怎样计算？</h2></header><div className="hs-equations">{simulation.equations.map((equation) => <code key={equation}>{equation}</code>)}</div><details open><summary>使用这些关系式的前提<ChevronDown size={15} /></summary><ul>{definition.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details></section>
      </div>

      <section className="hs-records-panel" id="hs-evidence" aria-labelledby="hs-records-title"><header className="hs-records-heading"><div><span className="hs-kicker">03 / 实验证据</span><h2 id="hs-records-title">留下读数，也留下条件。</h2><p>本机记录独立保存于高中专区，可导出 CSV 继续分析。</p></div><div className="hs-record-actions"><button className="hs-button" type="button" onClick={exportCsv} disabled={!records.length}><Download size={15} />导出 CSV</button><button className="hs-icon-button" type="button" onClick={() => setConfirmClear(true)} disabled={!scope.canWrite || !records.length} aria-label="清空本实验记录"><Trash2 size={17} /></button></div></header>{notice && <p className="hs-record-notice" role="status"><Check size={15} />{notice}</p>}{storageError && <div className="hs-storage-error" role="alert"><p>浏览器本机记录读取或保存异常。当前页面的读数仍在，请先导出 CSV，避免刷新后丢失。</p><button className="hs-button" type="button" onClick={retrySavingMeasurements} disabled={!scope.canWrite}>重试本机保存</button></div>}{confirmClear && scope.canWrite && <div className="hs-clear-confirm"><span>清空当前实验的 {records.length} 条本机记录？</span><button type="button" onClick={clearMeasurements}>确认清空</button><button type="button" onClick={() => setConfirmClear(false)}>保留记录</button></div>}
        {records.length ? <div className="hs-table-scroll" tabIndex={0} aria-label="可横向滚动的实验记录表"><table><thead><tr><th scope="col">序号</th><th scope="col">实验时间 / s</th>{recordMetrics.map((metric) => <th key={measurementColumnKey(metric)} scope="col">{metric.label}{metric.unit && <small>{metric.unit}</small>}</th>)}<th scope="col">当时的实验条件</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><th scope="row">{String(index + 1).padStart(2, "0")}</th><td>{formatMeasurement(record.timeSeconds)}</td>{recordMetrics.map((metric) => <td key={measurementColumnKey(metric)}>{formatMetric({ key: metric.key, value: savedMetric(record, metric)?.value ?? NaN }, metricState(record.metrics))}</td>)}<td><details><summary>查看条件</summary><dl>{definition.parameters.map((parameter) => <div key={parameter.key}><dt>{parameter.label}</dt><dd>{formatParameterValue(parameter, record.parameters[parameter.key])} {parameter.unit}</dd></div>)}</dl>{record.capacitorHistory && <CapacitorHistoryDetails history={record.capacitorHistory} timeSeconds={record.timeSeconds} />}</details></td></tr>)}</tbody></table></div> : <div className="hs-records-empty"><BookOpen size={27} /><div><h3>第一组证据，从一次记录开始。</h3><p>调整条件或播放实验，在合适的时刻点击“记录这组读数”。</p></div><button type="button" disabled={!scope.canWrite || retainedRecordCount >= 120 || !validInstrumentReading} onClick={recordMeasurement}>记录当前读数<ArrowRight size={15} /></button></div>}
      </section>
      {recovery && <MeasurementRecoveryPanel records={recovery.records} definition={definition} reviewToken={recovery.reviewToken} writable={scope.canWrite} onExport={exportRecoveryCsv} onRecover={recoverMeasurements} />}
      {(id === "pendulum" || id === "double-slit") && <ManualMeasurementPanel experimentId={id} parameters={parameters} timeSeconds={clock.time} simulation={simulation} clockRunning={clock.running} resetToken={clockResetToken} onClockToggle={toggleClock} onClockStep={clock.step} onRecordsChange={setManualRecords} scopeKey={scope.key} recordWritable={scope.canWrite} canWrite={canWrite} canRead={canRead} />}
      {id === "mechanical-energy" && <MechanicalEnergyMeasurementPanel parameters={parameters} timeSeconds={clock.time} simulation={simulation} clockRunning={clock.running} resetToken={clockResetToken} onClockToggle={toggleClock} onClockStep={clock.step} onRecordsChange={setManualRecords} scopeKey={scope.key} recordWritable={scope.canWrite} canWrite={canWrite} canRead={canRead} />}
      <MeasurementAnalysisPanel experimentId={id} records={records} />
      <LegacyHighSchoolRecords definition={definition} />
      {catalog && <section className="hs-inquiry-prompts"><div><span className="hs-kicker">下一步探究</span><h2>试着用证据回答。</h2></div><ul>{catalog.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><p>可以向力力描述你的预测和观察，请它帮你设计下一次对照实验。</p></section>}
    </main><footer className="hs-footer"><Link to="/high-school"><ArrowLeft size={14} />返回高中实验目录</Link><p>真实的理解，来自可以反复检验的解释。</p></footer>
  </div>;
}
