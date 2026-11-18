import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect, useReducer } from "react";
import { analyzeControlledComparison, analyzeTargetVariableComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, FactorEvidenceStatus, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { BatteryCharging, TimerReset, Power, Save, Shield, ClipboardList } from "lucide-react";
import { createPowerLabState, powerAppliances, powerLabInstrumentSnapshot, powerLabLiveState, powerLabReducer, savablePowerMeasurement, type PowerApplianceKey, type PowerInstrument } from "./powerLabState";

interface PowerEvidence { id:number; appliance:string; voltage:number; current:number; power:number; seconds:number; energy:number; state:string; }

export function ElectricPowerLab() {
  const recordHarness=useHarnessStore(state=>state.record);
  const [run, dispatch] = useReducer(powerLabReducer, undefined, createPowerLabState);
  const { applianceKey, voltage, duration, connected } = run.configuration;
  const [prediction,setPrediction]=useState<"smaller"|"same"|"larger">();
  const [evidence,setEvidence]=useState<PowerEvidence[]>([]);
  const [overvoltageLockObserved,setOvervoltageLockObserved]=useState(false);
  const live = powerLabLiveState(run);
  const { appliance, fullyConnected, unsafe, stateLabel } = live;
  const predictionResult = live.prediction;
  const powered = live.conducting;
  const elapsed = run.elapsed;
  const completed = run.phase === "completed";
  const measurement = savablePowerMeasurement(run);
  const validRun = Boolean(measurement);
  const powerPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.appliance,evidence[1]!.voltage,evidence[1]!.seconds],[evidence[0]!.appliance,evidence[0]!.voltage,evidence[0]!.seconds],evidence[1]!.energy,evidence[0]!.energy,.001):undefined;
  const powerComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,voltage:analyzeTargetVariableComparison([older.appliance,older.voltage,older.seconds],[newer.appliance,newer.voltage,newer.seconds],older.power,newer.power,1,1.5,"same-direction",.001),time:analyzeTargetVariableComparison([older.appliance,older.voltage,older.seconds],[newer.appliance,newer.voltage,newer.seconds],older.energy,newer.energy,2,10,"same-direction",.001)}))),[evidence]);
  const voltagePowerEvidence=powerComparisons.find(item=>item.voltage.validTargetComparison);
  const timeEnergyEvidence=powerComparisons.find(item=>item.time.validTargetComparison);
  const powerEvidenceReady=Boolean(voltagePowerEvidence&&timeEnergyEvidence);
  const powerLearningReady=powerEvidenceReady&&overvoltageLockObserved&&!unsafe;
  const powerPredictionMatched=Boolean(prediction==="smaller"&&voltagePowerEvidence);
  const powerConclusion=powerEvidenceReady?{valid:true,title:"P=UI 与 W=Pt 两条证据均已建立",detail:`同一用电器、相同时间下，电压越高实际功率越大；同一用电器、相同电压下，工作时间越长消耗电能越多。${powerPredictionMatched?"低电压预测与证据一致。":"请依据电压对照核对预测。"}`} : voltagePowerEvidence?{valid:false,title:"电压—功率证据已完成，还缺时间—电能证据",detail:"保持同一用电器和相同电压，改换至少相差 10 s 的工作时间，再保存一组。"}:timeEnergyEvidence?{valid:false,title:"时间—电能证据已完成，还缺电压—功率证据",detail:"保持同一用电器和相同工作时间，让安全电压至少变化 1.5 V，再保存一组。"}:!powerPair?undefined:!powerPair.valid?{valid:false,title:"最近两组不是公平比较",detail:"用电器、电压和时间中有多个条件同时变化，无法判断是哪一个因素造成差异。"}:{valid:false,title:"形成了一组单变量比较，但尚未覆盖核心任务",detail:"需要分别完成‘改变电压比较功率’和‘改变时间比较电能’两类对照；只换用电器不计入完成证据。"};
  useEffect(() => {
    if (!powered) return;
    const timer = window.setInterval(() => dispatch({ type: "tick", seconds: 2 }), 200);
    return () => window.clearInterval(timer);
  }, [powered]);
  const toggleConnection = (part: PowerInstrument) => {
    dispatch({ type: "connection", instrument: part });
    recordHarness("configuration.changed", { experiment: "circuit-power", control: "仪表接线", value: part });
  };
  const changeAppliance = (key: PowerApplianceKey) => dispatch({ type: "appliance", key });
  const save = () => {
    if (!measurement) return;
    const row: PowerEvidence = { id: Date.now(), appliance: measurement.appliance, voltage: measurement.voltage, current: measurement.current, power: measurement.power, seconds: measurement.seconds, energy: measurement.energy, state: measurement.state };
    setEvidence(items => [row, ...items.filter(item => item.appliance !== row.appliance || item.voltage !== row.voltage || item.seconds !== row.seconds)].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "circuit-power", control: "保存电功率测量", value: `${row.appliance}/${row.voltage}V/${row.power.toFixed(2)}W/${row.energy.toFixed(1)}J` });
  };
  useEffect(() => {
    const issues = unsafe ? ["已观察过压锁定；把电源电压恢复到额定值或安全欠压。"] : powerLearningReady ? [] : powerEvidenceReady && !overvoltageLockObserved ? ["双证据已完成；选择7.5 V观察铭牌过压保护，再恢复安全电压。"] : !fullyConnected ? [`还需正确接入 ${3-connected.length} 个测量仪表。`] : !completed ? [run.phase === "paused" ? "开关已断开，累计电能保留；再次闭合可继续本轮计时，尚不能保存正式测量。" : "选择工作时间并闭合开关，等待计时结束。"] : evidence.length < 2 ? ["本轮完成快照可保存；实时仪表已因自动断开归零。保存基准后，固定用电器分别研究电压和工作时间。"] : !voltagePowerEvidence ? ["还缺电压—功率证据：固定用电器和时间，只改变安全电压。"] : ["还缺时间—电能证据：固定用电器和电压，只改变工作时间。"];
    const telemetry = powerLabInstrumentSnapshot(run);
    publishApparatusSnapshot({
      module: "circuit-power", capturedAt: new Date().toISOString(),
      origin: connected.length || elapsed || evidence.length || overvoltageLockObserved ? "learner" : "system",
      controls: [
        { id: "appliance", label: "被测用电器", value: appliance.label, source: "control" },
        { id: "rated", label: "铭牌", value: `${appliance.ratedVoltage}V ${appliance.ratedPower}W`, source: "control" },
        { id: "voltage", label: "电源设定电压（不是开路时的负载电压）", value: voltage, unit: "V", source: "control" },
        { id: "duration", label: "设定工作时间", value: duration, unit: "s", source: "control" },
        { id: "prediction", label: "低于额定电压的功率预测", value: prediction === "smaller" ? "更小" : prediction === "same" ? "不变" : prediction === "larger" ? "更大" : "未选择", source: "control" }
      ],
      apparatus: [
        { id: "ammeter", label: "电流表串联", value: connected.includes("ammeter"), source: "apparatus" },
        { id: "voltmeter", label: "电压表并联负载两端", value: connected.includes("voltmeter"), source: "apparatus" },
        { id: "energy", label: "电能计时器接入", value: connected.includes("energy"), source: "apparatus" },
        { id: "switch", label: "开关闭合且实际通电", value: powered, source: "apparatus" },
        { id: "overvoltage-lock", label: "过压锁定已观察", value: overvoltageLockObserved, source: "apparatus" }
      ],
      readings: telemetry.readings,
      derived: [
        ...telemetry.derived,
        { id: "formula", label: "功率与电能", value: "P=UI；恒定条件下W=Pt；断开后实时I、P归零而本轮累计W保留", source: "model" },
        { id: "boundary", label: "模型边界", value: "按铭牌等效为定值电阻；真实灯丝电阻会随温度变化。电压表跨接负载，开关在负载外串联。", source: "model" },
        { id: "latest-comparison", label: "最近两组公平比较", value: powerPair?.valid ?? false, source: "model" },
        { id: "voltage-power", label: "电压—功率证据", value: Boolean(voltagePowerEvidence), source: "model" },
        { id: "time-energy", label: "时间—电能证据", value: Boolean(timeEnergyEvidence), source: "model" }
      ], validity: { ready: powerLearningReady, issues }
    });
  }, [run, appliance, completed, connected, duration, elapsed, evidence.length, fullyConnected, overvoltageLockObserved, powerEvidenceReady, powerLearningReady, powerPair?.valid, powered, prediction, timeEnergyEvidence, unsafe, voltage, voltagePowerEvidence]);
  const startToggle = () => {
    if (!fullyConnected || unsafe) return;
    dispatch({ type: "toggle" });
    recordHarness("simulation.toggled", { experiment: "circuit-power", running: !powered, action: powered ? "断开并保留本轮累计电能" : completed ? "开始新一轮电能计时" : "闭合开关继续计时" });
  };
  return <LabFrame field="circuit" experiment="circuit-power" eyebrow="POWER & ENERGY BENCH / 电功率与电能台" title="先读铭牌、正确接表，再让计时器记录用电快慢" description="电流表串联、电压表并联，电能计时器按10倍速演示累计 W=Pt；开关断开后实时读数归零、累计电能保留。改变电源电压比较功率，但超过额定电压 10% 时保护装置禁止通电。调整条件会重置本轮计时，已存证据保留。当前模型把用电器等效为定值电阻，真实灯丝还会受温度影响。" running={powered} onToggle={startToggle} playLabel="闭合开关并开始计时" runningLabel="断开开关" actionDisabled={!fullyConnected||unsafe} disabledLabel={!fullyConnected?`还差 ${3-connected.length} 个仪表`:"过压保护已锁定"}>
    <div className="power-inquiry-console"><section><span><b>01</b>读铭牌</span><strong>{appliance.label} · {appliance.ratedVoltage} V / {appliance.ratedPower} W</strong><small>额定值描述正常工作条件，不等于任何电压下的实际值。</small></section><section><span><b>02</b>先作预测</span><p>实际电压低于额定电压，实际功率会怎样？</p><div>{(["smaller","same","larger"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="smaller"?"更小":value==="same"?"不变":"更大"}</button>)}</div></section><section><span><b>03</b>安全边界</span><strong className={unsafe?"danger":""}>{stateLabel}</strong><small>换接用电器或调整电压前，必须先断开开关。</small></section></div>
    <div className={`power-lab-rig ${fullyConnected?"wired":""} ${powered?"powered":""} ${completed?"completed":""} ${unsafe?"unsafe":""}`} style={{"--power-level":Math.min(1,live.power/4),"--voltage-position":`${Math.min(100,predictionResult.voltageRatio/1.35*100)}%`,"--energy-progress":`${Math.min(100,elapsed/duration*100)}%`} as React.CSSProperties}>
      <div className="power-procedure-strip">{["识读铭牌","连接电流表","并联电压表","设定电压","计时运行","保存证据"].map((label,index)=>{const stage=!connected.includes("ammeter")?1:!connected.includes("voltmeter")?2:!fullyConnected?2:!elapsed?3:powered?4:completed?5:4;return <span className={index<stage?"done":index===stage?"active":""} key={label}><b>{index<stage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="power-supply-unit"><BatteryCharging size={27}/><span><small>DC SUPPLY / 学生电源</small><strong>{voltage.toFixed(1)} V</strong></span><i className={powered?"live":""}/></div>
      <svg className="power-circuit-board" viewBox="0 0 800 340" aria-label="电功率测量电路"><path className="power-wire main" d="M100 255V225 M100 205V170H245 M345 170H470 M610 170H710V255H415 M345 255H100"/><path className="power-wire parallel" d="M470 170 V70 H610 V170"/><g aria-label={`电源与串联开关，当前${powered?"闭合":"断开"}`}><path d="M85 205H115M92 225H108" stroke="#96b0b3" strokeWidth="3"/><circle cx="345" cy="255" r="4" fill="#96b0b3"/><circle cx="415" cy="255" r="4" fill="#96b0b3"/><path d={powered?"M345 255H415":"M345 255L404 230"} stroke="#96b0b3" strokeWidth="3"/><text x="380" y="283" fill="#96b0b3" fontSize="11" textAnchor="middle">开关 S</text></g><g className={`power-meter amp ${connected.includes("ammeter")?"connected":"missing"}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("ammeter")?"断开":"接入"}电流表`} onClick={()=>{if(!powered)toggleConnection("ammeter");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("ammeter");}}}><circle cx="295" cy="170" r="48"/><text x="295" y="164">A</text><text x="295" y="190">{live.ammeter === null ? "—" : live.ammeter.toFixed(2)}</text></g><g className={`power-load load-${applianceKey}`}><rect x="470" y="140" width="140" height="60" rx="8"/><text x="540" y="165">{appliance.symbol}</text><text x="540" y="187">{appliance.ratedVoltage}V / {appliance.ratedPower}W</text></g><g className={`power-meter volt ${connected.includes("voltmeter")?"connected":"missing"}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("voltmeter")?"断开":"接入"}电压表`} onClick={()=>{if(!powered)toggleConnection("voltmeter");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("voltmeter");}}}><circle cx="540" cy="70" r="45"/><text x="540" y="65">V</text><text x="540" y="90">{live.voltmeter === null ? "—" : live.voltmeter.toFixed(1)}</text></g>{powered&&Array.from({length:12},(_,index)=><circle className="power-current-dot" cx={125+index*48} cy="255" r="3" style={{animationDelay:`${-index*.11}s`}} key={index}/>)}</svg>
      <div className={`power-nameplate state-${predictionResult.operatingState}`}><span><small>NAMEPLATE / 铭牌比对</small><strong>{appliance.ratedVoltage} V　{appliance.ratedPower} W</strong></span><div><i/><b>U源 / U额 = {predictionResult.voltageRatio.toFixed(2)}</b></div><em>{stateLabel}</em></div>
      <div className="power-meter-bank"><article><small>实时电流 A</small><strong>{live.ammeter === null ? "— —" : live.ammeter.toFixed(2)} A</strong><i className={connected.includes("ammeter")?"ok":""}/></article><article><small>负载端实时电压 V</small><strong>{live.voltmeter === null ? "— —" : live.voltmeter.toFixed(1)} V</strong><i className={connected.includes("voltmeter")?"ok":""}/></article><article><small>实时功率 P=UI</small><strong>{live.wattmeter === null ? "— —" : live.wattmeter.toFixed(2)} W</strong><i className={fullyConnected?"ok":""}/></article></div>
      <div className={`power-energy-meter ${connected.includes("energy")?"connected":""}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("energy")?"断开":"接入"}电能计时器`} onClick={()=>{if(!powered)toggleConnection("energy");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("energy");}}}><header><TimerReset size={18}/><span><small>ENERGY COUNTER / 仿真电能计时器</small><strong>{elapsed.toFixed(0)} / {duration} s</strong></span></header><output>{connected.includes("energy")?run.energyJoules.toFixed(1):"— —"}<small> J</small></output><div><i/></div><footer>累计 W（断开后保留） · {run.energyKilowattHours.toFixed(6)} kW·h</footer></div>
      <div className={`power-live-result ${validRun?"valid":""} ${unsafe?"danger":""}`}><Power size={21}/><span><small>LIVE POWER / 实时功率</small><strong>{unsafe?"过压保护：禁止闭合开关":fullyConnected?`P = ${live.loadVoltage.toFixed(1)} × ${live.current.toFixed(2)} = ${live.power.toFixed(2)} W`:"先完成三项仪表接线"}</strong><em>{measurement?`本轮${measurement.seconds}s测量已锁存：${measurement.power.toFixed(2)}W，${measurement.energy.toFixed(1)}J；断开后实时仪表归零。`:run.phase==="paused"?"开关已断开，电能保留；再次闭合可继续本轮计时。":"运行后同时记录实时功率和本轮累计电能。"}</em></span></div>
      {!fullyConnected&&<InteractionCue text="点击虚线电表或下方接线按钮，完成测量电路"/>}
    </div>
    <div className="power-operation-dock"><section><span>选择用电器</span><div>{(Object.keys(powerAppliances) as PowerApplianceKey[]).map(key=><button className={applianceKey===key?"active":""} disabled={powered} onClick={()=>changeAppliance(key)} key={key}><strong>{powerAppliances[key].label}</strong><small>{powerAppliances[key].ratedVoltage}V/{powerAppliances[key].ratedPower}W</small></button>)}</div></section><section><span>连接测量仪表</span><div>{[{id:"ammeter",label:"电流表串联"},{id:"voltmeter",label:"电压表并联"},{id:"energy",label:"电能计时器"}].map(item=><button className={connected.includes(item.id as PowerInstrument)?"done":""} disabled={powered} onClick={()=>toggleConnection(item.id as PowerInstrument)} key={item.id}>{connected.includes(item.id as PowerInstrument)?"✓ ":"＋ "}{item.label}</button>)}</div></section><section><span>电源设定电压</span><div>{[3,4.5,6,7.5].map(value=><button className={voltage===value?"active":""} disabled={powered} onClick={()=>{dispatch({type:"voltage",value});if(value>appliance.ratedVoltage*1.1){setOvervoltageLockObserved(true);recordHarness("configuration.changed",{experiment:"circuit-power",control:"过压保护锁定",value:`${value}V>${appliance.ratedVoltage}V额定`});}}} key={value}>{value} V</button>)}</div></section><section><span>工作时间</span><div>{[10,30,60].map(value=><button className={duration===value?"active":""} disabled={powered} onClick={()=>{dispatch({type:"duration",value});}} key={value}>{value} s</button>)}</div></section><aside><span>本轮完成快照</span><strong>{measurement?`${measurement.power.toFixed(2)}W · ${measurement.energy.toFixed(1)}J`:"计时完成后保存"}</strong><button disabled={!validRun} onClick={save}><Save size={15}/>保存测量</button></aside></div>
    <section className={`power-safety-proof ${overvoltageLockObserved?"observed":""} ${unsafe?"locked":""}`}><Shield size={18}/><span><small>NAMEPLATE SAFETY PROOF / 铭牌安全证据</small><strong>{unsafe?`7.5 V 超过 ${appliance.ratedVoltage} V 额定值10%，开关已锁定`:overvoltageLockObserved?"过压锁定已观察，当前已恢复安全电压":"完成双证据后，主动选择7.5 V观察保护锁定"}</strong><em>只观察保护状态，不允许真实通电；完成后必须恢复到6 V或更低。</em></span><b>{overvoltageLockObserved&&!unsafe?"SAFE RECOVERED":unsafe?"LOCKED":"PENDING"}</b></section>
    <div className={`power-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>电功率与电能双证据</b></span><small>{powerLearningReady?"公式证据与安全恢复均已完成":powerEvidenceReady?"两条公式证据已建立，还需安全诊断":`已保存 ${evidence.length} 组`}</small></header><FactorEvidenceStatus className="power-evidence-status" items={[{label:"电压 → 功率",note:"固定用电器与时间",done:Boolean(voltagePowerEvidence)},{label:"时间 → 电能",note:"固定用电器与电压",done:Boolean(timeEnergyEvidence)}]}/>{evidence.length?<div><b>组次</b><b>用电器</b><b>U/V</b><b>I/A</b><b>P/W</b><b>t/s</b><b>W/J</b>{evidence.map((row,index)=><div className="power-evidence-row" key={row.id}><span>{evidence.length-index}</span><strong>{row.appliance}</strong><span>{row.voltage.toFixed(1)}</span><span>{row.current.toFixed(2)}</span><strong>{row.power.toFixed(2)}</strong><span>{row.seconds}</span><strong>{row.energy.toFixed(1)}</strong></div>)}</div>:<p>先保存基准，再分别完成“只改变电压比较功率”和“只改变时间比较电能”。</p>}{powerConclusion&&<EvidenceVerdict valid={powerLearningReady} title={powerLearningReady?"P=UI、W=Pt与铭牌安全证据全部完成":powerEvidenceReady?"两条公式证据已完成，还需观察并恢复过压保护":powerConclusion.title} detail={powerLearningReady?`${powerConclusion.detail} 7.5 V过压锁定已观察并恢复到安全工作状态。`:powerEvidenceReady?"选择7.5 V观察保护锁定，不要通电；随后恢复到6 V或更低。":powerConclusion.detail}/>}</div>
  </LabFrame>;
}
