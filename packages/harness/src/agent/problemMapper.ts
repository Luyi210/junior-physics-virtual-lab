export interface ExtractedParameter {
  label: string;
  symbol: string;
  value: string;
}

export interface PhysicsProblemMapping {
  experimentId: string;
  title: string;
  grade: "junior" | "high-school";
  route: string;
  matchedKeywords: string[];
  extractedParameters: ExtractedParameter[];
  labParameterPatch?: Record<string, number>;
  verificationPlan: string[];
  guidingQuestion: string;
  confidence: number;
}

interface ExperimentMatchRule {
  experimentId: string;
  title: string;
  grade: "junior" | "high-school";
  route: string;
  keywords: RegExp[];
  boostKeywords?: RegExp[];
  verificationPlan: string[];
  guidingQuestion: string;
}

const EXPERIMENT_RULES: ExperimentMatchRule[] = [
  // Junior High — Optics
  {
    experimentId: "lens",
    title: "凸透镜成像与光具座",
    grade: "junior",
    route: "/lab/lens",
    keywords: [/凸透镜|焦距|物距|像距|实像|虚像|放大镜|照相机|投影仪|近视|远视|光具座/iu],
    boostKeywords: [/二倍焦距|2f|倒立|正立|光屏/iu],
    verificationPlan: [
      "先在凸透镜工作台把焦距 f 调到题目给出的数值（或按比例设定）",
      "把物体移到对应的物距 u 位置，再前后移动光屏寻找最清晰的像",
      "核对像距 v 的范围以及像的正倒、大小和虚实，与你的推理对照"
    ],
    guidingQuestion: "先不看答案：根据物距 u 与焦距 f、2f 的大小关系，你预测光屏上会成放大还是缩小的像？"
  },
  {
    experimentId: "reflection",
    title: "光的反射与平面镜成像",
    grade: "junior",
    route: "/student/explore/light",
    keywords: [/反射角|入射角|法线|平面镜|镜面反射|漫反射|潜望镜/iu],
    verificationPlan: [
      "打开光现象专题中的反射或平面镜模块，先标出法线位置",
      "按题目角度调节入射光线，读取反射角并验证对称关系"
    ],
    guidingQuestion: "注意题目给的是光线与镜面的夹角，还是与法线的夹角？"
  },
  {
    experimentId: "refraction",
    title: "光的折射与色散",
    grade: "junior",
    route: "/student/explore/light",
    keywords: [/折射角|折射|三棱镜|色散|池水变浅|筷子弯折/iu],
    verificationPlan: [
      "进入光现象专题的折射/色散模块，选定空气与水或玻璃界面",
      "调节入射角，观察折射光线偏向法线还是远离法线"
    ],
    guidingQuestion: "光从空气斜射入水或玻璃时，折射角比入射角大还是小？"
  },
  // Junior High — Sound
  {
    experimentId: "sound-features",
    title: "声音三要素与传播",
    grade: "junior",
    route: "/student/explore/sound",
    keywords: [/音调|响度|音色|频率|振幅|超声波|次声波|真空罩|声速|回声测距/iu],
    verificationPlan: [
      "打开声音实验场，分别固定振幅改频率、固定频率改振幅观察波形变化",
      "若是回声测距或真空传声问题，切到对应子实验记录时间或空气量对照"
    ],
    guidingQuestion: "题目里声音变尖/变亮和声音变大，分别对应波形的“变密”还是“变高”？"
  },
  // Junior High — Mechanics
  {
    experimentId: "mechanics-lever",
    title: "杠杆平衡条件",
    grade: "junior",
    route: "/student/explore/mechanics",
    keywords: [/杠杆|支点|动力臂|阻力臂|省力杠杆|费力杠杆|力矩/iu],
    verificationPlan: [
      "进入力学工坊的杠杆模块，按题目设定左侧阻力与阻力臂",
      "调节右侧动力或动力臂（含斜拉角度）使杠杆水平平衡，验证 F1·L1 = F2·L2"
    ],
    guidingQuestion: "如果是斜着拉杠杆，力臂还是杠杆本身的长度吗？应该怎么画垂线？"
  },
  {
    experimentId: "mechanics-friction",
    title: "滑动摩擦力探究",
    grade: "junior",
    route: "/student/explore/mechanics",
    keywords: [/摩擦力|静摩擦|滑动摩擦|粗糙程度|匀速直线|二力平衡/iu],
    verificationPlan: [
      "打开力学工坊的摩擦力模块，先匀速拉动木块读取稳定拉力",
      "按题目要求单独改变压力（砝码质量）或接触面粗糙程度，对比示数变化"
    ],
    guidingQuestion: "为什么要匀速直线拉动木块，测力计的示数才等于滑动摩擦力？"
  },
  {
    experimentId: "mechanics-buoyancy",
    title: "浮力与阿基米德原理",
    grade: "junior",
    route: "/student/explore/mechanics",
    keywords: [/浮力|阿基米德|排开液体|漂浮|悬浮|沉底|称重法|浸没/iu],
    verificationPlan: [
      "进入力学工坊的浮力模块，先测空气中重力 G，再浸入液体测拉力 F'",
      "改变浸入深度或液体密度，检验浮力 F浮 = G - F' 随 V排 和 ρ液 的变化"
    ],
    guidingQuestion: "物体完全浸没后再继续下沉（未碰底），排开液体体积变了吗？浮力会变吗？"
  },
  // Junior High — Circuit
  {
    experimentId: "circuit-ohm",
    title: "欧姆定律与串并联电路",
    grade: "junior",
    route: "/student/explore/circuit",
    keywords: [/欧姆定律|串联|并联|电流表|电压表|滑动变阻器|短路|断路|电阻|电功率|电能|焦耳|电磁铁/iu],
    boostKeywords: [/伏安法|U=IR|I=U\/R|P=UI|额定功率/iu],
    verificationPlan: [
      "进入电学连接室（串并联 / 欧姆定律 / 电功率 / 电磁铁模块），按题意选好连接方式",
      "先断开开关设好电源电压与电阻，再闭合开关观察电流表、电压表示数变化"
    ],
    guidingQuestion: "先判断电路是串联还是并联：改变这个电阻时，哪一个电表的示数会先变、怎么变？"
  },
  // Junior High — Thermal
  {
    experimentId: "thermal-boiling",
    title: "水的沸腾、熔化与蒸发",
    grade: "junior",
    route: "/student/explore/thermal",
    keywords: [/沸腾|沸点|气压|熔化|凝固|蒸发|温度计|比热容|吸热/iu],
    verificationPlan: [
      "打开热学观察站，选择沸腾、熔化或蒸发子模块",
      "记录升温段和温度保持不变的平台段，观察继续吸热时温度曲线的变化"
    ],
    guidingQuestion: "水沸腾或晶体熔化时一直在吸热，为什么温度计示数却不再上升？"
  },
  // Junior High — Measurement
  {
    experimentId: "measurement-density",
    title: "托盘天平与密度测量",
    grade: "junior",
    route: "/student/explore/measurement",
    keywords: [/密度|天平|游码|砝码|量筒|排水法|质量与体积/iu],
    verificationPlan: [
      "打开物质测量室，先将游码归零并调平天平，再称量物体质量 m",
      "用排水法读取量筒前后液面差 V = V2 - V1，核对 ρ = m / V"
    ],
    guidingQuestion: "如果先用量筒测石块体积再放上天平称质量，测出的密度会偏大还是偏小？"
  },
  // High School — 24 experiments coverage (core high-frequency topics)
  {
    experimentId: "pendulum",
    title: "用单摆测量重力加速度",
    grade: "high-school",
    route: "/high-school/experiments/pendulum",
    keywords: [/单摆|摆长|重力加速度|简谐振动|周期.*摆/iu],
    boostKeywords: [/T=2π|T²|秒表|摆角/iu],
    verificationPlan: [
      "进入高中单摆实验，把摆长 L 和小摆角调到题目条件",
      "用虚拟秒表测出 10~20 个全振动时间求周期 T，绘制 T²-L 图像验证斜率"
    ],
    guidingQuestion: "把摆球质量加倍但不改摆长，单摆的周期 T 会变化吗？去实验台测一组验证一下。"
  },
  {
    experimentId: "double-slit",
    title: "用双缝干涉测光的波长",
    grade: "high-school",
    route: "/high-school/experiments/double-slit",
    keywords: [/双缝干涉|条纹间距|亮纹|波长|单色光|干涉条纹/iu],
    boostKeywords: [/Δx|纳米|nm|缝距|屏距/iu],
    verificationPlan: [
      "打开高中双缝干涉实验，按题意调节双缝间距 d、屏距 L 和波长 λ",
      "在光屏上标定两条清晰亮纹位置并数清间隔数 N，验证 Δx = Lλ/d"
    ],
    guidingQuestion: "如果把双缝到光屏的距离 L 增大，相邻亮纹间距 Δx 会变宽还是变窄？"
  },
  {
    experimentId: "newton-second-law",
    title: "探究加速度与力、质量的关系（牛顿第二定律）",
    grade: "high-school",
    route: "/high-school/experiments/newton-second-law",
    keywords: [/牛顿第二定律|加速度.*质量|加速度.*合外力|F=ma|槽码|小车.*加速度/iu],
    verificationPlan: [
      "进入牛顿第二定律实验，先固定总质量改变牵引力，观察 a-F 线性关系",
      "再固定合外力改变总质量，切换 a - 1/M总 图像检验反比关系"
    ],
    guidingQuestion: "探究加速度与质量关系时，为什么横坐标通常画 1/M 而不是直接画 M？"
  },
  {
    experimentId: "projectile-motion",
    title: "探究平抛运动规律",
    grade: "high-school",
    route: "/high-school/experiments/projectile-motion",
    keywords: [/平抛|斜抛|水平初速度|抛出高度|水平射程|落地时间/iu],
    verificationPlan: [
      "进入平抛与斜抛实验，按题意设定初速度 v0 和抛出高度 h0",
      "观察水平位移与竖直下落位移 (h0 - y) 随 t² 的关系，核对落地时间是否只取决于高度"
    ],
    guidingQuestion: "同一高度水平抛出的小球，初速度翻倍后，落地时间会变吗？水平射程怎么变？"
  },
  {
    experimentId: "emf-internal-resistance",
    title: "测量电源电动势和内阻",
    grade: "high-school",
    route: "/high-school/experiments/emf-internal-resistance",
    keywords: [/电动势|内阻|路端电压|闭合电路欧姆定律|U-I图像|截距/iu],
    verificationPlan: [
      "打开高中电动势与内阻实验，改变外电阻记录多组路端电压 U 和电流 I",
      "观察 U-I 图像的纵截距（对应电动势 E）和斜率绝对值（对应内阻 r）"
    ],
    guidingQuestion: "当外电阻逐渐增大时，路端电压 U 和干路电流 I 分别怎么变化？"
  },
  {
    experimentId: "spring-force",
    title: "探究弹簧形变量与弹力的关系（胡克定律）",
    grade: "high-school",
    route: "/high-school/experiments/spring-force",
    keywords: [/胡克定律|劲度系数|弹簧.*伸长|弹簧.*弹力|形变量/iu],
    verificationPlan: [
      "打开弹簧弹力实验，逐级加载砝码并记录原长、总长与伸长量 x",
      "观察 F-x 拟合直线斜率，核对劲度系数 k 是否恒定"
    ],
    guidingQuestion: "画 F-x 图像时，横坐标应该用弹簧总长度还是伸长量 Δx？"
  },
  {
    experimentId: "force-composition",
    title: "探究两个互成角度的力的合成规律",
    grade: "high-school",
    route: "/high-school/experiments/force-composition",
    keywords: [/力的合成|平行四边形定则|共点力|分力|合力|互成角度/iu],
    verificationPlan: [
      "进入共点力合成实验，设定两个分力 F1、F2 及其夹角 θ",
      "独立试配出等效果合力，观察 R² 与 cosθ 的关系"
    ],
    guidingQuestion: "保持两个分力大小不变，夹角从 0° 增大到 180°，合力大小怎么变化？"
  },
  {
    experimentId: "mechanical-energy",
    title: "验证机械能守恒定律",
    grade: "high-school",
    route: "/high-school/experiments/mechanical-energy",
    keywords: [/机械能守恒|动能.*势能|重力势能|打点计时器|纸带|落体/iu],
    verificationPlan: [
      "打开机械能守恒实验，释放重物后在虚拟纸带上读出 A、B 前后相邻位置",
      "用相邻位移差求瞬时速度，比较减少的重力势能 ΔEp 与增加的动能 ΔEk"
    ],
    guidingQuestion: "存在空气阻力时，减少的重力势能通常会略大于还是略小于增加的动能？"
  },
  {
    experimentId: "capacitor-charge",
    title: "观察电容器的充、放电现象",
    grade: "high-school",
    route: "/high-school/experiments/capacitor-charge",
    keywords: [/电容器|充电|放电|电容.*电压|时间常数|RC电路/iu],
    verificationPlan: [
      "打开电容器充放电实验，先接电源充电，再切换至经电阻放电",
      "观察电压 U(t) 与电流 I(t) 的指数变化，改变 R 或 C 比较时间常数 τ=RC"
    ],
    guidingQuestion: "把充电开关突然切到放电挡瞬间，电容器两端电压会突变吗？电流方向呢？"
  },
  {
    experimentId: "momentum-conservation",
    title: "验证动量守恒定律（碰撞）",
    grade: "high-school",
    route: "/high-school/experiments/momentum-conservation",
    keywords: [/动量守恒|弹性碰撞|非弹性碰撞|碰前|碰后|动量/iu],
    verificationPlan: [
      "打开碰撞与动量守恒实验，按题意设置两球质量和初速度",
      "比较碰撞前后系统总动量 m1v1 + m2v2 与总动能是否守恒"
    ],
    guidingQuestion: "弹性碰撞与完全非弹性碰撞中，总动量和总动能分别是哪一个守恒？"
  },
  {
    experimentId: "photoelectric-effect",
    title: "探究光电效应规律",
    grade: "high-school",
    route: "/high-school/experiments/photoelectric-effect",
    keywords: [/光电效应|截止频率|遏止电压|逸出功|光电子|普朗克/iu],
    verificationPlan: [
      "打开光电效应实验，固定光强改变入射光频率，寻找产生光电流的极限频率",
      "加反向电压测遏止电压 Uc，检验它与光强还是频率有关"
    ],
    guidingQuestion: "入射光频率低于截止频率时，把光照强度调到很大，能打出光电子吗？"
  },
  {
    experimentId: "charged-particle",
    title: "带电粒子在电磁场中的运动",
    grade: "high-school",
    route: "/high-school/experiments/charged-particle",
    keywords: [/洛伦兹力|带电粒子|偏转电场|磁感应强度|回旋半径|比荷/iu],
    verificationPlan: [
      "打开带电粒子运动实验，按题意调节速度、比荷 q/m 与磁感应强度 B",
      "观察轨迹半径 R = mv/(qB) 随速度和磁场变化的规律"
    ],
    guidingQuestion: "带电粒子垂直进入匀强磁场后速度大小变不变？圆周运动周期和速度大小有关吗？"
  },
  {
    experimentId: "electromagnetic-induction",
    title: "探究影响感应电流方向的因素（楞次定律）",
    grade: "high-school",
    route: "/high-school/experiments/electromagnetic-induction",
    keywords: [/电磁感应|楞次定律|磁通量|感应电流|法拉第|变压器/iu],
    verificationPlan: [
      "打开电磁感应实验，分别插入/拔出磁铁或改变线圈电流观察灵敏电流计偏转",
      "核对磁通量增减与感应磁场方向“增反减同”的规律"
    ],
    guidingQuestion: "磁铁静止在线圈内部不动时，磁通量很大，为什么灵敏电流计指针却不偏转？"
  }
];

const PARAM_EXTRACTORS: Array<{ label: string; symbol: string; pattern: RegExp }> = [
  { label: "焦距", symbol: "f", pattern: /焦距(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:cm|mm|m|厘米|毫米|米))/iu },
  { label: "物距", symbol: "u", pattern: /(?:物距|透镜前|距透镜)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:cm|mm|m|厘米|毫米|米))/iu },
  { label: "摆长", symbol: "L", pattern: /摆长(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:cm|m|厘米|米))/iu },
  { label: "波长", symbol: "λ", pattern: /波长(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:nm|μm|mm|纳米|微米|毫米))/iu },
  { label: "电动势", symbol: "E", pattern: /电动势(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:V|伏))/iu },
  { label: "内阻", symbol: "r", pattern: /内阻(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:Ω|欧))/iu },
  { label: "电压", symbol: "U", pattern: /(?:电源电压|电压)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:V|伏))/iu },
  { label: "电阻", symbol: "R", pattern: /电阻(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:Ω|kΩ|欧))/iu },
  { label: "质量", symbol: "m", pattern: /质量(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:kg|g|千克|克))/iu },
  { label: "初速度", symbol: "v₀", pattern: /(?:初速度|水平速度)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:m\/s|米每秒))/iu },
  { label: "高度", symbol: "h", pattern: /(?:高度|高)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:cm|m|厘米|米))/iu },
  { label: "拉力/力", symbol: "F", pattern: /(?:拉力|合力|分力|弹力)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:N|牛))/iu },
  { label: "角度", symbol: "θ", pattern: /(?:入射角|夹角|摆角)(?:为|是|=)?\s*(\d+(?:\.\d+)?\s*(?:°|度))/iu }
];

export function extractPhysicsParameters(text: string): ExtractedParameter[] {
  const results: ExtractedParameter[] = [];
  for (const extractor of PARAM_EXTRACTORS) {
    const match = text.match(extractor.pattern);
    if (match?.[1]) {
      results.push({ label: extractor.label, symbol: extractor.symbol, value: match[1].trim() });
    }
  }
  return results.slice(0, 6);
}

export function isPhysicsProblemPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(?:题目|物理题|输题找实验|帮我复现|这道题|帮我分析这道题)[：:\s]/iu.test(trimmed)) return true;
  const hasNumericPhysics = /\d+(?:\.\d+)?\s*(?:cm|mm|μm|m|kg|g|N|V|A|Ω|Hz|nm|s|°|厘米|毫米|微米|纳米|米|伏|欧|牛|千克|克|度)/iu.test(trimmed);
  const hasProblemCue = /求|多少|成什么像|会怎样|怎么变|能否|哪个实验|复现|对应实验/iu.test(trimmed);
  return hasNumericPhysics && hasProblemCue;
}

function parseNumericValue(raw: string): { num: number; unit: string } | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([^\d\s]*)$/u);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return null;
  return { num, unit: (m[2] ?? "").toLowerCase() };
}

function toCentimeters(raw: string): number | null {
  const parsed = parseNumericValue(raw);
  if (!parsed) return null;
  if (parsed.unit === "m" || parsed.unit === "米") return parsed.num * 100;
  if (parsed.unit === "mm" || parsed.unit === "毫米") return parsed.num / 10;
  return parsed.num;
}

function toMeters(raw: string): number | null {
  const parsed = parseNumericValue(raw);
  if (!parsed) return null;
  if (parsed.unit === "cm" || parsed.unit === "厘米") return parsed.num / 100;
  if (parsed.unit === "mm" || parsed.unit === "毫米") return parsed.num / 1000;
  return parsed.num;
}

export function buildLabParameterPatch(
  experimentId: string,
  params: readonly ExtractedParameter[]
): Record<string, number> | undefined {
  const patch: Record<string, number> = {};
  const find = (symbol: string) => params.find((p) => p.symbol === symbol)?.value;

  if (experimentId === "lens") {
    const f = find("f") ? toCentimeters(find("f")!) : null;
    const u = find("u") ? toCentimeters(find("u")!) : null;
    if (f !== null) patch.focalLength = Number(f.toFixed(1));
    if (u !== null) patch.objectX = Number((-u).toFixed(1));
  } else if (experimentId === "pendulum") {
    const l = find("L") ? toMeters(find("L")!) : null;
    const theta = find("θ") ? parseNumericValue(find("θ")!)?.num ?? null : null;
    if (l !== null) patch.length = Number(l.toFixed(3));
    if (theta !== null) patch.amplitudeDegrees = Number(theta.toFixed(1));
  } else if (experimentId === "double-slit") {
    const lambda = find("λ") ? parseNumericValue(find("λ")!) : null;
    if (lambda) {
      const unitScale = lambda.unit === "μm" || lambda.unit === "微米" ? 1000 : lambda.unit === "mm" || lambda.unit === "毫米" ? 1_000_000 : 1;
      patch.wavelengthNm = Number((lambda.num * unitScale).toFixed(1));
    }
  } else if (experimentId === "projectile-motion") {
    const v0 = find("v₀") ? parseNumericValue(find("v₀")!)?.num ?? null : null;
    const h = find("h") ? toMeters(find("h")!) : null;
    if (v0 !== null) patch.initialSpeed = Number(v0.toFixed(2));
    if (h !== null) patch.initialHeight = Number(h.toFixed(2));
  } else if (experimentId === "emf-internal-resistance") {
    const e = find("E");
    const r = find("r");
    const eNum = e ? parseNumericValue(e)?.num ?? null : null;
    const rNum = r ? parseNumericValue(r)?.num ?? null : null;
    if (eNum !== null) patch.emf = Number(eNum.toFixed(2));
    if (rNum !== null) patch.internalResistance = Number(rNum.toFixed(2));
  } else if (experimentId === "capacitor-charge") {
    const e = find("E");
    const r = find("R");
    const eNum = e ? parseNumericValue(e)?.num ?? null : null;
    const rParsed = r ? parseNumericValue(r) : null;
    if (eNum !== null) patch.emf = Number(eNum.toFixed(2));
    if (rParsed) {
      patch.resistanceKOhm = rParsed.unit.includes("k") ? rParsed.num : Number((rParsed.num / 1000).toFixed(3));
    }
  } else if (experimentId === "spring-force") {
    const m = find("m") ? parseNumericValue(find("m")!) : null;
    if (m) {
      patch.loadMassGrams = (m.unit === "kg" || m.unit === "千克") ? Number((m.num * 1000).toFixed(0)) : Number(m.num.toFixed(0));
    }
  }

  return Object.keys(patch).length ? patch : undefined;
}

export function mapPhysicsProblemToExperiment(
  text: string,
  preferredGrade?: "junior" | "high-school"
): PhysicsProblemMapping | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let best: { rule: ExperimentMatchRule; score: number; matched: string[] } | null = null;
  for (const rule of EXPERIMENT_RULES) {
    const matched: string[] = [];
    let score = 0;
    for (const pattern of rule.keywords) {
      const m = trimmed.match(pattern);
      if (m) {
        score += 3;
        matched.push(m[0]);
      }
    }
    for (const pattern of rule.boostKeywords ?? []) {
      const m = trimmed.match(pattern);
      if (m) {
        score += 1.5;
        matched.push(m[0]);
      }
    }
    if (score > 0 && preferredGrade && rule.grade === preferredGrade) {
      score += 0.6;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score, matched: [...new Set(matched)] };
    }
  }

  if (!best) return null;

  const extractedParameters = extractPhysicsParameters(trimmed);
  const labParameterPatch = buildLabParameterPatch(best.rule.experimentId, extractedParameters);
  const confidence = Math.min(0.98, 0.55 + best.score * 0.08 + Math.min(0.15, extractedParameters.length * 0.04));

  return {
    experimentId: best.rule.experimentId,
    title: best.rule.title,
    grade: best.rule.grade,
    route: best.rule.route,
    matchedKeywords: best.matched,
    extractedParameters,
    ...(labParameterPatch ? { labParameterPatch } : {}),
    verificationPlan: best.rule.verificationPlan,
    guidingQuestion: best.rule.guidingQuestion,
    confidence: Number(confidence.toFixed(2))
  };
}
