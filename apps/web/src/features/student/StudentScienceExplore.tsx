import { useEffect, useMemo, useState } from "react";
import { calculateDensity, calculateHeatingTemperature, calculateLever, calculateTwoLoadCircuit } from "@physics-lab/physics";
import { ArrowRight, BatteryCharging, Beaker, Cable, CircuitBoard, Compass, Eye, Flame, Focus, Gauge, Home, Info, Lightbulb, Pause, Play, Power, RotateCcw, Scale, Sparkles, Unplug, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { ExperimentFullscreenButton } from "../../components/ExperimentFullscreenButton";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import { useHarnessStore } from "../harness/harnessStore";

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

const fieldMeta: Record<FieldKey, ScienceFieldMeta> = {
  sound: { title: "声音实验场", subtitle: "从振动出发，追踪声音怎样到达耳朵", icon: Waves, accent: "#68b9e8", book: "苏科版八年级上册 · 第一章 声现象", description: "按照声音的产生与传播、声音的特性、噪声控制和人耳听不到的声音四条课本线索组织实验。", strands: ["产生与传播", "响度·音调·音色", "噪声控制", "超声与次声"] },
  mechanics: { title: "力学工坊", subtitle: "从运动和受力，走向机械与浮沉", icon: Compass, accent: "#e5b24d", book: "八上第五章 · 八下第七至九章 · 九上第十一章", description: "把速度、力、摩擦、简单机械、压强和浮力放到同一条力学探索路线中，先观察变化，再寻找定量关系。", strands: ["运动与速度", "力与平衡", "简单机械", "压强与浮力"] },
  circuit: { title: "电学连接室", subtitle: "从电流路径，走向电功率和电磁转换", icon: CircuitBoard, accent: "#ef765b", book: "苏科版九上第十三、十四章 · 九下第十五、十六章", description: "从连接基本电路开始，逐步研究电流、电压、电阻、电功率以及电流的磁效应。", strands: ["电路连接", "电流·电压·电阻", "电功与电功率", "电与磁"] },
  thermal: { title: "热学观察站", subtitle: "让看不见的热过程留下曲线", icon: Flame, accent: "#e99048", book: "苏科版八年级上册 · 第四章 物态变化", description: "以温度测量为基础，通过汽化、液化、熔化、凝固和蒸发等实验建立物态变化图景。", strands: ["温度测量", "汽化与液化", "熔化与凝固", "生活中的物态变化"] },
  measurement: { title: "物质测量室", subtitle: "从质量和体积，认识物质的差异", icon: Beaker, accent: "#9f89dd", book: "苏科版八年级下册 · 第六章 物质的物理属性", description: "先学会正确测量质量和体积，再通过质量与体积的比认识密度，并用密度解决材料鉴别问题。", strands: ["天平测质量", "质量与体积", "固体密度", "液体密度"] }
};

const scienceModules: Record<FieldKey, ScienceModuleMeta[]> = {
  sound: [
    { key: "sound-medium", shortTitle: "产生与传播", title: "声音的产生与传播", chapter: "八上·第一章 第一节", note: "振动、介质、真空与声波", question: "抽走空气以后，闹钟为什么会越来越难听见？", icon: Waves, guide: ["观察声源振动，并判断声音传播是否需要介质。", "改变空气保留程度和接收距离，比较接收到的声音强弱。", "声源仍在振动，但介质越少或距离越远，接收效果越弱。"], life: [{ title: "土电话", text: "棉线的振动把声音传到另一只纸杯，说明固体能够传声。" }, { title: "月球表面", text: "月球几乎没有空气，宇航员不能像在教室里一样直接交谈。" }, { title: "建筑回声", text: "声波遇到墙面会反射，礼堂设计需要控制回声。" }] },
    { key: "sound-features", shortTitle: "声音三要素", title: "响度、音调和音色", chapter: "八上·第一章 第二节", note: "振幅、频率与波形", question: "波形变高和变密，分别改变了声音的什么特性？", icon: Gauge, guide: ["用波形比较声音的响度和音调。", "一次只改变频率或振幅，观察波形疏密和高度。", "振幅主要影响响度，频率主要影响音调；不同声源还有不同音色。"], life: [{ title: "调节音量", text: "音箱音量变大时，振动幅度和接收到的响度增大。" }, { title: "乐器定音", text: "改变琴弦长度和松紧程度，可以改变振动频率与音调。" }, { title: "辨认说话者", text: "即使音调和响度相近，人们也能利用音色辨认不同声源。" }] },
    { key: "sound-noise", shortTitle: "噪声控制", title: "噪声的产生与控制", chapter: "八上·第一章 第三节", note: "声源、传播途中与人耳", question: "同一种噪声，可以在哪三个环节被减弱？", icon: Compass, guide: ["把噪声看成一种会传播的声音，而不是只给它贴上“难听”的标签。", "改变声源强度和综合防护程度，观察接收位置的声级变化。", "控制噪声可以从声源、传播途中和接收端三个环节入手。"], life: [{ title: "汽车消声器", text: "在声源处减弱发动机排气噪声。" }, { title: "道路隔音屏", text: "在传播途中阻挡和吸收部分声能。" }, { title: "防护耳罩", text: "在接收端减少进入人耳的声音。" }] },
    { key: "sound-echo", shortTitle: "超声与次声", title: "听不见的声音与回声测距", chapter: "八上·第一章 第四节", note: "超声定位与次声监测", question: "发出超声后隔一段时间收到回声，距离怎样算？", icon: Waves, guide: ["利用声波发出后返回的时间估算目标距离。", "改变回声往返时间和介质声速，比较计算结果。", "声波走的是往返路程，所以目标距离应是总路程的一半。"], life: [{ title: "倒车雷达", text: "发出超声波并接收回声，估计车辆与障碍物的距离。" }, { title: "医学超声", text: "利用人体组织对超声波的反射获得内部结构信息。" }, { title: "地震监测", text: "某些自然现象会产生次声，可用于远距离监测。" }] }
  ],
  mechanics: [
    { key: "mechanics-speed", shortTitle: "运动与速度", title: "路程、时间与速度", chapter: "八上·第五章", note: "比较运动快慢", question: "同样的路程用时不同，怎样公平比较快慢？", icon: Gauge, guide: ["用单位时间内通过的路程描述运动快慢。", "改变路程或时间，观察速度读数和运动轨迹变化。", "速度等于路程与时间之比，比较时必须注意单位一致。"], life: [{ title: "区间测速", text: "用一段路程和通过这段路程的时间计算平均速度。" }, { title: "运动手表", text: "根据定位距离和时间估算配速与速度。" }, { title: "列车时刻表", text: "路程和运行时间可以帮助比较不同车次的平均速度。" }] },
    { key: "mechanics-friction", shortTitle: "摩擦力", title: "影响滑动摩擦力的因素", chapter: "八下·第七章 第三节", note: "压力与接触面粗糙程度", question: "让木块更重或让桌面更粗糙，拉力会怎样变化？", icon: Compass, guide: ["研究物体相对滑动时受到的摩擦力。", "分别改变压力和粗糙程度，保持匀速时读取拉力。", "压力越大、接触面越粗糙，滑动摩擦力通常越大。"], life: [{ title: "鞋底花纹", text: "增加接触面的粗糙程度，帮助人在湿滑路面行走。" }, { title: "自行车刹车", text: "增大刹车片压力，从而增大摩擦。" }, { title: "机器润滑", text: "加入润滑剂可以减小不必要的摩擦和磨损。" }] },
    { key: "mechanics-lever", shortTitle: "杠杆", title: "探究杠杆的平衡条件", chapter: "九上·第十一章 第一节", note: "动力、阻力与力臂", question: "较小的力为什么也能撬动较重的物体？", icon: Scale, guide: ["在支点两侧比较力与力臂共同产生的转动效果。", "改变钩码重力或悬挂位置，让杠杆重新回到水平。", "杠杆平衡时，动力×动力臂等于阻力×阻力臂。"], life: [{ title: "开瓶器", text: "增大动力臂，用较小的力撬起瓶盖。" }, { title: "天平", text: "等臂杠杆通过两侧平衡比较质量。" }, { title: "剪刀", text: "支点和刀刃位置不同，会形成不同用途的杠杆。" }] },
    { key: "mechanics-pressure", shortTitle: "压强", title: "压力作用效果与压强", chapter: "八下·第九章 第一至三节", note: "压力、受力面积与流体压强", question: "同样的力，为什么作用面积越小效果越明显？", icon: Gauge, guide: ["用单位面积上受到的压力描述压力作用效果。", "改变压力和受力面积，比较压强读数。", "压力越大或受力面积越小，压强越大。"], life: [{ title: "书包宽背带", text: "增大受力面积，减小肩部受到的压强。" }, { title: "履带车辆", text: "用宽履带增大接触面积，减小对松软地面的压强。" }, { title: "针尖", text: "针尖面积很小，在较小压力下也能产生较大压强。" }] },
    { key: "mechanics-buoyancy", shortTitle: "浮力与浮沉", title: "浮力与物体的浮沉条件", chapter: "八下·第九章 第四、五节", note: "物体密度与液体密度", question: "同一个物体放进不同液体，为什么可能浮也可能沉？", icon: Beaker, guide: ["比较物体重力与液体提供的浮力。", "改变物体密度和液体密度，观察浮沉状态。", "物体平均密度小于液体时容易上浮，大于液体时容易下沉。"], life: [{ title: "轮船", text: "把船体做成空心可降低平均密度，使它漂浮在水面。" }, { title: "潜水艇", text: "通过改变水舱中的水量改变自身平均密度。" }, { title: "盐水选种", text: "不同饱满程度的种子在适当浓度盐水中呈现不同浮沉状态。" }] }
  ],
  circuit: [
    { key: "circuit-basic", shortTitle: "串联与并联", title: "连接基本电路", chapter: "九上·第十三章", note: "电流路径、开关与用电器", question: "电流只有一条路和有多条路时，用电器怎样工作？", icon: CircuitBoard, guide: ["识别电源、开关、导线和用电器构成的完整电路。", "先断开开关连接，再切换串联和并联比较电流路径。", "串联只有一条电流路径；并联各支路可以相对独立工作。"], life: [{ title: "节日小彩灯", text: "一些灯串采用串联连接，一个位置断路可能影响整串。" }, { title: "家庭用电", text: "家庭用电器通常并联，便于独立开关。" }, { title: "冰箱门控灯", text: "不同开关控制不同支路，实现自动工作。" }] },
    { key: "circuit-ohm", shortTitle: "欧姆定律", title: "电流与电压、电阻的关系", chapter: "九上·第十四章", note: "控制变量与 I=U/R", question: "保持电阻不变增大电压，电流怎样变化？", icon: Gauge, guide: ["研究通过导体的电流与两端电压、电阻的定量关系。", "分别改变电压和电阻，一次只改变一个量。", "同一导体中电流随电压增大而增大，随电阻增大而减小。"], life: [{ title: "调光电路", text: "改变电路中的电阻可以调节灯泡电流和亮度。" }, { title: "限流电阻", text: "给发光二极管串联适当电阻，防止电流过大。" }, { title: "电压表电流表", text: "测量时要选择合适量程并按正确方式接入电路。" }] },
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
  return <div className="science-explore-page science-structure-v2" style={{ "--science-accent": meta.accent } as React.CSSProperties}>
    <header className="science-header"><Link to="/student"><BrandMark compact /></Link><div><Icon size={19} /><span><small>FIELD / 当前领域</small><strong>{meta.title}</strong></span></div><p>{activeModule ? `${activeModule.chapter} · ${activeModule.title}` : meta.subtitle}</p><Link to="/student"><Home size={16} />六领域首页</Link></header>
    <main className="science-layout">
      <aside className="science-nav"><span>01—06 · 物理领域</span><Link to="/student/explore/light"><Focus size={18} /><span><strong>光现象</strong><small>传播、反射、折射与透镜</small></span></Link>{(Object.keys(fieldMeta) as FieldKey[]).map((key) => { const item = fieldMeta[key]; const ItemIcon = item.icon; return <Link className={key === field ? "active" : ""} to={`/student/explore/${key}`} key={key}><ItemIcon size={18} /><span><strong>{item.title}</strong><small>{item.strands.join(" · ")}</small></span></Link>; })}</aside>
      <section className="science-stage">
        <div className="science-module-bar"><div><span>EXPERIMENTS / 实验</span><strong>{activeModule ? activeModule.title : `${meta.title}实验目录`}</strong></div><nav aria-label={`${meta.title}实验目录`}><button className={!activeModule ? "active" : ""} onClick={() => selectModule()}><Sparkles size={15} /><span>目录</span></button>{modules.map((module, index) => { const ModuleIcon = module.icon; return <button className={activeModule?.key === module.key ? "active" : ""} onClick={() => selectModule(module.key)} title={module.title} key={module.key}><b>{String(index + 1).padStart(2, "0")}</b><ModuleIcon size={15} /><span>{module.shortTitle}</span></button>; })}</nav></div>
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
    <section className="science-overview-heading"><div><span>EXPERIMENT MAP / 实验目录</span><h2>选择一个问题，直接进入装置。</h2></div><p>不规定先后顺序。每个实验都包含动态操作、实验说明和生活应用。</p></section>
    <div className="science-module-card-grid">{modules.map((module, index) => { const ModuleIcon = module.icon; return <button onClick={() => onSelect(module.key)} key={module.key}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><i><ModuleIcon size={24} /></i><small>{module.chapter}</small><h3>{module.title}</h3><p>{module.note}</p><blockquote>{module.question}</blockquote><b>进入动态实验 <ArrowRight size={15} /></b></button>; })}</div>
    <section className="science-curriculum-note"><span>对应教材</span><strong>{meta.book}</strong><p>教材章节用于说明知识来源，不代表必须按照章节顺序完成实验。</p></section>
  </div>;
}

function ScienceModuleExperience({ field, module }: { field: FieldKey; module: ScienceModuleMeta }) {
  const core = module.key === "sound-features" ? <SoundLab /> : module.key === "mechanics-lever" ? <LeverLab /> : module.key === "circuit-basic" ? <CircuitLab /> : module.key === "thermal-boiling" ? <ThermalLab /> : module.key === "measurement-density" ? <DensityLab /> : <TextbookConceptLab field={field} module={module} />;
  return <div className="science-module-experience" key={module.key}>{core}<ScienceModuleReading module={module} /></div>;
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
interface ConceptConfig {
  eyebrow: string;
  labelA: string; minA: number; maxA: number; stepA: number; initialA: number; unitA: string;
  labelB: string; minB: number; maxB: number; stepB: number; initialB: number; unitB: string;
  formula: string;
  visual: "wave" | "motion" | "force" | "fluid" | "electric" | "thermal" | "measure";
  calculate: (a: number, b: number) => ConceptResult;
}

const conceptConfigs: Record<ConceptLabKey, ConceptConfig> = {
  "sound-medium": { eyebrow: "SOUND MEDIUM / 介质实验", labelA: "空气保留程度", minA: 0, maxA: 100, stepA: 1, initialA: 100, unitA: "%", labelB: "接收距离", minB: 1, maxB: 12, stepB: .5, initialB: 4, unitB: "m", formula: "接收强度取决于介质与距离", visual: "wave", calculate: (air, distance) => { const value = air / Math.max(1, distance * distance) * 10; return { value, unit: "相对强度", status: air < 3 ? "接近真空，几乎不能传声" : value < 12 ? "声音很微弱" : value < 60 ? "可以听见" : "声音较清楚", detail: "声源保持振动；改变的是声音传播到接收者的条件。" }; } },
  "sound-noise": { eyebrow: "NOISE CONTROL / 噪声控制", labelA: "声源声级", minA: 40, maxA: 110, stepA: 1, initialA: 88, unitA: "dB", labelB: "综合防护程度", minB: 0, maxB: 100, stepB: 1, initialB: 35, unitB: "%", formula: "接收声级 = 声源声级 - 防护衰减", visual: "wave", calculate: (source, protection) => { const value = Math.max(20, source - protection * .45); return { value, unit: "dB", status: value < 50 ? "环境较安静" : value < 70 ? "需要留意" : "噪声仍然较强", detail: "防护可以代表声源降噪、隔音屏和耳罩等措施的综合效果。" }; } },
  "sound-echo": { eyebrow: "ULTRASOUND ECHO / 回声测距", labelA: "回声往返时间", minA: 2, maxA: 120, stepA: 1, initialA: 36, unitA: "ms", labelB: "介质中的声速", minB: 300, maxB: 1500, stepB: 10, initialB: 340, unitB: "m/s", formula: "距离 = 声速 × 往返时间 ÷ 2", visual: "wave", calculate: (time, speed) => { const value = speed * time / 2000; return { value, unit: "m", status: `目标约在 ${value.toFixed(1)} m 外`, detail: "仪器测得的是声波发出到返回的总时间，因此要除以 2。" }; } },
  "mechanics-speed": { eyebrow: "MOTION / 速度测量", labelA: "运动路程", minA: 10, maxA: 500, stepA: 5, initialA: 120, unitA: "m", labelB: "运动时间", minB: 2, maxB: 60, stepB: 1, initialB: 15, unitB: "s", formula: "v = s ÷ t", visual: "motion", calculate: (distance, time) => { const value = distance / time; return { value, unit: "m/s", status: value < 3 ? "较慢" : value < 12 ? "中等速度" : "较快", detail: "这是这段路程内的平均速度，并不表示每一时刻都同样快。" }; } },
  "mechanics-friction": { eyebrow: "FRICTION / 匀速拉动", labelA: "物体对桌面的压力", minA: 5, maxA: 80, stepA: 1, initialA: 30, unitA: "N", labelB: "接触面粗糙程度", minB: 5, maxB: 100, stepB: 1, initialB: 45, unitB: "%", formula: "匀速时：拉力 = 滑动摩擦力", visual: "force", calculate: (normal, roughness) => { const value = normal * (.08 + roughness / 180); return { value, unit: "N", status: value < 8 ? "较容易拉动" : value < 24 ? "需要较明显的拉力" : "摩擦阻力较大", detail: "模型用于比较趋势；实验中应使用弹簧测力计匀速拉动物体。" }; } },
  "mechanics-pressure": { eyebrow: "PRESSURE / 压力效果", labelA: "压力", minA: 10, maxA: 500, stepA: 5, initialA: 120, unitA: "N", labelB: "受力面积", minB: 2, maxB: 200, stepB: 2, initialB: 40, unitB: "cm²", formula: "p = F ÷ S", visual: "force", calculate: (force, area) => { const value = force / (area / 10000); return { value, unit: "Pa", status: area < 20 ? "作用面积小，压强很大" : "比较压力与面积的共同影响", detail: "计算时已把平方厘米换算为平方米。" }; } },
  "mechanics-buoyancy": { eyebrow: "FLOAT OR SINK / 浮沉", labelA: "物体平均密度", minA: .2, maxA: 8, stepA: .1, initialA: .8, unitA: "g/cm³", labelB: "液体密度", minB: .7, maxB: 1.5, stepB: .05, initialB: 1, unitB: "g/cm³", formula: "比较物体密度与液体密度", visual: "fluid", calculate: (objectDensity, liquidDensity) => { const value = objectDensity / liquidDensity; return { value, unit: "密度比", status: Math.abs(value - 1) < .03 ? "悬浮" : value < 1 ? "上浮并最终漂浮" : "下沉", detail: "这里比较的是物体的平均密度；空心结构会改变平均密度。" }; } },
  "circuit-ohm": { eyebrow: "OHM'S LAW / 欧姆定律", labelA: "导体两端电压", minA: .5, maxA: 18, stepA: .5, initialA: 6, unitA: "V", labelB: "导体电阻", minB: 2, maxB: 100, stepB: 1, initialB: 20, unitB: "Ω", formula: "I = U ÷ R", visual: "electric", calculate: (voltage, resistance) => { const value = voltage / resistance; return { value, unit: "A", status: value < .2 ? "电流较小" : value < .8 ? "电流适中" : "电流较大，注意量程", detail: "改变电压研究 I-U 关系时，应保持电阻不变。" }; } },
  "circuit-power": { eyebrow: "ELECTRIC POWER / 电功率", labelA: "用电器电压", minA: 1, maxA: 240, stepA: 1, initialA: 12, unitA: "V", labelB: "通过的电流", minB: .05, maxB: 10, stepB: .05, initialB: .5, unitB: "A", formula: "P = U × I", visual: "electric", calculate: (voltage, current) => { const value = voltage * current; return { value, unit: "W", status: value < 10 ? "小功率用电状态" : value < 500 ? "中等功率" : "较大功率", detail: "额定功率与实际功率要区分，用电器应在额定电压下正常工作。" }; } },
  "circuit-magnet": { eyebrow: "ELECTROMAGNET / 电磁铁", labelA: "线圈匝数", minA: 20, maxA: 500, stepA: 10, initialA: 160, unitA: "匝", labelB: "线圈电流", minB: .1, maxB: 3, stepB: .1, initialB: .8, unitB: "A", formula: "磁性强弱与匝数、电流有关", visual: "electric", calculate: (turns, current) => { const value = turns * current / 10; return { value, unit: "磁性指数", status: value < 15 ? "磁性较弱" : value < 60 ? "磁性明显" : "磁性较强", detail: "实际装置还受铁芯、线圈结构和温升等因素影响。" }; } },
  "thermal-thermometer": { eyebrow: "THERMOMETER / 温度读数", labelA: "液体实际温度", minA: -20, maxA: 120, stepA: .5, initialA: 36.5, unitA: "℃", labelB: "温度计分度值", minB: .5, maxB: 10, stepB: .5, initialB: 1, unitB: "℃", formula: "示数按最小分度读取", visual: "thermal", calculate: (temperature, division) => { const value = Math.round(temperature / division) * division; return { value, unit: "℃", status: division <= 1 ? "读数较细致" : "只能作较粗略读数", detail: `当前分度值为 ${division.toFixed(1)}℃，读数应结合量程和视线位置。` }; } },
  "thermal-melting": { eyebrow: "MELTING CURVE / 冰的熔化", labelA: "加热时间", minA: 0, maxA: 16, stepA: .2, initialA: 3, unitA: "min", labelB: "加热功率档位", minB: 1, maxB: 5, stepB: .5, initialB: 2, unitB: "档", formula: "熔化阶段继续吸热，温度保持在熔点附近", visual: "thermal", calculate: (time, power) => { const energy = time * power; const value = energy < 12 ? -12 + energy : energy < 32 ? 0 : Math.min(35, (energy - 32) * .8); return { value, unit: "℃", status: energy < 12 ? "固态冰正在升温" : energy < 32 ? "冰水共存，正在熔化" : "已经熔化，水继续升温", detail: "这是晶体熔化曲线的简化模型，熔化平台位于 0℃附近。" }; } },
  "thermal-evaporation": { eyebrow: "EVAPORATION / 蒸发", labelA: "液体温度", minA: 5, maxA: 70, stepA: 1, initialA: 25, unitA: "℃", labelB: "空气流动程度", minB: 0, maxB: 100, stepB: 1, initialB: 20, unitB: "%", formula: "蒸发快慢受温度、表面积和空气流动影响", visual: "thermal", calculate: (temperature, wind) => { const value = temperature * .6 + wind * .5; return { value, unit: "蒸发指数", status: value < 35 ? "蒸发较慢" : value < 70 ? "蒸发速度中等" : "蒸发较快", detail: "本轮固定液体表面积，只比较温度和空气流动的影响。" }; } },
  "measurement-balance": { eyebrow: "BALANCE / 天平测量", labelA: "砝码总质量", minA: 0, maxA: 200, stepA: 5, initialA: 100, unitA: "g", labelB: "游码示数", minB: 0, maxB: 5, stepB: .1, initialB: 2.5, unitB: "g", formula: "物体质量 = 砝码质量 + 游码示数", visual: "measure", calculate: (weights, rider) => { const value = weights + rider; const difference = value - 137.5; return { value, unit: "g", status: Math.abs(difference) < .06 ? "天平平衡，完成测量" : difference > 0 ? "砝码一侧偏重" : "物体一侧偏重", detail: "待测物质量设为 137.5 g；先增减砝码，再用游码微调。" }; } },
  "measurement-mass-volume": { eyebrow: "MASS–VOLUME / 同种材料", labelA: "样品块数量", minA: 1, maxA: 10, stepA: 1, initialA: 3, unitA: "块", labelB: "每块体积", minB: 5, maxB: 30, stepB: 1, initialB: 10, unitB: "cm³", formula: "铝的质量 = 密度 × 总体积", visual: "measure", calculate: (count, volume) => { const totalVolume = count * volume; const value = 2.7 * totalVolume; return { value, unit: "g", status: `总体积 ${totalVolume.toFixed(0)} cm³`, detail: "同为铝制样品，质量与总体积之比保持约 2.7 g/cm³。" }; } },
  "measurement-liquid-density": { eyebrow: "LIQUID DENSITY / 液体密度", labelA: "液体质量", minA: 20, maxA: 300, stepA: 1, initialA: 100, unitA: "g", labelB: "液体体积", minB: 20, maxB: 250, stepB: 1, initialB: 100, unitB: "mL", formula: "ρ = m ÷ V", visual: "measure", calculate: (mass, volume) => { const value = mass / volume; return { value, unit: "g/cm³", status: value < .8 ? "密度较小" : value < 1.2 ? "接近水的密度范围" : "密度较大", detail: "液体质量应由装液体容器的总质量减去空容器质量得到。" }; } }
};

function TextbookConceptLab({ field, module }: { field: FieldKey; module: ScienceModuleMeta }) {
  const config = conceptConfigs[module.key as ConceptLabKey];
  const ModuleIcon = module.icon;
  const [a, setA] = useState(config.initialA);
  const [b, setB] = useState(config.initialB);
  const [interacted, setInteracted] = useState(false);
  const [running, setRunning] = useState(false);
  const recordHarness = useHarnessStore((state) => state.record);
  const result = config.calculate(a, b);
  const normalizedA = (a - config.minA) / (config.maxA - config.minA);
  const normalizedB = (b - config.minB) / (config.maxB - config.minB);
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
  return <div className="science-lab concept-science-lab">
    <header><div><span>{config.eyebrow} · {module.chapter}</span><h1>{module.question}</h1><p>{module.note}。拖动两个变量并观察装置、状态与读数怎样同步变化；自动扫描只用于快速发现趋势。</p></div><PhysicsFieldMotif field={field} className="science-lab-physics" /><div className="science-lab-header-actions"><button className={running ? "running" : ""} onClick={() => { setRunning((value) => !value); setInteracted(true); }}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停扫描" : "自动改变第一个量"}</button><ExperimentFullscreenButton targetSelector=".science-lab" experiment={module.key} className="science-fullscreen-button" label="全屏工作台" hint="保留控制与读数" /></div></header>
    <div className={`concept-sim visual-${config.visual} ${interacted ? "has-reading" : "awaiting"}`} style={{ "--concept-a": normalizedA, "--concept-b": normalizedB } as React.CSSProperties}>
      <div className="concept-axis"><span>{config.labelA}</span><i /><span>{config.labelB}</span></div>
      <div className="concept-apparatus"><span className="apparatus-source"><ModuleIcon size={36} /></span><div className="apparatus-flow">{Array.from({ length: 8 }, (_, index) => <i style={{ "--i": index } as React.CSSProperties} key={index} />)}</div><span className="apparatus-target"><Gauge size={30} /></span></div>
      <div className="concept-value value-a"><small>{config.labelA}</small><strong>{a.toFixed(config.stepA < 1 ? 1 : 0)} {config.unitA}</strong></div>
      <div className="concept-value value-b"><small>{config.labelB}</small><strong>{b.toFixed(config.stepB < 1 ? 1 : 0)} {config.unitB}</strong></div>
      <div className={`concept-reading ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? config.formula : "装置等待操作"}</span><strong>{interacted ? `${result.value.toFixed(Math.abs(result.value) < 10 ? 2 : 1)} ${result.unit}` : "— —"}</strong><b>{interacted ? result.status : "先拖动任意一个变量"}</b><p>{interacted ? result.detail : "操作后才生成实验现象和读数。"}</p></div>
      {!interacted && <InteractionCue text="改变一个实验条件，生成第一组现象" />}
    </div>
    <div className="science-controls"><ScienceRange label={config.labelA} value={a} min={config.minA} max={config.maxA} step={config.stepA} unit={config.unitA} onChange={(value) => change("a", value)} /><ScienceRange label={config.labelB} value={b} min={config.minB} max={config.maxB} step={config.stepB} unit={config.unitB} onChange={(value) => change("b", value)} /><ResultCell label="当前观察" value={interacted ? result.status : "等待第一次操作"} pending={!interacted} /></div>
  </div>;
}

function SoundLab() {
  const [frequency, setFrequency] = useState(6);
  const [amplitude, setAmplitude] = useState(42);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const phase = useClock(playing, 0.075);
  const points = Array.from({ length: 101 }, (_, i) => { const x = i * 7.8; const y = 120 + Math.sin(i / 100 * Math.PI * 2 * frequency + phase * Math.PI * 2) * amplitude; return `${x},${y}`; }).join(" ");
  const interact = () => setInteracted(true);
  return <LabFrame field="sound" experiment="sound-features" eyebrow="SOUND WAVE / 实时波形" title="如果声音可以被看见，它会怎样运动？" description="先启动声源，再分别改变两个旋钮。规律不会预先显示，需要从波形和听觉描述中比较。" running={playing} onToggle={() => { setPlaying(!playing); interact(); }}>
    <div className="sound-sim"><div className={`speaker ${playing ? "playing" : ""}`} style={{ "--vibration": `${Math.max(2, amplitude / 10)}px` } as React.CSSProperties}><i /><b /></div><svg viewBox="0 0 780 240" preserveAspectRatio="none"><polyline points={interacted ? points : "0,120 780,120"} /></svg><div className="sound-particles">{interacted && Array.from({ length: 12 }, (_, i) => <i style={{ animationDelay: `${-i * .13}s`, opacity: amplitude / 70 }} key={i} />)}</div><div className={`sound-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "模拟读数" : "声源尚未启动"}</span><strong>{interacted ? frequency < 5 ? "较低" : frequency < 9 ? "中等" : "较高" : "— —"}</strong><small>{interacted ? `${(frequency * 55).toFixed(0)} Hz` : "先启动，再观察"}</small></div>{!interacted && <InteractionCue text="启动声源，波形才会出现" />}</div>
    <div className="science-controls"><ScienceRange label="振动频率" value={frequency} min={2} max={13} step={.2} unit="档" onChange={setFrequency} onInteract={interact} /><ScienceRange label="振幅" value={amplitude} min={8} max={70} step={1} unit="px" onChange={setAmplitude} onInteract={interact} /><ResultCell label="比较建议" value={interacted ? "固定一个旋钮，只改变另一个" : "先启动声源并观察基准波形"} pending={!interacted} /></div>
  </LabFrame>;
}

function LeverLab() {
  const [leftForce, setLeftForce] = useState(3);
  const [leftArm, setLeftArm] = useState(4);
  const [rightForce, setRightForce] = useState(2);
  const [rightArm, setRightArm] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const lever = calculateLever(leftForce, leftArm, rightForce, rightArm);
  const tilt = Math.max(-11, Math.min(11, lever.difference * 1.2));
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setRightArm((value) => value >= 9 ? 2 : value + .1), 45); return () => clearInterval(timer); }, [playing]);
  const interact = () => setInteracted(true);
  return <LabFrame field="mechanics" experiment="mechanics-lever" eyebrow="LEVER / 力矩平衡" title="移动钩码，让杠杆自己寻找平衡" description="装置起初被锁定在水平位置。移动任一钩码后解除锁定，再从倾斜方向和读数寻找平衡条件。" running={playing} onToggle={() => { setPlaying(!playing); interact(); }}>
    <div className="lever-sim"><div className="lever-scale">{Array.from({ length: 19 }, (_, i) => <i key={i} />)}</div><div className="lever-beam" style={{ transform: `translate(-50%,-50%) rotate(${interacted ? tilt : 0}deg)` }}><span className="weight left" style={{ left: `${50 - leftArm * 4.5}%`, "--weight": `${38 + leftForce * 7}px` } as React.CSSProperties}>{leftForce}N</span><span className="weight right" style={{ left: `${50 + rightArm * 4.5}%`, "--weight": `${38 + rightForce * 7}px` } as React.CSSProperties}>{rightForce}N</span></div><div className="fulcrum" /><div className={`balance-status ${interacted && lever.balanced ? "balanced" : ""} ${interacted ? "" : "awaiting-reading"}`}><Gauge size={21} /><strong>{interacted ? lever.balanced ? "杠杆平衡" : tilt > 0 ? "右端下沉" : "左端下沉" : "杠杆暂时锁定"}</strong><span>{interacted ? `${lever.leftMoment.toFixed(1)} N·格　/　${lever.rightMoment.toFixed(1)} N·格` : "移动任一滑块解除锁定"}</span></div>{!interacted && <InteractionCue text="先改变一个力或力臂" />}</div>
    <div className="science-controls four"><ScienceRange label="左侧力" value={leftForce} min={1} max={6} step={.5} unit="N" onChange={setLeftForce} onInteract={interact} /><ScienceRange label="左力臂" value={leftArm} min={1} max={9} step={.5} unit="格" onChange={setLeftArm} onInteract={interact} /><ScienceRange label="右侧力" value={rightForce} min={1} max={6} step={.5} unit="N" onChange={setRightForce} onInteract={interact} /><ScienceRange label="右力臂" value={rightArm} min={1} max={9} step={.1} unit="格" onChange={setRightArm} onInteract={interact} /></div>
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
  const [notice, setNotice] = useState("先点击一个接线柱，再点击另一个接线柱连接导线。");
  const plans = circuitWirePlans[topology];
  const layout = circuitLayouts[topology];
  const fullyWired = plans.every((wire) => connectedWires.includes(wire.id));
  const circuit = calculateTwoLoadCircuit(topology, voltage, r1, r2, closed && fullyWired, lamp1Connected, lamp2Connected);
  const [current1, current2] = circuit.branchCurrents;
  const [power1, power2] = circuit.loadPowers;
  const terminalNames: Record<CircuitTerminal, string> = {
    "battery-plus": "电源正极", "battery-minus": "电源负极", "switch-in": "开关左端", "switch-out": "开关右端",
    "lamp1-in": "灯泡 L₁ 左端", "lamp1-out": "灯泡 L₁ 右端", "lamp2-in": "灯泡 L₂ 左端", "lamp2-out": "灯泡 L₂ 右端"
  };

  const resetWiring = (nextTopology = topology) => {
    setTopology(nextTopology);
    setConnectedWires([]);
    setSelectedTerminal(undefined);
    setClosed(false);
    setHasPowered(false);
    setLamp1Connected(true);
    setLamp2Connected(true);
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
    setClosed((value) => !value);
    if (!closed) {
      setHasPowered(true);
      setNotice("总开关已闭合。现在旋松一个灯泡，比较另外一个灯泡是否继续发光。");
    } else setNotice("总开关已断开，可以安全调整接线或灯泡。");
  };
  const toggleLamp = (lamp: 1 | 2) => {
    if (lamp === 1) setLamp1Connected((value) => !value);
    else setLamp2Connected((value) => !value);
    setHasPowered((value) => value || closed);
    setNotice(`${lamp === 1 ? "L₁" : "L₂"} 已${(lamp === 1 ? lamp1Connected : lamp2Connected) ? "旋松形成断路" : "重新旋紧接入电路"}。观察另一只灯泡和各支路电流。`);
    recordHarness("configuration.changed", { experiment: "circuit-basic", control: lamp === 1 ? "灯泡 L₁" : "灯泡 L₂", value: (lamp === 1 ? lamp1Connected : lamp2Connected) ? "断路" : "接通" });
  };
  const wireIsActive = (wire: CircuitWirePlan) => circuit.energized && (wire.branch === "main" || wire.branch === "lamp1" && current1 > 0 || wire.branch === "lamp2" && current2 > 0);
  const renderTerminal = (terminal: CircuitTerminal) => {
    const [x, y] = layout[terminal];
    return <g className={`circuit-terminal ${selectedTerminal === terminal ? "selected" : ""}`} role="button" tabIndex={0} aria-label={terminalNames[terminal]} onClick={(event) => { event.stopPropagation(); selectTerminal(terminal); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectTerminal(terminal); }} key={terminal}><circle cx={x} cy={y} r="12" /><circle cx={x} cy={y} r="4" /></g>;
  };

  return <LabFrame field="circuit" experiment="circuit-basic" eyebrow="CIRCUIT WIRING BENCH / 交互接线台" title="亲手接通电路，再让故障告诉你串联与并联的区别" description="选择任务后逐根连接接线柱。电路完整之前不能通电；通电后可以旋松任意灯泡，观察电流路径和另一只灯泡的变化。" running={closed} onToggle={toggleCircuit} playLabel="合上总开关" actionDisabled={!fullyWired} disabledLabel={`还差 ${plans.length - connectedWires.length} 根导线`}>
    <div className="topology-tabs circuit-task-tabs"><button className={topology === "series" ? "active" : ""} onClick={() => selectTopology("series")}><b>任务 01</b><span>串联接线<small>一条连续路径</small></span></button><button className={topology === "parallel" ? "active" : ""} onClick={() => selectTopology("parallel")}><b>任务 02</b><span>并联接线<small>两条独立支路</small></span></button></div>
    <div className={`circuit-sim circuit-wiring-bench ${topology} ${closed ? "closed" : "open"} ${fullyWired ? "wired" : "wiring"}`} style={{ "--current-speed": `${Math.max(.55, 2.15 - circuit.totalCurrent * .5)}s` } as React.CSSProperties}>
      <div className="circuit-bench-toolbar"><span><Cable size={16} /><b>接线进度</b><strong>{connectedWires.length} / {plans.length}</strong></span><div><button onClick={() => { setConnectedWires((items) => items.slice(0, -1)); setClosed(false); setNotice("已撤下最后一根导线。"); }} disabled={connectedWires.length === 0}><Unplug size={14} />撤下最后一根</button><button onClick={() => resetWiring()}><RotateCcw size={14} />全部复位</button></div></div>
      <svg viewBox="0 0 960 500" aria-label={`${topology === "series" ? "串联" : "并联"}电路交互接线板`}>
        <defs><filter id="lampGlow"><feGaussianBlur stdDeviation="9" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter><pattern id="benchDots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#34505a" /></pattern></defs>
        <rect className="circuit-board-surface" x="28" y="36" width="904" height="394" rx="18" fill="url(#benchDots)" />
        {plans.map((wire) => connectedWires.includes(wire.id) ? <g className={`bench-wire-group ${wireIsActive(wire) ? "active" : ""}`} key={wire.id}><path className="bench-wire-shadow" d={wire.path} /><path className="bench-wire" d={wire.path} /><path className="bench-current" d={wire.path} /></g> : <path className="bench-wire-guide" d={wire.path} key={wire.id} />)}
        <g className="bench-battery"><rect x="67" y="180" width="86" height="135" rx="9" /><rect x="79" y="194" width="62" height="107" rx="5" /><text x="110" y="228">直流电源</text><text className="battery-reading" x="110" y="266">{voltage.toFixed(1)} V</text><text className="polarity plus" x="110" y="113">＋</text><text className="polarity minus" x="110" y="402">−</text></g>
        <g className={`bench-switch ${closed ? "is-closed" : ""}`} role="button" tabIndex={0} onClick={toggleCircuit}><rect x="234" y="73" width="122" height="104" rx="10" /><line x1="257" y1="125" x2={closed ? 333 : 319} y2={closed ? 125 : 89} /><circle cx="257" cy="125" r="7" /><circle cx="333" cy="125" r="7" /><text x="295" y="162">{closed ? "总开关 · 闭合" : "总开关 · 断开"}</text></g>
        {[1, 2].map((lampNumber) => { const lampTerminal = `lamp${lampNumber}-in` as CircuitTerminal; const otherTerminal = `lamp${lampNumber}-out` as CircuitTerminal; const [leftX, y] = layout[lampTerminal]; const [rightX] = layout[otherTerminal]; const centerX = (leftX + rightX) / 2; const connected = lampNumber === 1 ? lamp1Connected : lamp2Connected; const active = lampNumber === 1 ? current1 > 0 : current2 > 0; const resistance = lampNumber === 1 ? r1 : r2; const power = lampNumber === 1 ? power1 : power2; return <g className={`bench-lamp ${active ? "lit" : ""} ${connected ? "seated" : "loose"}`} role="button" tabIndex={0} aria-label={`点击旋松或旋紧灯泡 L${lampNumber}`} onClick={() => toggleLamp(lampNumber as 1 | 2)} transform={`translate(${centerX} ${y})`} key={lampNumber}><circle className="lamp-aura" r={34 + Math.min(16, power * 3)} style={{ opacity: active ? Math.min(.82, .25 + power / 8) : 0 }} /><circle className="lamp-glass" r="34" /><path className="lamp-filament" d="M-17 5 L-9 -7 L0 7 L9 -7 L17 5" /><rect x="-24" y="31" width="48" height="19" rx="4" /><text y="-47">L{lampNumber} · {resistance} Ω</text><text className="lamp-action" y="67">{connected ? "点击旋松" : "已断路 · 点击旋紧"}</text></g>; })}
        {(Object.keys(layout) as CircuitTerminal[]).map(renderTerminal)}
        {topology === "parallel" && <><circle className="junction-dot" cx="420" cy="125" r="6" /><text className="branch-label" x="436" y="187">支路 1</text><text className="branch-label" x="436" y="302">支路 2</text></>}
      </svg>
      <div className={`circuit-guidance ${selectedTerminal ? "selecting" : ""}`}><Power size={17} /><span><small>{fullyWired ? closed ? "电路正在工作" : "接线完整，等待合闸" : `接线步骤 · 还差 ${plans.length - connectedWires.length} 根`}</small><strong>{notice}</strong></span></div>
      <div className={`circuit-live-readouts ${hasPowered ? "" : "awaiting-reading"}`}><div><BatteryCharging size={17} /><span>干路电流<strong>{hasPowered ? `${circuit.totalCurrent.toFixed(2)} A` : "— —"}</strong></span></div><div><Gauge size={17} /><span>{topology === "series" ? "L₁ / L₂ 电流" : "支路 I₁ / I₂"}<strong>{hasPowered ? `${current1.toFixed(2)} / ${current2.toFixed(2)} A` : "— —"}</strong></span></div><div><CircuitBoard size={17} /><span>等效电阻<strong>{hasPowered ? Number.isFinite(circuit.equivalentResistance) ? `${circuit.equivalentResistance.toFixed(1)} Ω` : "断路 ∞" : "— —"}</strong></span></div><div className="circuit-conclusion"><Lightbulb size={17} /><span>当前现象<strong>{!hasPowered ? "等待通电观察" : circuit.energized ? topology === "parallel" && (!lamp1Connected || !lamp2Connected) ? "另一支路仍可工作" : "电路中有电流" : "电路断路，灯泡熄灭"}</strong></span></div></div>
    </div>
    <div className="science-controls circuit-controls"><ScienceRange label="电源电压" value={voltage} min={1.5} max={12} step={.5} unit="V" onChange={setVoltage} /><ScienceRange label="灯泡 L₁ 电阻" value={r1} min={5} max={40} step={1} unit="Ω" onChange={setR1} /><ScienceRange label="灯泡 L₂ 电阻" value={r2} min={5} max={40} step={1} unit="Ω" onChange={setR2} /></div>
  </LabFrame>;
}

function ThermalLab() {
  const [time, setTime] = useState(0);
  const [power, setPower] = useState(8);
  const [mass, setMass] = useState(200);
  const [running, setRunning] = useState(false);
  const [hasHeated, setHasHeated] = useState(false);
  const temperature = calculateHeatingTemperature(time, power, mass);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setTime((value) => Math.min(18, value + .08)), 50); return () => clearInterval(timer); }, [running]);
  const graphPoints = Array.from({ length: 60 }, (_, i) => { const t = i / 59 * Math.max(1, time); const temp = calculateHeatingTemperature(t, power, mass); return `${35 + i * 8},${190 - (temp - 20) * 1.75}`; }).join(" ");
  const toggleHeat = () => { setRunning(!running); if (!running) setHasHeated(true); };
  return <LabFrame field="thermal" experiment="thermal-boiling" eyebrow="BOILING / 温度-时间图像" title="持续加热，温度曲线会怎样生长？" description="曲线初始为空。选择水量和加热功率后启动加热，温度计、气泡和曲线才开始留下证据。" running={running} onToggle={toggleHeat}>
    <div className="thermal-sim"><div className={`beaker-water ${temperature >= 99.8 ? "boiling" : ""}`} style={{ "--water-temp": `${temperature}%` } as React.CSSProperties}><div className="water-level" style={{ height: `${35 + mass / 8}%` }} />{hasHeated && Array.from({ length: 15 }, (_, i) => <i style={{ animationDelay: `${-i * .18}s`, left: `${12 + (i * 23) % 76}%` }} key={i} />)}</div><div className={`flame ${running ? "on" : ""}`}><i /><i /><i /></div><div className="thermometer"><i style={{ height: `${temperature * .75}%` }} /><span>{hasHeated ? `${temperature.toFixed(1)}℃` : "待测"}</span></div><svg viewBox="0 0 540 220"><line x1="35" y1="20" x2="35" y2="195"/><line x1="35" y1="195" x2="520" y2="195"/>{hasHeated && <><line className="boil-line" x1="35" y1="50" x2="520" y2="50"/><polyline points={graphPoints}/><text x="42" y="44">100℃</text></>}<text x="470" y="212">时间</text></svg>{!hasHeated && <InteractionCue text="启动加热，生成你的第一段曲线" />}</div>
    <div className="science-controls"><ScienceRange label="加热功率" value={power} min={3} max={14} step={.5} unit="档" onChange={setPower} /><ScienceRange label="水的质量" value={mass} min={100} max={350} step={10} unit="g" onChange={setMass} /><button className="science-reset" onClick={() => { setRunning(false); setTime(0); setHasHeated(false); }}><RotateCcw size={15} />清空并重新测量</button></div>
  </LabFrame>;
}

function DensityLab() {
  const recordHarness = useHarnessStore((state) => state.record);
  const samples = { aluminum: { name: "铝块", density: 2.7, volume: 20, color: "#9ba8ad" }, iron: { name: "铁块", density: 7.8, volume: 12, color: "#485760" }, wood: { name: "木块", density: .65, volume: 30, color: "#a96b38" }, stone: { name: "石块", density: 2.5, volume: 25, color: "#68747b" } };
  const [sampleKey, setSampleKey] = useState<keyof typeof samples | null>(null);
  const [immersed, setImmersed] = useState(false);
  const sample = sampleKey ? samples[sampleKey] : undefined;
  const mass = sample ? sample.density * sample.volume : 0;
  const measuredDensity = sample ? calculateDensity(mass, sample.volume) : 0;
  return <LabFrame field="measurement" experiment="measurement-density" eyebrow="DENSITY / 排水法测体积" title="不规则物体的体积，能用水“看见”吗？" description="实验台初始没有样品。先选择一种材料称量，再放入量筒；只有完成两次测量后才显示密度。" running={immersed} onToggle={() => { if (sample) setImmersed(!immersed); }} playLabel="放入量筒" actionDisabled={!sample}>
    <div className="density-sim"><div className="balance"><div className="balance-beam"><i className="pan left">{sample && <span className="sample-block" style={{ background: sample.color }} />}</i><i className="pan right"><b>{sample ? `${mass.toFixed(1)}g` : "待称量"}</b></i></div><div className="balance-base"><Scale size={24} /><span>{sample ? `质量 ${mass.toFixed(1)} g` : "请先选择样品"}</span></div></div><div className="cylinder"><div className="water" style={{ height: `${sample && immersed ? 42 + sample.volume * 1.25 : 42}%` }} />{sample && <span className={`drop-sample ${immersed ? "immersed" : ""}`} style={{ background: sample.color }} />}{Array.from({ length: 7 }, (_, i) => <i style={{ bottom: `${12 + i * 10}%` }} key={i}>{40 + i * 10}</i>)}</div><div className={`density-result ${immersed ? "" : "awaiting-reading"}`}><small>{immersed ? "ρ = m / V" : "测量尚未完成"}</small><strong>{immersed ? `${measuredDensity.toFixed(2)} g/cm³` : "— —"}</strong><span>{sample ? immersed ? sample.name : "把样品放入量筒" : "从下方选择材料"}</span></div>{!sample && <InteractionCue text="选择一个样品开始称量" />}</div>
    <div className="sample-tabs">{(Object.keys(samples) as Array<keyof typeof samples>).map((key) => <button className={sampleKey === key ? "active" : ""} onClick={() => { setSampleKey(key); setImmersed(false); recordHarness("configuration.changed", { control: "待测材料", value: samples[key].name }); }} key={key}>{samples[key].name}</button>)}</div><div className="science-controls"><ResultCell label="天平测得质量" value={sample ? `${mass.toFixed(1)} g` : "等待选择样品"} pending={!sample} /><ResultCell label="排开水的体积" value={sample && immersed ? `${sample.volume} cm³` : "等待浸没"} pending={!immersed} /><ResultCell label="计算密度" value={sample && immersed ? `${measuredDensity.toFixed(2)} g/cm³` : "完成测量后显示"} pending={!immersed} /></div>
  </LabFrame>;
}

function LabFrame({ field, experiment, eyebrow, title, description, running, onToggle, playLabel = "启动动态", actionDisabled = false, disabledLabel = "先选择样品", children }: { field: FieldKey; experiment: CoreLabKey; eyebrow: string; title: string; description: string; running: boolean; onToggle: () => void; playLabel?: string; actionDisabled?: boolean; disabledLabel?: string; children: React.ReactNode }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const toggle = () => { onToggle(); recordHarness("simulation.toggled", { running: !running, action: playLabel }); };
  return <div className="science-lab"><header><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><PhysicsFieldMotif field={field} className="science-lab-physics" /><div className="science-lab-header-actions"><button className={running ? "running" : ""} onClick={toggle} disabled={actionDisabled}>{running ? <Pause size={16} /> : <Play size={16} />}{actionDisabled ? disabledLabel : running ? "暂停" : playLabel}</button><ExperimentFullscreenButton targetSelector=".science-lab" experiment={experiment} className="science-fullscreen-button" label="全屏工作台" hint="保留控制与读数" /></div></header>{children}</div>;
}

function ScienceRange({ label, value, min, max, step, unit, onChange, onInteract }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; onInteract?: () => void }) { const recordHarness = useHarnessStore((state) => state.record); const change = (next: number) => { onChange(next); onInteract?.(); recordHarness("control.changed", { control: label, value: next, unit }); }; return <label className="science-range"><span>{label}<output>{value.toFixed(step < .1 ? 2 : 1)} {unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => change(Number(event.target.value))} /></label>; }
function ResultCell({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) { return <div className={`science-result-cell ${pending ? "awaiting-reading" : ""}`}><span>{label}</span><strong>{value}</strong></div>; }
function InteractionCue({ text }: { text: string }) { return <div className="interaction-cue"><Compass size={18} /><span><small>装置等待你的操作</small><strong>{text}</strong></span></div>; }
function useClock(running: boolean, speed: number) { const [phase, setPhase] = useState(0); useEffect(() => { if (!running) return; let frame = 0; const animate = () => { setPhase((value) => (value + speed) % 1); frame = requestAnimationFrame(animate); }; const timer = window.setInterval(() => { frame = requestAnimationFrame(animate); }, 45); return () => { clearInterval(timer); cancelAnimationFrame(frame); }; }, [running, speed]); return phase; }
