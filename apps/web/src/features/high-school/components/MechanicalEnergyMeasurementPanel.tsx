import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Download, Pause, Play, Plus, RotateCcw, Ruler, SkipForward, Trash2 } from 'lucide-react';
import { calculateMechanicalEnergyTapeMeasurement, HIGH_SCHOOL_EXPERIMENTS, mechanicalEnergyTapePoints, MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS, quantizeMechanicalEnergyTapePositionMm, validateMechanicalEnergyTapeObservation, type HighSchoolSimulation, type ManualMeasurementResult, type MechanicalEnergyTapePoint } from '@physics-lab/physics/high-school';
import { useManualMeasurements, type ManualMeasurementRecord } from '../experiments/useManualMeasurements';
import { formatMeasurement } from '../experiments/workbench';
import { isManualReadingRecorded, manualReadingSignature } from './manualInstrumentState';
import { MeasurementRecoveryPanel } from './MeasurementRecoveryPanel';
import { tapeRulerGeometry } from './mechanicalEnergyGeometry';
import './ManualMeasurementPanel.css';
import './MechanicalEnergyMeasurementPanel.css';

export interface MechanicalEnergyMeasurementPanelProps {
  parameters: Record<string, number>;
  timeSeconds: number;
  simulation: HighSchoolSimulation;
  clockRunning: boolean;
  onClockToggle: () => void;
  onClockStep: () => void;
  resetToken: number;
  scopeKey: string | null;
  recordWritable: boolean;
  canWrite: () => boolean;
  canRead: () => boolean;
  onRecordsChange?: (records: ManualMeasurementRecord[]) => void;
}
const readingFields = [
  { key: 'aBeforeMm', group: 'a', offset: -1, label: 'A 前一相邻点' },
  { key: 'aCenterMm', group: 'a', offset: 0, label: 'A 中心点' },
  { key: 'aAfterMm', group: 'a', offset: 1, label: 'A 后一相邻点' },
  { key: 'bBeforeMm', group: 'b', offset: -1, label: 'B 前一相邻点' },
  { key: 'bCenterMm', group: 'b', offset: 0, label: 'B 中心点' },
  { key: 'bAfterMm', group: 'b', offset: 1, label: 'B 后一相邻点' },
] as const;
type ReadingKey = typeof readingFields[number]['key'];
const blankReadings = (): Record<ReadingKey, string> => ({ aBeforeMm: '', aCenterMm: '', aAfterMm: '', bBeforeMm: '', bCenterMm: '', bAfterMm: '' });
const indexNumber = (value: string) => value.trim() && Number.isSafeInteger(Number(value)) && Number(value) >= 1 ? Number(value) : null;

export function MechanicalEnergyMeasurementPanel(props: MechanicalEnergyMeasurementPanelProps) {
  const { parameters, timeSeconds, simulation, clockRunning, resetToken, scopeKey, canWrite, canRead, recordWritable, onRecordsChange } = props;
  const archive = useManualMeasurements('mechanical-energy', scopeKey, canWrite, canRead);
  const { records, recovery, storageError, excludedCount, actionError } = archive;
  const recoveryCount = recovery ? recovery.records.length + recovery.excludedCount : 0;
  const limitReached = records.length + recoveryCount >= 120;
  const id = useId();
  const parameterKey = JSON.stringify([parameters.mass, parameters.dropHeight, parameters.resistanceRatio]);
  const run = useRef({ parameterKey, resetToken, timeSeconds, scopeKey, epoch: 0 });
  if (run.current.parameterKey !== parameterKey || run.current.resetToken !== resetToken || run.current.scopeKey !== scopeKey || timeSeconds < run.current.timeSeconds - 1e-9) {
    run.current = { parameterKey, resetToken, timeSeconds, scopeKey, epoch: run.current.epoch + 1 };
  } else run.current.timeSeconds = timeSeconds;
  const epoch = run.current.epoch;
  const [draftEpoch, setDraftEpoch] = useState(epoch);
  const [indices, setIndices] = useState({ a: '', b: '' });
  const [readings, setReadings] = useState(blankReadings);
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const savedSignatures = useRef<ReadonlySet<string>>(new Set());
  const [, setSavedRevision] = useState(0);
  const inputRevision = useRef(0);
  const renderedInputRevision = inputRevision.current;
  const justSaved = useRef<{ signature: string; records: ManualMeasurementRecord[]; recovery: ManualMeasurementRecord[] } | null>(null);
  const mounted = useRef(true);
  const active = useRef({ scopeKey, canWrite, canRead, epoch, timeSeconds, recordWritable, records, recoveryRecords: recovery?.records ?? [], parameterKey });
  active.current = { scopeKey, canWrite, canRead, epoch, timeSeconds, recordWritable, records, recoveryRecords: recovery?.records ?? [], parameterKey };
  const current = (write = false) => mounted.current && active.current.scopeKey === scopeKey && active.current.epoch === epoch && active.current.parameterKey === parameterKey
    && canRead() && active.current.canRead() && (!write || (recordWritable && active.current.recordWritable && canWrite() && active.current.canWrite()));
  const draftCurrent = draftEpoch === epoch;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (draftEpoch === epoch) return;
    setIndices({ a: '', b: '' }); setReadings(blankReadings()); savedSignatures.current = new Set(); setDraftEpoch(epoch); setConfirmClear(false);
    setNotice('实验条件、计时或档案归属已改变，未完成的纸带读数已作废；已保存历史保留。');
  }, [epoch, draftEpoch]);
  useEffect(() => { if (current()) onRecordsChange?.(records); }, [records, onRecordsChange, scopeKey, canRead]);
  const points = useMemo(() => mechanicalEnergyTapePoints(parameters, timeSeconds), [parameterKey, timeSeconds]);
  const lastIndex = points.at(-1)?.index ?? 0;
  const maxCenter = lastIndex - 1;
  const indexA = draftCurrent ? indexNumber(indices.a) : null;
  const indexB = draftCurrent ? indexNumber(indices.b) : null;
  const validCenters = indexA !== null && indexB !== null && indexA <= maxCenter && indexB <= maxCenter && indexB > indexA;
  const calculation = useMemo(() => {
    if (!draftCurrent || !validCenters || readingFields.some(({ key }) => !readings[key].trim())) return { result: null, error: '' };
    try {
      const result = calculateMechanicalEnergyTapeMeasurement({ mass: parameters.mass, dropHeight: parameters.dropHeight, resistanceRatio: parameters.resistanceRatio,
        indexA: indexA!, indexB: indexB!, aBeforeMm: Number(readings.aBeforeMm), aCenterMm: Number(readings.aCenterMm), aAfterMm: Number(readings.aAfterMm), bBeforeMm: Number(readings.bBeforeMm), bCenterMm: Number(readings.bCenterMm), bAfterMm: Number(readings.bAfterMm) });
      validateMechanicalEnergyTapeObservation(parameters, result.readings, timeSeconds);
      return { result, error: '' };
    } catch (error) { return { result: null, error: error instanceof Error ? error.message : '请核对六个位置读数。' }; }
  }, [draftCurrent, validCenters, indexA, indexB, readings, parameterKey, timeSeconds]);
  const result = calculation.result;
  const activeResult = useRef(result); activeResult.current = result;
  const recorded = !!result && isManualReadingRecorded(savedSignatures.current, records, result, parameters);
  const pendingRecovery = !!result && isManualReadingRecorded(savedSignatures.current, recovery?.records ?? [], result, parameters);

  function selectIndex(group: 'a' | 'b', value: string) {
    if (!current() || !draftCurrent || value === indices[group]) return;
    inputRevision.current += 1;
    setIndices((previous) => ({ ...previous, [group]: value }));
    setReadings((previous) => ({ ...previous, ...Object.fromEntries(readingFields.filter((field) => field.group === group).map((field) => [field.key, ''])) }));
    setNotice('选点已改变，请从对应局部标尺重新填写这一组的三个位置。');
  }
  function enterReading(key: ReadingKey, value: string) { if (current() && draftCurrent) { inputRevision.current += 1; setReadings((previous) => ({ ...previous, [key]: value })); setNotice(''); } }
  function normalizeReading(key: ReadingKey) {
    if (!current() || !draftCurrent || !readings[key].trim()) return;
    try { enterReading(key, quantizeMechanicalEnergyTapePositionMm(Number(readings[key])).toFixed(1)); }
    catch { setNotice('读数应是有效的非负毫米位置，请按标尺核对。'); }
  }
  function nextObservation() {
    if (!current()) return;
    inputRevision.current += 1; justSaved.current = null; savedSignatures.current = new Set(); setIndices({ a: '', b: '' }); setReadings(blankReadings()); setDraftEpoch(epoch);
    setNotice('已开始下一次纸带读数。请重新选点和读尺；同值也可作为一次独立重复观察，历史保留。');
  }
  function saveReading() {
    if (!current(true) || !draftCurrent || !result || activeResult.current !== result || inputRevision.current !== renderedInputRevision || limitReached) return;
    if (isManualReadingRecorded(savedSignatures.current, active.current.records, result, parameters) || isManualReadingRecorded(savedSignatures.current, active.current.recoveryRecords, result, parameters)) return;
    // Prevent a second click in the same render from adding the same observation.
    const signature = manualReadingSignature(result, parameters);
    if (justSaved.current?.signature === signature && justSaved.current.records === active.current.records && justSaved.current.recovery === active.current.recoveryRecords) return;
    try {
      validateMechanicalEnergyTapeObservation(parameters, result.readings, active.current.timeSeconds);
      const outcome = archive.save(result, { ...parameters }, active.current.timeSeconds);
      if (!current()) return;
      if (outcome.saved) { justSaved.current = { signature, records: active.current.records, recovery: active.current.recoveryRecords }; savedSignatures.current = new Set([...savedSignatures.current, signature]); setSavedRevision((value) => value + 1); }
      setNotice(outcome.error ?? (outcome.pendingRecovery ? '读数已单独留在待恢复区，请核对后显式恢复；尚未用于当前档案或力力。' : outcome.failed ? '本机保存异常，请先导出手动记录 CSV 保留副本。' : outcome.saved ? '六个原始位置、所选点号和当时条件已保存。' : '没有新增记录，请检查读数和档案上限。'));
    } catch (error) { if (current()) setNotice(error instanceof Error ? error.message : '保存失败，请保留读数并重试。'); }
  }
  function retrySave() { if (!current(true)) return; const outcome = archive.retryPending(); if (current()) setNotice(outcome.error ?? (outcome.failed ? '本机存储仍异常，请先导出 CSV。' : '已重新检查并重试保存，当前未检测到存储错误。')); }
  function recoverReadings(token: string) { if (!current(true)) return; const outcome = archive.recoverPending(token); if (current()) setNotice(`${outcome.recoveredCount > 0 ? `已恢复 ${outcome.recoveredCount} 条。` : ''}${outcome.error ?? (outcome.failed ? '存储仍有异常，请核对剩余待恢复记录并导出。' : '恢复检查已完成，原始位置和条件保持不变。')}`); }
  const definition = HIGH_SCHOOL_EXPERIMENTS.find((entry) => entry.id === 'mechanical-energy')!;
  const atEnd = timeSeconds >= simulation.durationSeconds;
  if (!current()) return <section className="hs-manual-panel"><p className="hs-manual-notice">请确认当前档案归属后使用纸带读数工具。</p></section>;
  return <section className="hs-manual-panel hs-energy-manual" aria-labelledby={`${id}-heading`}>
    <header className="hs-manual-heading"><div><span className="hs-kicker">虚拟纸带 / 手动读数</span><h2 id={`${id}-heading`}>读出六个位置，比较两种能量变化。</h2><p>计时器与释放同步，点间隔固定为 {MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS} s（50 Hz）。只展示当前已生成的等时点，终点不会补成额外等时点。读数独立保存，属于虚拟仪器手动观察，不是真实器材实测。</p></div><Ruler size={31} strokeWidth={1.3} aria-hidden="true" /></header>
    <div className="hs-energy-tape-overview">
      <div className="hs-manual-motion-controls"><span>当前时钟 {formatMeasurement(timeSeconds, 3)} s · 已生成 {points.length} 个点（从 0 号起）</span><button type="button" onClick={() => { if (current()) props.onClockToggle(); }}>{clockRunning ? <Pause size={14} /> : <Play size={14} />}{clockRunning ? '暂停纸带' : atEnd ? '重新释放' : '播放下落'}</button><button type="button" disabled={atEnd} onClick={() => { if (current()) props.onClockStep(); }}><SkipForward size={14} />单步观察</button></div>
      <MechanicalEnergyTapeOverview points={points} indexA={indexA} indexB={indexB} />
      <p>横向展开的纸带，位置从释放时的 0 号点向右增大。总览压缩显示；精细读数使用下面的局部放大毫米尺。</p>
      <div className="hs-energy-index-controls">{(['a', 'b'] as const).map((group) => <div key={group}><label htmlFor={`${id}-${group}-index`}>{group.toUpperCase()} 中心点号 <b>{draftCurrent && indices[group] ? indices[group] : '尚未选点'}</b></label><input id={`${id}-${group}-index`} type="number" inputMode="numeric" min="1" max={Math.max(1, maxCenter)} step="1" value={draftCurrent ? indices[group] : ''} disabled={maxCenter < 2} placeholder="由你选择" onChange={(event) => selectIndex(group, event.target.value)} /><input type="range" min="1" max={Math.max(1, maxCenter)} step="1" aria-label={`选择${group.toUpperCase()}中心点号，方向键逐点移动`} aria-valuetext={draftCurrent && indices[group] ? `${indices[group]}号点` : '尚未选点'} value={Math.max(1, Math.min(Math.max(1, maxCenter), (group === 'a' ? indexA : indexB) ?? (group === 'a' ? 1 : 2)))} disabled={maxCenter < 2} onChange={(event) => selectIndex(group, event.target.value)} /></div>)}</div>
      {maxCenter < 2 ? <p className="hs-manual-instrument-notice">先播放到至少 3 号点出现，才能选两个有前后相邻点的中心点。</p> : <p>中心点可选 1–{maxCenter} 号，B 必须晚于 A。建议相隔至少 3 个间隔，使用六个不同点；相邻选择会共用位置，重复读数须一致。</p>}
      {!validCenters && indexA !== null && indexB !== null && <p className="hs-manual-validation" role="alert">请在已生成点范围内选择 A、B，且 B &gt; A；两点前后都要有等时点。</p>}
    </div>
    <div className="hs-energy-reading-grid">{readingFields.map((field) => { const center = field.group === 'a' ? indexA : indexB; const point = center !== null && center <= maxCenter ? points.find((entry) => entry.index === center + field.offset) : undefined; return <div key={field.key} className="hs-energy-reading-card"><label htmlFor={`${id}-${field.key}`}>{field.label}<span>{point ? ` · ${point.index} 号` : ' · 待选点'}</span></label>{point ? <MechanicalEnergyTapeRuler point={point} label={field.label} /> : <div className="hs-energy-ruler-placeholder">选择中心点后，显示此处的局部毫米尺。</div>}<div className="hs-energy-reading-input"><input id={`${id}-${field.key}`} type="number" inputMode="decimal" min="0" max={Math.max(parameters.dropHeight * 1000, quantizeMechanicalEnergyTapePositionMm(parameters.dropHeight * 1000))} step="0.1" value={draftCurrent ? readings[field.key] : ''} disabled={!point} placeholder="由你读尺填写" onChange={(event) => enterReading(field.key, event.target.value)} onBlur={() => normalizeReading(field.key)} /><span>mm</span></div></div>; })}</div>
    <div className="hs-energy-result-area"><div><p className="hs-manual-resolution">尺上每小格 0.1 mm。输入按 0.1 mm 量化；这是虚拟标尺的读数间隔，不代表实体仪器精度。以 A、B 两点前后相邻位置估计速度，再比较 A→B 的动能增加与重力势能减少。</p><button type="button" className="hs-button" onClick={nextObservation}><RotateCcw size={14} />开始下一次纸带读数</button></div>
      {calculation.error && <p className="hs-manual-validation" role="alert">{calculation.error}</p>}
      {result ? <div className="hs-manual-result"><span>只按这六个手动读数计算</span><dl>{result.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMeasurement(metric.value, 5)}<small>{metric.unit}</small></dd></div>)}</dl><button type="button" className="hs-button hs-primary" onClick={saveReading} disabled={!recordWritable || limitReached || recorded || pendingRecovery}>{recorded ? <Check size={15} /> : <Plus size={15} />}{recorded ? '本次读数已记录' : pendingRecovery ? '本次读数待恢复' : '保存这次纸带读数'}</button>{!recordWritable && <p>当前档案只读，请确认归属并重新登录后保存。</p>}{limitReached && <p>当前档案与待恢复记录合计达到 120 条新增上限，请先导出并整理。</p>}{(recorded || pendingRecovery) && <p>本轮相同读数不会重复新增；开始下一次纸带读数，可记录独立的重复观察。</p>}<ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><details><summary>计算方法与适用条件</summary><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details></div> : <p className="hs-manual-result-placeholder">选好 A、B 并填写全部六个原始位置后，才会计算速度与能量差。系统不填入理论位置或理论速度。</p>}
    </div>
    <div className="hs-manual-records"><header><div><h3>纸带手动读数档案<span>{records.length} / 120</span></h3><p>保留六个原始位置、点号、质量与下落条件，独立于自动模型记录。</p></div><div className="hs-record-actions"><button type="button" className="hs-button" disabled={!records.length} onClick={() => { if (current()) archive.exportCsv(); }}><Download size={15} />导出手动读数 CSV</button><button type="button" className="hs-icon-button" disabled={!recordWritable || !records.length} aria-label="清空纸带手动读数" onClick={() => { if (current(true)) setConfirmClear(true); }}><Trash2 size={16} /></button></div></header>
      {notice && <p className="hs-manual-notice" role="status">{notice}</p>}{actionError && <p className="hs-manual-storage-error" role="alert">{actionError}</p>}
      {storageError && <div className="hs-manual-storage-error" role="alert"><p>读取或保存遇到异常，请先导出 CSV；存储恢复后可以重试，无需新增读数。</p><button type="button" className="hs-button" disabled={!recordWritable} onClick={retrySave}>重试本机保存</button></div>}
      {excludedCount > 0 && <p className="hs-manual-storage-error">另有 {excludedCount} 条记录无法按当前格式读取，未用于档案或分析。</p>}{recoveryCount > 0 && <p className="hs-manual-notice">另有 {recoveryCount} 条待恢复记录，计入新增上限，尚未交给力力或当前档案。</p>}
      {confirmClear && <div className="hs-clear-confirm"><span>清空当前 {records.length} 条纸带手动记录？自动记录与待恢复区保留。</span><button type="button" onClick={() => { if (!current(true)) return; const cleared = archive.clear(); setNotice(cleared ? '当前纸带手动档案已清空。' : '清空失败，记录保留。'); setConfirmClear(false); }}>确认清空</button><button type="button" onClick={() => { if (current()) setConfirmClear(false); }}>保留记录</button></div>}
      <MechanicalEnergyTapeHistory records={records} />
    </div>
    {recovery && <MeasurementRecoveryPanel records={recovery.records} definition={definition} reviewToken={recovery.reviewToken} writable={recordWritable} onExport={() => { if (current()) archive.exportRecoveryCsv(); }} onRecover={recoverReadings} kind="manual" excludedCount={recovery.excludedCount} onExportBackup={() => { if (current()) archive.exportRecoveryBackup(); }} />}
  </section>;
}

export function MechanicalEnergyTapeOverview({ points, indexA, indexB }: { points: MechanicalEnergyTapePoint[]; indexA: number | null; indexB: number | null }) {
  const x = (positionMm: number) => 30 + positionMm / 2000 * 660;
  return <svg className="hs-energy-tape" viewBox="0 0 720 116" role="img" aria-label={`已生成${points.length}个等时纸带点；位置零点在左，A和B由下方点号控件选择。总览固定范围0至2000毫米。`}><rect x="30" y="35" width="660" height="35" rx="2" fill="#f0dfb9" stroke="#c5b38f" /><path d="M30 80H690" stroke="#849173" />{[0, 500, 1000, 1500, 2000].map((position) => <g key={position}><path d={`M${x(position)} 80v6`} stroke="#849173" /><text x={x(position)} y="103" textAnchor="middle">{position}</text></g>)}{points.map((point) => <g key={point.index} data-tape-point={point.index}><circle cx={x(point.positionMm)} cy="52" r={point.index === indexA || point.index === indexB ? 3.8 : 2.1} fill={point.index === indexB ? '#af6438' : '#3f5d42'} />{(point.index === indexA || point.index === indexB) && <><path d={`M${x(point.positionMm)} 24V45`} stroke="#a5643d" /><text x={x(point.positionMm)} y="18" textAnchor="middle">{point.index === indexA ? 'A' : 'B'} · {point.index}</text></>}</g>)}<text x="690" y="18" textAnchor="end">位置 / mm</text></svg>;
}
export function MechanicalEnergyTapeRuler({ point, label }: { point: MechanicalEnergyTapePoint; label: string }) {
  const ruler = tapeRulerGeometry(point.positionMm);
  return <svg className="hs-energy-ruler" viewBox="0 0 360 102" role="img" aria-label={`${label}，${point.index}号点的局部放大毫米尺，每小格0.1毫米。圆点中心为待读位置。`}><rect x="20" y="10" width="320" height="30" fill="#efdfbc" stroke="#cfbd97" /><circle cx={ruler.pointX} cy="25" r="3.5" fill="#4b664c" /><path d={`M${ruler.pointX} 30V48`} stroke="#b76c40" strokeDasharray="2 2" /><path d="M24 48H336" stroke="#728566" />{ruler.ticks.map((tick) => <g key={tick.positionMm}><path d={`M${tick.x} 48v${tick.major ? 17 : tick.half ? 11 : 6}`} stroke="#728566" strokeWidth={tick.major ? 1 : .65} />{tick.major && <text x={tick.x} y="84" textAnchor="middle">{tick.positionMm}</text>}</g>)}<text x="336" y="100" textAnchor="end">mm</text></svg>;
}
function MechanicalEnergyTapeHistory({ records }: { records: ManualMeasurementRecord[] }) {
  if (!records.length) return <p className="hs-manual-history-empty">还没有纸带手动读数。播放、选点并自己读尺后，再保存这一组。</p>;
  return <div className="hs-table-scroll" tabIndex={0} aria-label="纸带手动读数记录，可横向滚动"><table><thead><tr><th scope="col">序号</th><th scope="col">中心点号</th><th scope="col">六个原始位置 / mm</th><th scope="col">按手读计算</th><th scope="col">当时条件</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><th scope="row">{index + 1}</th><td>A {record.manual.readings.indexA}<br />B {record.manual.readings.indexB}</td><td><dl className="hs-manual-history-values">{readingFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{formatMeasurement(record.manual.readings[field.key], 1)}</dd></div>)}</dl></td><td><dl className="hs-manual-history-values">{record.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMeasurement(metric.value, 5)} {metric.unit}</dd></div>)}</dl></td><td><details><summary>查看条件与说明</summary><p>质量 {formatMeasurement(record.parameters.mass)} kg；释放高度 {formatMeasurement(record.parameters.dropHeight)} m；恒定阻力/重力 {formatMeasurement(record.parameters.resistanceRatio)}。记录时刻 {formatMeasurement(record.timeSeconds, 3)} s。</p><p>来源：虚拟纸带手动读数；量化间隔 {record.manual.resolution.value} {record.manual.resolution.unit}。</p><ul>{[...record.manual.assumptions, ...record.manual.warnings].map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul></details></td></tr>)}</tbody></table></div>;
}
