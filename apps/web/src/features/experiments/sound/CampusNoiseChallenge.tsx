import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { LabFrame, InteractionCue, ResultCell, EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { Volume2, Ear, Shield } from "lucide-react";

type CampusSceneKey = "classroom" | "canteen" | "road" | "library";

type NoiseStage = "source" | "path" | "receiver";

const campusScenes: Record<CampusSceneKey, { label: string; source: string; base: number; target: number; note: string }> = {
  classroom: { label: "上课教室", source: "走廊交谈 + 桌椅拖动", base: 72, target: 50, note: "目标：让教师讲解不被背景声掩蔽" },
  canteen: { label: "午间食堂", source: "餐具碰撞 + 人群交谈", base: 86, target: 65, note: "目标：降低高峰期持续噪声暴露" },
  road: { label: "临街操场", source: "车辆鸣笛 + 发动机", base: 82, target: 55, note: "目标：保护邻近教学楼的课堂环境" },
  library: { label: "图书阅览室", source: "脚步 + 设备提示音", base: 61, target: 40, note: "目标：营造可持续专注的安静区域" }
};

const campusNoiseMeasures: Array<{ id: string; stage: NoiseStage; title: string; detail: string; reduction: number; cost: number }> = [
  { id: "quiet-rule", stage: "source", title: "安静行为协议", detail: "减少不必要的高声与碰撞", reduction: 5, cost: 1 },
  { id: "equipment", stage: "source", title: "设备减振维护", detail: "处理松动、碰撞与机械振动", reduction: 8, cost: 2 },
  { id: "green-belt", stage: "path", title: "空间缓冲带", detail: "拉开距离并优化功能分区", reduction: 7, cost: 2 },
  { id: "barrier", stage: "path", title: "隔声屏 / 密封窗", detail: "阻挡主要传播路径", reduction: 13, cost: 4 },
  { id: "absorber", stage: "path", title: "吸声顶棚与软包", detail: "减少室内多次反射", reduction: 9, cost: 3 },
  { id: "earmuff", stage: "receiver", title: "个体听力防护", detail: "适合短时高声级作业", reduction: 8, cost: 2 }
];

const noiseStageLabels: Record<NoiseStage, { number: string; title: string; english: string }> = {
  source: { number: "01", title: "控制声源", english: "SOURCE" },
  path: { number: "02", title: "阻断传播", english: "PATH" },
  receiver: { number: "03", title: "保护接收者", english: "RECEIVER" }
};

export function CampusNoiseChallenge() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [sceneKey, setSceneKey] = useState<CampusSceneKey>("classroom");
  const [selected, setSelected] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const scene = campusScenes[sceneKey];
  const chosenMeasures = campusNoiseMeasures.filter((measure) => selected.includes(measure.id));
  const reduction = chosenMeasures.reduce((sum, measure) => sum + measure.reduction, 0);
  const cost = chosenMeasures.reduce((sum, measure) => sum + measure.cost, 0);
  const received = Math.max(24, scene.base - reduction);
  const targetMet = received <= scene.target;
  const budgetMet = cost <= 7;
  const designValid = targetMet && budgetMet;
  const stageCount = new Set(chosenMeasures.map((measure) => measure.stage)).size;
  const waveOpacity = Math.max(.12, Math.min(1, (received - 25) / 60));

  useEffect(() => {
    publishApparatusSnapshot({
      module: "sound-campus", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system",
      controls: [
        { id: "scene", label: "校园场景", value: scene.label, source: "control" },
        { id: "measures", label: "治理措施", value: selected.length, unit: "项", source: "control" }
      ],
      apparatus: chosenMeasures.map((measure) => ({ id: measure.id, label: measure.title, value: true, source: "apparatus" as const })),
      readings: [
        { id: "source-db", label: "声源声级", value: scene.base, unit: "dB", source: "reading" },
        { id: "receiver-db", label: "接收点估算声级", value: received, unit: "dB", source: "reading" }
      ],
      derived: [
        { id: "reduction", label: "累计衰减", value: reduction, unit: "dB", source: "model" },
        { id: "cost", label: "方案成本", value: cost, unit: "点", source: "model" },
        { id: "stages", label: "覆盖环节", value: stageCount, unit: "个", source: "model" }
      ],
      validity: { ready: designValid, issues: designValid ? [] : [!targetMet ? `还需降低至少 ${received - scene.target} dB。` : "", !budgetMet ? "方案超过 7 点预算，请优化组合。" : ""].filter(Boolean) }
    });
  }, [budgetMet, chosenMeasures, cost, designValid, interacted, received, reduction, scene, selected.length, stageCount, targetMet]);

  const selectScene = (key: CampusSceneKey) => {
    setSceneKey(key); setSelected([]); setInteracted(true);
    recordHarness("configuration.changed", { experiment: "sound-campus", control: "校园场景", value: campusScenes[key].label });
  };
  const toggleMeasure = (id: string) => {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setInteracted(true);
    recordHarness("configuration.changed", { experiment: "sound-campus", control: "治理措施", value: id });
  };

  return <LabFrame field="sound" experiment="sound-campus" eyebrow="CAMPUS SOUND LAB / 校园声环境工程" title="用 7 点预算，把真实校园场景安静下来" description="选择一个校园区域，沿着“声源—传播路径—接收者”配置治理措施。读数是用于方案比较的教学模型，实际工程还需现场测量与专业评估。" running={scanning} onToggle={() => { setScanning((value) => !value); setInteracted(true); }} playLabel="开始声级巡检" runningLabel="暂停巡检">
    <section className="campus-scene-selector" aria-label="选择校园声环境场景">{(Object.keys(campusScenes) as CampusSceneKey[]).map((key, index) => { const item = campusScenes[key]; return <button type="button" className={sceneKey === key ? "active" : ""} onClick={() => selectScene(key)} key={key}><small>ZONE 0{index + 1}</small><strong>{item.label}</strong><span>{item.source}</span><b>{item.base} dB</b></button>; })}</section>
    <section className={`campus-noise-stage ${scanning ? "is-scanning" : ""}`} style={{ "--noise-opacity": waveOpacity, "--noise-level": `${Math.min(100, received)}%` } as React.CSSProperties}>
      <header><span><i /> LIVE SOUND MAP</span><b>{scene.note}</b></header>
      <div className="campus-sound-route">
        <article className="campus-source"><span><Volume2 size={28} /></span><small>SOURCE LEVEL</small><strong>{scene.base}<em>dB</em></strong><p>{scene.source}</p></article>
        <div className="campus-wave-path"><div>{Array.from({ length: 6 }, (_, index) => <i style={{ animationDelay: `${index * .12}s` }} key={index} />)}</div><span>累计衰减 <b>−{reduction} dB</b></span></div>
        <article className={`campus-receiver ${targetMet ? "safe" : "warning"}`}><span><Ear size={28} /></span><small>RECEIVER LEVEL</small><strong>{received}<em>dB</em></strong><p>{targetMet ? "达到当前场景目标" : `目标不高于 ${scene.target} dB`}</p></article>
      </div>
      <div className="campus-level-track"><i /><span style={{ width: `${Math.min(100, received)}%` }} /><b style={{ left: `${scene.target}%` }}>目标 {scene.target}</b></div>
      {!interacted && <InteractionCue text="选择场景，再配置第一项降噪措施" />}
    </section>
    <section className="noise-control-console"><header><span><Shield size={17} /><b>NOISE CONTROL CHAIN / 三环节治理</b></span><strong className={budgetMet ? "" : "over"}>预算 {cost} / 7</strong></header><div>{(Object.keys(noiseStageLabels) as NoiseStage[]).map((stage) => <section key={stage}><header><b>{noiseStageLabels[stage].number}</b><span><small>{noiseStageLabels[stage].english}</small><strong>{noiseStageLabels[stage].title}</strong></span></header>{campusNoiseMeasures.filter((measure) => measure.stage === stage).map((measure) => <button type="button" className={selected.includes(measure.id) ? "active" : ""} onClick={() => toggleMeasure(measure.id)} key={measure.id}><span><b>{measure.title}</b><small>{measure.detail}</small></span><em>−{measure.reduction} dB · {measure.cost} 点</em></button>)}</section>)}</div></section>
    <div className="science-controls"><ResultCell label="接收点估算" value={interacted ? `${received} dB` : "等待方案"} pending={!interacted} /><ResultCell label="目标差值" value={targetMet ? `低于目标 ${scene.target - received} dB` : `还需降低 ${received - scene.target} dB`} /><ResultCell label="治理覆盖" value={`${stageCount} / 3 个环节`} /></div>
    {interacted && <EvidenceVerdict valid={designValid} title={designValid ? "方案在预算内达到声环境目标" : !budgetMet ? "声级达标，但方案超出预算" : "当前方案还没有达到场景目标"} detail={designValid ? `用 ${cost} 点预算获得约 ${reduction} dB 的组合衰减。继续尝试更少成本或覆盖更多治理环节。` : !budgetMet ? "移除成本较高或作用重复的措施，再比较接收点声级。" : "优先从声源与传播路径治理，必要时再增加接收端防护。"} />}
  </LabFrame>;
}
