# 力力照片素材与处理记录

核对与处理日期：2026-11-11。最终文件位于 `apps/web/public/assets/lili/`，均为512×512、保留透明通道的WebP。

## 来源

| 成品 | 作者 | 原照片 | 许可 |
| --- | --- | --- | --- |
| `corgi-01.webp` 微笑相伴 | Thu Dung Nguyen | [Pexels 16613108](https://www.pexels.com/photo/portrait-of-a-pembroke-welsh-corgi-lying-on-the-floor-16613108/) | [Pexels License](https://www.pexels.com/license/) |
| `corgi-02.webp` 元气端坐 | Antoni Shkraba | [Pexels 7524676](https://www.pexels.com/photo/close-up-shot-of-a-corgi-dog-sitting-7524676/) | [Pexels License](https://www.pexels.com/license/) |
| `corgi-03.webp` 认真倾听 | Alexey K. | [Pexels 20382893](https://www.pexels.com/photo/pembroke-welsh-corgi-dog-20382893/) | [Pexels License](https://www.pexels.com/license/) |
| `corgi-04.webp` 开心守候 | Jarrel Ng | [Unsplash q4ISUQSjU9o](https://unsplash.com/photos/a-happy-corgi-dog-sits-on-a-white-background-q4ISUQSjU9o) | [Unsplash License](https://unsplash.com/license)，标准免费，非Plus |
| `corgi-05.webp` 安静陪伴 | Irina Balashova | [Pexels 8445956](https://www.pexels.com/photo/close-up-photo-of-a-cute-welsh-corgi-lying-on-the-floor-8445956/) | [Pexels License](https://www.pexels.com/license/) |

原图下载地址、作者主页、尺寸和SHA-256，以及最终成品尺寸、体积和SHA-256，均保存在 [SOURCES.json](../../apps/web/public/assets/lili/SOURCES.json)。原图临时下载文件不进入运行资源；未采用未核对来源的图片或有胸背带的候选。

照片平台许可允许修改及网站／App使用。本次作为助手装饰图片保留署名，不将图片当作产品注册商标或单独售卖的图库。原素材继续适用其原许可，背景移除不消除原许可条件。

## 处理模式

使用内置 `imagegen`，每张独立调用，输入 `referenced_image_paths: [该原图的本地路径]`、`transparent_background: true`，未使用CLI或第三方去背景服务。原图经目视检查后作为编辑输入；目标为移除背景、尽量保留该照片中的表情和姿态。AI编辑不承诺逐像素保留原照片。

最终PNG通过sharp缩至512×512并编码WebP（quality88、alphaQuality100、effort6），不使用sharp或Python推算抠图掩膜。生成PNG原件保留在工具默认生成目录，项目内保存最终WebP，运行不依赖该机器目录。

曾对01尝试第二次边缘清理，但未选用该版本：逐像素透明度检查和深蓝底合成确认原版边缘正常，采用最初五张处理结果。联系图只用于透明度验收，没有作为运行图片。

## 最终采用的提示词

01使用以下完整提示词：

```text
Use case: background-extraction. Edit this exact corgi photograph into a photographic transparent cutout for a small website assistant named Lili. Remove the entire floor, plants, pots and all other background, including background inside gaps around the dog's silhouette. Keep exactly this same dog's orange, white and black fur, large upright ears, dark eyes, open smiling mouth and tongue, original pose and visible body proportions. Do not invent paws or other parts outside the source crop. Preserve the original lower chest crop, but place the visible subject centered on a square canvas, ears fully visible with approximately 6 percent transparent padding, fitting the entire visible dog. Use genuine alpha transparency, clean soft fur edges, no rectangular background, no checkerboard painted into the image, no new shadow or glow, no text, accessories, costume or illustration styling. This is background removal only, not a new dog.
```

02、03分别把以下对应描述代入 `{description}` 后独立调用：

- 02：`the happy orange and white corgi sitting on a blue mat, retaining its smiling face, upright ears, visible paws and tail`
- 03：`the calm fluffy corgi sitting on a balcony, retaining its serious inquisitive expression, outward-angled ears and paws`

```text
Use case: background-extraction. Edit this exact photograph into a photographic transparent corgi cutout for the Lili website assistant. The subject is {description}. Remove absolutely all background, floor, mat, furniture, fence and scenery including any background between legs. Keep exactly the original dog's identity, pose, fur markings, head, expression and body proportions. Preserve fine fur edges; do not redraw it as a cartoon or change the dog. Include its entire visible body with ears and paws intact, centered on a square canvas with 6 percent comfortable transparent padding. Actual alpha transparency only, no painted checkerboard, no white rectangle, no new shadow or glow, no accessories and no text. Background removal only.
```

04、05分别把以下对应描述代入 `{description}` 后独立调用：

- 04：`the cheerful tricolor corgi sitting with its tail extending to the left, on a white studio background`
- 05：`the calm corgi resting its chin on the floor with a close-up face, closed mouth and outward-angled ears. The right side of its face has darker natural lighting; preserve the dog's expression and shading`

```text
Use case: background-extraction. Edit this exact photograph into a photographic transparent corgi cutout for the Lili website assistant. The subject is {description}. Remove the whole floor and background including inside any gaps around the silhouette. Keep exactly this dog's identity, expression, fur colors and markings, ears, nose and visible body proportions. Retain only the dog actually visible in the source; do not invent missing body parts outside the crop. Center the entire visible subject on a square transparent canvas with 6 percent transparent padding. Preserve fine fur edges. True alpha transparency, no painted checkerboard, no rectangular white or black background, no new shadow or glow, no accessories or text. Do not cartoonize or change the dog; this is background removal only.
```
