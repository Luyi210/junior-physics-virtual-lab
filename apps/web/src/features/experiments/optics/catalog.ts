import { type LucideIcon, Sparkles, WandSparkles, Sun, Repeat2, Waves, Telescope, Eye, ScanLine, Search, Focus, Camera, Glasses } from "lucide-react";

export type ExploreMode = "overview" | "dispersion" | "straight" | "reflection" | "refraction" | "color-mix" | "celestial" | "plane-mirror" | "curved-mirror" | "invisible-light" | "magnifier" | "bench" | "camera" | "eye" | "correction" | "instruments";

interface ExploreModule { key: ExploreMode; title: string; note: string; icon: LucideIcon; }

export const modules: ExploreModule[] = [
  { key: "overview", title: "探索总览", note: "课本知识体系", icon: Sparkles },
  { key: "dispersion", title: "光的色散", note: "三棱镜分解白光", icon: WandSparkles },
  { key: "straight", title: "直线传播", note: "小孔成像", icon: Sun },
  { key: "reflection", title: "光的反射", note: "平面镜与光路", icon: Repeat2 },
  { key: "refraction", title: "光的折射", note: "空气与水", icon: Waves },
  { key: "color-mix", title: "色光混合", note: "红绿蓝三原色", icon: Sun },
  { key: "celestial", title: "日食与月食", note: "天体阴影", icon: Telescope },
  { key: "plane-mirror", title: "平面镜成像", note: "对称的虚像", icon: Eye },
  { key: "curved-mirror", title: "曲面镜成像", note: "凹面镜与凸面镜", icon: Repeat2 },
  { key: "invisible-light", title: "红外与紫外", note: "看不见的光", icon: ScanLine },
  { key: "magnifier", title: "放大镜", note: "近处的虚像", icon: Search },
  { key: "bench", title: "自由光具座", note: "任意调节", icon: Focus },
  { key: "camera", title: "照相机", note: "镜头与对焦", icon: Camera },
  { key: "eye", title: "人的眼睛", note: "晶状体调节", icon: Eye },
  { key: "correction", title: "视力矫正", note: "选择合适镜片", icon: Glasses },
  { key: "instruments", title: "组合透镜", note: "望远镜与显微镜", icon: Telescope }
];

export const opticsIntroCopy: Record<ExploreMode, { eyebrow: string; title: string; description: string; points: string[]; enterLabel: string }> = {
  overview: {
    eyebrow: "OPTICS FIELD / 光现象导览",
    title: "从四种基础光现象，建立完整的初中光学图景。",
    description: "这里不是只有凸透镜，而是按照课本把光的色散、直线传播、反射和折射作为基础，再连接生活应用、透镜成像和现代科技。模块可以自由进入。",
    points: ["基础实验：色散、直线传播、反射与折射", "自然应用：彩虹、日月食、镜面与不可见光", "透镜视觉：放大镜、照相机、眼睛和视力矫正", "所有标准光线都用箭头标明传播方向"],
    enterLabel: "查看光学实验地图"
  },
  dispersion: {
    eyebrow: "BASIC OPTICS 01 / 光的色散",
    title: "让不同颜色的光，在光屏上留下可以比较的证据。",
    description: "打开光源后，白光通过三棱镜会因不同色光折射程度不同而展开。除了白光，还可以换成红、绿、蓝或 RGB 混合光，比较“偏折”和“色散”的区别。",
    points: ["先打开光源，再选择入射光的颜色组成", "调节三棱镜角度，观察光谱位置怎样改变", "移动光屏、改变狭缝宽度，比较光带间距和清晰度", "观察光线箭头与光屏落点，再联系彩虹形成"],
    enterLabel: "开始色散实验"
  },
  straight: {
    eyebrow: "BASIC OPTICS 02 / 直线传播",
    title: "亲手移动光源、小孔和光屏，看像怎样形成。",
    description: "小孔成像不是系统直接给出的图片，而是物体各点发出的光沿直线穿过小孔后，在光屏上形成倒立实像。拖动装置时请同时观察光线方向和像的大小。",
    points: ["打开光源，并拖动可移动的实验元件", "改变孔径，比较亮度与清晰度的变化", "改变物距和屏距，观察像大小怎样变化", "沿箭头追踪上下两条光线，解释像为什么倒立"],
    enterLabel: "开始小孔成像"
  },
  reflection: {
    eyebrow: "BASIC OPTICS 03 / 光的反射",
    title: "先改变入射光，再用法线和角度验证反射定律。",
    description: "实验用入射线、法线和反射线共同描述镜面反射。二维视图适合读角度，三维视图帮助理解三条线位于同一平面；箭头表示光实际传播的方向。",
    points: ["拖动入射方向，不直接背诵反射光线位置", "比较入射角与反射角，注意角度相对法线测量", "切换二维与三维视图理解共面关系", "再联系平面镜、曲面镜和 EUV 超级反射镜"],
    enterLabel: "开始反射实验"
  },
  refraction: {
    eyebrow: "BASIC OPTICS 04 / 光的折射",
    title: "改变介质和入射角，观察光为何在界面处转向。",
    description: "光从一种透明介质斜射入另一种介质时，传播方向通常会改变。实验会同时画出界面、法线、入射线和折射线，帮助区分“靠近法线”和“远离法线”。",
    points: ["改变入射角，观察折射角随之怎样变化", "切换两侧介质，比较折射方向", "二维视图读角度，三维视图观察空间关系", "先掌握普通折射，再了解负折射材料属于拓展科技"],
    enterLabel: "开始折射实验"
  },
  "color-mix": {
    eyebrow: "LIGHT APPLICATION 01 / 色光混合",
    title: "分别调节红、绿、蓝光，观察屏幕颜色怎样合成。",
    description: "色光采用加法混合，与颜料混合的规律不同。实验会把三束光的强度直接映射到屏幕像素，并连接现代显示技术。",
    points: ["先单独打开一种色光", "再叠加第二种色光比较新颜色", "三色同时增强时观察亮度变化", "把结果与 Micro LED 像素联系起来"],
    enterLabel: "开始色光混合"
  },
  celestial: {
    eyebrow: "LIGHT APPLICATION 02 / 天体阴影",
    title: "移动太阳、地球和月球，用直线传播解释日食与月食。",
    description: "日食和月食不是两个孤立结论，它们都由光沿直线传播形成的本影、半影和天体相对位置共同决定。",
    points: ["切换日食与月食模型", "改变天体位置和大小", "辨认本影与半影区域", "用光线边界解释观察范围"],
    enterLabel: "进入天体光影实验"
  },
  "plane-mirror": {
    eyebrow: "LIGHT APPLICATION 03 / 平面镜成像",
    title: "追踪反射光，再用反向延长线确定虚像位置。",
    description: "二维模式便于读出物距和像距，三维模式用于观察眼睛、镜面和光路的空间关系；两种视图共用同一组实验数据。",
    points: ["移动物体比较物距与像距", "左右移动观察者追踪反射点", "放置光屏检验虚像能否承接", "区分真实光线与反向延长线"],
    enterLabel: "开始平面镜实验"
  },
  "curved-mirror": {
    eyebrow: "LIGHT APPLICATION 04 / 曲面镜",
    title: "让物体跨过焦点，比较凹面镜与凸面镜成像。",
    description: "曲面各点仍遵守反射定律，但局部法线方向不同，因此整体光束会聚或发散，形成不同性质的像。",
    points: ["切换凹面镜与凸面镜", "让物体跨过焦点 F", "判断实像、虚像及正倒大小", "用二维和三维视图相互验证"],
    enterLabel: "开始曲面镜实验"
  },
  "invisible-light": {
    eyebrow: "LIGHT APPLICATION 05 / 不可见光",
    title: "看不见不等于不存在，用探测效应寻找红外线和紫外线。",
    description: "实验通过温升、荧光和传感器响应把不可见辐射转化为可观察证据，并区分不同波段的作用与安全边界。",
    points: ["选择红外或紫外波段", "切换合适的探测方法", "改变强度并观察响应", "联系遥控、热成像和消毒应用"],
    enterLabel: "开始不可见光探测"
  },
  magnifier: {
    eyebrow: "LENS & VISION 01 / 放大镜",
    title: "把物体放在焦点内外，判断凸透镜形成什么像。",
    description: "同一组物距、焦距同时驱动二维与三维光路。先找焦点，再判断光线是真正会聚还是只有反向延长线相交。",
    points: ["移动物体跨过焦点 F", "观察像的正倒和大小", "判断像是实像还是虚像", "尝试用光屏验证判断"],
    enterLabel: "开始放大镜实验"
  },
  bench: {
    eyebrow: "LENS & VISION 02 / 自由光具座",
    title: "自由调节物体、透镜和光屏，寻找清晰像的位置。",
    description: "光具座不预设固定答案。一次只改变一个条件，根据透镜公式和实际光路共同判断像的位置与性质。",
    points: ["先固定焦距移动物体", "根据像距移动光屏", "比较焦点内、两倍焦距内外", "记录物距、像距和放大率"],
    enterLabel: "进入自由光具座"
  },
  camera: {
    eyebrow: "LENS & VISION 03 / 照相机",
    title: "让倒立实像准确落在感光器上，理解相机对焦。",
    description: "景物距离改变后，理想像面会移动；相机必须调节镜头状态，让像面重新与固定感光器重合。",
    points: ["改变景物距离制造失焦", "手动调节镜头焦距", "观察像面与感光器误差", "启动自动对焦进行验证"],
    enterLabel: "开始相机对焦"
  },
  eye: {
    eyebrow: "LENS & VISION 04 / 人的眼睛",
    title: "视网膜位置固定，晶状体通过调节把像重新送回去。",
    description: "切换远近目标，比较晶状体所需焦距。清晰视觉的关键不是移动视网膜，而是改变眼球光学系统的会聚能力。",
    points: ["切换远处与近处目标", "调节晶状体焦距", "观察像点和视网膜关系", "比较相机对焦与眼睛调节"],
    enterLabel: "开始眼睛调节实验"
  },
  correction: {
    eyebrow: "LENS & VISION 05 / 视力矫正",
    title: "判断像点落在视网膜哪一侧，再选择正确的矫正镜片。",
    description: "近视和远视需要不同镜片先改变入眼光路。实验不会只显示答案，而是让错误镜片的结果也可被比较。",
    points: ["选择近视或远视眼模型", "观察未矫正像点位置", "分别尝试凹透镜与凸透镜", "以像点回到视网膜作为证据"],
    enterLabel: "开始视力矫正"
  },
  instruments: {
    eyebrow: "LENS & VISION 06 / 组合透镜",
    title: "用物镜和目镜分工协作，理解望远镜与显微镜。",
    description: "两种仪器都由多块透镜组合，但观察目标、物镜成像方式和最终放大视角不同。二维和三维模式共用参数。",
    points: ["切换望远镜与显微镜", "分别调节物镜和目镜", "追踪中间像的形成", "比较两类仪器的观察目标"],
    enterLabel: "进入组合透镜实验"
  }
};

export function isMode(value: string | null): value is ExploreMode {
  return modules.some((module) => module.key === value);
}
