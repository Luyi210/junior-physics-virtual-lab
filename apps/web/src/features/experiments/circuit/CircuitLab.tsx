import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { calculateTwoLoadCircuit, calculateProtectedShortCircuit } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, ScienceRange, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Cable, Unplug, RotateCcw, Power, BatteryCharging, Gauge, CircuitBoard, Lightbulb, Shield, ClipboardList, Save } from "lucide-react";
import { circuitFaultEvidenceText, circuitFaultMatchesConditions, createCircuitFaultEvidence, sameCircuitConditions, type CircuitConditions, type CircuitFaultEvidence, type CircuitOperatingSetup } from "./circuitFaultEvidence";

type CircuitTopology = "series" | "parallel";

type CircuitTerminal = "battery-plus" | "battery-minus" | "switch-in" | "switch-out" | "lamp1-in" | "lamp1-out" | "lamp2-in" | "lamp2-out";

interface CircuitWirePlan {
  id: string;
  terminals: [CircuitTerminal, CircuitTerminal];
  path: string;
  branch: "main" | "lamp1" | "lamp2";
}

const circuitLayouts: Record<CircuitTopology, Record<CircuitTerminal, [number, number]>> = {
  series: {
    "battery-plus": [110, 125], "battery-minus": [110, 370],
    "switch-in": [245, 125], "switch-out": [345, 125],
    "lamp1-in": [455, 125], "lamp1-out": [585, 125],
    "lamp2-in": [700, 125], "lamp2-out": [830, 125]
  },
  parallel: {
    "battery-plus": [110, 125], "battery-minus": [110, 370],
    "switch-in": [245, 125], "switch-out": [345, 125],
    "lamp1-in": [500, 205], "lamp1-out": [650, 205],
    "lamp2-in": [500, 320], "lamp2-out": [650, 320]
  }
};

const circuitWirePlans: Record<CircuitTopology, CircuitWirePlan[]> = {
  series: [
    { id: "series-source", terminals: ["battery-plus", "switch-in"], path: "M110 125 H245", branch: "main" },
    { id: "series-switch-l1", terminals: ["switch-out", "lamp1-in"], path: "M345 125 H455", branch: "main" },
    { id: "series-l1-l2", terminals: ["lamp1-out", "lamp2-in"], path: "M585 125 H700", branch: "main" },
    { id: "series-return", terminals: ["lamp2-out", "battery-minus"], path: "M830 125 V370 H110", branch: "main" }
  ],
  parallel: [
    { id: "parallel-source", terminals: ["battery-plus", "switch-in"], path: "M110 125 H245", branch: "main" },
    { id: "parallel-l1-in", terminals: ["switch-out", "lamp1-in"], path: "M345 125 H420 V205 H500", branch: "lamp1" },
    { id: "parallel-l2-in", terminals: ["switch-out", "lamp2-in"], path: "M345 125 H420 V320 H500", branch: "lamp2" },
    { id: "parallel-l1-return", terminals: ["lamp1-out", "battery-minus"], path: "M650 205 H800 V370 H110", branch: "lamp1" },
    { id: "parallel-l2-return", terminals: ["lamp2-out", "battery-minus"], path: "M650 320 H760 V370 H110", branch: "lamp2" }
  ]
};

interface CircuitEvidence extends CircuitConditions { id: number; totalCurrent: number; voltage1: number; voltage2: number; }

export function CircuitLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [topology, setTopology] = useState<CircuitTopology>("series");
  const [voltage, setVoltage] = useState(9);
  const [r1, setR1] = useState(20);
  const [r2, setR2] = useState(10);
  const [closed, setClosed] = useState(false);
  const [connectedWires, setConnectedWires] = useState<string[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<CircuitTerminal>();
  const [lamp1Connected, setLamp1Connected] = useState(true);
  const [lamp2Connected, setLamp2Connected] = useState(true);
  const [hasPowered, setHasPowered] = useState(false);
  const [evidence, setEvidence] = useState<CircuitEvidence[]>([]);
  const [faultEvidence, setFaultEvidence] = useState<Partial<Record<CircuitTopology, CircuitFaultEvidence>>>({});
  const [shortInstalled,setShortInstalled]=useState(false);
  const [fuseTripped,setFuseTripped]=useState(false);
  const [shortObserved,setShortObserved]=useState(false);
  const [notice, setNotice] = useState("先点击一个接线柱，再点击另一个接线柱连接导线。");
  const plans = circuitWirePlans[topology];
  const layout = circuitLayouts[topology];
  const fullyWired = plans.every((wire) => connectedWires.includes(wire.id));
  const circuit = calculateTwoLoadCircuit(topology, voltage, r1, r2, closed && fullyWired, lamp1Connected, lamp2Connected);
  const [current1, current2] = circuit.branchCurrents;
  const [power1, power2] = circuit.loadPowers;
  const [voltage1, voltage2] = circuit.loadVoltages;
  const seriesConditions: CircuitConditions = { topology: "series", voltage, r1, r2 };
  const parallelConditions: CircuitConditions = { topology: "parallel", voltage, r1, r2 };
  const seriesEvidence = evidence.find((row) => sameCircuitConditions(row, seriesConditions));
  const parallelEvidence = evidence.find((row) => sameCircuitConditions(row, parallelConditions));
  const seriesFault = circuitFaultMatchesConditions(faultEvidence.series, seriesConditions) ? faultEvidence.series : undefined;
  const parallelFault = circuitFaultMatchesConditions(faultEvidence.parallel, parallelConditions) ? faultEvidence.parallel : undefined;
  const currentFault = topology === "series" ? seriesFault : parallelFault;
  const circuitComparisonReady = Boolean(seriesEvidence && parallelEvidence && seriesFault && parallelFault);
  const canToggleShortWire = !closed && (shortInstalled || (!fuseTripped && circuitComparisonReady));
  const shortCircuit=calculateProtectedShortCircuit(9);
  const trainingSourceActive = shortInstalled || fuseTripped;
  const displayedSourceVoltage = trainingSourceActive ? 9 : voltage;
  const circuitLearningReady=circuitComparisonReady&&shortObserved&&!shortInstalled&&!fuseTripped;
  const terminalNames: Record<CircuitTerminal, string> = {
    "battery-plus": "电源正极", "battery-minus": "电源负极", "switch-in": "开关左端", "switch-out": "开关右端",
    "lamp1-in": "灯泡 L₁ 左端", "lamp1-out": "灯泡 L₁ 右端", "lamp2-in": "灯泡 L₂ 左端", "lamp2-out": "灯泡 L₂ 右端"
  };

  useEffect(() => {
    const issues = circuitLearningReady ? [] : !circuitComparisonReady ? !fullyWired
      ? [`电路还差 ${plans.length - connectedWires.length} 根导线。`]
      : !closed ? ["接线完整，但总开关仍断开。"]
        : !circuit.energized ? ["回路中存在断路，当前没有电流。"]
          : !evidence.some((row) => row.topology === topology) ? [`保存${topology === "series" ? "串联" : "并联"}正常工作读数。`]
            : !currentFault ? ["先让两灯都正常发光，再保持通电旋松一只灯泡，观察另一只灯泡。"]
              : ["切换另一种连接方式，重复接线、测量与断路测试。"] : !shortObserved?["断开开关后安装保护短路线，再合闸观察保险熔断。"]:["拆除短路线并复位保险。"];
    publishApparatusSnapshot({
      module: "circuit-basic",
      capturedAt: new Date().toISOString(),
      origin: connectedWires.length > 0 || topology !== "series" || hasPowered || voltage !== 9 || r1 !== 20 || r2 !== 10 ? "learner" : "system",
      controls: [
        { id: "topology", label: "连接方式", value: topology === "series" ? "串联" : "并联", source: "control" },
        { id: "voltage", label: "正常电路设定电压", value: voltage, unit: "V", source: "control" },
        { id: "active-supply-voltage", label: trainingSourceActive ? "当前9V保护训练源" : "当前电源电压", value: displayedSourceVoltage, unit: "V", source: "control" },
        { id: "resistance1", label: "L₁电阻", value: r1, unit: "Ω", source: "control" },
        { id: "resistance2", label: "L₂电阻", value: r2, unit: "Ω", source: "control" }
      ],
      apparatus: [
        { id: "connected-wires", label: "已接导线", value: connectedWires.length, unit: "根", source: "apparatus" },
        { id: "required-wires", label: "所需导线", value: plans.length, unit: "根", source: "apparatus" },
        { id: "fully-wired", label: "回路接线完整", value: fullyWired, source: "apparatus" },
        { id: "switch-closed", label: "总开关闭合", value: closed, source: "apparatus" },
        { id: "lamp1-connected", label: "L₁接通", value: lamp1Connected, source: "apparatus" },
        { id: "lamp2-connected", label: "L₂接通", value: lamp2Connected, source: "apparatus" }, { id:"short-wire",label:"开关后跨接负载的短路线已安装",value:shortInstalled,source:"apparatus" }, { id:"fuse",label:"保险已熔断",value:fuseTripped,source:"apparatus" }, { id:"training-source",label:"正在使用9V保护训练源",value:trainingSourceActive,source:"apparatus" }
      ],
      readings: [
        { id: "total-current", label: "干路电流", value: fuseTripped?0:circuit.totalCurrent, unit: "A", source: "reading" }, { id:"short-prospective",label:"短路预期电流",value:shortObserved?shortCircuit.prospectiveCurrent:null,unit:"A",source:"reading" },
        { id: "current1", label: topology === "series" ? "L₁电流" : "支路I₁", value: current1, unit: "A", source: "reading" },
        { id: "current2", label: topology === "series" ? "L₂电流" : "支路I₂", value: current2, unit: "A", source: "reading" }
      ],
      derived: [
        { id: "equivalent-resistance", label: "等效电阻", value: Number.isFinite(circuit.equivalentResistance) ? circuit.equivalentResistance : "∞", unit: "Ω", source: "model" },
        { id: "energized", label: "回路有电流", value: circuit.energized, source: "model" },
        { id: "notice", label: "接线提示", value: notice, source: "model" },
        { id: "topology-comparison", label: "串并联对照证据齐全", value: circuitComparisonReady, source: "model" },
        { id: "series-fault-observation", label: "已保存的串联断路观察", value: seriesFault ? circuitFaultEvidenceText(seriesFault) : "尚未形成有效观察", source: "model" },
        { id: "parallel-fault-observation", label: "已保存的并联断路观察", value: parallelFault ? circuitFaultEvidenceText(parallelFault) : "尚未形成有效观察", source: "model" },
        { id:"short-safety",label:"短路与熔断保护已观察",value:shortObserved,source:"model" }
      ],
      validity: { ready: circuitLearningReady, issues }
    });
  }, [circuit.energized, circuit.equivalentResistance, circuit.totalCurrent, circuitComparisonReady, circuitLearningReady, closed, connectedWires, current1, current2, currentFault, displayedSourceVoltage, evidence, fullyWired, fuseTripped, hasPowered, lamp1Connected, lamp2Connected, notice, parallelFault, plans.length, r1, r2, seriesFault, shortCircuit.prospectiveCurrent, shortInstalled, shortObserved, topology, trainingSourceActive, voltage]);

  const resetWiring = (nextTopology = topology) => {
    setTopology(nextTopology);
    setConnectedWires([]);
    setSelectedTerminal(undefined);
    setClosed(false);
    setHasPowered(false);
    setLamp1Connected(true);
    setLamp2Connected(true);
    setShortInstalled(false);setFuseTripped(false);
    setNotice(`已切换到${nextTopology === "series" ? "串联" : "并联"}任务，请从电源正极开始接线。`);
  };
  const selectTopology = (next: CircuitTopology) => {
    resetWiring(next);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: "接线任务", value: next === "series" ? "串联" : "并联" });
  };
  const selectTerminal = (terminal: CircuitTerminal) => {
    if (!selectedTerminal) {
      setSelectedTerminal(terminal);
      setNotice(`已选中${terminalNames[terminal]}，再选择另一个接线柱。`);
      return;
    }
    if (selectedTerminal === terminal) {
      setSelectedTerminal(undefined);
      setNotice("已取消选择。请重新选择两个接线柱。");
      return;
    }
    const wire = plans.find((item) => item.terminals.includes(selectedTerminal) && item.terminals.includes(terminal));
    setSelectedTerminal(undefined);
    if (!wire) {
      setNotice(`不能直接连接${terminalNames[selectedTerminal]}和${terminalNames[terminal]}，请沿完整回路重新判断。`);
      recordHarness("configuration.changed", { experiment: "circuit-basic", control: "接线尝试", value: "不符合当前任务" });
      return;
    }
    if (connectedWires.includes(wire.id)) {
      setNotice("这根导线已经连接，不需要重复接线。");
      return;
    }
    const next = [...connectedWires, wire.id];
    setConnectedWires(next);
    setNotice(next.length === plans.length ? "接线完成。现在可以合上总开关观察电流。" : `导线已接好，还差 ${plans.length - next.length} 根。`);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: "连接导线", value: wire.id, connected: next.length, required: plans.length });
  };
  const toggleCircuit = () => {
    if (!fullyWired) {
      setNotice(`电路还没有完整连接，还差 ${plans.length - connectedWires.length} 根导线。`);
      return;
    }
    if(fuseTripped){setNotice("保险已熔断。先断电、拆除短路线，再复位保险。");return;}
    if(!closed&&shortInstalled){setClosed(false);setFuseTripped(true);setShortObserved(true);setHasPowered(true);setNotice(`短路保护动作：预期 ${shortCircuit.prospectiveCurrent.toFixed(2)} A，超过5 A额定值 ${shortCircuit.overloadMultiple.toFixed(2)} 倍，保险已熔断。`);recordHarness("configuration.changed",{experiment:"circuit-basic",control:"短路保护",value:`${shortCircuit.prospectiveCurrent.toFixed(2)}A/保险熔断`});return;}
    setClosed((value) => !value);
    if (!closed) {
      setHasPowered(true);
      setNotice("总开关已闭合。现在旋松一个灯泡，比较另外一个灯泡是否继续发光。");
    } else setNotice("总开关已断开，可以安全调整接线或灯泡。");
  };
  const toggleShortWire=()=>{if(!canToggleShortWire)return;setShortInstalled(value=>!value);setNotice(shortInstalled?fuseTripped?"保护短路线已拆除。现在可以更换保险并复位。":"保护短路线已拆除，已恢复正常电源设定。":"已切换9V保护训练源，在总开关后跨接负载；开关断开时无电流，合闸将使电源短路并触发保护。");};
  const resetFuse=()=>{if(closed||shortInstalled)return;setFuseTripped(false);setHasPowered(false);setNotice("保险已复位，电路恢复可用。");};
  const toggleLamp = (lamp: 1 | 2) => {
    const wasConnected = lamp === 1 ? lamp1Connected : lamp2Connected;
    const before: CircuitOperatingSetup = { topology, voltage, r1, r2, closed, fullyWired, lamp1Connected, lamp2Connected, shortInstalled, fuseTripped };
    const after = { ...before, lamp1Connected: lamp === 1 ? !lamp1Connected : lamp1Connected, lamp2Connected: lamp === 2 ? !lamp2Connected : lamp2Connected };
    const observation = createCircuitFaultEvidence(Date.now(), before, after, lamp);
    if (observation) setFaultEvidence((current) => ({ ...current, [topology]: observation }));
    if (lamp === 1) setLamp1Connected((value) => !value);
    else setLamp2Connected((value) => !value);
    setHasPowered((value) => value || closed);
    setNotice(observation ? circuitFaultEvidenceText(observation) : `${lamp === 1 ? "L₁" : "L₂"} 已${wasConnected ? "旋松形成断路。本次未计入断路对照：需先让两灯正常发光，再只旋松其中一灯" : "重新旋紧接入电路；两灯都正常发光后可进行断路观察"}。`);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: lamp === 1 ? "灯泡 L₁" : "灯泡 L₂", value: wasConnected ? "断路" : "接通", validFaultObservation: Boolean(observation) });
  };
  const saveCircuitEvidence = () => {
    if (!closed || !fullyWired || !lamp1Connected || !lamp2Connected || !circuit.energized) return;
    const row = { id: Date.now(), topology, voltage, r1, r2, totalCurrent: circuit.totalCurrent, voltage1, voltage2 };
    setEvidence((rows) => [...rows.filter((item) => item.topology !== topology), row]);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: "保存拓扑读数", value: `${topology}/${circuit.totalCurrent.toFixed(2)}A` });
  };
  const wireIsActive = (wire: CircuitWirePlan) => circuit.energized && (wire.branch === "main" || wire.branch === "lamp1" && current1 > 0 || wire.branch === "lamp2" && current2 > 0);
  const renderTerminal = (terminal: CircuitTerminal) => {
    const [x, y] = layout[terminal];
    return <g className={`circuit-terminal ${selectedTerminal === terminal ? "selected" : ""}`} role="button" tabIndex={0} aria-label={terminalNames[terminal]} onClick={(event) => { event.stopPropagation(); selectTerminal(terminal); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectTerminal(terminal); } }} key={terminal}><circle cx={x} cy={y} r="12" /><circle cx={x} cy={y} r="4" /></g>;
  };

  return <LabFrame field="circuit" experiment="circuit-basic" eyebrow="CIRCUIT WIRING BENCH / 交互接线台" title="亲手接通电路，再让断路与短路告诉你安全边界" description="逐根连接串联、并联电路并旋松灯泡测试断路；完成正常证据后，切换9V保护训练源，在总开关之后用导线跨接所有负载；开关断开时无电流，合闸后才形成电源短路。短路模型计入电源内阻并立即熔断保险，随后需拆线、复位；正常电路的电压设定与记录保留。灯泡按定值电阻等效。" running={closed} onToggle={toggleCircuit} playLabel={fuseTripped?"保险已熔断":"合上总开关"} runningLabel="断开总开关" actionDisabled={!fullyWired||fuseTripped} disabledLabel={fuseTripped?"先排除短路并复位保险":`还差 ${plans.length - connectedWires.length} 根导线`}>
    <div className="topology-tabs circuit-task-tabs"><button className={topology === "series" ? "active" : ""} onClick={() => selectTopology("series")}><b>任务 01</b><span>串联接线<small>一条连续路径</small></span></button><button className={topology === "parallel" ? "active" : ""} onClick={() => selectTopology("parallel")}><b>任务 02</b><span>并联接线<small>两条独立支路</small></span></button></div>
    <div className={`circuit-sim circuit-wiring-bench ${topology} ${closed ? "closed" : "open"} ${fullyWired ? "wired" : "wiring"} ${shortInstalled?"short-installed":""} ${fuseTripped?"fuse-tripped":""}`} style={{ "--current-speed": `${Math.max(.55, 2.15 - circuit.totalCurrent * .5)}s` } as React.CSSProperties}>
      <div className="circuit-bench-toolbar"><span><Cable size={16} /><b>接线进度</b><strong>{connectedWires.length} / {plans.length}</strong></span><div><button onClick={() => { setConnectedWires((items) => items.slice(0, -1)); setClosed(false); setNotice("已撤下最后一根导线。"); }} disabled={connectedWires.length === 0||shortInstalled||fuseTripped}><Unplug size={14} />撤下最后一根</button><button onClick={() => resetWiring()}><RotateCcw size={14} />全部复位</button></div></div>
      <svg viewBox="0 0 960 500" aria-label={`${topology === "series" ? "串联" : "并联"}电路交互接线板`}>
        <defs><filter id="lampGlow"><feGaussianBlur stdDeviation="9" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter><pattern id="benchDots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#34505a" /></pattern></defs>
        <rect className="circuit-board-surface" x="28" y="36" width="904" height="394" rx="18" fill="url(#benchDots)" />
        {plans.map((wire) => connectedWires.includes(wire.id) ? <g className={`bench-wire-group ${wireIsActive(wire) ? "active" : ""}`} key={wire.id}><path className="bench-wire-shadow" d={wire.path} /><path className="bench-wire" d={wire.path} /><path className="bench-current" d={wire.path} /></g> : <path className="bench-wire-guide" d={wire.path} key={wire.id} />)}
        <g className="bench-battery"><rect x="67" y="180" width="86" height="135" rx="9" /><rect x="79" y="194" width="62" height="107" rx="5" /><text x="110" y="228">{trainingSourceActive?"9V保护训练源":"直流电源"}</text><text className="battery-reading" x="110" y="266">{displayedSourceVoltage.toFixed(1)} V</text><text className="polarity plus" x="110" y="113">＋</text><text className="polarity minus" x="110" y="402">−</text></g>
        {shortInstalled&&<g className="bench-short-wire"><path d="M345 125 V55 H900 V370 H110"/><text x="720" y="74">开关后短接负载</text></g>}
        <g className={`bench-fuse ${fuseTripped?"tripped":""}`}><rect x="80" y="329" width="60" height="23" rx="5"/><line x1="89" y1="340" x2="131" y2="340"/><text x="110" y="369">5 A 保险</text></g>
        <g className={`bench-switch ${closed ? "is-closed" : ""}`} role="button" tabIndex={0} aria-label={closed?"断开电路总开关":"闭合电路总开关"} onClick={toggleCircuit} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleCircuit();}}}><rect x="234" y="73" width="122" height="104" rx="10" /><line x1="257" y1="125" x2={closed ? 333 : 319} y2={closed ? 125 : 89} /><circle cx="257" cy="125" r="7" /><circle cx="333" cy="125" r="7" /><text x="295" y="162">{closed ? "总开关 · 闭合" : "总开关 · 断开"}</text></g>
        {[1, 2].map((lampNumber) => { const lampTerminal = `lamp${lampNumber}-in` as CircuitTerminal; const otherTerminal = `lamp${lampNumber}-out` as CircuitTerminal; const [leftX, y] = layout[lampTerminal]; const [rightX] = layout[otherTerminal]; const centerX = (leftX + rightX) / 2; const connected = lampNumber === 1 ? lamp1Connected : lamp2Connected; const active = lampNumber === 1 ? current1 > 0 : current2 > 0; const resistance = lampNumber === 1 ? r1 : r2; const power = lampNumber === 1 ? power1 : power2; return <g className={`bench-lamp ${active ? "lit" : ""} ${connected ? "seated" : "loose"}`} role="button" tabIndex={0} aria-label={`${connected?"旋松":"旋紧"}灯泡 L${lampNumber}`} onClick={() => toggleLamp(lampNumber as 1 | 2)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleLamp(lampNumber as 1|2);}}} transform={`translate(${centerX} ${y})`} key={lampNumber}><circle className="lamp-aura" r={34 + Math.min(16, power * 3)} style={{ opacity: active ? Math.min(.82, .25 + power / 8) : 0 }} /><circle className="lamp-glass" r="34" /><path className="lamp-filament" d="M-17 5 L-9 -7 L0 7 L9 -7 L17 5" /><rect x="-24" y="31" width="48" height="19" rx="4" /><text y="-47">L{lampNumber} · {resistance} Ω</text><text className="lamp-action" y="67">{connected ? "点击旋松" : "已断路 · 点击旋紧"}</text></g>; })}
        {(Object.keys(layout) as CircuitTerminal[]).map(renderTerminal)}
        {topology === "parallel" && <><circle className="junction-dot" cx="420" cy="125" r="6" /><text className="branch-label" x="436" y="187">支路 1</text><text className="branch-label" x="436" y="302">支路 2</text></>}
      </svg>
      <div className={`circuit-guidance ${selectedTerminal ? "selecting" : ""} ${fuseTripped?"danger":""}`}><Power size={17} /><span><small>{fuseTripped?"PROTECTION TRIPPED / 保护动作":fullyWired ? closed ? "电路正在工作" : "接线完整，等待合闸" : `接线步骤 · 还差 ${plans.length - connectedWires.length} 根`}</small><strong>{notice}</strong></span></div>
      <div className={`circuit-live-readouts ${hasPowered ? "" : "awaiting-reading"} ${fuseTripped?"danger":""}`}><div><BatteryCharging size={17} /><span>{fuseTripped?"短路预期电流":"干路电流"}<strong>{fuseTripped?`${shortCircuit.prospectiveCurrent.toFixed(2)} A → 0`:hasPowered ? `${circuit.totalCurrent.toFixed(2)} A` : "— —"}</strong></span></div><div><Gauge size={17} /><span>{fuseTripped?"过载倍数":topology === "series" ? "L₁ / L₂ 电流" : "支路 I₁ / I₂"}<strong>{fuseTripped?`${shortCircuit.overloadMultiple.toFixed(2)} ×`:hasPowered ? `${current1.toFixed(2)} / ${current2.toFixed(2)} A` : "— —"}</strong></span></div><div><CircuitBoard size={17} /><span>保护状态<strong>{fuseTripped?"保险已熔断":hasPowered ? Number.isFinite(circuit.equivalentResistance) ? `${circuit.equivalentResistance.toFixed(1)} Ω` : "断路 ∞" : "等待通电"}</strong></span></div><div className="circuit-conclusion"><Lightbulb size={17} /><span>当前现象<strong>{fuseTripped?"短路被切断，灯泡不亮":!hasPowered ? "等待通电观察" : circuit.energized ? topology === "parallel" && (!lamp1Connected || !lamp2Connected) ? "另一支路仍可工作" : "电路中有电流" : "电路断路，灯泡熄灭"}</strong></span></div></div>
    </div>
    <div className="science-controls circuit-controls"><ScienceRange label="电源电压" value={voltage} min={1.5} max={12} step={.5} unit="V" onChange={(value) => { setVoltage(value); setEvidence([]); setFaultEvidence({}); }} /><ScienceRange label="灯泡 L₁ 电阻" value={r1} min={5} max={40} step={1} unit="Ω" onChange={(value) => { setR1(value); setEvidence([]); setFaultEvidence({}); }} /><ScienceRange label="灯泡 L₂ 电阻" value={r2} min={5} max={40} step={1} unit="Ω" onChange={(value) => { setR2(value); setEvidence([]); setFaultEvidence({}); }} /></div>
    <section className={`circuit-short-safety ${shortObserved?"observed":""} ${fuseTripped?"tripped":""}`}><header><span><Shield size={17}/><b>PROTECTED SHORT-CIRCUIT DRILL / 9V受保护短路演练</b></span><small>{shortObserved?"安全边界已观察":"完成串并联对照后进行"}</small></header><div><article><span>正常工作电流</span><strong>{circuit.totalCurrent.toFixed(2)} A</strong><small>用电器限制电流</small></article><article><span>9V训练源短路预期电流</span><strong>{shortObserved?`${shortCircuit.prospectiveCurrent.toFixed(2)} A`:"待演练"}</strong><small>只由0.8Ω电源内阻限制，禁止真实课堂直接操作</small></article><article><span>5 A 保险</span><strong>{fuseTripped?"已熔断":shortObserved?"已复位":"完好"}</strong><small>异常大电流出现时迅速切断回路</small></article></div><div className="circuit-short-actions"><button className={shortInstalled?"danger":""} disabled={!canToggleShortWire} onClick={toggleShortWire}>{shortInstalled?<><Unplug size={14}/>拆除短路线</>:<><Cable size={14}/>安装保护短路线</>}</button><button disabled={closed||shortInstalled||!fuseTripped} onClick={resetFuse}><RotateCcw size={14}/>更换保险并复位</button></div>{shortObserved&&<EvidenceVerdict valid={!shortInstalled&&!fuseTripped} title={!shortInstalled&&!fuseTripped?"已排除短路并恢复安全状态":"保护已动作：按顺序完成断电、拆线、复位"} detail={`9V训练源在开关后短接负载并合闸时，预期电流 ${shortCircuit.prospectiveCurrent.toFixed(2)} A，是5 A额定值的 ${shortCircuit.overloadMultiple.toFixed(2)} 倍；保护装置切断电路，防止导线和电源持续过热。`}/>}</section>
    <section className="circuit-comparison-ledger"><header><span><ClipboardList size={16} /><b>串联—并联对照证据</b></span><button disabled={!closed || !fullyWired || !lamp1Connected || !lamp2Connected || (topology === "series" ? Boolean(seriesEvidence) : Boolean(parallelEvidence))} onClick={saveCircuitEvidence}><Save size={14} />保存当前正常读数</button></header><div>{(["series", "parallel"] as const).map((kind) => { const row = kind === "series" ? seriesEvidence : parallelEvidence; const fault = kind === "series" ? seriesFault : parallelFault; return <article className={row && fault ? "complete" : ""} key={kind}><b>{kind === "series" ? "串联" : "并联"}</b><strong>{row ? `I总 ${row.totalCurrent.toFixed(2)} A` : "等待正常读数"}</strong><span>{row ? `U₁/U₂ ${row.voltage1.toFixed(1)}/${row.voltage2.toFixed(1)} V` : "接好并闭合开关"}</span><em>{fault ? circuitFaultEvidenceText(fault) : "还需在两灯正常发光时旋松一灯，保存有效断路观察"}</em></article>; })}</div></section>
    {(evidence.length > 0 || seriesFault || parallelFault) && <EvidenceVerdict valid={circuitLearningReady} title={circuitLearningReady ? "串并联、断路与短路安全证据均已完成" : circuitComparisonReady?"串并联对照已完成，还需受保护短路演练":"当前只完成了部分拓扑证据"} detail={circuitComparisonReady && seriesEvidence && parallelEvidence ? `同电源、同灯泡下，并联干路电流 ${parallelEvidence.totalCurrent.toFixed(2)} A，串联干路电流 ${seriesEvidence.totalCurrent.toFixed(2)} A；并联支路互不影响，串联断路使全电路停止。${shortObserved?"短路会产生异常大电流并触发保险熔断。":"接下来断电安装保护短路线，观察保险动作。"}` : "每种连接方式都要保存正常读数，并在两灯正常发光时旋松一只灯泡，核对另一只灯泡的电流变化。"} />}
  </LabFrame>;
}
