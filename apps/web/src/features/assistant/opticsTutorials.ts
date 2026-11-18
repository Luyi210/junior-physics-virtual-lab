import { buildHarnessTutorialActions } from "@physics-lab/harness";
import type { HarnessEventType, HarnessTutorialAction } from "@physics-lab/harness";

export type GuidedTutorialTarget = "module" | "visual" | "controls" | "explanation" | "application";

export interface GuidedTutorialQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface GuidedTutorialStep {
  id: string;
  eyebrow: string;
  title: string;
  narration: string;
  hint: string;
  target: GuidedTutorialTarget;
  requiresInteraction?: boolean;
  acceptedEvents?: HarnessEventType[];
  question?: GuidedTutorialQuestion;
  actions?: HarnessTutorialAction[];
}

export interface GuidedTutorialProfile {
  title: string;
  summary: string;
  duration: string;
  highlights: string[];
  steps: GuidedTutorialStep[];
}

interface ProfileSource {
  module: string;
  title: string;
  summary: string;
  apparatus: string;
  firstAction: string;
  path: string;
  variable: string;
  evidence: string;
  conclusion: string;
  application: string;
  question: GuidedTutorialQuestion;
}

function makeProfile(source: ProfileSource): GuidedTutorialProfile {
  return {
    title: source.title,
    summary: source.summary,
    duration: "约 3 分钟",
    highlights: ["6 个专属讲解镜头", "1 次真实操作检测", "1 次预测互动"],
    steps: ([
      {
        id: `${source.module}-apparatus`,
        eyebrow: "镜头 01 · 认识装置",
        title: `先找到${source.apparatus}。`,
        narration: `你好，我是橘猫实验员光光。这个实验的关键装置是${source.apparatus}。先不急着记结论，我们要沿着光的传播过程，一步步找到现象的证据。`,
        hint: "观察装置的相对位置，想一想光从哪里出发、最后到达哪里。",
        target: "module"
      },
      {
        id: `${source.module}-operate`,
        eyebrow: "镜头 02 · 亲手操作",
        title: source.firstAction,
        narration: `${source.firstAction} 操作时一次只改变一个条件，停下来看看画面如何变化，这样才能判断变化究竟由什么引起。`,
        hint: `请在高亮区域完成操作；本轮重点变量是${source.variable}。`,
        target: "controls",
        requiresInteraction: true,
        acceptedEvents: ["control.changed", "configuration.changed", "simulation.toggled"]
      },
      {
        id: `${source.module}-trace`,
        eyebrow: "镜头 03 · 追踪光路",
        title: "顺着光线走，而不是只盯着最后结果。",
        narration: source.path,
        hint: "从光源开始，用手指顺着高亮画面中的光线移动到成像或接收位置。",
        target: "visual"
      },
      {
        id: `${source.module}-predict`,
        eyebrow: "镜头 04 · 先作预测",
        title: `改变${source.variable}之前，先说出你的判断。`,
        narration: `科学探究不是看完结果再解释。请先完成预测，然后回到装置中改变${source.variable}，用画面证据检验自己的想法。`,
        hint: "选错也没关系，预测与证据不一致正是发现问题的开始。",
        target: "visual",
        question: source.question
      },
      {
        id: `${source.module}-evidence`,
        eyebrow: "镜头 05 · 读取证据",
        title: "把看到的变化说成一条完整的证据链。",
        narration: `${source.evidence} 因而可以得到：${source.conclusion}`,
        hint: "用“我改变了……，我观察到……，所以……”的句式记录发现。",
        target: "explanation"
      },
      {
        id: `${source.module}-application`,
        eyebrow: "镜头 06 · 走进生活",
        title: "实验台上的规律，正在真实世界里工作。",
        narration: `${source.application} 现在你可以退出教程，继续自由改变参数，看看这个规律在什么条件下保持不变。`,
        hint: "阅读应用案例时，试着在真实装置中重新指出光源、光学元件和接收位置。",
        target: "application"
      }
    ] as GuidedTutorialStep[]).map((step) => ({
      ...step,
      actions: buildHarnessTutorialActions({
        narration: step.narration,
        target: step.target,
        hint: step.hint,
        requiresInteraction: step.requiresInteraction,
        acceptedEvents: step.acceptedEvents,
        question: step.question,
        promptRecord: step.id.endsWith("-evidence")
      })
    }))
  };
}

const sources: ProfileSource[] = [
  {
    module: "straight",
    title: "跟着光光，看见光如何沿直线传播",
    summary: "从小孔成像出发，拖动物体与光屏，追踪上下两束代表光线怎样交叉并形成倒立实像。",
    apparatus: "发光物体、小孔板和右侧光屏",
    firstAction: "拖动发光物体或光屏，比较像的位置和大小",
    path: "物体顶部发出的光穿过小孔后到达光屏下方，物体底部发出的光到达光屏上方。两束光在小孔处交叉，所以光屏上得到倒立的像。",
    variable: "物距或屏距",
    evidence: "光线通过小孔后仍沿直线前进；光屏越远，代表光线张开的范围越大，像通常也越大。",
    conclusion: "小孔成像形成的是能够落在光屏上的倒立实像",
    application: "手术无影灯通过多个方向的光源减弱本影；日食和月食的影区也能用同样的直线传播模型来分析。",
    question: { prompt: "保持物体和小孔不动，把光屏向右移远，像通常会怎样？", choices: ["变大", "变小", "方向由倒立变正立"], answerIndex: 0, explanation: "正确。光屏更远时，穿孔后的光束继续张开，像通常变大。" }
  },
  {
    module: "reflection",
    title: "跟着光光，测出反射角的规律",
    summary: "改变入射方向和镜面状态，以法线为基准比较入射角与反射角，并区分镜面反射和漫反射。",
    apparatus: "入射光线、法线、平面镜和反射光线",
    firstAction: "拖动入射角控制，观察反射光线绕入射点同步转动",
    path: "入射光到达镜面后返回原来的介质。角度必须相对法线测量，而不是相对镜面；入射线、法线和反射线共同确定反射光路。",
    variable: "入射角",
    evidence: "无论怎样改变入射方向，反射光线总在法线另一侧，并保持反射角等于入射角。",
    conclusion: "光的反射遵守反射角等于入射角，光路还具有可逆性",
    application: "EUV 光刻机使用多层膜“超级反射镜”引导极紫外光，因为普通透镜会强烈吸收这种光。工程再复杂，仍要精确控制每一次反射。",
    question: { prompt: "入射角是 40° 时，理想平面镜的反射角是多少？", choices: ["20°", "40°", "50°"], answerIndex: 1, explanation: "正确。入射角和反射角都以法线为基准，二者相等。" }
  },
  {
    module: "refraction",
    title: "跟着光光，追踪界面两侧的折射光",
    summary: "切换空气、水和玻璃，改变入射角，观察光进入不同介质时为什么会向法线靠近或远离。",
    apparatus: "两种透明介质的分界面、法线、入射光和折射光",
    firstAction: "切换介质组合并改变入射角，比较折射光线的位置",
    path: "光斜着穿过两种介质的分界面时传播方向通常改变。从空气进入玻璃或水，折射光一般更靠近法线；反向传播时则通常远离法线。",
    variable: "介质组合和入射角",
    evidence: "介质改变会改变折射角；同一介质组合中，入射角增大时折射角也随之改变，但二者通常并不相等。",
    conclusion: "折射方向由入射方向与两种介质的光学性质共同决定",
    application: "负折射材料可以让折射光出现在常规方向的另一侧。科研人员利用这种反常控光思路研究超透镜与电磁隐身，但它不是让普通物体凭空消失。",
    question: { prompt: "光从空气斜射入玻璃时，折射光通常怎样变化？", choices: ["向法线靠近", "远离法线", "一定沿原路返回"], answerIndex: 0, explanation: "正确。由空气进入光学上更密的玻璃时，折射光通常向法线靠近。" }
  },
  {
    module: "color-mix",
    title: "跟着光光，把红绿蓝混成新的色光",
    summary: "分别调节 RGB 三束色光的亮度，通过重叠区域理解色光加法混合，并联系像素级显示技术。",
    apparatus: "红、绿、蓝三个色光源和中央重叠区域",
    firstAction: "分别改变 R、G、B 的强度，再尝试只打开其中两束光",
    path: "三束色光在屏幕上的同一区域叠加，眼睛接收到的是各束光共同产生的刺激。这里混合的是色光，不是颜料，因此规律属于加法混色。",
    variable: "三种基色光的强度",
    evidence: "红光与绿光叠加呈黄色，绿光与蓝光叠加呈青色，红光与蓝光叠加呈品红；三者强度合适时接近白色。",
    conclusion: "色光三原色是红、绿、蓝，改变比例就能合成丰富颜色",
    application: "Micro LED 与 Micro RGB 显示把极小的红绿蓝发光单元组成像素，独立控制每个子像素的亮度，获得高亮度和细腻色彩。",
    question: { prompt: "红色光与绿色光等强叠加，中央区域接近什么颜色？", choices: ["黄色", "蓝色", "黑色"], answerIndex: 0, explanation: "正确。色光加法混合中，红光加绿光得到黄色。" }
  },
  {
    module: "celestial",
    title: "跟着光光，走进日食与月食的影子",
    summary: "旋转三维天体视角，调整太阳、地球和月球的位置，用本影与半影解释食现象。",
    apparatus: "太阳、地球、月球以及它们后方的本影和半影",
    firstAction: "切换日食与月食，再旋转视角观察三个天体是否近似排成直线",
    path: "太阳发出的光可用多束直线表示。遮挡天体挡住一部分光后，背后形成完全照不到光的本影，以及只被挡住部分光的半影。",
    variable: "月球位于地球哪一侧以及三者是否对齐",
    evidence: "月球位于太阳和地球之间时，月影可能落到地球形成日食；地球位于太阳和月球之间时，月球进入地影形成月食。",
    conclusion: "食现象是天体相对位置变化与光沿直线传播共同造成的",
    application: "天文学家也利用光被遮挡或弯曲后的亮度变化研究遥远天体；观察黑洞本身困难，但周围发光物质与引力透镜效应能提供间接证据。",
    question: { prompt: "发生月食时，三个天体从太阳一侧看去应怎样排列？", choices: ["太阳—月球—地球", "太阳—地球—月球", "地球—太阳—月球"], answerIndex: 1, explanation: "正确。月食时地球挡住太阳光，月球进入地球的影区。" }
  },
  {
    module: "plane-mirror",
    title: "跟着光光，寻找平面镜后的虚像",
    summary: "移动物体和观察位置，利用对称光路理解等大、等距、正立虚像，并连接半透半反技术。",
    apparatus: "物体、平面镜、观察眼睛、反射光线和镜后虚像",
    firstAction: "拖动物体远离或靠近镜面，再改变观察位置",
    path: "物体发出的光经镜面反射进入眼睛。眼睛习惯按直线反向延长光线，于是感觉光来自镜后；延长线交点并没有真实光线通过。",
    variable: "物体到镜面的距离",
    evidence: "物体移动多少，虚像在镜后对称地移动多少；像与物大小相等、到镜面的距离相等，而且始终正立。",
    conclusion: "平面镜形成的是不能直接落在光屏上的等大正立虚像",
    application: "简易 AR 显示利用半透半反镜把屏幕反射的虚像叠加到真实景物上；“无底洞”装置则用两面镜反复成像，制造向深处延伸的视觉效果。",
    question: { prompt: "物体距离平面镜 30 cm，像到镜面的距离是多少？", choices: ["15 cm", "30 cm", "60 cm"], answerIndex: 1, explanation: "正确。平面镜成像中，像和物到镜面的距离相等。" }
  },
  {
    module: "curved-mirror",
    title: "跟着光光，比较凹面镜与凸面镜",
    summary: "在二维光路和三维视图间切换，观察近轴平行光经曲面反射后会聚或发散，并比较视野。",
    apparatus: "主光轴、焦点、凹面镜或凸面镜以及三条代表光线",
    firstAction: "切换凹面镜与凸面镜，并在二维、三维视图中对照同一组光线",
    path: "凹面镜能把近轴且平行于主光轴的光反射后会聚到焦点附近；凸面镜使这类反射光向外发散，其反向延长线仿佛来自镜后焦点。",
    variable: "镜面类型和物体位置",
    evidence: "凹面镜具有会聚作用，物体位置不同时可成不同性质的像；凸面镜始终形成缩小正立虚像，却能提供更大的观察范围。",
    conclusion: "镜面曲率决定反射光是会聚还是发散，也决定成像与视野特点",
    application: "汽车前灯和太阳灶利用凹面镜会聚或定向光线；道路转角镜和汽车后视镜使用凸面镜扩大视野。",
    question: { prompt: "道路急转弯处常用凸面镜，最主要的原因是什么？", choices: ["让像变得更大", "扩大观察视野", "把光会聚到焦点"], answerIndex: 1, explanation: "正确。凸面镜形成缩小虚像，因此同一镜面中能看到更大的范围。" }
  },
  {
    module: "invisible-light",
    title: "跟着光光，发现看不见的红外线与紫外线",
    summary: "比较红外与紫外的检测方式、材料阻挡和安全剂量，认识它们在生活与科技中的不同用途。",
    apparatus: "红外或紫外光源、被测物、探测器和防护材料",
    firstAction: "切换红外线与紫外线案例，并调节强度或更换阻挡材料",
    path: "它们都属于电磁波，但波长位于可见光范围之外，所以人眼不能直接看见。实验画面用伪彩、荧光或仪表读数把不可见信号转成可观察证据。",
    variable: "波段、强度与阻挡材料",
    evidence: "红外探测常反映物体热辐射或遥控信号；紫外线可激发某些物质发出荧光，但过量照射也可能伤害皮肤和眼睛。",
    conclusion: "看不见不等于不存在，必须借助合适的探测器并注意安全",
    application: "热成像、夜视和遥控器使用红外技术；验钞、消毒和荧光检测会使用紫外线，同时必须配合遮挡、距离和时间控制。",
    question: { prompt: "遥控器的红外发射管肉眼不亮，怎样更容易观察它是否工作？", choices: ["用手机摄像头辅助观察", "把它贴近眼睛", "用放大镜点燃纸张"], answerIndex: 0, explanation: "正确。部分摄像头能接收到近红外信号并在屏幕上显示亮点。" }
  },
  {
    module: "magnifier",
    title: "跟着光光，把凸透镜变成放大镜",
    summary: "把物体移到焦点以内，追踪折射光的反向延长线，理解正立放大虚像的形成条件。",
    apparatus: "物体、凸透镜、焦点、观察眼睛和折射光线",
    firstAction: "把物体拖到凸透镜一倍焦距以内，再改变物距",
    path: "物体发出的光经凸透镜后仍向外传播，眼睛把折射光反向延长，于是在物体同侧看见一个放大的虚像。真实光线并没有在虚像位置会聚。",
    variable: "物距与焦距的关系",
    evidence: "只有物距小于焦距时，凸透镜才作为放大镜形成正立放大虚像；把光屏放在虚像位置接不到清晰像。",
    conclusion: "放大镜的关键条件是物体位于凸透镜焦点以内",
    application: "阅读放大镜、珠宝检视镜和手机微距附加镜都利用相近的凸透镜规律，让眼睛看到更大的细节。",
    question: { prompt: "要把凸透镜当作放大镜，物体应放在哪里？", choices: ["一倍焦距以内", "二倍焦距以外", "一定放在焦点上"], answerIndex: 0, explanation: "正确。物距小于焦距时，凸透镜形成正立、放大的虚像。" }
  },
  {
    module: "bench",
    title: "跟着光光，完成凸透镜成像探究",
    summary: "移动蜡烛、凸透镜和光屏，围绕焦距与二倍焦距记录物距、像距以及像的性质。",
    apparatus: "同一光具座上的蜡烛、凸透镜、光屏和焦点标记",
    firstAction: "先固定凸透镜，再移动蜡烛和光屏寻找最清晰的像",
    path: "一条平行于主光轴的光经凸透镜后通过像方焦点，一条通过光心的光近似不偏折；两条代表光线的交点给出实像位置。",
    variable: "物距相对焦距和二倍焦距的位置",
    evidence: "物体在二倍焦距外时常成倒立缩小实像；在一倍与二倍焦距之间时常成倒立放大实像；焦点以内形成正立放大虚像。",
    conclusion: "不能孤立背像的大小，必须同时判断物距、像距、正倒和虚实",
    application: "照相机、投影仪与放大镜看似不同，其核心都可以回到同一套凸透镜成像规律。",
    question: { prompt: "物体位于一倍焦距与二倍焦距之间，光屏上通常得到什么像？", choices: ["倒立放大的实像", "正立放大的虚像", "倒立缩小的实像"], answerIndex: 0, explanation: "正确。这也是投影仪形成较大实像时采用的物距范围。" }
  },
  {
    module: "camera",
    title: "跟着光光，拆开照相机的成像过程",
    summary: "调整物距、焦距与传感器位置，观察镜头如何把远处景物变成传感器上的清晰实像。",
    apparatus: "景物、镜头组、光圈、传感器和成像光线",
    firstAction: "改变景物距离或焦距，再移动传感器位置完成对焦",
    path: "来自景物各点的光进入镜头后发生折射，在传感器表面重新会聚。传感器必须位于清晰像面，前后偏离都会造成模糊。",
    variable: "物距、焦距和像距",
    evidence: "普通拍摄中景物通常远于二倍焦距，传感器得到倒立缩小实像；对焦实质上是让像面与传感器重合。",
    conclusion: "照相机记录的是能够落在传感器上的实像，而清晰度取决于准确对焦",
    application: "手机多摄像头用不同焦距承担广角、主摄和长焦任务，计算摄影再把多个传感器的数据融合。",
    question: { prompt: "照相机传感器上形成的像通常是什么性质？", choices: ["倒立缩小实像", "正立放大虚像", "等大正立实像"], answerIndex: 0, explanation: "正确。一般拍摄距离下，镜头在传感器上形成倒立缩小的实像。" }
  },
  {
    module: "eye",
    title: "跟着光光，看眼睛怎样自动对焦",
    summary: "切换远近物体，观察晶状体曲度变化如何让像始终清晰地落在视网膜上。",
    apparatus: "角膜、晶状体、睫状肌、玻璃体和视网膜",
    firstAction: "切换观察远处与近处物体，比较晶状体形状和焦点位置",
    path: "外界光经过角膜和晶状体折射，在视网膜上形成实像。视网膜位置基本固定，因此眼睛主要通过改变晶状体的会聚能力来调焦。",
    variable: "物体远近与晶状体曲度",
    evidence: "看近处时晶状体需要更强的会聚能力；看远处时晶状体相对变薄。正常调节后像都应落到视网膜上。",
    conclusion: "眼睛像一台能主动改变焦距的照相机，但调节能力并非无限",
    application: "长时间近距离用眼会持续调节并容易疲劳。合适距离、充足照明和定时远眺有助于减轻用眼负担。",
    question: { prompt: "正常眼睛从看远处改为看近处时，晶状体通常怎样变化？", choices: ["会聚能力增强", "完全失去折射作用", "视网膜向后移动"], answerIndex: 0, explanation: "正确。看近处需要更强的会聚能力，而视网膜位置不会随意移动。" }
  },
  {
    module: "correction",
    title: "跟着光光，为近视与远视选择镜片",
    summary: "先判断焦点落在视网膜前还是后，再选择凹透镜或凸透镜，把光线重新引向视网膜。",
    apparatus: "眼球模型、视网膜、成像焦点和待选择的矫正镜片",
    firstAction: "切换近视与远视模型，再选择凹透镜或凸透镜验证",
    path: "矫正镜片先改变进入眼睛的光线方向，眼球自身的屈光系统再完成后续会聚。判断镜片不能只背名称，要看原焦点相对视网膜的位置。",
    variable: "眼睛类型与矫正镜片",
    evidence: "近视眼对远处光会聚过强或眼轴偏长，焦点在视网膜前，需要凹透镜先发散；远视眼焦点偏后，常用凸透镜增强会聚。",
    conclusion: "合适镜片通过预先改变光束会聚程度，让最终像重新落到视网膜上",
    application: "框架眼镜、隐形眼镜和部分屈光手术虽然方式不同，目标都是补偿眼睛屈光系统的偏差。",
    question: { prompt: "近视眼看远处不清楚，通常使用哪种镜片矫正？", choices: ["凹透镜", "凸透镜", "平面镜"], answerIndex: 0, explanation: "正确。凹透镜先使光线适当发散，让眼睛的焦点后移到视网膜上。" }
  },
  {
    module: "instruments",
    title: "跟着光光，比较显微镜与望远镜",
    summary: "切换两种光学仪器，分清物镜和目镜各自完成哪一次成像，理解组合透镜的放大链路。",
    apparatus: "物镜、目镜、中间像以及最终进入眼睛的光束",
    firstAction: "切换显微镜与望远镜，分别高亮物镜和目镜观察两级成像",
    path: "光先经过物镜形成中间像，再由目镜把这个中间像作为观察对象继续放大。两块透镜不是简单把倍数标签相加，而是承担不同成像任务。",
    variable: "仪器类型与物镜、目镜焦距",
    evidence: "显微镜的物镜面对很近的小物体并形成放大实像；望远镜物镜收集远处微弱光并形成中间像，目镜再扩大视角。",
    conclusion: "复杂光学仪器可以拆成连续的基础成像过程来理解",
    application: "显微镜帮助观察细胞和微结构，望远镜收集遥远天体的光；现代设备还会结合相机传感器与计算处理。",
    question: { prompt: "显微镜和望远镜中，靠近眼睛的透镜都称为什么？", choices: ["物镜", "目镜", "反光镜"], answerIndex: 1, explanation: "正确。靠近眼睛的是目镜，另一端主要收集来自物体的光。" }
  }
];

export const guidedOpticsTutorials = Object.fromEntries(
  sources.map((source) => [source.module, makeProfile(source)])
) as Record<string, GuidedTutorialProfile>;
