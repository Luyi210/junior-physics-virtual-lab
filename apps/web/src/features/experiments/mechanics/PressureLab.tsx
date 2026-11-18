import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo, useEffect } from "react";
import { calculateSolidPressure } from "@physics-lab/physics";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, FactorEvidenceStatus, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Gauge, Save, ClipboardList } from "lucide-react";
import { analyzePressureEvidence, createPressureEvidence, pressureEvidenceVerdict, type PressureEvidence } from "./pressureEvidence";

const pressureFaces = {
  large: { label: "大面朝下", area: 60, width: 190, height: 78 },
  medium: { label: "中面朝下", area: 30, width: 130, height: 112 },
  small: { label: "小面朝下", area: 15, width: 82, height: 155 }
} as const;

type PressureFaceKey = keyof typeof pressureFaces;


export function PressureLab() {
  const recordHarness=useHarnessStore(state=>state.record);
  const [faceKey,setFaceKey]=useState<PressureFaceKey>("large");
  const [weights,setWeights]=useState<number[]>([]);
  const [foamReady,setFoamReady]=useState(false);
  const [pressed,setPressed]=useState(false);
  const [measured,setMeasured]=useState(false);
  const [prediction,setPrediction]=useState<"deeper"|"same"|"shallower">();
  const [evidence,setEvidence]=useState<PressureEvidence[]>([]);
  const face=pressureFaces[faceKey];
  const force=50+weights.reduce((sum,value)=>sum+value,0);
  const result=calculateSolidPressure(force,face.area);
  const analysis=useMemo(()=>analyzePressureEvidence(evidence),[evidence]);
  const {forceEvidence,areaEvidence,ready:pressureEvidenceReady,latest:pressurePair}=analysis;
  const pressureConclusion=pressureEvidenceVerdict(analysis,prediction);
  const resetTrial=()=>{setPressed(false);setMeasured(false);};
  const toggleWeight=(value:number)=>{setWeights(items=>items.includes(value)?items.filter(item=>item!==value):[...items,value]);resetTrial();recordHarness("configuration.changed",{experiment:"mechanics-pressure",control:`${value}N砝码`,value:weights.includes(value)?"取下":"加载"});};
  const save=()=>{if(!measured)return;const row=createPressureEvidence(Date.now(),force,face.area);setEvidence(items=>[row,...items.filter(item=>item.force!==force||item.area!==face.area)].slice(0,8));recordHarness("configuration.changed",{experiment:"mechanics-pressure",control:"保存压强测量",value:`${force}N/${face.area}cm²/${result.pressurePascals}Pa`});};
  useEffect(()=>{const issues=pressureEvidenceReady?[]:analysis.saturationBlocked?["压痕同为18.0 mm已饱和，不能证明更深；请降低载荷或换较大受力面，重做可分辨的单变量对照。"]:!foamReady?["把同一块软质泡沫放到压痕台。"]:!pressed&&!measured&&evidence.length===0?["加载后向下压，使长方体稳定作用于泡沫。"]:pressed&&!measured?["用深度标尺读取压痕比较值。"]:evidence.length<2?["保存基准后，固定面积改变压力或固定压力改变面积。"]:!forceEvidence?["还缺压力因素证据：固定受力面，让压力至少变化 25 N。"]:["还缺面积因素证据：固定压力，让受力面积至少变化 15 cm²。"];publishApparatusSnapshot({module:"mechanics-pressure",capturedAt:new Date().toISOString(),origin:foamReady||pressed||evidence.length?"learner":"system",controls:[{id:"face",label:"长方体受力面",value:face.label,source:"control"},{id:"area",label:"受力面积",value:face.area,unit:"cm²",source:"control"},{id:"weights",label:"附加砝码重力",value:force-50,unit:"N",source:"control"},{id:"prediction",label:"面积减小后的预测",value:prediction==="deeper"?"压痕更深":prediction==="same"?"不变":prediction==="shallower"?"压痕更浅":"未选择",source:"control"}],apparatus:[{id:"foam",label:"泡沫已放置",value:foamReady,source:"apparatus"},{id:"pressed",label:"长方体已稳定压下",value:pressed,source:"apparatus"},{id:"measured",label:"压痕已测量",value:measured,source:"apparatus"}],readings:[{id:"force",label:"对泡沫的压力",value:force,unit:"N",source:"reading"},{id:"pressure",label:"固体压强",value:measured?result.pressurePascals:null,unit:"Pa",source:"reading"},{id:"indentation",label:"同一泡沫压痕比较",value:measured?result.indentationMillimeters:null,unit:"mm",source:"reading"}],derived:[{id:"formula",label:"压强公式",value:"p=F/S；cm²换算为m²",source:"model"},{id:"indentation-model",label:"压痕说明",value:"固定泡沫材料下的比较现象，不是通用材料定律",source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:pressurePair?.valid??false,source:"model"},{id:"force-evidence",label:"压力因素证据",value:Boolean(forceEvidence),source:"model"},{id:"area-evidence",label:"受力面积因素证据",value:Boolean(areaEvidence),source:"model"}],validity:{ready:pressureEvidenceReady,issues}});},[analysis.saturationBlocked,areaEvidence,evidence.length,face.area,face.label,foamReady,force,forceEvidence,measured,prediction,pressed,pressureEvidenceReady,pressurePair?.valid,result.indentationMillimeters,result.pressurePascals]);
  return <LabFrame field="mechanics" experiment="mechanics-pressure" eyebrow="PRESSURE INDENTATION RIG / 固体压强压痕台" title="加砝码、翻转受力面，再用同一块泡沫比较压力作用效果" description="长方体自重50 N，可叠加砝码并选择大、中、小三个受力面。压强按 p=F/S 定量计算；压痕深度只作为同一泡沫材料下比较压力作用效果的教学现象，不是通用材料定律；18.0 mm为本教学压痕模型的上限，饱和后不能据此判断作用效果继续增大。" running={pressed} onToggle={()=>{if(foamReady){setPressed(value=>!value);setMeasured(false);}}} playLabel="向下稳定压紧" runningLabel="抬起长方体" actionDisabled={!foamReady} disabledLabel="请先放置泡沫垫">
    <div className="pressure-inquiry-console"><section><span><b>01</b>先作预测</span><p>保持压力不变，受力面积减小，压痕会怎样？</p><div>{(["deeper","same","shallower"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="deeper"?"更深":value==="same"?"不变":"更浅"}</button>)}</div></section><section><span><b>02</b>公平比较</span><strong>同一泡沫 · 一次只改变一个条件</strong><small>研究压力时保持受力面积不变；研究面积时保持压力不变。</small></section><section><span><b>03</b>单位换算</span><strong>{face.area} cm² = {(face.area/10000).toFixed(4)} m²</strong><small>计算压强前必须把平方厘米换成平方米。</small></section></div>
    <div className={`pressure-lab-sim ${foamReady?"foam-ready":""} ${pressed?"pressed":""}`} style={{"--pressure-block-width":`${face.width}px`,"--pressure-block-height":`${face.height}px`,"--indentation":`${pressed?result.indentationMillimeters:0}px`} as React.CSSProperties}>
      <div className="pressure-procedure-strip">{["放泡沫垫","选择受力面","加载砝码","稳定压紧","测量压痕","记录对照"].map((label,index)=>{const activeStage=!foamReady?0:!pressed?3:!measured?4:5;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="pressure-loading-frame"><span className="pressure-guide-rail left"/><span className="pressure-guide-rail right"/><div className="pressure-platen"><i/></div><div className="pressure-test-block"><span>实验长方体<small>自重 50 N</small></span>{weights.map((value,index)=><b style={{bottom:`${face.height+10+index*28}px`}} key={value}>{value}N</b>)}</div><div className="pressure-foam-pad"><i/><b>统一软质泡沫垫</b></div><div className="pressure-indentation-shadow"/></div>
      <div className="pressure-force-vector" style={{height:`${70+force*.4}px`}}><span>F = {force} N ↓</span></div>
      <div className={`pressure-depth-gauge ${measured?"measured":""}`}><span><small>INDENTATION / 压痕深度</small><strong>{measured?`${result.indentationMillimeters.toFixed(1)} mm`:"— —"}</strong></span><div>{Array.from({length:19},(_,index)=><i className={index%5===0?"major":""} key={index}/>)}</div><b style={{top:`${16+result.indentationMillimeters*7}px`}}/></div>
      <div className="pressure-area-readout"><span><small>CONTACT AREA / 受力面积</small><strong>{face.area} cm²</strong></span><i style={{width:`${40+face.area*2}px`}}/><em>{face.label}</em></div>
      <div className={`pressure-live-result ${measured?"valid":""}`}><Gauge size={20}/><span><small>SOLID PRESSURE / 固体压强</small><strong>{measured?`${force} ÷ ${(face.area/10000).toFixed(4)} = ${result.pressurePascals.toFixed(0)} Pa`:pressed?"压痕已形成，请读取深度":"等待稳定压紧"}</strong><em>压强按p=F/S计算；压痕显示到0.1 mm，上限18.0 mm，饱和组不能证明更深。</em></span></div>
      {!foamReady&&<InteractionCue text="先把统一软质泡沫垫放到压痕台"/>}
    </div>
    <div className="pressure-operation-dock"><section><span>选择受力面</span><div>{(Object.keys(pressureFaces) as PressureFaceKey[]).map(key=><button className={faceKey===key?"active":""} disabled={pressed} onClick={()=>{setFaceKey(key);resetTrial();}} key={key}><strong>{pressureFaces[key].label}</strong><small>{pressureFaces[key].area} cm²</small></button>)}</div></section><section><span>加载附加砝码</span><div>{[25,50,100].map(value=><button className={weights.includes(value)?"active":""} disabled={pressed} onClick={()=>toggleWeight(value)} key={value}>{value} N</button>)}</div></section><section><span>装置与读数</span><div><button className={foamReady?"done":""} disabled={foamReady} onClick={()=>setFoamReady(true)}>放置泡沫垫</button><button disabled={!pressed||measured} onClick={()=>setMeasured(true)}>测量压痕</button></div></section><aside><span>当前条件</span><strong>{force} N · {face.area} cm² · {measured?`${result.pressurePascals.toFixed(0)} Pa`:"等待测量"}</strong><button disabled={!measured} onClick={save}><Save size={15}/>保存本组数据</button></aside></div>
    <div className={`pressure-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>固体压强双因素证据</b></span><small>{pressureEvidenceReady?"两条证据链均已建立":`已保存 ${evidence.length} 组`}</small></header><FactorEvidenceStatus className="pressure-evidence-status" items={[{label:"压力因素",note:"固定面积，压痕可辨",done:Boolean(forceEvidence)},{label:"面积因素",note:"固定压力，压痕可辨",done:Boolean(areaEvidence)}]}/>{evidence.length?<div><b>组次</b><b>压力/N</b><b>面积/cm²</b><b>压强/Pa</b><b>压痕/mm</b>{evidence.map((row,index)=><div className="pressure-evidence-row" key={row.id}><span>{evidence.length-index}</span><span>{row.force}</span><span>{row.area}</span><strong>{row.pressure.toFixed(0)}</strong><strong>{row.indentation.toFixed(1)}</strong></div>)}</div>:<p>保存基准后，分别完成“固定面积改变压力”和“固定压力改变受力面积”两类对照。</p>}{pressureConclusion&&<EvidenceVerdict valid={pressureConclusion.valid} title={pressureConclusion.title} detail={pressureConclusion.detail}/>}</div>
  </LabFrame>;
}
