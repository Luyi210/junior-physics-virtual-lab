import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect } from "react";
import { calculateFrictionRegime, analyzeControlledComparison } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, FactorEvidenceStatus, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Focus, Activity, Save, ClipboardList, RotateCcw } from "lucide-react";

const frictionSurfaces = {
  glass: { label: "玻璃板", note: "光滑", coefficient: .12 },
  wood: { label: "木板", note: "中等粗糙", coefficient: .25 },
  towel: { label: "毛巾", note: "较粗糙", coefficient: .42 }
} as const;

type FrictionSurface = keyof typeof frictionSurfaces;

interface FrictionEvidence { id: number; surface: FrictionSurface; normal: number; friction: number; }

export function FrictionLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [surface, setSurface] = useState<FrictionSurface>("wood");
  const [addedWeights, setAddedWeights] = useState<number[]>([]);
  const [pullForce, setPullForce] = useState(2);
  const [zeroed, setZeroed] = useState(false);
  const [running, setRunning] = useState(false);
  const [hasSlid, setHasSlid] = useState(false);
  const [breakawayForce, setBreakawayForce] = useState<number>();
  const [prediction, setPrediction] = useState<"larger" | "same" | "smaller">();
  const [evidence, setEvidence] = useState<FrictionEvidence[]>([]);
  const normalForce = 10 + addedWeights.reduce((total, value) => total + value, 0);
  const frictionForce = normalForce * frictionSurfaces[surface].coefficient;
  const frictionRegime = calculateFrictionRegime(normalForce,frictionSurfaces[surface].coefficient,pullForce,hasSlid);
  const difference = pullForce - frictionForce;
  const uniform = running && hasSlid && frictionRegime.accelerationTrend === "uniform";
  const breakawayObserved = breakawayForce !== undefined;
  const motion = !running ? "静止，等待拉动" : !hasSlid ? `仍静止：静摩擦随拉力增至 ${frictionRegime.frictionForce.toFixed(2)} N` : uniform ? "木块水平匀速运动" : difference > 0 ? "已滑动：拉力偏大，木块正在加速" : "已滑动：拉力偏小，木块将减速停下";
  const pointer = Math.min(20, pullForce);
  const frictionPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.surface,evidence[1]!.normal],[evidence[0]!.surface,evidence[0]!.normal],evidence[1]!.friction,evidence[0]!.friction,.001):undefined;
  const frictionComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,comparison:analyzeControlledComparison([older.surface,older.normal],[newer.surface,newer.normal],older.friction,newer.friction,.001)}))),[evidence]);
  const pressureEvidence=frictionComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===1&&Math.abs(newer.normal-older.normal)>=5&&comparison.outcomeDirection===(newer.normal>older.normal?"increase":"decrease"));
  const surfaceEvidence=frictionComparisons.find(({newer,older,comparison})=>{const roughnessChange=frictionSurfaces[newer.surface].coefficient-frictionSurfaces[older.surface].coefficient;return comparison.valid&&comparison.changedIndexes[0]===0&&roughnessChange!==0&&comparison.outcomeDirection===(roughnessChange>0?"increase":"decrease");});
  const frictionEvidenceReady=Boolean(pressureEvidence&&surfaceEvidence);
  const frictionLearningReady=frictionEvidenceReady&&breakawayObserved;
  const frictionPredictionMatched=Boolean(prediction&&pressureEvidence&&((prediction==="larger"&&pressureEvidence.comparison.outcomeDirection==="increase")||(prediction==="same"&&pressureEvidence.comparison.outcomeDirection==="same")||(prediction==="smaller"&&pressureEvidence.comparison.outcomeDirection==="decrease")));
  const frictionConclusion=frictionLearningReady?{valid:true,title:"静—滑转折与双因素证据均已完成",detail:`起动前静摩擦随拉力增大；突破最大静摩擦后回落为滑动摩擦。固定接触面时，压力增大使滑动摩擦力增大；固定压力时，接触面越粗糙，滑动摩擦力越大。${frictionPredictionMatched?"压力证据与预测一致。":"请依据压力对照核对或修正预测。"}`} : frictionEvidenceReady?{valid:false,title:"双因素证据已完成，还需观察起动瞬间",detail:"停止木块，把拉力降为0后重新开始；逐步增加拉力，记录木块刚开始滑动时的最大静摩擦力。"}:pressureEvidence?{valid:false,title:"压力对照已完成，还缺接触面证据",detail:"选择相同压力，换用另一种粗糙程度的接触面，再调到匀速并保存读数。"}:surfaceEvidence?{valid:false,title:"接触面对照已完成，还缺压力证据",detail:"保持接触面不变，增加至少 5 N 的砝码，再调到匀速并保存读数。"}:!frictionPair?undefined:!frictionPair.valid?{valid:false,title:"最近两组不能形成公平比较",detail:"请固定接触面或压力中的一个，只改变另一个条件。"}:{valid:false,title:`已形成一组${frictionPair.changedIndexes[0]===0?"接触面":"压力"}对照`,detail:"数据趋势需要复核；请确认每组都在木块水平匀速时读数。"};
  useEffect(()=>{if(!running||hasSlid||!frictionRegime.startsSliding)return;setHasSlid(true);setBreakawayForce(frictionRegime.maximumStaticFriction);recordHarness("configuration.changed",{experiment:"mechanics-friction",control:"突破最大静摩擦",value:frictionRegime.maximumStaticFriction.toFixed(2),unit:"N"});},[frictionRegime.maximumStaticFriction,frictionRegime.startsSliding,hasSlid,recordHarness,running]);
  useEffect(() => {
    publishApparatusSnapshot({
      module: "mechanics-friction", capturedAt: new Date().toISOString(), origin: zeroed || running || evidence.length > 0 ? "learner" : "system",
      controls: [
        { id: "surface", label: "接触面材料", value: frictionSurfaces[surface].label, source: "control" },
        { id: "added-weight", label: "木块上增加的重力", value: normalForce - 10, unit: "N", source: "control" },
        { id: "pull-force", label: "水平拉力", value: pullForce, unit: "N", source: "control" },
        { id: "prediction", label: "增大压力后的预测", value: prediction === "larger" ? "摩擦力增大" : prediction === "same" ? "基本不变" : prediction === "smaller" ? "摩擦力减小" : "未选择", source: "control" }
      ],
      apparatus: [
        { id: "gauge-zeroed", label: "弹簧测力计已校零", value: zeroed, source: "apparatus" },
        { id: "pulling", label: "正在水平拉动", value: running, source: "apparatus" }, { id: "sliding", label: "已突破最大静摩擦", value: hasSlid, source: "apparatus" },
        { id: "uniform", label: "木块匀速运动", value: uniform, source: "apparatus" },
        { id: "saved-groups", label: "有效记录", value: evidence.length, unit: "组", source: "apparatus" }
      ],
      readings: [
        { id: "gauge-reading", label: "弹簧测力计示数", value: zeroed ? pullForce : null, unit: "N", source: "reading" },
        { id: "friction", label: hasSlid ? "当前滑动摩擦力" : "当前静摩擦力", value: running ? frictionRegime.frictionForce : null, unit: "N", source: "reading" }, { id: "breakaway", label: "最近一次最大静摩擦力", value: breakawayForce ?? null, unit: "N", source: "reading" },
        { id: "motion", label: "运动状态", value: motion, source: "reading" }
      ],
      derived: [{ id: "model-boundary", label: "模拟说明", value: "静止时静摩擦随拉力变化；滑动后按教学系数模拟；匀速时f滑=F拉", source: "model" }, { id: "static-kinetic", label: "静—滑转折已观察", value: breakawayObserved, source: "model" },{id:"latest-comparison",label:"最近两组公平比较",value:frictionPair?.valid??false,source:"model"},{id:"pressure-evidence",label:"压力因素证据",value:Boolean(pressureEvidence),source:"model"},{id:"surface-evidence",label:"粗糙程度因素证据",value:Boolean(surfaceEvidence),source:"model"}],
      validity: { ready: frictionLearningReady, issues: frictionLearningReady ? [] : !zeroed ? ["实验前先检查弹簧测力计是否归零。"] : running&&!hasSlid ? ["逐步增大拉力，直到木块刚开始滑动。"] : running&&!uniform ? ["木块已启动，适当减小拉力使其保持匀速。"] : evidence.length<2?["保存基准后，先固定接触面改变压力，或固定压力改变接触面。"] : !pressureEvidence?["还缺压力因素证据：固定接触面，让压力至少变化 5 N。"] : !surfaceEvidence?["还缺粗糙程度证据：固定压力，换用另一种接触面。"]:["再完成一次从静止到滑动的起动观察。"] }
    });
  }, [breakawayForce, breakawayObserved, evidence.length, frictionForce, frictionLearningReady, frictionPair?.valid, frictionRegime.frictionForce, hasSlid, motion, normalForce, prediction, pressureEvidence, pullForce, running, surface, surfaceEvidence, uniform, zeroed]);
  const toggleWeight = (value: number) => {
    setRunning(false); setHasSlid(false); setBreakawayForce(undefined); setAddedWeights((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
    recordHarness("configuration.changed", { experiment: "mechanics-friction", control: `${value}N砝码`, value: addedWeights.includes(value) ? "取下" : "加到木块上" });
  };
  const adjustPull = (delta: number) => {
    setPullForce((value) => Number(Math.max(0, Math.min(20, value + delta)).toFixed(2)));
    recordHarness("control.changed", { experiment: "mechanics-friction", control: "水平拉力", step: delta, unit: "N" });
  };
  const save = () => {
    if (!uniform) return;
    const row = { id: Date.now(), surface, normal: normalForce, friction: Number(frictionForce.toFixed(2)) };
    setEvidence((items) => [row, ...items.filter(item=>item.surface!==row.surface||item.normal!==row.normal)].slice(0, 6));
    recordHarness("configuration.changed", { experiment: "mechanics-friction", control: "保存匀速读数", value: `${frictionSurfaces[row.surface].label}/${row.normal}N/${row.friction}N` });
  };
  const reset = () => { setAddedWeights([]); setPullForce(2); setZeroed(false); setRunning(false); setHasSlid(false); setBreakawayForce(undefined); setPrediction(undefined); setEvidence([]); setSurface("wood"); };
  return <LabFrame field="mechanics" experiment="mechanics-friction" eyebrow="FRICTION TEST RIG / 摩擦力测试台" title="先突破静摩擦，再把滑动中的木块调到匀速" description="先给 0～20 N 弹簧测力计校零。拉力较小时木块仍静止，静摩擦力会随拉力增大；突破最大静摩擦后木块开始滑动，随后调小拉力，只有匀速时测力计示数才等于滑动摩擦力。" running={running} onToggle={() => {if(running){setRunning(false);setHasSlid(false);}else{setHasSlid(false);setRunning(true);}}} playLabel="开始水平拉动" runningLabel="停止拉动" actionDisabled={!zeroed} disabledLabel="请先给测力计校零">
    <div className="friction-inquiry-console"><section><span><b>01</b>仪器准备</span><button className={zeroed ? "done" : ""} disabled={zeroed} onClick={() => { setZeroed(true); setPullForce(0); setHasSlid(false); recordHarness("configuration.changed", { experiment: "mechanics-friction", control: "弹簧测力计", value: "校零完成" }); }}><Focus size={15} />{zeroed ? "测力计已归零" : "检查并校零"}</button></section><section><span><b>02</b>实验预测</span><p>接触面不变，增加木块上的砝码，滑动摩擦力会怎样？</p><div>{(["larger", "same", "smaller"] as const).map((value) => <button className={prediction === value ? "active" : ""} onClick={() => setPrediction(value)} key={value}>{value === "larger" ? "增大" : value === "same" ? "基本不变" : "减小"}</button>)}</div></section><section><span><b>03</b>有效条件</span><strong className={uniform ? "valid" : ""}>{uniform ? "匀速成立，可读数" : running&&!hasSlid ? "先突破最大静摩擦" : "滑动后调回匀速"}</strong><small>启动前静摩擦会变化；加速或减速时拉力都不能直接作为滑动摩擦力。</small></section></div>
    <div className={`friction-lab-sim ${running&&hasSlid ? "pulling" : ""} ${running&&!hasSlid?"static-hold":""} ${uniform ? "uniform" : hasSlid&&difference > 0 ? "accelerating" : hasSlid ? "slowing" : ""}`} style={{ "--friction-speed": `${uniform ? 2.4 : difference > 0 ? 1.2 : 4}s`, "--surface-gap": surface === "glass" ? "30px" : surface === "wood" ? "15px" : "7px" } as React.CSSProperties}>
      <div className="friction-procedure"><span className={zeroed ? "done" : "active"}>校零</span><i /><span className={zeroed ? "active" : ""}>选面与加载</span><i /><span className={running&&!hasSlid ? "active" : hasSlid?"done":""}>增力至起动</span><i /><span className={hasSlid&&!uniform ? "active" : uniform?"done":""}>回调至匀速</span><i/><span className={uniform ? "active" : ""}>保存读数</span></div>
      <div className="friction-spring-gauge"><div className="gauge-handle" /><div className="gauge-shell"><span>{Array.from({ length: 11 }, (_, index) => <i className={index % 5 === 0 ? "major" : ""} key={index} />)}</span><b style={{ left: `${8 + pointer / 20 * 82}%` }} /><em>{zeroed ? `${pullForce.toFixed(2)} N / 20 N` : "未校零"}</em></div><div className="gauge-hook" /></div>
      <div className="friction-string" />
      <div className="friction-test-block"><span>木块<small>自重 10 N</small></span>{addedWeights.map((value, index) => <b style={{ bottom: `${68 + index * 25}px` }} key={value}>{value}N</b>)}</div>
      <div className={`friction-test-surface surface-${surface}`}>{Array.from({ length: 34 }, (_, index) => <i key={index} />)}<strong>{frictionSurfaces[surface].label} · {frictionSurfaces[surface].note}</strong></div>
      <div className="friction-force-vectors"><span className="vector-pull" style={{ width: `${40 + pullForce * 10}px` }}>F拉 {pullForce.toFixed(2)} N →</span><span className="vector-friction" style={{ width: `${40 + frictionRegime.frictionForce * 10}px` }}>← {hasSlid?"f滑":"f静"} {running?frictionRegime.frictionForce.toFixed(2):"?"} N</span></div>
      <div className={`friction-motion-readout ${uniform ? "valid" : ""}`}><Activity size={18} /><span><small>MOTION SENSOR / 运动传感</small><strong>{motion}</strong><em>{!running ? "先开始拉动，再用 ±0.05 N 微调" : uniform ? "速度—时间图像为水平线" : difference > 0 ? `拉力比摩擦力趋势值大 ${Math.abs(difference).toFixed(2)} N` : `拉力还差约 ${Math.abs(difference).toFixed(2)} N`}</em></span></div>
      {!zeroed && <InteractionCue text="先检查弹簧测力计指针是否对准零刻度" />}
    </div>
    <section className={`friction-breakaway-console ${breakawayObserved?"observed":""}`}><header><span><Activity size={17}/><b>BREAKAWAY / 静—滑转折观测</b></span><small>{breakawayObserved?"已捕捉一次起动阈值":"开始拉动后逐步增加拉力"}</small></header><div><article><span>当前作用状态</span><strong>{!running?"等待拉动":hasSlid?"滑动摩擦":"静摩擦自适应"}</strong><small>{!hasSlid?"f静与拉力平衡，直到达到上限":"启动后摩擦回落到滑动摩擦值"}</small></article><article><span>最大静摩擦力</span><strong>{breakawayForce!==undefined?`${breakawayForce.toFixed(2)} N`:"待捕捉"}</strong><small>刚开始滑动前的临界值</small></article><article><span>滑动摩擦力</span><strong>{frictionForce.toFixed(2)} N</strong><small>{breakawayForce!==undefined?`比起动阈值低 ${(breakawayForce-frictionForce).toFixed(2)} N`:"启动后再回调拉力"}</small></article></div><div className="friction-threshold-track"><i style={{width:`${Math.min(100,pullForce/frictionRegime.maximumStaticFriction*100)}%`}}/><b style={{left:"80%"}}>起动阈值</b></div></section>
    <div className="friction-operation-dock"><section><header><span>接触面</span><small>每次只选择一种材料</small></header><div>{(Object.keys(frictionSurfaces) as FrictionSurface[]).map((key) => <button className={surface === key ? "active" : ""} onClick={() => { if (key !== surface) { setSurface(key); setRunning(false); setHasSlid(false); setBreakawayForce(undefined); } }} key={key}><strong>{frictionSurfaces[key].label}</strong><small>{frictionSurfaces[key].note}</small></button>)}</div></section><section><header><span>增加压力</span><small>点击砝码取放</small></header><div>{[5, 10, 20].map((value) => <button className={addedWeights.includes(value) ? "active weight" : "weight"} onClick={() => toggleWeight(value)} key={value}><strong>{value}</strong><small>N 砝码</small></button>)}</div></section><section><header><span>微调水平拉力</span><small>{!hasSlid?"先增大到木块启动":"再回调到滑动匀速"}</small></header><div className="friction-force-adjust"><button onClick={() => adjustPull(-.5)}>−0.5</button><button onClick={() => adjustPull(-.05)}>−0.05</button><output>{pullForce.toFixed(2)} N</output><button onClick={() => adjustPull(.05)}>＋0.05</button><button onClick={() => adjustPull(.5)}>＋0.5</button></div></section><aside><span>本组状态</span><strong>{uniform ? `f滑 = ${pullForce.toFixed(2)} N` : motion}</strong><button disabled={!uniform} onClick={save}><Save size={15} />保存有效读数</button></aside></div>
    <div className={`friction-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>摩擦力双因素证据</b></span><div><small>{frictionEvidenceReady?"两条证据链均已建立":`有效数据 ${evidence.length} 组`}</small><button onClick={reset}><RotateCcw size={14} />重新实验</button></div></header><FactorEvidenceStatus className="friction-evidence-status" items={[{label:"压力因素",note:"固定接触面",done:Boolean(pressureEvidence)},{label:"粗糙程度",note:"固定压力",done:Boolean(surfaceEvidence)}]}/>{evidence.length ? <div><b>组次</b><b>接触面</b><b>压力 / N</b><b>匀速拉力 / N</b><b>滑动摩擦力 / N</b>{evidence.map((row, index) => <div className="friction-evidence-row" key={row.id}><span>{evidence.length - index}</span><strong>{frictionSurfaces[row.surface].label}</strong><span>{row.normal.toFixed(0)}</span><span>{row.friction.toFixed(2)}</span><strong>{row.friction.toFixed(2)}</strong></div>)}</div> : <p>达到匀速后保存基准；随后分别完成“固定接触面改变压力”和“固定压力改变接触面”两类对照。</p>}{frictionConclusion&&<EvidenceVerdict valid={frictionConclusion.valid} title={frictionConclusion.title} detail={frictionConclusion.detail}/>}</div>
  </LabFrame>;
}
