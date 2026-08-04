export type PhysicsGraphDomain = "light" | "sound" | "mechanics" | "circuit" | "thermal" | "measurement";

export interface PhysicsKnowledgeNode {
  id: string;
  domain: PhysicsGraphDomain;
  title: string;
  route: string;
  concepts: string[];
  signals: string[];
  question: string;
  guidance: string;
  evidence: string;
  related: string[];
}

export interface KnowledgeGraphQuestion {
  mark: string;
  domain: PhysicsGraphDomain;
  text: string;
  to: string;
}

export interface KnowledgeGraphMatch {
  node: PhysicsKnowledgeNode;
  score: number;
  matchedTerms: string[];
}

export interface KnowledgeGraphSearchResult {
  found: boolean;
  title: string;
  message: string;
  to?: string;
  action?: string;
  confidence?: number;
  matchedTerms: string[];
  trail: string[];
  alternatives: Array<{ title: string; to: string; reason: string }>;
  followUps: string[];
}

export const physicsGraphDomains: Record<PhysicsGraphDomain, { label: string; mark: string; route: string; signals: string[] }> = {
  light: { label: "光现象", mark: "光", route: "/student/explore/light", signals: ["光学", "光线", "成像", "镜片", "镜子", "视觉"] },
  sound: { label: "声现象", mark: "声", route: "/student/explore/sound", signals: ["声音", "听见", "声波", "振动", "噪声", "回声"] },
  mechanics: { label: "运动与力", mark: "力", route: "/student/explore/mechanics", signals: ["运动", "受力", "机械", "平衡", "速度", "压力"] },
  circuit: { label: "电与磁", mark: "电", route: "/student/explore/circuit", signals: ["电路", "用电器", "电流", "电压", "磁场", "通电"] },
  thermal: { label: "热与物态", mark: "热", route: "/student/explore/thermal", signals: ["温度", "加热", "吸热", "放热", "物态", "冷热"] },
  measurement: { label: "质量与密度", mark: "测", route: "/student/explore/measurement", signals: ["测量", "质量", "体积", "密度", "读数", "误差"] }
};

const nodes: PhysicsKnowledgeNode[] = [
  { id: "dispersion", domain: "light", title: "光的色散", route: "/student/explore/light?mode=dispersion", concepts: ["复色光", "三棱镜", "光谱", "不同色光偏折"], signals: ["彩虹", "白光", "七色光", "光谱", "三棱镜", "色散", "红橙黄绿蓝靛紫", "水滴分光", "光屏彩带", "单色光"], question: "白光穿过三棱镜后，为什么会展开成彩色光带？", guidance: "先比较白光、单色光和 RGB 混合光，再改变棱镜角度与光屏距离。", evidence: "观察不同颜色在光屏上的落点和色带宽度。", related: ["refraction", "color-mix", "invisible-light"] },
  { id: "straight", domain: "light", title: "光的直线传播与小孔成像", route: "/student/explore/light?mode=straight", concepts: ["直线传播", "小孔成像", "本影", "倒立实像"], signals: ["小孔", "针孔", "影子", "日晷", "树荫光斑", "倒立的像", "蜡烛成像", "无影灯", "本影", "半影", "光沿直线"], question: "小孔越大，屏幕上的像为什么容易变模糊？", guidance: "拖动物体、小孔板和光屏，追踪上下两束代表光线在小孔处交叉。", evidence: "比较孔径和屏距变化时像的大小、亮度与清晰度。", related: ["celestial", "camera", "reflection"] },
  { id: "reflection", domain: "light", title: "光的反射定律", route: "/student/explore/light?mode=reflection", concepts: ["入射角", "反射角", "法线", "光路可逆"], signals: ["反射", "反光", "入射角", "反射角", "法线", "镜面反射", "漫反射", "看见物体", "反光板", "光刻机", "EUV"], question: "改变入射角时，反射光线会怎样转动？", guidance: "以法线为基准测量角度，一次只改变入射方向或镜面粗糙程度。", evidence: "验证反射角始终等于入射角，并比较镜面反射和漫反射。", related: ["plane-mirror", "curved-mirror", "refraction"] },
  { id: "refraction", domain: "light", title: "光的折射", route: "/student/explore/light?mode=refraction", concepts: ["介质界面", "折射角", "折射率", "传播方向改变"], signals: ["折射", "水中筷子", "筷子弯了", "池水变浅", "海市蜃楼", "透过玻璃", "入水偏折", "折射角", "负折射", "隐身材料", "全反射"], question: "光从空气斜射入玻璃时，为什么会向法线靠近？", guidance: "切换空气、水和玻璃，并保持入射角不变比较折射方向。", evidence: "观察介质组合改变后，折射角和传播方向如何变化。", related: ["dispersion", "bench", "invisible-light"] },
  { id: "color-mix", domain: "light", title: "色光三原色与显示", route: "/student/explore/light?mode=color-mix", concepts: ["红绿蓝", "加法混色", "子像素", "显示技术"], signals: ["三原色", "红绿蓝", "RGB", "混色", "色光混合", "像素", "屏幕颜色", "Micro LED", "Micro RGB", "显示器", "白色光"], question: "红、绿、蓝三束色光怎样混出屏幕上的各种颜色？", guidance: "分别调节 R、G、B 强度，先做两色组合，再观察三色叠加。", evidence: "读取中央重叠区域颜色和三个子像素的相对亮度。", related: ["dispersion", "camera", "eye"] },
  { id: "celestial", domain: "light", title: "日食、月食与影区", route: "/student/explore/light?mode=celestial", concepts: ["天体排列", "本影", "半影", "直线传播"], signals: ["日食", "月食", "天狗食日", "行星凌日", "太阳月球地球", "本影", "半影", "天体遮挡", "黑洞", "引力透镜", "月影"], question: "日食和月食发生时，太阳、地球、月球怎样排列？", guidance: "切换日食与月食并旋转三维视角，观察遮挡者后方的本影和半影。", evidence: "检查三个天体接近共线时，影区是否落到目标天体上。", related: ["straight", "refraction", "instruments"] },
  { id: "plane-mirror", domain: "light", title: "平面镜成像", route: "/student/explore/light?mode=plane-mirror", concepts: ["等大虚像", "像物关于镜面对称", "反向延长线", "半透半反"], signals: ["平面镜", "照镜子", "镜中像", "虚像", "像物等大", "像物等距", "镜面对称", "潜望镜", "AR 眼镜", "半透半反", "无底洞", "无限镜"], question: "镜子后面的像真的有光线在那里会聚吗？", guidance: "移动物体和观察者，再在像的位置放置光屏验证虚实；描述方向时用‘关于镜面对称’，不要简单记成左右互换。", evidence: "比较像物大小和到镜面的距离，并观察光屏能否承接清晰像。", related: ["reflection", "curved-mirror", "camera"] },
  { id: "curved-mirror", domain: "light", title: "凹面镜与凸面镜", route: "/student/explore/light?mode=curved-mirror", concepts: ["会聚", "发散", "焦点", "扩大视野"], signals: ["凹面镜", "凸面镜", "哈哈镜", "后视镜", "转角镜", "太阳灶", "手电筒反光杯", "汽车大灯", "焦点", "会聚光", "扩大视野"], question: "汽车后视镜为什么常用凸面镜而不是平面镜？", guidance: "在二维和三维间切换，比较近轴平行光经过两种曲面镜后的方向。", evidence: "观察凹面镜近轴光的会聚点以及凸面镜反射光反向延长线的位置。", related: ["reflection", "plane-mirror", "bench"] },
  { id: "invisible-light", domain: "light", title: "红外线与紫外线", route: "/student/explore/light?mode=invisible-light", concepts: ["不可见光", "红外探测", "紫外荧光", "电磁波谱"], signals: ["红外线", "紫外线", "遥控器", "热成像", "夜视仪", "体温枪", "验钞", "荧光", "消毒灯", "防晒", "不可见光", "电磁波"], question: "看不见的红外线和紫外线，怎样证明它们存在？", guidance: "选择合适探测方式和防护材料，不要把不可见理解成不存在。", evidence: "比较摄像头亮点、热图、荧光反应或探测器读数。", related: ["dispersion", "eye", "refraction"] },
  { id: "magnifier", domain: "light", title: "放大镜", route: "/student/explore/light?mode=magnifier", concepts: ["凸透镜", "焦点以内", "正立放大虚像", "反向延长线"], signals: ["放大镜", "看小字", "放大虚像", "凸透镜放大", "焦距以内", "珠宝镜", "老花镜看字", "物距小于焦距"], question: "为什么物体放到焦点以内，凸透镜才能作为放大镜？", guidance: "拖动物体跨过焦点，比较实线交点与反向延长线交点。", evidence: "用光屏检验焦点内形成的放大像是否能够承接。", related: ["bench", "camera", "eye"] },
  { id: "bench", domain: "light", title: "凸透镜成像规律", route: "/student/explore/light?mode=bench", concepts: ["物距", "像距", "焦距", "实像与虚像"], signals: ["凸透镜成像", "光具座", "蜡烛透镜光屏", "物距", "像距", "焦距", "二倍焦距", "倒立实像", "清晰像", "光屏对焦", "透镜公式"], question: "物体跨过一倍焦距和二倍焦距时，像会发生什么变化？", guidance: "固定焦距，依次移动物体与光屏，记录正倒、大小、虚实和像距。", evidence: "寻找光屏最清晰位置，并把物距与焦距、二倍焦距比较。", related: ["magnifier", "camera", "eye", "correction"] },
  { id: "camera", domain: "light", title: "照相机与自动对焦", route: "/student/explore/light?mode=camera", concepts: ["倒立缩小实像", "传感器", "对焦", "镜头焦距"], signals: ["照相机", "摄像头", "手机拍照", "相机对焦", "照片模糊", "镜头", "感光器", "传感器", "焦距", "广角", "长焦", "微距"], question: "照相机改变什么，才能让景物清晰地落在传感器上？", guidance: "改变景物距离或镜头焦距，观察像面与传感器之间的偏差。", evidence: "比较对焦前后的模糊程度和像面位置。", related: ["bench", "eye", "instruments"] },
  { id: "eye", domain: "light", title: "眼睛的成像与调节", route: "/student/explore/light?mode=eye", concepts: ["晶状体", "视网膜", "调节", "实像"], signals: ["眼睛成像", "视网膜", "晶状体", "看近处", "看远处", "眼睛对焦", "视觉", "眼疲劳", "睫状肌", "人眼像相机"], question: "视网膜不能前后移动，眼睛怎样看清远近物体？", guidance: "切换远近目标并调节晶状体等效焦距，观察像点是否落在视网膜。", evidence: "比较看近处和远处时晶状体会聚能力的变化。", related: ["camera", "correction", "invisible-light"] },
  { id: "correction", domain: "light", title: "近视与远视矫正", route: "/student/explore/light?mode=correction", concepts: ["近视", "远视", "凹透镜", "凸透镜"], signals: ["近视", "远视", "老花眼", "看不清黑板", "看不清近处", "眼镜", "凹透镜矫正", "凸透镜矫正", "焦点在视网膜前", "焦点在视网膜后"], question: "近视眼为什么用凹透镜，而远视眼常用凸透镜？", guidance: "先判断未矫正焦点在视网膜前还是后，再选择镜片验证。", evidence: "观察矫正镜片是否把最终像点移动到视网膜。", related: ["eye", "bench", "magnifier"] },
  { id: "instruments", domain: "light", title: "显微镜与望远镜", route: "/student/explore/light?mode=instruments", concepts: ["物镜", "目镜", "中间像", "组合透镜"], signals: ["显微镜", "望远镜", "天文望远镜", "目镜", "物镜", "观察细胞", "观察月球", "放大倍数", "两块透镜", "中间像"], question: "显微镜和望远镜中的物镜、目镜分别做了什么？", guidance: "分别高亮物镜与目镜，把两级成像过程拆开观察。", evidence: "比较中间像与最终观察视角，并改变两块透镜的焦距。", related: ["bench", "camera", "celestial"] },

  { id: "sound-medium", domain: "sound", title: "声音的产生与传播", route: "/student/explore/sound?module=sound-medium", concepts: ["振动", "介质", "声波", "真空不能传声"], signals: ["真空听不到", "闹钟罩", "声音传播", "发声体振动", "声带", "鼓面", "音叉", "介质", "空气传声", "固体传声", "液体传声", "土电话", "月球说话"], question: "抽走玻璃罩里的空气，闹钟仍在振动，为什么声音变小？", guidance: "分别观察声源是否振动和传播介质是否存在。", evidence: "比较空气保留程度和接收距离改变时的声音强度。", related: ["sound-features", "sound-echo", "sound-noise"] },
  { id: "sound-features", domain: "sound", title: "响度、音调与音色", route: "/student/explore/sound?module=sound-features", concepts: ["振幅", "频率", "响度", "音调", "音色"], signals: ["声音大小", "声音高低", "响度", "音调", "音色", "振幅", "频率", "波形", "琴弦", "男女声音", "辨别乐器", "调音"], question: "波形变高和变密，分别改变了声音的什么特性？", guidance: "一次只改变振幅或频率，观察波形高度和疏密。", evidence: "把振幅与响度、频率与音调分别建立对应关系。", related: ["sound-medium", "sound-noise", "sound-echo"] },
  { id: "sound-noise", domain: "sound", title: "噪声的产生与控制", route: "/student/explore/sound?module=sound-noise", concepts: ["声源控制", "传播阻断", "接收防护", "分贝"], signals: ["噪声", "分贝", "隔音", "消声器", "隔音屏", "耳罩", "装修噪声", "交通噪声", "降低声音", "吸音材料", "扰民"], question: "同一种噪声，可以在哪三个传播环节被减弱？", guidance: "分别从声源、传播途中和接收端尝试减弱噪声。", evidence: "比较每种措施实施前后的接收声级。", related: ["sound-medium", "sound-features"] },
  { id: "sound-echo", domain: "sound", title: "超声、次声与回声测距", route: "/student/explore/sound?module=sound-echo", concepts: ["超声", "次声", "回声", "往返路程"], signals: ["超声波", "次声波", "回声", "回声测距", "倒车雷达", "声呐", "B超", "蝙蝠定位", "地震监测", "声速", "往返时间"], question: "超声发出后收到回声，为什么计算距离时要除以二？", guidance: "改变回声时间和介质声速，区分总路程与单程距离。", evidence: "检查声波从发射端到目标再返回的完整路径。", related: ["sound-medium", "mechanics-speed"] },

  { id: "mechanics-speed", domain: "mechanics", title: "运动与速度", route: "/student/explore/mechanics?module=mechanics-speed", concepts: ["路程", "时间", "速度", "平均速度"], signals: ["速度", "运动快慢", "路程时间", "平均速度", "区间测速", "百米赛跑", "配速", "列车时刻表", "公里每小时", "米每秒", "追赶"], question: "路程和时间都不相同时，怎样公平比较谁运动得快？", guidance: "统一单位后，用路程与时间的比值比较。", evidence: "记录相同时间的路程或相同路程的用时。", related: ["sound-echo", "mechanics-friction"] },
  { id: "mechanics-friction", domain: "mechanics", title: "滑动摩擦力", route: "/student/explore/mechanics?module=mechanics-friction", concepts: ["压力", "粗糙程度", "匀速拉动", "滑动摩擦"], signals: ["摩擦力", "滑动摩擦", "鞋底花纹", "刹车", "轮胎防滑", "润滑油", "粗糙表面", "压力越大", "匀速拉木块", "弹簧测力计", "冰面滑"], question: "木块更重或桌面更粗糙时，摩擦力怎样改变？", guidance: "保持匀速，一次只改变压力或接触面粗糙程度。", evidence: "用匀速时测力计示数表示滑动摩擦力大小。", related: ["mechanics-speed", "mechanics-pressure"] },
  { id: "mechanics-lever", domain: "mechanics", title: "杠杆平衡条件", route: "/student/explore/mechanics?module=mechanics-lever", concepts: ["支点", "动力臂", "阻力臂", "力矩平衡"], signals: ["杠杆", "撬棍", "开瓶器", "跷跷板", "剪刀", "钳子", "扳手", "省力杠杆", "费力杠杆", "力臂", "支点", "钩码平衡"], question: "为什么加长撬棍后，用较小的力也能撬起重物？", guidance: "改变钩码位置和重力，使两侧转动效果重新平衡。", evidence: "比较动力乘动力臂与阻力乘阻力臂。", related: ["measurement-balance", "mechanics-pressure"] },
  { id: "mechanics-pressure", domain: "mechanics", title: "固体压力作用效果与压强", route: "/student/explore/mechanics?module=mechanics-pressure", concepts: ["压力", "受力面积", "固体压强"], signals: ["压强", "压力", "受力面积", "针尖", "宽背带", "履带", "高跟鞋", "刀刃", "雪地鞋"], question: "同样的压力，为什么接触面积越小作用效果越明显？", guidance: "本实验研究固体接触面的压强：分别改变压力和受力面积，不要同时改变两个量。", evidence: "比较单位面积上的压力以及接触面的形变程度。", related: ["mechanics-friction", "mechanics-buoyancy"] },
  { id: "mechanics-buoyancy", domain: "mechanics", title: "浮力与浮沉", route: "/student/explore/mechanics?module=mechanics-buoyancy", concepts: ["浮力", "重力", "排开液体", "平均密度"], signals: ["浮力", "上浮", "下沉", "漂浮", "悬浮", "轮船", "潜水艇", "热气球", "盐水选种", "阿基米德", "排水量", "密度小就浮"], question: "同一个物体放进不同液体，为什么可能上浮也可能下沉？", guidance: "改变物体密度与液体密度，比较浮力和重力。", evidence: "观察物体最终的浮沉状态以及浸入体积。", related: ["measurement-density", "mechanics-pressure"] },

  { id: "circuit-basic", domain: "circuit", title: "串联与并联电路", route: "/student/explore/circuit?module=circuit-basic", concepts: ["闭合回路", "串联", "并联", "支路"], signals: ["串联", "并联", "电路连接", "灯泡不亮", "开关控制", "家庭电路", "电流分路", "短路", "断路", "电源导线", "一条路径", "多条路径"], question: "串联只有一条路、并联有多条路，会怎样影响灯泡工作？", guidance: "断开开关后连接电路，再逐个断开用电器比较。", evidence: "追踪电流路径并观察各用电器能否独立工作。", related: ["circuit-ohm", "circuit-power"] },
  { id: "circuit-ohm", domain: "circuit", title: "欧姆定律", route: "/student/explore/circuit?module=circuit-ohm", concepts: ["电流", "电压", "电阻", "控制变量"], signals: ["欧姆定律", "电流电压电阻", "I=U/R", "电阻变大", "电压变大", "电流表", "电压表", "滑动变阻器", "限流电阻", "导体电阻"], question: "保持电阻不变时增大电压，电流会怎样变化？", guidance: "分两轮实验：固定电阻改变电压，再固定电压改变电阻。", evidence: "记录电流表读数并比较 I、U、R 的定量关系。", related: ["circuit-basic", "circuit-power"] },
  { id: "circuit-power", domain: "circuit", title: "电功率与电能", route: "/student/explore/circuit?module=circuit-power", concepts: ["电功率", "电能", "额定功率", "用电时间"], signals: ["电功率", "电能", "耗电量", "瓦特", "千瓦时", "度电", "电器铭牌", "额定电压", "额定功率", "节能灯", "电费", "P=UI"], question: "相同时间内，为什么大功率电器消耗的电能更多？", guidance: "改变电压和电流得到实际功率，再在相同用电时间下用 W=Pt 比较电能。", evidence: "读取 P=UI 的功率，并比较保持 60 s 时电流所做的功。", related: ["circuit-ohm", "circuit-basic"] },
  { id: "circuit-magnet", domain: "circuit", title: "电流的磁效应与电磁铁", route: "/student/explore/circuit?module=circuit-magnet", concepts: ["通电线圈", "磁场", "电磁铁", "线圈匝数"], signals: ["电磁铁", "电流磁效应", "通电螺线管", "线圈", "铁芯", "电铃", "继电器", "电磁起重机", "吸铁钉", "磁性强弱", "安培定则"], question: "怎样让自制电磁铁吸起更多铁钉？", guidance: "分别改变线圈匝数和电流，并保持铁芯等条件一致。", evidence: "用吸起铁钉数量或磁力指标比较磁性强弱。", related: ["circuit-basic", "circuit-ohm"] },

  { id: "thermal-thermometer", domain: "thermal", title: "温度计的使用", route: "/student/explore/thermal?module=thermal-thermometer", concepts: ["量程", "分度值", "液柱", "平视读数"], signals: ["温度计", "体温计", "读温度", "分度值", "量程", "液柱", "摄氏度", "零下温度", "视线平视", "百叶箱", "测温误差"], question: "温度计的分度值不同，读数精细程度有什么差别？", guidance: "先看量程和分度值，再让视线与液柱末端相平。", evidence: "比较真实温度、仪器分度值与最终可读示数。", related: ["thermal-boiling", "thermal-melting"] },
  { id: "thermal-boiling", domain: "thermal", title: "水的沸腾", route: "/student/explore/thermal?module=thermal-boiling", concepts: ["沸点", "持续吸热", "温度平台", "气压"], signals: ["沸腾", "沸点", "水烧开", "开水温度", "高压锅", "高原煮饭", "气泡", "白雾", "继续加热温度不变", "温度时间图像", "汽化"], question: "水沸腾后继续吸热，温度为什么不再明显升高？", guidance: "在标准大气压条件下连续记录温度和状态，并分别比较水量与加热器功率。", evidence: "观察温度—时间曲线在 100℃ 附近的平台；气压变化对沸点的影响属于生活拓展。", related: ["thermal-thermometer", "thermal-evaporation", "thermal-melting"] },
  { id: "thermal-melting", domain: "thermal", title: "熔化与凝固", route: "/student/explore/thermal?module=thermal-melting", concepts: ["熔点", "晶体", "熔化平台", "状态变化"], signals: ["熔化", "凝固", "冰融化", "冰点", "熔点", "晶体", "非晶体", "凝固点", "道路撒盐", "金属铸造", "吸热温度不变"], question: "冰在熔化过程中继续吸热，温度怎样变化？", guidance: "同时记录温度和固液状态，不要只看温度计。", evidence: "寻找固液共存阶段的温度平台。", related: ["thermal-boiling", "thermal-thermometer"] },
  { id: "thermal-evaporation", domain: "thermal", title: "蒸发与蒸发降温", route: "/student/explore/thermal?module=thermal-evaporation", concepts: ["表面汽化", "温度", "表面积", "空气流动"], signals: ["蒸发", "衣服变干", "吹风机", "风吹干得快", "蒸发降温", "汗液", "酒精擦皮肤", "表面积", "空气流动", "液体温度", "晾衣服"], question: "为什么把湿衣服展开并放在通风处会干得更快？", guidance: "当前实验固定液体表面积，分别改变温度和空气流动；表面积影响可作为下一轮对照实验。", evidence: "比较趋势指标，真实实验应比较相同时间内液体减少的质量。", related: ["thermal-boiling", "thermal-thermometer"] },

  { id: "measurement-balance", domain: "measurement", title: "托盘天平测质量", route: "/student/explore/measurement?module=measurement-balance", concepts: ["调平", "游码归零", "砝码", "等臂杠杆"], signals: ["托盘天平", "天平", "砝码", "游码", "调平衡", "左物右码", "镊子夹砝码", "质量称量", "横梁平衡", "指针偏转", "游码归零"], question: "使用托盘天平前，为什么要先把游码归零并调平？", guidance: "空载归零调平，再按从大到小的顺序增减砝码。", evidence: "平衡时读取砝码总质量与游码示数之和。", related: ["mechanics-lever", "measurement-density", "measurement-mass-volume"] },
  { id: "measurement-mass-volume", domain: "measurement", title: "质量与体积的关系", route: "/student/explore/measurement?module=measurement-mass-volume", concepts: ["质量", "体积", "正比", "图像斜率"], signals: ["质量和体积", "同种材料", "体积越大质量越大", "质量体积图像", "正比例", "图像斜率", "材料估重", "同种物质", "m-V 图"], question: "同种材料做成大小不同的物块，质量与体积怎样变化？", guidance: "选择同种材料的多个样品，同时记录质量和体积。", evidence: "绘制质量—体积图像并比较比值是否稳定。", related: ["measurement-density", "measurement-liquid-density"] },
  { id: "measurement-density", domain: "measurement", title: "不规则固体的密度", route: "/student/explore/measurement?module=measurement-density", concepts: ["密度", "排水法", "量筒", "质量体积比"], signals: ["固体密度", "不规则石块", "排水法", "量筒测体积", "矿石鉴别", "金属密度", "石头体积", "浸没", "液面差", "密度公式", "ρ=m/V"], question: "形状不规则的石块，体积和密度怎样测量？", guidance: "先用天平测质量，再用量筒排水法测体积。", evidence: "用浸没前后液面差求体积，再计算质量与体积之比。", related: ["measurement-balance", "measurement-mass-volume", "mechanics-buoyancy"] },
  { id: "measurement-liquid-density", domain: "measurement", title: "液体密度的测量", route: "/student/explore/measurement?module=measurement-liquid-density", concepts: ["容器差量", "液体质量", "量筒", "密度"], signals: ["液体密度", "牛奶密度", "酒精密度", "盐水密度", "烧杯质量", "空杯质量", "容器差量", "量筒液面", "液体质量", "密度计"], question: "测液体密度时，怎样扣除烧杯本身的质量？", guidance: "用装液体后的总质量减去空容器质量，再读取液体体积。", evidence: "比较质量差、量筒体积和最终密度。", related: ["measurement-density", "measurement-mass-volume", "mechanics-buoyancy"] }
];

export const physicsKnowledgeGraph = nodes;

const nodeById = new Map(nodes.map((node) => [node.id, node]));

export const knowledgeGraphQuestions: KnowledgeGraphQuestion[] = nodes.map((node) => ({
  mark: physicsGraphDomains[node.domain].mark,
  domain: node.domain,
  text: node.question,
  to: node.route
}));

function normalize(value: string) {
  return value.toLocaleLowerCase("zh-CN").replace(/[\s，。！？、,.!?：:；;“”'"（）()《》]/g, "");
}

function scoreNode(question: string, node: PhysicsKnowledgeNode): KnowledgeGraphMatch {
  const normalizedQuestion = normalize(question);
  const matched = new Map<string, number>();
  const addMatch = (term: string, base: number) => {
    const normalizedTerm = normalize(term);
    if (normalizedTerm.length < 2 || !normalizedQuestion.includes(normalizedTerm)) return;
    const weight = base + Math.min(8, normalizedTerm.length * 1.2);
    matched.set(term, Math.max(matched.get(term) ?? 0, weight));
  };

  addMatch(node.title, 14);
  node.signals.forEach((term) => addMatch(term, 9));
  node.concepts.forEach((term) => addMatch(term, 7));
  physicsGraphDomains[node.domain].signals.forEach((term) => addMatch(term, 2));

  const score = [...matched.values()].reduce((total, value) => total + value, 0);
  return { node, score, matchedTerms: [...matched.keys()].sort((left, right) => right.length - left.length).slice(0, 6) };
}

export function searchPhysicsKnowledgeGraph(question: string): KnowledgeGraphSearchResult {
  const ranked = nodes.map((node) => scoreNode(question, node)).filter((match) => match.score > 0).sort((left, right) => right.score - left.score);
  const best = ranked[0];

  if (!best) {
    return {
      found: false,
      title: "光光还没有找到足够的物理线索",
      message: "可以补充看到的现象、使用的器材或发生的变化。例如不要只写“这是为什么”，可以写“水沸腾后继续加热，温度为什么不变”。",
      matchedTerms: [],
      trail: ["生活问题", "补充现象或器材", "再次检索"],
      alternatives: Object.values(physicsGraphDomains).slice(0, 3).map((domain) => ({ title: domain.label, to: domain.route, reason: "先浏览这个领域的实验目录" })),
      followUps: ["这个现象中有哪些物体或器材？", "你观察到什么发生了变化？", "你最想比较哪两个条件？"]
    };
  }

  const second = ranked[1];
  const confidence = Math.min(98, Math.round(48 + best.score * 1.55 + Math.max(0, best.score - (second?.score ?? 0)) * .7));
  const domain = physicsGraphDomains[best.node.domain];
  const relatedNodes = best.node.related.map((id) => nodeById.get(id)).filter((node): node is PhysicsKnowledgeNode => Boolean(node));
  const alternatives = ranked.slice(1, 3).map((match) => ({ title: match.node.title, to: match.node.route, reason: `同时匹配：${match.matchedTerms.slice(0, 3).join("、")}` }));
  relatedNodes.forEach((node) => {
    if (alternatives.length < 4 && !alternatives.some((item) => item.to === node.route)) alternatives.push({ title: node.title, to: node.route, reason: "知识图谱中的相邻实验" });
  });

  return {
    found: true,
    title: `光光建议：先探索“${best.node.title}”`,
    message: `${best.node.guidance} 进入实验后重点${best.node.evidence}`,
    to: best.node.route,
    action: `进入${best.node.title}`,
    confidence,
    matchedTerms: best.matchedTerms,
    trail: ["我的生活问题", domain.label, ...best.node.concepts.slice(0, 2), best.node.title],
    alternatives,
    followUps: relatedNodes.slice(0, 3).map((node) => node.question)
  };
}

export const physicsKnowledgeGraphStats = {
  domains: Object.keys(physicsGraphDomains).length,
  experiments: nodes.length,
  concepts: new Set(nodes.flatMap((node) => node.concepts)).size,
  signals: new Set(nodes.flatMap((node) => node.signals)).size,
  relations: nodes.reduce((total, node) => total + node.related.length, 0)
};
