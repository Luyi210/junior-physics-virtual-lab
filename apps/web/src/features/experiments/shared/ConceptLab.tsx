import { type LucideIcon, TimerReset, Gauge, Beaker, LockKeyhole, Power, BatteryCharging, Compass, Eye, Flame, Waves, Scale, Pause, Play, Activity, ClipboardList, Save, RotateCcw, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { PhysicsFieldMotif } from "../../../shared/components/PhysicsFieldMotif";
import { InteractionCue, ScienceRange, ResultCell } from "./ScienceLabPrimitives";
import { type ConceptLabKey, type FieldKey, type ScienceModuleMeta } from "../catalog/scienceCatalog";

interface ConceptResult { value: number; unit: string; status: string; detail: string; }

type PredictionDirection = "increase" | "decrease" | "same";

interface ConceptEvidenceRow { id: number; a: number; b: number; value: number; status: string; }

interface ConceptConfig {
  eyebrow: string;
  labelA: string; minA: number; maxA: number; stepA: number; initialA: number; unitA: string;
  labelB: string; minB: number; maxB: number; stepB: number; initialB: number; unitB: string;
  formula: string;
  modelKind?: "trend" | "quantitative";
  visual: "wave" | "motion" | "force" | "fluid" | "electric" | "thermal" | "measure";
  calculate: (a: number, b: number) => ConceptResult;
}

type ParametricConceptLabKey = Exclude<ConceptLabKey, "sound-campus" | "sound-auditorium" | "sound-microphone">;

export const conceptConfigs: Record<ParametricConceptLabKey, ConceptConfig> = {
  "sound-medium": { eyebrow: "SOUND MEDIUM / 介质实验", labelA: "空气保留程度", minA: 0, maxA: 100, stepA: 1, initialA: 100, unitA: "%", labelB: "接收距离", minB: 1, maxB: 12, stepB: .5, initialB: 4, unitB: "m", formula: "接收强度取决于介质与距离", visual: "wave", calculate: (air, distance) => { const value = air / Math.max(1, distance * distance) * 10; return { value, unit: "相对强度", status: air < 3 ? "接近真空，几乎不能传声" : value < 12 ? "声音很微弱" : value < 60 ? "可以听见" : "声音较清楚", detail: "声源保持振动；改变的是声音传播到接收者的条件。" }; } },
  "sound-noise": { eyebrow: "NOISE CONTROL / 噪声控制", labelA: "声源处声级", minA: 40, maxA: 110, stepA: 1, initialA: 88, unitA: "dB", labelB: "等效衰减量", minB: 0, maxB: 45, stepB: 1, initialB: 16, unitB: "dB", formula: "L接收 = L声源 − ΔL", visual: "wave", calculate: (source, attenuation) => { const value = source - attenuation; return { value, unit: "dB", status: value < 30 ? "接收处非常安静" : value < 50 ? "接收处较安静" : value < 70 ? "接收处声音较明显" : "接收处声级仍较高", detail: "这里的衰减量是声源控制、传播阻隔和接收端防护共同产生的等效声级差；0 dB 是参考声压级，不代表绝对没有声音，分贝也不是普通百分比。" }; } },
  "sound-echo": { eyebrow: "ULTRASOUND ECHO / 回声测距", labelA: "回声往返时间", minA: 2, maxA: 120, stepA: 1, initialA: 36, unitA: "ms", labelB: "介质中的声速", minB: 300, maxB: 1500, stepB: 10, initialB: 340, unitB: "m/s", formula: "距离 = 声速 × 往返时间 ÷ 2", visual: "wave", calculate: (time, speed) => { const value = speed * time / 2000; return { value, unit: "m", status: `目标约在 ${value.toFixed(1)} m 外`, detail: "仪器测得的是声波发出到返回的总时间，因此要除以 2。" }; } },
  "mechanics-speed": { eyebrow: "MOTION / 速度测量", labelA: "运动路程", minA: 10, maxA: 500, stepA: 5, initialA: 120, unitA: "m", labelB: "运动时间", minB: 2, maxB: 60, stepB: 1, initialB: 15, unitB: "s", formula: "v = s ÷ t", visual: "motion", calculate: (distance, time) => { const value = distance / time; return { value, unit: "m/s", status: value < 3 ? "较慢" : value < 12 ? "中等速度" : "较快", detail: "这是这段路程内的平均速度，并不表示每一时刻都同样快。" }; } },
  "mechanics-friction": { eyebrow: "FRICTION / 匀速拉动", labelA: "物体对桌面的压力", minA: 5, maxA: 80, stepA: 1, initialA: 30, unitA: "N", labelB: "接触面粗糙程度", minB: 5, maxB: 100, stepB: 1, initialB: 45, unitB: "%", formula: "水平匀速时：F拉 = f滑", modelKind: "trend", visual: "force", calculate: (normal, roughness) => { const value = normal * (.08 + roughness / 180); return { value, unit: "趋势值", status: value < 8 ? "滑动摩擦较小" : value < 24 ? "滑动摩擦中等" : "滑动摩擦较大", detail: "粗糙程度不是可直接代入公式的物理量，因此这里不冒充牛顿读数；真实实验应水平匀速拉动，并读取弹簧测力计示数。" }; } },
  "mechanics-pressure": { eyebrow: "PRESSURE / 压力效果", labelA: "压力", minA: 10, maxA: 500, stepA: 5, initialA: 120, unitA: "N", labelB: "受力面积", minB: 2, maxB: 200, stepB: 2, initialB: 40, unitB: "cm²", formula: "p = F ÷ S", visual: "force", calculate: (force, area) => { const value = force / (area / 10000); return { value, unit: "Pa", status: value < 5000 ? "压强较小" : value < 30000 ? "压强中等" : "压强较大", detail: "状态由压力和受力面积共同计算；计算时已把平方厘米换算为平方米。" }; } },
  "mechanics-buoyancy": { eyebrow: "FLOAT OR SINK / 浮沉", labelA: "物体平均密度", minA: .2, maxA: 8, stepA: .1, initialA: .8, unitA: "g/cm³", labelB: "液体密度", minB: .7, maxB: 1.5, stepB: .05, initialB: 1, unitB: "g/cm³", formula: "比较物体密度与液体密度", visual: "fluid", calculate: (objectDensity, liquidDensity) => { const value = objectDensity / liquidDensity; const equalDensity = Math.abs(objectDensity - liquidDensity) < 1e-9; return { value, unit: "密度比", status: equalDensity ? "悬浮" : objectDensity < liquidDensity ? "上浮并最终漂浮" : "下沉", detail: "结论适用于物体完全浸没、自由释放且不接触容器的情形；比较的是物体的平均密度。" }; } },
  "circuit-ohm": { eyebrow: "OHM'S LAW / 欧姆定律", labelA: "导体两端电压", minA: .5, maxA: 18, stepA: .5, initialA: 6, unitA: "V", labelB: "导体电阻", minB: 2, maxB: 100, stepB: 1, initialB: 20, unitB: "Ω", formula: "I = U ÷ R", visual: "electric", calculate: (voltage, resistance) => { const value = voltage / resistance; return { value, unit: "A", status: value < .2 ? "电流较小" : value < .8 ? "电流适中" : "电流较大，注意量程", detail: "改变电压研究 I-U 关系时，应保持电阻不变。" }; } },
  "circuit-power": { eyebrow: "ELECTRIC POWER / 电功率", labelA: "用电器两端电压", minA: 1, maxA: 240, stepA: 1, initialA: 12, unitA: "V", labelB: "通过用电器的电流", minB: .05, maxB: 10, stepB: .05, initialB: .5, unitB: "A", formula: "P = U × I；相同时间内 W = Pt", visual: "electric", calculate: (voltage, current) => { const value = voltage * current; return { value, unit: "W", status: value < 10 ? "小功率用电状态" : value < 500 ? "中等功率" : "较大功率", detail: `若保持当前状态 60 s，电流做功约 ${(value * 60).toFixed(0)} J。额定功率与实际功率要区分。` }; } },
  "circuit-magnet": { eyebrow: "ELECTROMAGNET / 电磁铁", labelA: "线圈匝数", minA: 20, maxA: 500, stepA: 10, initialA: 160, unitA: "匝", labelB: "线圈电流", minB: .1, maxB: 3, stepB: .1, initialB: .8, unitB: "A", formula: "其他条件相同时：N↑或I↑ → 磁性增强", modelKind: "trend", visual: "electric", calculate: (turns, current) => { const value = turns * current / 10; return { value, unit: "磁性指数", status: value < 15 ? "磁性较弱" : value < 60 ? "磁性明显" : "磁性较强", detail: "这是控制变量的趋势指标，不是磁感应强度；真实结果还受铁芯、线圈结构和温升影响。" }; } },
  "thermal-thermometer": { eyebrow: "THERMOMETER / 温度读数", labelA: "液体实际温度", minA: -20, maxA: 110, stepA: .5, initialA: 36.5, unitA: "℃", labelB: "温度计分度值", minB: .5, maxB: 5, stepB: .5, initialB: 1, unitB: "℃", formula: "先看量程和分度值，再让视线与液柱末端相平", visual: "thermal", calculate: (temperature, division) => { const value = Math.round(temperature / division) * division; return { value, unit: "℃", status: division <= 1 ? "读数较细致" : "只能作较粗略读数", detail: `模拟温度计量程为 −20～110℃，当前分度值为 ${division.toFixed(1)}℃；真实读数还必须让视线与液柱末端相平。` }; } },
  "thermal-melting": { eyebrow: "MELTING CURVE / 冰的熔化", labelA: "加热时间", minA: 0, maxA: 16, stepA: .2, initialA: 3, unitA: "min", labelB: "相对供热速率", minB: 1, maxB: 5, stepB: .5, initialB: 2, unitB: "档", formula: "冰水混合物继续吸热，温度保持在 0℃附近", modelKind: "trend", visual: "thermal", calculate: (time, power) => { const process = time * power; const value = process < 12 ? -12 + process : process < 32 ? 0 : Math.min(35, (process - 32) * .8); return { value, unit: "℃", status: process < 12 ? "固态冰正在升温" : process < 32 ? "冰水共存，正在熔化" : "冰已熔尽，水继续升温", detail: "这是用于辨认升温段和熔化平台的趋势曲线，不代表某台加热器的精确温度—时间数据。" }; } },
  "thermal-evaporation": { eyebrow: "EVAPORATION / 蒸发", labelA: "液体温度", minA: 5, maxA: 70, stepA: 1, initialA: 25, unitA: "℃", labelB: "空气流动程度", minB: 0, maxB: 100, stepB: 1, initialB: 20, unitB: "%", formula: "蒸发快慢受温度、表面积和空气流动影响", visual: "thermal", calculate: (temperature, wind) => { const value = temperature * .6 + wind * .5; return { value, unit: "蒸发指数", status: value < 35 ? "蒸发较慢" : value < 70 ? "蒸发速度中等" : "蒸发较快", detail: "本轮固定液体表面积，只比较温度和空气流动的影响。" }; } },
  "measurement-balance": { eyebrow: "BALANCE / 天平测量", labelA: "砝码总质量", minA: 0, maxA: 200, stepA: 5, initialA: 100, unitA: "g", labelB: "游码示数", minB: 0, maxB: 5, stepB: .1, initialB: 2.5, unitB: "g", formula: "物体质量 = 砝码质量 + 游码示数", visual: "measure", calculate: (weights, rider) => { const value = weights + rider; const difference = value - 137.5; return { value, unit: "g", status: Math.abs(difference) < .06 ? "天平平衡，完成测量" : difference > 0 ? "砝码一侧偏重" : "物体一侧偏重", detail: "待测物质量设为 137.5 g；先增减砝码，再用游码微调。" }; } },
  "measurement-mass-volume": { eyebrow: "MASS–VOLUME / 同种材料", labelA: "样品块数量", minA: 1, maxA: 10, stepA: 1, initialA: 3, unitA: "块", labelB: "每块体积", minB: 5, maxB: 30, stepB: 1, initialB: 10, unitB: "cm³", formula: "铝的质量 = 密度 × 总体积", visual: "measure", calculate: (count, volume) => { const totalVolume = count * volume; const value = 2.7 * totalVolume; return { value, unit: "g", status: `总体积 ${totalVolume.toFixed(0)} cm³`, detail: "同为铝制样品，质量与总体积之比保持约 2.7 g/cm³。" }; } },
  "measurement-liquid-density": { eyebrow: "LIQUID DENSITY / 液体密度", labelA: "烧杯和液体总质量", minA: 70, maxA: 350, stepA: 1, initialA: 150, unitA: "g", labelB: "液体体积", minB: 20, maxB: 250, stepB: 1, initialB: 100, unitB: "mL", formula: "ρ = (m总 − m杯) ÷ V", visual: "measure", calculate: (totalMass, volume) => { const cupMass = 50; const liquidMass = totalMass - cupMass; const value = liquidMass / volume; return { value, unit: "g/cm³", status: value < .8 ? "密度较小" : value < 1.2 ? "接近水的密度范围" : "密度较大", detail: `空烧杯质量固定为 ${cupMass} g，本次液体质量为 ${liquidMass.toFixed(0)} g，再除以量筒读出的体积。` }; } }
};

function ConceptApparatusScene({ module, a, b, normalizedA, normalizedB, result, icon: Icon }: { module: ConceptLabKey; a: number; b: number; normalizedA: number; normalizedB: number; result: ConceptResult; icon: LucideIcon }) {
  if (module === "mechanics-speed") return <div className="concept-real-apparatus apparatus-speed"><div className="speed-track">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}<span className="speed-cart" style={{ left: `${8 + normalizedA * 72}%`, transitionDuration: `${.3 + (1 - normalizedB) * .8}s` }}><b /><b /><em>运动小车</em></span><span className="speed-start">起点</span><span className="speed-finish">{a.toFixed(0)} m</span></div><div className="speed-stopwatch"><TimerReset size={25} /><span><small>区间计时</small><strong>{b.toFixed(0)} s</strong></span></div><div className="apparatus-live-value"><Gauge size={17} /><span><small>平均速度</small><strong>{result.value.toFixed(2)} m/s</strong></span></div></div>;
  if (module === "mechanics-friction") return <div className="concept-real-apparatus apparatus-friction"><div className="friction-gauge"><span><small>弹簧测力计</small><strong>{result.value.toFixed(1)} 趋势值</strong></span><i style={{ width: `${Math.min(95, result.value * 2)}%` }} /></div><div className="friction-rope" /><div className="friction-block" style={{ transform: `translateX(${normalizedB * 35}px)` }}><span>{a.toFixed(0)} N</span>{Array.from({ length: Math.round(normalizedA * 4) }, (_, index) => <i key={index} />)}</div><div className="friction-surface" style={{ backgroundSize: `${7 + (1 - normalizedB) * 24}px 8px` }} /><div className="force-arrows"><span className="pull">F拉 →</span><span className="friction">← f滑</span></div></div>;
  if (module === "mechanics-pressure") return <div className="concept-real-apparatus apparatus-pressure"><div className="pressure-frame"><i className="press-rod" /><span className="pressure-weight" style={{ height: `${45 + normalizedA * 75}px` }}>{a.toFixed(0)} N</span><span className="pressure-foot" style={{ width: `${38 + normalizedB * 145}px` }}>{b.toFixed(0)} cm²</span><span className="pressure-sand" style={{ transform: `scaleY(${.2 + Math.min(1, result.value / 50000)})` }} /></div><div className="pressure-meter"><Gauge size={20} /><span><small>压力作用效果</small><strong>{result.value.toFixed(0)} Pa</strong></span></div></div>;
  if (module === "mechanics-buoyancy") { const objectY = result.status.includes("上浮") ? 22 : result.status.includes("悬浮") ? 50 : 73; return <div className="concept-real-apparatus apparatus-buoyancy"><div className="buoyancy-tank"><span className="liquid" style={{ opacity: .38 + normalizedB * .35 }} /><span className="float-object" style={{ top: `${objectY}%`, width: `${47 + normalizedA * 22}px`, height: `${47 + normalizedA * 22}px` }}><b>ρ物<br />{a.toFixed(1)}</b></span><i className="arrow-up">F浮 ↑</i><i className="arrow-down">G ↓</i><em>ρ液 {b.toFixed(2)} g/cm³</em></div><div className="buoyancy-state"><Beaker size={19} /><span><small>释放后的运动</small><strong>{result.status}</strong></span></div></div>; }
  if (module === "circuit-ohm") return <div className="concept-real-apparatus apparatus-ohm"><div className="ohm-circuit"><span className="battery"><b>{a.toFixed(1)} V</b><i>＋</i><i>−</i></span><span className="resistor" style={{ filter: `brightness(${.8 + normalizedB * .5})` }}><i /><b>{b.toFixed(0)} Ω</b></span><span className="ammeter"><small>A</small><b>{result.value.toFixed(2)}</b></span><div className="current-dots">{Array.from({ length: 12 }, (_, index) => <i style={{ "--i": index, animationDuration: `${2.2 - normalizedA * 1.2 + normalizedB * .7}s` } as React.CSSProperties} key={index} />)}</div></div><div className="ohm-control-note"><span><LockKeyhole size={14} />研究 I-U：锁定电阻</span><span><LockKeyhole size={14} />研究 I-R：锁定电压</span></div></div>;
  if (module === "circuit-power") return <div className="concept-real-apparatus apparatus-power"><div className="power-lamp" style={{ "--lamp-glow": Math.min(1, result.value / 150) } as React.CSSProperties}><i /><b /><span>用电器</span></div><div className="power-meters"><article><small>电压表</small><strong>{a.toFixed(0)} V</strong></article><article><small>电流表</small><strong>{b.toFixed(2)} A</strong></article></div><div className="energy-wheel" style={{ animationDuration: `${Math.max(.5, 4 - Math.min(3.4, result.value / 150))}s` }}><Power size={25} /><i /></div><div className="apparatus-live-value"><BatteryCharging size={17} /><span><small>实际功率</small><strong>{result.value.toFixed(1)} W</strong></span></div></div>;
  if (module === "circuit-magnet") return <div className="concept-real-apparatus apparatus-magnet"><div className="magnet-coil">{Array.from({ length: 9 }, (_, index) => <i style={{ opacity: .25 + normalizedA * .75, transform: `translateX(${index * 13}px)` }} key={index} />)}<span /><b>{a.toFixed(0)} 匝 · {b.toFixed(1)} A</b></div><div className="magnet-field" style={{ opacity: .15 + Math.min(.8, result.value / 80) }}>{Array.from({ length: 4 }, (_, index) => <i style={{ inset: `${index * 13}px` }} key={index} />)}</div><div className="magnet-nails">{Array.from({ length: Math.max(1, Math.min(8, Math.round(result.value / 8))) }, (_, index) => <i style={{ "--nail": index } as React.CSSProperties} key={index} />)}</div><div className="apparatus-live-value"><Compass size={17} /><span><small>磁性趋势</small><strong>{result.status}</strong></span></div></div>;
  if (module === "thermal-thermometer") return <div className="concept-real-apparatus apparatus-thermometer"><div className="thermometer-vessel"><span style={{ height: `${20 + normalizedA * 55}%` }} /><i>待测液体</i></div><div className="lab-thermometer"><span style={{ height: `${8 + normalizedA * 84}%` }} /><div>{Array.from({ length: 21 }, (_, index) => <i className={index % 5 === 0 ? "major" : ""} key={index} />)}</div><b>{result.value.toFixed(1)} ℃</b></div><div className="eye-level"><Eye size={22} /><i /><span>视线与液柱末端相平</span></div><div className="apparatus-live-value"><Gauge size={17} /><span><small>当前分度值</small><strong>{b.toFixed(1)} ℃</strong></span></div></div>;
  if (module === "thermal-melting") return <div className="concept-real-apparatus apparatus-melting"><div className="melting-beaker"><span className={result.status.includes("冰水") ? "mix" : result.status.includes("水继续") ? "water" : "ice"}>{Array.from({ length: 7 }, (_, index) => <i style={{ "--ice": index } as React.CSSProperties} key={index} />)}</span><b>{result.value.toFixed(1)} ℃</b></div><div className="melting-heater"><Flame size={29} /><i style={{ opacity: .3 + normalizedB * .7 }} /></div><svg viewBox="0 0 340 150"><line x1="30" y1="120" x2="325" y2="120" /><line x1="30" y1="15" x2="30" y2="120" /><polyline points={`30,105 ${90 + normalizedA * 70},70 ${170 + normalizedA * 40},70 ${235 + normalizedA * 60},${Math.max(20, 70 - result.value)}`} /><text x="125" y="64">熔化平台</text></svg></div>;
  if (module === "thermal-evaporation") return <div className="concept-real-apparatus apparatus-evaporation"><div className="evaporation-tray"><span style={{ height: `${35 - normalizedA * 12}%` }} /><b>{a.toFixed(0)} ℃</b>{Array.from({ length: 14 }, (_, index) => <i style={{ "--drop": index, animationDuration: `${2.4 - normalizedA - normalizedB * .7}s` } as React.CSSProperties} key={index} />)}</div><div className="evaporation-fan" style={{ animationDuration: `${1.4 - normalizedB}s` }}><i /><i /><i /><span>{b.toFixed(0)}% 风速</span></div><div className="airflow-lines">{Array.from({ length: 5 }, (_, index) => <i style={{ opacity: .15 + normalizedB * .8, "--line": index } as React.CSSProperties} key={index} />)}</div><div className="apparatus-live-value"><Waves size={17} /><span><small>蒸发快慢</small><strong>{result.status}</strong></span></div></div>;
  if (module === "measurement-mass-volume") return <div className="concept-real-apparatus apparatus-mass-volume"><div className="sample-stack">{Array.from({ length: Math.round(a) }, (_, index) => <i style={{ "--block": index, width: `${26 + b * 1.25}px`, height: `${26 + b * 1.25}px` } as React.CSSProperties} key={index} />)}</div><div className="digital-scale"><Scale size={23} /><span><small>电子天平</small><strong>{result.value.toFixed(1)} g</strong></span></div><svg viewBox="0 0 270 160"><line x1="25" y1="135" x2="255" y2="135" /><line x1="25" y1="15" x2="25" y2="135" /><line x1="25" y1="135" x2="245" y2="25" /><circle cx={35 + normalizedA * 190} cy={125 - normalizedA * 90} r="6" /><text x="170" y="148">V</text><text x="8" y="24">m</text></svg></div>;
  if (module === "measurement-liquid-density") return <div className="concept-real-apparatus apparatus-liquid-density"><div className="liquid-beaker"><span style={{ height: `${20 + normalizedA * 65}%` }} /><b>总质量<br />{a.toFixed(0)} g</b></div><div className="transfer-arrow">→<small>倒入量筒</small></div><div className="graduated-cylinder"><span style={{ height: `${15 + normalizedB * 75}%` }} /><div>{Array.from({ length: 16 }, (_, index) => <i className={index % 5 === 0 ? "major" : ""} key={index} />)}</div><b>{b.toFixed(0)} mL</b></div><div className="apparatus-live-value"><Beaker size={17} /><span><small>液体密度</small><strong>{result.value.toFixed(2)} g/cm³</strong></span></div></div>;
  return <div className="concept-apparatus"><span className="apparatus-source"><Icon size={36} /></span><div className="apparatus-flow">{Array.from({ length: 8 }, (_, index) => <i style={{ "--i": index } as React.CSSProperties} key={index} />)}</div><span className="apparatus-target"><Gauge size={30} /></span></div>;
}

function TextbookConceptLab({ field, module }: { field: FieldKey; module: ScienceModuleMeta }) {
  const config = conceptConfigs[module.key as ParametricConceptLabKey];
  const ModuleIcon = module.icon;
  const [a, setA] = useState(config.initialA);
  const [b, setB] = useState(config.initialB);
  const [interacted, setInteracted] = useState(false);
  const [running, setRunning] = useState(false);
  const [prediction, setPrediction] = useState<PredictionDirection>();
  const [evidenceRows, setEvidenceRows] = useState<ConceptEvidenceRow[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(a, b);
  const isTrendModel = config.modelKind === "trend" || /相对|指数|趋势/.test(result.unit);
  const normalizedA = (a - config.minA) / (config.maxA - config.minA);
  const normalizedB = (b - config.minB) / (config.maxB - config.minB);
  const latestPair = evidenceRows.length > 1 ? evidenceRows.slice(-2) : [];
  const sameA = latestPair.length === 2 && Math.abs(latestPair[0].a - latestPair[1].a) < config.stepA / 2;
  const sameB = latestPair.length === 2 && Math.abs(latestPair[0].b - latestPair[1].b) < config.stepB / 2;
  const controlledPair = latestPair.length === 2 && (sameA !== sameB);
  const aComparison = latestPair.length === 2 && sameB && !sameA ? latestPair[1].a - latestPair[0].a : 0;
  const valueComparison = latestPair.length === 2 && sameB && !sameA ? latestPair[1].value - latestPair[0].value : 0;
  const observedDirection: PredictionDirection | undefined = !aComparison ? undefined : Math.abs(valueComparison) < Math.max(.001, Math.abs(latestPair[0].value) * .01) ? "same" : valueComparison / aComparison > 0 ? "increase" : "decrease";
  const predictionMatched = prediction && observedDirection ? prediction === observedDirection : undefined;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setA((value) => value >= config.maxA ? config.minA : Math.min(config.maxA, value + config.stepA));
      setInteracted(true);
    }, 75);
    return () => window.clearInterval(timer);
  }, [running, config]);
  const change = (control: "a" | "b", value: number) => {
    setRunning(false);
    setInteracted(true);
    if (control === "a") setA(value); else setB(value);
    recordHarness("control.changed", { control: control === "a" ? config.labelA : config.labelB, value, unit: control === "a" ? config.unitA : config.unitB });
  };
  const saveEvidence = () => {
    if (!interacted) return;
    const row = { id: evidenceRows.length + 1, a, b, value: result.value, status: result.status };
    setEvidenceRows((current) => [...current.slice(-4), row]);
    recordHarness("configuration.changed", { control: "保存实验测量", value: `第${row.id}组：${config.labelA}${a}${config.unitA}，${config.labelB}${b}${config.unitB}，结果${result.value.toFixed(3)}${result.unit}` });
  };
  useEffect(() => {
    publishApparatusSnapshot({
      module: module.key,
      capturedAt: new Date().toISOString(),
      origin: interacted ? "learner" : "system",
      controls: [
        { id: "variable-a", label: config.labelA, value: a, unit: config.unitA, source: "control" },
        { id: "variable-b", label: config.labelB, value: b, unit: config.unitB, source: "control" }
      ],
      apparatus: [
        { id: "running", label: "自动扫描", value: running, source: "apparatus" },
        { id: "operated", label: "已完成操作", value: interacted, source: "apparatus" }
      ],
      readings: [
        { id: "result-value", label: config.formula, value: interacted ? result.value : null, unit: result.unit, source: "reading" },
        { id: "result-status", label: "当前观察", value: interacted ? result.status : "等待第一次操作", source: "reading" }
      ],
      derived: [
        { id: "result-detail", label: "模型解释", value: interacted ? result.detail : "尚未生成实验现象", source: "model" },
        { id: "model-kind", label: "模型类型", value: isTrendModel ? "趋势模型" : "定量模型", source: "model" }
      ],
      validity: { ready: interacted, issues: interacted ? [] : ["先拖动任意一个变量，生成第一组现象和读数。"] }
    });
  }, [a, b, config, interacted, isTrendModel, module.key, result.detail, result.status, result.unit, result.value, running]);
  return <div className="science-lab concept-science-lab experiment-loop-lab">
    <header><div><span>{config.eyebrow} · {module.chapter}</span><h1>{module.question}</h1><p>{module.note}。拖动两个变量并观察装置、状态与读数怎样同步变化；自动扫描只用于快速发现趋势。</p></div><PhysicsFieldMotif field={field} className="science-lab-physics" /><div className="science-lab-header-actions"><button className={running ? "running" : ""} onClick={() => { setRunning((value) => !value); setInteracted(true); }}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停扫描" : "自动改变第一个量"}</button></div></header>
    <section className="experiment-loop-console" aria-label="实验探究循环">
      <header><span><Activity size={15} />INQUIRY LOOP / 本轮探究</span><div>{["作出预测", "操作装置", "保存测量", "对照证据"].map((item, index) => <b className={index === 0 ? prediction ? "done" : "active" : index === 1 ? interacted ? "done" : "" : index === 2 ? evidenceRows.length ? "done" : "" : controlledPair ? "done" : ""} key={item}><i>{index + 1}</i>{item}</b>)}</div></header>
      <div className="experiment-prediction"><span><small>先预测 · 保持“{config.labelB}”不变</small><strong>增大“{config.labelA}”，当前结果可能怎样变化？</strong></span><div>{(["increase", "decrease", "same"] as const).map((value) => <button className={prediction === value ? "selected" : ""} type="button" onClick={() => { setPrediction(value); recordHarness("configuration.changed", { control: "实验预测", value }); }} key={value}>{value === "increase" ? "增大" : value === "decrease" ? "减小" : "基本不变"}</button>)}</div><em>{predictionMatched === undefined ? "预测不会直接给分，等待两组控制变量数据。" : predictionMatched ? "当前证据与预测一致，再换一组数据检验。" : "当前证据与预测不同，这是值得解释的发现。"}</em></div>
    </section>
    <div className={`concept-sim visual-${config.visual} ${interacted ? "has-reading" : "awaiting"}`} style={{ "--concept-a": normalizedA, "--concept-b": normalizedB } as React.CSSProperties}>
      <div className="concept-axis"><span>{config.labelA}</span><i /><span>{config.labelB}</span></div>
      <ConceptApparatusScene module={module.key as ConceptLabKey} a={a} b={b} normalizedA={normalizedA} normalizedB={normalizedB} result={result} icon={ModuleIcon} />
      <div className="concept-value value-a"><small>{config.labelA}</small><strong>{a.toFixed(config.stepA < 1 ? 1 : 0)} {config.unitA}</strong></div>
      <div className="concept-value value-b"><small>{config.labelB}</small><strong>{b.toFixed(config.stepB < 1 ? 1 : 0)} {config.unitB}</strong></div>
      <div className={`concept-reading ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? config.formula : "装置等待操作"}</span><strong>{interacted ? `${result.value.toFixed(Math.abs(result.value) < 10 ? 2 : 1)} ${result.unit}` : "— —"}</strong><b>{interacted ? result.status : "先拖动任意一个变量"}</b><p>{interacted ? result.detail : "操作后才生成实验现象和读数。"}</p>{interacted && isTrendModel && <small className="concept-model-boundary">趋势模型 · 用于比较变量影响，不代表真实仪器的绝对测量值</small>}</div>
      {!interacted && <InteractionCue text="改变一个实验条件，生成第一组现象" />}
    </div>
    <div className="science-controls"><ScienceRange label={config.labelA} value={a} min={config.minA} max={config.maxA} step={config.stepA} unit={config.unitA} onChange={(value) => change("a", value)} /><ScienceRange label={config.labelB} value={b} min={config.minB} max={config.maxB} step={config.stepB} unit={config.unitB} onChange={(value) => change("b", value)} /><ResultCell label="当前观察" value={interacted ? result.status : "等待第一次操作"} pending={!interacted} /></div>
    <section className="experiment-evidence-ledger">
      <header><span><ClipboardList size={16} /><small>MEASUREMENT LEDGER</small><strong>我的实验数据</strong></span><div><button type="button" disabled={!interacted} onClick={saveEvidence}><Save size={14} />保存当前一组</button><button type="button" disabled={!evidenceRows.length} onClick={() => setEvidenceRows([])}><RotateCcw size={14} />清空</button></div></header>
      {evidenceRows.length ? <div className="evidence-table"><div><b>组次</b><b>{config.labelA}</b><b>{config.labelB}</b><b>实验结果</b><b>控制检查</b></div>{evidenceRows.map((row, index) => { const previous = evidenceRows[index - 1]; const pairControlled = previous && ((Math.abs(previous.a - row.a) < config.stepA / 2) !== (Math.abs(previous.b - row.b) < config.stepB / 2)); return <div key={`${row.id}-${index}`}><span>#{String(index + 1).padStart(2, "0")}</span><strong>{row.a.toFixed(config.stepA < 1 ? 1 : 0)} {config.unitA}</strong><strong>{row.b.toFixed(config.stepB < 1 ? 1 : 0)} {config.unitB}</strong><strong>{row.value.toFixed(Math.abs(row.value) < 10 ? 2 : 1)} {result.unit}</strong><em className={!previous ? "base" : pairControlled ? "valid" : "warning"}>{!previous ? "基准组" : pairControlled ? "只改变一个量" : "同时改变了两个量"}</em></div>; })}</div> : <div className="evidence-ledger-empty"><LockKeyhole size={20} /><span><b>数据表等待第一组测量</b><small>先操作装置，再保存当前读数；建议下一组只改变一个条件。</small></span></div>}
      {latestPair.length === 2 && <footer className={controlledPair ? "valid" : "warning"}>{controlledPair ? <CheckCircle2 size={16} /> : <Info size={16} />}<span><b>{controlledPair ? "这两组可以进行公平比较" : "这两组同时改变了两个条件"}</b><small>{controlledPair ? sameB ? `保持“${config.labelB}”不变，可以判断“${config.labelA}”的影响。` : `保持“${config.labelA}”不变，可以判断“${config.labelB}”的影响。` : "请回到装置，把其中一个量调回上一组，再保存一次。"}</small></span></footer>}
    </section>
  </div>;
}
