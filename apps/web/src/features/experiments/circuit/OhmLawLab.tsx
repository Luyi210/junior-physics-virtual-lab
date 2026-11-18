import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { analyzeProportionalEvidence, analyzeInvariantEvidence } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { LockKeyhole, Cable, CheckCircle2, Gauge, Save, ClipboardList } from "lucide-react";

type OhmMode = "voltage" | "resistance";

interface OhmReading { id: number; mode: OhmMode; voltage: number; resistance: number; current: number; }

export function OhmLawLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<OhmMode>("voltage");
  const [voltage, setVoltage] = useState(10);
  const [resistance, setResistance] = useState(20);
  const [connected, setConnected] = useState<string[]>([]);
  const [closed, setClosed] = useState(false);
  const [ammeterRange, setAmmeterRange] = useState<.6 | 3>(3);
  const [largeRangeTrialDone, setLargeRangeTrialDone] = useState(false);
  const [readings, setReadings] = useState<OhmReading[]>([]);
  const fullyConnected = ["ammeter", "voltmeter", "resistor"].every((item) => connected.includes(item));
  const current = closed && fullyConnected ? voltage / resistance : 0;
  const overloaded = current > ammeterRange;
  const validReading = closed && fullyConnected && !overloaded;
  const formalReading = validReading && largeRangeTrialDone && ammeterRange === .6;
  const voltageReadings = readings.filter((row) => row.mode === "voltage");
  const resistanceReadings = readings.filter((row) => row.mode === "resistance");
  const modeReadings = readings.filter((row) => row.mode === mode);
  const voltageEvidence = analyzeProportionalEvidence(voltageReadings.map((row) => ({ x: row.voltage, y: row.current })));
  const resistanceEvidence = analyzeInvariantEvidence(resistanceReadings.map((row) => row.current * row.resistance));
  const relationReady = mode === "voltage" ? voltageEvidence.proportional : resistanceEvidence.stable;
  const ohmEvidenceReady = voltageEvidence.proportional && resistanceEvidence.stable;
  const selectMode = (next: OhmMode) => {
    setMode(next); setClosed(false); setAmmeterRange(3); setLargeRangeTrialDone(false);
    if (next === "voltage") { setResistance(20); setVoltage(10); } else { setVoltage(6); setResistance(10); }
    recordHarness("configuration.changed", { experiment: "circuit-ohm", control: "研究任务", value: next === "voltage" ? "I与U关系" : "I与R关系" });
  };
  const toggleConnection = (part: string) => {
    setClosed(false); setAmmeterRange(3); setLargeRangeTrialDone(false); setConnected((items) => items.includes(part) ? items.filter((item) => item !== part) : [...items, part]);
    recordHarness("configuration.changed", { experiment: "circuit-ohm", control: "电路接线", value: part });
  };
  const save = () => {
    if (!formalReading) return;
    const duplicate = readings.some((row) => row.mode === mode && row.voltage === voltage && row.resistance === resistance);
    if (duplicate) return;
    const row = { id: Date.now(), mode, voltage, resistance, current };
    setReadings((items) => [...items, row].slice(-8));
    recordHarness("configuration.changed", { experiment: "circuit-ohm", control: "记录电表示数", value: `${voltage}V/${resistance}Ω/${current.toFixed(2)}A` });
  };
  useEffect(() => {
    const issues = overloaded ? ["电流超过当前电流表量程，应立即断开开关并换大量程。"] : ohmEvidenceReady ? [] : relationReady ? [mode === "voltage" ? "I-U 任务已完成，请切换到 I-R 任务继续测量。" : "I-R 任务已完成，请切换到 I-U 任务继续测量。"] : !fullyConnected ? [`还需接入 ${3 - connected.length} 个关键元件。`] : !largeRangeTrialDone ? ["先选0～3 A大量程短暂闭合试触，再断开开关换小量程。"] : ammeterRange !== .6 ? ["大量程试触安全；断开开关并换0～0.6 A量程，提高读数精度。"] : !closed ? ["量程检查完成，可以闭合开关正式测量。"] : modeReadings.length < 3 ? ["改变自变量并记录至少3组有效数据。"] : [mode === "voltage" ? "检查三组I/U是否近似相等。" : "检查三组I·R是否近似相等。"];
    publishApparatusSnapshot({ module: "circuit-ohm", capturedAt: new Date().toISOString(), origin: connected.length || readings.length ? "learner" : "system", controls: [
      { id: "mode", label: "研究任务", value: mode === "voltage" ? "电流与电压" : "电流与电阻", source: "control" }, { id: "voltage", label: "导体两端电压", value: voltage, unit: "V", source: "control" }, { id: "resistance", label: "导体电阻", value: resistance, unit: "Ω", source: "control" }, { id: "ammeter-range", label: "电流表量程", value: ammeterRange, unit: "A", source: "control" }
    ], apparatus: [
      { id: "fully-connected", label: "电路接线完整", value: fullyConnected, source: "apparatus" }, { id: "switch", label: "开关闭合", value: closed, source: "apparatus" }, { id: "large-range-trial", label: "大量程试触已完成", value: largeRangeTrialDone, source: "apparatus" }, { id: "saved", label: "已记录数据", value: readings.length, unit: "组", source: "apparatus" }
    ], readings: [
      { id: "ammeter", label: formalReading ? "小量程正式电流示数" : "试触电流示数", value: validReading ? current : null, unit: "A", source: "reading" }, { id: "voltmeter", label: "电压表示数", value: validReading ? voltage : null, unit: "V", source: "reading" }
    ], derived: [
      { id: "relation", label: "控制变量", value: mode === "voltage" ? `保持R=${resistance}Ω不变` : `保持U=${voltage}V不变`, source: "model" },
      { id: "voltage-evidence", label: "I-U正比证据", value: voltageEvidence.proportional, source: "model" },
      { id: "resistance-evidence", label: "I-R反比证据", value: resistanceEvidence.stable, source: "model" }
    ], validity: { ready: ohmEvidenceReady && !overloaded, issues } });
  }, [ammeterRange, closed, connected.length, current, formalReading, fullyConnected, largeRangeTrialDone, mode, modeReadings.length, ohmEvidenceReady, overloaded, relationReady, resistance, resistanceEvidence.stable, validReading, voltage, voltageEvidence.proportional]);
  const variableOptions = mode === "voltage" ? [2, 4, 6, 8, 10] : [10, 15, 20, 30, 40];
  const toggleOhmCircuit = () => {
    if (closed) { setClosed(false); return; }
    setClosed(true);
    if (ammeterRange === 3) {
      setLargeRangeTrialDone(true);
      recordHarness("configuration.changed", { experiment: "circuit-ohm", control: "电流表大量程试触", value: `${(voltage/resistance).toFixed(2)}A/0～3A` });
    }
  };
  return <LabFrame field="circuit" experiment="circuit-ohm" eyebrow="OHM LAW WORKBENCH / 欧姆定律实训台" title="先接对电表，再让三组数据说出 I、U、R 的关系" description="选择研究任务后，平台会锁定控制量。电流表串联、电压表并联；先用0～3 A量程短暂试触，确认安全后断电换0～0.6 A量程正式读数。每改变一次自变量，读取并保存一组 U、I、R 数据。" running={closed} onToggle={toggleOhmCircuit} playLabel={largeRangeTrialDone&&ammeterRange===.6?"闭合开关正式测量":"闭合开关试触"} runningLabel="断开开关" actionDisabled={!fullyConnected} disabledLabel={`还差 ${3 - connected.length} 个元件`}>
    <div className="ohm-task-tabs"><button className={`${mode === "voltage" ? "active " : ""}${voltageEvidence.proportional ? "done" : ""}`} onClick={() => selectMode("voltage")}><b>{voltageEvidence.proportional?"✓ 已完成":"任务 01"}</b><span>研究 I 与 U<small>保持导体电阻不变 · {voltageReadings.length}/3组</small></span></button><button className={`${mode === "resistance" ? "active " : ""}${resistanceEvidence.stable ? "done" : ""}`} onClick={() => selectMode("resistance")}><b>{resistanceEvidence.stable?"✓ 已完成":"任务 02"}</b><span>研究 I 与 R<small>保持导体两端电压不变 · {resistanceReadings.length}/3组</small></span></button></div>
    <div className={`ohm-lab-sim ${fullyConnected ? "wired" : "wiring"} ${closed ? "powered" : ""} ${overloaded ? "overloaded" : ""}`}>
      <div className="ohm-control-lock"><LockKeyhole size={15} /><span><small>CONTROL VARIABLE / 控制变量</small><strong>{mode === "voltage" ? `导体电阻锁定为 ${resistance} Ω` : `导体两端电压锁定为 ${voltage} V`}</strong></span></div>
      <svg viewBox="0 0 900 430" aria-label="欧姆定律实验电路"><path className="ohm-wire main" d="M105 215 H235 M335 215 H445 M555 215 H765 M830 215 V350 H105 V215"/><path className="ohm-wire parallel" d="M445 215 V95 H555 V215"/><g className="ohm-source"><rect x="65" y="255" width="80" height="66" rx="7"/><text x="105" y="282">电源</text><text x="105" y="303">{voltage} V</text></g>{([{id:"ammeter",label:"电流表串联"},{id:"resistor",label:"定值电阻"},{id:"voltmeter",label:"电压表并联"}] as const).map((part)=>part.id==="ammeter"?<g className={`ohm-component ammeter ${connected.includes(part.id) ? "connected" : "missing"}`} role="button" tabIndex={0} aria-label={`${connected.includes(part.id)?"断开":"接入"}${part.label}`} onClick={() => toggleConnection(part.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleConnection(part.id);}}} key={part.id}><circle cx="285" cy="215" r="49"/><text x="285" y="208">A</text><text x="285" y="233">{validReading ? current.toFixed(2) : "— —"}</text></g>:part.id==="resistor"?<g className={`ohm-component resistor ${connected.includes(part.id) ? "connected" : "missing"}`} role="button" tabIndex={0} aria-label={`${connected.includes(part.id)?"断开":"接入"}${part.label}`} onClick={() => toggleConnection(part.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleConnection(part.id);}}} key={part.id}><rect x="445" y="190" width="110" height="50" rx="7"/><path d="M458 215 l10 -12 14 24 14 -24 14 24 14 -24 14 12"/><text x="500" y="267">R = {resistance} Ω</text></g>:<g className={`ohm-component voltmeter ${connected.includes(part.id) ? "connected" : "missing"}`} role="button" tabIndex={0} aria-label={`${connected.includes(part.id)?"断开":"接入"}${part.label}`} onClick={() => toggleConnection(part.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleConnection(part.id);}}} key={part.id}><circle cx="500" cy="95" r="47"/><text x="500" y="89">V</text><text x="500" y="114">{validReading ? voltage.toFixed(1) : "— —"}</text></g>)}<g className={`ohm-switch ${closed ? "closed" : ""}`}><circle cx="765" cy="215" r="7"/><circle cx="830" cy="215" r="7"/><line x1="765" y1="215" x2={closed ? 830 : 817} y2={closed ? 215 : 178}/><text x="798" y="250">{closed ? "闭合" : "断开"}</text></g>{validReading && Array.from({ length: 14 }, (_, index) => <circle className="ohm-current-dot" cx={125 + index * 45} cy="350" r="3" style={{ animationDelay: `${-index * .12}s`, animationDuration: `${Math.max(.7,2-current)}s` }} key={index}/>)}</svg>
      <div className="ohm-connection-dock"><span><Cable size={17} /><b>点击元件完成接入</b><small>{connected.length}/3</small></span>{[{ id: "ammeter", label: "电流表串联" },{ id: "voltmeter", label: "电压表并联" },{ id: "resistor", label: "定值电阻" }].map((item) => <button className={connected.includes(item.id) ? "done" : ""} onClick={() => toggleConnection(item.id)} key={item.id}>{connected.includes(item.id) ? <CheckCircle2 size={15}/> : <Cable size={15}/>} {item.label}</button>)}</div>
      <div className={`ohm-safety-readout ${overloaded ? "danger" : formalReading ? "valid" : largeRangeTrialDone ? "trial-done" : ""}`}><Gauge size={19}/><span><small>{overloaded ? "RANGE OVERLOAD / 量程超限" : formalReading ? "FORMAL READING / 小量程正式读数" : "RANGE TRIAL / 量程试触"}</small><strong>{overloaded ? "立即断开开关，换用 0～3 A 量程" : validReading ? ammeterRange===3 ? `大量程试触 I≈${current.toFixed(2)} A；断电后换小量程` : `U = ${voltage.toFixed(1)} V　I = ${current.toFixed(2)} A` : !fullyConnected ? "先完成三个关键元件的接入" : !largeRangeTrialDone ? "先保持0～3 A量程，短暂闭合试触" : ammeterRange===3 ? "试触已完成，断电换0～0.6 A量程" : "量程检查完成，等待正式测量"}</strong></span><div><button className={ammeterRange === .6 ? "active" : ""} disabled={!largeRangeTrialDone} onClick={() => { setClosed(false); setAmmeterRange(.6); }}>0～0.6 A 精确量程</button><button className={ammeterRange === 3 ? "active" : ""} onClick={() => { setClosed(false); setAmmeterRange(3); }}>0～3 A 试触量程</button></div></div>
    </div>
    <div className="ohm-variable-console"><header><span>{mode === "voltage" ? "改变导体两端电压 U" : "更换定值电阻 R"}</span><small>{mode === "voltage" ? `R = ${resistance} Ω 保持不变` : `U = ${voltage} V 保持不变`}</small></header><div>{variableOptions.map((value) => <button className={(mode === "voltage" ? voltage : resistance) === value ? "active" : ""} onClick={() => { setClosed(false); if (mode === "voltage") setVoltage(value); else setResistance(value); }} key={value}>{value} {mode === "voltage" ? "V" : "Ω"}</button>)}</div><button disabled={!formalReading || readings.some((row) => row.mode === mode && row.voltage === voltage && row.resistance === resistance)} onClick={save}><Save size={15}/>记录小量程正式示数</button></div>
    <div className={`ohm-evidence-panel ${modeReadings.length ? "" : "empty"}`}><section><header><span><ClipboardList size={17}/><b>实验数据表</b></span><small>{modeReadings.length}/3 组最低证据</small></header>{modeReadings.length ? <div><b>组次</b><b>U / V</b><b>R / Ω</b><b>I / A</b>{modeReadings.map((row,index) => <div className="ohm-reading-row" key={row.id}><span>{index+1}</span><strong>{row.voltage.toFixed(1)}</strong><span>{row.resistance}</span><strong>{row.current.toFixed(2)}</strong></div>)}</div> : <p>闭合开关并保存第一组读数，再改变自变量继续测量。</p>}</section><aside><svg viewBox="0 0 300 170"><line x1="30" y1="145" x2="285" y2="145"/><line x1="30" y1="15" x2="30" y2="145"/>{modeReadings.map((row) => { const xValue=mode === "voltage" ? row.voltage/10 : row.resistance/40; const yValue=row.current/Math.max(.01,Math.max(...modeReadings.map(item=>item.current))); return <circle cx={30+xValue*235} cy={140-yValue*112} r="6" key={row.id}/>; })}<text x="245" y="164">{mode === "voltage" ? "U / V" : "R / Ω"}</text><text x="3" y="18">I / A</text></svg><strong>{relationReady ? mode === "voltage" ? "三组 I/U 近似不变：在电阻一定时，I 与 U 成正比。" : "三组 I·R 近似不变：在电压一定时，I 随 R 增大而减小。" : "记录至少 3 组，并检验比值或乘积是否稳定。"}</strong></aside></div>
    {modeReadings.length > 0 && !relationReady && <EvidenceVerdict valid={false} title="目前还不能仅凭这些数据下结论" detail={mode === "voltage" ? voltageEvidence.enoughPoints ? `I/U 的最大相对偏差为 ${((voltageEvidence.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%。` : `还需测量 ${3 - voltageEvidence.distinctXCount} 个不同电压点。` : resistanceEvidence.enoughPoints ? `I·R 的最大相对偏差为 ${((resistanceEvidence.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%。` : `还需测量 ${3 - resistanceEvidence.pointCount} 个不同电阻点。`} />}
    {relationReady&&<EvidenceVerdict valid={ohmEvidenceReady} title={ohmEvidenceReady?"欧姆定律两项探究均已完成":"本项规律成立，还需完成另一项探究"} detail={ohmEvidenceReady?"I-U 正比与 I-R 反比均获得至少三组数据支持。":mode==="voltage"?"切换到任务02，在电压不变时测量至少三个不同电阻。":"切换到任务01，在电阻不变时测量至少三个不同电压。"}/>}
  </LabFrame>;
}
