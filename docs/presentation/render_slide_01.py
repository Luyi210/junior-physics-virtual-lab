"""Render the first shareable 16:9 image with deterministic Chinese text."""
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "images" / "01-制作路线总览.png"
FONT_CN = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_EN = "/System/Library/Fonts/Avenir Next.ttc"
W, H = 1920, 1080


def font(size: int, english: bool = False):
    return ImageFont.truetype(FONT_EN if english else FONT_CN, size)


def text(draw, xy, value, size, color, *, english=False, stroke=0):
    draw.text(xy, value, font=font(size, english), fill=color, stroke_width=stroke)


image = Image.new("RGB", (W, H))
pixels = image.load()
for y in range(H):
    for x in range(W):
        radial = max(0, 1 - ((x - 1580) ** 2 / 1250 ** 2 + (y - 15) ** 2 / 850 ** 2))
        pixels[x, y] = (int(7 + radial * 8), int(18 + radial * 22), int(36 + radial * 32))

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((1330, -220, 2060, 510), fill=(37, 166, 245, 33))
gd.ellipse((-270, 560, 580, 1320), fill=(30, 187, 184, 22))
glow = glow.filter(ImageFilter.GaussianBlur(110))
image = Image.alpha_composite(image.convert("RGBA"), glow)

decoration = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(decoration)
for box in ((1460, -210, 2000, 330), (1515, -155, 1945, 275), (1590, -80, 1870, 200)):
    dd.ellipse(box, outline=(73, 201, 250, 60), width=2)
dd.arc((1438, -222, 2025, 363), 6, 142, fill=(94, 226, 255, 180), width=5)
dd.ellipse((1764, 184, 1782, 202), fill=(244, 180, 103, 230))
rng = Random(32)
for _ in range(92):
    x, y = rng.randrange(W), rng.randrange(H)
    radius = rng.choice((1, 1, 1, 2))
    dd.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(180, 221, 246, rng.randrange(35, 110)))
image = Image.alpha_composite(image, decoration)
draw = ImageDraw.Draw(image)

draw.rounded_rectangle((102, 74, 400, 119), radius=21, fill=(24, 72, 94, 225), outline=(61, 166, 185, 140), width=1)
text(draw, (124, 82), "PROJECT STORY   /   01", 22, (143, 234, 236, 255), english=True)
text(draw, (101, 137), "一个物理实验平台，", 64, (241, 248, 252, 255))
text(draw, (101, 219), "如何一步步做出来？", 64, (241, 248, 252, 255))
text(draw, (104, 307), "从已有初中实验，到高中 24 项实验与双助手：一条不断讨论、制作、检查的路线", 27, (163, 192, 208, 255))

stages = [
    ("01", "盘点原项目", ["了解文件与已有功能", "清理过时的分发材料"], (85, 216, 215)),
    ("02", "整理代码架构", ["分开网页、后端与物理计算", "知识和助手有独立位置"], (102, 176, 244)),
    ("03", "提出高中目标", ["参考教材设计实验", "柯基力力成为学习伙伴"], (151, 145, 244)),
    ("04", "研究开源项目", ["学习 PhET、R3F、Drei", "借鉴方法，独立实现"], (249, 173, 111)),
    ("05", "扩展实验内容", ["从 6 个样板走向 24 项", "二维／三维、图表与记录"], (85, 216, 215)),
    ("06", "打磨操作体验", ["改进单摆、碰撞、万用电表等", "持续检查物理条件与错误"], (102, 176, 244)),
    ("07", "升级光光与力力", ["分步提示、追问、检查记录", "把物理与生活案例连起来"], (151, 145, 244)),
    ("08", "验证并准备分享", ["自动检查与手机二维适配", "公开网站仍在准备"], (249, 173, 111)),
]

margin, gap, card_w, card_h = 103, 21, 412, 216
for index, (number, title, lines, accent) in enumerate(stages):
    col, row = index % 4, index // 4
    x, y = margin + col * (card_w + gap), 402 + row * 246
    draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=22,
                           fill=(14, 37, 60, 246), outline=(55, 103, 126, 230), width=2)
    draw.rounded_rectangle((x, y, x + 7, y + card_h), radius=3, fill=(*accent, 255))
    draw.rounded_rectangle((x + 28, y + 25, x + 92, y + 68), radius=13,
                           fill=(22, 52, 73, 255), outline=(*accent, 210), width=1)
    text(draw, (x + 43, y + 31), number, 22, (*accent, 255), english=True)
    text(draw, (x + 30, y + 77), title, 31, (241, 248, 252, 255))
    for line_i, line in enumerate(lines):
        text(draw, (x + 30, y + 137 + line_i * 35), line, 21, (170, 197, 212, 255))
    if col < 3:
        center = y + card_h // 2
        draw.line((x + card_w + 4, center, x + card_w + gap - 5, center), fill=(83, 150, 167, 150), width=2)

draw.line((103, 908, 1817, 908), fill=(60, 116, 140, 210), width=2)
text(draw, (103, 937), "你提出目标、持续反馈并验收", 28, (234, 246, 251, 255))
text(draw, (690, 937), "AI 协助研究、开发与测试", 28, (234, 246, 251, 255))
draw.rounded_rectangle((1357, 929, 1817, 988), radius=16, fill=(31, 62, 75, 240), outline=(112, 165, 180, 130))
text(draw, (1380, 944), "当前：本地新版 · 未公开上线", 23, (180, 225, 228, 255))
text(draw, (103, 1020), "初中物理虚拟实验平台 V2  /  制作过程分享", 18, (111, 150, 168, 255))
text(draw, (1688, 1017), "01 / 14", 21, (111, 182, 199, 255), english=True)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.convert("RGB").save(OUTPUT, optimize=True)
print(OUTPUT)
