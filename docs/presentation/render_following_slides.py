"""Render the remaining 13 story slides as editable, deterministic PNG sources."""
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE / "images"
FONT_CN = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_EN = "/System/Library/Fonts/Avenir Next.ttc"
W, H = 1920, 1080
CYAN, BLUE, PURPLE, ORANGE = (76, 214, 218), (111, 183, 247), (159, 151, 244), (252, 176, 111)
ACCENTS = (CYAN, BLUE, PURPLE, ORANGE)


def f(size, en=False):
    return ImageFont.truetype(FONT_EN if en else FONT_CN, size)


def tx(draw, xy, value, size=24, color=(235, 245, 251), en=False):
    draw.text(xy, value, font=f(size, en), fill=color)


background = Image.new("RGB", (W, H))
px = background.load()
for yy in range(H):
    for xx in range(W):
        halo = max(0, 1 - ((xx - 1580) / 1150) ** 2 - ((yy - 130) / 900) ** 2)
        px[xx, yy] = (int(7 + 9 * halo), int(18 + 24 * halo), int(36 + 38 * halo))
star_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(star_layer)
rng = Random(20261118)
for _ in range(110):
    xx, yy = rng.randrange(W), rng.randrange(H)
    rr = rng.choice((1, 1, 2))
    sd.ellipse((xx - rr, yy - rr, xx + rr, yy + rr), fill=(180, 225, 245, rng.randrange(25, 85)))
for circle in ((1510, -270, 2070, 290), (1570, -210, 2010, 230), (1640, -140, 1940, 160)):
    sd.ellipse(circle, outline=(75, 168, 210, 57), width=2)
background = Image.alpha_composite(background.convert("RGBA"), star_layer)


def base(number, title, subtitle, topic, source):
    im = background.copy()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((103, 63, 650, 112), radius=20, fill=(16, 57, 78, 255), outline=(70, 154, 179, 255), width=1)
    tx(d, (125, 73), f"制作过程  /  {topic}", 22, (148, 231, 234))
    tx(d, (102, 142), title, 61)
    tx(d, (104, 230), subtitle, 25, (168, 201, 218))
    d.line((103, 1002, 1817, 1002), fill=(54, 110, 139, 230), width=2)
    tx(d, (103, 1020), source, 17, (111, 151, 171))
    tx(d, (1700, 1016), f"{number:02d} / 14", 21, (126, 194, 208), en=True)
    return im, d


def card(d, box, tag, title, lines, accent, dense=False):
    x, y, x2, y2 = box
    d.rounded_rectangle(box, radius=23, fill=(15, 40, 64, 250), outline=(56, 106, 133, 240), width=2)
    d.rounded_rectangle((x, y, x + 7, y2), radius=3, fill=(*accent, 255))
    d.rounded_rectangle((x + 28, y + 20, x + 195, y + 55), radius=11, fill=(27, 65, 85, 255), outline=(*accent, 180))
    tx(d, (x + 42, y + 23), tag, 18, accent)
    tx(d, (x + 28, y + 71), title, 29 if dense else 33)
    for i, line in enumerate(lines):
        tx(d, (x + 30, y + 126 + i * (31 if dense else 34)), line, 21 if dense else 23, (174, 203, 218))


def takeaway(d, label, detail):
    d.rounded_rectangle((103, 878, 1817, 975), radius=20, fill=(20, 64, 80, 250), outline=(71, 151, 171, 220), width=2)
    tx(d, (132, 897), label, 22, CYAN)
    tx(d, (132, 931), detail, 25, (228, 243, 249))


def grid_page(spec):
    im, d = base(spec["num"], spec["title"], spec["subtitle"], spec["topic"], spec["source"])
    items = spec["cards"]
    cols = 3 if len(items) == 6 else 2
    gap = 21 if cols == 3 else 26
    width = (1714 - gap * (cols - 1)) // cols
    for i, (tag, title, lines) in enumerate(items):
        col, row = i % cols, i // cols
        x = 103 + col * (width + gap)
        y = 316 + row * 266
        card(d, (x, y, x + width, y + 242), tag, title, lines, ACCENTS[i % 4], dense=cols == 3)
    takeaway(d, spec["take_label"], spec["take_detail"])
    return im


def dialogue_page(spec):
    im, d = base(spec["num"], spec["title"], spec["subtitle"], spec["topic"], spec["source"])
    for i, (quote, heading, details) in enumerate(spec["rows"]):
        y = 314 + i * 182
        accent = ACCENTS[i % 4]
        d.rounded_rectangle((103, y, 720, y + 158), radius=20, fill=(16, 42, 67, 248), outline=(*accent, 195), width=2)
        d.rounded_rectangle((804, y, 1817, y + 158), radius=20, fill=(14, 39, 61, 248), outline=(55, 105, 130, 225), width=2)
        tx(d, (130, y + 15), "你提出", 20, accent)
        tx(d, (130, y + 52), f"“{quote}”", 27)
        tx(d, (742, y + 57), "→", 43, accent)
        tx(d, (835, y + 19), heading, 28)
        for j, line in enumerate(details):
            tx(d, (837, y + 66 + j * 31), line, 21, (170, 201, 217))
    takeaway(d, spec["take_label"], spec["take_detail"])
    return im


slides = [
    dict(num=2, mode="grid", topic="起点", title="不是从空白开始：先看清已有产品",
         subtitle="初中实验已有网页与教学功能；这一轮工作的第一步，是找到主工程和真正要改的地方。",
         source="依据：README、代码架构说明、当前可见对话",
         cards=[
             ("产品起点", "已有初中实验平台", ["学生可进入六大领域实验", "已有光光、教师空间与本机记录", "需要继续检查交互与科学性"]),
             ("你的问题", "先问清项目全貌", ["“里面的所有东西”", "“别的文件夹也看下都是啥”", "“后端的代码在哪里”"]),
             ("工程整理", "让文件各归其位", ["清理过时安装包与扫码材料", "分清网页、后台、模型和知识", "保留主工程供持续升级"]),
             ("认识后端", "弄懂每层负责什么", ["前端展示与交互", "物理包计算仿真结果", "后端管账号、班级、任务与记录"]),
         ], take_label="这一页想表达", take_detail="做产品先盘点真实现状，再决定哪里该整理、哪里该升级。"),
    dict(num=3, mode="grid", topic="人机协作", title="我怎样利用 ChatGPT / Codex 推进项目",
         subtitle="不是一次性让 AI “做完”，而是把每轮反馈变成可检查的开发任务。",
         source="依据：开发 workflow、阶段记录、当前可见对话",
         cards=[
             ("STEP 01", "我提出方向", ["先说教学目标与使用场景", "指出“感觉不对”的真实体验", "明确优先级：物理、交互、手机"]),
             ("STEP 02", "Codex 阅读与研究", ["检查项目代码和已有记录", "查教材、开源仓库与官方文档", "拆成模型、界面、助手等任务"]),
             ("STEP 03", "Codex 实现并验证", ["修改代码、补具体功能", "运行物理、页面与接口测试", "说明哪些结论还没被真机验证"]),
             ("STEP 04", "我再次查看和追问", ["打开实验，检查画面与操作", "继续说“还不行”“再优化一轮”", "形成下一轮明确的修改方向"]),
         ], take_label="协作方法", take_detail="目标 → 调研 → 实现 → 验证 → 反馈；Codex 是参与开发的工具，判断和取舍由人把关。"),
    dict(num=4, mode="dialogue", topic="真实对话", title="一句反馈，怎样变成具体改动？",
         subtitle="以下短句摘自可见对话，省略号表示节选；右侧是对应的工程动作。",
         source="依据：当前可见对话、开发状态与验收记录",
         rows=[
             ("整理一下这个平台的代码架构", "从“目录混乱”变成模块边界", ["梳理 apps/web、apps/api 与 packages/physics 等职责。", "后续实验按位置开发，避免把公式塞进界面文件。"]),
             ("高中的这个界面…没有初中的那个高级", "从感受转成视觉升级", ["重新做高中首页、实验工作台、字体与空间层次。", "你继续反馈“科技感”“天体、量子”，驱动第二轮。"]),
             ("手机端不好显示的…直接呈现二维的", "从建议变成设备策略", ["手机默认二维，电脑可默认三维；三维可按需进入。", "共用相同物理状态，切视图不会重做一套结果。"]),
         ], take_label="你在协作中的作用", take_detail="你不是只给题目，而是在每次观看、提问和纠错中持续定义产品。"),
    dict(num=5, mode="grid", topic="开源调研", title="我让 Codex 学习了哪些开源项目？",
         subtitle="你提出：“你自己也要学会从github上面学习好的开源项目。”于是按具体问题分别研究。",
         source="依据：高中开源参考、实验档案开源参考；项目名称为历史调研记录",
         cards=[
             ("仿真教学", "PhET Pendulum Lab", ["入门观察、定量测量、模型解释", "摆长／摆角／重力可分开研究"]),
             ("架构分层", "PhET Joist / Scenery", ["模型和视图分离", "同一结果可用多种视图呈现"]),
             ("三维呈现", "React Three Fiber / Drei", ["React 组织三维仪器", "相机控制、按需渲染与性能预算"]),
             ("物理模型", "myPhysicsLab / CircuitJS1", ["区分方程、过程与测量", "电路切换保留动态历史状态"]),
             ("教学记录", "Moodle / Moodle App", ["学生提交、教师反馈", "本机保存与联网同步分开"]),
             ("可靠同步", "xAPI / Learning Locker", ["记录标识和操作标识分开", "重试、冲突与数据归属要明确"]),
         ], take_label="学习方式", take_detail="带着具体问题读官方资料；借鉴设计方法，逐项记录来源、适用范围和许可。"),
    dict(num=6, mode="grid", topic="学习收获", title="研究开源后，我学到的是方法",
         subtitle="参考项目启发了设计原则；物理计算、页面和教学内容仍按本平台需求独立完成。",
         source="依据：高中开源参考、开发 workflow、物理模型说明",
         cards=[
             ("分层", "计算不藏在画面里", ["物理模型只接收条件与时间", "二维和三维读取同一结果", "改外观不应改公式"]),
             ("实验", "先操作再解释", ["先预测、调整变量、记录现象", "图像整理已保存的证据", "不能用公式直接代替学生测量"]),
             ("性能", "3D 为学习服务", ["视角控制帮助看清器材关系", "按需加载、按需重绘", "低性能与手机保留二维途径"]),
             ("边界", "公开项目不等于可直接复制", ["逐项核对许可证与维护情况", "不搬入 PhET 源码、素材和商标", "引用项目不能证明本平台物理正确"]),
         ], take_label="最重要的收获", take_detail="“参考开源”是学会设计和验证的方法，不是把别人的仿真换个界面。"),
    dict(num=7, mode="grid", topic="代码架构", title="把复杂产品拆成可以继续改的部分",
         subtitle="这也是你反复要求“文件放好位置、逻辑要清楚”之后形成的开发方式。",
         source="依据：代码架构说明、开发 workflow",
         cards=[
             ("apps/web", "网页与交互", ["首页、初中／高中实验", "二维／三维装置和教师页面"]),
             ("apps/api", "后台服务", ["账号、班级、课堂任务", "报告、记录和助手接口"]),
             ("packages/physics", "物理计算", ["参数、时间、方程与数值边界", "独立于 React 和浏览器"]),
             ("packages/knowledge", "课程与知识", ["实验目录、教材映射", "24 项生活案例供页面与力力共用"]),
             ("packages/harness", "助手规则", ["光光／力力的提示和追问", "把当前装置转成学习引导"]),
             ("packages/contracts", "共享约定", ["前后端使用同一数据结构", "减少身份与实验状态混淆"]),
         ], take_label="分层后的好处", take_detail="改视觉时不必改公式；修物理时可以单独验证，再让所有视图一起更新。"),
    dict(num=8, mode="grid", topic="高中专区", title="高中实验如何从样板扩展到 24 项",
         subtitle="你说“先把高中的实验补齐一下”，同时要求参考教材、加强交互并保证物理准确。",
         source="依据：高中产品设计、课程映射、扩展验收记录",
         cards=[
             ("首批 6 项", "先搭可复用工作台", ["匀变速、牛二、抛体、单摆", "电源内阻与双缝干涉"]),
             ("继续细化", "从页面到真实操作步骤", ["弹簧加载、共点力试配", "机械能纸带、电容分段切换"]),
             ("后续 14 项", "覆盖更多物理领域", ["向心力、碰撞、折射与感应", "热学、光电效应、带电粒子等"]),
             ("每项共性", "能动手也能找证据", ["调参数、看二维／三维装置", "看图表、保存读数、说明假设"]),
         ], take_label="要准确表达的范围", take_detail="24 项已有本地可交互实现；不等于 24 项都经过教师与真实设备的完整验收。"),
    dict(num=9, mode="grid", topic="物理准确性", title="我要求的不只是“会动”，还要讲得对",
         subtitle="每个模拟都要写明条件、单位和模型边界；学生的原始读数不能被理论答案替换。",
         source="依据：高中物理说明、实验设计与验收记录",
         cards=[
             ("单摆", "小角近似有条件", ["摆长量到摆球重心", "大摆角不能套同一近似公式", "手动计时保留学生起止选择"]),
             ("牛顿第二定律", "分析整个运动系统", ["小车与挂码质量都计入总质量", "启动后绳张力不等于挂码重力", "比较时只改变一个研究变量"]),
             ("双缝干涉", "读尺要数间隔", ["亮纹数量与相邻间隔数量不同", "屏内仅一条亮纹时不能测间距", "近轴关系有适用范围"]),
             ("记录分析", "保留证据来源", ["模型采样、手动虚拟读数分开", "条件不同的记录不能混合拟合", "虚拟结果不冒充实物测量"]),
         ], take_label="我的验收标准", take_detail="公式、变量、单位、可操作性和边界都要对；漂亮画面不能代替这些检查。"),
    dict(num=10, mode="dialogue", topic="视觉与交互", title="界面为什么改了好几轮？",
         subtitle="你持续用直观反馈指出不足，Codex 再把“感觉”拆成可修改的界面和操作问题。",
         source="依据：当前可见对话、阶段 25—35 视觉与交互记录",
         rows=[
             ("交互感觉太少", "补真实操作，而不只加动画", ["单摆释放点、碰撞前后对照、万用电表挡位接法。", "折射增加精确临界角操作和读数反馈。"]),
             ("需要科技感好一点的那种", "建立深空观测站视觉", ["首页加入天体、轨道、干涉与量子云意象。", "工作台强调仪表、层次、字体和三维空间感。"]),
             ("可以在更佳科技感一点吗？", "继续调细节与性能", ["强化光照、材质、透视与动态反馈。", "视觉意象标注为氛围，不冒充定量仿真。"]),
         ], take_label="迭代的关键", take_detail="同一个需求会经历“看一版 → 指出不足 → 再做一版”，产品不是一次生成的。"),
    dict(num=11, mode="grid", topic="两个助手", title="光光和力力：从聊天走向实验辅导",
         subtitle="你选择的升级重点是：“实验辅导能力：看懂操作、指出问题、分步提示”。",
         source="依据：当前可见对话、力力设计、助手规则与测试",
         cards=[
             ("初中 / 光光", "结合装置给提示", ["读取当前实验与操作线索", "提醒学生检查条件和证据", "不把回复当作学生已掌握"]),
             ("高中 / 力力", "柯基实验伙伴", ["围绕当前 24 项实验辅导", "检查变量、记录与图像", "五张柯基形象可轮换"]),
             ("你要求的升级", "能接住后续追问", ["“为什么”“现在呢”“没看懂”", "近期对话帮助理解话题", "改参后重新检查当前装置"]),
             ("连接生活", "解释现象也说边界", ["24 项生活案例共用一份知识", "指出当前实验里怎样验证", "模型结果不冒充生活实测"]),
         ], take_label="设计原则", take_detail="先帮助学生预测和操作，再讨论记录；AI 可以引导，不能替学生编造实验过程。"),
    dict(num=12, mode="grid", topic="移动端", title="为什么手机上优先显示二维？",
         subtitle="你提出“手机端不好显示的…直接呈现二维的”，让更多设备先看得清、点得到。",
         source="依据：当前可见对话、阶段 40—42 手机验收记录",
         cards=[
             ("你的原话", "“不好显示的直接呈现二维”", ["手机屏幕窄、触控空间有限", "三维操作和文字可能互相遮挡", "先保证实验操作可达"]),
             ("实现策略", "手机默认二维", ["24 项高中实验采用二维入口", "电脑保留默认三维", "用户仍可主动切换视图"]),
             ("界面细节", "围绕手指和键盘调整", ["放大输入与触控目标", "处理安全区、横屏和软键盘", "助手面板跟随可见视口"]),
             ("验证边界", "模拟器不能等于真机", ["已做桌面窄屏与部分浏览器检查", "真实手机触屏、GPU 与微信内打开", "仍需完整验收"]),
         ], take_label="体验原则", take_detail="二维和三维共用同一实验数据；视图可以降级，物理状态和记录不能丢。"),
    dict(num=13, mode="grid", topic="质量验证", title="Codex 做完代码后，怎样证明它可用？",
         subtitle="检查分层进行：物理计算、交互页面、服务接口、构建，以及真实设备体验。",
         source="依据：开发 workflow、阶段验收记录、上一轮力力接入检查",
         cards=[
             ("模型测试", "查数值与适用条件", ["边界参数、单位、无效状态", "手动读数与模型值分开", "不让图形层重算公式"]),
             ("页面测试", "查操作与记录", ["改参数、运行、暂停、复位", "保存、恢复、导出和身份隔离", "异常状态有可理解的提示"]),
             ("工程检查", "查类型、依赖与打包", ["TypeScript 和后端语法", "架构检查、知识检索与生产构建", "失败保留阶段日志再修复"]),
             ("现场验收", "人要亲自看页面", ["浏览器、窄屏、三维显示", "真实手机、触摸、教师审阅", "尚有部分场景需要补验"]),
         ], take_label="不能混淆", take_detail="自动测试通过 ≠ 视觉验收完成 ≠ 教学内容审定 ≠ 已达到公开销售标准。"),
    dict(num=14, mode="grid", topic="现在与下一步", title="这段制作过程，走到了哪里？",
         subtitle="本地产品已经积累了大量内容，但对外分享使用还要完成最后几步。",
         source="依据：制作过程稿、部署准备记录；上线状态以正式验收为准",
         cards=[
             ("已在本地", "可展示产品与过程", ["初中实验、高中 24 项实验", "二维／三维、教师空间", "光光、力力与生活案例"]),
             ("仍要检查", "补真实使用证据", ["物理教师审阅课程与模型", "手机触屏和低性能设备", "完整操作与记录流程"]),
             ("服务器准备", "独立站点待联调", ["物理平台与原网站分开运行", "专用子域名与服务已规划", "公开访问尚未完成"]),
             ("分享方式", "先真实介绍，再邀请试用", ["展示需求、对话、研究与修改", "说明哪些已实现、哪些还在验证", "收集教师和学生反馈继续迭代"]),
         ], take_label="最后一句", take_detail="这是一个由人的教学判断与持续反馈驱动、由 Codex 协助开发和验证的进行中作品。"),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for spec in slides:
        im = dialogue_page(spec) if spec["mode"] == "dialogue" else grid_page(spec)
        path = OUT / f"{spec['num']:02d}-{spec['topic']}.png"
        im.convert("RGB").save(path, optimize=True)
        print(path)


if __name__ == "__main__":
    main()
