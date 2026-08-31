import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { analyzeBottomContactBuoyancyError, analyzeControlledComparison, analyzeInvariantEvidence, analyzeMeasurementError, analyzeProportionalEvidence, analyzeTargetVariableComparison, analyzeTimedPlateauEvidence, calculateAppliancePower, calculateDensity, calculateElectromagnetExperiment, calculateElectromagnetPolarity, calculateEvaporationTrial, calculateFrictionRegime, calculateHeatingTemperature, calculateIceMeltingState, calculateInclinedCartRun, calculateLever, calculateLeverForceLine, calculateProtectedShortCircuit, calculateSolidPressure, calculateTwoLoadCircuit, calculateWaterBoilingPoint } from "@physics-lab/physics";
import { Activity, AlertTriangle, ArrowRight, BatteryCharging, Beaker, Cable, CheckCircle2, CircuitBoard, ClipboardList, Compass, Ear, Eye, Flame, Focus, Gauge, Home, Info, Lightbulb, LockKeyhole, Mic2, Pause, Pipette, Play, Power, RadioTower, RotateCcw, Save, Scale, Shield, Sparkles, TimerReset, Unplug, Volume2, VolumeX, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { ExperimentWorkspaceDock } from "../../components/ExperimentWorkspaceDock";
import { PageIntroduction } from "../../components/PageIntroduction";
import { PhysicsInquiryRibbon } from "../../components/PhysicsInquiryRibbon";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import { useHarnessStore } from "../harness/harnessStore";
import { publishApparatusSnapshot } from "../harness/tutorialBridge";
import { useApparatusDomSync } from "../harness/useApparatusDomSync";
import { EvidenceVerdict, FactorEvidenceStatus, InteractionCue, LabFrame, ResultCell, ScienceRange } from "./ScienceLabPrimitives";

const LeverForceLineDiagnostic = lazy(async () => {
  const module = await import("./LeverForceLineDiagnostic");
  return { default: module.LeverForceLineDiagnostic };
});

const MassVolumeInvestigationLab = lazy(async () => {
  const module = await import("./MassVolumeInvestigationLab");
  return { default: module.MassVolumeInvestigationLab };
});

const SoundParticleMicroscope = lazy(async () => {
  const module = await import("./SoundParticleMicroscope");
  return { default: module.SoundParticleMicroscope };
});

type FieldKey = "sound" | "mechanics" | "circuit" | "thermal" | "measurement";
type CoreLabKey = "sound-features" | "mechanics-lever" | "circuit-basic" | "thermal-boiling" | "measurement-density";
type ConceptLabKey = "sound-medium" | "sound-noise" | "sound-echo" | "mechanics-speed" | "mechanics-friction" | "mechanics-pressure" | "mechanics-buoyancy" | "circuit-ohm" | "circuit-power" | "circuit-magnet" | "thermal-thermometer" | "thermal-melting" | "thermal-evaporation" | "measurement-balance" | "measurement-mass-volume" | "measurement-liquid-density";

interface ScienceFieldMeta { title: string; subtitle: string; icon: LucideIcon; accent: string; book: string; description: string; strands: string[]; }
interface ScienceModuleMeta {
  key: CoreLabKey | ConceptLabKey;
  title: string;
  shortTitle: string;
  chapter: string;
  note: string;
  question: string;
  icon: LucideIcon;
  guide: [string, string, string];
  life: Array<{ title: string; text: string }>;
}

function ScienceModuleLoading({ title }: { title: string }) {
  return <section className="science-lab" aria-live="polite"><header><div><span>ASSEMBLING APPARATUS / 正在装配</span><h1>{title}</h1><p>正在加载这一组专用仪器与测量工具，请稍候。</p></div></header></section>;
}

const fieldMeta: Record<FieldKey, ScienceFieldMeta> = {
  sound: { title: "声音实验场", subtitle: "从振动出发，追踪声音怎样到达耳朵", icon: Waves, accent: "#68b9e8", book: "苏科版八年级上册 · 第一章 声现象", description: "按照声音的产生与传播、声音的特性、噪声控制和人耳听不到的声音四条课本线索组织实验。", strands: ["产生与传播", "响度·音调·音色", "噪声控制", "超声与次声"] },
  mechanics: { title: "力学工坊", subtitle: "从运动和受力，走向机械与浮沉", icon: Compass, accent: "#e5b24d", book: "八上第五章 · 八下第七至九章 · 九上第十一章", description: "把速度、力、摩擦、简单机械、压强和浮力放到同一条力学探索路线中，先观察变化，再寻找定量关系。", strands: ["运动与速度", "力与平衡", "简单机械", "压强与浮力"] },
  circuit: { title: "电学连接室", subtitle: "从电流路径，走向电功率和电磁转换", icon: CircuitBoard, accent: "#ef765b", book: "苏科版九上第十三、十四章 · 九下第十五、十六章", description: "从连接基本电路开始，逐步研究电流、电压、电阻、电功率以及电流的磁效应。", strands: ["电路连接", "电流·电压·电阻", "电功与电功率", "电与磁"] },
  thermal: { title: "热学观察站", subtitle: "让看不见的热过程留下曲线", icon: Flame, accent: "#e99048", book: "苏科版八年级上册 · 第四章 物态变化", description: "以温度测量为基础，通过汽化、液化、熔化、凝固和蒸发等实验建立物态变化图景。", strands: ["温度测量", "汽化与液化", "熔化与凝固", "生活中的物态变化"] },
  measurement: { title: "物质测量室", subtitle: "从质量和体积，认识物质的差异", icon: Beaker, accent: "#9f89dd", book: "苏科版八年级下册 · 第六章 物质的物理属性", description: "先学会正确测量质量和体积，再通过质量与体积的比认识密度，并用密度解决材料鉴别问题。", strands: ["天平测质量", "质量与体积", "固体密度", "液体密度"] }
};

const inquiryFormulas: Record<CoreLabKey | ConceptLabKey, string> = {
  "sound-medium": "振动 → 介质 → 接收", "sound-features": "响度 ↔ A · 音调 ↔ f", "sound-noise": "声源 → 传播 → 人耳", "sound-echo": "s = vt / 2",
  "mechanics-speed": "v = s / t", "mechanics-friction": "匀速时 f = F拉", "mechanics-lever": "F₁l₁ = F₂l₂", "mechanics-pressure": "p = F / S", "mechanics-buoyancy": "F浮 = G − F′",
  "circuit-basic": "闭合回路 → 电流", "circuit-ohm": "I = U / R", "circuit-power": "P = UI；W = Pt", "circuit-magnet": "I↑ / N↑ → 磁性↑",
  "thermal-thermometer": "量程 · 分度值 · 平视", "thermal-boiling": "吸热 · T ≈ 沸点", "thermal-melting": "晶体熔化 · T ≈ 熔点", "thermal-evaporation": "T↑ / S↑ / v风↑",
  "measurement-balance": "m物 = m砝 + m游码", "measurement-mass-volume": "同种物质 m ∝ V", "measurement-density": "ρ = m / (V₂−V₁)", "measurement-liquid-density": "ρ = (m总−m杯) / V"
};

const scienceModules: Record<FieldKey, ScienceModuleMeta[]> = {
  sound: [
    { key: "sound-medium", shortTitle: "产生与传播", title: "声音的产生与传播", chapter: "八上·第一章 第一节", note: "振动、介质、真空与声波", question: "抽走空气以后，闹钟为什么会越来越难听见？", icon: Waves, guide: ["观察声源振动，并判断声音传播是否需要介质。", "改变空气保留程度和接收距离，比较接收到的声音强弱。", "声源仍在振动，但介质越少或距离越远，接收效果越弱。"], life: [{ title: "土电话", text: "棉线的振动把声音传到另一只纸杯，说明固体能够传声。" }, { title: "月球表面", text: "月球几乎没有空气，宇航员不能像在教室里一样直接交谈。" }, { title: "建筑回声", text: "声波遇到墙面会反射，礼堂设计需要控制回声。" }] },
    { key: "sound-features", shortTitle: "声音三要素", title: "响度、音调和音色", chapter: "八上·第一章 第二节", note: "振幅、频率与波形", question: "波形变高和变密，分别改变了声音的什么特性？", icon: Gauge, guide: ["用波形比较声音的响度和音调。", "一次只改变频率或振幅，观察波形疏密和高度。", "振幅主要影响响度，频率主要影响音调；不同声源还有不同音色。"], life: [{ title: "调节音量", text: "音箱音量变大时，振动幅度和接收到的响度增大。" }, { title: "乐器定音", text: "改变琴弦长度和松紧程度，可以改变振动频率与音调。" }, { title: "辨认说话者", text: "即使音调和响度相近，人们也能利用音色辨认不同声源。" }] },
    { key: "sound-noise", shortTitle: "噪声控制", title: "噪声的产生与控制", chapter: "八上·第一章 第三节", note: "声源、传播途中与人耳", question: "同一种噪声，可以在哪三个环节被减弱？", icon: Compass, guide: ["把噪声看成一种会传播的声音，而不是只给它贴上“难听”的标签。", "改变声源处声级和等效衰减量，观察接收位置的声级变化。", "控制噪声可以从声源、传播途中和接收端三个环节入手。"], life: [{ title: "汽车消声器", text: "在声源处减弱发动机排气噪声。" }, { title: "道路隔音屏", text: "在传播途中阻挡和吸收部分声能。" }, { title: "防护耳罩", text: "在接收端减少进入人耳的声音。" }] },
    { key: "sound-echo", shortTitle: "超声与次声", title: "听不见的声音与回声测距", chapter: "八上·第一章 第四节", note: "超声定位与次声监测", question: "发出超声后隔一段时间收到回声，距离怎样算？", icon: Waves, guide: ["利用声波发出后返回的时间估算目标距离。", "改变回声往返时间和介质声速，比较计算结果。", "声波走的是往返路程，所以目标距离应是总路程的一半。"], life: [{ title: "倒车雷达", text: "发出超声波并接收回声，估计车辆与障碍物的距离。" }, { title: "医学超声", text: "利用人体组织对超声波的反射获得内部结构信息。" }, { title: "地震监测", text: "某些自然现象会产生次声，可用于远距离监测。" }] }
  ],
  mechanics: [
    { key: "mechanics-speed", shortTitle: "运动与速度", title: "路程、时间与速度", chapter: "八上·第五章", note: "比较运动快慢", question: "同样的路程用时不同，怎样公平比较快慢？", icon: Gauge, guide: ["用单位时间内通过的路程描述运动快慢。", "改变路程或时间，观察速度读数和运动轨迹变化。", "速度等于路程与时间之比，比较时必须注意单位一致。"], life: [{ title: "区间测速", text: "用一段路程和通过这段路程的时间计算平均速度。" }, { title: "运动手表", text: "根据定位距离和时间估算配速与速度。" }, { title: "列车时刻表", text: "路程和运行时间可以帮助比较不同车次的平均速度。" }] },
    { key: "mechanics-friction", shortTitle: "摩擦力", title: "影响滑动摩擦力的因素", chapter: "八下·第七章 第三节", note: "压力与接触面粗糙程度", question: "让木块更重或让桌面更粗糙，拉力会怎样变化？", icon: Compass, guide: ["研究物体相对滑动时受到的摩擦力。", "分别改变压力和粗糙程度，保持匀速时读取拉力。", "压力越大、接触面越粗糙，滑动摩擦力通常越大。"], life: [{ title: "鞋底花纹", text: "增加接触面的粗糙程度，帮助人在湿滑路面行走。" }, { title: "自行车刹车", text: "增大刹车片压力，从而增大摩擦。" }, { title: "机器润滑", text: "加入润滑剂可以减小不必要的摩擦和磨损。" }] },
    { key: "mechanics-lever", shortTitle: "杠杆", title: "探究杠杆的平衡条件", chapter: "九上·第十一章 第一节", note: "动力、阻力与力臂", question: "较小的力为什么也能撬动较重的物体？", icon: Scale, guide: ["在支点两侧比较力与力臂共同产生的转动效果。", "改变钩码重力或悬挂位置，让杠杆重新回到水平。", "杠杆平衡时，动力×动力臂等于阻力×阻力臂。"], life: [{ title: "开瓶器", text: "增大动力臂，用较小的力撬起瓶盖。" }, { title: "天平", text: "等臂杠杆通过两侧平衡比较质量。" }, { title: "剪刀", text: "支点和刀刃位置不同，会形成不同用途的杠杆。" }] },
    { key: "mechanics-pressure", shortTitle: "压强", title: "压力作用效果与压强", chapter: "八下·第九章 第一节", note: "压力与受力面积", question: "同样的力，为什么作用面积越小效果越明显？", icon: Gauge, guide: ["用单位面积上受到的压力描述压力作用效果。", "改变压力和受力面积，比较固体接触面上的压强读数。", "压力越大或受力面积越小，压强越大。"], life: [{ title: "书包宽背带", text: "增大受力面积，减小肩部受到的压强。" }, { title: "履带车辆", text: "用宽履带增大接触面积，减小对松软地面的压强。" }, { title: "针尖", text: "针尖面积很小，在较小压力下也能产生较大压强。" }] },
    { key: "mechanics-buoyancy", shortTitle: "浮力与浮沉", title: "浮力与物体的浮沉条件", chapter: "八下·第九章 第四、五节", note: "物体密度与液体密度", question: "同一个物体放进不同液体，为什么可能浮也可能沉？", icon: Beaker, guide: ["比较物体重力与液体提供的浮力。", "改变物体平均密度和液体密度，观察物体自由释放后的浮沉状态。", "对于完全浸没、自由释放且不接触容器的物体，平均密度小于液体时上浮，大于液体时下沉，二者相等时可悬浮。"], life: [{ title: "轮船", text: "把船体做成空心可降低平均密度，使它漂浮在水面。" }, { title: "潜水艇", text: "通过改变水舱中的水量改变自身平均密度。" }, { title: "盐水选种", text: "不同饱满程度的种子在适当浓度盐水中呈现不同浮沉状态。" }] }
  ],
  circuit: [
    { key: "circuit-basic", shortTitle: "串联与并联", title: "连接基本电路", chapter: "九上·第十三章", note: "电流路径、开关与用电器", question: "电流只有一条路和有多条路时，用电器怎样工作？", icon: CircuitBoard, guide: ["识别电源、开关、导线和用电器构成的完整电路。", "先断开开关连接，再切换串联和并联比较电流路径。", "串联只有一条电流路径；并联各支路可以相对独立工作。"], life: [{ title: "节日小彩灯", text: "一些灯串采用串联连接，一个位置断路可能影响整串。" }, { title: "家庭用电", text: "家庭用电器通常并联，便于独立开关。" }, { title: "冰箱门控灯", text: "不同开关控制不同支路，实现自动工作。" }] },
    { key: "circuit-ohm", shortTitle: "欧姆定律", title: "电流与电压、电阻的关系", chapter: "九上·第十四章", note: "控制变量与 I=U/R", question: "保持电阻不变增大电压，电流怎样变化？", icon: Gauge, guide: ["研究通过导体的电流与两端电压、电阻的定量关系。", "研究电流与电压时保持导体和温度不变；研究电流与电阻时保持电压不变。", "在导体电阻一定时，电流与两端电压成正比；在电压一定时，电流与电阻成反比。"], life: [{ title: "调光电路", text: "改变电路中的电阻可以调节灯泡电流和亮度。" }, { title: "限流电阻", text: "给发光二极管串联适当电阻，防止电流过大。" }, { title: "电压表电流表", text: "测量时要选择合适量程并按正确方式接入电路。" }] },
    { key: "circuit-power", shortTitle: "电功率", title: "测量用电器的电功率", chapter: "九下·第十五章", note: "电压、电流与用电快慢", question: "同样工作一分钟，为什么有的电器消耗电能更多？", icon: BatteryCharging, guide: ["用电功率描述电流做功的快慢。", "改变电压和电流，观察功率及相同时间内的电能变化。", "电功率等于电压与电流的乘积，功率越大用电越快。"], life: [{ title: "用电器铭牌", text: "额定电压和额定功率说明正常工作条件。" }, { title: "节能灯", text: "比较相同亮度下的功率，可以判断节能效果。" }, { title: "电能表", text: "家庭电能表记录一段时间内消耗的电能。" }] },
    { key: "circuit-magnet", shortTitle: "电流的磁效应", title: "通电螺线管与电磁铁", chapter: "九下·第十六章", note: "线圈匝数、电流与磁性", question: "怎样让自制电磁铁吸起更多铁钉？", icon: Compass, guide: ["观察通电线圈周围产生的磁场。", "改变线圈匝数和电流，比较磁性强弱指标。", "在其他条件相同时，匝数更多或电流更大，电磁铁通常更强。"], life: [{ title: "电磁起重机", text: "通电吸起钢铁，断电后便于放下。" }, { title: "电铃", text: "电磁铁反复吸引衔铁，使铃锤敲击铃盖。" }, { title: "继电器", text: "用较小电流控制另一个工作电路的通断。" }] }
  ],
  thermal: [
    { key: "thermal-thermometer", shortTitle: "温度测量", title: "温度计的使用与读数", chapter: "八上·第四章 第一节", note: "量程、分度值与视线", question: "分度值不同，温度读数会有多大差别？", icon: Gauge, guide: ["认识温度计量程、分度值和液柱位置。", "改变实际温度和分度值，比较可读出的温度。", "分度值越小读数越细致；读数时视线应与液柱末端相平。"], life: [{ title: "体温计", text: "量程适合人体温度，分度值较小。" }, { title: "气温观测", text: "百叶箱减少阳光直射等因素对测温的影响。" }, { title: "厨房温度计", text: "不同测温任务需要不同量程和结构的温度计。" }] },
    { key: "thermal-boiling", shortTitle: "沸腾", title: "观察水的沸腾", chapter: "八上·第四章 第二节", note: "温度—时间曲线与沸点", question: "水沸腾后继续吸热，温度为什么不再明显升高？", icon: Flame, guide: ["持续加热并记录水温随时间的变化。", "改变水量或加热功率，比较达到沸腾所需时间。", "水沸腾时继续吸热，在条件不变时温度保持在沸点附近。"], life: [{ title: "高压锅", text: "提高锅内气压可提高水的沸点，使食物更快熟。" }, { title: "高原煮食", text: "高原气压较低，水的沸点降低。" }, { title: "蒸汽液化", text: "壶口白雾是水蒸气遇冷液化形成的小水滴。" }] },
    { key: "thermal-melting", shortTitle: "熔化与凝固", title: "冰的熔化温度曲线", chapter: "八上·第四章 第三节", note: "固态、熔化平台与液态", question: "冰熔化过程中继续吸热，温度怎样变化？", icon: Flame, guide: ["记录冰受热时温度和状态随时间的变化。", "改变加热时间和功率，观察固态、熔化和液态阶段。", "晶体熔化时继续吸热，但在熔点附近温度暂时保持不变。"], life: [{ title: "冰雪融化", text: "气温达到熔点并继续吸热后，冰逐渐变成水。" }, { title: "铸造金属", text: "金属熔化后倒入模具，凝固形成需要的形状。" }, { title: "道路撒盐", text: "盐会改变冰雪的熔化条件，帮助道路除冰。" }] },
    { key: "thermal-evaporation", shortTitle: "蒸发", title: "影响蒸发快慢的因素", chapter: "八上·第四章 第二节", note: "温度、表面积与空气流动", question: "湿衣服在什么条件下干得更快？", icon: Waves, guide: ["研究只发生在液体表面的缓慢汽化现象。", "改变温度和空气流动强度，观察蒸发速率指标。", "温度越高、表面积越大、空气流动越快，蒸发通常越快。"], life: [{ title: "晾晒衣服", text: "展开衣服、放在通风处可加快水分蒸发。" }, { title: "吹风机", text: "提高温度并加快空气流动，使头发更快变干。" }, { title: "蒸发降温", text: "液体蒸发会吸热，汗液蒸发能帮助身体降温。" }] }
  ],
  measurement: [
    { key: "measurement-balance", shortTitle: "天平测质量", title: "用托盘天平测量质量", chapter: "八下·第六章 第一节", note: "调平、砝码与游码", question: "怎样组合砝码和游码，让天平重新平衡？", icon: Scale, guide: ["用托盘天平比较待测物与砝码的质量。", "先调平，再由大到小增减砝码，最后移动游码。", "平衡时物体质量等于砝码总质量与游码示数之和。"], life: [{ title: "电子秤", text: "市场电子秤能直接显示质量，有些还能计算价格。" }, { title: "杆秤", text: "传统杆秤利用杠杆平衡比较物体质量。" }, { title: "累积测量", text: "测多个回形针的总质量再除以数量，可测很小的单个质量。" }] },
    { key: "measurement-mass-volume", shortTitle: "质量与体积", title: "探究质量与体积的关系", chapter: "八下·第六章 第二节", note: "同种物质的比例关系", question: "同种材料做成大小不同的物块，质量怎样变化？", icon: Beaker, guide: ["比较同种物质不同体积样品的质量。", "改变样品数量和单块体积，记录总体积与总质量。", "同种物质的质量与体积通常成正比，二者比值保持不变。"], life: [{ title: "材料估重", text: "已知材料密度和体积，可以估算大型构件质量。" }, { title: "商品规格", text: "同种饮料容量增大时，内容物质量也近似按比例增加。" }, { title: "质量—体积图像", text: "不同材料图线斜率不同，可反映密度差异。" }] },
    { key: "measurement-density", shortTitle: "固体密度", title: "测量不规则固体的密度", chapter: "八下·第六章 第三节", note: "天平与排水法", question: "形状不规则的石块，体积怎样测出来？", icon: Beaker, guide: ["分别测出物体质量和体积，再计算密度。", "先用天平称量，再把物体完全浸没，用量筒前后示数之差求体积。", "密度等于质量与体积之比，读量筒时要平视液面。"], life: [{ title: "矿石鉴别", text: "测得样品密度并与密度表比较，可初步判断材料。" }, { title: "珠宝检测", text: "密度是鉴别材料的重要依据之一，但通常还需结合其他方法。" }, { title: "密度计", text: "漂浮式密度计根据浮沉位置直接读取液体密度。" }] },
    { key: "measurement-liquid-density", shortTitle: "液体密度", title: "测量液体的密度", chapter: "八下·第六章 第三节", note: "容器差量法与量筒", question: "怎样把烧杯本身的质量从测量结果中去掉？", icon: Beaker, guide: ["用容器装液体，通过质量差得到液体质量。", "改变液体质量和体积，计算并比较密度。", "液体质量应扣除空容器质量，体积应读取量筒液面。"], life: [{ title: "酒精检测", text: "一定浓度的医用酒精有相应密度，可辅助判断样品是否合格。" }, { title: "牛奶检测", text: "密度测量可作为食品质量检查的一项参考。" }, { title: "电池电解液", text: "测量电解液密度可以帮助判断某些电池的工作状态。" }] }
  ]
};

function isField(value: string | undefined): value is FieldKey { return Boolean(value && value in fieldMeta); }

export function StudentScienceExplore() {
  const { field } = useParams();
  if (!isField(field)) return <Navigate to="/student" replace />;
  const meta = fieldMeta[field];
  const Icon = meta.icon;
  const [params, setParams] = useSearchParams();
  const modules = scienceModules[field];
  const requestedModule = params.get("module");
  const activeModule = modules.find((module) => module.key === requestedModule) ?? null;
  const selectModule = (key?: ScienceModuleMeta["key"]) => setParams(key ? { module: key } : {});
  useApparatusDomSync(activeModule?.key, ".science-module-experience > .science-lab");
  return <div className="science-explore-page science-structure-v2" style={{ "--science-accent": meta.accent } as React.CSSProperties}>
    {!activeModule && <PageIntroduction
      key={field}
      pageKey={`field-${field}`}
      eyebrow={`${meta.book} / 领域导览`}
      title={`${meta.title}：${meta.subtitle}`}
      description={`${meta.description} 本页是实验目录，不规定学习顺序；可以从最感兴趣的问题直接进入装置。`}
      points={meta.strands.map((strand) => `探索“${strand}”中的现象、变量与规律`)}
      icon={Icon}
      accent={meta.accent}
      enterLabel={`查看${meta.title}实验`}
      persistence="local"
      triggerLabel="领域向导"
    />}
    <header className="science-header"><Link to="/student"><BrandMark compact /></Link><div><Icon size={19} /><span><small>FIELD / 当前领域</small><strong>{meta.title}</strong></span></div><p>{activeModule ? `${activeModule.chapter} · ${activeModule.title}` : meta.subtitle}</p><Link to="/student"><Home size={16} />六领域首页</Link></header>
    <main className="science-layout">
      <aside className="science-nav"><span>01—06 · 物理领域</span><Link to="/student/explore/light"><Focus size={18} /><span><strong>光现象</strong><small>传播、反射、折射与透镜</small></span></Link>{(Object.keys(fieldMeta) as FieldKey[]).map((key) => { const item = fieldMeta[key]; const ItemIcon = item.icon; return <Link className={key === field ? "active" : ""} to={`/student/explore/${key}`} key={key}><ItemIcon size={18} /><span><strong>{item.title}</strong><small>{item.strands.join(" · ")}</small></span></Link>; })}</aside>
      <section className="science-stage">
        <div className="science-module-bar"><div><span>EXPERIMENTS / 实验</span><strong>{activeModule ? activeModule.title : `${meta.title}实验目录`}</strong></div><nav aria-label={`${meta.title}实验目录`}><button className={!activeModule ? "active" : ""} onClick={() => selectModule()}><Sparkles size={15} /><span>目录</span></button>{modules.map((module, index) => { const ModuleIcon = module.icon; return <button className={activeModule?.key === module.key ? "active" : ""} onClick={() => selectModule(module.key)} title={module.title} key={module.key}><b>{String(index + 1).padStart(2, "0")}</b><ModuleIcon size={15} /><span>{module.shortTitle}</span></button>; })}</nav></div>
        {activeModule && <PhysicsInquiryRibbon title={activeModule.title} question={activeModule.question} variable={activeModule.guide[1]} evidence={`记录“${activeModule.note}”对应的读数、状态和变化趋势`} law={activeModule.guide[2]} application={activeModule.life.slice(0, 2).map((item) => item.title).join("、")} formula={inquiryFormulas[activeModule.key]} />}
        {activeModule && <ExperimentWorkspaceDock experiment={activeModule.key} title={activeModule.title} context={`${meta.title} · ${activeModule.chapter}`} targetSelector=".science-module-experience > .science-lab" />}
        {!activeModule ? <ScienceFieldOverview field={field} onSelect={selectModule} /> : <ScienceModuleExperience field={field} module={activeModule} />}
      </section>
    </main>
  </div>;
}

function ScienceFieldOverview({ field, onSelect }: { field: FieldKey; onSelect: (key: ScienceModuleMeta["key"]) => void }) {
  const meta = fieldMeta[field];
  const Icon = meta.icon;
  const modules = scienceModules[field];
  return <div className={`science-field-overview overview-${field}`}>
    <section className="science-field-hero"><div><span>OPEN FIELD / 自由探索</span><h1>{meta.title}</h1><p>{meta.description}</p><div className="science-strand-tags">{meta.strands.map((strand) => <b key={strand}>{strand}</b>)}</div></div><PhysicsFieldMotif field={field} className="science-field-physics" /><div className="science-field-emblem"><Icon size={38} /><strong>{modules.length}</strong><small>个动态实验</small></div></section>
    {field === "sound" && <SoundFieldMonitor />}
    <section className="science-overview-heading"><div><span>EXPERIMENT MAP / 实验目录</span><h2>选择一个问题，直接进入装置。</h2></div><p>不规定先后顺序。每个实验都包含动态操作、实验说明和生活应用。</p></section>
    <div className="science-module-card-grid">{modules.map((module, index) => { const ModuleIcon = module.icon; return <button onClick={() => onSelect(module.key)} key={module.key}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><i><ModuleIcon size={24} /></i><small>{module.chapter}</small><h3>{module.title}</h3><p>{module.note}</p><blockquote>{module.question}</blockquote><b>进入动态实验 <ArrowRight size={15} /></b></button>; })}</div>
    <section className="science-curriculum-note"><span>对应教材</span><strong>{meta.book}</strong><p>教材章节用于说明知识来源，不代表必须按照章节顺序完成实验。</p></section>
  </div>;
}

function SoundFieldMonitor() {
  const wave = Array.from({ length: 91 }, (_, index) => `${index * 9},${55 + Math.sin(index * .42) * (12 + index / 8)}`).join(" ");
  return <section className="sound-field-monitor" aria-label="声音传播观测模型">
    <header><span><i />ACOUSTIC SIGNAL ONLINE</span><b>声音不是“飞出去的东西”，而是振动在介质中传递。</b></header>
    <div className="sound-monitor-chain"><article><i><Mic2 size={21} /></i><span><small>01 / SOURCE</small><strong>声源振动</strong><em>产生疏密变化</em></span></article><div className="sound-monitor-wave"><svg viewBox="0 0 810 110" preserveAspectRatio="none"><polyline points={wave} /></svg><span>介质粒子在平衡位置附近振动</span></div><article><i><Ear size={21} /></i><span><small>03 / RECEIVER</small><strong>接收声音</strong><em>形成听觉或读数</em></span></article></div>
    <footer>{["振幅 A → 响度线索", "频率 f → 音调线索", "传播需要介质", "回声经历往返路径"].map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</footer>
  </section>;
}

function ScienceModuleExperience({ field, module }: { field: FieldKey; module: ScienceModuleMeta }) {
  const core = renderScienceLab(module);
  return <div className="science-module-experience" key={module.key}>{core}<ScienceModuleReading module={module} /></div>;
}

function renderScienceLab(module: ScienceModuleMeta): React.ReactNode {
  switch (module.key) {
    case "sound-features": return <SoundLab />;
    case "sound-medium": case "sound-noise": case "sound-echo": return <SoundConceptLab module={module} />;
    case "mechanics-speed": return <SpeedLab />;
    case "mechanics-friction": return <FrictionLab />;
    case "mechanics-lever": return <LeverLab />;
    case "mechanics-pressure": return <PressureLab />;
    case "mechanics-buoyancy": return <BuoyancyLab />;
    case "circuit-basic": return <CircuitLab />;
    case "circuit-ohm": return <OhmLawLab />;
    case "circuit-power": return <ElectricPowerLab />;
    case "circuit-magnet": return <ElectromagnetLab />;
    case "thermal-thermometer": return <ThermometerLab />;
    case "thermal-boiling": return <ThermalLab />;
    case "thermal-melting": return <MeltingLab />;
    case "thermal-evaporation": return <EvaporationLab />;
    case "measurement-balance": return <BalanceMeasurementLab />;
    case "measurement-mass-volume": return <Suspense fallback={<ScienceModuleLoading title="质量—体积探究装置" />}><MassVolumeInvestigationLab /></Suspense>;
    case "measurement-density": return <DensityLab />;
    case "measurement-liquid-density": return <LiquidDensityLab />;
    default: return assertNeverScienceLab(module.key);
  }
}

function assertNeverScienceLab(key: never): never {
  throw new Error(`未配置独立实验台：${String(key)}`);
}

function ScienceModuleReading({ module }: { module: ScienceModuleMeta }) {
  const ModuleIcon = module.icon;
  return <>
    <section className="science-experiment-guide" aria-label={`${module.title}实验说明`}>
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>这个实验研究什么？应该怎样比较？</h2><p>{module.chapter} · {module.note}。实验不会要求按固定任务闯关，可以自由改变参数，但比较规律时建议一次只改变一个条件。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>确定实验对象</strong><p>{module.guide[0]}</p></span></article>
        <article><i><Play size={19} /></i><span><small>02 · 怎么操作</small><strong>主动改变条件</strong><p>{module.guide[1]}</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>从现象寻找关系</strong><p>{module.guide[2]}</p></span></article>
      </div>
      <footer><b>开放问题：</b>{module.question}</footer>
    </section>
    <section className="science-life-application" aria-label={`${module.title}生活应用`}>
      <header><div><span>PHYSICS IN LIFE / 生活中的物理</span><h2>课本规律离开实验台以后，仍在真实世界里工作。</h2></div><ModuleIcon size={34} /></header>
      <div>{module.life.map((item, index) => <article key={item.title}><b>{String(index + 1).padStart(2, "0")}</b><i><ModuleIcon size={20} /></i><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>
  </>;
}

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

const conceptConfigs: Record<ConceptLabKey, ConceptConfig> = {
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

const trayBalanceWeights = [
  { id: "weight-100", mass: 100 },
  { id: "weight-50", mass: 50 },
  { id: "weight-20-a", mass: 20 },
  { id: "weight-20-b", mass: 20 },
  { id: "weight-10", mass: 10 },
  { id: "weight-5", mass: 5 }
] as const;

type TrayBalanceWeightId = typeof trayBalanceWeights[number]["id"];

const balanceGuideSteps = [
  { number: "01", title: "归零检查", short: "游码必须先回到零刻度", detail: "把天平放在水平桌面，确认托盘空着，再将游码移到标尺左端的零刻度。没有归零就调平，会把游码的质量误当成天平本身的不平衡。", notice: "调平前：空盘、游码归零。" },
  { number: "02", title: "调节平衡", short: "指针左偏右调，右偏左调", detail: "只在空载时调节平衡螺母。指针偏左，就把螺母向右调；指针偏右，就向左调。反复微调，直到指针对准分度盘中央。", notice: "称量开始以后，不再调平衡螺母。" },
  { number: "03", title: "左物右码", short: "待测物放左盘，砝码放右盘", detail: "把待测物轻放在左盘，用镊子夹取砝码放入右盘。砝码不能用手直接拿，潮湿物体和化学药品也不能直接接触托盘。", notice: "记忆口诀：左物右码。" },
  { number: "04", title: "先大后小", short: "从大砝码开始逐级试放", detail: "估计物体质量后，先放较大的砝码，再逐步换用较小的砝码。右盘过重就取下或换小，左盘过重就继续添加，直到只差很小的质量。", notice: "增减砝码时动作要轻，并用镊子操作。" },
  { number: "05", title: "游码微调", short: "砝码接近后再移动游码", detail: "当最小砝码仍不能让天平平衡时，保持砝码组合不变，缓慢向右移动游码。观察指针摆动，直到指针回到中央。", notice: "游码相当于给右盘增加一个很小的质量。" },
  { number: "06", title: "正确读数", short: "物体质量＝砝码总质量＋游码示数", detail: "天平平衡后，先把右盘所有砝码质量相加，再读取游码左边缘所对的刻度。两者之和就是物体质量，最后用镊子收回砝码并让游码归零。", notice: "读数要带单位 g，并记录到合适的小数位。" }
] as const;

function BalanceUsageGuide({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = balanceGuideSteps[stepIndex];
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const next = () => stepIndex === balanceGuideSteps.length - 1 ? onClose() : setStepIndex((index) => index + 1);

  return <div className="balance-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className={`balance-guide-dialog guide-step-${stepIndex + 1}`} role="dialog" aria-modal="true" aria-labelledby="balance-guide-title">
      <button className="balance-guide-close" onClick={onClose} aria-label="关闭托盘天平使用教学">×</button>
      <aside className="balance-guide-visual">
        <div className="balance-guide-plate"><span>INSTRUMENT MANUAL</span><strong>托盘天平</strong><small>操作教学 · 六步完成称量</small></div>
        <div className="balance-guide-apparatus" aria-hidden="true">
          <div className="guide-dial"><i /></div>
          <div className="guide-column" />
          <div className="guide-beam"><i /><i /></div>
          <div className="guide-pan left"><span>物</span></div>
          <div className="guide-pan right"><span>码</span></div>
          <div className="guide-base"><Scale size={22} /></div>
          <div className="guide-rider"><i /></div>
          <b className="guide-highlight highlight-zero">归零</b><b className="guide-highlight highlight-nut">平衡螺母</b><b className="guide-highlight highlight-object">左盘放物</b><b className="guide-highlight highlight-weight">右盘放码</b><b className="guide-highlight highlight-rider">移动游码</b><b className="guide-highlight highlight-reading">平衡读数</b>
        </div>
        <div className="balance-guide-formula"><small>READING RULE / 读数规则</small><strong>m<sub>物</sub> = m<sub>砝码</sub> + m<sub>游码</sub></strong></div>
      </aside>
      <main className="balance-guide-content">
        <div className="balance-guide-heading"><span>HOW TO USE / 使用教学</span><b>{step.number} / 06</b><h2 id="balance-guide-title">{step.title}</h2><strong>{step.short}</strong></div>
        <p>{step.detail}</p>
        <div className="balance-guide-notice"><Info size={18} /><span><small>这一点最重要</small><strong>{step.notice}</strong></span></div>
        <nav className="balance-guide-stepper" aria-label="托盘天平教学步骤">{balanceGuideSteps.map((item, index) => <button className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} onClick={() => setStepIndex(index)} aria-label={`第${index + 1}步：${item.title}`} key={item.number}><b>{index < stepIndex ? "✓" : item.number}</b><span>{item.title}</span></button>)}</nav>
        <footer><button onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}>上一步</button><span>也可以点击步骤编号直接查看</span><button className="primary" onClick={next}>{stepIndex === balanceGuideSteps.length - 1 ? "我会了，开始实验" : <>下一步 <ArrowRight size={16} /></>}</button></footer>
      </main>
    </section>
  </div>;
}

function BalanceMeasurementLab() {
  const objectMass = 137.5;
  const recordHarness = useHarnessStore((state) => state.record);
  const [guideOpen, setGuideOpen] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem("physics-balance-guide-seen") !== "1");
  const [rider, setRider] = useState(.6);
  const [nutOffset, setNutOffset] = useState(.8);
  const [objectPlaced, setObjectPlaced] = useState(false);
  const [selectedWeightIds, setSelectedWeightIds] = useState<TrayBalanceWeightId[]>([]);
  const [measurements, setMeasurements] = useState<number[]>([]);
  const [trialSaved, setTrialSaved] = useState(false);
  const [tweezersHeld, setTweezersHeld] = useState(false);
  const [weightOrderWarning, setWeightOrderWarning] = useState(false);
  const [weightHandlingObserved, setWeightHandlingObserved] = useState(false);
  const weightsTotal = trayBalanceWeights.filter((weight) => selectedWeightIds.includes(weight.id)).reduce((total, weight) => total + weight.mass, 0);
  const calibrated = rider <= .05 && Math.abs(nutOffset) <= .05;
  const massDifference = objectPlaced ? weightsTotal + rider - objectMass : 0;
  const balanceSignal = objectPlaced ? massDifference / 5 + nutOffset : nutOffset + rider * .22;
  const beamTilt = Math.max(-7, Math.min(7, balanceSignal * 1.45));
  const balanced = objectPlaced && Math.abs(massDifference) < .06 && Math.abs(nutOffset) <= .05;
  const leftPanY = -beamTilt * 3.25;
  const rightPanY = beamTilt * 3.25;
  const repeatability = analyzeInvariantEvidence(measurements, .002, 2);

  const stage = !calibrated ? 0 : !objectPlaced ? 1 : !balanced ? 2 : 3;
  const guidance = !calibrated
    ? rider > .05 ? "先把游码移到标尺左端的零刻度，再调节平衡螺母。" : nutOffset > .05 ? "指针偏右，请向左调节平衡螺母。" : "指针偏左，请向右调节平衡螺母。"
    : !objectPlaced ? "空载已经平衡。现在把待测金属块放在左盘。"
      : balanced ? "指针回到中央：砝码总质量加游码示数，就是物体质量。"
        : massDifference > 0 ? "右盘偏重：取下较大的砝码，或把游码向左移动。"
          : weightsTotal === 0 ? "左盘下沉：按照“先大后小”的顺序向右盘添加砝码。"
            : objectMass - weightsTotal > 5 ? "左盘仍偏重：继续由大到小添加或更换砝码。" : "已经接近平衡：停止加大砝码，移动游码进行微调。";

  useEffect(() => {
    const pointer = Math.abs(beamTilt) <= .08 ? "对中" : beamTilt > 0 ? "右偏" : "左偏";
    publishApparatusSnapshot({
      module: "measurement-balance",
      capturedAt: new Date().toISOString(),
      origin: calibrated || objectPlaced || selectedWeightIds.length > 0 || rider !== .6 || nutOffset !== .8 ? "learner" : "system",
      controls: [
        { id: "rider", label: "游码示数", value: rider, unit: "g", source: "control" },
        { id: "nut-offset", label: "平衡螺母偏移", value: nutOffset, unit: "格", source: "control" }
      ],
      apparatus: [
        { id: "calibrated", label: "空载调平", value: calibrated, source: "apparatus" },
        { id: "object-placed", label: "待测物已放置", value: objectPlaced, source: "apparatus" },
        { id: "weights-total", label: "砝码总质量", value: weightsTotal, unit: "g", source: "apparatus" },
        { id: "tweezers", label: "镊子已拿起", value: tweezersHeld, source: "apparatus" },
        { id: "proper-weight-handling", label: "使用镊子取放砝码", value: weightHandlingObserved, source: "apparatus" },
        { id: "pointer", label: "指针状态", value: pointer, source: "apparatus" },
        { id: "balanced", label: "称量平衡", value: balanced, source: "apparatus" }
      ],
      readings: [
        { id: "measured-mass", label: "测得质量", value: balanced ? weightsTotal + rider : null, unit: "g", source: "reading" }
      ],
      derived: [
        { id: "stage", label: "操作阶段", value: stage + 1, source: "model" },
        { id: "guidance", label: "当前操作建议", value: guidance, source: "model" },
        { id: "repeatability", label: "两次独立称量一致", value: repeatability.stable, source: "model" }
      ],
      validity: {
        ready: repeatability.stable,
        issues: repeatability.stable ? [] : !balanced ? [guidance] : !trialSaved ? ["保存本次平衡读数。"] : ["取下物体并重新归零调平，再完成第二次独立称量。"]
      }
    });
  }, [balanced, beamTilt, calibrated, guidance, nutOffset, objectPlaced, repeatability.stable, rider, selectedWeightIds, stage, trialSaved, tweezersHeld, weightHandlingObserved, weightsTotal]);

  const adjustNut = (delta: number) => {
    if (objectPlaced) return;
    const next = Math.max(-1.2, Math.min(1.2, Math.round((nutOffset + delta) * 10) / 10));
    setNutOffset(next);
    recordHarness("control.changed", { experiment: "measurement-balance", control: "平衡螺母", value: next, unit: "格" });
  };
  const changeRider = (value: number) => {
    setRider(value);
    recordHarness("control.changed", { experiment: "measurement-balance", control: "游码示数", value, unit: "g" });
  };
  const toggleObject = () => {
    if (!objectPlaced && !calibrated) return;
    setObjectPlaced((placed) => !placed);
    setSelectedWeightIds([]);
    setRider(0);
    setTrialSaved(false);
    setTweezersHeld(false);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "待测物", value: objectPlaced ? "取下" : "放入左盘" });
  };
  const toggleWeight = (id: TrayBalanceWeightId, mass: number) => {
    if (!objectPlaced || !tweezersHeld) return;
    const selected = selectedWeightIds.includes(id);
    if (!selected) {
      const selectedMasses = trayBalanceWeights.filter((weight) => selectedWeightIds.includes(weight.id)).map((weight) => weight.mass);
      if ((selectedMasses.length === 0 && mass < 50) || selectedMasses.some((selectedMass) => selectedMass < mass)) setWeightOrderWarning(true);
    }
    setWeightHandlingObserved(true);
    setSelectedWeightIds(selected ? selectedWeightIds.filter((weightId) => weightId !== id) : [...selectedWeightIds, id]);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: `${mass}g砝码`, value: selected ? "取下" : "放入右盘" });
  };
  const saveMeasurement = () => {
    if (!balanced || trialSaved) return;
    const value = Number((weightsTotal + rider).toFixed(1));
    setMeasurements((items) => [...items, value].slice(-2));
    setTrialSaved(true);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "保存独立称量", value, unit: "g" });
  };
  const startRepeat = () => {
    setObjectPlaced(false); setSelectedWeightIds([]); setRider(.4); setNutOffset(-.7); setTrialSaved(false); setTweezersHeld(false); setWeightOrderWarning(false);
    recordHarness("configuration.changed", { experiment: "measurement-balance", control: "重复称量", value: "重新归零调平" });
  };
  const reset = () => {
    setRider(.6);
    setNutOffset(.8);
    setObjectPlaced(false);
    setSelectedWeightIds([]);
    setMeasurements([]);
    setTrialSaved(false);
    setTweezersHeld(false);
    setWeightOrderWarning(false);
    setWeightHandlingObserved(false);
    recordHarness("simulation.toggled", { experiment: "measurement-balance", running: false, action: "重新开始" });
  };

  return <div className="science-lab tray-balance-lab">
    {guideOpen && <BalanceUsageGuide onClose={() => { window.sessionStorage.setItem("physics-balance-guide-seen", "1"); setGuideOpen(false); }} />}
    <header><div><span>BALANCE LAB / 托盘天平实训台</span><h1>不显示答案，你能把这块金属的质量测出来吗？</h1><p>像真实实验一样完成归零、调平、放物、加砝码和移动游码；保存第一次结果后取下物体，重新独立操作一次，用重复读数检查测量是否可靠。</p></div><PhysicsFieldMotif field="measurement" className="science-lab-physics" /><div className="science-lab-header-actions"><button onClick={() => setGuideOpen(true)}><Info size={16} />使用教学</button><button onClick={reset}><RotateCcw size={16} />重新开始</button></div></header>
    <div className={`balance-lab-sim stage-${stage} ${balanced ? "is-balanced" : ""}`} style={{ "--balance-angle": `${beamTilt}deg`, "--left-pan-y": `${leftPanY}px`, "--right-pan-y": `${rightPanY}px`, "--pointer-shift": `${beamTilt * 4}px` } as React.CSSProperties}>
      <div className="balance-procedure-strip" aria-label="实验步骤">
        {["游码归零并调平", "左物右码", "先砝码后游码", "平衡读数"].map((label, index) => <span className={index < stage ? "done" : index === stage ? "active" : ""} key={label}><b>{index < stage ? "✓" : index + 1}</b>{label}</span>)}
      </div>
      <div className="tray-balance-workbench">
        <div className="tray-balance-apparatus" aria-label="可交互托盘天平装置">
          <div className="tray-balance-dial"><span>左偏</span><div>{Array.from({ length: 13 }, (_, index) => <i className={index === 6 ? "zero" : ""} key={index} />)}</div><span>右偏</span><b style={{ transform: `translateX(calc(-50% + ${beamTilt * 4}px)) rotate(${beamTilt * 2.2}deg)` }} /></div>
          <div className="tray-balance-column"><i /></div>
          <div className="tray-balance-beam" style={{ transform: `translateX(-50%) rotate(${beamTilt}deg)` }}><i className="beam-nut left" /><i className="beam-nut right" /><span className="beam-center" /></div>
          <div className="tray-pan left" style={{ transform: `translateY(${leftPanY}px)` }}><i className="pan-cable" /><span>{objectPlaced ? <b className="unknown-sample"><small>待测</small><strong>?</strong></b> : <em>左盘放物</em>}</span></div>
          <div className="tray-pan right" style={{ transform: `translateY(${rightPanY}px)` }}><i className="pan-cable" /><span>{selectedWeightIds.length ? selectedWeightIds.map((id, index) => { const weight = trayBalanceWeights.find((item) => item.id === id)!; return <b className="pan-weight" style={{ "--weight-index": index } as React.CSSProperties} key={id}>{weight.mass}</b>; }) : <em>右盘放砝码</em>}</span></div>
          <div className="tray-balance-base"><Scale size={23} /><span>托盘天平</span><small>最大称量 200 g · 分度值 0.1 g</small></div>
        </div>
        <aside className="balance-operation-dock">
          <section className={!calibrated ? "active" : "done"}><header><b>01</b><span><small>ZERO & LEVEL</small><strong>归零与调平</strong></span></header><p>空载时先移动游码到零刻度，再用左右按钮调节平衡螺母。</p><div className="balance-nut-controls"><button onClick={() => adjustNut(-.1)} disabled={objectPlaced}>← 向左调</button><output>{Math.abs(nutOffset) <= .05 ? "指针对中" : nutOffset > 0 ? `右偏 ${Math.abs(nutOffset).toFixed(1)} 格` : `左偏 ${Math.abs(nutOffset).toFixed(1)} 格`}</output><button onClick={() => adjustNut(.1)} disabled={objectPlaced}>向右调 →</button></div></section>
          <section className={stage === 1 ? "active" : objectPlaced ? "done" : ""}><header><b>02</b><span><small>LEFT OBJECT</small><strong>左盘放待测物</strong></span></header><p>调平完成后才能放物。称量过程中不要再碰平衡螺母。</p><button className="balance-object-button" onClick={toggleObject} disabled={!calibrated && !objectPlaced}>{objectPlaced ? "取下物体，重新称量" : calibrated ? "把金属块放入左盘" : "完成调平后解锁"}</button></section>
          <section className={stage === 2 ? "active" : balanced ? "done" : ""}><header><b>03</b><span><small>WEIGHT BOX</small><strong>镊子取码 · 先大后小</strong></span></header><p className={weightOrderWarning ? "balance-order-warning" : ""}>{weightOrderWarning ? "刚才先用了小砝码或又回到更大砝码。读数仍保留，但更规范的操作是从大到小逐级试放。" : "先拿起镊子，再从大砝码开始逐级试放；砝码不能直接用手拿。"}</p><button className={`balance-tweezers-button ${tweezersHeld ? "active" : ""}`} disabled={!objectPlaced} onClick={() => setTweezersHeld((value) => !value)}><Pipette size={18} aria-hidden="true" />{tweezersHeld ? "镊子已拿起 · 可以取放砝码" : "拿起砝码镊子"}</button><div className="balance-weight-buttons">{trayBalanceWeights.map((weight) => <button className={selectedWeightIds.includes(weight.id) ? "selected" : ""} onClick={() => toggleWeight(weight.id, weight.mass)} disabled={!objectPlaced || !tweezersHeld} aria-pressed={selectedWeightIds.includes(weight.id)} key={weight.id}><i /><strong>{weight.mass}</strong><small>g</small></button>)}</div></section>
        </aside>
      </div>
      <div className="balance-rider-console">
        <div className="balance-rider-heading"><span><small>POISE SCALE / 游码标尺</small><strong>{rider.toFixed(1)} g</strong></span><p>{!calibrated ? "调平前必须归零" : objectPlaced ? "砝码接近后，用游码完成最后微调" : "空载调平阶段"}</p></div>
        <div className="balance-rider-scale"><div>{Array.from({ length: 51 }, (_, index) => <i className={index % 10 === 0 ? "major" : index % 5 === 0 ? "middle" : ""} key={index} />)}</div><span className="rider-labels"><b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5 g</b></span><input aria-label="移动游码" type="range" min="0" max="5" step="0.1" value={rider} onChange={(event) => changeRider(Number(event.target.value))} /></div>
      </div>
      <div className={`balance-live-guidance ${balanced ? "success" : ""}`}><Gauge size={21} /><span><small>{balanced ? "MEASUREMENT COMPLETE / 测量完成" : `CURRENT STEP / 当前步骤 ${stage + 1}`}</small><strong>{guidance}</strong></span></div>
    </div>
    <div className="science-controls balance-results"><ResultCell label="右盘砝码总质量" value={objectPlaced ? `${weightsTotal.toFixed(0)} g` : "等待放置物体"} pending={!objectPlaced} /><ResultCell label="游码示数" value={objectPlaced ? `${rider.toFixed(1)} g` : calibrated ? "等待称量" : "先归零调平"} pending={!objectPlaced} /><ResultCell label="待测物质量" value={balanced ? `${(weightsTotal + rider).toFixed(1)} g` : "平衡后解锁"} pending={!balanced} /></div>
    <section className="balance-repeatability"><header><span><ClipboardList size={16} /><b>重复称量检查</b></span><div><button disabled={!balanced || trialSaved} onClick={saveMeasurement}><Save size={14} />保存本次读数</button><button disabled={!trialSaved || measurements.length >= 2} onClick={startRepeat}><RotateCcw size={14} />重新独立称量</button></div></header><div>{[0,1].map((index) => <article className={measurements[index] !== undefined ? "done" : ""} key={index}><small>第 {index + 1} 次</small><strong>{measurements[index] !== undefined ? `${measurements[index]!.toFixed(1)} g` : "等待测量"}</strong></article>)}</div></section>
    {measurements.length > 0 && <EvidenceVerdict valid={repeatability.stable} title={repeatability.stable ? "两次独立称量结果一致" : "第一次读数已保存，还需要重新操作一次"} detail={repeatability.stable ? `平均测得质量为 ${repeatability.meanValue?.toFixed(1)} g，两次读数的最大相对偏差为 ${((repeatability.maxRelativeDeviation ?? 0) * 100).toFixed(2)}%。` : "取下物体后，游码重新归零、再次调平，再放物称量；不要直接重复点击保存。"} />}
  </div>;
}

function SoundConceptLab({ module }: { module: ScienceModuleMeta }) {
  if (module.key === "sound-medium") return <SoundMediumLab />;
  if (module.key === "sound-noise") return <SoundNoiseLab />;
  return <SoundEchoLab />;
}

function SoundEvidenceLedger({ title, columns, rows, onSave, saveDisabled }: { title: string; columns: string[]; rows: string[][]; onSave: () => void; saveDisabled: boolean }) {
  return <section className={`sound-measurement-ledger ${rows.length ? "" : "empty"}`}><header><span><ClipboardList size={16} /><b>{title}</b></span><button type="button" disabled={saveDisabled} onClick={onSave}><Save size={14} />保存当前读数</button></header>{rows.length ? <div style={{ "--sound-columns": columns.length + 1 } as React.CSSProperties}><b>组次</b>{columns.map((column) => <b key={column}>{column}</b>)}{rows.map((row, index) => <div className="sound-measurement-row" key={`${index}-${row.join("-")}`}><span>{index + 1}</span>{row.map((value, valueIndex) => <strong key={`${valueIndex}-${value}`}>{value}</strong>)}</div>)}</div> : <p>保存第一组作为基准，再按提示改变条件形成证据。</p>}</section>;
}

interface SoundMediumEvidence { id: number; air: number; distance: number; intensity: number; }
type StringPhoneCondition = "slack" | "taut" | "pinched";
const stringPhoneConditions: Record<StringPhoneCondition,{label:string;signal:number;note:string}> = {
  slack: { label:"棉线松弛", signal:18, note:"振动难以沿松弛棉线连续传递" },
  taut: { label:"棉线绷紧", signal:90, note:"杯底振动沿绷紧棉线传到接收杯" },
  pinched: { label:"手捏住棉线", signal:5, note:"传播通路被手指强烈阻尼" }
};

function SoundMediumLab() {
  const config = conceptConfigs["sound-medium"];
  const [air, setAir] = useState(config.initialA);
  const [distance, setDistance] = useState(config.initialB);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [microSnapshotCount, setMicroSnapshotCount] = useState(0);
  const [microPropagationReady, setMicroPropagationReady] = useState(false);
  const [evidence, setEvidence] = useState<SoundMediumEvidence[]>([]);
  const [phoneCondition,setPhoneCondition]=useState<StringPhoneCondition>("slack");
  const [phoneEvidence,setPhoneEvidence]=useState<StringPhoneCondition[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(air, distance);
  const particles = Math.max(0, Math.round(air / 5));
  const mediumPair = evidence.length >= 2 ? analyzeControlledComparison(
    [evidence.at(-2)!.air, evidence.at(-2)!.distance],
    [evidence.at(-1)!.air, evidence.at(-1)!.distance],
    evidence.at(-2)!.intensity,
    evidence.at(-1)!.intensity
  ) : undefined;
  const airContrast = evidence.length >= 2 ? analyzeTargetVariableComparison(
    [evidence.at(-2)!.air, evidence.at(-2)!.distance],
    [evidence.at(-1)!.air, evidence.at(-1)!.distance],
    evidence.at(-2)!.intensity,
    evidence.at(-1)!.intensity,
    0,
    40
  ) : undefined;
  const mediumChangedIndex = mediumPair?.changedIndexes[0];
  const airDifference = airContrast?.targetChange ?? 0;
  const airContrastReady = Boolean(airContrast?.validTargetComparison);
  const solidMediumReady = phoneEvidence.length === 3;
  const soundMediumLearningReady = airContrastReady && solidMediumReady;
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => { setAir((value) => value <= 0 ? 100 : Math.max(0, value - 2)); setInteracted(true); }, 85); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-medium", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "air", label: "空气保留程度", value: air, unit: "%", source: "control" }, { id: "distance", label: "接收距离", value: distance, unit: "m", source: "control" }
    ], apparatus: [{ id: "alarm", label: "闹钟振动", value: true, source: "apparatus" }, { id: "pump", label: "抽气扫描", value: running, source: "apparatus" }, { id: "micro-snapshots", label: "微观粒子分布快照", value: microSnapshotCount, unit: "张", source: "apparatus" }, { id:"string-phone-condition",label:"棉线电话状态",value:stringPhoneConditions[phoneCondition].label,source:"apparatus" }], readings: [
      { id: "intensity", label: "接收相对强度", value: interacted ? result.value : null, unit: result.unit, source: "reading" }, { id: "status", label: "听觉状态", value: interacted ? result.status : "等待操作", source: "reading" }, { id:"string-phone-signal",label:"棉线电话接收信号",value:stringPhoneConditions[phoneCondition].signal,unit:"%",source:"reading" }
    ], derived: [
      { id: "explanation", label: "证据解释", value: interacted ? result.detail : "等待形成对照", source: "model" },
      { id: "comparison", label: "最近两组公平比较", value: mediumPair?.valid ?? false, source: "model" },
      { id: "air-contrast", label: "固定距离的强空气量对照", value: airContrastReady, source: "model" },
      { id: "micro-propagation", label: "疏密区域传播判断正确", value: microPropagationReady, source: "model" },
      { id:"solid-medium",label:"固体棉线三状态对照",value:solidMediumReady,source:"model" }
    ], validity: { ready: soundMediumLearningReady, issues: soundMediumLearningReady ? [] : !airContrastReady ? (!interacted ? ["先抽走一部分空气，观察声源与接收端。"] : evidence.length < 2 ? ["保存基准组后，保持距离不变并让空气量相差至少40%。"] : !mediumPair?.valid ? ["最近两组同时改变了空气量和距离。"] : mediumChangedIndex !== 0 ? ["本任务要验证介质作用：保持距离不变，只改变空气量。"] : Math.abs(airDifference) < 40 ? ["空气量差异还不够明显，请让两组至少相差40%。"] : ["检查空气减少时接收强度是否随之减弱。"]) : ["依次记录棉线松弛、绷紧和手捏住三种状态，比较固体传声通路。"] } });
  }, [air, airContrastReady, airDifference, distance, evidence.length, interacted, mediumChangedIndex, mediumPair?.outcomeDirection, mediumPair?.valid, microPropagationReady, microSnapshotCount, phoneCondition, result.detail, result.status, result.unit, result.value, running, solidMediumReady, soundMediumLearningReady]);
  const change = (kind: "air" | "distance", value: number) => { setRunning(false); setInteracted(true); if (kind === "air") setAir(value); else setDistance(value); recordHarness("control.changed", { control: kind === "air" ? "空气保留程度" : "接收距离", value, unit: kind === "air" ? "%" : "m" }); };
  const saveEvidence = () => {
    if (!interacted || evidence.some((row) => row.air === air && row.distance === distance)) return;
    setEvidence((rows) => [...rows, { id: Date.now(), air, distance, intensity: result.value }].slice(-6));
    recordHarness("configuration.changed", { experiment: "sound-medium", control: "保存传声读数", value: `${air}%/${distance}m/${result.value.toFixed(1)}` });
  };
  return <LabFrame field="sound" experiment="sound-medium" eyebrow="BELL JAR / 玻璃罩传声" title="闹钟一直在振动，声音为什么会渐渐消失？" description="把声源是否振动、玻璃罩内是否有介质分开观察。抽气并不会让闹钟停止，而是改变振动传到接收器的条件。" running={running} onToggle={() => { setRunning(!running); setInteracted(true); }} playLabel="自动抽气" runningLabel="暂停抽气">
    <div className={`sound-apparatus sound-medium-apparatus ${air < 3 ? "near-vacuum" : ""}`} style={{ "--air": air / 100 } as React.CSSProperties}>
      <div className="sound-medium-status"><span><i />SOURCE STATUS</span><b>闹钟持续振动</b><small>改变的是传播条件，不是声源</small></div>
      <div className="bell-jar"><div className="alarm-clock"><i /><b /><span>声源</span></div><div className="air-particles">{Array.from({ length: particles }, (_, index) => <i style={{ "--particle-x": `${10 + (index * 37) % 78}%`, "--particle-y": `${14 + (index * 53) % 66}%`, "--particle-phase": `${-(((index * 37) % 78) / 78) * .72}s` } as React.CSSProperties} key={index} />)}</div><small className="particle-motion-note">粒子原地振动 · 疏密相位向前传递</small><span className="jar-pressure">AIR {air.toFixed(0)}%</span></div>
      <div className="medium-wave-path">{Array.from({ length: 5 }, (_, index) => <i style={{ "--ring": index } as React.CSSProperties} key={index} />)}</div>
      <div className="sound-receiver" style={{ right: `${5 + (1 - distance / 12) * 16}%` }}><Ear size={30} /><span><small>RECEIVER</small><strong>{interacted ? result.status : "等待比较"}</strong></span><i><b style={{ height: `${Math.min(100, result.value)}%` }} /></i></div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Activity size={18} /><span><small>当前证据</small><strong>{interacted ? `${air.toFixed(0)}% 空气 · ${distance.toFixed(1)} m · ${result.value.toFixed(1)} 相对强度` : "先改变空气量或距离"}</strong><em>{interacted ? air < 3 ? "声源仍振动，但几乎没有空气传递机械振动。" : "比较时注意一次只改变空气量或距离。" : "装置尚未形成第一组读数"}</em></span></div>
      {!interacted && <InteractionCue text="先抽走一部分空气，观察声源和接收端" />}
    </div>
    <Suspense fallback={<ScienceModuleLoading title="声波粒子显微镜" />}><SoundParticleMicroscope onSnapshotCountChange={setMicroSnapshotCount} onPropagationReadyChange={setMicroPropagationReady} /></Suspense>
    <section className={`string-phone-lab condition-${phoneCondition} ${solidMediumReady?"complete":""}`}><header><span><Cable size={17}/><b>STRING TELEPHONE / 固体传声诊断</b></span><small>{solidMediumReady?"三种通路状态已完成":"同一声源，只改变棉线状态"}</small></header><div className="string-phone-apparatus"><article><Mic2 size={25}/><span><small>SOURCE CUP</small><strong>发声纸杯</strong></span></article><div className="string-phone-line"><i/><b>{phoneCondition==="pinched"?"手指捏住":phoneCondition==="taut"?"绷紧棉线":"松弛棉线"}</b></div><article><Ear size={25}/><span><small>RECEIVER CUP</small><strong>接收 {stringPhoneConditions[phoneCondition].signal}%</strong></span></article></div><div className="string-phone-controls">{(Object.keys(stringPhoneConditions) as StringPhoneCondition[]).map(condition=><button className={phoneCondition===condition?"active":phoneEvidence.includes(condition)?"done":""} onClick={()=>setPhoneCondition(condition)} key={condition}><strong>{stringPhoneConditions[condition].label}</strong><small>{stringPhoneConditions[condition].note}</small></button>)}<button className="record" disabled={phoneEvidence.includes(phoneCondition)} onClick={()=>{setPhoneEvidence(items=>Array.from(new Set([...items,phoneCondition])));recordHarness("configuration.changed",{experiment:"sound-medium",control:"棉线电话传声",value:`${stringPhoneConditions[phoneCondition].label}/${stringPhoneConditions[phoneCondition].signal}%`});}}><Save size={14}/>记录当前接收信号</button></div>{phoneEvidence.length>0&&<EvidenceVerdict valid={solidMediumReady} title={solidMediumReady?"绷紧固体棉线能够传递振动":"继续补齐三种棉线状态"} detail={solidMediumReady?"同一声源下，绷紧棉线接收最强；松线传递较弱，捏住棉线会吸收振动。说明固体可以传声，但需要连续、合适的机械振动通路。":`已记录 ${phoneEvidence.length}/3 种状态，保持纸杯和距离不变。`}/>}</section>
    <div className="science-controls"><ScienceRange label="空气保留程度" value={air} min={0} max={100} step={1} unit="%" onChange={(value) => change("air", value)} /><ScienceRange label="接收距离" value={distance} min={1} max={12} step={.5} unit="m" onChange={(value) => change("distance", value)} /><ResultCell label="接收状态" value={interacted ? result.status : "等待第一次操作"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="玻璃罩传声记录" columns={["空气/%", "距离/m", "相对强度"]} rows={evidence.map((row) => [row.air.toFixed(0), row.distance.toFixed(1), row.intensity.toFixed(1)])} onSave={saveEvidence} saveDisabled={!interacted || evidence.some((row) => row.air === air && row.distance === distance)} />
    {evidence.length > 0 && <EvidenceVerdict valid={soundMediumLearningReady} title={soundMediumLearningReady ? "空气与固体两条介质证据均已完成" : airContrastReady?"空气介质证据成立，还需完成棉线电话":"还没有形成足够有力的空气介质证据"} detail={soundMediumLearningReady?"玻璃罩对照说明空气减少时传声减弱；棉线电话对照说明绷紧固体能传递振动，而通路受阻会使信号显著减弱。":evidence.length < 2 ? "把当前组作为基准，保持接收距离不变，再让空气量至少相差40%。" : !mediumPair?.valid ? "请把接收距离调回上一组，只改变空气量。" : mediumChangedIndex !== 0 ? "改变距离只能研究传播衰减，不能直接验证介质是否必要。" : airContrastReady?"依次记录棉线松弛、绷紧和手捏住三种状态。":Math.abs(airDifference) < 40 ? `两组空气量只相差 ${Math.abs(airDifference).toFixed(0)}%，继续扩大差异。` : `距离保持不变，空气量变化 ${Math.abs(airDifference).toFixed(0)}%，接收强度随空气减少而减弱。`} />}
  </LabFrame>;
}

const noiseMeasures = [
  { id: "source", label: "声源控制", note: "安装消声器", attenuation: 12, icon: Volume2 },
  { id: "path", label: "传播阻隔", note: "升起隔音屏", attenuation: 18, icon: Shield },
  { id: "receiver", label: "接收防护", note: "佩戴防护耳罩", attenuation: 15, icon: Ear }
] as const;
interface SoundNoiseEvidence { id: number; measure: string; label: string; sourceLevel: number; receiverLevel: number; attenuation: number; }

function SoundNoiseLab() {
  const config = conceptConfigs["sound-noise"];
  const [sourceLevel, setSourceLevel] = useState(config.initialA);
  const [activeMeasures, setActiveMeasures] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [evidence, setEvidence] = useState<SoundNoiseEvidence[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const attenuation = noiseMeasures.filter((item) => activeMeasures.includes(item.id)).reduce((sum, item) => sum + item.attenuation, 0);
  const result = config.calculate(sourceLevel, attenuation);
  const testedMeasures = new Set(evidence.map((row) => row.measure));
  const noiseEvidenceReady = testedMeasures.size === noiseMeasures.length && evidence.every((row) => row.sourceLevel === sourceLevel);
  useEffect(() => { if (!running) return; const states: string[][] = [[], ["source"], ["path"], ["receiver"], ["source", "path", "receiver"]]; let index = 0; const timer = window.setInterval(() => { index = (index + 1) % states.length; setActiveMeasures(states[index]); setInteracted(true); }, 1100); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-noise", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "source-level", label: "声源处声级", value: sourceLevel, unit: "dB", source: "control" }, { id: "attenuation", label: "总等效衰减", value: attenuation, unit: "dB", source: "control" }
    ], apparatus: noiseMeasures.map((item) => ({ id: item.id, label: item.label, value: activeMeasures.includes(item.id), source: "apparatus" as const })), readings: [
      { id: "receiver-level", label: "接收处声级", value: interacted ? result.value : null, unit: "dB", source: "reading" }, { id: "status", label: "接收状态", value: interacted ? result.status : "等待操作", source: "reading" }
    ], derived: [
      { id: "boundary", label: "模型说明", value: result.detail, source: "model" },
      { id: "three-links", label: "三环节单独测试完成", value: noiseEvidenceReady, source: "model" }
    ], validity: { ready: noiseEvidenceReady, issues: noiseEvidenceReady ? [] : !interacted ? ["至少启用一种控制噪声的措施。"] : activeMeasures.length !== 1 ? ["每次只启用一种措施，才能比较三个控制环节。"] : [`还需单独测试 ${noiseMeasures.length - testedMeasures.size} 个控制环节。`] } });
  }, [activeMeasures, attenuation, evidence.length, interacted, noiseEvidenceReady, result.detail, result.status, result.value, sourceLevel, testedMeasures.size]);
  const toggleMeasure = (id: string) => { setRunning(false); setInteracted(true); setActiveMeasures((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); recordHarness("configuration.changed", { control: "噪声控制环节", value: id }); };
  const saveEvidence = () => {
    if (activeMeasures.length !== 1 || testedMeasures.has(activeMeasures[0]!)) return;
    const measure = noiseMeasures.find((item) => item.id === activeMeasures[0])!;
    setEvidence((rows) => [...rows, { id: Date.now(), measure: measure.id, label: measure.label, sourceLevel, receiverLevel: result.value, attenuation }]);
    recordHarness("configuration.changed", { experiment: "sound-noise", control: "保存单措施读数", value: `${measure.label}/${result.value.toFixed(0)}dB` });
  };
  return <LabFrame field="sound" experiment="sound-noise" eyebrow="NOISE CONTROL / 三道防线" title="同一种噪声，在哪个环节减弱更有效？" description="依次尝试声源、传播途中和接收端措施。接收处声级按等效声级差比较，不把分贝当作普通百分比相减。" running={running} onToggle={() => { setRunning(!running); setInteracted(true); }} playLabel="自动轮换措施" runningLabel="暂停比较">
    <div className="sound-apparatus sound-noise-apparatus" style={{ "--noise-level": Math.max(0, Math.min(1, result.value / 110)) } as React.CSSProperties}>
      <div className="noise-route"><article className={activeMeasures.includes("source") ? "protected" : ""}><i><Volume2 size={27} /></i><span><small>01 / SOURCE</small><b>交通声源</b><em>{activeMeasures.includes("source") ? "消声器已启用 −12 dB" : `${sourceLevel.toFixed(0)} dB`}</em></span></article><div className={`noise-barrier ${activeMeasures.includes("path") ? "raised" : ""}`}><Shield size={28} /><span>{activeMeasures.includes("path") ? "隔音屏工作中" : "传播路径开放"}</span></div><div className="noise-wave-stream">{Array.from({ length: 7 }, (_, index) => <i style={{ "--wave": index } as React.CSSProperties} key={index} />)}</div><article className={activeMeasures.includes("receiver") ? "protected" : ""}><i>{activeMeasures.includes("receiver") ? <VolumeX size={27} /> : <Ear size={27} />}</i><span><small>03 / RECEIVER</small><b>接收位置</b><em>{interacted ? `${result.value.toFixed(0)} dB` : "等待措施"}</em></span></article></div>
      <div className="noise-measure-panel">{noiseMeasures.map((item) => { const MeasureIcon = item.icon; const active = activeMeasures.includes(item.id); return <button className={active ? "active" : ""} type="button" aria-pressed={active} onClick={() => toggleMeasure(item.id)} key={item.id}><MeasureIcon size={18} /><span><small>{item.label}</small><b>{item.note}</b></span><em>{active ? `−${item.attenuation} dB` : "点击启用"}</em></button>; })}</div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Gauge size={18} /><span><small>接收处声级</small><strong>{interacted ? `${sourceLevel.toFixed(0)} − ${attenuation} = ${result.value.toFixed(0)} dB` : "先选择一种控制措施"}</strong><em>{interacted ? result.status : "从声源、传播途中或接收端开始"}</em></span></div>
    </div>
    <div className="science-controls"><ScienceRange label="声源处声级" value={sourceLevel} min={40} max={110} step={1} unit="dB" onChange={(value) => { setRunning(false); setInteracted(true); setSourceLevel(value); setEvidence([]); }} /><ResultCell label="等效衰减量" value={interacted ? `${attenuation} dB` : "等待选择措施"} pending={!interacted} /><ResultCell label="接收处" value={interacted ? `${result.value.toFixed(0)} dB · ${result.status}` : "等待第一次操作"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="三环节降噪对照" columns={["单独措施", "衰减/dB", "接收处/dB"]} rows={evidence.map((row) => [row.label, row.attenuation.toFixed(0), row.receiverLevel.toFixed(0)])} onSave={saveEvidence} saveDisabled={activeMeasures.length !== 1 || testedMeasures.has(activeMeasures[0] ?? "")} />
    {evidence.length > 0 && <EvidenceVerdict valid={noiseEvidenceReady} title={noiseEvidenceReady ? "三种控制环节已经完成同源对照" : "继续逐项测试，暂不比较组合措施"} detail={noiseEvidenceReady ? `${[...evidence].sort((a, b) => b.attenuation - a.attenuation)[0]!.label}在当前模型中的单项衰减最大；实际工程通常综合使用。` : `已完成 ${testedMeasures.size}/3 项，保持声源声级不变且每次只开启一种措施。`} />}
  </LabFrame>;
}

interface SoundEchoEvidence { id: number; time: number; speed: number; distance: number; }

function SoundEchoLab() {
  const config = conceptConfigs["sound-echo"];
  const [time, setTime] = useState(config.initialA);
  const [speed, setSpeed] = useState(config.initialB);
  const [running, setRunning] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [evidence, setEvidence] = useState<SoundEchoEvidence[]>([]);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(time, speed);
  const targetPosition = 47 + Math.min(38, result.value / 45 * 38);
  const echoEvidence = analyzeProportionalEvidence(evidence.map((row) => ({ x: row.time, y: row.distance })));
  useEffect(() => {
    publishApparatusSnapshot({ module: "sound-echo", capturedAt: new Date().toISOString(), origin: interacted ? "learner" : "system", controls: [
      { id: "echo-time", label: "回声往返时间", value: time, unit: "ms", source: "control" }, { id: "sound-speed", label: "介质中的声速", value: speed, unit: "m/s", source: "control" }
    ], apparatus: [{ id: "pulse", label: "超声脉冲", value: running, source: "apparatus" }], readings: [
      { id: "distance", label: "目标距离", value: interacted ? result.value : null, unit: "m", source: "reading" }, { id: "round-trip", label: "声波总路程", value: interacted ? result.value * 2 : null, unit: "m", source: "reading" }
    ], derived: [
      { id: "formula", label: "计算关系", value: `${speed} × ${(time / 1000).toFixed(3)} ÷ 2`, source: "model" },
      { id: "time-distance", label: "同介质距离与往返时间成正比", value: echoEvidence.proportional, source: "model" }
    ], validity: { ready: echoEvidence.proportional, issues: !interacted ? ["发射一次脉冲或改变往返时间。"] : !echoEvidence.enoughPoints ? ["保持介质声速不变，记录三个不同往返时间。"] : !echoEvidence.proportional ? ["检查距离与往返时间的比值是否稳定。"] : [] } });
  }, [echoEvidence.enoughPoints, echoEvidence.proportional, evidence.length, interacted, result.value, running, speed, time]);
  const change = (kind: "time" | "speed", value: number) => { setInteracted(true); if (kind === "time") setTime(value); else { setSpeed(value); setEvidence([]); } recordHarness("control.changed", { control: kind === "time" ? "回声往返时间" : "介质中的声速", value, unit: kind === "time" ? "ms" : "m/s" }); };
  const saveEvidence = () => {
    if (!interacted || evidence.some((row) => row.time === time)) return;
    setEvidence((rows) => [...rows, { id: Date.now(), time, speed, distance: result.value }].slice(-6));
    recordHarness("configuration.changed", { experiment: "sound-echo", control: "保存测距点", value: `${time}ms/${result.value.toFixed(2)}m` });
  };
  return <LabFrame field="sound" experiment="sound-echo" eyebrow="ULTRASONIC RANGE / 超声测距" title="回声计时器测到的，为什么是两段路程？" description="发射脉冲，沿着“去程—反射—回程”追踪声音。仪器记录的是完整往返时间，目标距离只取总路程的一半。" running={running} onToggle={() => { setRunning((value) => !value); setInteracted(true); }} playLabel="发射超声脉冲" runningLabel="停止连续发射">
    <div className={`sound-apparatus sound-echo-apparatus ${running ? "is-pulsing" : ""}`} style={{ "--target-x": `${targetPosition}%`, "--echo-duration": `${Math.max(.8, time / 35)}s` } as React.CSSProperties}>
      <div className="echo-grid-label"><RadioTower size={17} /><span>ULTRASONIC PATH TRACKER</span><b>{speed.toFixed(0)} m/s</b></div><div className="echo-emitter"><RadioTower size={34} /><span><small>TX / RX</small><b>发射与接收</b></span></div><div className="echo-target"><i /><span><small>TARGET</small><b>反射目标</b></span></div>
      <div className="echo-path outbound"><i /><span>去程 s</span></div><div className="echo-path inbound"><i /><span>回程 s</span></div><div className="echo-pulse outbound-pulse" /><div className="echo-pulse inbound-pulse" />
      <div className="echo-timer"><TimerReset size={22} /><span><small>ROUND TRIP TIME</small><strong>{interacted ? `${time.toFixed(0)} ms` : "— —"}</strong></span></div>
      <div className={`sound-evidence-console ${interacted ? "ready" : ""}`}><Activity size={18} /><span><small>距离计算</small><strong>{interacted ? `${speed.toFixed(0)} × ${(time / 1000).toFixed(3)} ÷ 2 = ${result.value.toFixed(2)} m` : "发射一次脉冲"}</strong><em>{interacted ? `声波总路程 ${(result.value * 2).toFixed(2)} m，目标单程距离 ${result.value.toFixed(2)} m。` : "观察去程和回程两条路径"}</em></span></div>
      {!interacted && <InteractionCue text="发射一次脉冲，追踪去程与回程" />}
    </div>
    <div className="science-controls"><ScienceRange label="回声往返时间" value={time} min={2} max={120} step={1} unit="ms" onChange={(value) => change("time", value)} /><ScienceRange label="介质中的声速" value={speed} min={300} max={1500} step={10} unit="m/s" onChange={(value) => change("speed", value)} /><ResultCell label="目标距离" value={interacted ? `${result.value.toFixed(2)} m` : "等待发射脉冲"} pending={!interacted} /></div>
    <SoundEvidenceLedger title="超声测距数据" columns={["往返时间/ms", "声速/(m/s)", "距离/m"]} rows={evidence.map((row) => [row.time.toFixed(0), row.speed.toFixed(0), row.distance.toFixed(2)])} onSave={saveEvidence} saveDisabled={!interacted || evidence.some((row) => row.time === time)} />
    {evidence.length > 0 && <EvidenceVerdict valid={echoEvidence.proportional} title={echoEvidence.proportional ? "三点证据支持同介质中的时间—距离关系" : "测量点还不足以支持比例关系"} detail={echoEvidence.enoughPoints ? `距离/往返时间的最大相对偏差为 ${((echoEvidence.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%；计算中仍需除以2。` : `保持声速 ${speed} m/s 不变，还需记录 ${3 - echoEvidence.distinctXCount} 个不同时间点。`} />}
  </LabFrame>;
}

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
  const config = conceptConfigs[module.key as ConceptLabKey];
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

const soundTimbreNames = { sine: "纯音", triangle: "柔和复合音", square: "明亮复合音" } as const;
type SoundFeatureFactor = "frequency" | "amplitude" | "timbre";
const soundFeatureLabels: Record<SoundFeatureFactor,{ control:string; observation:string }> = {
  frequency: { control: "频率 f", observation: "音调与周期" },
  amplitude: { control: "振幅 A", observation: "响度与波高" },
  timbre: { control: "波形", observation: "音色与形状" }
};

function SoundLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [frequency, setFrequency] = useState(330);
  const [amplitude, setAmplitude] = useState(42);
  const [timbre, setTimbre] = useState<"sine" | "triangle" | "square">("sine");
  const [baseline, setBaseline] = useState<{ frequency: number; amplitude: number; timbre: "sine" | "triangle" | "square" }>();
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [featureEvidence, setFeatureEvidence] = useState<SoundFeatureFactor[]>([]);
  const audioRef = useRef<{ context: AudioContext; oscillator: OscillatorNode; gain: GainNode } | undefined>(undefined);
  const phase = useClock(playing, 0.075);
  const waveValue = (angle: number, kind: typeof timbre) => kind === "sine" ? Math.sin(angle) : kind === "triangle" ? 2 / Math.PI * Math.asin(Math.sin(angle)) : Math.sign(Math.sin(angle));
  const points = Array.from({ length: 101 }, (_, i) => { const x = i * 7.8; const y = 120 + waveValue(i / 100 * Math.PI * 2 * (frequency / 55) + phase * Math.PI * 2, timbre) * amplitude; return `${x},${y}`; }).join(" ");
  const baselinePoints = baseline ? Array.from({ length: 101 }, (_, i) => { const x = i * 7.8; const y = 120 + waveValue(i / 100 * Math.PI * 2 * (baseline.frequency / 55), baseline.timbre) * baseline.amplitude; return `${x},${y}`; }).join(" ") : "";
  const pitch = frequency < 275 ? "音调较低" : frequency < 495 ? "音调中等" : "音调较高";
  const loudness = amplitude < 28 ? "响度较小" : amplitude < 54 ? "响度中等" : "响度较大";
  const periodMilliseconds = 1000 / frequency;
  const soundComparison = baseline ? analyzeControlledComparison(
    [baseline.frequency, baseline.amplitude, baseline.timbre],
    [frequency, amplitude, timbre],
    0,
    0
  ) : undefined;
  const currentFeature: SoundFeatureFactor | undefined = soundComparison?.valid ? (["frequency","amplitude","timbre"] as const)[soundComparison.changedIndexes[0]!] : undefined;
  const soundLearningReady = featureEvidence.length === 3;
  useEffect(() => { if (!playing || !audioRef.current) return; audioRef.current.oscillator.frequency.setTargetAtTime(frequency, audioRef.current.context.currentTime, .02); audioRef.current.gain.gain.setTargetAtTime(.008 + amplitude / 4200, audioRef.current.context.currentTime, .02); audioRef.current.oscillator.type = timbre; }, [amplitude, frequency, playing, timbre]);
  useEffect(() => () => { try { audioRef.current?.oscillator.stop(); void audioRef.current?.context.close(); } catch { /* already closed */ } }, []);
  const toggleSound = () => {
    if (playing) { try { audioRef.current?.oscillator.stop(); void audioRef.current?.context.close(); } catch { /* already closed */ } audioRef.current = undefined; setPlaying(false); return; }
    const AudioContextType = window.AudioContext;
    const context = new AudioContextType(); const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = timbre; oscillator.frequency.value = frequency; gain.gain.value = .008 + amplitude / 4200; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); audioRef.current = { context, oscillator, gain }; setPlaying(true); setInteracted(true);
  };
  useEffect(() => {
    publishApparatusSnapshot({
      module: "sound-features",
      capturedAt: new Date().toISOString(),
      origin: interacted ? "learner" : "system",
      controls: [
        { id: "frequency", label: "振动频率", value: frequency, unit: "Hz", source: "control" },
        { id: "amplitude", label: "相对振幅", value: amplitude, unit: "%", source: "control" }
      ],
      apparatus: [
        { id: "source-on", label: "声源开关", value: playing, source: "apparatus" }, { id: "timbre", label: "声源音色", value: soundTimbreNames[timbre], source: "apparatus" }, { id: "baseline", label: "已保存基准", value: Boolean(baseline), source: "apparatus" }
      ],
      readings: [
        { id: "pitch", label: "音调观察", value: interacted ? pitch : "等待操作", source: "reading" },
        { id: "wave-height", label: "波形相对高度", value: interacted ? amplitude : null, unit: "%", source: "reading" }, { id: "loudness", label: "响度观察", value: interacted ? loudness : "等待操作", source: "reading" },
        { id: "period", label: "振动周期", value: interacted ? periodMilliseconds : null, unit: "ms", source: "reading" }
      ],
      derived: [
        { id: "cycles", label: "时间窗内相对周期数", value: Math.round(frequency / 55), unit: "周期/视窗", source: "model" },
        { id: "baseline-comparison", label: "基准与当前只改变一项", value: soundComparison?.valid ?? false, source: "model" },
        { id: "frequency-evidence", label: "频率—音调证据", value: featureEvidence.includes("frequency"), source: "model" },
        { id: "amplitude-evidence", label: "振幅—响度证据", value: featureEvidence.includes("amplitude"), source: "model" },
        { id: "timbre-evidence", label: "波形—音色证据", value: featureEvidence.includes("timbre"), source: "model" }
      ],
      validity: { ready: soundLearningReady, issues: soundLearningReady ? [] : !interacted ? ["先启动声源或改变一个参数，生成第一组波形。"] : !baseline ? ["先保存当前波形作为基准。"] : soundComparison?.valid ? [`记录本次${soundFeatureLabels[currentFeature!].control}单变量对照。`] : [soundComparison?.changedIndexes.length === 0 ? "基准与当前完全相同，请只改变一个条件。" : "相对基准同时改变了多个条件，请调回其中一项。"] }
    });
  }, [amplitude, baseline, currentFeature, featureEvidence, frequency, interacted, loudness, periodMilliseconds, pitch, playing, soundComparison?.changedIndexes.length, soundComparison?.valid, soundLearningReady, timbre]);
  const interact = () => setInteracted(true);
  const recordFeatureComparison = () => {
    if (!currentFeature) return;
    setFeatureEvidence((items) => Array.from(new Set([...items,currentFeature])));
    recordHarness("configuration.changed", { experiment: "sound-features", control: "记录三要素证据", value: `${soundFeatureLabels[currentFeature].control}→${soundFeatureLabels[currentFeature].observation}` });
  };
  return <LabFrame field="sound" experiment="sound-features" eyebrow="ACOUSTIC OSCILLOSCOPE / 声学示波器" title="波形变高、变密、变形，分别意味着什么？" description="先保存一条基准波形，再只改变频率、振幅或声源波形中的一个。试听采用很低的输出增益，仍请保持设备音量适中。" running={playing} onToggle={toggleSound} playLabel="低音量试听" runningLabel="停止试听">
    <div className="sound-sim sound-oscilloscope"><div className={`speaker ${playing ? "playing" : ""}`} style={{ "--vibration": `${Math.max(2, amplitude / 10)}px` } as React.CSSProperties}><i /><b /></div><div className="oscilloscope-label"><Activity size={15} /><span>CH 01 · TIME TRACE / 时间波形</span><b>{soundTimbreNames[timbre]}</b></div><svg viewBox="0 0 780 240" preserveAspectRatio="none">{baseline && <polyline className="baseline-wave" points={baselinePoints} />}<polyline points={interacted ? points : "0,120 780,120"} /></svg><div className="sound-particles">{interacted && Array.from({ length: 12 }, (_, i) => <i style={{ animationDelay: `${-i * .13}s`, opacity: amplitude / 70 }} key={i} />)}</div><div className={`sound-readout ${interacted ? "" : "awaiting-reading"}`}><span>{baseline ? "当前 / 基准对照" : interacted ? "当前时间波形" : "等待声源"}</span><strong>{interacted ? `${pitch} · ${loudness}` : "— —"}</strong><small>{interacted ? `${frequency.toFixed(0)} Hz · T ${periodMilliseconds.toFixed(2)} ms · A ${amplitude}%` : "先启动或调整参数"}</small></div>{!interacted && <InteractionCue text="启动声源，观察第一条波形" />}</div>
    <div className="sound-comparison-console"><section><span><small>CONTROL VARIABLE / 对照实验</small><b>{baseline ? `基准：${baseline.frequency} Hz · A ${baseline.amplitude}% · ${soundTimbreNames[baseline.timbre]}` : "还没有保存基准波形"}</b></span><button type="button" onClick={() => { setBaseline({ frequency, amplitude, timbre }); setInteracted(true); recordHarness("configuration.changed", { control: "基准波形", value: `${frequency}Hz/A${amplitude}/${timbre}` }); }}><Focus size={15} />{baseline ? "更新基准" : "保存当前为基准"}</button>{baseline && <button type="button" onClick={() => setBaseline(undefined)}><RotateCcw size={14} />清除</button>}</section><div>{(["sine", "triangle", "square"] as const).map((kind) => <button className={timbre === kind ? "active" : ""} type="button" onClick={() => { setTimbre(kind); setInteracted(true); recordHarness("configuration.changed", { control: "声源波形", value: kind }); }} key={kind}><Waves size={15} /><span><small>{kind.toUpperCase()}</small><b>{soundTimbreNames[kind]}</b></span></button>)}</div></div>
    <div className="science-controls"><ScienceRange label="振动频率" value={frequency} min={110} max={715} step={11} unit="Hz" onChange={setFrequency} onInteract={interact} /><ScienceRange label="相对振幅" value={amplitude} min={8} max={70} step={1} unit="%" onChange={setAmplitude} onInteract={interact} /><ResultCell label="证据提醒" value={baseline ? "只改变一个条件，再与灰色基准波比较" : "先保存一条基准波形"} pending={!baseline} /></div>
    <section className="sound-feature-matrix"><header><span><ClipboardList size={16}/><b>THREE-FACTOR EVIDENCE / 三要素证据矩阵</b></span><button disabled={!currentFeature} onClick={recordFeatureComparison}><Save size={14}/>{currentFeature ? `记录${soundFeatureLabels[currentFeature].control}对照` : "先形成单变量对照"}</button></header><div>{(Object.keys(soundFeatureLabels) as SoundFeatureFactor[]).map((factor,index) => <article className={featureEvidence.includes(factor) ? "complete" : currentFeature === factor ? "ready" : ""} key={factor}><span>0{index + 1}</span><small>控制量</small><strong>{soundFeatureLabels[factor].control}</strong><i>→</i><small>观察量</small><b>{soundFeatureLabels[factor].observation}</b><em>{featureEvidence.includes(factor) ? "证据已记录" : currentFeature === factor ? "当前可记录" : "等待对照"}</em></article>)}</div></section>
    {baseline && <EvidenceVerdict valid={soundLearningReady} title={soundLearningReady ? "频率、振幅与波形三项证据已闭环" : soundComparison?.valid ? "当前是合格单变量对照，记录后继续下一项" : "基准已保存，但对照条件还不合格"} detail={soundLearningReady ? "三个独立对照分别支持：频率影响音调和周期，振幅影响响度与波高，不同波形对应不同音色。" : soundComparison?.valid ? `本次只改变了${soundFeatureLabels[currentFeature!].control}；记录后更新基准，再研究尚未完成的条件。` : soundComparison?.changedIndexes.length === 0 ? "请改变频率、振幅或音色中的一个。" : "当前同时改变了两项或三项，请恢复其他控制量。"} />}
  </LabFrame>;
}

interface SpeedEvidence { id: number; length: number; height: number; time: number; speed: number; }

function SpeedLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [length, setLength] = useState(1.2);
  const [height, setHeight] = useState(.2);
  const [startGate, setStartGate] = useState(false);
  const [finishGate, setFinishGate] = useState(false);
  const [cartPlaced, setCartPlaced] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastRun, setLastRun] = useState<{time:number;speed:number}>();
  const [prediction, setPrediction] = useState<"faster"|"same"|"slower">();
  const [evidence,setEvidence]=useState<SpeedEvidence[]>([]);
  const model=calculateInclinedCartRun(length,height);
  const setupReady=startGate&&finishGate&&cartPlaced;
  const speedPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.length,evidence[1]!.height],[evidence[0]!.length,evidence[0]!.height],evidence[1]!.speed,evidence[0]!.speed,.0001):undefined;
  const latestSpeedChangedIndex=speedPair?.changedIndexes[0];
  const latestHeightComparison=evidence.length>=2?analyzeTargetVariableComparison([evidence[1]!.length,evidence[1]!.height],[evidence[0]!.length,evidence[0]!.height],evidence[1]!.speed,evidence[0]!.speed,1,.1,"same-direction",.0001):undefined;
  const heightComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>analyzeTargetVariableComparison([older.length,older.height],[newer.length,newer.height],older.speed,newer.speed,1,.1,"same-direction",.0001))),[evidence]);
  const validHeightComparison=heightComparisons.find(comparison=>comparison.validTargetComparison);
  const speedEvidenceReady=Boolean(validHeightComparison);
  const speedPredictionMatched=Boolean(prediction&&validHeightComparison&&((prediction==="faster"&&validHeightComparison.outcomeDirection==="increase")||(prediction==="same"&&validHeightComparison.outcomeDirection==="same")||(prediction==="slower"&&validHeightComparison.outcomeDirection==="decrease")));
  const speedConclusion=validHeightComparison?{valid:true,title:"高度强对照成立：路程保持不变",detail:`轨道高度变化 ${Math.abs(validHeightComparison.targetChange).toFixed(1)} m，平均速度${validHeightComparison.outcomeDirection==="increase"?"随之增大":"随之减小"}。${speedPredictionMatched?"证据与预测一致。":"请依据这组证据核对或修正预测。"}`} : !speedPair?undefined:!speedPair.valid?{valid:false,title:"最近两次测量不能直接比较",detail:"路程和轨道高度应只改变一个；保持两个条件都不变属于重复测量，不能检验高度的影响。"}:latestSpeedChangedIndex===0?{valid:false,title:"这组数据研究的是路程，不是轨道高度",detail:"本任务仍允许保存这组探索数据，但要形成结论，请保持光电门间路程不变，并让轨道高度至少变化 0.1 m。"}:!latestHeightComparison?.minimumChangeMet?{valid:false,title:"高度变化量还不足",detail:"保持光电门间路程不变，让轨道高度至少变化 0.1 m，再完成一次计时。"}:{valid:false,title:"高度已单独改变，但数据趋势需要复核",detail:"检查小车是否从静止释放、起终点光电门是否完整，并重新测量。"};
  useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setProgress(value=>Math.min(100,value+2.5)),35);return()=>window.clearInterval(timer);},[running]);
  useEffect(()=>{if(progress<100||!running)return;setRunning(false);setLastRun({time:model.timeSeconds,speed:model.averageSpeed});recordHarness("configuration.changed",{experiment:"mechanics-speed",control:"光电门计时完成",value:model.timeSeconds.toFixed(3),unit:"s"});},[model.averageSpeed,model.timeSeconds,progress,recordHarness,running]);
  const resetSetup=()=>{setStartGate(false);setFinishGate(false);setCartPlaced(false);setRunning(false);setProgress(0);setLastRun(undefined);};
  const release=()=>{if(!setupReady)return;setLastRun(undefined);setProgress(0);setRunning(true);};
  const save=()=>{if(!lastRun)return;const row={id:Date.now(),length,height,time:lastRun.time,speed:lastRun.speed};setEvidence(items=>[row,...items.filter(item=>item.length!==length||item.height!==height)].slice(0,8));recordHarness("configuration.changed",{experiment:"mechanics-speed",control:"保存速度测量",value:`${length}m/${lastRun.time.toFixed(3)}s/${lastRun.speed.toFixed(3)}m/s`});};
  useEffect(()=>{const issues=speedEvidenceReady?[]:!startGate?["安装起点光电门。"]:!finishGate?["安装终点光电门，并确认两门间路程。"]:!cartPlaced?["把小车停在起点门前并保持静止。"]:!lastRun?["释放小车，让计时器自动记录通过时间。"]:evidence.length<2?["保持光电门间路程不变，让轨道高度至少变化 0.1 m，形成第二组数据。"]:speedPair&&!speedPair.valid?["最近两组同时改变了路程和高度，不能检验高度的影响。"]:latestSpeedChangedIndex===0?["最近两组只改变了路程；请固定路程、改换轨道高度。"]:["请复核释放方式与计时数据，使速度变化方向与高度变化方向一致。"];publishApparatusSnapshot({module:"mechanics-speed",capturedAt:new Date().toISOString(),origin:startGate||finishGate||cartPlaced||evidence.length?"learner":"system",controls:[{id:"length",label:"光电门间路程",value:length,unit:"m",source:"control"},{id:"height",label:"轨道竖直高度",value:height,unit:"m",source:"control"},{id:"prediction",label:"增大高度后的预测",value:prediction==="faster"?"平均速度增大":prediction==="same"?"不变":prediction==="slower"?"减小":"未选择",source:"control"}],apparatus:[{id:"start-gate",label:"起点光电门已安装",value:startGate,source:"apparatus"},{id:"finish-gate",label:"终点光电门已安装",value:finishGate,source:"apparatus"},{id:"cart",label:"小车已就位",value:cartPlaced,source:"apparatus"},{id:"running",label:"小车正在运动",value:running,source:"apparatus"}],readings:[{id:"time",label:"区间计时",value:lastRun?.time??null,unit:"s",source:"reading"},{id:"average-speed",label:"平均速度s/t",value:lastRun?.speed??null,unit:"m/s",source:"reading"}],derived:[{id:"model",label:"轨道模型",value:"恒加速度斜轨；滚动修正0.72；忽略阻力波动",source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:speedPair?.valid??false,source:"model"},{id:"height-evidence",label:"固定路程的高度强对照",value:speedEvidenceReady,source:"model"}],validity:{ready:speedEvidenceReady,issues}});},[cartPlaced,evidence.length,finishGate,height,lastRun,latestSpeedChangedIndex,length,prediction,running,speedEvidenceReady,speedPair?.valid,startGate]);
  return <LabFrame field="mechanics" experiment="mechanics-speed" eyebrow="PHOTOGATE CART TRACK / 光电门小车轨道" title="亲手装好计时区间，再让路程和时间给出平均速度" description="安装起点、终点光电门并确认两门之间的路程，把小车放在起点后释放。计时器记录小车通过区间所用时间，平均速度按 v=s/t 计算。斜轨采用恒加速度教学模型，滚动修正系数0.72，忽略阻力波动。" running={running} onToggle={release} playLabel="释放小车开始计时" runningLabel="小车运动中" actionDisabled={!setupReady||running} disabledLabel={!startGate?"先安装起点光电门":!finishGate?"再安装终点光电门":"把小车放到起点"}>
    <div className="speed-setup-console"><section><span><b>01</b>轨道条件</span><div><label>路程</label>{[.8,1.2,1.6].map(value=><button className={length===value?"active":""} disabled={running} onClick={()=>{setLength(value);resetSetup();}} key={value}>{value.toFixed(1)} m</button>)}</div><div><label>高度</label>{[.1,.2,.3].map(value=><button className={height===value?"active":""} disabled={running} onClick={()=>{setHeight(value);resetSetup();}} key={value}>{value.toFixed(1)} m</button>)}</div></section><section><span><b>02</b>先作预测</span><p>路程不变，增大轨道高度，小车的平均速度怎样变化？</p><div>{(["faster","same","slower"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="faster"?"增大":value==="same"?"不变":"减小"}</button>)}</div></section><section><span><b>03</b>有效测量</span><strong>起终点门完整 · 小车从静止释放</strong><small>不得用手推车；光电门区间决定路程 s。</small></section></div>
    <div className={`speed-lab-sim ${setupReady?"ready":""} ${running?"running":""}`} style={{"--cart-progress":progress/100,"--track-height":height/.3} as React.CSSProperties}>
      <div className="speed-procedure-strip">{["设置轨道","装起点门","装终点门","小车就位","释放计时","记录速度"].map((label,index)=>{const activeStage=!startGate?1:!finishGate?2:!cartPlaced?3:!lastRun?4:5;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="speed-inclined-track"><span className="speed-track-bed"/><div className="speed-distance-scale">{Array.from({length:17},(_,index)=><i className={index%4===0?"major":""} key={index}/>)}</div><div className="speed-photogate start"><i/><b>START</b><small>{startGate?"起点门在线":"未安装"}</small></div><div className="speed-photogate finish"><i/><b>FINISH</b><small>{finishGate?"终点门在线":"未安装"}</small></div><div className="speed-cart-live"><span/><i/><i/><b>实验小车</b></div><em>光电门间路程 s = {length.toFixed(1)} m</em></div>
      <div className="speed-height-gauge"><span><small>TRACK HEIGHT / 轨道高度</small><strong>{height.toFixed(1)} m</strong></span><div><i style={{height:`${height/.3*100}%`}}/></div></div>
      <div className="speed-timer-console"><TimerReset size={24}/><span><small>PHOTOGATE TIMER / 光电门计时器</small><strong>{running?`${(model.timeSeconds*progress/100).toFixed(3)} s`:lastRun?`${lastRun.time.toFixed(3)} s`:"0.000 s"}</strong><em>{running?"计时中 · 等待小车通过终点门":lastRun?"起终点信号完整":"等待起点门触发"}</em></span><i className={running?"live":lastRun?"done":""}/></div>
      <div className="speed-gate-install"><span>装置安装</span><button className={startGate?"done":""} disabled={startGate||running} onClick={()=>setStartGate(true)}>{startGate?<CheckCircle2 size={15}/>:<Cable size={15}/>}安装起点门</button><button className={finishGate?"done":""} disabled={!startGate||finishGate||running} onClick={()=>setFinishGate(true)}>{finishGate?<CheckCircle2 size={15}/>:<Cable size={15}/>}安装终点门</button><button className={cartPlaced?"done":""} disabled={!finishGate||cartPlaced||running} onClick={()=>setCartPlaced(true)}>{cartPlaced?<CheckCircle2 size={15}/>:<Compass size={15}/>}小车放在起点</button></div>
      <div className={`speed-live-result ${lastRun?"valid":""}`}><Gauge size={20}/><span><small>AVERAGE SPEED / 区间平均速度</small><strong>{lastRun?`${length.toFixed(1)} ÷ ${lastRun.time.toFixed(3)} = ${lastRun.speed.toFixed(3)} m/s`:running?"小车正在通过测量区间":"等待完成一次计时"}</strong><em>平均速度描述这一段路程内的运动快慢，不表示每一时刻速度相同。</em></span></div>
      {!startGate&&<InteractionCue text="从安装起点光电门开始组装测量区间"/>}
    </div>
    <div className="speed-operation-dock"><ResultCell label="光电门间路程 s" value={`${length.toFixed(1)} m`}/><ResultCell label="区间时间 t" value={lastRun?`${lastRun.time.toFixed(3)} s`:"等待计时"} pending={!lastRun}/><ResultCell label="平均速度 v=s/t" value={lastRun?`${lastRun.speed.toFixed(3)} m/s`:"等待计算"} pending={!lastRun}/><button disabled={!lastRun} onClick={save}><Save size={15}/>保存本次测量</button><button onClick={()=>{setCartPlaced(false);setRunning(false);setProgress(0);setLastRun(undefined);}}><RotateCcw size={15}/>小车回到起点</button></div>
    <div className={`speed-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>小车速度测量记录</b></span><small>{speedEvidenceReady?"高度强对照已建立":evidence.length?`已有 ${evidence.length} 次测量 · 还需固定路程改变高度`:"固定路程，只改变轨道高度"}</small></header>{evidence.length?<div><b>组次</b><b>s/m</b><b>h/m</b><b>t/s</b><b>v/(m/s)</b>{evidence.map((row,index)=><div className="speed-evidence-row" key={row.id}><span>{evidence.length-index}</span><span>{row.length.toFixed(1)}</span><span>{row.height.toFixed(1)}</span><strong>{row.time.toFixed(3)}</strong><strong>{row.speed.toFixed(3)}</strong></div>)}</div>:<p>先保存一组基准数据，再保持光电门间路程不变，让轨道高度至少变化 0.1 m。</p>}{speedConclusion&&<EvidenceVerdict valid={speedConclusion.valid} title={speedConclusion.title} detail={speedConclusion.detail}/>}</div>
  </LabFrame>;
}

const frictionSurfaces = {
  glass: { label: "玻璃板", note: "光滑", coefficient: .12 },
  wood: { label: "木板", note: "中等粗糙", coefficient: .25 },
  towel: { label: "毛巾", note: "较粗糙", coefficient: .42 }
} as const;
type FrictionSurface = keyof typeof frictionSurfaces;
interface FrictionEvidence { id: number; surface: FrictionSurface; normal: number; friction: number; }

function FrictionLab() {
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
  const motion = !running ? "静止，等待拉动" : !hasSlid ? `仍静止：静摩擦随拉力增至 ${frictionRegime.frictionForce.toFixed(1)} N` : uniform ? "木块水平匀速运动" : difference > 0 ? "已滑动：拉力偏大，木块正在加速" : "已滑动：拉力偏小，木块将减速停下";
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
    setRunning(false); setHasSlid(false); setAddedWeights((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
    recordHarness("configuration.changed", { experiment: "mechanics-friction", control: `${value}N砝码`, value: addedWeights.includes(value) ? "取下" : "加到木块上" });
  };
  const adjustPull = (delta: number) => {
    setPullForce((value) => Number(Math.max(0, Math.min(20, value + delta)).toFixed(1)));
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
      <div className="friction-spring-gauge"><div className="gauge-handle" /><div className="gauge-shell"><span>{Array.from({ length: 11 }, (_, index) => <i className={index % 5 === 0 ? "major" : ""} key={index} />)}</span><b style={{ left: `${8 + pointer / 20 * 82}%` }} /><em>{zeroed ? `${pullForce.toFixed(1)} N / 20 N` : "未校零"}</em></div><div className="gauge-hook" /></div>
      <div className="friction-string" />
      <div className="friction-test-block"><span>木块<small>自重 10 N</small></span>{addedWeights.map((value, index) => <b style={{ bottom: `${68 + index * 25}px` }} key={value}>{value}N</b>)}</div>
      <div className={`friction-test-surface surface-${surface}`}>{Array.from({ length: 34 }, (_, index) => <i key={index} />)}<strong>{frictionSurfaces[surface].label} · {frictionSurfaces[surface].note}</strong></div>
      <div className="friction-force-vectors"><span className="vector-pull" style={{ width: `${40 + pullForce * 10}px` }}>F拉 {pullForce.toFixed(1)} N →</span><span className="vector-friction" style={{ width: `${40 + frictionRegime.frictionForce * 10}px` }}>← {hasSlid?"f滑":"f静"} {running?frictionRegime.frictionForce.toFixed(1):"?"} N</span></div>
      <div className={`friction-motion-readout ${uniform ? "valid" : ""}`}><Activity size={18} /><span><small>MOTION SENSOR / 运动传感</small><strong>{motion}</strong><em>{!running ? "先开始拉动，再用 ±0.1 N 微调" : uniform ? "速度—时间图像为水平线" : difference > 0 ? `拉力比摩擦力趋势值大 ${Math.abs(difference).toFixed(1)} N` : `拉力还差约 ${Math.abs(difference).toFixed(1)} N`}</em></span></div>
      {!zeroed && <InteractionCue text="先检查弹簧测力计指针是否对准零刻度" />}
    </div>
    <section className={`friction-breakaway-console ${breakawayObserved?"observed":""}`}><header><span><Activity size={17}/><b>BREAKAWAY / 静—滑转折观测</b></span><small>{breakawayObserved?"已捕捉一次起动阈值":"开始拉动后逐步增加拉力"}</small></header><div><article><span>当前作用状态</span><strong>{!running?"等待拉动":hasSlid?"滑动摩擦":"静摩擦自适应"}</strong><small>{!hasSlid?"f静与拉力平衡，直到达到上限":"启动后摩擦回落到滑动摩擦值"}</small></article><article><span>最大静摩擦力</span><strong>{breakawayForce!==undefined?`${breakawayForce.toFixed(2)} N`:"待捕捉"}</strong><small>刚开始滑动前的临界值</small></article><article><span>滑动摩擦力</span><strong>{frictionForce.toFixed(2)} N</strong><small>{breakawayForce!==undefined?`比起动阈值低 ${(breakawayForce-frictionForce).toFixed(2)} N`:"启动后再回调拉力"}</small></article></div><div className="friction-threshold-track"><i style={{width:`${Math.min(100,pullForce/frictionRegime.maximumStaticFriction*100)}%`}}/><b style={{left:"80%"}}>起动阈值</b></div></section>
    <div className="friction-operation-dock"><section><header><span>接触面</span><small>每次只选择一种材料</small></header><div>{(Object.keys(frictionSurfaces) as FrictionSurface[]).map((key) => <button className={surface === key ? "active" : ""} onClick={() => { setSurface(key); setRunning(false); setHasSlid(false); }} key={key}><strong>{frictionSurfaces[key].label}</strong><small>{frictionSurfaces[key].note}</small></button>)}</div></section><section><header><span>增加压力</span><small>点击砝码取放</small></header><div>{[5, 10, 20].map((value) => <button className={addedWeights.includes(value) ? "active weight" : "weight"} onClick={() => toggleWeight(value)} key={value}><strong>{value}</strong><small>N 砝码</small></button>)}</div></section><section><header><span>微调水平拉力</span><small>{!hasSlid?"先增大到木块启动":"再回调到滑动匀速"}</small></header><div className="friction-force-adjust"><button onClick={() => adjustPull(-.5)}>−0.5</button><button onClick={() => adjustPull(-.1)}>−0.1</button><output>{pullForce.toFixed(1)} N</output><button onClick={() => adjustPull(.1)}>＋0.1</button><button onClick={() => adjustPull(.5)}>＋0.5</button></div></section><aside><span>本组状态</span><strong>{uniform ? `f滑 = ${pullForce.toFixed(1)} N` : motion}</strong><button disabled={!uniform} onClick={save}><Save size={15} />保存有效读数</button></aside></div>
    <div className={`friction-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>摩擦力双因素证据</b></span><div><small>{frictionEvidenceReady?"两条证据链均已建立":`有效数据 ${evidence.length} 组`}</small><button onClick={reset}><RotateCcw size={14} />重新实验</button></div></header><FactorEvidenceStatus className="friction-evidence-status" items={[{label:"压力因素",note:"固定接触面",done:Boolean(pressureEvidence)},{label:"粗糙程度",note:"固定压力",done:Boolean(surfaceEvidence)}]}/>{evidence.length ? <div><b>组次</b><b>接触面</b><b>压力 / N</b><b>匀速拉力 / N</b><b>滑动摩擦力 / N</b>{evidence.map((row, index) => <div className="friction-evidence-row" key={row.id}><span>{evidence.length - index}</span><strong>{frictionSurfaces[row.surface].label}</strong><span>{row.normal.toFixed(0)}</span><span>{row.friction.toFixed(1)}</span><strong>{row.friction.toFixed(1)}</strong></div>)}</div> : <p>达到匀速后保存基准；随后分别完成“固定接触面改变压力”和“固定压力改变接触面”两类对照。</p>}{frictionConclusion&&<EvidenceVerdict valid={frictionConclusion.valid} title={frictionConclusion.title} detail={frictionConclusion.detail}/>}</div>
  </LabFrame>;
}

const pressureFaces = {
  large: { label: "大面朝下", area: 60, width: 190, height: 78 },
  medium: { label: "中面朝下", area: 30, width: 130, height: 112 },
  small: { label: "小面朝下", area: 15, width: 82, height: 155 }
} as const;
type PressureFaceKey = keyof typeof pressureFaces;
interface PressureEvidence { id:number; force:number; area:number; pressure:number; indentation:number; }

function PressureLab() {
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
  const pressurePair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.force,evidence[1]!.area],[evidence[0]!.force,evidence[0]!.area],evidence[1]!.pressure,evidence[0]!.pressure):undefined;
  const pressureComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,force:analyzeTargetVariableComparison([older.force,older.area],[newer.force,newer.area],older.pressure,newer.pressure,0,25,"same-direction",.001),area:analyzeTargetVariableComparison([older.force,older.area],[newer.force,newer.area],older.pressure,newer.pressure,1,15,"opposite-direction",.001)}))),[evidence]);
  const forceEvidence=pressureComparisons.find(item=>item.force.validTargetComparison);
  const areaEvidence=pressureComparisons.find(item=>item.area.validTargetComparison);
  const pressureEvidenceReady=Boolean(forceEvidence&&areaEvidence);
  const areaPredictionMatched=Boolean(prediction==="deeper"&&areaEvidence);
  const pressureConclusion=pressureEvidenceReady?{valid:true,title:"压强双因素证据完整",detail:`固定面积时，压力增大，压强增大；固定压力时，面积减小，压强与压痕均增大。${areaPredictionMatched?"面积预测与证据一致。":"请依据面积对照修正预测。"}`} : forceEvidence?{valid:false,title:"压力因素已验证，还缺受力面积证据",detail:"保持压力不变，翻转长方体，让受力面积至少变化 15 cm²，再测量并保存。"}:areaEvidence?{valid:false,title:"受力面积已验证，还缺压力证据",detail:"保持受力面不变，增加或减少至少 25 N 的砝码，再测量并保存。"}:!pressurePair?undefined:!pressurePair.valid?{valid:false,title:"这两组不能直接比较",detail:"压力和受力面积同时发生了变化，请把其中一个条件调回上一组。"}:{valid:false,title:`已形成一组${pressurePair.changedIndexes[0]===0?"压力":"受力面积"}对照`,detail:"数据趋势或变化量还不足，请保持控制变量并扩大自变量变化后重测。"};
  const resetTrial=()=>{setPressed(false);setMeasured(false);};
  const toggleWeight=(value:number)=>{setWeights(items=>items.includes(value)?items.filter(item=>item!==value):[...items,value]);resetTrial();recordHarness("configuration.changed",{experiment:"mechanics-pressure",control:`${value}N砝码`,value:weights.includes(value)?"取下":"加载"});};
  const save=()=>{if(!measured)return;const row={id:Date.now(),force,area:face.area,pressure:result.pressurePascals,indentation:result.indentationMillimeters};setEvidence(items=>[row,...items.filter(item=>item.force!==force||item.area!==face.area)].slice(0,8));recordHarness("configuration.changed",{experiment:"mechanics-pressure",control:"保存压强测量",value:`${force}N/${face.area}cm²/${result.pressurePascals}Pa`});};
  useEffect(()=>{const issues=pressureEvidenceReady?[]:!foamReady?["把同一块软质泡沫放到压痕台。"]:!pressed&&!measured&&evidence.length===0?["加载后向下压，使长方体稳定作用于泡沫。"]:pressed&&!measured?["用深度标尺读取压痕比较值。"]:evidence.length<2?["保存基准后，固定面积改变压力或固定压力改变面积。"]:!forceEvidence?["还缺压力因素证据：固定受力面，让压力至少变化 25 N。"]:["还缺面积因素证据：固定压力，让受力面积至少变化 15 cm²。"];publishApparatusSnapshot({module:"mechanics-pressure",capturedAt:new Date().toISOString(),origin:foamReady||pressed||evidence.length?"learner":"system",controls:[{id:"face",label:"长方体受力面",value:face.label,source:"control"},{id:"area",label:"受力面积",value:face.area,unit:"cm²",source:"control"},{id:"weights",label:"附加砝码重力",value:force-50,unit:"N",source:"control"},{id:"prediction",label:"面积减小后的预测",value:prediction==="deeper"?"压痕更深":prediction==="same"?"不变":prediction==="shallower"?"压痕更浅":"未选择",source:"control"}],apparatus:[{id:"foam",label:"泡沫已放置",value:foamReady,source:"apparatus"},{id:"pressed",label:"长方体已稳定压下",value:pressed,source:"apparatus"},{id:"measured",label:"压痕已测量",value:measured,source:"apparatus"}],readings:[{id:"force",label:"对泡沫的压力",value:force,unit:"N",source:"reading"},{id:"pressure",label:"固体压强",value:measured?result.pressurePascals:null,unit:"Pa",source:"reading"},{id:"indentation",label:"同一泡沫压痕比较",value:measured?result.indentationMillimeters:null,unit:"mm",source:"reading"}],derived:[{id:"formula",label:"压强公式",value:"p=F/S；cm²换算为m²",source:"model"},{id:"indentation-model",label:"压痕说明",value:"固定泡沫材料下的比较现象，不是通用材料定律",source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:pressurePair?.valid??false,source:"model"},{id:"force-evidence",label:"压力因素证据",value:Boolean(forceEvidence),source:"model"},{id:"area-evidence",label:"受力面积因素证据",value:Boolean(areaEvidence),source:"model"}],validity:{ready:pressureEvidenceReady,issues}});},[areaEvidence,evidence.length,face.area,face.label,foamReady,force,forceEvidence,measured,prediction,pressed,pressureEvidenceReady,pressurePair?.valid,result.indentationMillimeters,result.pressurePascals]);
  return <LabFrame field="mechanics" experiment="mechanics-pressure" eyebrow="PRESSURE INDENTATION RIG / 固体压强压痕台" title="加砝码、翻转受力面，再用同一块泡沫比较压力作用效果" description="长方体自重50 N，可叠加砝码并选择大、中、小三个受力面。压强按 p=F/S 定量计算；压痕深度只作为同一泡沫材料下比较压力作用效果的教学现象，不是通用材料定律。" running={pressed} onToggle={()=>{if(foamReady){setPressed(value=>!value);setMeasured(false);}}} playLabel="向下稳定压紧" runningLabel="抬起长方体" actionDisabled={!foamReady} disabledLabel="请先放置泡沫垫">
    <div className="pressure-inquiry-console"><section><span><b>01</b>先作预测</span><p>保持压力不变，受力面积减小，压痕会怎样？</p><div>{(["deeper","same","shallower"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="deeper"?"更深":value==="same"?"不变":"更浅"}</button>)}</div></section><section><span><b>02</b>公平比较</span><strong>同一泡沫 · 一次只改变一个条件</strong><small>研究压力时保持受力面积不变；研究面积时保持压力不变。</small></section><section><span><b>03</b>单位换算</span><strong>{face.area} cm² = {(face.area/10000).toFixed(4)} m²</strong><small>计算压强前必须把平方厘米换成平方米。</small></section></div>
    <div className={`pressure-lab-sim ${foamReady?"foam-ready":""} ${pressed?"pressed":""}`} style={{"--pressure-block-width":`${face.width}px`,"--pressure-block-height":`${face.height}px`,"--indentation":`${pressed?result.indentationMillimeters:0}px`} as React.CSSProperties}>
      <div className="pressure-procedure-strip">{["放泡沫垫","选择受力面","加载砝码","稳定压紧","测量压痕","记录对照"].map((label,index)=>{const activeStage=!foamReady?0:!pressed?3:!measured?4:5;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="pressure-loading-frame"><span className="pressure-guide-rail left"/><span className="pressure-guide-rail right"/><div className="pressure-platen"><i/></div><div className="pressure-test-block"><span>实验长方体<small>自重 50 N</small></span>{weights.map((value,index)=><b style={{bottom:`${face.height+10+index*28}px`}} key={value}>{value}N</b>)}</div><div className="pressure-foam-pad"><i/><b>统一软质泡沫垫</b></div><div className="pressure-indentation-shadow"/></div>
      <div className="pressure-force-vector" style={{height:`${70+force*.4}px`}}><span>F = {force} N ↓</span></div>
      <div className={`pressure-depth-gauge ${measured?"measured":""}`}><span><small>INDENTATION / 压痕深度</small><strong>{measured?`${result.indentationMillimeters.toFixed(1)} mm`:"— —"}</strong></span><div>{Array.from({length:19},(_,index)=><i className={index%5===0?"major":""} key={index}/>)}</div><b style={{top:`${16+result.indentationMillimeters*7}px`}}/></div>
      <div className="pressure-area-readout"><span><small>CONTACT AREA / 受力面积</small><strong>{face.area} cm²</strong></span><i style={{width:`${40+face.area*2}px`}}/><em>{face.label}</em></div>
      <div className={`pressure-live-result ${measured?"valid":""}`}><Gauge size={20}/><span><small>SOLID PRESSURE / 固体压强</small><strong>{measured?`${force} ÷ ${(face.area/10000).toFixed(4)} = ${result.pressurePascals.toFixed(0)} Pa`:pressed?"压痕已形成，请读取深度":"等待稳定压紧"}</strong><em>正式物理量是压强；压痕仅用于观察同一材料上的作用效果。</em></span></div>
      {!foamReady&&<InteractionCue text="先把统一软质泡沫垫放到压痕台"/>}
    </div>
    <div className="pressure-operation-dock"><section><span>选择受力面</span><div>{(Object.keys(pressureFaces) as PressureFaceKey[]).map(key=><button className={faceKey===key?"active":""} disabled={pressed} onClick={()=>{setFaceKey(key);resetTrial();}} key={key}><strong>{pressureFaces[key].label}</strong><small>{pressureFaces[key].area} cm²</small></button>)}</div></section><section><span>加载附加砝码</span><div>{[25,50,100].map(value=><button className={weights.includes(value)?"active":""} disabled={pressed} onClick={()=>toggleWeight(value)} key={value}>{value} N</button>)}</div></section><section><span>装置与读数</span><div><button className={foamReady?"done":""} disabled={foamReady} onClick={()=>setFoamReady(true)}>放置泡沫垫</button><button disabled={!pressed||measured} onClick={()=>setMeasured(true)}>测量压痕</button></div></section><aside><span>当前条件</span><strong>{force} N · {face.area} cm² · {measured?`${result.pressurePascals.toFixed(0)} Pa`:"等待测量"}</strong><button disabled={!measured} onClick={save}><Save size={15}/>保存本组数据</button></aside></div>
    <div className={`pressure-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>固体压强双因素证据</b></span><small>{pressureEvidenceReady?"两条证据链均已建立":`已保存 ${evidence.length} 组`}</small></header><FactorEvidenceStatus className="pressure-evidence-status" items={[{label:"压力因素",note:"固定受力面积",done:Boolean(forceEvidence)},{label:"面积因素",note:"固定压力",done:Boolean(areaEvidence)}]}/>{evidence.length?<div><b>组次</b><b>压力/N</b><b>面积/cm²</b><b>压强/Pa</b><b>压痕/mm</b>{evidence.map((row,index)=><div className="pressure-evidence-row" key={row.id}><span>{evidence.length-index}</span><span>{row.force}</span><span>{row.area}</span><strong>{row.pressure.toFixed(0)}</strong><strong>{row.indentation.toFixed(1)}</strong></div>)}</div>:<p>保存基准后，分别完成“固定面积改变压力”和“固定压力改变受力面积”两类对照。</p>}{pressureConclusion&&<EvidenceVerdict valid={pressureConclusion.valid} title={pressureConclusion.title} detail={pressureConclusion.detail}/>}</div>
  </LabFrame>;
}

const buoyancyObjects = {
  aluminum: { label: "铝柱", density: 2.7, volume: 100, color: "#aeb9bb" },
  stone: { label: "石柱", density: 2.5, volume: 120, color: "#78817d" },
  iron: { label: "铁柱", density: 7.8, volume: 60, color: "#4c5b5f" }
} as const;
const buoyancyLiquids = {
  oil: { label: "植物油", density: .8, color: "#d8b95e" },
  water: { label: "清水", density: 1, color: "#55b9df" },
  brine: { label: "浓盐水", density: 1.2, color: "#83d7df" }
} as const;
type BuoyancyObjectKey = keyof typeof buoyancyObjects;
type BuoyancyLiquidKey = keyof typeof buoyancyLiquids;
interface BuoyancyEvidence { id: number; object: string; liquid: string; liquidDensity: number; gravity: number; apparent: number; buoyancy: number; }

function BuoyancyLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [objectKey, setObjectKey] = useState<BuoyancyObjectKey>("aluminum");
  const [liquidKey, setLiquidKey] = useState<BuoyancyLiquidKey>("water");
  const [zeroed, setZeroed] = useState(false);
  const [airRecorded, setAirRecorded] = useState(false);
  const [depth, setDepth] = useState(0);
  const [liquidReading, setLiquidReading] = useState<number>();
  const [touchingBottom, setTouchingBottom] = useState(false);
  const [bottomErrorObserved, setBottomErrorObserved] = useState(false);
  const [evidence, setEvidence] = useState<BuoyancyEvidence[]>([]);
  const object = buoyancyObjects[objectKey];
  const liquid = buoyancyLiquids[liquidKey];
  const gravity = object.density * object.volume / 100;
  const displacedFraction = depth / 100;
  const buoyancy = liquid.density * object.volume / 100 * displacedFraction;
  const apparentWeight = Math.max(0, gravity - buoyancy);
  const bottomSupport = Math.min(apparentWeight * .4, gravity * .3);
  const bottomApparentWeight = Math.max(0, apparentWeight - bottomSupport);
  const visibleApparentWeight = touchingBottom ? bottomApparentWeight : apparentWeight;
  const bottomError = analyzeBottomContactBuoyancyError(gravity, apparentWeight, bottomApparentWeight);
  const fullyImmersed = depth === 100;
  const canCalculate = airRecorded && liquidReading !== undefined;
  const measuredBuoyancy = liquidReading === undefined ? null : gravity - liquidReading;
  const buoyancyPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.object,evidence[1]!.liquidDensity],[evidence[0]!.object,evidence[0]!.liquidDensity],evidence[1]!.buoyancy,evidence[0]!.buoyancy,.001):undefined;
  const liquidComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>analyzeTargetVariableComparison([older.object,older.liquidDensity],[newer.object,newer.liquidDensity],older.buoyancy,newer.buoyancy,1,.2,"same-direction",.001))),[evidence]);
  const liquidEvidence=liquidComparisons.find(comparison=>comparison.validTargetComparison);
  const buoyancyEvidenceReady=Boolean(liquidEvidence);
  const buoyancyConclusion=liquidEvidence?{valid:true,title:"液体密度强对照成立：物体保持不变",detail:`液体密度变化 ${Math.abs(liquidEvidence.targetChange).toFixed(1)} g/cm³，完全浸没时测得的浮力随液体密度同向变化。`} : !buoyancyPair?undefined:!buoyancyPair.valid?{valid:false,title:"最近两组同时更换了物体和液体",detail:"本任务研究液体密度的影响，请使用同一个物体，只更换液体。"}:buoyancyPair.changedIndexes[0]===0?{valid:false,title:"这组比较更换了物体",detail:"允许保留探索数据，但不能作为本任务结论；请固定物体，只更换密度至少相差 0.2 g/cm³ 的液体。"}:{valid:false,title:"液体已单独更换，但数据趋势需要复核",detail:"确认物体完全浸没、不碰杯底并静止后读数，再重新测量。"};
  const resetRun = (nextObject = objectKey, nextLiquid = liquidKey) => {
    setObjectKey(nextObject); setLiquidKey(nextLiquid); setZeroed(false); setAirRecorded(false); setDepth(0); setLiquidReading(undefined); setTouchingBottom(false);
  };
  const lower = () => {
    if (!airRecorded) return;
    const next = Math.min(100, depth + 25);
    setDepth(next); setLiquidReading(undefined); setTouchingBottom(false);
    recordHarness("control.changed", { experiment: "mechanics-buoyancy", control: "浸入程度", value: next, unit: "%" });
  };
  const recordLiquidReading = () => {
    if (!fullyImmersed || touchingBottom) return;
    setLiquidReading(apparentWeight);
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "液中示数F'", value: apparentWeight.toFixed(2), unit: "N" });
  };
  const toggleBottomContact = () => {
    if (!fullyImmersed) return;
    const next = !touchingBottom;
    setTouchingBottom(next);
    if (next) setBottomErrorObserved(true);
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "杯底接触误差", value: next ? `碰底示数${bottomApparentWeight.toFixed(2)}N` : "物体已提离杯底" });
  };
  const save = () => {
    if (!canCalculate || !bottomErrorObserved || measuredBuoyancy === null || liquidReading === undefined) return;
    const row = { id: Date.now(), object: object.label, liquid: liquid.label, liquidDensity: liquid.density, gravity, apparent: liquidReading, buoyancy: measuredBuoyancy };
    setEvidence((items) => [row, ...items.filter((item) => !(item.object === row.object && item.liquid === row.liquid))].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "保存浮力数据", value: `${row.object}/${row.liquid}/${row.buoyancy.toFixed(2)}N` });
  };
  useEffect(() => {
    const issues = buoyancyEvidenceReady ? [] : !zeroed ? ["先检查弹簧测力计是否归零。"] : !airRecorded ? ["物体静止悬挂在空气中时，记录重力G。"] : !fullyImmersed ? ["逐步下放物体，直到完全浸没且不碰杯底。"] : liquidReading === undefined ? [touchingBottom ? "物体碰底时存在杯底支持力，必须提离杯底后再记录F'。" : "物体稳定后锁存液体中的正式示数F'。"] : !bottomErrorObserved ? ["完成一次碰底错误演练，比较示数和浮力误差方向。"] : evidence.length < 2 ? ["保存本组后，保持物体不变并更换另一种液体。"] : buoyancyPair&&!buoyancyPair.valid?["最近两组同时更换了物体和液体。"]:buoyancyPair?.changedIndexes[0]===0?["最近两组更换了物体；本任务需要固定物体、只换液体。"]:["复核完全浸没、不碰底和静止读数条件。"];
    publishApparatusSnapshot({ module: "mechanics-buoyancy", capturedAt: new Date().toISOString(), origin: zeroed || airRecorded || depth > 0 ? "learner" : "system", controls: [
      { id: "object", label: "待测物体", value: object.label, source: "control" }, { id: "object-volume", label: "物体体积", value: object.volume, unit: "cm³", source: "control" }, { id: "liquid", label: "液体", value: liquid.label, source: "control" }, { id: "liquid-density", label: "液体密度", value: liquid.density, unit: "g/cm³", source: "control" }, { id: "depth", label: "浸入程度", value: depth, unit: "%", source: "control" }
    ], apparatus: [
      { id: "zeroed", label: "测力计已校零", value: zeroed, source: "apparatus" }, { id: "air-recorded", label: "空气中示数已记录", value: airRecorded, source: "apparatus" }, { id: "fully-immersed", label: "物体完全浸没", value: fullyImmersed, source: "apparatus" }, { id: "touching-bottom", label: "物体接触杯底", value: touchingBottom, source: "apparatus" }
    ], readings: [
      { id: "gravity", label: "空气中重力G", value: airRecorded ? gravity : null, unit: "N", source: "reading" }, { id: "visible-force", label: "测力计当前示数", value: zeroed ? visibleApparentWeight : null, unit: "N", source: "reading" }, { id: "apparent-weight", label: "已锁存正式示数F'", value: liquidReading ?? null, unit: "N", source: "reading" }, { id: "buoyancy", label: "称重法浮力G−F'", value: measuredBuoyancy, unit: "N", source: "reading" }
    ], derived: [
      { id: "formula", label: "称重法", value: "F浮=G−F'", source: "model" }, { id: "partial-model", label: "部分浸入模型", value: "同形直柱体：排开体积随浸入百分比线性增加", source: "model" }, { id: "bottom-error", label: "碰底支持力误差已诊断", value: bottomErrorObserved, source: "model" },{id:"latest-comparison",label:"最近两组公平比较",value:buoyancyPair?.valid??false,source:"model"},{id:"liquid-density-evidence",label:"同一物体的液体密度强对照",value:buoyancyEvidenceReady,source:"model"}
    ], validity: { ready: buoyancyEvidenceReady, issues } });
  }, [airRecorded, bottomErrorObserved, buoyancyEvidenceReady, buoyancyPair?.changedIndexes, buoyancyPair?.valid, canCalculate, depth, evidence.length, fullyImmersed, gravity, liquid.density, liquid.label, liquidReading, measuredBuoyancy, object.label, object.volume, touchingBottom, visibleApparentWeight, zeroed]);
  return <LabFrame field="mechanics" experiment="mechanics-buoyancy" eyebrow="BUOYANCY WEIGHING RIG / 浮力称重台" title="把“变轻了多少”真正测出来，而不是只看上浮或下沉" description="先测物体在空气中的重力 G，再逐步浸入液体并观察弹簧测力计示数。物体完全浸没、静止且不碰容器时记录 F′，最后用 F浮=G−F′ 计算。取 g=10 N/kg。" running={false} onToggle={lower} playLabel="下放物体一档" actionDisabled={!airRecorded || fullyImmersed} disabledLabel={!airRecorded ? "先记录空气中重力" : "物体已完全浸没"}>
    <div className="buoyancy-selection-console"><section><span><b>01</b>选择物体</span><div>{(Object.keys(buoyancyObjects) as BuoyancyObjectKey[]).map((key) => <button className={objectKey === key ? "active" : ""} onClick={() => resetRun(key, liquidKey)} key={key}><i style={{ background: buoyancyObjects[key].color }} /><strong>{buoyancyObjects[key].label}</strong><small>{buoyancyObjects[key].volume} cm³</small></button>)}</div></section><section><span><b>02</b>选择液体</span><div>{(Object.keys(buoyancyLiquids) as BuoyancyLiquidKey[]).map((key) => <button className={liquidKey === key ? "active" : ""} onClick={() => resetRun(objectKey, key)} key={key}><i style={{ background: buoyancyLiquids[key].color }} /><strong>{buoyancyLiquids[key].label}</strong><small>ρ={buoyancyLiquids[key].density}</small></button>)}</div></section><section><span><b>03</b>仪器准备</span><button className={zeroed ? "done" : ""} disabled={zeroed} onClick={() => { setZeroed(true); recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "弹簧测力计", value: "校零完成" }); }}><Focus size={15} />{zeroed ? "测力计已校零" : "检查并校零"}</button></section></div>
    <div className={`buoyancy-lab-sim depth-${depth} ${fullyImmersed ? "fully-immersed" : ""} ${touchingBottom ? "touching-bottom" : ""}`} style={{ "--buoyancy-depth": depth / 100, "--buoyancy-object-top": `${185 + depth * 2.05 + (touchingBottom ? 145 : 0)}px`, "--buoyancy-object-top-mobile": `${250 + depth * 2.4 + (touchingBottom ? 120 : 0)}px`, "--liquid-color": liquid.color, "--object-color": object.color, "--gauge-reading": Math.min(1, visibleApparentWeight / 5) } as React.CSSProperties}>
      <div className="buoyancy-procedure-strip">{["测力计校零", "测空气中重力", "逐步浸入", "锁存F′", "碰底诊断", "计算对照"].map((label, index) => { const activeStage = !zeroed ? 0 : !airRecorded ? 1 : !fullyImmersed ? 2 : liquidReading === undefined ? 3 : !bottomErrorObserved ? 4 : 5; return <span className={index < activeStage ? "done" : index === activeStage ? "active" : ""} key={label}><b>{index < activeStage ? "✓" : index + 1}</b>{label}</span>; })}</div>
      <div className="buoyancy-spring-scale"><span className="scale-ring" /><div className="scale-body"><i style={{ top: `${8 + Math.min(84, visibleApparentWeight / 5 * 84)}%` }} /><b>{zeroed ? `${visibleApparentWeight.toFixed(2)} N` : "未校零"}</b><small>0～5 N</small></div><span className="scale-hook" /></div>
      <div className="buoyancy-thread" />
      <div className="buoyancy-object" style={{ width: `${50 + object.volume * .18}px`, height: `${64 + object.volume * .22}px` }}><span>{object.label}<small>{object.volume} cm³</small></span></div>
      <div className="buoyancy-vessel"><span className="buoyancy-liquid" /><div className="buoyancy-bubbles">{depth > 0 && Array.from({ length: 9 }, (_, index) => <i style={{ "--bubble": index } as React.CSSProperties} key={index} />)}</div><b>{liquid.label}<small>ρ液={liquid.density} g/cm³</small></b><em>{touchingBottom ? "错误状态：物体已碰杯底" : "保持悬空，不接触杯底"}</em></div>
      <div className="buoyancy-force-vectors"><span className="gravity-vector" style={{ height: `${55 + gravity * 12}px` }}>G {gravity.toFixed(2)} N ↓</span>{depth > 0 && <span className="buoyant-vector" style={{ height: `${35 + buoyancy * 42}px` }}>F浮 {buoyancy.toFixed(2)} N ↑</span>}{touchingBottom && <span className="support-vector" style={{ height: `${35 + bottomError.supportForce * 42}px` }}>N {bottomError.supportForce.toFixed(2)} N ↑</span>}</div>
      <div className="buoyancy-depth-meter"><span><small>IMMERSION / 浸入程度</small><strong>{depth}%</strong></span><div>{[0,25,50,75,100].map((value) => <i className={depth >= value ? "filled" : ""} key={value}><b>{value}</b></i>)}</div></div>
      <div className={`buoyancy-live-reading ${canCalculate ? "valid" : ""} ${touchingBottom ? "danger" : ""}`}><Gauge size={19} /><span><small>{touchingBottom ? "BOTTOM CONTACT / 杯底接触" : fullyImmersed ? "FULLY IMMERSED / 完全浸没" : "LIVE FORCE / 实时受力"}</small><strong>{!zeroed ? "先校零" : !airRecorded ? `空气中示数 ${gravity.toFixed(2)} N` : `测力计当前示数 ${visibleApparentWeight.toFixed(2)} N`}</strong><em>{touchingBottom ? "杯底支持力使测力计示数偏小，此时禁止记录正式数据。" : liquidReading !== undefined ? `正式 F′ 已锁存为 ${liquidReading.toFixed(2)} N，后续瞬时变化不会改写它。` : fullyImmersed ? "物体静止、完全浸没且不碰底，可锁存正式示数。" : depth > 0 ? "浸入体积增加，排开液体的体积随之增加。" : "先保存空气中的重力基准。"}</em></span></div>
      {!zeroed && <InteractionCue text="实验前检查弹簧测力计指针是否归零" />}
    </div>
    <div className="buoyancy-operation-dock"><section><span>空气中基准</span><strong>{airRecorded ? `G = ${gravity.toFixed(2)} N` : "等待记录"}</strong><button disabled={!zeroed || airRecorded} onClick={() => { setAirRecorded(true); recordHarness("configuration.changed", { experiment: "mechanics-buoyancy", control: "空气中重力G", value: gravity.toFixed(2), unit: "N" }); }}><Save size={15} />记录空气中重力</button></section><section><span>浸入控制</span><strong>{depth === 0 ? "物体在液面上方" : depth < 100 ? `已浸入 ${depth}%` : touchingBottom ? "完全浸没并接触杯底" : "完全浸没且保持悬空"}</strong><div><button disabled={!airRecorded || depth === 0} onClick={() => { setDepth((value) => Math.max(0, value - 25)); setLiquidReading(undefined); setTouchingBottom(false); }}>上提一档</button><button disabled={!airRecorded || fullyImmersed} onClick={lower}>下放一档</button></div></section><section><span>正式示数与误差</span><strong>{touchingBottom ? `错误示数 ${bottomApparentWeight.toFixed(2)} N` : liquidReading !== undefined ? `F′ 已锁存 ${liquidReading.toFixed(2)} N` : fullyImmersed ? "等待稳定读数" : "完全浸没后读取"}</strong><div><button className={touchingBottom ? "danger" : ""} disabled={!fullyImmersed} onClick={toggleBottomContact}>{touchingBottom ? "提离杯底" : "下放至碰底"}</button><button disabled={!fullyImmersed || touchingBottom || liquidReading !== undefined} onClick={recordLiquidReading}><Save size={15} />锁存 F′</button></div></section><aside><span>称重法计算</span><strong>{measuredBuoyancy !== null && liquidReading !== undefined ? `${gravity.toFixed(2)} − ${liquidReading.toFixed(2)} = ${measuredBuoyancy.toFixed(2)} N` : "F浮 = G − F′"}</strong><button disabled={!canCalculate || !bottomErrorObserved} onClick={save}><ClipboardList size={15} />{!bottomErrorObserved ? "先完成碰底诊断" : "保存本组证据"}</button></aside></div>
    <section className={`buoyancy-bottom-diagnostic ${bottomErrorObserved ? "observed" : ""} ${touchingBottom ? "active" : ""}`}>
      <header><span><AlertTriangle size={17} /><b>BOTTOM-CONTACT ERROR / 碰底误差诊断</b></span><small>{bottomErrorObserved ? "错误机理已识别" : "完成一次错误演练后才可提交"}</small></header>
      <div>
        <article><span>悬空正式示数 F′</span><strong>{fullyImmersed ? `${apparentWeight.toFixed(2)} N` : "— —"}</strong><small>只受重力、浮力和拉力</small></article>
        <article><span>碰底错误示数</span><strong>{bottomErrorObserved ? `${bottomApparentWeight.toFixed(2)} N` : "待演练"}</strong><small>杯底额外提供向上的支持力</small></article>
        <article><span>若误用碰底示数</span><strong>{bottomErrorObserved ? `${bottomError.erroneousBuoyancy.toFixed(2)} N` : "G − F′错误"}</strong><small>{bottomErrorObserved ? `会高估 ${bottomError.absoluteError.toFixed(2)} N（${bottomError.percentError?.toFixed(0) ?? 0}%）` : "结论方向等待验证"}</small></article>
      </div>
      {bottomErrorObserved && <EvidenceVerdict valid={!touchingBottom} title={touchingBottom ? "当前仍处于错误状态：请先提离杯底" : "已确认：碰底会让称重法浮力偏大"} detail={`杯底支持力 N=${bottomError.supportForce.toFixed(2)} N，使弹簧测力计示数减小同样的量；代入 G−F′ 后，这部分支持力会被误算成浮力。`} />}
    </section>
    <div className={`buoyancy-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>同一物体的液体密度证据</b></span><small>{buoyancyEvidenceReady?"液体密度强对照已建立":evidence.length?`有效数据 ${evidence.length} 组 · 还需固定物体换液体`:"固定物体，只更换液体"}</small></header>{evidence.length ? <div><b>组次</b><b>物体</b><b>液体</b><b>G / N</b><b>F′ / N</b><b>F浮 / N</b>{evidence.map((row, index) => <div className="buoyancy-evidence-row" key={row.id}><span>{evidence.length-index}</span><strong>{row.object}</strong><strong>{row.liquid}<small>ρ={row.liquidDensity.toFixed(1)}</small></strong><span>{row.gravity.toFixed(2)}</span><span>{row.apparent.toFixed(2)}</span><strong>{row.buoyancy.toFixed(2)}</strong></div>)}</div> : <p>完成空气中和液体中的读数并保存基准；随后保持同一物体，只更换另一种液体。</p>}{buoyancyConclusion&&<EvidenceVerdict valid={buoyancyConclusion.valid} title={buoyancyConclusion.title} detail={buoyancyConclusion.detail}/>}</div>
  </LabFrame>;
}

interface LeverEvidence { id: number; leftForce: number; leftArm: number; rightForce: number; rightArm: number; }

const leverChallenges = [
  { id: "equal", label: "等力找位置", note: "两侧钩码相同，寻找等力臂", leftForce: 2, leftArm: 4, rightForce: 2, rightArm: 2 },
  { id: "small", label: "小力撬重物", note: "右侧力较小，需要更长力臂", leftForce: 4, leftArm: 3, rightForce: 2, rightArm: 3 },
  { id: "inverse", label: "反算挂码数", note: "悬点已定，调整右侧钩码", leftForce: 3, leftArm: 6, rightForce: 2, rightArm: 4 }
] as const;

function LeverLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [challengeId, setChallengeId] = useState<(typeof leverChallenges)[number]["id"]>("equal");
  const [leftForce, setLeftForce] = useState(2);
  const [leftArm, setLeftArm] = useState(4);
  const [rightForce, setRightForce] = useState(2);
  const [rightArm, setRightArm] = useState(2);
  const [zeroOffset, setZeroOffset] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [evidence, setEvidence] = useState<LeverEvidence[]>([]);
  const [forceLineAngle, setForceLineAngle] = useState(90);
  const [forceLineTrials, setForceLineTrials] = useState<number[]>([]);
  const lever = calculateLever(leftForce, leftArm, rightForce, rightArm);
  const forceLine = calculateLeverForceLine(rightForce, rightArm, forceLineAngle);
  const calibrated = Math.abs(zeroOffset) < .01;
  const tilt = calibrated ? Math.max(-11, Math.min(11, lever.difference * 1.2)) : zeroOffset;
  const balanced = calibrated && lever.balanced;
  const challenge = leverChallenges.find((item) => item.id === challengeId) ?? leverChallenges[0];
  const leverInvariant = analyzeInvariantEvidence(evidence.map((row) => (row.leftForce * row.leftArm) / (row.rightForce * row.rightArm)));
  const forceLineEvidenceReady = forceLineTrials.includes(90) && forceLineTrials.includes(30);
  const leverLearningReady = leverInvariant.stable && forceLineEvidenceReady;
  useEffect(() => {
    if (!playing || !calibrated) return;
    const target = Math.max(1, Math.min(9, lever.leftMoment / rightForce));
    const timer = window.setInterval(() => setRightArm((value) => {
      const distance = target - value;
      if (Math.abs(distance) <= .05) { setPlaying(false); return Number(target.toFixed(1)); }
      return Number((value + Math.sign(distance) * Math.min(.1, Math.abs(distance))).toFixed(1));
    }), 50);
    return () => clearInterval(timer);
  }, [calibrated, lever.leftMoment, playing, rightForce]);
  useEffect(() => {
    publishApparatusSnapshot({
      module: "mechanics-lever", capturedAt: new Date().toISOString(), origin: calibrated || evidence.length > 0 ? "learner" : "system",
      controls: [
        { id: "challenge", label: "探究任务", value: challenge.label, source: "control" },
        { id: "left-force", label: "左侧钩码重力", value: leftForce, unit: "N", source: "control" },
        { id: "left-arm", label: "左力臂", value: leftArm, unit: "格", source: "control" },
        { id: "right-force", label: "右侧钩码重力", value: rightForce, unit: "N", source: "control" },
        { id: "right-arm", label: "右力臂", value: rightArm, unit: "格", source: "control" },
        { id: "force-line-angle", label: "弹簧测力计拉力夹角", value: forceLineAngle, unit: "°", source: "control" }
      ],
      apparatus: [
        { id: "calibrated", label: "空杠杆已调平", value: calibrated, source: "apparatus" },
        { id: "auto-adjust", label: "自动微调", value: playing, source: "apparatus" },
        { id: "saved-groups", label: "已记录平衡组数", value: evidence.length, unit: "组", source: "apparatus" }
      ],
      readings: [
        { id: "left-moment", label: "左侧力矩", value: calibrated ? lever.leftMoment : null, unit: "N·格", source: "reading" },
        { id: "right-moment", label: "右侧力矩", value: calibrated ? lever.rightMoment : null, unit: "N·格", source: "reading" },
        { id: "balance", label: "杠杆状态", value: !calibrated ? "等待调平" : balanced ? "水平平衡" : tilt > 0 ? "右端下沉" : "左端下沉", source: "reading" },
        { id: "perpendicular-arm", label: "斜拉有效力臂", value: forceLine.perpendicularArm, unit: "格", source: "reading" }
      ],
      derived: [
        { id: "moment-difference", label: "力矩差", value: calibrated ? lever.difference : null, unit: "N·格", source: "model" },
        { id: "moment-invariant", label: "三组力矩比稳定", value: leverInvariant.stable, source: "model" },
        { id: "force-line-comparison", label: "90°与30°作用线对照完成", value: forceLineEvidenceReady, source: "model" }
      ],
      validity: { ready: leverLearningReady, issues: leverLearningReady ? [] : !calibrated ? ["实验前先调节平衡螺母，使空杠杆水平。"] : !leverInvariant.stable ? (!balanced ? ["继续调整钩码数量或悬挂位置，直到杠杆水平。"] : !leverInvariant.enoughPoints ? ["至少记录三组不同配置的平衡数据。"] : ["检查每组F₁l₁与F₂l₂的比值是否接近1。"]) : ["保持力和悬点距离不变，分别记录90°与30°斜拉作用线。"] }
    });
  }, [balanced, calibrated, challenge.label, evidence.length, forceLine.perpendicularArm, forceLineAngle, forceLineEvidenceReady, leftArm, leftForce, lever.difference, lever.leftMoment, lever.rightMoment, leverInvariant.enoughPoints, leverInvariant.stable, leverLearningReady, playing, rightArm, rightForce, tilt]);
  const chooseChallenge = (next: (typeof leverChallenges)[number]) => {
    setChallengeId(next.id); setLeftForce(next.leftForce); setLeftArm(next.leftArm); setRightForce(next.rightForce); setRightArm(next.rightArm); setZeroOffset(2); setPlaying(false);
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "探究任务", value: next.label });
  };
  const adjust = (setter: React.Dispatch<React.SetStateAction<number>>, value: number, min: number, max: number, control: string) => {
    setter((current) => Number(Math.max(min, Math.min(max, current + value)).toFixed(1)));
    setPlaying(false); recordHarness("control.changed", { experiment: "mechanics-lever", control, step: value });
  };
  const saveBalance = () => {
    if (!balanced) return;
    if (evidence.some((row) => row.leftForce === leftForce && row.leftArm === leftArm && row.rightForce === rightForce && row.rightArm === rightArm)) return;
    const row = { id: Date.now(), leftForce, leftArm, rightForce, rightArm };
    setEvidence((items) => [row, ...items].slice(0, 6));
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "记录平衡数据", value: `${leftForce}×${leftArm}=${rightForce}×${rightArm}` });
  };
  const recordForceLine = () => {
    setForceLineTrials((items) => Array.from(new Set([...items, forceLineAngle])));
    recordHarness("configuration.changed", { experiment: "mechanics-lever", control: "记录作用线", value: `${forceLineAngle}° / l=${forceLine.perpendicularArm.toFixed(2)}格` });
  };
  return <LabFrame field="mechanics" experiment="mechanics-lever" eyebrow="LEVER BALANCE BENCH / 杠杆平衡台" title="先调平，再挂码：让平衡与作用线都有证据" description="先用竖直钩码归纳杠杆平衡条件，再用弹簧测力计做斜拉诊断。第二部分会显示支点到力的作用线的垂直距离，纠正把杆长直接当作力臂的常见错误。" running={playing} onToggle={() => setPlaying((value) => !value)} playLabel="辅助微调右侧悬点" runningLabel="停止辅助微调" actionDisabled={!calibrated} disabledLabel="请先调平空杠杆">
    <div className="lever-challenge-tabs">{leverChallenges.map((item, index) => <button className={challengeId === item.id ? "active" : ""} onClick={() => chooseChallenge(item)} key={item.id}><b>挑战 0{index + 1}</b><span>{item.label}<small>{item.note}</small></span></button>)}</div>
    <div className={`lever-sim lever-balance-bench ${calibrated ? "calibrated" : "calibrating"}`}>
      <div className="lever-procedure"><span className={calibrated ? "done" : "active"}><b>01</b>空杆调平</span><i /><span className={calibrated ? "active" : ""}><b>02</b>挂码调节</span><i /><span className={evidence.length ? "done" : ""}><b>03</b>记录证据</span></div>
      <div className="lever-scale">{Array.from({ length: 19 }, (_, i) => <i data-mark={Math.abs(i - 9)} key={i} />)}</div>
      <div className="lever-beam" style={{ transform: `translate(-50%,-50%) rotate(${tilt}deg)` }}>
        <span className="lever-hanger left" style={{ left: `${50 - leftArm * 4.5}%` }}><i />{Array.from({ length: Math.round(leftForce * 2) }, (_, index) => <b style={{ top: `${32 + index * 7}px` }} key={index} />)}<em>{leftForce} N</em></span>
        <span className="lever-hanger right" style={{ left: `${50 + rightArm * 4.5}%` }}><i />{Array.from({ length: Math.round(rightForce * 2) }, (_, index) => <b style={{ top: `${32 + index * 7}px` }} key={index} />)}<em>{rightForce} N</em></span>
      </div>
      <div className="fulcrum"><i /></div><div className="lever-plumb-line" />
      {!calibrated && <div className="lever-calibration-panel"><span><Focus size={18} /><small>STEP 01 · ZERO ADJUST</small><strong>右端偏低，向左调节平衡螺母</strong></span><div><button onClick={() => setZeroOffset((value) => Math.max(0, value - .5))}>平衡螺母向左</button><output>{zeroOffset === 0 ? "已水平" : `偏差 ${zeroOffset.toFixed(1)}°`}</output><button onClick={() => setZeroOffset((value) => Math.min(4, value + .5))}>向右</button></div></div>}
      <div className={`balance-status ${balanced ? "balanced" : ""} ${calibrated ? "" : "awaiting-reading"}`}><Gauge size={21} /><strong>{!calibrated ? "空杠杆尚未调平" : balanced ? "杠杆水平平衡" : tilt > 0 ? "右端下沉" : "左端下沉"}</strong><span>{calibrated ? `左 ${lever.leftMoment.toFixed(1)} N·格　/　右 ${lever.rightMoment.toFixed(1)} N·格` : "先完成零点校准，再读取力矩"}</span></div>
    </div>
    <div className="lever-manual-controls">
      <article><header><span>LEFT / 左侧钩码</span><strong>F₁l₁ = {lever.leftMoment.toFixed(1)}</strong></header><div><label>钩码重力</label><button onClick={() => adjust(setLeftForce, -.5, .5, 6, "左侧钩码")}>−</button><output>{leftForce.toFixed(1)} N</output><button onClick={() => adjust(setLeftForce, .5, .5, 6, "左侧钩码")}>＋</button></div><div><label>悬挂格数</label><button onClick={() => adjust(setLeftArm, -.5, 1, 9, "左侧悬点")}>←</button><output>{leftArm.toFixed(1)} 格</output><button onClick={() => adjust(setLeftArm, .5, 1, 9, "左侧悬点")}>→</button></div></article>
      <article><header><span>RIGHT / 右侧钩码</span><strong>F₂l₂ = {lever.rightMoment.toFixed(1)}</strong></header><div><label>钩码重力</label><button onClick={() => adjust(setRightForce, -.5, .5, 6, "右侧钩码")}>−</button><output>{rightForce.toFixed(1)} N</output><button onClick={() => adjust(setRightForce, .5, .5, 6, "右侧钩码")}>＋</button></div><div><label>悬挂格数</label><button onClick={() => adjust(setRightArm, -.5, 1, 9, "右侧悬点")}>←</button><output>{rightArm.toFixed(1)} 格</output><button onClick={() => adjust(setRightArm, .5, 1, 9, "右侧悬点")}>→</button></div></article>
      <aside><span>当前任务</span><strong>{challenge.label}</strong><p>{balanced ? "已经水平，可以保存这一组实验数据。" : calibrated ? "观察下沉方向，再决定改变力还是力臂。" : "调平时杠杆上不应悬挂钩码。"}</p><button disabled={!balanced || evidence.some((row) => row.leftForce === leftForce && row.leftArm === leftArm && row.rightForce === rightForce && row.rightArm === rightArm)} onClick={saveBalance}><Save size={15} />记录平衡数据</button></aside>
    </div>
    <Suspense fallback={<ScienceModuleLoading title="杠杆作用线诊断装置" />}><LeverForceLineDiagnostic
        force={rightForce}
        pivotDistance={rightArm}
        angle={forceLineAngle}
        trials={forceLineTrials}
        perpendicularArm={forceLine.perpendicularArm}
        moment={forceLine.moment}
        evidenceReady={forceLineEvidenceReady}
        invariantReady={leverInvariant.stable}
        onAngleChange={setForceLineAngle}
        onRecord={recordForceLine}
      /></Suspense>
    <div className={`lever-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>平衡实验记录</b></span><small>{evidence.length ? `已保存 ${evidence.length} 组` : "至少记录 3 组不同配置，寻找共同关系"}</small></header>{evidence.length ? <div className="lever-table"><b>序号</b><b>F₁/N</b><b>l₁/格</b><b>F₂/N</b><b>l₂/格</b><b>检验</b>{evidence.map((row, index) => <div className="lever-table-row" key={row.id}><span>{evidence.length - index}</span><span>{row.leftForce.toFixed(1)}</span><span>{row.leftArm.toFixed(1)}</span><span>{row.rightForce.toFixed(1)}</span><span>{row.rightArm.toFixed(1)}</span><strong>{(row.leftForce * row.leftArm).toFixed(1)} = {(row.rightForce * row.rightArm).toFixed(1)}</strong></div>)}</div> : <p>当 F₁l₁ 与 F₂l₂ 足够接近时，“记录平衡数据”按钮会解锁。</p>}</div>
    {evidence.length > 0 && <EvidenceVerdict valid={leverLearningReady} title={leverLearningReady ? "平衡条件与斜拉力臂证据均已完成" : leverInvariant.stable ? "平衡条件成立，还需完成斜拉作用线诊断" : "证据仍不足以归纳平衡条件"} detail={leverInvariant.enoughPoints ? `各组 F₁l₁÷F₂l₂ 的最大相对偏差为 ${((leverInvariant.maxRelativeDeviation ?? 0) * 100).toFixed(1)}%；${forceLineEvidenceReady ? "90°与30°对照也证明力臂应垂直量到作用线。" : "接下来比较同F、同r下90°与30°的有效力臂。"}` : `当前只有 ${leverInvariant.pointCount} 组不同配置，还需记录 ${3 - leverInvariant.pointCount} 组。`} />}
  </LabFrame>;
}

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

interface CircuitEvidence { id: number; topology: CircuitTopology; totalCurrent: number; voltage1: number; voltage2: number; }

type OhmMode = "voltage" | "resistance";
interface OhmReading { id: number; mode: OhmMode; voltage: number; resistance: number; current: number; }

function OhmLawLab() {
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

interface ElectromagnetEvidence { id: number; turns: number; current: number; core: string; nails: number; }
interface ElectromagnetPolarityEvidence { id: number; turns: number; current: number; core: string; direction: "forward" | "reverse"; rightPole: "N" | "S"; compassNorthDirection: "left" | "right"; strength: number; }

const powerAppliances = {
  lamp: { label: "小灯泡", ratedVoltage: 6, ratedPower: 3, symbol: "LAMP" },
  motor: { label: "直流电机", ratedVoltage: 6, ratedPower: 2.4, symbol: "MOTOR" },
  resistor: { label: "电热电阻", ratedVoltage: 6, ratedPower: 1.5, symbol: "HEATER" }
} as const;
type PowerApplianceKey = keyof typeof powerAppliances;
interface PowerEvidence { id:number; appliance:string; voltage:number; current:number; power:number; seconds:number; energy:number; state:string; }

function ElectricPowerLab() {
  const recordHarness=useHarnessStore(state=>state.record);
  const [applianceKey,setApplianceKey]=useState<PowerApplianceKey>("lamp");
  const [voltage,setVoltage]=useState(6);
  const [duration,setDuration]=useState(30);
  const [connected,setConnected]=useState<string[]>([]);
  const [powered,setPowered]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [prediction,setPrediction]=useState<"smaller"|"same"|"larger">();
  const [evidence,setEvidence]=useState<PowerEvidence[]>([]);
  const [overvoltageLockObserved,setOvervoltageLockObserved]=useState(false);
  const appliance=powerAppliances[applianceKey];
  const result=calculateAppliancePower(appliance.ratedVoltage,appliance.ratedPower,voltage,elapsed);
  const fullyConnected=["ammeter","voltmeter","energy"].every(item=>connected.includes(item));
  const unsafe=result.operatingState==="overvoltage";
  const completed=elapsed>=duration;
  const validRun=fullyConnected&&completed&&!unsafe;
  const stateLabel=result.operatingState==="overvoltage"?"过压，禁止通电":result.operatingState==="undervoltage"?"欠压运行":"额定附近正常运行";
  const powerPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.appliance,evidence[1]!.voltage,evidence[1]!.seconds],[evidence[0]!.appliance,evidence[0]!.voltage,evidence[0]!.seconds],evidence[1]!.energy,evidence[0]!.energy,.001):undefined;
  const powerComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,voltage:analyzeTargetVariableComparison([older.appliance,older.voltage,older.seconds],[newer.appliance,newer.voltage,newer.seconds],older.power,newer.power,1,1.5,"same-direction",.001),time:analyzeTargetVariableComparison([older.appliance,older.voltage,older.seconds],[newer.appliance,newer.voltage,newer.seconds],older.energy,newer.energy,2,10,"same-direction",.001)}))),[evidence]);
  const voltagePowerEvidence=powerComparisons.find(item=>item.voltage.validTargetComparison);
  const timeEnergyEvidence=powerComparisons.find(item=>item.time.validTargetComparison);
  const powerEvidenceReady=Boolean(voltagePowerEvidence&&timeEnergyEvidence);
  const powerLearningReady=powerEvidenceReady&&overvoltageLockObserved&&!unsafe;
  const powerPredictionMatched=Boolean(prediction==="smaller"&&voltagePowerEvidence);
  const powerConclusion=powerEvidenceReady?{valid:true,title:"P=UI 与 W=Pt 两条证据均已建立",detail:`同一用电器、相同时间下，电压越高实际功率越大；同一用电器、相同电压下，工作时间越长消耗电能越多。${powerPredictionMatched?"低电压预测与证据一致。":"请依据电压对照核对预测。"}`} : voltagePowerEvidence?{valid:false,title:"电压—功率证据已完成，还缺时间—电能证据",detail:"保持同一用电器和相同电压，改换至少相差 10 s 的工作时间，再保存一组。"}:timeEnergyEvidence?{valid:false,title:"时间—电能证据已完成，还缺电压—功率证据",detail:"保持同一用电器和相同工作时间，让安全电压至少变化 1.5 V，再保存一组。"}:!powerPair?undefined:!powerPair.valid?{valid:false,title:"最近两组不是公平比较",detail:"用电器、电压和时间中有多个条件同时变化，无法判断是哪一个因素造成差异。"}:{valid:false,title:"形成了一组单变量比较，但尚未覆盖核心任务",detail:"需要分别完成‘改变电压比较功率’和‘改变时间比较电能’两类对照；只换用电器不计入完成证据。"};
  useEffect(()=>{if(!powered)return;const timer=window.setInterval(()=>setElapsed(value=>{const next=Math.min(duration,value+2);if(next>=duration)setPowered(false);return next;}),200);return()=>window.clearInterval(timer);},[duration,powered]);
  const resetRun=()=>{setPowered(false);setElapsed(0);};
  const toggleConnection=(part:string)=>{resetRun();setConnected(items=>items.includes(part)?items.filter(item=>item!==part):[...items,part]);recordHarness("configuration.changed",{experiment:"circuit-power",control:"仪表接线",value:part});};
  const changeAppliance=(key:PowerApplianceKey)=>{setApplianceKey(key);setVoltage(powerAppliances[key].ratedVoltage);resetRun();};
  const save=()=>{if(!validRun)return;const row={id:Date.now(),appliance:appliance.label,voltage,current:result.current,power:result.actualPower,seconds:elapsed,energy:result.energyJoules,state:stateLabel};setEvidence(items=>[row,...items.filter(item=>item.appliance!==row.appliance||item.voltage!==row.voltage||item.seconds!==row.seconds)].slice(0,8));recordHarness("configuration.changed",{experiment:"circuit-power",control:"保存电功率测量",value:`${row.appliance}/${voltage}V/${row.power.toFixed(2)}W/${row.energy.toFixed(1)}J`});};
  useEffect(()=>{const issues=unsafe?["已观察过压锁定；把实际电压恢复到额定值或安全欠压。"]:powerLearningReady?[]:powerEvidenceReady&&!overvoltageLockObserved?["双证据已完成；选择7.5 V观察铭牌过压保护，再恢复安全电压。"]:!fullyConnected?[`还需正确接入 ${3-connected.length} 个测量仪表。`]:!completed?["选择工作时间并闭合开关，等待计时结束。"]:evidence.length<2?["保存基准后，固定用电器分别研究电压和工作时间。"]:!voltagePowerEvidence?["还缺电压—功率证据：固定用电器和时间，只改变安全电压。"]:["还缺时间—电能证据：固定用电器和电压，只改变工作时间。"];publishApparatusSnapshot({module:"circuit-power",capturedAt:new Date().toISOString(),origin:connected.length||elapsed||evidence.length||overvoltageLockObserved?"learner":"system",controls:[{id:"appliance",label:"被测用电器",value:appliance.label,source:"control"},{id:"rated",label:"铭牌",value:`${appliance.ratedVoltage}V ${appliance.ratedPower}W`,source:"control"},{id:"voltage",label:"实际电压",value:voltage,unit:"V",source:"control"},{id:"duration",label:"设定工作时间",value:duration,unit:"s",source:"control"},{id:"prediction",label:"低于额定电压的功率预测",value:prediction==="smaller"?"更小":prediction==="same"?"不变":prediction==="larger"?"更大":"未选择",source:"control"}],apparatus:[{id:"ammeter",label:"电流表串联",value:connected.includes("ammeter"),source:"apparatus"},{id:"voltmeter",label:"电压表并联",value:connected.includes("voltmeter"),source:"apparatus"},{id:"energy",label:"电能计时器接入",value:connected.includes("energy"),source:"apparatus"},{id:"switch",label:"开关闭合",value:powered,source:"apparatus"},{id:"overvoltage-lock",label:"过压锁定已观察",value:overvoltageLockObserved,source:"apparatus"}],readings:[{id:"U",label:"实际电压",value:fullyConnected?voltage:null,unit:"V",source:"reading"},{id:"I",label:"实际电流",value:fullyConnected?result.current:null,unit:"A",source:"reading"},{id:"P",label:"实际功率",value:fullyConnected?result.actualPower:null,unit:"W",source:"reading"},{id:"W",label:"电能",value:elapsed?result.energyJoules:null,unit:"J",source:"reading"}],derived:[{id:"formula",label:"功率与电能",value:"P=UI；W=Pt",source:"model"},{id:"boundary",label:"模型边界",value:"按铭牌等效为定值电阻；真实灯丝电阻会随温度变化",source:"model"},{id:"state",label:"运行状态",value:stateLabel,source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:powerPair?.valid??false,source:"model"},{id:"voltage-power",label:"电压—功率证据",value:Boolean(voltagePowerEvidence),source:"model"},{id:"time-energy",label:"时间—电能证据",value:Boolean(timeEnergyEvidence),source:"model"}],validity:{ready:powerLearningReady,issues}});},[appliance.label,appliance.ratedPower,appliance.ratedVoltage,completed,connected,duration,elapsed,evidence.length,fullyConnected,overvoltageLockObserved,powerEvidenceReady,powerLearningReady,powerPair?.valid,powered,result.actualPower,result.current,result.energyJoules,stateLabel,timeEnergyEvidence,unsafe,validRun,voltage,voltagePowerEvidence]);
  const startToggle=()=>{if(powered){setPowered(false);return;}if(completed)setElapsed(0);setPowered(true);recordHarness("simulation.toggled",{experiment:"circuit-power",running:true,action:"开始电能计时"});};
  return <LabFrame field="circuit" experiment="circuit-power" eyebrow="POWER & ENERGY BENCH / 电功率与电能台" title="先读铭牌、正确接表，再让计时器记录用电快慢" description="电流表串联、电压表并联，电能计时器同步累计 W=Pt。改变实际电压比较功率，但超过额定电压 10% 时保护装置禁止通电。当前模型把用电器等效为定值电阻，真实灯丝还会受温度影响。" running={powered} onToggle={startToggle} playLabel="闭合开关并开始计时" runningLabel="断开开关" actionDisabled={!fullyConnected||unsafe} disabledLabel={!fullyConnected?`还差 ${3-connected.length} 个仪表`:"过压保护已锁定"}>
    <div className="power-inquiry-console"><section><span><b>01</b>读铭牌</span><strong>{appliance.label} · {appliance.ratedVoltage} V / {appliance.ratedPower} W</strong><small>额定值描述正常工作条件，不等于任何电压下的实际值。</small></section><section><span><b>02</b>先作预测</span><p>实际电压低于额定电压，实际功率会怎样？</p><div>{(["smaller","same","larger"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="smaller"?"更小":value==="same"?"不变":"更大"}</button>)}</div></section><section><span><b>03</b>安全边界</span><strong className={unsafe?"danger":""}>{stateLabel}</strong><small>换接用电器或调整电压前，必须先断开开关。</small></section></div>
    <div className={`power-lab-rig ${fullyConnected?"wired":""} ${powered?"powered":""} ${completed?"completed":""} ${unsafe?"unsafe":""}`} style={{"--power-level":Math.min(1,result.actualPower/4),"--voltage-position":`${Math.min(100,result.voltageRatio/1.35*100)}%`,"--energy-progress":`${Math.min(100,elapsed/duration*100)}%`} as React.CSSProperties}>
      <div className="power-procedure-strip">{["识读铭牌","连接电流表","并联电压表","设定电压","计时运行","保存证据"].map((label,index)=>{const stage=!connected.includes("ammeter")?1:!connected.includes("voltmeter")?2:!fullyConnected?2:!elapsed?3:powered?4:completed?5:4;return <span className={index<stage?"done":index===stage?"active":""} key={label}><b>{index<stage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="power-supply-unit"><BatteryCharging size={27}/><span><small>DC SUPPLY / 学生电源</small><strong>{voltage.toFixed(1)} V</strong></span><i className={powered?"live":""}/></div>
      <svg className="power-circuit-board" viewBox="0 0 800 340" aria-label="电功率测量电路"><path className="power-wire main" d="M100 255 V170 H245 M345 170 H470 M610 170 H710 V255 H100"/><path className="power-wire parallel" d="M470 170 V70 H610 V170"/><g className={`power-meter amp ${connected.includes("ammeter")?"connected":"missing"}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("ammeter")?"断开":"接入"}电流表`} onClick={()=>{if(!powered)toggleConnection("ammeter");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("ammeter");}}}><circle cx="295" cy="170" r="48"/><text x="295" y="164">A</text><text x="295" y="190">{fullyConnected?result.current.toFixed(2):"—"}</text></g><g className={`power-load load-${applianceKey}`}><rect x="470" y="140" width="140" height="60" rx="8"/><text x="540" y="165">{appliance.symbol}</text><text x="540" y="187">{appliance.ratedVoltage}V / {appliance.ratedPower}W</text></g><g className={`power-meter volt ${connected.includes("voltmeter")?"connected":"missing"}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("voltmeter")?"断开":"接入"}电压表`} onClick={()=>{if(!powered)toggleConnection("voltmeter");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("voltmeter");}}}><circle cx="540" cy="70" r="45"/><text x="540" y="65">V</text><text x="540" y="90">{fullyConnected?voltage.toFixed(1):"—"}</text></g>{powered&&Array.from({length:12},(_,index)=><circle className="power-current-dot" cx={125+index*48} cy="255" r="3" style={{animationDelay:`${-index*.11}s`}} key={index}/>)}</svg>
      <div className={`power-nameplate state-${result.operatingState}`}><span><small>NAMEPLATE / 铭牌比对</small><strong>{appliance.ratedVoltage} V　{appliance.ratedPower} W</strong></span><div><i/><b>U实 / U额 = {result.voltageRatio.toFixed(2)}</b></div><em>{stateLabel}</em></div>
      <div className="power-meter-bank"><article><small>电流表 A</small><strong>{fullyConnected?result.current.toFixed(2):"— —"} A</strong><i className={connected.includes("ammeter")?"ok":""}/></article><article><small>电压表 V</small><strong>{fullyConnected?voltage.toFixed(1):"— —"} V</strong><i className={connected.includes("voltmeter")?"ok":""}/></article><article><small>功率运算 P=UI</small><strong>{fullyConnected?result.actualPower.toFixed(2):"— —"} W</strong><i className={fullyConnected?"ok":""}/></article></div>
      <div className={`power-energy-meter ${connected.includes("energy")?"connected":""}`} role="button" tabIndex={powered?-1:0} aria-disabled={powered} aria-label={`${connected.includes("energy")?"断开":"接入"}电能计时器`} onClick={()=>{if(!powered)toggleConnection("energy");}} onKeyDown={(event)=>{if(!powered&&(event.key==="Enter"||event.key===" ")){event.preventDefault();toggleConnection("energy");}}}><header><TimerReset size={18}/><span><small>ENERGY COUNTER / 电能计时器</small><strong>{elapsed.toFixed(0)} / {duration} s</strong></span></header><output>{connected.includes("energy")?result.energyJoules.toFixed(1):"— —"}<small> J</small></output><div><i/></div><footer>W = P × t　·　{result.energyKilowattHours.toFixed(6)} kW·h</footer></div>
      <div className={`power-live-result ${validRun?"valid":""} ${unsafe?"danger":""}`}><Power size={21}/><span><small>ACTUAL POWER / 实际功率</small><strong>{unsafe?"过压保护：禁止闭合开关":fullyConnected?`P = ${voltage.toFixed(1)} × ${result.current.toFixed(2)} = ${result.actualPower.toFixed(2)} W`:"先完成三项仪表接线"}</strong><em>{completed?`${duration}s 内消耗电能 ${result.energyJoules.toFixed(1)} J。`:"运行后同时记录功率和累计电能。"}</em></span></div>
      {!fullyConnected&&<InteractionCue text="点击虚线电表或下方接线按钮，完成测量电路"/>}
    </div>
    <div className="power-operation-dock"><section><span>选择用电器</span><div>{(Object.keys(powerAppliances) as PowerApplianceKey[]).map(key=><button className={applianceKey===key?"active":""} disabled={powered} onClick={()=>changeAppliance(key)} key={key}><strong>{powerAppliances[key].label}</strong><small>{powerAppliances[key].ratedVoltage}V/{powerAppliances[key].ratedPower}W</small></button>)}</div></section><section><span>连接测量仪表</span><div>{[{id:"ammeter",label:"电流表串联"},{id:"voltmeter",label:"电压表并联"},{id:"energy",label:"电能计时器"}].map(item=><button className={connected.includes(item.id)?"done":""} disabled={powered} onClick={()=>toggleConnection(item.id)} key={item.id}>{connected.includes(item.id)?"✓ ":"＋ "}{item.label}</button>)}</div></section><section><span>实际电压</span><div>{[3,4.5,6,7.5].map(value=><button className={voltage===value?"active":""} disabled={powered} onClick={()=>{setVoltage(value);if(value>appliance.ratedVoltage*1.1){setOvervoltageLockObserved(true);recordHarness("configuration.changed",{experiment:"circuit-power",control:"过压保护锁定",value:`${value}V>${appliance.ratedVoltage}V额定`});}resetRun();}} key={value}>{value} V</button>)}</div></section><section><span>工作时间</span><div>{[10,30,60].map(value=><button className={duration===value?"active":""} disabled={powered} onClick={()=>{setDuration(value);resetRun();}} key={value}>{value} s</button>)}</div></section><aside><span>本组证据</span><strong>{validRun?`${result.actualPower.toFixed(2)}W · ${result.energyJoules.toFixed(1)}J`:"计时完成后保存"}</strong><button disabled={!validRun} onClick={save}><Save size={15}/>保存测量</button></aside></div>
    <section className={`power-safety-proof ${overvoltageLockObserved?"observed":""} ${unsafe?"locked":""}`}><Shield size={18}/><span><small>NAMEPLATE SAFETY PROOF / 铭牌安全证据</small><strong>{unsafe?`7.5 V 超过 ${appliance.ratedVoltage} V 额定值10%，开关已锁定`:overvoltageLockObserved?"过压锁定已观察，当前已恢复安全电压":"完成双证据后，主动选择7.5 V观察保护锁定"}</strong><em>只观察保护状态，不允许真实通电；完成后必须恢复到6 V或更低。</em></span><b>{overvoltageLockObserved&&!unsafe?"SAFE RECOVERED":unsafe?"LOCKED":"PENDING"}</b></section>
    <div className={`power-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>电功率与电能双证据</b></span><small>{powerLearningReady?"公式证据与安全恢复均已完成":powerEvidenceReady?"两条公式证据已建立，还需安全诊断":`已保存 ${evidence.length} 组`}</small></header><FactorEvidenceStatus className="power-evidence-status" items={[{label:"电压 → 功率",note:"固定用电器与时间",done:Boolean(voltagePowerEvidence)},{label:"时间 → 电能",note:"固定用电器与电压",done:Boolean(timeEnergyEvidence)}]}/>{evidence.length?<div><b>组次</b><b>用电器</b><b>U/V</b><b>I/A</b><b>P/W</b><b>t/s</b><b>W/J</b>{evidence.map((row,index)=><div className="power-evidence-row" key={row.id}><span>{evidence.length-index}</span><strong>{row.appliance}</strong><span>{row.voltage.toFixed(1)}</span><span>{row.current.toFixed(2)}</span><strong>{row.power.toFixed(2)}</strong><span>{row.seconds}</span><strong>{row.energy.toFixed(1)}</strong></div>)}</div>:<p>先保存基准，再分别完成“只改变电压比较功率”和“只改变时间比较电能”。</p>}{powerConclusion&&<EvidenceVerdict valid={powerLearningReady} title={powerLearningReady?"P=UI、W=Pt与铭牌安全证据全部完成":powerEvidenceReady?"两条公式证据已完成，还需观察并恢复过压保护":powerConclusion.title} detail={powerLearningReady?`${powerConclusion.detail} 7.5 V过压锁定已观察并恢复到安全工作状态。`:powerEvidenceReady?"选择7.5 V观察保护锁定，不要通电；随后恢复到6 V或更低。":powerConclusion.detail}/>}</div>
  </LabFrame>;
}

function ElectromagnetLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [turns, setTurns] = useState(100);
  const [current, setCurrent] = useState(.5);
  const [hasIronCore, setHasIronCore] = useState(true);
  const [assembled, setAssembled] = useState(false);
  const [powered, setPowered] = useState(false);
  const [poweredSeconds, setPoweredSeconds] = useState(0);
  const [tested, setTested] = useState(false);
  const [currentDirection, setCurrentDirection] = useState<"forward" | "reverse">("forward");
  const [prediction, setPrediction] = useState<"turns" | "current" | "core">();
  const [evidence, setEvidence] = useState<ElectromagnetEvidence[]>([]);
  const [polarityEvidence, setPolarityEvidence] = useState<ElectromagnetPolarityEvidence[]>([]);
  const result = calculateElectromagnetExperiment(turns, current, hasIronCore, poweredSeconds);
  const polarity = calculateElectromagnetPolarity(currentDirection);
  const magnetPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.turns,evidence[1]!.current,evidence[1]!.core],[evidence[0]!.turns,evidence[0]!.current,evidence[0]!.core],evidence[1]!.nails,evidence[0]!.nails,.001):undefined;
  const magnetComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,comparison:analyzeControlledComparison([older.turns,older.current,older.core],[newer.turns,newer.current,newer.core],older.nails,newer.nails,.001)}))),[evidence]);
  const turnsEvidence=magnetComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===0&&comparison.outcomeDirection===(newer.turns>older.turns?"increase":"decrease"));
  const currentEvidence=magnetComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===1&&comparison.outcomeDirection===(newer.current>older.current?"increase":"decrease"));
  const coreEvidence=magnetComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===2&&comparison.outcomeDirection===(newer.core==="铁芯"?"increase":"decrease"));
  const magnetEvidenceReady=Boolean(turnsEvidence&&currentEvidence&&coreEvidence);
  const polarityComparison=useMemo(()=>polarityEvidence.flatMap((newer,index)=>polarityEvidence.slice(index+1).map(older=>({newer,older}))).find(({newer,older})=>newer.turns===older.turns&&newer.current===older.current&&newer.core===older.core&&newer.direction!==older.direction),[polarityEvidence]);
  const polarityEvidenceReady=Boolean(polarityComparison&&polarityComparison.newer.rightPole!==polarityComparison.older.rightPole&&Math.abs(polarityComparison.newer.strength-polarityComparison.older.strength)<.001);
  const electromagnetEvidenceReady=magnetEvidenceReady&&polarityEvidenceReady;
  const currentPolarityEvidence=polarityEvidence.filter((item)=>item.turns===turns&&item.current===current&&item.core===(hasIronCore?"铁芯":"无铁芯"));
  const predictedEvidenceReady=prediction==="turns"?Boolean(turnsEvidence):prediction==="current"?Boolean(currentEvidence):prediction==="core"?Boolean(coreEvidence):false;
  const magnetConclusion=magnetEvidenceReady?{valid:true,title:"电磁铁三因素证据完整",detail:`增加匝数、增大电流和加入软铁芯三种改变均获得单变量证据支持。${predictedEvidenceReady?"你选择的预测已得到验证。":"请回顾预测并依据三条证据作出修正。"}`} : turnsEvidence&&currentEvidence?{valid:false,title:"匝数和电流证据已完成，还缺铁芯证据",detail:"保持匝数和电流不变，对比软铁芯与无铁芯。"}:turnsEvidence&&coreEvidence?{valid:false,title:"匝数和铁芯证据已完成，还缺电流证据",detail:"保持匝数和铁芯不变，只改变电流。"}:currentEvidence&&coreEvidence?{valid:false,title:"电流和铁芯证据已完成，还缺匝数证据",detail:"保持电流和铁芯不变，只改变线圈匝数。"}:!magnetPair?undefined:!magnetPair.valid?{valid:false,title:"最近两组同时改变了多个条件",detail:"匝数、电流和铁芯三项中只能改变一项，才能判断该因素对磁性的影响。"}:{valid:false,title:"已获得一条单因素证据",detail:"继续保持其余条件不变，补齐匝数、电流和铁芯三项因素。"};
  useEffect(() => {
    if (!powered) return;
    const timer = window.setInterval(() => setPoweredSeconds((value) => Math.min(60, value + .2)), 200);
    return () => window.clearInterval(timer);
  }, [powered]);
  useEffect(() => { if (result.overheatRisk) setPowered(false); }, [result.overheatRisk]);
  const resetConfiguration = () => { setAssembled(false); setPowered(false); setPoweredSeconds(0); setTested(false); };
  const changeTurns = (value: number) => { setTurns(value); resetConfiguration(); };
  const changeCurrent = (value: number) => { setCurrent(value); setPowered(false); setPoweredSeconds(0); setTested(false); };
  const changeDirection = (value: "forward" | "reverse") => { setCurrentDirection(value); setPowered(false); setTested(false); };
  const save = () => {
    if (!tested || result.overheatRisk) return;
    const row = { id: Date.now(), turns, current, core: hasIronCore ? "铁芯" : "无铁芯", nails: result.pickedNails };
    setEvidence((items) => [row, ...items.filter((item) => !(item.turns === turns && item.current === current && item.core === row.core))].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "circuit-magnet", control: "保存吸钉实验", value: `${turns}匝/${current}A/${row.core}/${row.nails}枚` });
  };
  const observePolarity = () => {
    if (!assembled || !powered) return;
    const row: ElectromagnetPolarityEvidence = { id: Date.now(), turns, current, core: hasIronCore ? "铁芯" : "无铁芯", direction: currentDirection, rightPole: polarity.rightPole, compassNorthDirection: polarity.compassNorthDirection, strength: result.strengthIndex };
    setPolarityEvidence((items) => [row, ...items.filter((item) => !(item.turns === row.turns && item.current === row.current && item.core === row.core && item.direction === row.direction))].slice(0, 8));
    setPowered(false);
    recordHarness("configuration.changed", { experiment: "circuit-magnet", control: "小磁针判定磁极", value: `${currentDirection === "forward" ? "正接" : "反接"}/右端${row.rightPole}极/北端向${row.compassNorthDirection === "right" ? "右" : "左"}` });
  };
  useEffect(() => {
    const issues = result.overheatRisk ? ["线圈温升风险较高，已自动断电，请冷却或降低电流。"] : !magnetEvidenceReady ? !assembled ? ["先把线圈和铁芯安装到测试台。"] : !powered && !tested ? ["短暂闭合开关，让线圈产生磁场。"] : !tested ? ["通电后把电磁铁移到铁钉盘上方进行吸钉测试。"] : evidence.length < 2 ? ["保存基准后，每次只改变匝数、电流或铁芯中的一项。"] : !turnsEvidence ? ["还缺匝数因素证据：固定电流和铁芯，只改变匝数。"] : !currentEvidence ? ["还缺电流因素证据：固定匝数和铁芯，只改变电流。"] : ["还缺铁芯因素证据：固定匝数和电流，对比有无软铁芯。"] : !polarityEvidenceReady ? ["保持匝数、电流和铁芯不变，分别正接、反接电源，用小磁针判定磁极。"] : [];
    publishApparatusSnapshot({ module: "circuit-magnet", capturedAt: new Date().toISOString(), origin: assembled || evidence.length ? "learner" : "system", controls: [
      { id: "turns", label: "线圈匝数", value: turns, unit: "匝", source: "control" }, { id: "current", label: "线圈电流", value: current, unit: "A", source: "control" }, { id: "core", label: "线圈内芯", value: hasIronCore ? "软铁芯" : "无铁芯", source: "control" }, { id: "direction", label: "电源接法", value: currentDirection === "forward" ? "正接" : "反接", source: "control" }, { id: "prediction", label: "增强磁性预测", value: prediction === "turns" ? "增加匝数" : prediction === "current" ? "增大电流" : prediction === "core" ? "加入铁芯" : "未选择", source: "control" }
    ], apparatus: [
      { id: "assembled", label: "电磁铁已装配", value: assembled, source: "apparatus" }, { id: "powered", label: "线圈正在通电", value: powered, source: "apparatus" }, { id: "powered-time", label: "连续通电时间", value: poweredSeconds, unit: "s", source: "apparatus" }, { id: "overheat", label: "线圈过热风险", value: result.overheatRisk, source: "apparatus" }
    ], readings: [
      { id: "nails", label: "吸起铁钉数量", value: tested ? result.pickedNails : null, unit: "枚", source: "reading" }, { id: "strength", label: "磁性趋势指标", value: tested ? result.strengthIndex : null, unit: "指数", source: "reading" }, { id: "right-pole", label: "通电时线圈右端磁极", value: powered ? polarity.rightPole : "断电无稳定磁极", source: "reading" }, { id: "temperature-rise", label: "线圈相对温升", value: poweredSeconds ? result.temperatureRise : null, unit: "℃", source: "reading" }
    ], derived: [
      { id: "model-note", label: "吸钉模型说明", value: "固定铁钉规格与操作条件下的可重复教学指标，不是磁感应强度", source: "model" }, { id: "heating", label: "发热趋势", value: "Q∝I²Rt", source: "model" }, { id: "polarity-rule", label: "反接电源交换磁极但不改变强弱", value: polarityEvidenceReady, source: "model" },{id:"latest-comparison",label:"最近两组公平比较",value:magnetPair?.valid??false,source:"model"},{id:"turns-evidence",label:"匝数因素证据",value:Boolean(turnsEvidence),source:"model"},{id:"current-evidence",label:"电流因素证据",value:Boolean(currentEvidence),source:"model"},{id:"core-evidence",label:"铁芯因素证据",value:Boolean(coreEvidence),source:"model"}
    ], validity: { ready: electromagnetEvidenceReady&&!result.overheatRisk, issues } });
  }, [assembled, coreEvidence, current, currentDirection, currentEvidence, electromagnetEvidenceReady, evidence.length, hasIronCore, magnetEvidenceReady, magnetPair?.valid, polarity.rightPole, polarityEvidenceReady, powered, poweredSeconds, prediction, result.overheatRisk, result.pickedNails, result.strengthIndex, result.temperatureRise, tested, turns, turnsEvidence]);
  return <LabFrame field="circuit" experiment="circuit-magnet" eyebrow="ELECTROMAGNET TEST BAY / 电磁铁测试舱" title="装好线圈、短暂通电，再用铁钉数量比较磁性" description="在固定铁钉规格和相同吸取方式下，用吸起数量作为磁性强弱的教学指标。研究某个因素时只改变一个条件；连续通电会使线圈发热，平台按 I²Rt 趋势进行安全保护。" running={powered} onToggle={() => { setPowered((value) => !value); if (!powered) { setTested(false); recordHarness("simulation.toggled", { experiment: "circuit-magnet", running: true, action: "电磁铁通电" }); } }} playLabel="短暂闭合开关" runningLabel="立即断开开关" actionDisabled={!assembled || result.overheatRisk} disabledLabel={!assembled ? "请先装配电磁铁" : "线圈过热，等待复位"}>
    <div className="magnet-inquiry-console"><section><span><b>01</b>先作预测</span><p>你认为哪种改变会增强电磁铁磁性？</p><div>{(["turns","current","core"] as const).map((value) => <button className={prediction === value ? "active" : ""} onClick={() => setPrediction(value)} key={value}>{value === "turns" ? "增加匝数" : value === "current" ? "增大电流" : "加入铁芯"}</button>)}</div></section><section><span><b>02</b>安全规则</span><strong>改变器材或反接电源前先断电。</strong><small>本实验不鼓励长时间通电，电流越大，允许的连续时间越短。</small></section><section><span><b>03</b>双证据任务</span><strong>{electromagnetEvidenceReady?"强弱因素与磁极方向均已验证":`${Number(Boolean(turnsEvidence))+Number(Boolean(currentEvidence))+Number(Boolean(coreEvidence))} / 3 强弱因素 · ${polarityEvidenceReady?"磁极已验证":"磁极待验证"}`}</strong><small>吸钉比较强弱，小磁针判断磁场方向。</small></section></div>
    <div className={`magnet-lab-sim direction-${currentDirection} ${assembled ? "assembled" : ""} ${powered ? "powered" : ""} ${tested ? "tested" : ""} ${result.overheatRisk ? "overheat" : ""}`} style={{ "--magnet-strength": powered ? Math.min(1, result.strengthIndex / 4) : 0, "--coil-heat": Math.min(1, result.temperatureRise / 8) } as React.CSSProperties}>
      <div className="magnet-procedure-strip">{["选择器材", "装配线圈", "短暂通电", "吸取铁钉", "反接判极", "形成结论"].map((label,index) => { const activeStage=!assembled?1:!magnetEvidenceReady?!powered&&!tested?2:powered?3:tested?3:2:!polarityEvidenceReady?4:5; return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>; })}</div>
      <div className="magnet-power-supply"><BatteryCharging size={26}/><span><small>{currentDirection==="forward"?"电源正接":"电源反接"}</small><strong>{current.toFixed(1)} A</strong></span><b className="magnet-terminal positive">＋</b><b className="magnet-terminal negative">−</b><i className={powered?"closed":""}/></div>
      <div className="magnet-wire-path"><i/><i/></div>
      <div className="magnet-coil-rig"><span className={`magnet-core ${hasIronCore?"iron":"air"}`}>{hasIronCore?"软铁芯":"空气芯"}{powered&&<><i className={`pole left ${polarity.leftPole.toLowerCase()}`}>{polarity.leftPole}</i><i className={`pole right ${polarity.rightPole.toLowerCase()}`}>{polarity.rightPole}</i></>}</span><div className="magnet-windings">{Array.from({length:Math.round(turns/25)},(_,index)=><i style={{"--winding":index} as React.CSSProperties} key={index}/>)}</div><b>{turns} 匝</b><em>线圈温升趋势 +{result.temperatureRise.toFixed(1)}℃</em></div>
      <div className="magnet-field-rings">{Array.from({length:5},(_,index)=><i style={{inset:`${index*15}px`,opacity:powered?.12+Math.min(.75,result.strengthIndex/5)-index*.08:.04}} key={index}/>)}</div>
      <div className={`magnet-compass ${powered?"active":""}`}><span><i>N</i><b style={{transform:`rotate(${powered?(polarity.compassNorthDirection==="right"?90:-90):0}deg)`}}/><em>S</em></span><strong>小磁针</strong><small>{powered?`北端向${polarity.compassNorthDirection==="right"?"右":"左"}偏转` : "通电后观察偏转"}</small></div>
      <div className="magnet-nail-tray"><span>标准铁钉盘<small>每次同样距离、同样时间</small></span>{Array.from({length:12},(_,index)=><i className={tested&&index<result.pickedNails?"picked":""} style={{"--nail-index":index} as React.CSSProperties} key={index}/>)}</div>
      <div className="magnet-thermal-gauge"><span><Flame size={17}/><small>COIL HEAT / 线圈温升</small><strong>+{result.temperatureRise.toFixed(1)}℃</strong></span><div><i style={{width:`${Math.min(100,result.temperatureRise/8*100)}%`}}/></div><em>{result.overheatRisk?"已自动断电保护":powered?`已连续通电 ${poweredSeconds.toFixed(1)} s`:"当前安全，可短暂通电"}</em></div>
      <div className={`magnet-live-result ${tested?"valid":""}`}><RadioTower size={20}/><span><small>NAIL PICKUP TEST / 吸钉测试</small><strong>{tested?`吸起 ${result.pickedNails} 枚铁钉`:powered?"磁场已建立，可以进行测试":"等待通电建立磁场"}</strong><em>{tested?`磁性趋势指标 ${result.strengthIndex.toFixed(2)}；只用于本实验对照。`:"固定铁钉规格、距离和接触时间。"}</em></span></div>
      {!assembled&&<InteractionCue text="选择线圈和铁芯后，点击装配电磁铁"/>}
    </div>
    <div className="magnet-operation-dock"><section><span>线圈匝数</span><div>{[50,100,200].map(value=><button className={turns===value?"active":""} disabled={powered} onClick={()=>changeTurns(value)} key={value}>{value} 匝</button>)}</div></section><section><span>线圈电流</span><div>{[.5,1,2].map(value=><button className={current===value?"active":""} disabled={powered} onClick={()=>changeCurrent(value)} key={value}>{value.toFixed(1)} A</button>)}</div></section><section><span>线圈内芯</span><div><button className={hasIronCore?"active":""} disabled={powered} onClick={()=>{setHasIronCore(true);resetConfiguration();}}>软铁芯</button><button className={!hasIronCore?"active":""} disabled={powered} onClick={()=>{setHasIronCore(false);resetConfiguration();}}>无铁芯</button></div></section><section><span>电流方向</span><div><button className={currentDirection==="forward"?"active":""} disabled={powered} onClick={()=>changeDirection("forward")}>正接</button><button className={currentDirection==="reverse"?"active":""} disabled={powered} onClick={()=>changeDirection("reverse")}>反接</button></div></section><section><span>装配与测试</span><div><button disabled={assembled||powered} onClick={()=>setAssembled(true)}>装配</button><button disabled={!powered||tested} onClick={()=>{setTested(true);setPowered(false);}}>吸钉</button></div></section><aside><span>本组实验</span><strong>{tested?`${turns}匝 · ${current}A · ${hasIronCore?"铁芯":"无铁芯"} · ${result.pickedNails}枚`:"完成吸取后保存"}</strong><button disabled={!tested||result.overheatRisk} onClick={save}><Save size={15}/>保存强弱证据</button></aside></div>
    <section className={`magnet-polarity-lab ${polarityEvidenceReady?"complete":""}`}><header><span><Compass size={17}/><b>POLARITY REVERSAL / 反接电源判定磁极</b></span><button disabled={!assembled||!powered} onClick={observePolarity}>用小磁针记录当前磁极</button></header><div>{(["forward","reverse"] as const).map(direction=>{const row=currentPolarityEvidence.find(item=>item.direction===direction);return <article className={row?"done":""} key={direction}><b>{direction==="forward"?"电源正接":"电源反接"}</b><strong>{row?`右端 ${row.rightPole} 极` : "等待同配置观察"}</strong><span>{row?`小磁针北端向${row.compassNorthDirection==="right"?"右":"左"} · 强度 ${row.strength.toFixed(2)}`:"保持匝数、电流、铁芯不变"}</span></article>;})}</div>{polarityEvidence.length>0&&<EvidenceVerdict valid={polarityEvidenceReady} title={polarityEvidenceReady?"反接电源会交换电磁铁磁极":"还需在同一装置配置下补齐另一种接法"} detail={polarityEvidenceReady&&polarityComparison?`正接与反接时右端分别为 ${polarityComparison.older.rightPole}、${polarityComparison.newer.rightPole} 极；磁性强度指标均为 ${polarityComparison.newer.strength.toFixed(2)}，说明电流方向影响磁场方向，不决定磁性强弱。`:"断电后只交换电源正负接线，再次通电并用小磁针记录；不要同时改变匝数、电流或铁芯。"}/>}</section>
    <div className={`magnet-evidence-ledger ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>电磁铁三因素证据</b></span><div><small>{magnetEvidenceReady?"三项控制变量证据已建立":`已保存 ${evidence.length} 组`}</small><button onClick={()=>{setPowered(false);setPoweredSeconds(0);setTested(false);}}><RotateCcw size={14}/>线圈冷却复位</button></div></header><FactorEvidenceStatus className="magnet-factor-status" items={[{label:"匝数",done:Boolean(turnsEvidence)},{label:"电流",done:Boolean(currentEvidence)},{label:"铁芯",done:Boolean(coreEvidence)}]}/>{evidence.length?<div><b>组次</b><b>匝数</b><b>电流/A</b><b>内芯</b><b>吸钉/枚</b>{evidence.map((row,index)=><div className="magnet-evidence-row" key={row.id}><span>{evidence.length-index}</span><strong>{row.turns}</strong><span>{row.current.toFixed(1)}</span><span>{row.core}</span><strong>{row.nails}</strong></div>)}</div>:<p>保存一组基准后，分别只改变匝数、电流和铁芯；合理复用基准时至少四组即可完成。</p>}{magnetConclusion&&<EvidenceVerdict valid={magnetConclusion.valid} title={magnetConclusion.title} detail={magnetConclusion.detail}/>}</div>
  </LabFrame>;
}

function CircuitLab() {
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
  const [faultEvidence, setFaultEvidence] = useState<Partial<Record<CircuitTopology, boolean>>>({});
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
  const seriesEvidence = evidence.find((row) => row.topology === "series");
  const parallelEvidence = evidence.find((row) => row.topology === "parallel");
  const circuitComparisonReady = Boolean(seriesEvidence && parallelEvidence && faultEvidence.series && faultEvidence.parallel);
  const shortCircuit=calculateProtectedShortCircuit(9);
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
            : !faultEvidence[topology] ? ["保持通电并旋松一只灯泡，观察另一只灯泡。"]
              : ["切换另一种连接方式，重复接线、测量与断路测试。"] : !shortObserved?["断开开关后安装保护短路线，再合闸观察保险熔断。"]:["拆除短路线并复位保险。"];
    publishApparatusSnapshot({
      module: "circuit-basic",
      capturedAt: new Date().toISOString(),
      origin: connectedWires.length > 0 || topology !== "series" || hasPowered || voltage !== 9 || r1 !== 20 || r2 !== 10 ? "learner" : "system",
      controls: [
        { id: "topology", label: "连接方式", value: topology === "series" ? "串联" : "并联", source: "control" },
        { id: "voltage", label: "电源电压", value: voltage, unit: "V", source: "control" },
        { id: "resistance1", label: "L₁电阻", value: r1, unit: "Ω", source: "control" },
        { id: "resistance2", label: "L₂电阻", value: r2, unit: "Ω", source: "control" }
      ],
      apparatus: [
        { id: "connected-wires", label: "已接导线", value: connectedWires.length, unit: "根", source: "apparatus" },
        { id: "required-wires", label: "所需导线", value: plans.length, unit: "根", source: "apparatus" },
        { id: "fully-wired", label: "回路接线完整", value: fullyWired, source: "apparatus" },
        { id: "switch-closed", label: "总开关闭合", value: closed, source: "apparatus" },
        { id: "lamp1-connected", label: "L₁接通", value: lamp1Connected, source: "apparatus" },
        { id: "lamp2-connected", label: "L₂接通", value: lamp2Connected, source: "apparatus" }, { id:"short-wire",label:"电源短路线已安装",value:shortInstalled,source:"apparatus" }, { id:"fuse",label:"保险已熔断",value:fuseTripped,source:"apparatus" }
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
        { id: "topology-comparison", label: "串并联对照证据齐全", value: circuitComparisonReady, source: "model" }, { id:"short-safety",label:"短路与熔断保护已观察",value:shortObserved,source:"model" }
      ],
      validity: { ready: circuitLearningReady, issues }
    });
  }, [circuit.energized, circuit.equivalentResistance, circuit.totalCurrent, circuitComparisonReady, circuitLearningReady, closed, connectedWires, current1, current2, evidence, faultEvidence, fullyWired, fuseTripped, hasPowered, lamp1Connected, lamp2Connected, notice, plans.length, r1, r2, shortCircuit.prospectiveCurrent, shortInstalled, shortObserved, topology, voltage]);

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
  const toggleShortWire=()=>{if(closed||fuseTripped&&!shortInstalled)return;setShortInstalled(value=>!value);setNotice(shortInstalled?"保护短路线已拆除。现在可以更换保险并复位。":"已安装跨接电源两端的错误短路线；合闸将触发保护。");};
  const resetFuse=()=>{if(closed||shortInstalled)return;setFuseTripped(false);setHasPowered(false);setNotice("保险已复位，电路恢复可用。");};
  const toggleLamp = (lamp: 1 | 2) => {
    const wasConnected = lamp === 1 ? lamp1Connected : lamp2Connected;
    if (closed && fullyWired && wasConnected) setFaultEvidence((current) => ({ ...current, [topology]: true }));
    if (lamp === 1) setLamp1Connected((value) => !value);
    else setLamp2Connected((value) => !value);
    setHasPowered((value) => value || closed);
    setNotice(`${lamp === 1 ? "L₁" : "L₂"} 已${(lamp === 1 ? lamp1Connected : lamp2Connected) ? "旋松形成断路" : "重新旋紧接入电路"}。观察另一只灯泡和各支路电流。`);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: lamp === 1 ? "灯泡 L₁" : "灯泡 L₂", value: (lamp === 1 ? lamp1Connected : lamp2Connected) ? "断路" : "接通" });
  };
  const saveCircuitEvidence = () => {
    if (!closed || !fullyWired || !lamp1Connected || !lamp2Connected || !circuit.energized) return;
    const row = { id: Date.now(), topology, totalCurrent: circuit.totalCurrent, voltage1, voltage2 };
    setEvidence((rows) => [...rows.filter((item) => item.topology !== topology), row]);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: "保存拓扑读数", value: `${topology}/${circuit.totalCurrent.toFixed(2)}A` });
  };
  const wireIsActive = (wire: CircuitWirePlan) => circuit.energized && (wire.branch === "main" || wire.branch === "lamp1" && current1 > 0 || wire.branch === "lamp2" && current2 > 0);
  const renderTerminal = (terminal: CircuitTerminal) => {
    const [x, y] = layout[terminal];
    return <g className={`circuit-terminal ${selectedTerminal === terminal ? "selected" : ""}`} role="button" tabIndex={0} aria-label={terminalNames[terminal]} onClick={(event) => { event.stopPropagation(); selectTerminal(terminal); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectTerminal(terminal); } }} key={terminal}><circle cx={x} cy={y} r="12" /><circle cx={x} cy={y} r="4" /></g>;
  };

  return <LabFrame field="circuit" experiment="circuit-basic" eyebrow="CIRCUIT WIRING BENCH / 交互接线台" title="亲手接通电路，再让断路与短路告诉你安全边界" description="逐根连接串联、并联电路并旋松灯泡测试断路；完成正常证据后，可在保护模式下跨接电源两端制造短路。短路模型计入电源内阻并立即熔断保险，学生必须断电、拆线、复位后才能继续。灯泡按定值电阻等效。" running={closed} onToggle={toggleCircuit} playLabel={fuseTripped?"保险已熔断":"合上总开关"} runningLabel="断开总开关" actionDisabled={!fullyWired||fuseTripped} disabledLabel={fuseTripped?"先排除短路并复位保险":`还差 ${plans.length - connectedWires.length} 根导线`}>
    <div className="topology-tabs circuit-task-tabs"><button className={topology === "series" ? "active" : ""} onClick={() => selectTopology("series")}><b>任务 01</b><span>串联接线<small>一条连续路径</small></span></button><button className={topology === "parallel" ? "active" : ""} onClick={() => selectTopology("parallel")}><b>任务 02</b><span>并联接线<small>两条独立支路</small></span></button></div>
    <div className={`circuit-sim circuit-wiring-bench ${topology} ${closed ? "closed" : "open"} ${fullyWired ? "wired" : "wiring"} ${shortInstalled?"short-installed":""} ${fuseTripped?"fuse-tripped":""}`} style={{ "--current-speed": `${Math.max(.55, 2.15 - circuit.totalCurrent * .5)}s` } as React.CSSProperties}>
      <div className="circuit-bench-toolbar"><span><Cable size={16} /><b>接线进度</b><strong>{connectedWires.length} / {plans.length}</strong></span><div><button onClick={() => { setConnectedWires((items) => items.slice(0, -1)); setClosed(false); setNotice("已撤下最后一根导线。"); }} disabled={connectedWires.length === 0||shortInstalled||fuseTripped}><Unplug size={14} />撤下最后一根</button><button onClick={() => resetWiring()}><RotateCcw size={14} />全部复位</button></div></div>
      <svg viewBox="0 0 960 500" aria-label={`${topology === "series" ? "串联" : "并联"}电路交互接线板`}>
        <defs><filter id="lampGlow"><feGaussianBlur stdDeviation="9" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter><pattern id="benchDots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#34505a" /></pattern></defs>
        <rect className="circuit-board-surface" x="28" y="36" width="904" height="394" rx="18" fill="url(#benchDots)" />
        {plans.map((wire) => connectedWires.includes(wire.id) ? <g className={`bench-wire-group ${wireIsActive(wire) ? "active" : ""}`} key={wire.id}><path className="bench-wire-shadow" d={wire.path} /><path className="bench-wire" d={wire.path} /><path className="bench-current" d={wire.path} /></g> : <path className="bench-wire-guide" d={wire.path} key={wire.id} />)}
        <g className="bench-battery"><rect x="67" y="180" width="86" height="135" rx="9" /><rect x="79" y="194" width="62" height="107" rx="5" /><text x="110" y="228">直流电源</text><text className="battery-reading" x="110" y="266">{voltage.toFixed(1)} V</text><text className="polarity plus" x="110" y="113">＋</text><text className="polarity minus" x="110" y="402">−</text></g>
        {shortInstalled&&<g className="bench-short-wire"><path d="M110 125 H42 V370 H110"/><text x="48" y="244">错误短接</text></g>}
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
    <section className={`circuit-short-safety ${shortObserved?"observed":""} ${fuseTripped?"tripped":""}`}><header><span><Shield size={17}/><b>PROTECTED SHORT-CIRCUIT DRILL / 9V受保护短路演练</b></span><small>{shortObserved?"安全边界已观察":"完成串并联对照后进行"}</small></header><div><article><span>正常工作电流</span><strong>{circuit.totalCurrent.toFixed(2)} A</strong><small>用电器限制电流</small></article><article><span>9V训练源短路预期电流</span><strong>{shortObserved?`${shortCircuit.prospectiveCurrent.toFixed(2)} A`:"待演练"}</strong><small>只由0.8Ω电源内阻限制，禁止真实课堂直接操作</small></article><article><span>5 A 保险</span><strong>{fuseTripped?"已熔断":shortObserved?"已复位":"完好"}</strong><small>异常大电流出现时迅速切断回路</small></article></div><div className="circuit-short-actions"><button className={shortInstalled?"danger":""} disabled={closed||fuseTripped&&!shortInstalled||!circuitComparisonReady} onClick={toggleShortWire}>{shortInstalled?<><Unplug size={14}/>拆除短路线</>:<><Cable size={14}/>安装保护短路线</>}</button><button disabled={closed||shortInstalled||!fuseTripped} onClick={resetFuse}><RotateCcw size={14}/>更换保险并复位</button></div>{shortObserved&&<EvidenceVerdict valid={!shortInstalled&&!fuseTripped} title={!shortInstalled&&!fuseTripped?"已排除短路并恢复安全状态":"保护已动作：按顺序完成断电、拆线、复位"} detail={`9V训练源跨接两端时预期电流 ${shortCircuit.prospectiveCurrent.toFixed(2)} A，是5 A额定值的 ${shortCircuit.overloadMultiple.toFixed(2)} 倍；保护装置切断电路，防止导线和电源持续过热。`}/>}</section>
    <section className="circuit-comparison-ledger"><header><span><ClipboardList size={16} /><b>串联—并联对照证据</b></span><button disabled={!closed || !fullyWired || !lamp1Connected || !lamp2Connected || evidence.some((row) => row.topology === topology)} onClick={saveCircuitEvidence}><Save size={14} />保存当前正常读数</button></header><div>{(["series", "parallel"] as const).map((kind) => { const row = evidence.find((item) => item.topology === kind); return <article className={row && faultEvidence[kind] ? "complete" : ""} key={kind}><b>{kind === "series" ? "串联" : "并联"}</b><strong>{row ? `I总 ${row.totalCurrent.toFixed(2)} A` : "等待正常读数"}</strong><span>{row ? `U₁/U₂ ${row.voltage1.toFixed(1)}/${row.voltage2.toFixed(1)} V` : "接好并闭合开关"}</span><em>{faultEvidence[kind] ? kind === "series" ? "旋松一灯，全部熄灭" : "旋松一灯，另一支路仍工作" : "还需旋松一只灯泡测试断路"}</em></article>; })}</div></section>
    {(evidence.length > 0 || faultEvidence.series || faultEvidence.parallel) && <EvidenceVerdict valid={circuitLearningReady} title={circuitLearningReady ? "串并联、断路与短路安全证据均已完成" : circuitComparisonReady?"串并联对照已完成，还需受保护短路演练":"当前只完成了部分拓扑证据"} detail={circuitComparisonReady && seriesEvidence && parallelEvidence ? `同电源、同灯泡下，并联干路电流 ${parallelEvidence.totalCurrent.toFixed(2)} A，串联干路电流 ${seriesEvidence.totalCurrent.toFixed(2)} A；并联支路互不影响，串联断路使全电路停止。${shortObserved?"短路会产生异常大电流并触发保险熔断。":"接下来断电安装保护短路线，观察保险动作。"}` : "每种连接方式都要保存正常读数，并旋松一只灯泡观察另一只灯泡。"} />}
  </LabFrame>;
}

const thermometerTypes = {
  clinical: { label: "体温计", min: 35, max: 42, division: .1, color: "#e96f5a" },
  lab: { label: "实验室温度计", min: -20, max: 110, division: 1, color: "#ef765b" },
  cold: { label: "低温温度计", min: -50, max: 50, division: 1, color: "#65b7d8" }
} as const;
const thermometerSamples = {
  ice: { label: "冰水混合物", temperature: 0, color: "#74cde3" },
  room: { label: "室温水", temperature: 24, color: "#55b9df" },
  warm: { label: "温水", temperature: 68, color: "#e58d50" }
} as const;
type ThermometerTypeKey = keyof typeof thermometerTypes;
type ThermometerSampleKey = keyof typeof thermometerSamples;
type ThermometerPosition = "above" | "correct" | "bottom" | "wall";
interface ThermometerEvidence { id: number; sample: string; instrument: string; value: number; division: number; }

function ThermometerLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [typeKey, setTypeKey] = useState<ThermometerTypeKey>();
  const [sampleKey, setSampleKey] = useState<ThermometerSampleKey>();
  const [position, setPosition] = useState<ThermometerPosition>("above");
  const [stableProgress, setStableProgress] = useState(0);
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [readValue, setReadValue] = useState<number>();
  const [evidence, setEvidence] = useState<ThermometerEvidence[]>([]);
  const [parallaxTrials, setParallaxTrials] = useState<EyePosition[]>([]);
  const instrument = typeKey ? thermometerTypes[typeKey] : undefined;
  const sample = sampleKey ? thermometerSamples[sampleKey] : undefined;
  const rangeSuitable = Boolean(instrument && sample && sample.temperature >= instrument.min && sample.temperature <= instrument.max);
  const correctPosition = position === "correct";
  const stable = stableProgress >= 100;
  const canRead = rangeSuitable && correctPosition && stable && eyePosition === "level";
  const indicatedTemperature = sample && instrument ? Math.round(sample.temperature / instrument.division) * instrument.division : 0;
  const visibleTemperature = indicatedTemperature + (eyePosition === "high" ? instrument?.division ?? 0 : eyePosition === "low" ? -(instrument?.division ?? 0) : 0);
  const parallaxComplete = parallaxTrials.includes("high") && parallaxTrials.includes("low");
  useEffect(() => {
    if (!rangeSuitable || !correctPosition || stable) return;
    const timer = window.setInterval(() => setStableProgress((value) => Math.min(100,value+5)),80);
    return () => window.clearInterval(timer);
  }, [correctPosition, rangeSuitable, stable]);
  const resetReading = () => { setStableProgress(0); setReadValue(undefined); setEyePosition("high"); setParallaxTrials([]); };
  const chooseInstrument = (key: ThermometerTypeKey) => { setTypeKey(key); setPosition("above"); resetReading(); };
  const chooseSample = (key: ThermometerSampleKey) => { setSampleKey(key); setPosition("above"); resetReading(); };
  const save = () => {
    if (!instrument || !sample || readValue === undefined || !parallaxComplete) return;
    const row={id:Date.now(),sample:sample.label,instrument:instrument.label,value:readValue,division:instrument.division};
    setEvidence((items)=>[row,...items.filter(item=>item.sample!==row.sample)].slice(0,6));
    recordHarness("configuration.changed",{experiment:"thermal-thermometer",control:"保存温度测量",value:`${row.sample}/${row.instrument}/${row.value}℃`});
  };
  const observeParallax = (next: "high" | "low") => {
    if (!stable || !instrument) return;
    setEyePosition(next);
    setParallaxTrials((items) => items.includes(next) ? items : [...items, next]);
    const observed = indicatedTemperature + (next === "high" ? instrument.division : -instrument.division);
    recordHarness("configuration.changed", { experiment: "thermal-thermometer", control: next === "high" ? "俯视误差演练" : "仰视误差演练", value: observed, unit: "℃" });
  };
  useEffect(() => {
    const issues = evidence.length ? [] : !instrument ? ["先根据待测温度选择合适量程的温度计。"] : !sample ? ["选择一种待测液体。"] : !rangeSuitable ? [`${instrument.label}量程${instrument.min}～${instrument.max}℃，不适合当前样品。`] : !correctPosition ? [position === "above" ? "让玻璃泡完全浸入液体。" : position === "bottom" ? "玻璃泡不能接触容器底。" : "玻璃泡不能接触容器壁。"] : !stable ? ["保持温度计不动，等待示数稳定。"] : readValue === undefined ? ["平视并记录正式温度。"] : !parallaxComplete ? ["再完成俯视和仰视误差演练，比较误差方向。"] : ["保存本次规范测量证据。"];
    publishApparatusSnapshot({module:"thermal-thermometer",capturedAt:new Date().toISOString(),origin:instrument||sample?"learner":"system",controls:[
      {id:"instrument",label:"温度计",value:instrument?.label??"未选择",source:"control"},{id:"sample",label:"待测液体",value:sample?.label??"未选择",source:"control"},{id:"position",label:"玻璃泡位置",value:position==="correct"?"完全浸入且不碰底壁":position==="above"?"未浸入":position==="bottom"?"接触杯底":"接触杯壁",source:"control"},{id:"eye",label:"读数视线",value:eyePosition==="level"?"平视":eyePosition==="high"?"俯视":"仰视",source:"control"}
    ],apparatus:[
      {id:"range-suitable",label:"量程合适",value:rangeSuitable,source:"apparatus"},{id:"position-correct",label:"玻璃泡位置正确",value:correctPosition,source:"apparatus"},{id:"stable",label:"示数稳定",value:stable,source:"apparatus"},{id:"stable-progress",label:"稳定进度",value:stableProgress,unit:"%",source:"apparatus"}
    ],readings:[
      {id:"visible",label:"当前可见示数",value:instrument&&sample&&rangeSuitable?visibleTemperature:null,unit:"℃",source:"reading"},{id:"recorded",label:"正式记录温度",value:readValue??null,unit:"℃",source:"reading"}
    ],derived:[
      {id:"division",label:"分度值",value:instrument?.division??null,unit:"℃",source:"model"},
      {id:"parallax",label:"俯视与仰视误差均已观察",value:parallaxComplete,source:"model"}
    ],validity:{ready:evidence.length>0,issues}});
  },[correctPosition,evidence.length,eyePosition,instrument,parallaxComplete,position,rangeSuitable,readValue,sample,stable,stableProgress,visibleTemperature]);
  return <LabFrame field="thermal" experiment="thermal-thermometer" eyebrow="THERMOMETER PRACTICE BAY / 温度计规范实训舱" title="选对量程、放对位置、等到稳定，再平视读数" description="温度测量不只是看液柱高度。先根据待测对象选择量程和分度值合适的温度计；玻璃泡应完全浸入液体且不碰容器底壁，待示数稳定后平视液柱末端。" running={stableProgress>0&&!stable} onToggle={()=>{if(rangeSuitable&&correctPosition)setStableProgress(value=>Math.max(value,5));}} playLabel="等待示数稳定" runningLabel="正在稳定" actionDisabled={!rangeSuitable||!correctPosition||stable} disabledLabel={!rangeSuitable?"先选择合适量程":!correctPosition?"先正确放置玻璃泡":"示数已稳定"}>
    <div className="thermometer-selection-console"><section><span><b>01</b>选择温度计</span><div>{(Object.keys(thermometerTypes) as ThermometerTypeKey[]).map(key=><button className={typeKey===key?"active":""} onClick={()=>chooseInstrument(key)} key={key}><i style={{background:thermometerTypes[key].color}}/><strong>{thermometerTypes[key].label}</strong><small>{thermometerTypes[key].min}～{thermometerTypes[key].max}℃ · {thermometerTypes[key].division}℃/格</small></button>)}</div></section><section><span><b>02</b>选择待测对象</span><div>{(Object.keys(thermometerSamples) as ThermometerSampleKey[]).map(key=><button className={sampleKey===key?"active":""} onClick={()=>chooseSample(key)} key={key}><i style={{background:thermometerSamples[key].color}}/><strong>{thermometerSamples[key].label}</strong><small>温度未知 · 待测</small></button>)}</div></section><section><span><b>03</b>量程检查</span><strong className={rangeSuitable?"valid":instrument&&sample?"danger":""}>{!instrument||!sample?"等待选择器材与样品":rangeSuitable?"量程合适，可以测量":`量程不合适：${instrument.min}～${instrument.max}℃`}</strong><small>不能让待测温度超过温度计量程。</small></section></div>
    <div className={`thermometer-lab-sim position-${position} ${stable?"stable":""} ${!rangeSuitable&&instrument&&sample?"range-error":""}`} style={{"--thermometer-level":instrument&&sample?Math.max(0,Math.min(1,(indicatedTemperature-instrument.min)/(instrument.max-instrument.min))):0,"--thermometer-color":instrument?.color??"#ef765b","--sample-color":sample?.color??"#55b9df"} as React.CSSProperties}>
      <div className="thermometer-procedure-strip">{["选表查量程","玻璃泡浸入","不碰底和壁","等待稳定","平视读数"].map((label,index)=>{const activeStage=!rangeSuitable?0:!correctPosition?1:!stable?3:readValue===undefined?4:5;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="thermometer-vessel-rig"><span className="thermometer-sample-liquid"/><b>{sample?.label??"待测液体"}</b><em>玻璃泡不能碰底或杯壁</em></div>
      <div className="thermometer-instrument-rig"><span className="thermometer-stem"><i style={{height:`${8+(Number((instrument&&sample)?Math.max(0,Math.min(1,(indicatedTemperature-instrument.min)/(instrument.max-instrument.min))):0))*84}%`}}/><b/></span><div>{Array.from({length:26},(_,index)=><i className={index%5===0?"major":""} key={index}/>)}</div><strong>{instrument?.label??"未选择温度计"}</strong><small>{instrument?`${instrument.min}～${instrument.max}℃ · 分度值 ${instrument.division}℃`:"先检查量程和分度值"}</small></div>
      <div className="thermometer-position-console"><span>玻璃泡位置</span><div><button onClick={()=>{setPosition("above");resetReading();}}>未浸入</button><button className={position==="correct"?"active":""} onClick={()=>{setPosition("correct");resetReading();}}>正确浸入</button><button onClick={()=>{setPosition("bottom");resetReading();}}>碰杯底</button><button onClick={()=>{setPosition("wall");resetReading();}}>碰杯壁</button></div><strong className={correctPosition?"valid":""}>{position==="correct"?"完全浸入，且不碰底壁":position==="above"?"玻璃泡还未浸入液体":position==="bottom"?"错误：测到杯底温度":"错误：测到杯壁附近温度"}</strong></div>
      <div className="thermometer-stability-meter"><span><Activity size={16}/><small>READING STABILITY / 示数稳定</small><strong>{stable?"100% · 已稳定":`${stableProgress}%`}</strong></span><div><i style={{width:`${stableProgress}%`}}/></div><em>{!correctPosition?"正确放置后才能等待稳定":stable?"现在保持温度计位置不变并平视读数":"液柱正在接近待测液体温度"}</em></div>
      <div className={`thermometer-eye-console eye-${eyePosition}`}><Eye size={25}/><span><small>{eyePosition==="level"?"视线已与液柱末端相平":eyePosition==="high"?"当前俯视，示数偏大":"当前仰视，示数偏小"}</small><strong>{stable&&rangeSuitable?`可见约 ${visibleTemperature.toFixed(instrument&&instrument.division<1?1:0)}℃`:"等待有效稳定示数"}</strong></span><div><button onClick={()=>setEyePosition("high")}>俯视</button><button className={eyePosition==="level"?"active":""} onClick={()=>setEyePosition("level")}>平视</button><button onClick={()=>setEyePosition("low")}>仰视</button></div><button disabled={!canRead||readValue!==undefined} onClick={()=>{setReadValue(indicatedTemperature);recordHarness("configuration.changed",{experiment:"thermal-thermometer",control:"正式温度读数",value:indicatedTemperature,unit:"℃"});}}>{readValue!==undefined?`已记录 ${readValue.toFixed(instrument&&instrument.division<1?1:0)}℃`:"读取并记录温度"}</button></div>
      <div className={`thermometer-final-reading ${readValue!==undefined?"complete":""}`}><small>{readValue!==undefined?"MEASUREMENT COMPLETE":"VALID READING"}</small><strong>{readValue!==undefined?`${readValue.toFixed(instrument&&instrument.division<1?1:0)} ℃`:"— —"}</strong><span>{instrument?`分度值 ${instrument.division}℃`:"等待选择温度计"}</span></div>
      {!instrument&&<InteractionCue text="先根据待测对象选择量程合适的温度计"/>}
    </div>
    <section className="thermometer-parallax-lab"><header><span><Eye size={17}/><b>视差误差演练</b></span><small>错误观察不写入正式数据</small></header><div><button className={parallaxTrials.includes("high")?"done":""} disabled={!stable} onClick={()=>observeParallax("high")}><b>俯视液柱末端</b><strong>{instrument&&stable?`${(indicatedTemperature+instrument.division).toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>读数偏大</em></button><button className={readValue!==undefined?"done":""} disabled={!stable||!rangeSuitable||!correctPosition||readValue!==undefined} onClick={()=>{setEyePosition("level");setReadValue(indicatedTemperature);recordHarness("configuration.changed",{experiment:"thermal-thermometer",control:"正式温度读数",value:indicatedTemperature,unit:"℃"});}}><b>平视液柱末端</b><strong>{instrument&&stable?`${indicatedTemperature.toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>规范读数</em></button><button className={parallaxTrials.includes("low")?"done":""} disabled={!stable} onClick={()=>observeParallax("low")}><b>仰视液柱末端</b><strong>{instrument&&stable?`${(indicatedTemperature-instrument.division).toFixed(instrument.division<1?1:0)} ℃`:"等待示数稳定"}</strong><em>读数偏小</em></button></div></section>
    <div className="thermometer-evidence-workbench"><section><header><span><ClipboardList size={17}/><b>规范温度测量记录</b></span><button disabled={readValue===undefined||!parallaxComplete} onClick={save}><Save size={15}/>保存本次测量</button></header>{evidence.length?<div><b>样品</b><b>温度计</b><b>分度值/℃</b><b>测得温度/℃</b>{evidence.map(row=><div className="thermometer-evidence-row" key={row.id}><strong>{row.sample}</strong><span>{row.instrument}</span><span>{row.division}</span><strong>{row.value.toFixed(row.division<1?1:0)}</strong></div>)}</div>:<p>满足规范测量条件并完成俯视、仰视误差演练后，保存正式读数。</p>}</section><aside><span>本次规范检查</span>{[{label:"量程合适",done:rangeSuitable},{label:"玻璃泡位置正确",done:correctPosition},{label:"示数已经稳定",done:stable},{label:"平视完成读数",done:readValue!==undefined},{label:"视差方向已验证",done:parallaxComplete}].map(item=><i className={item.done?"done":""} key={item.label}>{item.done?<CheckCircle2 size={14}/>:<LockKeyhole size={14}/>} {item.label}</i>)}</aside></div>
  </LabFrame>;
}

interface MeltingReading { id: number; time: number; temperature: number; phase: "solid" | "melting" | "liquid"; melted: number; }

const meltingPhaseLabels = { solid: "固态冰升温", melting: "冰水共存，正在熔化", liquid: "冰已熔尽，水升温" } as const;

function MeltingLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mass, setMass] = useState(20);
  const [power, setPower] = useState(100);
  const [iceAdded, setIceAdded] = useState(false);
  const [thermometerPlaced, setThermometerPlaced] = useState(false);
  const [bathReady, setBathReady] = useState(false);
  const [prediction, setPrediction] = useState<"rise" | "plateau" | "cool">();
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [readings, setReadings] = useState<MeltingReading[]>([]);
  const state = calculateIceMeltingState(time, power, mass);
  const setupReady = iceAdded && thermometerPlaced && bathReady;
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setTime((value) => Math.min(150, value + 1)), 80); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { if (time >= 150) setRunning(false); }, [time]);
  const toggleHeat = () => { if (!setupReady) return; setRunning((value) => !value); };
  const saveReading = () => {
    if (!setupReady || time === 0) return;
    const row = { id: Date.now(), time: Math.round(time), temperature: Number(state.temperature.toFixed(1)), phase: state.phase, melted: Number((state.meltedFraction * 100).toFixed(0)) };
    setReadings((items) => [...items.filter((item) => item.time !== row.time), row].sort((a,b) => a.time-b.time).slice(-10));
    recordHarness("configuration.changed", { experiment: "thermal-melting", control: "记录熔化读数", value: `${row.time}s/${row.temperature}℃/${meltingPhaseLabels[row.phase]}` });
  };
  const reset = () => { setIceAdded(false); setThermometerPlaced(false); setBathReady(false); setPrediction(undefined); setTime(0); setRunning(false); setReadings([]); };
  const curvePoints = Array.from({length:90},(_,index) => { const sampleTime=index/89*Math.max(1,time); const sample=calculateIceMeltingState(sampleTime,power,mass); return `${35+sampleTime/150*500},${175-(sample.temperature+12)*1.65}`; }).join(" ");
  const hasSolidWarmingEvidence = readings.some((row) => row.phase === "solid");
  const meltingPlatformEvidence = analyzeTimedPlateauEvidence(readings.filter((row) => row.phase === "melting").map((row) => ({time:row.time,value:row.temperature})),10,.2);
  const hasPlatformEvidence = meltingPlatformEvidence.plateau;
  const meltingConclusionReady = hasSolidWarmingEvidence && hasPlatformEvidence;
  useEffect(() => {
    const issues = !iceAdded ? ["先向试管加入碎冰。"] : !thermometerPlaced ? ["放置温度计，玻璃泡应与碎冰充分接触。"] : !bathReady ? ["把试管放入水浴，准备均匀加热。"] : time === 0 ? ["开始加热，并按时间间隔记录温度和状态。"] : !hasSolidWarmingEvidence ? ["先在冰仍低于0℃时保存一组固态升温读数。"] : !hasPlatformEvidence ? ["在熔化阶段记录至少两组温度相近且相隔10秒以上的数据。"] : [];
    publishApparatusSnapshot({ module: "thermal-melting", capturedAt: new Date().toISOString(), origin: iceAdded || time > 0 ? "learner" : "system", controls: [
      { id: "mass", label: "碎冰质量", value: mass, unit: "g", source: "control" }, { id: "power", label: "等效加热功率", value: power, unit: "W", source: "control" }, { id: "prediction", label: "熔化时温度预测", value: prediction === "rise" ? "继续升高" : prediction === "plateau" ? "保持不变" : prediction === "cool" ? "降低" : "未选择", source: "control" }
    ], apparatus: [
      { id: "ice-added", label: "试管已加入碎冰", value: iceAdded, source: "apparatus" }, { id: "thermometer", label: "温度计已放置", value: thermometerPlaced, source: "apparatus" }, { id: "water-bath", label: "水浴装置已准备", value: bathReady, source: "apparatus" }, { id: "heating", label: "正在加热", value: running, source: "apparatus" }, { id: "time", label: "实验时间", value: time, unit: "s", source: "apparatus" }
    ], readings: [
      { id: "temperature", label: "温度计示数", value: setupReady ? state.temperature : null, unit: "℃", source: "reading" }, { id: "phase", label: "物质状态", value: setupReady ? meltingPhaseLabels[state.phase] : "等待装置准备", source: "reading" }, { id: "melted", label: "熔化比例", value: setupReady ? state.meltedFraction * 100 : null, unit: "%", source: "reading" }
    ], derived: [
      { id: "energy-model", label: "热量模型", value: "冰升温：Q=cmΔT；熔化：Q=mL；水升温：Q=cmΔT", source: "model" },
      { id: "model-boundary", label: "模拟边界", value: "标准压强、均匀受热；未计容器吸热和散热波动", source: "model" },
      { id: "stage-evidence", label: "升温段与熔化平台证据齐全", value: meltingConclusionReady, source: "model" }
    ], validity: { ready: meltingConclusionReady, issues } });
  }, [bathReady, hasPlatformEvidence, hasSolidWarmingEvidence, iceAdded, mass, meltingConclusionReady, power, prediction, running, setupReady, state.meltedFraction, state.phase, state.temperature, thermometerPlaced, time]);
  return <LabFrame field="thermal" experiment="thermal-melting" eyebrow="ICE MELTING LOGGER / 冰熔化记录仪" title="定时读温度、看状态，亲手找到 0℃ 熔化平台" description="把碎冰放入试管，用水浴均匀加热并定时记录。模型按冰的比热容 2.1 J/(g·℃)、熔化潜热 334 J/g 和水的比热容 4.2 J/(g·℃)计算；未计容器吸热与环境散热波动。" running={running} onToggle={toggleHeat} playLabel="开始水浴加热" runningLabel="暂停加热读数" actionDisabled={!setupReady} disabledLabel={!iceAdded ? "请先加入碎冰" : !thermometerPlaced ? "请先放好温度计" : "请先准备水浴"}>
    <div className="melting-setup-console"><section><span><b>01</b>实验条件</span><div><label>碎冰</label>{[20,30,40].map(value=><button className={mass===value?"active":""} disabled={iceAdded} onClick={()=>setMass(value)} key={value}>{value} g</button>)}</div><div><label>功率</label>{[60,100,140].map(value=><button className={power===value?"active":""} disabled={time>0} onClick={()=>setPower(value)} key={value}>{value} W</button>)}</div></section><section><span><b>02</b>组装装置</span><button className={iceAdded?"done":""} disabled={iceAdded} onClick={()=>setIceAdded(true)}><Beaker size={15}/>{iceAdded?"碎冰已装入试管":"向试管加入碎冰"}</button><button className={thermometerPlaced?"done":""} disabled={!iceAdded||thermometerPlaced} onClick={()=>setThermometerPlaced(true)}><Gauge size={15}/>{thermometerPlaced?"温度计已放好":"放置温度计"}</button><button className={bathReady?"done":""} disabled={!thermometerPlaced||bathReady} onClick={()=>setBathReady(true)}><Flame size={15}/>{bathReady?"水浴已准备":"把试管放入水浴"}</button></section><section><span><b>03</b>实验预测</span><p>冰正在熔化时，继续吸热，温度怎样变化？</p><div>{(["rise","plateau","cool"] as const).map(value=><button className={prediction===value?"active":""} onClick={()=>setPrediction(value)} key={value}>{value==="rise"?"继续升高":value==="plateau"?"保持不变":"逐渐降低"}</button>)}</div></section></div>
    <div className={`melting-lab-sim phase-${state.phase} ${running?"heating":""}`} style={{"--melted":state.meltedFraction,"--melt-temp":Math.max(0,Math.min(1,(state.temperature+10)/30))} as React.CSSProperties}>
      <div className="melting-procedure-strip">{["装碎冰", "放温度计", "水浴加热", "定时取样", "识别平台"].map((label,index)=>{const activeStage=!iceAdded?0:!thermometerPlaced?1:!bathReady?2:!meltingConclusionReady?3:4;return <span className={index<activeStage?"done":index===activeStage?"active":""} key={label}><b>{index<activeStage?"✓":index+1}</b>{label}</span>;})}</div>
      <div className="melting-water-bath"><span className="bath-water"/><div className="melting-test-tube"><span className="melting-sample">{Array.from({length:9},(_,index)=><i style={{"--ice":index,opacity:Math.max(.08,1-state.meltedFraction*1.3)} as React.CSSProperties} key={index}/>)}</span><em>{meltingPhaseLabels[state.phase]}</em></div><div className="melting-thermometer"><i style={{height:`${18+Math.max(0,Math.min(74,(state.temperature+10)*.74))}%`}}/><strong>{setupReady?`${state.temperature.toFixed(1)}℃`:"— —"}</strong></div></div>
      <div className={`melting-heater-live ${running?"on":""}`}><Flame size={34}/><span><small>WATER BATH HEATER</small><strong>{running?`${power} W 加热中`:time>0?"加热已暂停":"等待启动"}</strong></span></div>
      <svg viewBox="0 0 570 230" aria-label="冰的熔化温度时间图像"><line x1="35" y1="20" x2="35" y2="190"/><line x1="35" y1="190" x2="545" y2="190"/><line className="melting-zero-line" x1="35" y1="155" x2="545" y2="155"/><text x="4" y="22">T/℃</text><text x="4" y="159">0℃</text><text x="492" y="215">t/s</text>{time>0&&<polyline points={curvePoints}/>} {readings.map(row=><g className="melting-sample-point" key={row.id}><circle cx={35+row.time/150*500} cy={175-(row.temperature+12)*1.65} r="5"/><text x={42+row.time/150*500} y={170-(row.temperature+12)*1.65}>{row.temperature}°</text></g>)}</svg>
      <div className="melting-phase-meter"><span><small>PHASE PROGRESS / 物态进程</small><strong>{state.phase==="solid"?"固态":state.phase==="melting"?`熔化 ${Math.round(state.meltedFraction*100)}%`:"液态"}</strong></span><div><i className={state.phase==="solid"?"active":"done"}>冰升温</i><i className={state.phase==="melting"?"active":state.phase==="liquid"?"done":""}>0℃熔化</i><i className={state.phase==="liquid"?"active":""}>水升温</i></div></div>
      <div className={`melting-live-reading ${meltingConclusionReady?"valid":""}`}><TimerReset size={19}/><span><small>MANUAL SAMPLE / 手动取样</small><strong>{setupReady?`${time.toFixed(0)} s · ${state.temperature.toFixed(1)}℃ · ${meltingPhaseLabels[state.phase]}`:"等待装置准备"}</strong><em>{state.phase==="melting"?"正在吸收熔化潜热，温度保持在0℃。":"建议在固态升温阶段先记录一次，再继续寻找平台。"}</em></span><button disabled={!setupReady||time===0} onClick={saveReading}><Save size={15}/>记录此刻</button></div>
      {!setupReady&&<InteractionCue text={!iceAdded?"先向试管加入碎冰":!thermometerPlaced?"让温度计玻璃泡与碎冰充分接触":"把试管放入水浴中均匀加热"}/>}
    </div>
    <div className="melting-evidence-workbench"><section><header><span><ClipboardList size={17}/><b>温度与状态记录表</b></span><small>{readings.length} 组取样</small></header>{readings.length?<div><b>t/s</b><b>T/℃</b><b>物质状态</b><b>已熔化</b>{readings.map(row=><div className="melting-reading-row" key={row.id}><span>{row.time}</span><strong>{row.temperature.toFixed(1)}</strong><span>{meltingPhaseLabels[row.phase]}</span><strong>{row.melted}%</strong></div>)}</div>:<p>先在冰低于0℃时记录升温点，再在冰水共存阶段记录两个平台点。</p>}</section><aside className={meltingConclusionReady?"ready":""}><span>阶段证据检查</span><strong>{meltingConclusionReady?`已记录固态升温段和跨 ${meltingPlatformEvidence.timeSpan.toFixed(0)} s 的0℃平台。`:!hasSolidWarmingEvidence?"还缺少冰低于0℃时的固态升温读数。":`平台点时间跨度 ${meltingPlatformEvidence.timeSpan.toFixed(0)} / 10 s，继续加热后再取样。`}</strong>{prediction&&meltingConclusionReady&&<p>{prediction==="plateau"?"原预测与数据一致。":"数据显示熔化时温度保持不变，请修正原预测。"}</p>}<button onClick={reset}><RotateCcw size={15}/>清空并重新实验</button></aside></div>
  </LabFrame>;
}

interface ThermalReading { id: number; time: number; temperature: number; phase: string; }
const boilingEnvironments = {
  highland: { label: "高原低压", pressure: 75 },
  standard: { label: "标准大气压", pressure: 101.325 },
  pressurized: { label: "增压环境", pressure: 150 }
} as const;
type BoilingEnvironmentKey = keyof typeof boilingEnvironments;
interface BoilingRunEvidence { id:number; environment:BoilingEnvironmentKey; label:string; pressure:number; boilingPoint:number; timeToBoil:number; mass:number; power:number; }
const BOILING_RUN_LIMIT_SECONDS = 360;

interface EvaporationEvidence { id:number; temperature:number; area:number; airflow:number; loss:number; rate:number; }
function EvaporationLab() {
  const recordHarness=useHarnessStore(state=>state.record); const [temperature,setTemperature]=useState(25); const [area,setArea]=useState(100); const [airflow,setAirflow]=useState(0); const [duration,setDuration]=useState(60); const [elapsed,setElapsed]=useState(0); const [running,setRunning]=useState(false); const [prediction,setPrediction]=useState<string>(); const [evidence,setEvidence]=useState<EvaporationEvidence[]>([]); const result=calculateEvaporationTrial(50,temperature,area,airflow,elapsed); const done=elapsed>=duration;
  const evaporationPair=evidence.length>=2?analyzeControlledComparison([evidence[1]!.temperature,evidence[1]!.area,evidence[1]!.airflow],[evidence[0]!.temperature,evidence[0]!.area,evidence[0]!.airflow],evidence[1]!.rate,evidence[0]!.rate,.0001):undefined;
  const evaporationComparisons=useMemo(()=>evidence.flatMap((newer,index)=>evidence.slice(index+1).map(older=>({newer,older,comparison:analyzeControlledComparison([older.temperature,older.area,older.airflow],[newer.temperature,newer.area,newer.airflow],older.rate,newer.rate,.0001)}))),[evidence]);
  const temperatureEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===0&&comparison.outcomeDirection===(newer.temperature>older.temperature?"increase":"decrease"));
  const areaEvaporationEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===1&&comparison.outcomeDirection===(newer.area>older.area?"increase":"decrease"));
  const airflowEvidence=evaporationComparisons.find(({newer,older,comparison})=>comparison.valid&&comparison.changedIndexes[0]===2&&comparison.outcomeDirection===(newer.airflow>older.airflow?"increase":"decrease"));
  const evaporationEvidenceReady=Boolean(temperatureEvidence&&areaEvaporationEvidence&&airflowEvidence);
  const evaporationPredictionMatched=prediction==="升温更快"?Boolean(temperatureEvidence):prediction==="面积更大更快"?Boolean(areaEvaporationEvidence):prediction==="风更快更快"?Boolean(airflowEvidence):false;
  const evaporationConclusion=evaporationEvidenceReady?{valid:true,title:"蒸发三因素证据完整",detail:`升高水温、增大液面面积、加快空气流动均使蒸发速率增大。${evaporationPredictionMatched?"你选择的预测已得到验证。":"请依据三条证据回顾预测。"}`} : temperatureEvidence&&areaEvaporationEvidence?{valid:false,title:"温度与面积证据已完成，还缺空气流动",detail:"保持温度和面积不变，只改变风速再测量。"}:temperatureEvidence&&airflowEvidence?{valid:false,title:"温度与风速证据已完成，还缺液面面积",detail:"保持温度和风速不变，只改变液面面积再测量。"}:areaEvaporationEvidence&&airflowEvidence?{valid:false,title:"面积与风速证据已完成，还缺温度",detail:"保持面积和风速不变，只改变水温再测量。"}:!evaporationPair?undefined:!evaporationPair.valid?{valid:false,title:"最近两组同时改变了多个条件",detail:"请保留水温、液面面积、空气流速中的两个条件不变，再完成一组。"}:{valid:false,title:"已形成一条单因素证据",detail:"继续复用基准，补齐温度、液面面积和空气流动三项因素。"};
  useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setElapsed(v=>{const next=Math.min(duration,v+2);if(next>=duration)setRunning(false);return next;}),200);return()=>window.clearInterval(timer);},[duration,running]);
  const reset=()=>{setRunning(false);setElapsed(0);}; const save=()=>{if(!done)return;setEvidence(rows=>[{id:Date.now(),temperature,area,airflow,loss:result.evaporatedMassGrams,rate:result.evaporationRateGramsPerMinute},...rows.filter(row=>row.temperature!==temperature||row.area!==area||row.airflow!==airflow)].slice(0,8));recordHarness("configuration.changed",{experiment:"thermal-evaporation",control:"保存蒸发称量",value:`${temperature}℃/${area}cm²/${airflow}m/s/${result.evaporatedMassGrams.toFixed(3)}g`});};
  useEffect(()=>publishApparatusSnapshot({module:"thermal-evaporation",capturedAt:new Date().toISOString(),origin:elapsed||evidence.length?"learner":"system",controls:[{id:"temperature",label:"水温",value:temperature,unit:"℃",source:"control"},{id:"area",label:"液面面积",value:area,unit:"cm²",source:"control"},{id:"airflow",label:"空气流速",value:airflow,unit:"m/s",source:"control"},{id:"prediction",label:"预测",value:prediction??"未选择",source:"control"}],apparatus:[{id:"timer",label:"已计时",value:elapsed,unit:"s",source:"apparatus"}],readings:[{id:"loss",label:"质量减少",value:done?result.evaporatedMassGrams:null,unit:"g",source:"reading"},{id:"rate",label:"蒸发速率",value:done?result.evaporationRateGramsPerMinute:null,unit:"g/min",source:"reading"}],derived:[{id:"boundary",label:"模型边界",value:"固定水样与环境下的教学比较模型",source:"model"},{id:"latest-comparison",label:"最近两组公平比较",value:evaporationPair?.valid??false,source:"model"},{id:"temperature-evidence",label:"温度因素证据",value:Boolean(temperatureEvidence),source:"model"},{id:"area-evidence",label:"液面面积因素证据",value:Boolean(areaEvaporationEvidence),source:"model"},{id:"airflow-evidence",label:"空气流动因素证据",value:Boolean(airflowEvidence),source:"model"}],validity:{ready:evaporationEvidenceReady,issues:evaporationEvidenceReady?[]:!done&&evidence.length===0?["完成第一组定时称量"]:evidence.length<2?["保存基准后，每次只改变一个条件"]:!temperatureEvidence?["还缺温度因素证据"]:!areaEvaporationEvidence?["还缺液面面积因素证据"]:["还缺空气流动因素证据"]}}),[area,areaEvaporationEvidence,airflow,airflowEvidence,done,elapsed,evidence.length,evaporationEvidenceReady,evaporationPair?.valid,prediction,result.evaporationRateGramsPerMinute,result.evaporatedMassGrams,temperature,temperatureEvidence]);
  return <LabFrame field="thermal" experiment="thermal-evaporation" eyebrow="EVAPORATION MASS BENCH / 蒸发称量台" title="用前后质量差比较蒸发快慢" description="统一使用50 g水样，一次只改变温度、液面面积或空气流速。平台以微量天平记录定时前后的质量差；数值用于固定环境中的趋势比较。" running={running} onToggle={()=>{if(done)setElapsed(0);setRunning(v=>!v);}} playLabel="开始定时蒸发" runningLabel="暂停计时"><div className="evap-inquiry-console"><section><b>先预测</b><span>{["升温更快","面积更大更快","风更快更快"].map(v=><button className={prediction===v?"active":""} onClick={()=>setPrediction(v)} key={v}>{v}</button>)}</span></section><section><b>三因素公平比较</b><strong>{evaporationEvidenceReady?"温度 · 面积 · 空气流动均已验证":`${Number(Boolean(temperatureEvidence))+Number(Boolean(areaEvaporationEvidence))+Number(Boolean(airflowEvidence))} / 3 项完成`}</strong></section></div><div className="evap-mass-rig"><div className="evap-fan-live" style={{"--fan-duration":`${Math.max(.3,2-airflow*.5)}s`} as React.CSSProperties}>{[0,120,240].map(angle=><i style={{"--blade-angle":`${angle}deg`} as React.CSSProperties} key={angle}/>) }<b>{airflow} m/s</b></div><div className="evap-tray-live" style={{width:`${130+area/2}px`}}><i/><span>{temperature}℃ · {area}cm²</span></div><div className="evap-balance-live"><small>MICRO BALANCE</small><strong>{result.remainingMassGrams.toFixed(3)} g</strong><em>{elapsed}/{duration}s</em></div><div className="evap-live-result">质量减少 <strong>{result.evaporatedMassGrams.toFixed(3)} g</strong><small>速率 {result.evaporationRateGramsPerMinute.toFixed(3)} g/min</small></div></div><div className="evap-controls">{[["温度/℃",[15,25,40],temperature,setTemperature],["面积/cm²",[50,100,200],area,setArea],["风速/m/s",[0,1,2],airflow,setAirflow],["时间/s",[30,60,120],duration,setDuration]] .map(([label,values,current,setter])=><section key={String(label)}><b>{String(label)}</b><div>{(values as number[]).map(v=><button className={current===v?"active":""} disabled={running} onClick={()=>{(setter as (n:number)=>void)(v);reset();}} key={v}>{v}</button>)}</div></section>)}<aside><button disabled={!done} onClick={save}><Save size={15}/>保存称量</button></aside></div><FactorEvidenceStatus className="evap-factor-status" items={[{label:"温度",done:Boolean(temperatureEvidence)},{label:"液面面积",done:Boolean(areaEvaporationEvidence)},{label:"空气流动",done:Boolean(airflowEvidence)}]}/><div className="evap-evidence-ledger">{evidence.length?evidence.map(row=><span key={row.id}>{row.temperature}℃ · {row.area}cm² · {row.airflow}m/s → <b>{row.loss.toFixed(3)}g</b></span>):"保存一组基准后，分别只改变温度、面积和风速。"}</div>{evaporationConclusion&&<EvidenceVerdict valid={evaporationConclusion.valid} title={evaporationConclusion.title} detail={evaporationConclusion.detail}/>}</LabFrame>;
}

function ThermalLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [time, setTime] = useState(0);
  const [power, setPower] = useState(800);
  const [mass, setMass] = useState(200);
  const [environmentKey,setEnvironmentKey]=useState<BoilingEnvironmentKey>("standard");
  const [running, setRunning] = useState(false);
  const [waterAdded, setWaterAdded] = useState(false);
  const [thermometerPlaced, setThermometerPlaced] = useState(false);
  const [hasHeated, setHasHeated] = useState(false);
  const [prediction, setPrediction] = useState<"rise" | "plateau" | "cool">();
  const [readings, setReadings] = useState<ThermalReading[]>([]);
  const [runEvidence,setRunEvidence]=useState<BoilingRunEvidence[]>([]);
  const environment=boilingEnvironments[environmentKey];
  const boilingPoint=calculateWaterBoilingPoint(environment.pressure);
  const temperature = calculateHeatingTemperature(time, power, mass,25,boilingPoint);
  const setupReady = waterAdded && thermometerPlaced;
  const phase = !hasHeated ? "等待加热" : temperature >= boilingPoint-.2 ? "沸腾平台" : "持续升温";
  const warmingEvidence = readings.some((row) => row.phase === "持续升温");
  const boilingPlatformEvidence = analyzeTimedPlateauEvidence(readings.filter((row) => row.phase === "沸腾平台").map((row) => ({time:row.time,value:row.temperature})),10,.3);
  const boilingEvidence = boilingPlatformEvidence.plateau;
  const boilingConclusionReady = warmingEvidence && boilingEvidence;
  const pressureComparisons=useMemo(()=>runEvidence.flatMap((newer,index)=>runEvidence.slice(index+1).map(older=>({newer,older,comparison:analyzeTargetVariableComparison([older.mass,older.power,older.pressure],[newer.mass,newer.power,newer.pressure],older.boilingPoint,newer.boilingPoint,2,20,"same-direction",.2)}))),[runEvidence]);
  const pressureEvidence=pressureComparisons.find(item=>item.comparison.validTargetComparison);
  const boilingPressureEvidenceReady=Boolean(pressureEvidence);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setTime((value) => Math.min(BOILING_RUN_LIMIT_SECONDS, value + 1.2)), 50); return () => clearInterval(timer); }, [running]);
  useEffect(() => { if (time >= BOILING_RUN_LIMIT_SECONDS) setRunning(false); }, [time]);
  const graphPoints = Array.from({ length: 60 }, (_, i) => { const sampleTime = i / 59 * Math.max(1, time); const sampleTemperature = calculateHeatingTemperature(sampleTime, power, mass,25,boilingPoint); return `${35 + sampleTime / BOILING_RUN_LIMIT_SECONDS * 485},${190 - (sampleTemperature - 20) * 1.75}`; }).join(" ");
  const boilingLineY=190-(boilingPoint-20)*1.75;
  const toggleHeat = () => {
    if (!setupReady) return;
    setRunning((value) => !value);
    if (!running) { setHasHeated(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "酒精灯", value: "点燃" }); }
  };
  const saveReading = () => {
    if (!hasHeated) return;
    const row = { id: Date.now(), time: Number(time.toFixed(0)), temperature: Number(temperature.toFixed(1)), phase };
    setReadings((items) => [row, ...items.filter((item) => item.time !== row.time)].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "温度读数", value: `${row.time}s/${row.temperature}℃`, phase });
  };
  const resetRun = () => { setRunning(false); setTime(0); setWaterAdded(false); setThermometerPlaced(false); setHasHeated(false); setReadings([]); };
  const chooseEnvironment=(key:BoilingEnvironmentKey)=>{setEnvironmentKey(key);resetRun();recordHarness("configuration.changed",{experiment:"thermal-boiling",control:"外界气压环境",value:`${boilingEnvironments[key].label}/${boilingEnvironments[key].pressure}kPa`});};
  const saveRun=()=>{if(!boilingConclusionReady)return;const timeToBoil=(boilingPoint-25)*4.2*mass/(.85*power);const row={id:Date.now(),environment:environmentKey,label:environment.label,pressure:environment.pressure,boilingPoint,timeToBoil,mass,power};setRunEvidence(items=>[row,...items.filter(item=>item.environment!==row.environment||item.mass!==row.mass||item.power!==row.power)].slice(0,8));recordHarness("configuration.changed",{experiment:"thermal-boiling",control:"保存完整沸腾曲线",value:`${row.label}/${row.pressure}kPa/${row.boilingPoint.toFixed(1)}℃`});};
  useEffect(() => {
    const issues = boilingPressureEvidenceReady?[]:!waterAdded ? ["先向烧杯加入定量的水。"] : !thermometerPlaced ? ["放入温度计，确保玻璃泡浸入水中且不碰杯底。"] : !hasHeated ? ["装置准备完成，可以点燃酒精灯。"] : !warmingEvidence ? ["先在沸腾前记录至少一组升温数据。"] : !boilingEvidence ? ["继续加热，在当前气压对应的沸腾平台记录相隔10秒以上的两组温度。"] : !runEvidence.some(item=>item.environment===environmentKey&&item.mass===mass&&item.power===power)?["保存当前完整曲线，再保持水量和火力不变切换另一种气压环境。"]:["保持水量和火力不变，切换气压至少相差20 kPa的环境并完成第二条曲线。"];
    publishApparatusSnapshot({
      module: "thermal-boiling", capturedAt: new Date().toISOString(), origin: waterAdded || thermometerPlaced || hasHeated ? "learner" : "system",
      controls: [
        { id: "heater-power", label: "加热器等效功率", value: power, unit: "W", source: "control" },
        { id: "water-mass", label: "水的质量", value: mass, unit: "g", source: "control" },
        { id: "pressure", label: "外界气压", value: environment.pressure, unit: "kPa", source: "control" },
        { id: "prediction", label: "沸腾后温度预测", value: prediction === "rise" ? "继续升高" : prediction === "plateau" ? "基本不变" : prediction === "cool" ? "逐渐降低" : "未选择", source: "control" }
      ],
      apparatus: [
        { id: "water-added", label: "烧杯已加水", value: waterAdded, source: "apparatus" },
        { id: "thermometer-placed", label: "温度计已正确放置", value: thermometerPlaced, source: "apparatus" },
        { id: "heating", label: "酒精灯正在加热", value: running, source: "apparatus" },
        { id: "elapsed-time", label: "实验时间", value: time, unit: "s", source: "apparatus" },
        { id: "saved-readings", label: "已记录读数", value: readings.length, unit: "组", source: "apparatus" }
      ],
      readings: [
        { id: "temperature", label: "温度计示数", value: hasHeated ? temperature : null, unit: "℃", source: "reading" },
        { id: "phase", label: "当前阶段", value: phase, source: "reading" }
      ],
      derived: [
        { id: "model", label: "升温模型", value: "ηPt=cmΔT；达到当前气压对应沸点后保持平台", source: "model" },
        { id: "boiling-point", label: "当前气压水的沸点", value: boilingPoint, unit: "℃", source: "model" },
        { id: "boiling-platform", label: "当前曲线升温与平台证据齐全", value: boilingConclusionReady, source: "model" },
        { id: "pressure-evidence", label: "固定水量火力的气压—沸点证据", value: boilingPressureEvidenceReady, source: "model" }
      ],
      validity: { ready: boilingPressureEvidenceReady, issues }
    });
  }, [boilingConclusionReady, boilingEvidence, boilingPoint, boilingPressureEvidenceReady, environment.pressure, environmentKey, hasHeated, mass, phase, power, prediction, readings.length, runEvidence, running, temperature, thermometerPlaced, time, warmingEvidence, waterAdded]);
  return <LabFrame field="thermal" experiment="thermal-boiling" eyebrow="BOILING OBSERVATION STATION / 沸腾观察台" title="先找到沸腾平台，再用两种气压解释沸点为什么变化" description="按 ηPt=cmΔT 模拟升温，达到当前外界气压对应的沸点后温度保持平台。保持水量和火力不变，比较高原、标准大气压或增压环境；火力影响到达沸点的快慢，气压决定沸点高低。未计容器吸热和蒸发质量变化。" running={running} onToggle={toggleHeat} playLabel="点燃酒精灯" runningLabel="熄灭酒精灯" actionDisabled={!setupReady} disabledLabel={!waterAdded ? "请先向烧杯加水" : "请先放好温度计"}>
    <div className="thermal-setup-console">
      <section><span><b>01</b><small>选择实验条件</small></span><div><label>水量</label>{[150, 200, 300].map((value) => <button className={mass === value ? "active" : ""} disabled={waterAdded} onClick={() => setMass(value)} key={value}>{value} g</button>)}</div><div><label>火力</label>{[500, 800, 1100].map((value) => <button className={power === value ? "active" : ""} disabled={hasHeated} onClick={() => setPower(value)} key={value}>{value} W</button>)}</div><div className="thermal-pressure-options"><label>气压</label>{(Object.keys(boilingEnvironments) as BoilingEnvironmentKey[]).map(key=><button className={environmentKey===key?"active":""} disabled={hasHeated} onClick={()=>chooseEnvironment(key)} key={key}><b>{boilingEnvironments[key].label}</b><small>{boilingEnvironments[key].pressure} kPa</small></button>)}</div></section>
      <section><span><b>02</b><small>组装实验装置</small></span><button className={waterAdded ? "done" : ""} disabled={waterAdded} onClick={() => { setWaterAdded(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "烧杯", value: `加入${mass}g水` }); }}><Beaker size={16} />{waterAdded ? `已加入 ${mass} g 水` : "向烧杯加水"}</button><button className={thermometerPlaced ? "done" : ""} disabled={!waterAdded || thermometerPlaced} onClick={() => { setThermometerPlaced(true); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "温度计", value: "正确放置" }); }}><Gauge size={16} />{thermometerPlaced ? "温度计已放好" : "放入温度计"}</button></section>
      <section><span><b>03</b><small>先预测再观察</small></span><p>水沸腾后继续加热，温度会怎样？</p><div className="thermal-prediction-buttons">{(["rise", "plateau", "cool"] as const).map((value) => <button className={prediction === value ? "active" : ""} onClick={() => { setPrediction(value); recordHarness("configuration.changed", { experiment: "thermal-boiling", control: "实验预测", value }); }} key={value}>{value === "rise" ? "继续升高" : value === "plateau" ? "基本不变" : "逐渐降低"}</button>)}</div></section>
    </div>
    <div className={`thermal-sim thermal-observation-station ${setupReady ? "ready" : "setting-up"}`}>
      <div className="thermal-stage-label"><span>LIVE EXPERIMENT · {environment.pressure} kPa</span><b>{running ? "正在加热" : hasHeated ? "加热已暂停" : setupReady ? "等待点火" : "装置准备中"}</b></div>
      <div className={`beaker-water ${waterAdded ? "filled" : "empty"} ${temperature >= boilingPoint-.2 ? "boiling" : "warming"}`} style={{ "--water-temp": `${temperature}%` } as React.CSSProperties}><div className="water-level" style={{ height: waterAdded ? `${35 + mass / 8}%` : "0%" }} />{hasHeated && Array.from({ length: temperature >= boilingPoint-.2 ? 15 : 6 }, (_, i) => <i style={{ animationDelay: `${-i * .18}s`, left: `${12 + (i * 23) % 76}%` }} key={i} />)}<small>{waterAdded ? `${mass} g · 沸点约 ${boilingPoint.toFixed(1)}℃` : "空烧杯"}</small></div>
      <div className={`flame ${running ? "on" : ""}`}><i /><i /><i /></div>
      <div className={`thermometer ${thermometerPlaced ? "placed" : "parked"}`}><i style={{ height: `${temperature * .75}%` }} /><span>{thermometerPlaced ? hasHeated ? `${temperature.toFixed(1)}℃` : "25.0℃" : "未放置"}</span></div>
      <svg viewBox="0 0 540 220" aria-label="水的温度时间图像"><line x1="35" y1="20" x2="35" y2="195"/><line x1="35" y1="195" x2="520" y2="195"/><text x="6" y="25">T/℃</text>{hasHeated && <><line className="boil-line" x1="35" y1={boilingLineY} x2="520" y2={boilingLineY}/><polyline points={graphPoints}/><text x="42" y={boilingLineY-6}>{boilingPoint.toFixed(1)}℃</text>{readings.map((row) => <g className="thermal-record-point" key={row.id}><circle cx={35 + row.time / BOILING_RUN_LIMIT_SECONDS * 485} cy={190 - (row.temperature - 20) * 1.75} r="5"/><text x={41 + row.time / BOILING_RUN_LIMIT_SECONDS * 485} y={185 - (row.temperature - 20) * 1.75}>{row.temperature}°</text></g>)}</>}<text x="442" y="212">时间 / s</text></svg>
      <div className={`thermal-live-reading ${hasHeated ? "" : "awaiting-reading"}`}><TimerReset size={19} /><span><small>秒表 / 温度计</small><strong>{hasHeated ? `${time.toFixed(0)} s　·　${temperature.toFixed(1)} ℃` : "— —"}</strong></span><button disabled={!hasHeated} onClick={saveReading}><Save size={15} />记录此刻读数</button></div>
      {!setupReady && <InteractionCue text={!waterAdded ? "先向烧杯加入定量的水" : "让温度计玻璃泡浸入水中且不碰杯底"} />}
    </div>
    <div className="thermal-evidence-workbench">
      <section className={`thermal-reading-ledger ${readings.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>温度—时间记录表</b></span><small>{readings.length}/3 组最低证据</small></header>{readings.length ? <div><b>t / s</b><b>T / ℃</b><b>实验阶段</b>{[...readings].reverse().map((row) => <div className="thermal-reading-row" key={row.id}><span>{row.time}</span><strong>{row.temperature.toFixed(1)}</strong><span>{row.phase}</span></div>)}</div> : <p>点火后在不同时间点击“记录此刻读数”，图像上会同步出现观测点。</p>}</section>
      <aside className={boilingConclusionReady ? "ready" : ""}><span>当前曲线证据</span><strong>{boilingConclusionReady ? `已记录跨 ${boilingPlatformEvidence.timeSpan.toFixed(0)} s 的 ${boilingPoint.toFixed(1)}℃ 沸腾平台。` : !warmingEvidence ? "先记录一组沸腾前的升温数据。" : `平台点时间跨度 ${boilingPlatformEvidence.timeSpan.toFixed(0)} / 10 s，继续加热后再记录。`}</strong>{prediction && boilingConclusionReady && <p>{prediction === "plateau" ? "你的预测与实验现象一致。" : "实际曲线出现平台，请根据证据修正原预测。"}</p>}<button disabled={!boilingConclusionReady} onClick={saveRun}><Save size={15}/>保存完整曲线</button><button onClick={resetRun}><RotateCcw size={15} />重做当前环境</button></aside>
    </div>
    <section className={`boiling-pressure-evidence ${boilingPressureEvidenceReady?"complete":""}`}><header><span><Gauge size={17}/><b>PRESSURE–BOILING POINT / 气压—沸点对照</b></span><small>{boilingPressureEvidenceReady?"固定水量和火力的强对照已建立":"至少保存两个不同气压环境"}</small></header>{runEvidence.length?<div><b>环境</b><b>气压/kPa</b><b>水量/g</b><b>火力/W</b><b>沸点/℃</b><b>到达沸点/s</b>{runEvidence.map(row=><div className="boiling-run-row" key={row.id}><strong>{row.label}</strong><span>{row.pressure}</span><span>{row.mass}</span><span>{row.power}</span><strong>{row.boilingPoint.toFixed(1)}</strong><span>{row.timeToBoil.toFixed(0)}</span></div>)}</div>:<p>先完成并保存当前升温—沸腾平台曲线，再保持水量、火力不变切换气压。</p>}{runEvidence.length>0&&<EvidenceVerdict valid={boilingPressureEvidenceReady} title={boilingPressureEvidenceReady?"气压越高，水的沸点越高":"还不能直接比较这几条曲线"} detail={boilingPressureEvidenceReady&&pressureEvidence?`${pressureEvidence.older.label}与${pressureEvidence.newer.label}的外界气压相差 ${Math.abs(pressureEvidence.comparison.targetChange).toFixed(1)} kPa，沸点同向改变 ${Math.abs(pressureEvidence.newer.boilingPoint-pressureEvidence.older.boilingPoint).toFixed(1)}℃；水量和加热功率保持不变。`:"保持水量和火力不变，只切换气压至少相差20 kPa的环境，并完成第二条曲线。"}/>}</section>
  </LabFrame>;
}

const liquidDensitySamples = {
  alcohol: { label: "酒精样品", density: .8, color: "#9acbd5" },
  water: { label: "清水样品", density: 1, color: "#55b9df" },
  brine: { label: "盐水样品", density: 1.2, color: "#80d4dd" }
} as const;

type LiquidDensityKey = keyof typeof liquidDensitySamples;
interface LiquidDensityEvidence { id: number; liquid: string; empty: number; total: number; volume: number; density: number; }

function LiquidDensityLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [liquidKey, setLiquidKey] = useState<LiquidDensityKey>();
  const [targetVolume, setTargetVolume] = useState(100);
  const [emptyMeasured, setEmptyMeasured] = useState(false);
  const [filled, setFilled] = useState(false);
  const [totalMeasured, setTotalMeasured] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [volumeRead, setVolumeRead] = useState<number>();
  const [calculated, setCalculated] = useState(false);
  const [evidence, setEvidence] = useState<LiquidDensityEvidence[]>([]);
  const [errorTrials, setErrorTrials] = useState<string[]>([]);
  const emptyMass = 50;
  const liquid = liquidKey ? liquidDensitySamples[liquidKey] : undefined;
  const liquidMass = liquid ? liquid.density * targetVolume : 0;
  const totalMass = emptyMass + liquidMass;
  const visibleVolume = targetVolume + (eyePosition === "high" ? 2 : eyePosition === "low" ? -2 : 0);
  const measuredDensity = volumeRead && totalMeasured ? calculateDensity(totalMass - emptyMass, volumeRead) : undefined;
  const complete = calculated && measuredDensity !== undefined;
  const errorAnalysisComplete = errorTrials.includes("residue") && errorTrials.includes("parallax");
  const retainedVolume = targetVolume * .95;
  const residueDensity = liquid ? calculateDensity(liquidMass, retainedVolume) : 0;
  const parallaxDensity = liquid ? calculateDensity(liquidMass, targetVolume + 2) : 0;
  const residueError = liquid ? analyzeMeasurementError(residueDensity, liquid.density) : undefined;
  const parallaxError = liquid ? analyzeMeasurementError(parallaxDensity, liquid.density) : undefined;
  const currentLiquidEvidence = liquid ? evidence.filter((row) => row.liquid === liquid.label) : [];
  const densityRepeatability = analyzeInvariantEvidence(currentLiquidEvidence.map((row) => row.density), .02, 2);
  const stage = !liquid ? 0 : !emptyMeasured ? 1 : !filled ? 2 : !totalMeasured ? 3 : !transferred || volumeRead === undefined ? 4 : !calculated ? 5 : 6;
  const resetRun = (next?: LiquidDensityKey) => { setLiquidKey(next); setEmptyMeasured(false); setFilled(false); setTotalMeasured(false); setTransferred(false); setEyePosition("high"); setVolumeRead(undefined); setCalculated(false); setErrorTrials([]); };
  const save = () => {
    if (!liquid || !complete || !errorAnalysisComplete || volumeRead === undefined || measuredDensity === undefined || evidence.some((row) => row.liquid === liquid.label && row.volume === volumeRead)) return;
    const row = { id: Date.now(), liquid: liquid.label, empty: emptyMass, total: totalMass, volume: volumeRead, density: measuredDensity };
    setEvidence((items) => [row, ...items.filter((item) => item.liquid !== row.liquid || item.volume !== row.volume)].slice(0, 8));
    recordHarness("configuration.changed", { experiment: "measurement-liquid-density", control: "保存液体密度", value: `${row.liquid}/${row.density.toFixed(2)}g/cm³` });
  };
  useEffect(() => {
    const issues = densityRepeatability.stable ? [] : !liquid ? ["先选择一种待测液体。"] : !emptyMeasured ? ["先称量干燥空烧杯质量m₁。"] : !filled ? ["向烧杯加入适量待测液体。"] : !totalMeasured ? ["称量烧杯和液体的总质量m₂。"] : !transferred ? ["把液体倒入量筒测量体积。"] : volumeRead === undefined ? [eyePosition === "level" ? "记录量筒中液体体积V。" : "调整视线与凹液面最低处相平。"] : !calculated ? ["计算液体质量m₂−m₁，再除以体积V。"] : !errorAnalysisComplete ? ["完成烧杯残留与俯视读数两种误差诊断。"] : ["保存本组后，选择同一种液体的另一个体积重新完整测量。"];
    publishApparatusSnapshot({ module: "measurement-liquid-density", capturedAt: new Date().toISOString(), origin: liquid ? "learner" : "system", controls: [
      { id: "liquid", label: "待测液体", value: liquid?.label ?? "未选择", source: "control" }, { id: "target-volume", label: "取液体积", value: targetVolume, unit: "mL", source: "control" }, { id: "eye", label: "量筒读数视线", value: eyePosition === "level" ? "平视" : eyePosition === "high" ? "俯视" : "仰视", source: "control" }
    ], apparatus: [
      { id: "empty-measured", label: "空杯质量已测", value: emptyMeasured, source: "apparatus" }, { id: "filled", label: "烧杯已装液", value: filled, source: "apparatus" }, { id: "total-measured", label: "总质量已测", value: totalMeasured, source: "apparatus" }, { id: "transferred", label: "液体已倒入量筒", value: transferred, source: "apparatus" }
    ], readings: [
      { id: "m1", label: "空烧杯质量m₁", value: emptyMeasured ? emptyMass : null, unit: "g", source: "reading" }, { id: "m2", label: "烧杯和液体总质量m₂", value: totalMeasured ? totalMass : null, unit: "g", source: "reading" }, { id: "volume", label: "液体体积V", value: volumeRead ?? null, unit: "mL", source: "reading" }, { id: "density", label: "液体密度", value: complete ? measuredDensity ?? null : null, unit: "g/cm³", source: "reading" }
    ], derived: [
      { id: "formula", label: "差量法", value: "ρ=(m₂−m₁)/V", source: "model" }, { id: "transfer-boundary", label: "规范结果假设液体全部转入量筒", value: true, source: "model" },
      { id: "error-analysis", label: "残留与视差误差已诊断", value: errorAnalysisComplete, source: "model" },
      { id: "repeatability", label: "不同取液体积测得密度稳定", value: densityRepeatability.stable, source: "model" }
    ], validity: { ready: densityRepeatability.stable, issues } });
  }, [calculated, complete, densityRepeatability.stable, emptyMeasured, errorAnalysisComplete, eyePosition, filled, liquid, measuredDensity, targetVolume, totalMass, totalMeasured, transferred, volumeRead]);
  return <LabFrame field="measurement" experiment="measurement-liquid-density" eyebrow="LIQUID DENSITY LINE / 液体密度测量线" title="先扣掉烧杯，再让质量差与体积相遇" description="按差量法依次测空烧杯质量 m₁、烧杯和液体总质量 m₂，再把液体全部转入量筒并平视读取 V。模拟不计烧杯内残留液体，最后按 ρ=(m₂−m₁)/V 计算。" running={transferred} onToggle={() => { if (!transferred) { setTransferred(true); setVolumeRead(undefined); } else { setTransferred(false); setVolumeRead(undefined); setCalculated(false); } }} playLabel="把液体倒入量筒" runningLabel="倒回烧杯重新读数" actionDisabled={!totalMeasured} disabledLabel="请先完成两次称量">
    <div className="liquid-density-selector"><section><span><b>01</b>待测液体</span><div>{(Object.keys(liquidDensitySamples) as LiquidDensityKey[]).map((key) => <button className={liquidKey === key ? "active" : ""} onClick={() => resetRun(key)} key={key}><i style={{background:liquidDensitySamples[key].color}}/><strong>{liquidDensitySamples[key].label}</strong><small>密度未知</small></button>)}</div></section><section><span><b>02</b>取液体积</span><div>{[80,100,120].map((value) => <button className={targetVolume===value?"active":""} disabled={filled} onClick={()=>setTargetVolume(value)} key={value}>{value} mL</button>)}</div></section><section><span><b>03</b>差量思路</span><strong>液体质量 = 总质量 − 空杯质量</strong><small>两次称量必须使用同一个干燥烧杯。</small></section></div>
    <div className={`liquid-density-sim stage-${stage} ${transferred?"transferred":""}`} style={{"--liquid-density-color":liquid?.color??"#55b9df"} as React.CSSProperties}>
      <div className="liquid-density-procedure">{["选液体", "称空杯", "装液复称", "倒入量筒", "平视读数", "差量计算", "保存证据"].map((label,index)=><span className={index<stage?"done":index===stage?"active":""} key={label}><b>{index<stage?"✓":index+1}</b>{label}</span>)}</div>
      <div className="liquid-balance-station"><div className="liquid-digital-balance"><Scale size={25}/><span className={`liquid-beaker-on-scale ${filled?"filled":""}`}><i/></span><output>{!emptyMeasured?"— — g":filled?totalMeasured?`${totalMass.toFixed(1)} g`:"等待复称":`${emptyMass.toFixed(1)} g`}</output><small>DIGITAL BALANCE</small></div><div><button disabled={!liquid||emptyMeasured} onClick={()=>setEmptyMeasured(true)}>称量空烧杯 m₁</button><button disabled={!emptyMeasured||filled} onClick={()=>setFilled(true)}>向烧杯加入液体</button><button disabled={!filled||totalMeasured} onClick={()=>setTotalMeasured(true)}>称量总质量 m₂</button></div></div>
      <div className="liquid-transfer-path"><span className={`transfer-beaker ${transferred?"pouring":""}`}><i/></span><ArrowRight size={24}/><small>{transferred?"液体已全部转入":"等待转移"}</small></div>
      <div className="liquid-cylinder-station"><div className="liquid-density-cylinder"><span style={{height:transferred?`${25+targetVolume*.48}%`:"0%"}}/>{Array.from({length:16},(_,index)=><i className={index%5===0?"major":""} style={{bottom:`${6+index*5.8}%`}} key={index}/>) }<b>{transferred?`目测约 ${visibleVolume.toFixed(0)} mL`:"空量筒"}</b></div></div>
      <div className={`liquid-eye-console eye-${eyePosition}`}><Eye size={25}/><span><small>{eyePosition==="level"?"视线与凹液面最低处相平":eyePosition==="high"?"当前俯视，读数会偏大":"当前仰视，读数会偏小"}</small><strong>{transferred?`可见读数约 ${visibleVolume.toFixed(0)} mL`:"等待液体倒入量筒"}</strong></span><div><button onClick={()=>setEyePosition("high")}>俯视</button><button className={eyePosition==="level"?"active":""} onClick={()=>setEyePosition("level")}>平视</button><button onClick={()=>setEyePosition("low")}>仰视</button></div><button disabled={!transferred||eyePosition!=="level"||volumeRead!==undefined} onClick={()=>{setVolumeRead(targetVolume);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"量筒体积V",value:targetVolume,unit:"mL"});}}>{volumeRead!==undefined?`V 已记录 ${volumeRead} mL`:"记录液体体积 V"}</button></div>
      <div className={`liquid-density-result ${complete?"complete":""}`}><small>{complete?"MEASUREMENT COMPLETE":`CURRENT STEP 0${stage+1}`}</small><strong>{complete&&measuredDensity!==undefined?`${measuredDensity.toFixed(2)} g/cm³`:"— —"}</strong><span>{volumeRead!==undefined?`(${totalMass.toFixed(1)}−${emptyMass.toFixed(1)})÷${volumeRead}`:"ρ=(m₂−m₁)/V"}</span></div>
      {!liquid&&<InteractionCue text="先选择一种待测液体，启动差量法测量"/>}
    </div>
    <div className="liquid-density-calculation"><ResultCell label="空杯质量 m₁" value={emptyMeasured?`${emptyMass.toFixed(1)} g`:"等待称量"} pending={!emptyMeasured}/><ResultCell label="总质量 m₂" value={totalMeasured?`${totalMass.toFixed(1)} g`:"等待复称"} pending={!totalMeasured}/><ResultCell label="液体质量 m₂−m₁" value={totalMeasured?`${liquidMass.toFixed(1)} g`:"等待质量差"} pending={!totalMeasured}/><ResultCell label="量筒体积 V" value={volumeRead!==undefined?`${volumeRead} mL`:"等待平视读数"} pending={volumeRead===undefined}/><button disabled={!totalMeasured||volumeRead===undefined||calculated} onClick={()=>setCalculated(true)}>{calculated?"密度计算完成":"代入差量公式"}</button><button disabled={!complete||!errorAnalysisComplete||Boolean(liquid&&volumeRead!==undefined&&evidence.some(row=>row.liquid===liquid.label&&row.volume===volumeRead))} onClick={save}><Save size={15}/>保存本次结果</button></div>
    <section className="measurement-error-lab"><header><span><Activity size={17}/><b>差量法系统误差诊断</b></span><small>规范结果保持不变，错误方案单独推演</small></header><div><button className={errorTrials.includes("residue")?"done":""} disabled={!complete||!liquid} onClick={()=>{setErrorTrials(items=>items.includes("residue")?items:[...items,"residue"]);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"烧杯残留误差演练",value:residueDensity,unit:"g/cm³"});}}><span><b>烧杯残留 5% 液体</b><em>质量仍取原质量差，量筒体积变小</em></span><strong>{residueError?`${residueDensity.toFixed(2)} g/cm³ · 结果偏高 ${Math.abs(residueError.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button><button className={errorTrials.includes("parallax")?"done":""} disabled={!complete||!liquid} onClick={()=>{setErrorTrials(items=>items.includes("parallax")?items:[...items,"parallax"]);recordHarness("configuration.changed",{experiment:"measurement-liquid-density",control:"俯视量筒误差演练",value:parallaxDensity,unit:"g/cm³"});}}><span><b>俯视使体积多读 2 mL</b><em>质量差不变，分母偏大</em></span><strong>{parallaxError?`${parallaxDensity.toFixed(2)} g/cm³ · 结果偏低 ${Math.abs(parallaxError.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button></div></section>
    <div className={`liquid-density-evidence ${evidence.length?"":"empty"}`}><header><span><ClipboardList size={17}/><b>液体密度测量记录</b></span><small>{liquid?`${liquid.label}复测 ${currentLiquidEvidence.length}/2 组`:"选择液体后用两个体积复测"}</small></header>{evidence.length?<div><b>液体</b><b>m₁/g</b><b>m₂/g</b><b>m液/g</b><b>V/mL</b><b>ρ/(g/cm³)</b>{evidence.map(row=><div className="liquid-density-row" key={row.id}><strong>{row.liquid}</strong><span>{row.empty.toFixed(1)}</span><span>{row.total.toFixed(1)}</span><span>{(row.total-row.empty).toFixed(1)}</span><span>{row.volume}</span><strong>{row.density.toFixed(2)}</strong></div>)}</div>:<p>完成第一组后，保持同一种液体，选择另一个体积从空杯称量开始复测。</p>}</div>
    {currentLiquidEvidence.length>0&&<EvidenceVerdict valid={densityRepeatability.stable} title={densityRepeatability.stable?"不同取液体积得到的密度稳定":"还需要第二个不同体积的独立测量"} detail={densityRepeatability.stable?`两组密度平均值 ${densityRepeatability.meanValue?.toFixed(2)} g/cm³，最大相对偏差 ${((densityRepeatability.maxRelativeDeviation??0)*100).toFixed(2)}%。`:"重新选择同一种液体与另一个体积，完整重复空杯称量、装液复称、转移和平视读数。"}/>}
  </LabFrame>;
}

const densitySamples = {
  aluminum: { name: "铝块", density: 2.7, volume: 20, color: "#9ba8ad" },
  iron: { name: "铁块", density: 7.8, volume: 12, color: "#485760" },
  stone: { name: "石块", density: 2.5, volume: 25, color: "#68747b" }
} as const;
type DensitySampleKey = keyof typeof densitySamples;
type EyePosition = "high" | "level" | "low";
type DensityImmersionCondition = "correct" | "bubbles" | "partial";
interface DensityEvidence { id: number; sample: string; mass: number; v1: number; v2: number; density: number; }

function DensityLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [sampleKey, setSampleKey] = useState<DensitySampleKey>();
  const [massMeasured, setMassMeasured] = useState(false);
  const [waterAdded, setWaterAdded] = useState(false);
  const [eyePosition, setEyePosition] = useState<EyePosition>("high");
  const [v1, setV1] = useState<number>();
  const [immersed, setImmersed] = useState(false);
  const [immersionCondition, setImmersionCondition] = useState<DensityImmersionCondition>("correct");
  const [v2, setV2] = useState<number>();
  const [calculated, setCalculated] = useState(false);
  const [evidence, setEvidence] = useState<DensityEvidence[]>([]);
  const [errorTrials, setErrorTrials] = useState<string[]>([]);
  const sample = sampleKey ? densitySamples[sampleKey] : undefined;
  const mass = sample ? sample.density * sample.volume : 0;
  const actualV1 = 50;
  const actualV2 = sample ? actualV1 + sample.volume : actualV1;
  const immersionVolumeOffset = immersed ? immersionCondition === "bubbles" ? 2 : immersionCondition === "partial" ? -2 : 0 : 0;
  const visibleVolume = (immersed ? actualV2 + immersionVolumeOffset : actualV1) + (eyePosition === "high" ? 2 : eyePosition === "low" ? -2 : 0);
  const objectVolume = v1 !== undefined && v2 !== undefined ? v2 - v1 : undefined;
  const measuredDensity = objectVolume && massMeasured ? calculateDensity(mass, objectVolume) : undefined;
  const complete = calculated && measuredDensity !== undefined;
  const errorAnalysisComplete = errorTrials.includes("bubbles") && errorTrials.includes("partial");
  const highV2Density = sample ? calculateDensity(mass, sample.volume + 2) : 0;
  const lowV2Density = sample ? calculateDensity(mass, sample.volume - 2) : 0;
  const highV2Error = sample ? analyzeMeasurementError(highV2Density, sample.density) : undefined;
  const lowV2Error = sample ? analyzeMeasurementError(lowV2Density, sample.density) : undefined;
  const stage = !sample ? 0 : !massMeasured ? 1 : !waterAdded || v1 === undefined ? 2 : !immersed || v2 === undefined ? 3 : !calculated ? 4 : 5;
  const resetMeasurement = (nextSample?: DensitySampleKey) => { setSampleKey(nextSample); setMassMeasured(false); setWaterAdded(false); setEyePosition("high"); setV1(undefined); setImmersed(false); setImmersionCondition("correct"); setV2(undefined); setCalculated(false); setErrorTrials([]); };
  const readVolume = () => {
    if (eyePosition !== "level" || !waterAdded) return;
    if (immersed && immersionCondition === "correct") { setV2(actualV2); recordHarness("configuration.changed", { experiment: "measurement-density", control: "记录V₂", value: actualV2, unit: "mL" }); }
    else if (!immersed) { setV1(actualV1); recordHarness("configuration.changed", { experiment: "measurement-density", control: "记录V₁", value: actualV1, unit: "mL" }); }
  };
  const observeImmersionError = (condition: Exclude<DensityImmersionCondition,"correct">) => {
    if (!complete || !sample) return;
    setImmersed(true);
    setImmersionCondition(condition);
    setEyePosition("level");
    setErrorTrials((items) => items.includes(condition) ? items : [...items,condition]);
    recordHarness("configuration.changed", { experiment: "measurement-density", control: condition === "bubbles" ? "气泡附着误差演练" : "未完全浸没误差演练", value: condition === "bubbles" ? highV2Density : lowV2Density, unit: "g/cm³" });
  };
  const save = () => {
    if (!sample || !complete || !errorAnalysisComplete || v1 === undefined || v2 === undefined || measuredDensity === undefined) return;
    const row = { id: Date.now(), sample: sample.name, mass, v1, v2, density: measuredDensity };
    setEvidence((items) => [row, ...items.filter((item) => item.sample !== sample.name)].slice(0, 5));
    recordHarness("configuration.changed", { experiment: "measurement-density", control: "保存密度结果", value: `${sample.name}/${measuredDensity.toFixed(2)}g/cm³` });
  };
  useEffect(() => {
    const issues = evidence.length ? [] : !sample ? ["先选择一个不吸水、能完全浸没的待测样品。"] : !massMeasured ? ["先用天平测出样品质量。"] : !waterAdded ? ["向量筒加入适量水。"] : v1 === undefined ? [eyePosition === "level" ? "读取并记录初始体积V₁。" : "视线应与凹液面最低处相平。"] : !immersed ? ["用细线让样品完全浸没，且不要接触筒底。"] : v2 === undefined ? [immersionCondition !== "correct" ? "排除气泡或未完全浸没的错误状态后，再记录正式V₂。" : eyePosition === "level" ? "读取并记录末体积V₂。" : "调整视线到与凹液面最低处相平。"] : !calculated ? ["用ρ=m/(V₂−V₁)计算密度。"] : !errorAnalysisComplete ? ["分别制造气泡附着和未完全浸没，观察液面与密度误差方向。"] : ["恢复正确浸没状态并保存本次规范测量证据。"];
    publishApparatusSnapshot({ module: "measurement-density", capturedAt: new Date().toISOString(), origin: sample ? "learner" : "system", controls: [
      { id: "sample", label: "待测材料", value: sample?.name ?? "未选择", source: "control" }, { id: "eye-position", label: "读数视线", value: eyePosition === "level" ? "平视" : eyePosition === "high" ? "俯视" : "仰视", source: "control" }, { id: "immersion-condition", label: "浸没状态", value: !immersed ? "未浸入" : immersionCondition === "correct" ? "完全浸没且无气泡" : immersionCondition === "bubbles" ? "表面附着气泡" : "未完全浸没", source: "control" }
    ], apparatus: [
      { id: "mass-measured", label: "质量已测量", value: massMeasured, source: "apparatus" }, { id: "water-added", label: "量筒已加水", value: waterAdded, source: "apparatus" }, { id: "immersed", label: "样品完全浸没", value: immersed, source: "apparatus" }, { id: "stage", label: "当前步骤", value: stage + 1, source: "apparatus" }
    ], readings: [
      { id: "mass", label: "样品质量", value: massMeasured ? mass : null, unit: "g", source: "reading" }, { id: "v1", label: "初始体积V₁", value: v1 ?? null, unit: "mL", source: "reading" }, { id: "v2", label: "末体积V₂", value: v2 ?? null, unit: "mL", source: "reading" }, { id: "density", label: "计算密度", value: complete ? measuredDensity ?? null : null, unit: "g/cm³", source: "reading" }
    ], derived: [
      { id: "formula", label: "密度公式", value: "ρ=m/(V₂−V₁)", source: "model" },
      { id: "error-analysis", label: "气泡与部分浸没误差已验证", value: errorAnalysisComplete, source: "model" }, { id: "formal-v2-lock", label: "正式V₂不被错误演练改写", value: v2 !== undefined, source: "model" }
    ], validity: { ready: evidence.length > 0, issues } });
  }, [calculated, complete, errorAnalysisComplete, evidence.length, eyePosition, immersed, immersionCondition, mass, massMeasured, measuredDensity, sample, stage, v1, v2, waterAdded]);
  return <LabFrame field="measurement" experiment="measurement-density" eyebrow="DENSITY MEASUREMENT LINE / 固体密度测量线" title="每一个读数都亲手完成，密度才不是自动出现的答案" description="按真实实验顺序测质量和体积。量筒读数必须平视凹液面最低处；样品应完全浸没、排除表面气泡且不能碰底。正式体积用锁存的 V₂−V₁ 得到，错误演练不会改写规范结果。" running={immersed} onToggle={() => { setImmersed((value) => !value); setImmersionCondition("correct"); setV2(undefined); setCalculated(false); }} playLabel="用细线完全浸没" runningLabel="从量筒取出样品" actionDisabled={!sample || !massMeasured || v1 === undefined} disabledLabel={!sample ? "请先选择样品" : !massMeasured ? "请先称量质量" : "请先记录 V₁"}>
    <div className="density-sample-selector">{(Object.keys(densitySamples) as DensitySampleKey[]).map((key, index) => <button className={sampleKey === key ? "active" : ""} onClick={() => { resetMeasurement(key); recordHarness("configuration.changed", { experiment: "measurement-density", control: "待测材料", value: densitySamples[key].name }); }} key={key}><b>样品 0{index + 1}</b><i style={{ background: densitySamples[key].color }} /><span><strong>{densitySamples[key].name}</strong><small>未知密度 · 待测</small></span></button>)}</div>
    <div className={`density-sim density-measurement-line stage-${stage} immersion-${immersionCondition}`}>
      <div className="density-procedure-strip">{["选择样品", "测质量", "读 V₁", "浸没读 V₂", "计算密度", "保存证据"].map((label, index) => <span className={index < stage ? "done" : index === stage ? "active" : ""} key={label}><b>{index < stage ? "✓" : index + 1}</b>{label}</span>)}</div>
      <div className="density-balance-station"><div className="density-digital-scale"><Scale size={26} /><span className="scale-platform">{sample && <i style={{ background: sample.color }} />}</span><output>{massMeasured ? `${mass.toFixed(1)} g` : "— — g"}</output><small>DIGITAL BALANCE</small></div><button disabled={!sample || massMeasured} onClick={() => { setMassMeasured(true); recordHarness("configuration.changed", { experiment: "measurement-density", control: "天平称量", value: mass, unit: "g" }); }}>{massMeasured ? "质量已记录" : "测量并记录质量"}</button></div>
      <div className="density-cylinder-station"><div className="density-graduated-cylinder"><span className="density-water" style={{ height: waterAdded ? `${40 + (immersed && sample ? (sample.volume + immersionVolumeOffset) * 1.1 : 0)}%` : "0%" }} />{sample && <i className={`density-drop-object ${immersed ? "immersed" : ""}`} style={{ background: sample.color }}>{immersed&&immersionCondition==="bubbles"&&<>{Array.from({length:5},(_,index)=><b className="density-attached-bubble" style={{"--bubble-index":index} as React.CSSProperties} key={index}/>)}</>}</i>}{Array.from({ length: 11 }, (_, index) => <b className={index % 5 === 0 ? "major" : ""} style={{ bottom: `${7 + index * 8.3}%` }} key={index}>{index % 5 === 0 ? 30 + index * 5 : ""}</b>)}<em>{waterAdded ? `目测约 ${visibleVolume.toFixed(0)} mL` : "空量筒"}</em></div><button disabled={!sample || !massMeasured || waterAdded} onClick={() => setWaterAdded(true)}>{waterAdded ? "已加入 50 mL 水" : "向量筒加入适量水"}</button></div>
      <div className={`density-eye-reader eye-${eyePosition}`}><Eye size={27} /><i /><span><small>{immersionCondition==="bubbles"?"错误：样品表面附着气泡":immersionCondition==="partial"?"错误：样品没有完全浸没":eyePosition === "level" ? "视线已与凹液面相平" : eyePosition === "high" ? "当前俯视，会产生读数偏差" : "当前仰视，会产生读数偏差"}</small><strong>{waterAdded ? `可见刻度约 ${visibleVolume.toFixed(0)} mL` : "等待量筒加水"}</strong></span><div><button onClick={() => setEyePosition("high")}>俯视</button><button className={eyePosition === "level" ? "active" : ""} onClick={() => setEyePosition("level")}>平视</button><button onClick={() => setEyePosition("low")}>仰视</button></div><button className="density-read-button" disabled={!waterAdded || eyePosition !== "level" || immersionCondition!=="correct" || immersed && v2 !== undefined || !immersed && v1 !== undefined} onClick={readVolume}>{immersed ? v2 !== undefined ? `正式 V₂ 已锁存 ${v2} mL` : immersionCondition!=="correct"?"先排除浸没错误":"记录末体积 V₂" : v1 !== undefined ? `V₁ 已记录 ${v1} mL` : "记录初始体积 V₁"}</button></div>
      <div className={`density-result ${complete ? "complete" : "awaiting-reading"}`}><small>{complete ? "MEASUREMENT COMPLETE" : `CURRENT STEP 0${stage + 1}`}</small><strong>{complete && measuredDensity !== undefined ? `${measuredDensity.toFixed(2)} g/cm³` : "— —"}</strong><span>{objectVolume !== undefined ? `${mass.toFixed(1)} ÷ (${v2}−${v1})` : "ρ = m / (V₂−V₁)"}</span></div>
      {!sample && <InteractionCue text="选择一个待测样品，启动完整测量流程" />}
    </div>
    <div className="density-calculation-console"><ResultCell label="样品质量 m" value={massMeasured ? `${mass.toFixed(1)} g` : "等待称量"} pending={!massMeasured} /><ResultCell label="初始体积 V₁" value={v1 !== undefined ? `${v1} mL` : "等待平视读数"} pending={v1 === undefined} /><ResultCell label="末体积 V₂" value={v2 !== undefined ? `${v2} mL（已锁存）` : "等待完全浸没"} pending={v2 === undefined} /><ResultCell label="物体体积 V₂−V₁" value={objectVolume !== undefined ? `${objectVolume} cm³` : "等待两个体积读数"} pending={objectVolume === undefined} /><button disabled={objectVolume === undefined || !massMeasured || calculated} onClick={() => setCalculated(true)}>{calculated ? "密度计算完成" : "代入公式计算密度"}</button><button disabled={!complete||!errorAnalysisComplete||immersionCondition!=="correct"} onClick={save}><Save size={15} />{immersionCondition!=="correct"?"先恢复规范浸没":"保存本次结果"}</button></div>
    <section className="measurement-error-lab"><header><span><Activity size={17}/><b>浸没操作误差诊断</b></span><small>真实改变装置液面，正式 V₂ 保持锁存</small></header><div><button className={errorTrials.includes("bubbles")?"done":""} disabled={!complete||!sample} onClick={()=>observeImmersionError("bubbles")}><span><b>让样品表面附着气泡</b><em>气泡也排开水 → V₂−V₁ 偏大</em></span><strong>{highV2Error?`${highV2Density.toFixed(2)} g/cm³ · 密度偏低 ${Math.abs(highV2Error.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button><button className={errorTrials.includes("partial")?"done":""} disabled={!complete||!sample} onClick={()=>observeImmersionError("partial")}><span><b>让样品露出液面一部分</b><em>排水体积不足 → V₂−V₁ 偏小</em></span><strong>{lowV2Error?`${lowV2Density.toFixed(2)} g/cm³ · 密度偏高 ${Math.abs(lowV2Error.percentError).toFixed(1)}%`:"等待规范结果"}</strong></button></div><button className="density-restore-condition" disabled={!complete||immersionCondition==="correct"} onClick={()=>setImmersionCondition("correct")}><RotateCcw size={14}/>排除气泡并恢复完全浸没</button></section>
    <div className={`density-evidence-ledger ${evidence.length ? "" : "empty"}`}><header><span><ClipboardList size={17} /><b>材料密度记录</b></span><small>{evidence.length ? `已完成 ${evidence.length} 种材料` : "完成一种后可更换样品继续测量"}</small></header>{evidence.length ? <div><b>材料</b><b>m / g</b><b>V₁ / mL</b><b>V₂ / mL</b><b>V物 / cm³</b><b>ρ / (g/cm³)</b>{evidence.map((row) => <div className="density-evidence-row" key={row.id}><strong>{row.sample}</strong><span>{row.mass.toFixed(1)}</span><span>{row.v1}</span><span>{row.v2}</span><span>{row.v2 - row.v1}</span><strong>{row.density.toFixed(2)}</strong></div>)}</div> : <p>完成称量、两次平视读数和公式计算后，保存第一种材料的密度。</p>}</div>
  </LabFrame>;
}

function useClock(running: boolean, speed: number) { const [phase, setPhase] = useState(0); useEffect(() => { if (!running) return; let frame = 0; let last = performance.now(); const animate = (now: number) => { if (now - last >= 45) { setPhase((value) => (value + speed) % 1); last = now; } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); }, [running, speed]); return phase; }
