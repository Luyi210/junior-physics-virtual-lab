import type { HarnessArea } from "./types";

export interface HarnessMisconception {
  id: string;
  claim: string;
  triggers: string[];
  correction: string;
  probe: string;
}

export interface HarnessConceptNode {
  id: string;
  module: string;
  area: HarnessArea;
  title: string;
  inquiryQuestion: string;
  prerequisites: string[];
  evidenceCriteria: string[];
  misconceptions: HarnessMisconception[];
  hintLadder: [string, string, string];
  connections: string[];
}

function opticsConcept(node: Omit<HarnessConceptNode, "area">): HarnessConceptNode {
  return { ...node, area: "optics" };
}

function domainConcept(area: HarnessArea, node: Omit<HarnessConceptNode, "area">): HarnessConceptNode {
  return { ...node, area };
}

const opticsConcepts: HarnessConceptNode[] = [
  opticsConcept({
    id: "optics.dispersion", module: "dispersion", title: "复色光的色散",
    inquiryQuestion: "光源成分、棱镜姿态和光屏距离怎样共同影响光屏上的色带？",
    prerequisites: ["光沿路径传播", "光屏接收光"],
    evidenceCriteria: ["光屏上出现可区分的颜色落点", "只改变一个条件形成两组结果", "单色光与复色光得到不同光屏结果"],
    misconceptions: [
      { id: "prism-creates-color", claim: "三棱镜把白光变成了它新制造的七种颜色", triggers: ["棱镜制造颜色", "棱镜产生颜色", "白光变成七种颜色"], correction: "棱镜主要把复色光中原有的不同成分分开；单色光会偏折，却不会凭空产生一套连续光谱。", probe: "把白光换成红色单色光，并保持棱镜和光屏不动，光屏证据有什么不同？" },
      { id: "white-only", claim: "只有白光才能发生色散", triggers: ["只有白光", "色散一定要白光", "必须是白光"], correction: "是否出现多条色带取决于入射光是否含有多种波长成分；复色彩光也可以分开，单色光主要表现为偏折。", probe: "比较白光、RGB 混合光和红色单色光的光屏落点。" }
    ],
    hintLadder: ["先只看光屏落点，不急着解释颜色来源。", "保持棱镜和光屏不动，依次切换白光、混合光和单色光。", "用“入射光包含……，光屏出现……，因此……”写出证据句。"],
    connections: ["彩虹", "色光混合", "光谱检测"]
  }),
  opticsConcept({
    id: "optics.straight", module: "straight", title: "光的直线传播与小孔成像",
    inquiryQuestion: "物体不同位置发出的光怎样穿过小孔，并在光屏上重新排列？",
    prerequisites: ["发光物体", "影与像的区别"],
    evidenceCriteria: ["追踪物体上下两端的代表光线", "光线在小孔处交叉", "光屏能承接倒立实像"],
    misconceptions: [
      { id: "pinhole-shadow", claim: "小孔成像只是物体投下的影子", triggers: ["小孔成像是影子", "就是影子", "只是影子"], correction: "影是光被遮挡形成的暗区；小孔像由物体各点发出的光穿孔后在光屏上重新对应形成。", probe: "分别追踪烛焰顶部和底部的光，看它们最后落到光屏哪里。" },
      { id: "bigger-hole-clearer", claim: "小孔越大，像一定越清晰", triggers: ["孔越大越清晰", "小孔越大", "孔大更清晰"], correction: "孔变大通常让更多光进入、像更亮，但来自同一点的光束重叠范围也会增大，像反而可能变模糊。", probe: "只改变孔径，分别记录亮度与边缘清晰程度。" }
    ],
    hintLadder: ["先从物体顶部选一束能穿过小孔的光。", "再追踪物体底部的代表光线，比较两束光穿孔后的上下位置。", "用“顶部光落在……，底部光落在……，所以像……”完成证据。"],
    connections: ["日食与月食", "无影灯", "针孔相机"]
  }),
  opticsConcept({
    id: "optics.reflection", module: "reflection", title: "光的反射定律",
    inquiryQuestion: "改变入射方向后，以法线为基准的两个角怎样变化？",
    prerequisites: ["入射点与法线", "角的测量"],
    evidenceCriteria: ["角度均相对法线读取", "同一入射角具有对应反射角", "更换入射角后仍能重复比较"],
    misconceptions: [
      { id: "angle-from-mirror", claim: "入射角是入射光线与镜面的夹角", triggers: ["入射角是光线和镜面", "相对镜面量", "与镜面的夹角"], correction: "入射角和反射角都以法线为基准测量，不能把光线与镜面的夹角当作入射角。", probe: "把同一条光线分别标出它与镜面、与法线的夹角，哪一个用于反射定律？" },
      { id: "diffuse-no-law", claim: "漫反射不遵守反射定律", triggers: ["漫反射不遵守", "漫反射没有规律", "漫反射不符合"], correction: "粗糙表面各微小位置的法线方向不同，但每一束光在局部仍遵守反射定律。", probe: "选粗糙表面上的一个微小位置，重新画出该处法线。" }
    ],
    hintLadder: ["先找到入射点，再画过入射点且垂直镜面的法线。", "只改变入射角，分别读取法线两侧的角度。", "记录两组“入射角—反射角”，再判断相等关系是否重复出现。"],
    connections: ["平面镜成像", "EUV 反射镜", "光路可逆"]
  }),
  opticsConcept({
    id: "optics.refraction", module: "refraction", title: "光的折射规律",
    inquiryQuestion: "光跨过两种介质的分界面时，传播方向与介质组合有什么关系？",
    prerequisites: ["法线与入射角", "两种透明介质"],
    evidenceCriteria: ["区分入射角和折射角", "固定介质只改变入射角", "反向更换介质后重新判断偏折方向"],
    misconceptions: [
      { id: "always-toward-normal", claim: "折射光总是向法线靠近", triggers: ["总是向法线", "折射一定靠近法线", "都会靠近法线"], correction: "偏折方向取决于光从哪种介质进入哪种介质；反向传播时通常会远离法线。", probe: "交换空气和玻璃的位置，保持入射角相同再比较。" },
      { id: "always-bends", claim: "光进入另一种介质一定会改变方向", triggers: ["一定会改变方向", "垂直入射也偏折", "一定发生偏折"], correction: "垂直入射时传播速度会改变，但方向可以保持不变。", probe: "把入射光调到沿法线方向，观察折射光是否转向。" }
    ],
    hintLadder: ["先判断光从哪一种介质进入哪一种介质。", "保持介质组合不变，只给入射角设置两个取值。", "写出介质方向、入射角和折射角三项证据，不使用“总是”作过度概括。"],
    connections: ["水中视深", "透镜成像", "负折射材料"]
  }),
  opticsConcept({
    id: "optics.color-mix", module: "color-mix", title: "色光的加法混合",
    inquiryQuestion: "红、绿、蓝三束色光的强度比例怎样改变重叠区域颜色？",
    prerequisites: ["单色光与复色光", "眼睛的颜色感觉"],
    evidenceCriteria: ["先分别观察单束色光", "只叠加两束形成对照", "三束等比例与不同比例均有记录"],
    misconceptions: [{ id: "light-equals-paint", claim: "色光混合与颜料混合遵守同一规律", triggers: ["和颜料一样", "色光就是颜料", "混合规律相同"], correction: "色光叠加属于加色混合，颜料混合主要是选择性吸收后的减色过程，两者不能混用。", probe: "比较红光加绿光与红颜料加绿颜料的结果。" }],
    hintLadder: ["先只打开一束光，确认每束光的颜色。", "保持其中一束强度不变，只逐渐增加第二束。", "分别记录单束、两束和三束重叠区域的颜色。"],
    connections: ["Micro RGB", "屏幕像素", "彩色摄影"]
  }),
  opticsConcept({
    id: "optics.celestial", module: "celestial", title: "影区与食现象",
    inquiryQuestion: "太阳、地球和月球怎样排列时，影区会落到另一个天体上？",
    prerequisites: ["光的直线传播", "本影与半影"],
    evidenceCriteria: ["沿太阳光方向观察排列", "区分日食与月食的遮挡者", "指出本影实际落点"],
    misconceptions: [{ id: "monthly-eclipse", claim: "每次新月和满月都会发生日食或月食", triggers: ["每个月都日食", "每次满月都月食", "每次新月都日食"], correction: "月球轨道面与地球公转轨道面存在夹角，多数时候三个天体并不精确进入同一影区。", probe: "保持前后顺序不变，让月球稍微离开太阳—地球连线，观察影区落点。" }],
    hintLadder: ["先从太阳一侧判断三个天体的前后顺序。", "再沿光线方向追踪遮挡天体后方的本影。", "用“谁挡住谁的光、影落到哪里”解释日食或月食。"],
    connections: ["小孔成像", "本影与半影", "凌日观测"]
  }),
  opticsConcept({
    id: "optics.plane-mirror", module: "plane-mirror", title: "平面镜成像",
    inquiryQuestion: "移动物体与观察者后，像的位置、大小和能否被光屏承接怎样变化？",
    prerequisites: ["光的反射", "反向延长线"],
    evidenceCriteria: ["物与像到镜面距离可比较", "移动观察位置仍能看到镜后像", "光屏不能在镜后承接清晰像"],
    misconceptions: [
      { id: "farther-smaller", claim: "物体离平面镜越远，像本身越小", triggers: ["离镜越远像越小", "平面镜像变小", "远了像就小"], correction: "理想平面镜所成像与物等大；视觉上显得更小是视角变化，不是像的实际大小改变。", probe: "用等高标尺比较物和像，而不是只凭眼睛判断视角。" },
      { id: "virtual-on-screen", claim: "平面镜后的像可以直接落在光屏上", triggers: ["像能落在光屏", "光屏接到平面镜像", "虚像能承接"], correction: "镜后像由反射光的反向延长线相交形成，镜后没有真实光线会聚，因此不能直接被光屏承接。", probe: "把光屏放到像的位置，再检查光屏上是否出现独立清晰图像。" }
    ],
    hintLadder: ["先追踪真正进入眼睛的反射光。", "把反射光向镜后反向延长，找延长线交点。", "用等距、等大和光屏检验三类证据判断虚像。"],
    connections: ["AR 半透半反", "无底洞装置", "潜望镜"]
  }),
  opticsConcept({
    id: "optics.curved-mirror", module: "curved-mirror", title: "凹面镜与凸面镜",
    inquiryQuestion: "镜面曲率怎样改变反射光的会聚、发散和观察视野？",
    prerequisites: ["反射定律", "主光轴与焦点"],
    evidenceCriteria: ["二维光路与三维视图互相核对", "区分真实光线与延长线", "分别记录凹面镜和凸面镜结果"],
    misconceptions: [{ id: "convex-magnifies", claim: "凸面镜会把物体放大", triggers: ["凸面镜放大", "凸面镜成放大像", "凸面镜看得更大"], correction: "对真实物体，凸面镜通常形成正立、缩小的虚像，正因为像缩小才获得更大视野。", probe: "切换凸面镜，比较像高和同一镜面内能看见的范围。" }],
    hintLadder: ["先向镜面发出近轴平行光。", "区分反射光实际会聚与反向延长线相交。", "同时记录像的虚实、大小和视野，不能只写“会聚或发散”。"],
    connections: ["汽车后视镜", "太阳灶", "反射式望远镜"]
  }),
  opticsConcept({
    id: "optics.invisible-light", module: "invisible-light", title: "红外线与紫外线",
    inquiryQuestion: "看不见的辐射怎样通过探测器转化为可观察证据？",
    prerequisites: ["可见光范围", "探测器与伪彩显示"],
    evidenceCriteria: ["区分光源信号与屏幕伪彩", "更换阻挡材料形成对比", "应用说明包含安全边界"],
    misconceptions: [{ id: "infrared-is-red", claim: "红外线就是很暗的红光", triggers: ["红外就是红光", "很暗的红光", "红外线能直接看见"], correction: "红外线波长位于可见红光之外，人眼不能直接看见；屏幕颜色通常是探测器添加的伪彩。", probe: "同时观察遥控器发射管和摄像头画面，哪一个才是探测后的显示？" }],
    hintLadder: ["先确认观察来自人眼还是探测器。", "只更换一种阻挡材料，比较探测器读数。", "把波段、探测方式、用途与安全限制写在同一条记录中。"],
    connections: ["热成像", "紫外荧光", "遥控通信"]
  }),
  opticsConcept({
    id: "optics.magnifier", module: "magnifier", title: "放大镜",
    inquiryQuestion: "物距与焦距满足什么关系时，眼睛能看见正立放大的虚像？",
    prerequisites: ["凸透镜会聚作用", "实像与虚像"],
    evidenceCriteria: ["物体跨越焦点形成对比", "追踪折射光反向延长线", "用光屏检验虚像"],
    misconceptions: [{ id: "farther-always-bigger", claim: "物体离放大镜越远，看到的像一定越大", triggers: ["越远放大越大", "离透镜越远像越大", "越远越大"], correction: "放大镜要求物体在焦点以内；越过焦点后像的虚实和正倒会发生根本变化，不能用单一的“越远越大”概括。", probe: "让物体从焦内移动到焦外，并同时用光屏检验。" }],
    hintLadder: ["先标出焦点，不要只看像的大小。", "让物体分别位于焦内和焦外，检查光屏能否承接。", "用物距与焦距关系、正倒、大小、虚实四项描述结果。"],
    connections: ["阅读放大镜", "凸透镜成像", "显微镜目镜"]
  }),
  opticsConcept({
    id: "optics.bench", module: "bench", title: "凸透镜成像规律",
    inquiryQuestion: "物距跨过焦点和二倍焦距时，像的位置与性质怎样改变？",
    prerequisites: ["焦距与二倍焦距", "三条特殊光线"],
    evidenceCriteria: ["光具座器材同轴且等高", "每组物距都重新寻找清晰像", "完整记录物距、像距、大小、正倒和虚实"],
    misconceptions: [{ id: "screen-anywhere", claim: "只要有凸透镜，光屏放在哪里都能得到清晰像", triggers: ["光屏放哪都清晰", "任何位置都能成像", "随便放光屏"], correction: "光屏必须位于折射光实际会聚的像面；偏离像面只能得到模糊光斑。", probe: "固定物体与透镜，只前后移动光屏寻找最清晰位置。" }],
    hintLadder: ["先保证烛焰、透镜和光屏中心大致等高。", "固定物体和透镜，只移动光屏寻找最清晰像。", "再改变物距，重新找像并记录五项证据，不能沿用上组光屏位置。"],
    connections: ["照相机", "投影仪", "放大镜"]
  }),
  opticsConcept({
    id: "optics.camera", module: "camera", title: "照相机成像",
    inquiryQuestion: "景物距离、镜头焦距和传感器位置怎样共同决定清晰图像？",
    prerequisites: ["凸透镜实像", "像面与对焦"],
    evidenceCriteria: ["光线实际会聚在传感器", "改变物距后需要重新对焦", "区分传感器原始像与屏幕显示方向"],
    misconceptions: [{ id: "sensor-upright", claim: "相机传感器上直接形成正立的像", triggers: ["传感器上正立", "相机里面正立", "底片上的像正立"], correction: "一般拍摄条件下，镜头在传感器上形成倒立、缩小的实像；电子系统随后可以旋转和处理显示画面。", probe: "沿景物顶部的代表光线追踪到传感器位置。" }],
    hintLadder: ["先找镜头后的真实会聚位置。", "固定镜头，只移动传感器寻找最清晰像面。", "分开描述光学成像方向与电子屏幕最终显示方向。"],
    connections: ["手机多摄", "人眼成像", "计算摄影"]
  }),
  opticsConcept({
    id: "optics.eye", module: "eye", title: "眼睛的成像与调节",
    inquiryQuestion: "看远与看近时，眼睛怎样让像继续落在固定的视网膜上？",
    prerequisites: ["凸透镜成实像", "焦距与会聚能力"],
    evidenceCriteria: ["视网膜位置保持固定", "比较远近物体时晶状体曲度", "像最终落在视网膜"],
    misconceptions: [{ id: "lens-moves", claim: "眼睛通过前后移动晶状体完成对焦", triggers: ["晶状体前后移动", "眼睛移动镜头", "晶状体移动对焦"], correction: "正常眼睛主要通过睫状肌改变晶状体形状和会聚能力，而不是像普通相机镜头那样大幅前后移动。", probe: "保持视网膜位置不动，比较看远和看近时晶状体曲度。" }],
    hintLadder: ["先固定视网膜位置。", "切换远近物体，只比较晶状体曲度和会聚能力。", "用“物体变近—晶状体……—像仍落在……”完成因果链。"],
    connections: ["照相机", "近视与远视", "视觉健康"]
  }),
  opticsConcept({
    id: "optics.correction", module: "correction", title: "近视与远视矫正",
    inquiryQuestion: "未矫正焦点位于视网膜哪一侧，应该用哪种透镜改变入眼光线？",
    prerequisites: ["眼睛成像", "凸透镜与凹透镜作用"],
    evidenceCriteria: ["先判断未矫正焦点位置", "加入镜片后重新追踪光路", "焦点回到视网膜才算完成"],
    misconceptions: [{ id: "myopia-convex", claim: "近视眼应该用凸透镜矫正", triggers: ["近视用凸透镜", "近视戴凸透镜", "近视镜是凸透镜"], correction: "近视眼远处来光会聚在视网膜前，需要凹透镜先使光适当发散，再由眼睛会聚到视网膜。", probe: "先找未矫正焦点，再分别加入凹、凸透镜比较落点。" }],
    hintLadder: ["先不选镜片，只判断焦点在视网膜前还是后。", "根据需要让入眼光先发散还是先会聚选择镜片。", "加入镜片后必须重新追踪光路，确认焦点落回视网膜。"],
    connections: ["凹透镜", "凸透镜", "眼镜处方"]
  }),
  opticsConcept({
    id: "optics.instruments", module: "instruments", title: "显微镜与望远镜",
    inquiryQuestion: "物镜和目镜分别形成什么像，又怎样共同扩大观察细节或视角？",
    prerequisites: ["凸透镜成像", "放大镜"],
    evidenceCriteria: ["分别描述物镜和目镜作用", "区分中间像与最终观察像", "显微镜与望远镜分别建立光路"],
    misconceptions: [{ id: "single-lens", claim: "显微镜和望远镜只是一个更强的放大镜", triggers: ["就是一个放大镜", "只有一块透镜", "单个透镜放大"], correction: "典型显微镜和折射式望远镜由物镜与目镜分工：物镜先形成中间像，目镜再放大观察角。", probe: "先遮住目镜或物镜之一，判断完整成像链是否还能成立。" }],
    hintLadder: ["先只分析物镜形成的中间像。", "再把中间像当作目镜的观察对象。", "分别写出两级成像的物、像和作用，不把两个透镜合成一句“放大”。"],
    connections: ["放大镜", "天文观测", "微观成像"]
  })
];

const soundConcepts: HarnessConceptNode[] = [
  domainConcept("sound", {
    id: "sound.medium", module: "sound-medium", title: "声音的产生与传播",
    inquiryQuestion: "发声体、传播介质和接收距离分别怎样影响我们听到的声音？",
    prerequisites: ["物体振动", "声音强弱"],
    evidenceCriteria: ["确认发声体正在振动", "只改变介质或距离中的一个条件", "用接收强度而不是主观感觉形成对比"],
    misconceptions: [{ id: "sound-in-vacuum", claim: "真空也能把声音直接传过来", triggers: ["真空能传声", "真空也能听到", "声音不需要介质"], correction: "声音是机械振动的传播，需要气体、液体或固体等介质；真空不能直接传声。", probe: "保持声源振动不变，逐渐减少容器中的空气，比较接收强度。" }],
    hintLadder: ["先找出装置中真正振动的部分。", "保持声源不变，只改变空气量或传播距离。", "记录两组接收强度，再说明变化来自哪个条件。"],
    connections: ["真空铃实验", "骨传导", "太空通信"]
  }),
  domainConcept("sound", {
    id: "sound.features", module: "sound-features", title: "声音的三个特性",
    inquiryQuestion: "波形的振幅和频率分别与响度、音调有什么对应关系？",
    prerequisites: ["周期振动", "波形读图"],
    evidenceCriteria: ["固定振幅只改变频率", "固定频率只改变振幅", "分别记录听感与波形变化"],
    misconceptions: [{ id: "pitch-volume", claim: "音调越高，声音一定越响", triggers: ["音调高就响", "频率大声音响", "高音更响"], correction: "音调主要与频率有关，响度主要与振幅和距离有关；二者是不同维度。", probe: "保持振幅不变只提高频率，再保持频率不变只增大振幅。" }],
    hintLadder: ["先只观察波形疏密，不看高度。", "固定频率，再改变振幅形成第二组实验。", "用两组控制变量证据分别解释音调和响度。"],
    connections: ["乐器调音", "声纹", "超声波"]
  }),
  domainConcept("sound", {
    id: "sound.noise", module: "sound-noise", title: "噪声与控制",
    inquiryQuestion: "从声源、传播途中和接收端采取措施，接收处声音会怎样变化？",
    prerequisites: ["声音传播", "声级"],
    evidenceCriteria: ["说明测量位置", "一次只采用一种控制措施", "比较控制前后的接收读数"],
    misconceptions: [{ id: "noise-unpleasant", claim: "只有难听的声音才算噪声", triggers: ["难听才是噪声", "好听的不是噪声", "噪声就是难听"], correction: "从环境保护角度看，凡是妨碍人们正常休息、学习和工作的声音，都可能成为噪声。", probe: "把同一段音乐分别放在音乐会和考试环境中，判断它是否造成干扰。" }],
    hintLadder: ["先固定接收者的位置。", "选择声源、传播途中或接收端的一处进行控制。", "写出措施位置、控制前读数和控制后读数。"],
    connections: ["隔音材料", "消声器", "主动降噪"]
  }),
  domainConcept("sound", {
    id: "sound.echo", module: "sound-echo", title: "回声测距",
    inquiryQuestion: "声速和回声往返时间怎样决定声源到障碍物的距离？",
    prerequisites: ["速度公式", "声音反射"],
    evidenceCriteria: ["时间是发射到接收的往返时间", "声速与介质条件匹配", "计算结果包含二分之一"],
    misconceptions: [{ id: "echo-one-way", claim: "障碍物距离等于声速乘回声时间", triggers: ["距离等于声速乘时间", "s=vt不用除2", "回声不除二"], correction: "回声时间对应声音到达障碍物再返回的总路程，单程距离应取总路程的一半。", probe: "在声源与墙面之间画出出发和返回两段等长路径。" }],
    hintLadder: ["先画出声音去和回的两段路径。", "用声速乘往返时间求总路程。", "把总路程除以二，并检查单位。"],
    connections: ["声呐", "超声测距", "雷达测距对比"]
  })
];

const mechanicsConcepts: HarnessConceptNode[] = [
  domainConcept("mechanics", {
    id: "mechanics.speed", module: "mechanics-speed", title: "运动与平均速度",
    inquiryQuestion: "通过不同路程并经历不同时间时，怎样比较运动的快慢？",
    prerequisites: ["路程", "时间测量"],
    evidenceCriteria: ["路程与时间来自同一段运动", "统一单位后计算", "平均速度用总路程除以总时间"],
    misconceptions: [{ id: "average-of-speeds", claim: "平均速度就是各段速度直接相加再平均", triggers: ["速度直接平均", "各段速度平均", "平均速度取平均"], correction: "一般情况下应使用总路程除以总时间；只有各段时间相等时，速度的算术平均才恰好适用。", probe: "设置两段路程相等但速度不同，比较两种算法的结果。" }],
    hintLadder: ["先圈出同一段运动对应的路程和时间。", "把各段路程、时间分别相加。", "用总路程除以总时间，并写清单位。"],
    connections: ["交通测速", "运动图像", "百米赛跑"]
  }),
  domainConcept("mechanics", {
    id: "mechanics.friction", module: "mechanics-friction", title: "滑动摩擦力",
    inquiryQuestion: "压力和接触面粗糙程度怎样影响滑动摩擦力？",
    prerequisites: ["二力平衡", "弹簧测力计"],
    evidenceCriteria: ["物体在水平面上匀速运动", "测力计沿运动方向拉", "压力与粗糙程度分别形成控制变量对比"],
    misconceptions: [{ id: "friction-equals-pull", claim: "只要拉动物体，测力计示数就一定等于摩擦力", triggers: ["拉力一定等于摩擦力", "示数就是摩擦力", "怎么拉都相等"], correction: "只有在水平匀速等特定平衡条件下，拉力大小才可用来间接测量滑动摩擦力。", probe: "比较匀速、加速拉动时测力计示数是否相同。" }],
    hintLadder: ["先让物体保持水平匀速运动。", "固定接触面，只增加物体对水平面的压力。", "再固定压力更换接触面，分开写出两组证据。"],
    connections: ["轮胎花纹", "冰壶", "轴承"]
  }),
  domainConcept("mechanics", {
    id: "mechanics.lever", module: "mechanics-lever", title: "杠杆平衡",
    inquiryQuestion: "力的大小与力臂怎样配合才能使杠杆平衡？",
    prerequisites: ["支点", "力臂"],
    evidenceCriteria: ["力臂是支点到力的作用线的垂直距离", "杠杆静止或匀速转动", "比较两侧力与力臂乘积"],
    misconceptions: [{ id: "lever-force-only", claim: "杠杆哪边的力大，哪边一定下沉", triggers: ["力大就下沉", "只看力大小", "重的一边一定下沉"], correction: "杠杆的转动效果同时由力和力臂决定，应比较两侧力与力臂的乘积。", probe: "让较小的力作用在更长力臂上，观察能否平衡较大的力。" }],
    hintLadder: ["先标出支点和两侧力的作用线。", "分别测出支点到作用线的垂直距离。", "比较两侧力与力臂的乘积，而不只比较力。"],
    connections: ["跷跷板", "剪刀", "起重机"]
  }),
  domainConcept("mechanics", {
    id: "mechanics.pressure", module: "mechanics-pressure", title: "压力作用效果与压强",
    inquiryQuestion: "压力和受力面积怎样共同决定压力的作用效果？",
    prerequisites: ["压力", "面积"],
    evidenceCriteria: ["压力垂直作用于受力面", "分别控制压力和受力面积", "用相同材料上的凹陷或压强读数比较"],
    misconceptions: [{ id: "area-pressure", claim: "接触面积越大，压强一定越大", triggers: ["面积大压强大", "接触面越大越压", "面积越大作用越强"], correction: "在压力相同时，受力面积越大，压强反而越小；必须同时说明压力是否保持不变。", probe: "让同一物体分别平放和竖放在相同软垫上。" }],
    hintLadder: ["先说明压力是否相同。", "只改变受力面积，比较单位面积上的作用效果。", "再固定面积改变压力，用两组证据说明 p=F/S。"],
    connections: ["履带", "针尖", "雪橇"]
  }),
  domainConcept("mechanics", {
    id: "mechanics.buoyancy", module: "mechanics-buoyancy", title: "浮力与物体浮沉",
    inquiryQuestion: "物体和液体的密度关系怎样影响物体上浮、悬浮或下沉？",
    prerequisites: ["重力", "液体密度"],
    evidenceCriteria: ["物体自由浸没且不受外力", "比较浮力与重力或平均密度", "区分运动过程与最终漂浮状态"],
    misconceptions: [{ id: "floating-no-gravity", claim: "物体漂浮时不再受到重力", triggers: ["漂浮没有重力", "浮起来重力消失", "水上不受重力"], correction: "漂浮物仍受重力，静止时浮力与重力大小相等、方向相反。", probe: "给漂浮物画受力图，检查竖直方向合力为何为零。" }],
    hintLadder: ["先画出物体受到的重力和浮力。", "保持物体不变，只改变液体密度。", "分别记录初始运动方向和最终状态。"],
    connections: ["轮船", "潜水艇", "热气球类比"]
  })
];

const circuitConcepts: HarnessConceptNode[] = [
  domainConcept("circuit", {
    id: "circuit.basic", module: "circuit-basic", title: "串联与并联电路",
    inquiryQuestion: "开关闭合后，电流路径和各用电器的工作状态有什么关系？",
    prerequisites: ["完整回路", "电路元件符号"],
    evidenceCriteria: ["电源两极之间形成闭合路径", "区分干路和支路", "通过断开一个元件比较其他元件状态"],
    misconceptions: [{ id: "current-used-up", claim: "电流经过第一个灯泡后会被用掉一些", triggers: ["电流被用掉", "把电流用掉", "后一个灯电流更小", "灯泡消耗电流"], correction: "稳定串联电路中各处电流相等；用电器转化的是电能，不能说电流沿途被消耗。", probe: "把电流表依次接到串联电路不同位置比较示数。" }],
    hintLadder: ["先沿导线寻找从电源一极回到另一极的闭合路径。", "断开一个用电器，观察其余用电器是否仍有完整路径。", "用路径数量和各处电流证据判断串联或并联。"],
    connections: ["家庭电路", "节日彩灯", "故障排查"]
  }),
  domainConcept("circuit", {
    id: "circuit.ohm", module: "circuit-ohm", title: "电流与电压、电阻",
    inquiryQuestion: "固定一个量时，电流怎样随电压或电阻改变？",
    prerequisites: ["电流表与电压表", "控制变量"],
    evidenceCriteria: ["电流表串联、电压表并联", "分两轮分别固定电阻和电压", "每轮至少记录两组数据"],
    misconceptions: [{ id: "resistance-from-ratio", claim: "导体电阻会因为电压变大而按 R=U/I 变大", triggers: ["电压大电阻就大", "R随U增大", "电阻由电压决定"], correction: "对温度等条件不变的同一导体，电阻是导体本身的属性；R=U/I 是计算关系，不表示电阻由电压产生。", probe: "改变同一电阻两端电压，分别计算 U/I 是否近似不变。" }],
    hintLadder: ["先确认电表接法和量程。", "固定电阻改变电压，再固定电压改变电阻。", "用表格记录 U、I、R，并检查每一轮真正保持不变的量。"],
    connections: ["调光电路", "传感器", "安全用电"]
  }),
  domainConcept("circuit", {
    id: "circuit.power", module: "circuit-power", title: "电功率与电能",
    inquiryQuestion: "用电器做功的快慢与消耗电能的多少有什么区别？",
    prerequisites: ["电压与电流", "时间"],
    evidenceCriteria: ["功率用同一时刻的电压和电流计算", "比较电能时同时记录时间", "区分额定功率与实际功率"],
    misconceptions: [{ id: "power-equals-energy", claim: "功率越大的电器一定越费电", triggers: ["功率大一定费电", "瓦数大耗电一定多", "功率就是电能"], correction: "功率表示用电器做功的快慢，消耗电能还取决于使用时间，关系为 W=Pt。", probe: "比较大功率短时间与小功率长时间工作的电能。" }],
    hintLadder: ["先区分功率单位瓦和电能单位焦耳或千瓦时。", "固定工作时间比较不同功率，或固定功率比较时间。", "用 W=Pt 计算并说明比较条件。"],
    connections: ["电费", "灯具能效", "家电铭牌"]
  }),
  domainConcept("circuit", {
    id: "circuit.magnet", module: "circuit-magnet", title: "电流的磁效应",
    inquiryQuestion: "电流方向、大小和线圈匝数怎样改变电磁铁？",
    prerequisites: ["磁极", "电流方向"],
    evidenceCriteria: ["固定铁芯材料和形状", "电流与匝数分别形成对比", "改变电流方向时观察磁极而不是只看强弱"],
    misconceptions: [{ id: "magnet-direction-strength", claim: "把电流方向反过来会让电磁铁失去磁性", triggers: ["反接就没磁性", "电流反向磁性消失", "反方向没有磁场"], correction: "电流方向反向主要使电磁铁两端磁极对调；在电流大小不变时，磁性强弱不因此消失。", probe: "保持电流大小不变，只反接电源并用小磁针辨别磁极。" }],
    hintLadder: ["先决定要比较磁性强弱还是磁极方向。", "比较强弱时一次只改变电流或匝数。", "研究方向时保持电流大小不变，只反接电源并记录磁极。"],
    connections: ["电磁继电器", "电铃", "起重电磁铁"]
  })
];

const thermalConcepts: HarnessConceptNode[] = [
  domainConcept("thermal", {
    id: "thermal.thermometer", module: "thermal-thermometer", title: "温度计的使用",
    inquiryQuestion: "怎样根据量程、分度值和液柱位置得到可靠温度？",
    prerequisites: ["温度", "刻度读取"],
    evidenceCriteria: ["测量前检查量程和分度值", "玻璃泡充分接触被测物且不碰容器", "示数稳定并平视液柱末端"],
    misconceptions: [{ id: "thermometer-remove", claim: "体温计和实验室温度计都可以离开被测物后读数", triggers: ["温度计拿出来读", "都能离开读数", "离开液体再读"], correction: "普通实验室温度计通常应留在被测物中读数；体温计因结构特殊才可离开人体读数。", probe: "比较两类温度计细管结构与液柱是否会自动回落。" }],
    hintLadder: ["先读量程和最小分度。", "让玻璃泡充分接触被测物并等待稳定。", "视线与液柱末端相平，带单位记录。"],
    connections: ["体温计", "气象观测", "红外测温"]
  }),
  domainConcept("thermal", {
    id: "thermal.boiling", module: "thermal-boiling", title: "观察水的沸腾",
    inquiryQuestion: "水达到沸点前后，温度和气泡运动怎样变化？",
    prerequisites: ["温度测量", "汽化"],
    evidenceCriteria: ["连续等时间间隔记录温度", "同时观察气泡变化", "确认继续加热且温度平台稳定出现"],
    misconceptions: [{ id: "boiling-keeps-rising", claim: "水沸腾后继续加热，温度会一直升高", triggers: ["沸腾后温度继续升", "越烧越热", "沸腾温度一直上升"], correction: "在气压稳定且水未烧干时，水沸腾过程中继续吸热，温度保持在沸点附近。", probe: "继续加热并按相同时间间隔记录沸腾后的温度。" }],
    hintLadder: ["从沸腾前开始连续记录，不只测一个时刻。", "观察气泡在水中上升时大小怎样改变。", "结合温度—时间曲线平台和继续吸热两个证据解释。"],
    connections: ["高压锅", "高原煮食", "蒸汽利用"]
  }),
  domainConcept("thermal", {
    id: "thermal.melting", module: "thermal-melting", title: "晶体的熔化",
    inquiryQuestion: "冰在固态、熔化过程和液态阶段的温度怎样变化？",
    prerequisites: ["物态变化", "吸热"],
    evidenceCriteria: ["等时间间隔记录温度与状态", "熔化阶段继续加热", "用平台区间而非单个读数判断熔点"],
    misconceptions: [{ id: "all-solids-plateau", claim: "所有固体熔化时温度都保持不变", triggers: ["所有固体熔化不升温", "固体都有熔点", "熔化温度都不变"], correction: "晶体在一定条件下有固定熔点，非晶体通常在一段温度范围内逐渐软化。", probe: "比较冰与蜡加热曲线是否都出现稳定平台。" }],
    hintLadder: ["同时记录温度和物质状态。", "找到固液共存且继续吸热的时间段。", "比较该时间段温度是否形成平台，再判断材料类型。"],
    connections: ["冰雪融化", "金属铸造", "非晶材料"]
  }),
  domainConcept("thermal", {
    id: "thermal.evaporation", module: "thermal-evaporation", title: "影响蒸发快慢的因素",
    inquiryQuestion: "温度、液面面积和液面上方空气流动怎样影响蒸发？",
    prerequisites: ["汽化", "控制变量"],
    evidenceCriteria: ["初始液体质量或体积相同", "一次只改变一个主要因素", "在相同时间内比较减少量"],
    misconceptions: [{ id: "evaporation-only-hot", claim: "液体只有达到沸点才会蒸发", triggers: ["沸腾才蒸发", "不到沸点不蒸发", "加热后才能蒸发"], correction: "蒸发可在任何温度下发生，只在液体表面进行；升温通常只是使蒸发加快。", probe: "观察室温下敞口水面经过一段时间是否也有减少。" }],
    hintLadder: ["先让两组液体初始量相同。", "温度、表面积、空气流动三者中只改变一个。", "在相同时间内比较液体减少量，并重复一次。"],
    connections: ["晾衣服", "吹风降温", "保鲜膜"]
  })
];

const measurementConcepts: HarnessConceptNode[] = [
  domainConcept("measurement", {
    id: "measurement.balance", module: "measurement-balance", title: "托盘天平测质量",
    inquiryQuestion: "怎样完成调平、加砝码和游码读数，得到可靠质量？",
    prerequisites: ["质量", "刻度读取"],
    evidenceCriteria: ["测量前游码归零并用平衡螺母调平", "左物右码且用镊子取放砝码", "平衡后质量等于砝码总量加游码示数"],
    misconceptions: [{ id: "balance-adjust-during", claim: "称量过程中可以调平衡螺母让横梁重新平衡", triggers: ["称量时调螺母", "称量时可以调螺母", "用平衡螺母称量", "放物体后调平衡"], correction: "平衡螺母只用于测量前的空载调平；称量时应通过增减砝码和移动游码恢复平衡。", probe: "空载调平后放上物体，只操作砝码与游码完成称量。" }],
    hintLadder: ["空载时先把游码移到零刻线。", "用平衡螺母调平后再放物体，先加大砝码。", "用小砝码和游码微调，最后相加并写单位。"],
    connections: ["药品称量", "质量标准", "电子天平"]
  }),
  domainConcept("measurement", {
    id: "measurement.mass-volume", module: "measurement-mass-volume", title: "质量与体积的关系",
    inquiryQuestion: "同种物质的质量随体积怎样变化，二者比值是否稳定？",
    prerequisites: ["质量测量", "体积测量"],
    evidenceCriteria: ["样品材料与状态相同", "至少测量三组不同体积", "分别比较质量、体积和质量体积比"],
    misconceptions: [{ id: "mass-means-density", claim: "物体质量越大，密度一定越大", triggers: ["质量大密度大", "越重密度越大", "质量决定密度"], correction: "密度是质量与体积的比值；同种材料做成更大物体，质量和体积会同时增大而密度不变。", probe: "比较同种材料大小不同的两个样品的 m/V。" }],
    hintLadder: ["先确认各样品是同种材料且状态相同。", "依次记录每个样品的质量和体积。", "计算每组 m/V，看比值是否近似稳定。"],
    connections: ["材料鉴别", "密度图像", "轻量化设计"]
  }),
  domainConcept("measurement", {
    id: "measurement.density", module: "measurement-density", title: "测量固体密度",
    inquiryQuestion: "怎样用质量和排水体积确定不规则固体的密度？",
    prerequisites: ["天平", "量筒读数"],
    evidenceCriteria: ["先测质量且记录单位", "物体完全浸没、无气泡且不吸水", "固体体积取两次液面示数之差"],
    misconceptions: [{ id: "final-volume", claim: "物体体积就是放入后量筒的最终示数", triggers: ["最终示数就是体积", "放入后的读数是物体体积", "直接用总体积"], correction: "排水法中固体体积等于放入后的总体积减去原有液体体积。", probe: "同时标出放入前 V1 和放入后 V2，计算 V2−V1。" }],
    hintLadder: ["先用天平测出干燥物体质量。", "读出放入前液体体积，再让物体完全浸没。", "用体积差求物体体积，再计算密度并检查单位。"],
    connections: ["材料鉴别", "阿基米德故事", "质量控制"]
  }),
  domainConcept("measurement", {
    id: "measurement.liquid-density", module: "measurement-liquid-density", title: "测量液体密度",
    inquiryQuestion: "怎样排除容器质量的影响，得到液体净质量与体积？",
    prerequisites: ["天平", "量筒"],
    evidenceCriteria: ["容器质量单独测量或去皮", "液体质量扣除容器质量", "量筒平视凹液面最低处并分析残留误差"],
    misconceptions: [{ id: "container-included", claim: "装有液体的容器总质量可以直接除以液体体积", triggers: ["总质量除体积", "烧杯和液体一起算", "不用减容器"], correction: "密度计算中的质量必须是液体净质量，应扣除容器质量或先完成去皮。", probe: "分别记录空容器和容器加液体的质量，再求差。" }],
    hintLadder: ["先测空容器质量或进行去皮。", "测容器和液体总质量，求出液体净质量。", "读取液体体积并计算密度，同时说明转移残留可能造成的误差。"],
    connections: ["牛奶品质", "盐水配制", "液体分选"]
  })
];

const allConcepts = [...opticsConcepts, ...soundConcepts, ...mechanicsConcepts, ...circuitConcepts, ...thermalConcepts, ...measurementConcepts];
const conceptByModule = new Map(allConcepts.map((concept) => [concept.module, concept]));

export function getHarnessConceptNode(module: string): HarnessConceptNode | undefined {
  return conceptByModule.get(module);
}

export function listHarnessConceptNodes(area?: HarnessArea): HarnessConceptNode[] {
  return area ? allConcepts.filter((concept) => concept.area === area) : [...allConcepts];
}

export function findHarnessMisconception(module: string, text: string): HarnessMisconception | undefined {
  const normalized = text.replace(/[，。！？、,.!?\s]/g, "").toLowerCase();
  return getHarnessConceptNode(module)?.misconceptions.find((item) => item.triggers.some((trigger) => normalized.includes(trigger.replace(/\s/g, "").toLowerCase())));
}
