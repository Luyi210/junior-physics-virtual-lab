import { ArrowRight, Eye, FlaskConical, HelpCircle, Lightbulb, PencilRuler, RadioTower } from "lucide-react";

export interface PhysicsInquiryProfile {
  question: string;
  variable: string;
  evidence: string;
  law: string;
  application: string;
  formula: string;
}

interface PhysicsInquiryRibbonProps extends PhysicsInquiryProfile {
  title: string;
}

const opticsProfiles: Record<string, PhysicsInquiryProfile> = {
  dispersion: { question: "白光通过三棱镜后为什么会展开？", variable: "光源颜色、棱镜角度、光屏距离", evidence: "光屏上色带的颜色、顺序和宽度", law: "不同色光的偏折程度不同", application: "彩虹与光谱分析", formula: "n = n(λ)" },
  straight: { question: "小孔为什么能在光屏上形成倒立的像？", variable: "物体、小孔和光屏的位置", evidence: "像的方向、大小和清晰程度", law: "同种均匀介质中光沿直线传播", application: "日食、月食与无影灯", formula: "A → O → A′" },
  reflection: { question: "反射光线的方向由什么决定？", variable: "入射角与镜面方向", evidence: "入射线、法线和反射线的夹角", law: "反射角等于入射角", application: "平面镜与光刻反射镜", formula: "∠i = ∠r" },
  refraction: { question: "光跨过两种介质时为什么会偏折？", variable: "入射角与两侧介质", evidence: "折射光线相对法线的方向", law: "斜射时传播速度改变，通常伴随方向改变；垂直入射不偏折", application: "透镜、海市蜃楼与光纤", formula: "n₁sin i = n₂sin r" },
  "color-mix": { question: "红、绿、蓝色光怎样混合出新的颜色？", variable: "三个通道的亮度", evidence: "重叠区域的颜色与亮度", law: "色光遵循加法混色", application: "Micro RGB 显示", formula: "等强 R + G + B ≈ W" },
  celestial: { question: "日食和月食为什么只在特定排列下发生？", variable: "太阳、地球和月球的位置", evidence: "本影、半影和观察者位置", law: "直线传播形成空间阴影", application: "天象预报与黑洞观测", formula: "本影 / 半影" },
  "plane-mirror": { question: "镜中的像究竟位于哪里？", variable: "物体到镜面的距离", evidence: "像的大小、方向和对称位置", law: "平面镜成正立等大的虚像", application: "AR 显示与无底洞装置", formula: "d像 = d物" },
  "curved-mirror": { question: "镜面弯曲以后，反射光会怎样变化？", variable: "镜面类型与物体位置", evidence: "反射光线会聚或发散的位置", law: "凹面镜使近轴平行光会聚，凸面镜使近轴平行光发散并扩大视野", application: "车灯、望远镜与后视镜", formula: "近轴平行光 ↔ F" },
  "invisible-light": { question: "看不见的红外线和紫外线怎样被发现？", variable: "波段、距离与防护材料", evidence: "传感器示数或材料荧光", law: "不可见光仍能传递能量和信息", application: "热成像、遥控与紫外检测", formula: "λIR > λ可见 > λUV" },
  magnifier: { question: "为什么物体靠近凸透镜时会被放大？", variable: "物距与焦距", evidence: "像的正倒、大小与虚实", law: "物体位于焦点内形成放大虚像", application: "放大镜与目镜", formula: "u < f" },
  bench: { question: "怎样让凸透镜在光屏上得到清晰的像？", variable: "物距、焦距和光屏位置", evidence: "光屏上像的清晰度与大小", law: "物距和像距共同满足成像关系", application: "相机、投影与光学测量", formula: "1/f = 1/u + 1/v" },
  camera: { question: "照相机怎样把远近景物都拍清楚？", variable: "景物距离与镜头焦距", evidence: "像面与感光器是否重合", law: "感光器承接倒立缩小的实像", application: "自动对焦与手机影像", formula: "u > 2f" },
  eye: { question: "视网膜不移动，眼睛怎样看清远近物体？", variable: "目标距离与晶状体焦距", evidence: "像点是否落在视网膜", law: "晶状体通过改变会聚能力调焦", application: "人眼调节与视觉疲劳", formula: "像面 = 视网膜" },
  correction: { question: "近视和远视应当怎样改变入眼光路？", variable: "眼睛状态与矫正镜片", evidence: "矫正后像点的位置", law: "凹透镜发散，凸透镜会聚", application: "眼镜与视力检查", formula: "近视→凹・远视→凸" },
  instruments: { question: "两块透镜怎样把观察尺度推向远处或微小处？", variable: "物镜、目镜及其焦距", evidence: "中间像和最终观察视角", law: "物镜先成像，目镜再放大视角", application: "望远镜与显微镜", formula: "物镜 → 中间像 → 目镜" }
};

export function getOpticsInquiryProfile(module: string) {
  return opticsProfiles[module];
}

export function PhysicsInquiryRibbon({ title, question, variable, evidence, law, application, formula }: PhysicsInquiryRibbonProps) {
  const steps = [
    { number: "01", label: "提出问题", value: question, icon: HelpCircle },
    { number: "02", label: "改变条件", value: variable, icon: PencilRuler },
    { number: "03", label: "操作实验", value: `在“${title}”中一次改变一个主要条件`, icon: FlaskConical },
    { number: "04", label: "寻找证据", value: evidence, icon: Eye },
    { number: "05", label: "形成解释", value: law, icon: Lightbulb },
    { number: "06", label: "迁移应用", value: application, icon: RadioTower }
  ];

  return <section className="physics-inquiry-ribbon" aria-label={`${title}物理探究链`}>
    <header>
      <span>PHYSICS INQUIRY / 物理探究链</span>
      <strong>不是先看答案，而是让证据一步步出现。</strong>
      <code>{formula}</code>
    </header>
    <div>{steps.map((step, index) => { const Icon = step.icon; return <article key={step.number}><b>{step.number}</b><i><Icon size={17} /></i><span><small>{step.label}</small><strong>{step.value}</strong></span>{index < steps.length - 1 && <ArrowRight size={13} />}</article>; })}</div>
  </section>;
}
