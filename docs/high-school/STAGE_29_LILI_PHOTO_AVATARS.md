# 第二十九阶段：力力五图轮换

日期：2026-11-11（Asia/Shanghai）。按用户要求，从网上选择五张柯基照片，去除背景后接入力力形象轮换。

## 交付内容

- 五张真实照片分别为微笑相伴、元气端坐、认真倾听、开心守候、安静陪伴。内置 imagegen 分别处理背景，最终保存为 512×512 透明 WebP，总计 270,960 bytes（约264.6 KiB）。运行时读取项目本地资源，不热链图片站。
- 默认15秒轮换；打开聊天、等待回复、标签页隐藏、鼠标悬停或键盘聚焦入口时暂停。手动上一张／下一张后固定形象，可重新开启自动。系统减少动态默认关闭轮换，切换系统偏好不会清除手动固定选择。
- 入口和对话面板共享同一索引。加载中或失败时保留原SVG柯基，换图不影响发送、取消、上下文和身份隔离。
- 形象控制默认折叠，支持原生按钮、方向键和焦点样式；展开时面板可纵向滚动，避免窄屏输入区被压缩。
- “形象来源”打开本地署名页，包含全部作者、原照片、平台许可链接和透明形象展示。

这些是轮换照片，不是自动判断学生情绪的表情系统，也不是照片动作动画。

## 目录边界

| 目录／文件 | 职责 |
| --- | --- |
| `apps/web/public/assets/lili/corgi-01.webp` 至 `corgi-05.webp` | 五张最终透明图片 |
| 同目录 `SOURCES.html`、`SOURCES.json` | 可浏览署名页、来源与许可、原图和成品校验值 |
| `assistant/corgiAvatars.ts` | 图片名称、替代文本、基于BASE_URL的路径及轮换间隔 |
| `assistant/CorgiAvatar.tsx`、`LegacyCorgiAvatar.tsx` | 受控照片与原SVG降级 |
| `assistant/useCorgiAvatarRotation.ts` | 轮换、可见性、动态偏好、交互暂停与清理 |
| `assistant/CorgiAvatarControls.tsx`、`CorgiAvatar.css` | 控件和局部样式 |
| `assistant/LiliAssistant.tsx` | 仅挂接一份轮换状态及两个展示位置 |

上述 `assistant/` 均位于 `apps/web/src/features/high-school/assistant/`。没有增加依赖、改变后台或数据库、调用对话供应商；没有部署上线。

四张来自 Pexels，一张来自标准免费 Unsplash（非Plus），逐张核对照片页与平台许可。照片用于助手装饰形象，不作为商标。完整来源、处理模式与实际提示词见[素材处理记录](LILI_IMAGE_PROCESSING.md)。

## 验证

完整报告：`.runtime/quality-checkpoints/2026-11-11T07-12-51-111Z.json`，上海时间15:13:46完成，四阶段退出码均为0。

- **2287项测试通过，1项Linux专用检查跳过**：workflow30、API204、光学4、web1389、harness306、knowledge12、physics342。新增13项头像／生命周期测试；与既有力力界面和请求专项合计24项通过。
- 类型、33题检索、328模块架构、生产构建与资源验收通过。应用入口264.2 KiB gzip，无提前加载Three.js；该数字不包含所有高中路由和五张图片资源。
- 五张输出均验证512×512、真实Alpha通道、透明区域及接近不透明的主体区域。深蓝底合成联系图已目视检查，未将透明预览中近乎透明像素的显示杂色误当成最终背景。
- 本机5174的五张WebP、来源HTML与JSON全部实际HTTP 200，WebP内容类型正确。记录位于 `.runtime/lili-avatar/asset-checks.json` 与 `http-checks.json`。
- 独立Edge无头浏览器已成功加载并截图署名页，五张图片显示正常：`/private/tmp/lili-sources-browser.png`。使用单独临时配置，不访问用户浏览器资料。
- 真实页面另有**14/14浏览器检查通过**：五图实际加载及首尾循环、上一张／下一张、面板与入口同步、打开对话16秒保持不变、关闭并移开焦点和指针后16秒轮换。320×568视口展开控件后，文档宽度仍320，面板无横向溢出，滚动后输入框与发送按钮可见可达。
- UI报告保存在 `.runtime/lili-avatar/ui-check.json`。截图已观察：`/private/tmp/lili-ui-desktop.png`、`/private/tmp/lili-ui-mobile-controls.png`、`/private/tmp/lili-ui-mobile.png`。任务专用临时Edge已关闭，没有发送聊天、登录账号或写入教学数据。该检查采用 `--disable-gpu` 的无头Edge及手机视口模拟，不等于实体手机触屏或GPU验收。
- 生产构建中的五张图片SHA-256与来源清单一致，确认最终资源已进入构建产物。

本地入口：`http://127.0.0.1:5174/#/high-school`；形象合集：`http://127.0.0.1:5174/assets/lili/SOURCES.html`。
