# 制作过程分享图｜第二版

**可编辑 PowerPoint：**[下载 14 页 PPTX](output/物理实验平台_制作过程_可编辑版_v3.pptx)。标题、正文、流程图、架构图和物理示意图可在 PowerPoint 中分别修改；产品网页截图与宠物形象是独立图片对象，可以替换或裁剪。

初中部分的完整制作过程另见 [16 页可编辑 PPT 与逐页预览](../junior/README.md)。

补充页：[技术总路线图图片](../technical-roadmap/技术总路线图.png) · [技术总路线图可编辑 PPTX](../technical-roadmap/output/技术总路线图_可编辑_v2.pptx)

这一版是 14 张独立的 16:9 图片（1920 × 1080），供逐页检查和后续制作 PPT 使用。画面交替使用深色物理观测站与浅色研究手稿；内容按真实对话、开源调研、代码架构、物理案例、双助手和移动端体验分别设计。产品画面来自本地网页截图，放在 [`assets/`](assets/)；浏览器窄窗截图仅作版式演示，不是真机验收。

[查看整套缩略图](images/00-overview.png) · [逐页讲解词](../SPEAKER_NOTES.md) · [制作过程稿](../../PRODUCT_CREATION_STORY.md)

| 页 | 主题 | 图片 |
| --- | --- | --- |
| 01 | 从教学想法到物理实验室 | [查看](images/01.png) |
| 02 | 已有产品和项目起点 | [查看](images/02.png) |
| 03 | 人与 Codex 怎样协作 | [查看](images/03.png) |
| 04 | 三段真实对话怎样变成改动 | [查看](images/04.png) |
| 05 | 研究过的开源项目 | [查看](images/05.png) |
| 06 | 从开源学到的四条方法 | [查看](images/06.png) |
| 07 | 网页、API、物理与助手的架构 | [查看](images/07.png) |
| 08 | 高中实验从六项到 24 项 | [查看](images/08.png) |
| 09 | 单摆、牛顿第二定律与双缝的物理边界 | [查看](images/09.png) |
| 10 | 高中视觉与交互的反复迭代 | [查看](images/10.png) |
| 11 | 光光和柯基力力的实验辅导 | [查看](images/11.png) |
| 12 | 电脑与手机的二维、三维取舍 | [查看](images/12.png) |
| 13 | 五层质量验证 | [查看](images/13.png) |
| 14 | 本地成果与对外使用前的工作 | [查看](images/14.png) |

图片的可修改源文件是 [`index.html`](index.html) 和 [`extra.css`](extra.css)。本机有 Edge 与 Pillow 时，在项目根目录运行 `python3 docs/presentation/v2/render.py` 可重新导出 14 张图片和总览。

项目与调研依据：[高中开源参考](../../high-school/OPEN_SOURCE_REFERENCES.md)、[学习记录开源参考](../../OPEN_SOURCE_LEARNING_RECORDS.md)、[开发状态](../../DEVELOPMENT_STATUS.md)、[课程与实验目录](../../high-school/CURRICULUM_MAP.md)。页面里的开源项目用于说明学习过的设计方法，不能理解为直接复用其源码或素材。当前图片不宣称公开站点、真机操作和全部教学审阅已经完成。
