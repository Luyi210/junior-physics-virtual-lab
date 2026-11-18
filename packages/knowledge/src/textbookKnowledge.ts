import type { PhysicsGraphDomain } from "./physicsKnowledgeGraph";

export type TextbookVolume = "八上" | "八下" | "九上" | "九下";
export type ChapterIllustrationKind = "sound" | "light" | "lens" | "thermal" | "motion" | "density" | "friction" | "pressure" | "lever" | "circuit" | "ohm" | "power" | "magnet";

export interface TextbookChapter {
  id: string;
  volume: TextbookVolume;
  chapterNumber: string;
  title: string;
  locator: string;
  sectionHint: string;
  domain: PhysicsGraphDomain;
  accent: string;
  illustration: ChapterIllustrationKind;
  summary: string;
  law: string;
  nodeIds: string[];
}

/**
 * 苏科版（2024）章节映射。这里只收录平台已有实验对应的章节，
 * 而不是把没有虚拟实验支撑的教材目录伪装成已完成内容。
 */
export const textbookChapters: TextbookChapter[] = [
  {
    id: "sound-phenomena",
    volume: "八上",
    chapterNumber: "01",
    title: "声现象",
    locator: "苏科版（2024）八年级上册 · 第一章",
    sectionHint: "声音是什么 · 声音的特性 · 噪声控制 · 人耳听不到的声音",
    domain: "sound",
    accent: "#65c7ef",
    illustration: "sound",
    summary: "从发声体的振动出发，沿着介质传播、声音特性和现代声学应用建立完整认识。",
    law: "振动产生声音 · 真空不能传声 · s = vt / 2",
    nodeIds: ["sound-medium", "sound-features", "sound-noise", "sound-echo"]
  },
  {
    id: "light-phenomena",
    volume: "八上",
    chapterNumber: "02",
    title: "光现象",
    locator: "苏科版（2024）八年级上册 · 第二章",
    sectionHint: "光的色彩 · 直线传播 · 平面镜 · 光的反射",
    domain: "light",
    accent: "#59e5cf",
    illustration: "light",
    summary: "用光线模型解释色彩、影区、平面镜成像和反射，让看得见的现象变成可追踪的路径。",
    law: "光沿直线传播 · ∠反射 = ∠入射 · 像物关于镜面对称",
    nodeIds: ["color-mix", "straight", "celestial", "plane-mirror", "reflection", "curved-mirror"]
  },
  {
    id: "refraction-lens",
    volume: "八上",
    chapterNumber: "03",
    title: "光的折射 透镜",
    locator: "苏科版（2024）八年级上册 · 第三章",
    sectionHint: "光的折射 · 透镜 · 凸透镜成像 · 透镜的应用 · 人眼看不见的光",
    domain: "light",
    accent: "#7ea8ff",
    illustration: "lens",
    summary: "把界面偏折、透镜会聚和两级成像连起来，理解相机、人眼、眼镜与光学仪器。",
    law: "1 / f = 1 / u + 1 / v · 实像可由光屏承接",
    nodeIds: ["dispersion", "refraction", "magnifier", "bench", "camera", "eye", "correction", "instruments", "invisible-light"]
  },
  {
    id: "state-change",
    volume: "八上",
    chapterNumber: "04",
    title: "物态变化",
    locator: "苏科版（2024）八年级上册 · 第四章",
    sectionHint: "温度测量 · 汽化和液化 · 熔化和凝固 · 水循环",
    domain: "thermal",
    accent: "#ff9e70",
    illustration: "thermal",
    summary: "同时观察温度和物质状态，读懂沸腾、熔化与蒸发过程中的能量变化。",
    law: "物态变化伴随吸放热 · 晶体熔化和沸腾存在温度平台",
    nodeIds: ["thermal-thermometer", "thermal-boiling", "thermal-melting", "thermal-evaporation"]
  },
  {
    id: "motion",
    volume: "八上",
    chapterNumber: "05",
    title: "物体的运动",
    locator: "苏科版（2024）八年级上册 · 第五章",
    sectionHint: "长度与时间 · 速度 · 直线运动 · 运动的相对性",
    domain: "mechanics",
    accent: "#f2bd61",
    illustration: "motion",
    summary: "用统一单位和比值描述运动快慢，并从路程—时间证据中识别运动状态。",
    law: "v = s / t · 参照物不同，运动描述可能不同",
    nodeIds: ["mechanics-speed"]
  },
  {
    id: "physical-properties",
    volume: "八下",
    chapterNumber: "06",
    title: "物质的物理属性",
    locator: "苏科版（2024）八年级下册 · 第六章",
    sectionHint: "质量及其测量 · 密度 · 密度知识的应用",
    domain: "measurement",
    accent: "#b99aff",
    illustration: "density",
    summary: "从正确测量质量和体积开始，用密度辨别物质，并把测量误差纳入实验判断。",
    law: "ρ = m / V · 同种物质的质量与体积成正比",
    nodeIds: ["measurement-balance", "measurement-mass-volume", "measurement-density", "measurement-liquid-density"]
  },
  {
    id: "force",
    volume: "八下",
    chapterNumber: "07",
    title: "力",
    locator: "苏科版（2024）八年级下册 · 第七章",
    sectionHint: "力与弹力 · 重力 · 摩擦力 · 力的相互作用",
    domain: "mechanics",
    accent: "#f1b863",
    illustration: "friction",
    summary: "从运动状态和接触面证据判断力，研究压力与粗糙程度怎样改变滑动摩擦。",
    law: "匀速直线运动时，拉力与滑动摩擦力平衡",
    nodeIds: ["mechanics-friction"]
  },
  {
    id: "pressure-buoyancy",
    volume: "八下",
    chapterNumber: "09",
    title: "压强和浮力",
    locator: "苏科版（2024）八年级下册 · 第九章",
    sectionHint: "压强 · 液体压强 · 气体压强 · 浮力 · 物体的浮与沉",
    domain: "mechanics",
    accent: "#58c5d9",
    illustration: "pressure",
    summary: "从单位面积受力过渡到流体压强，再比较浮力与重力解释物体的浮沉状态。",
    law: "p = F / S · 浮沉由浮力与重力的关系决定",
    nodeIds: ["mechanics-pressure", "mechanics-buoyancy"]
  },
  {
    id: "simple-machines",
    volume: "九上",
    chapterNumber: "11",
    title: "简单机械和功",
    locator: "苏科版（2024）九年级上册 · 第十一章",
    sectionHint: "杠杆 · 滑轮 · 功 · 功率 · 机械效率",
    domain: "mechanics",
    accent: "#f2bf5e",
    illustration: "lever",
    summary: "用力与力臂的乘积比较转动效果，理解机械省力时为何通常要付出距离。",
    law: "F₁l₁ = F₂l₂ · 使用机械不能省功",
    nodeIds: ["mechanics-lever"]
  },
  {
    id: "simple-circuit",
    volume: "九上",
    chapterNumber: "13",
    title: "简单电路",
    locator: "苏科版（2024）九年级上册 · 第十三章",
    sectionHint: "电路 · 电路连接方式 · 电流 · 电压 · 串并联特点",
    domain: "circuit",
    accent: "#ff796d",
    illustration: "circuit",
    summary: "沿闭合路径追踪电流，通过逐个断开元件辨认串联和并联的结构差异。",
    law: "串联电流处处相等 · 并联各支路两端电压相等",
    nodeIds: ["circuit-basic"]
  },
  {
    id: "ohms-law",
    volume: "九上",
    chapterNumber: "14",
    title: "欧姆定律",
    locator: "苏科版（2024）九年级上册 · 第十四章",
    sectionHint: "电阻 · 变阻器 · 欧姆定律 · 欧姆定律的应用",
    domain: "circuit",
    accent: "#ff8f75",
    illustration: "ohm",
    summary: "以控制变量实验建立电流、电压和电阻之间的定量关系，再用图像检查规律。",
    law: "I = U / R · 改变一个量时保持其他条件明确",
    nodeIds: ["circuit-ohm"]
  },
  {
    id: "electric-power",
    volume: "九下",
    chapterNumber: "15",
    title: "电功和电热",
    locator: "苏科版（2024）九年级下册 · 第十五章",
    sectionHint: "电功 · 电功率 · 电流的热效应 · 安全用电",
    domain: "circuit",
    accent: "#ffbd68",
    illustration: "power",
    summary: "从铭牌和仪表示数读出用电器做功快慢，联系时间计算消耗的电能。",
    law: "P = UI · W = Pt · 电功率表示电流做功的快慢",
    nodeIds: ["circuit-power"]
  },
  {
    id: "electric-magnetism",
    volume: "九下",
    chapterNumber: "16",
    title: "电和磁",
    locator: "苏科版（2024）九年级下册 · 第十六章",
    sectionHint: "磁体与磁场 · 电流的磁场 · 电动机 · 电磁感应",
    domain: "circuit",
    accent: "#af8cff",
    illustration: "magnet",
    summary: "把电流周围的磁场变成可观察的场线，比较电流、匝数和铁芯对电磁铁的影响。",
    law: "电流产生磁场 · 电流越大、匝数越多，电磁铁通常越强",
    nodeIds: ["circuit-magnet"]
  }
];
