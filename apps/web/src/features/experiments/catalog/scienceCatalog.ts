import { type LucideIcon, Waves, Compass, CircuitBoard, Flame, Beaker, Gauge, Shield, RadioTower, Mic2, Scale, BatteryCharging } from "lucide-react";

export type FieldKey = "sound" | "mechanics" | "circuit" | "thermal" | "measurement";

type CoreLabKey = "sound-features" | "mechanics-lever" | "circuit-basic" | "thermal-boiling" | "measurement-density";

export type ConceptLabKey = "sound-medium" | "sound-noise" | "sound-echo" | "sound-campus" | "sound-auditorium" | "sound-microphone" | "mechanics-speed" | "mechanics-friction" | "mechanics-pressure" | "mechanics-buoyancy" | "circuit-ohm" | "circuit-power" | "circuit-magnet" | "thermal-thermometer" | "thermal-melting" | "thermal-evaporation" | "measurement-balance" | "measurement-mass-volume" | "measurement-liquid-density";

interface ScienceFieldMeta { title: string; subtitle: string; icon: LucideIcon; accent: string; book: string; description: string; strands: string[]; }

export interface ScienceModuleMeta {
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

export const fieldMeta: Record<FieldKey, ScienceFieldMeta> = {
  sound: { title: "声音实验场", subtitle: "从振动出发，走向真实的声学工程", icon: Waves, accent: "#68b9e8", book: "苏科版八年级上册 · 第一章 声现象", description: "从振动、传播、声音特性和超声波出发，把课本原理带入校园噪声治理、礼堂声学设计和真实麦克风测量。", strands: ["产生与传播", "响度·音调·音色", "噪声控制", "超声与次声", "校园与建筑声学"] },
  mechanics: { title: "力学工坊", subtitle: "从运动和受力，走向机械与浮沉", icon: Compass, accent: "#e5b24d", book: "八上第五章 · 八下第七至九章 · 九上第十一章", description: "把速度、力、摩擦、简单机械、压强和浮力放到同一条力学探索路线中，先观察变化，再寻找定量关系。", strands: ["运动与速度", "力与平衡", "简单机械", "压强与浮力"] },
  circuit: { title: "电学连接室", subtitle: "从电流路径，走向电功率和电磁转换", icon: CircuitBoard, accent: "#ef765b", book: "苏科版九上第十三、十四章 · 九下第十五、十六章", description: "从连接基本电路开始，逐步研究电流、电压、电阻、电功率以及电流的磁效应。", strands: ["电路连接", "电流·电压·电阻", "电功与电功率", "电与磁"] },
  thermal: { title: "热学观察站", subtitle: "让看不见的热过程留下曲线", icon: Flame, accent: "#e99048", book: "苏科版八年级上册 · 第四章 物态变化", description: "以温度测量为基础，通过汽化、液化、熔化、凝固和蒸发等实验建立物态变化图景。", strands: ["温度测量", "汽化与液化", "熔化与凝固", "生活中的物态变化"] },
  measurement: { title: "物质测量室", subtitle: "从质量和体积，认识物质的差异", icon: Beaker, accent: "#9f89dd", book: "苏科版八年级下册 · 第六章 物质的物理属性", description: "先学会正确测量质量和体积，再通过质量与体积的比认识密度，并用密度解决材料鉴别问题。", strands: ["天平测质量", "质量与体积", "固体密度", "液体密度"] }
};

export const inquiryFormulas: Record<CoreLabKey | ConceptLabKey, string> = {
  "sound-medium": "振动 → 介质 → 接收", "sound-features": "响度 ↔ A · 音调 ↔ f", "sound-noise": "声源 → 传播 → 人耳", "sound-echo": "s = vt / 2", "sound-campus": "L接收 = L声源 − ΣΔL", "sound-auditorium": "T₆₀ ≈ 0.161V / A", "sound-microphone": "真实声音 → 波形 · 频谱 · 响度",
  "mechanics-speed": "v = s / t", "mechanics-friction": "匀速时 f = F拉", "mechanics-lever": "F₁l₁ = F₂l₂", "mechanics-pressure": "p = F / S", "mechanics-buoyancy": "F浮 = G − F′",
  "circuit-basic": "闭合回路 → 电流", "circuit-ohm": "I = U / R", "circuit-power": "P = UI；W = Pt", "circuit-magnet": "I↑ / N↑ → 磁性↑",
  "thermal-thermometer": "量程 · 分度值 · 平视", "thermal-boiling": "吸热 · T ≈ 沸点", "thermal-melting": "晶体熔化 · T ≈ 熔点", "thermal-evaporation": "T↑ / S↑ / v风↑",
  "measurement-balance": "m物 = m砝 + m游码", "measurement-mass-volume": "同种物质 m ∝ V", "measurement-density": "ρ = m / (V₂−V₁)", "measurement-liquid-density": "ρ = (m总−m杯) / V"
};

export const scienceModules: Record<FieldKey, ScienceModuleMeta[]> = {
  sound: [
    { key: "sound-medium", shortTitle: "产生与传播", title: "声音的产生与传播", chapter: "八上·第一章 第一节", note: "振动、介质、真空与声波", question: "抽走空气以后，闹钟为什么会越来越难听见？", icon: Waves, guide: ["观察声源振动，并判断声音传播是否需要介质。", "改变空气保留程度和接收距离，比较接收到的声音强弱。", "声源仍在振动，但介质越少或距离越远，接收效果越弱。"], life: [{ title: "土电话", text: "棉线的振动把声音传到另一只纸杯，说明固体能够传声。" }, { title: "月球表面", text: "月球几乎没有空气，宇航员不能像在教室里一样直接交谈。" }, { title: "建筑回声", text: "声波遇到墙面会反射，礼堂设计需要控制回声。" }] },
    { key: "sound-features", shortTitle: "声音三要素", title: "响度、音调和音色", chapter: "八上·第一章 第二节", note: "振幅、频率与波形", question: "波形变高和变密，分别改变了声音的什么特性？", icon: Gauge, guide: ["用波形比较声音的响度和音调。", "一次只改变频率或振幅，观察波形疏密和高度。", "振幅主要影响响度，频率主要影响音调；不同声源还有不同音色。"], life: [{ title: "调节音量", text: "音箱音量变大时，振动幅度和接收到的响度增大。" }, { title: "乐器定音", text: "改变琴弦长度和松紧程度，可以改变振动频率与音调。" }, { title: "辨认说话者", text: "即使音调和响度相近，人们也能利用音色辨认不同声源。" }] },
    { key: "sound-noise", shortTitle: "噪声控制", title: "噪声的产生与控制", chapter: "八上·第一章 第三节", note: "声源、传播途中与人耳", question: "同一种噪声，可以在哪三个环节被减弱？", icon: Compass, guide: ["把噪声看成一种会传播的声音，而不是只给它贴上“难听”的标签。", "改变声源处声级和等效衰减量，观察接收位置的声级变化。", "控制噪声可以从声源、传播途中和接收端三个环节入手。"], life: [{ title: "汽车消声器", text: "在声源处减弱发动机排气噪声。" }, { title: "道路隔音屏", text: "在传播途中阻挡和吸收部分声能。" }, { title: "防护耳罩", text: "在接收端减少进入人耳的声音。" }] },
    { key: "sound-echo", shortTitle: "超声与次声", title: "听不见的声音与回声测距", chapter: "八上·第一章 第四节", note: "超声定位与次声监测", question: "发出超声后隔一段时间收到回声，距离怎样算？", icon: Waves, guide: ["利用声波发出后返回的时间估算目标距离。", "改变回声往返时间和介质声速，比较计算结果。", "声波走的是往返路程，所以目标距离应是总路程的一半。"], life: [{ title: "倒车雷达", text: "发出超声波并接收回声，估计车辆与障碍物的距离。" }, { title: "医学超声", text: "利用人体组织对超声波的反射获得内部结构信息。" }, { title: "地震监测", text: "某些自然现象会产生次声，可用于远距离监测。" }] },
    { key: "sound-campus", shortTitle: "校园噪声治理", title: "校园声环境工程挑战", chapter: "八上·第一章 工程拓展", note: "声源—传播—接收端联合治理", question: "如何在有限预算内，让教室或图书馆安静下来？", icon: Shield, guide: ["从教室、食堂、临街操场和图书馆中选择待治理场景。", "在声源、传播路径和接收端配置措施，同时查看降噪效果与成本。", "真实噪声治理往往需要多环节组合，不是只把人耳“堵住”。"], life: [{ title: "校园规划", text: "将阅览区与操场、道路等声源拉开距离。" }, { title: "教室改造", text: "门窗密封与吸声材料可以减少外界声和反射声。" }, { title: "健康管理", text: "用声级巡检图找出长期暴露风险较高的区域。" }] },
    { key: "sound-auditorium", shortTitle: "礼堂建筑声学", title: "为每个座位设计清晰的声音", chapter: "八上·第一章 项目学习", note: "混响时间、吸声材料与上座率", question: "礼堂里声音越响、持续越久，语音就越清楚吗？", icon: RadioTower, guide: ["用测试脉冲观察礼堂中的反射声如何逐渐衰减。", "改变空间体积、上座人数和内衬材料，比较估算混响时间。", "语音厅需要适度混响：过长会模糊，过短又可能过于干涩。"], life: [{ title: "学校礼堂", text: "吸声顶棚、窗帘与扩散表面共同提高语音清晰度。" }, { title: "录音棚", text: "通过吸声和隔声控制不必要的反射与外界干扰。" }, { title: "智能会议室", text: "拾音、扩声和建筑声学需要一起设计。" }] },
    { key: "sound-microphone", shortTitle: "真实声音采集", title: "把你的声音变成可见数据", chapter: "八上·第一章 数字实验", note: "本机麦克风、时间波形与频谱", question: "说话、拍手和乐器声，在波形上有什么不同？", icon: Mic2, guide: ["允许浏览器使用本机麦克风，实时观察声音的波形、相对强度和主频线索。", "对比说话、拍手和稳定乐音，冻结多组读数作为证据。", "所有分析都在当前设备中完成，平台不录音、不上传原始音频。"], life: [{ title: "声纹与语音识别", text: "数字系统会从波形和频谱中提取可区分的特征。" }, { title: "智能降噪", text: "耳机与会议软件会识别噪声成分并进行抑制。" }, { title: "声学监测", text: "城市与工厂可持续监测声环境变化。" }] }
  ],
  mechanics: [
    { key: "mechanics-speed", shortTitle: "运动与速度", title: "路程、时间与速度", chapter: "八上·第五章", note: "固定路程，比较轨道高度与区间速度", question: "光电门间路程不变，提高轨道高度会怎样改变通过时间和平均速度？", icon: Gauge, guide: ["安装起终点光电门，让小车从静止释放，用区间路程除以计时求平均速度。", "保存基准后保持光电门间路程不变，只改变轨道高度至少0.1 m；重新装门、小车就位后释放并保存。时间由光电门测得，不能直接设定。", "比较同一路程下两组高度、时间和平均速度；只改变路程不计入高度对照，平均速度也不表示每一时刻都同样快。"], life: [{ title: "区间测速", text: "用一段路程和通过这段路程的时间计算平均速度。" }, { title: "运动手表", text: "根据定位距离和时间估算配速与速度。" }, { title: "列车时刻表", text: "路程和运行时间可以帮助比较不同车次的平均速度。" }] },
    { key: "mechanics-friction", shortTitle: "摩擦力", title: "影响滑动摩擦力的因素", chapter: "八下·第七章 第三节", note: "压力与接触面粗糙程度", question: "让木块更重或让桌面更粗糙，拉力会怎样变化？", icon: Compass, guide: ["研究物体相对滑动时受到的摩擦力。", "分别改变压力和粗糙程度，保持匀速时读取拉力。", "压力越大、接触面越粗糙，滑动摩擦力通常越大。"], life: [{ title: "鞋底花纹", text: "增加接触面的粗糙程度，帮助人在湿滑路面行走。" }, { title: "自行车刹车", text: "增大刹车片压力，从而增大摩擦。" }, { title: "机器润滑", text: "加入润滑剂可以减小不必要的摩擦和磨损。" }] },
    { key: "mechanics-lever", shortTitle: "杠杆", title: "探究杠杆的平衡条件", chapter: "九上·第十一章 第一节", note: "动力、阻力与力臂", question: "较小的力为什么也能撬动较重的物体？", icon: Scale, guide: ["在支点两侧比较力与力臂共同产生的转动效果。", "改变钩码重力或悬挂位置，让杠杆重新回到水平。", "杠杆平衡时，动力×动力臂等于阻力×阻力臂。"], life: [{ title: "开瓶器", text: "增大动力臂，用较小的力撬起瓶盖。" }, { title: "天平", text: "等臂杠杆通过两侧平衡比较质量。" }, { title: "剪刀", text: "支点和刀刃位置不同，会形成不同用途的杠杆。" }] },
    { key: "mechanics-pressure", shortTitle: "压强", title: "压力作用效果与压强", chapter: "八下·第九章 第一节", note: "压力与受力面积", question: "同样的力，为什么作用面积越小效果越明显？", icon: Gauge, guide: ["用单位面积上受到的压力描述压力作用效果。", "改变压力和受力面积，比较固体接触面上的压强读数。", "压力越大或受力面积越小，压强越大。"], life: [{ title: "书包宽背带", text: "增大受力面积，减小肩部受到的压强。" }, { title: "履带车辆", text: "用宽履带增大接触面积，减小对松软地面的压强。" }, { title: "针尖", text: "针尖面积很小，在较小压力下也能产生较大压强。" }] },
    { key: "mechanics-buoyancy", shortTitle: "称重法测浮力", title: "称重法测浮力与液体密度", chapter: "八下·第九章 第四、五节", note: "空气中与液中的示数、液体密度", question: "同一物体完全浸没在不同液体中，测力计示数和浮力怎样变化？", icon: Beaker, guide: ["用静止悬挂物体在空气中和液体中的测力计示数差测浮力。", "校零后记录空气中G，完全浸没、静止且不碰底时锁存F′；完成碰底误差演练并保存，再保持同一物体只更换液体重复测量。", "正式读数满足F浮=G−F′；同一物体完全浸没时，液体密度越大浮力越大。碰底支持力会使示数偏小，不能把碰底时的G−F′都当作浮力。"], life: [{ title: "轮船", text: "把船体做成空心可降低平均密度，使它漂浮在水面。" }, { title: "潜水艇", text: "通过改变水舱中的水量改变自身平均密度。" }, { title: "盐水选种", text: "不同饱满程度的种子在适当浓度盐水中呈现不同浮沉状态。" }] }
  ],
  circuit: [
    { key: "circuit-basic", shortTitle: "串联与并联", title: "连接基本电路", chapter: "九上·第十三章", note: "电流路径、开关与用电器", question: "电流只有一条路和有多条路时，用电器怎样工作？", icon: CircuitBoard, guide: ["识别电源、开关、导线和用电器构成的完整电路。", "先断开开关连接，再切换串联和并联比较电流路径。", "串联只有一条电流路径；并联各支路可以相对独立工作。"], life: [{ title: "节日小彩灯", text: "一些灯串采用串联连接，一个位置断路可能影响整串。" }, { title: "家庭用电", text: "家庭用电器通常并联，便于独立开关。" }, { title: "冰箱门控灯", text: "不同开关控制不同支路，实现自动工作。" }] },
    { key: "circuit-ohm", shortTitle: "欧姆定律", title: "电流与电压、电阻的关系", chapter: "九上·第十四章", note: "控制变量与 I=U/R", question: "保持电阻不变增大电压，电流怎样变化？", icon: Gauge, guide: ["研究通过导体的电流与两端电压、电阻的定量关系。", "研究电流与电压时保持导体和温度不变；研究电流与电阻时保持电压不变。", "在导体电阻一定时，电流与两端电压成正比；在电压一定时，电流与电阻成反比。"], life: [{ title: "调光电路", text: "改变电路中的电阻可以调节灯泡电流和亮度。" }, { title: "限流电阻", text: "给发光二极管串联适当电阻，防止电流过大。" }, { title: "电压表电流表", text: "测量时要选择合适量程并按正确方式接入电路。" }] },
    { key: "circuit-power", shortTitle: "电功率", title: "测量用电器的电功率", chapter: "九下·第十五章", note: "同一用电器的功率与电能双对照", question: "同一用电器改变电压或工作时间，实际功率和消耗电能分别怎样变化？", icon: BatteryCharging, guide: ["断开开关连接串联电流表、并联电压表和电能计时器，再按铭牌选择安全电压。", "固定同一用电器：先保持时间不变，改变安全电压至少1.5 V比较功率；再保持电压不变，改变时间至少10 s比较电能。每轮计时结束保存完成快照；电流是读数，不能独立设置。", "完成两类对照后，选择7.5 V只观察保护锁定，再恢复6 V或更低。只换用电器不计入核心对照；断电后的实时零读数不会替代已保存的U、I、P、t、W。"], life: [{ title: "用电器铭牌", text: "额定电压和额定功率说明正常工作条件。" }, { title: "节能灯", text: "比较相同亮度下的功率，可以判断节能效果。" }, { title: "电能表", text: "家庭电能表记录一段时间内消耗的电能。" }] },
    { key: "circuit-magnet", shortTitle: "电流的磁效应", title: "通电螺线管与电磁铁", chapter: "九下·第十六章", note: "线圈匝数、电流与磁性", question: "怎样让自制电磁铁吸起更多铁钉？", icon: Compass, guide: ["观察通电线圈周围产生的磁场。", "改变线圈匝数和电流，比较磁性强弱指标。", "在其他条件相同时，匝数更多或电流更大，电磁铁通常更强。"], life: [{ title: "电磁起重机", text: "通电吸起钢铁，断电后便于放下。" }, { title: "电铃", text: "电磁铁反复吸引衔铁，使铃锤敲击铃盖。" }, { title: "继电器", text: "用较小电流控制另一个工作电路的通断。" }] }
  ],
  thermal: [
    { key: "thermal-thermometer", shortTitle: "温度测量", title: "温度计的使用与读数", chapter: "八上·第四章 第一节", note: "量程、分度值与视线", question: "分度值不同，温度读数会有多大差别？", icon: Gauge, guide: ["认识温度计量程、分度值和液柱位置。", "改变实际温度和分度值，比较可读出的温度。", "分度值越小读数越细致；读数时视线应与液柱末端相平。"], life: [{ title: "体温计", text: "量程适合人体温度，分度值较小。" }, { title: "气温观测", text: "百叶箱减少阳光直射等因素对测温的影响。" }, { title: "厨房温度计", text: "不同测温任务需要不同量程和结构的温度计。" }] },
    { key: "thermal-boiling", shortTitle: "沸腾", title: "观察水的沸腾", chapter: "八上·第四章 第二节", note: "升温段、沸腾平台与气压", question: "水沸腾时温度怎样变化，不同气压下的沸点是否相同？", icon: Flame, guide: ["持续加热并记录升温段和沸腾平台，再比较气压对沸点的影响。", "记录升温点和相隔至少10秒的两个平台点并保存曲线；重置后保持水量、功率不变，选择气压至少相差20 kPa的环境，重新加水、放温度计并完成第二条曲线。", "气压稳定时水沸腾仍吸热，温度保持在对应沸点附近；气压越高沸点越高，不把升温快慢当作沸点变化。"], life: [{ title: "高压锅", text: "提高锅内气压可提高水的沸点，使食物更快熟。" }, { title: "高原煮食", text: "高原气压较低，水的沸点降低。" }, { title: "蒸汽液化", text: "壶口白雾是水蒸气遇冷液化形成的小水滴。" }] },
    { key: "thermal-melting", shortTitle: "熔化与凝固", title: "冰的熔化温度曲线", chapter: "八上·第四章 第三节", note: "固态、熔化平台与液态", question: "冰熔化过程中继续吸热，温度怎样变化？", icon: Flame, guide: ["记录冰受热时温度和状态随时间的变化。", "改变加热时间和功率，观察固态、熔化和液态阶段。", "晶体熔化时继续吸热，但在熔点附近温度暂时保持不变。"], life: [{ title: "冰雪融化", text: "气温达到熔点并继续吸热后，冰逐渐变成水。" }, { title: "铸造金属", text: "金属熔化后倒入模具，凝固形成需要的形状。" }, { title: "道路撒盐", text: "盐会改变冰雪的熔化条件，帮助道路除冰。" }] },
    { key: "thermal-evaporation", shortTitle: "蒸发", title: "影响蒸发快慢的因素", chapter: "八上·第四章 第二节", note: "温度、表面积与空气流动", question: "湿衣服在什么条件下干得更快？", icon: Waves, guide: ["用统一的50 g水样定时称量，在固定环境教学模型中研究表面汽化。", "保存基准后，温度、液面面积、空气流动每次只改变一个，其余两个不变，补齐三因素对照；每轮保存初末质量、失重和时长，同时间比失重，不同时长先换算平均g/min。", "其他条件相同时，温度升高、液面面积增大或空气流动加快，蒸发通常更快；结论需有三项单因素对照支持，仿真称量不能替代真实实验。"], life: [{ title: "晾晒衣服", text: "展开衣服、放在通风处可加快水分蒸发。" }, { title: "吹风机", text: "提高温度并加快空气流动，使头发更快变干。" }, { title: "蒸发降温", text: "液体蒸发会吸热，汗液蒸发能帮助身体降温。" }] }
  ],
  measurement: [
    { key: "measurement-balance", shortTitle: "天平测质量", title: "用托盘天平测量质量", chapter: "八下·第六章 第一节", note: "调平、砝码与游码", question: "怎样组合砝码和游码，让天平重新平衡？", icon: Scale, guide: ["用托盘天平比较待测物与砝码的质量。", "先调平，再由大到小增减砝码，最后移动游码。", "平衡时物体质量等于砝码总质量与游码示数之和。"], life: [{ title: "电子秤", text: "市场电子秤能直接显示质量，有些还能计算价格。" }, { title: "杆秤", text: "传统杆秤利用杠杆平衡比较物体质量。" }, { title: "累积测量", text: "测多个回形针的总质量再除以数量，可测很小的单个质量。" }] },
    { key: "measurement-mass-volume", shortTitle: "质量与体积", title: "探究质量与体积的关系", chapter: "八下·第六章 第二节", note: "同种物质的比例关系", question: "同种材料做成大小不同的物块，质量怎样变化？", icon: Beaker, guide: ["比较同种物质不同体积样品的质量。", "改变样品数量和单块体积，记录总体积与总质量。", "同种物质的质量与体积通常成正比，二者比值保持不变。"], life: [{ title: "材料估重", text: "已知材料密度和体积，可以估算大型构件质量。" }, { title: "商品规格", text: "同种饮料容量增大时，内容物质量也近似按比例增加。" }, { title: "质量—体积图像", text: "不同材料图线斜率不同，可反映密度差异。" }] },
    { key: "measurement-density", shortTitle: "固体密度", title: "测量不规则固体的密度", chapter: "八下·第六章 第三节", note: "天平与排水法", question: "形状不规则的石块，体积怎样测出来？", icon: Beaker, guide: ["分别测出物体质量和体积，再计算密度。", "先用天平称量，再把物体完全浸没，用量筒前后示数之差求体积。", "密度等于质量与体积之比，读量筒时要平视液面。"], life: [{ title: "矿石鉴别", text: "测得样品密度并与密度表比较，可初步判断材料。" }, { title: "珠宝检测", text: "密度是鉴别材料的重要依据之一，但通常还需结合其他方法。" }, { title: "密度计", text: "漂浮式密度计根据浮沉位置直接读取液体密度。" }] },
    { key: "measurement-liquid-density", shortTitle: "液体密度", title: "测量液体的密度", chapter: "八下·第六章 第三节", note: "容器差量法与量筒", question: "怎样把烧杯本身的质量从测量结果中去掉？", icon: Beaker, guide: ["用容器装液体，通过质量差得到液体质量。", "改变液体质量和体积，计算并比较密度。", "液体质量应扣除空容器质量，体积应读取量筒液面。"], life: [{ title: "酒精检测", text: "一定浓度的医用酒精有相应密度，可辅助判断样品是否合格。" }, { title: "牛奶检测", text: "密度测量可作为食品质量检查的一项参考。" }, { title: "电池电解液", text: "测量电解液密度可以帮助判断某些电池的工作状态。" }] }
  ]
};

export function isField(value: string | undefined): value is FieldKey { return Boolean(value && value in fieldMeta); }
