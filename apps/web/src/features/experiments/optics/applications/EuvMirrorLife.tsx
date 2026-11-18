import { useState } from "react";
import { Atom, Info } from "lucide-react";
import { publicAsset } from "../shared/assets";

export function EuvMirrorLife() {
  const [mirrorCount, setMirrorCount] = useState(3);
  const mirrorPoints = [
    { x: 160, y: 112 },
    { x: 276, y: 232 },
    { x: 392, y: 112 },
    { x: 508, y: 232 },
    { x: 624, y: 112 },
    { x: 740, y: 232 }
  ];
  const source = { x: 52, y: 218 };
  const activePoints = [source, ...mirrorPoints.slice(0, mirrorCount)];
  const remaining = Math.pow(0.7, mirrorCount) * 100;
  const scenes = [
    {
      number: "01",
      title: "先进入几乎没有尘埃的制造环境",
      tag: "半导体洁净室",
      image: publicAsset("images/euv-mirror/semiconductor-cleanroom.jpg"),
      alt: "研究人员在黄色照明的半导体洁净室中操作设备",
      text: "芯片上的结构非常微小，灰尘也可能破坏图案。EUV光路还必须在真空中工作，因为空气会强烈吸收这种极短波长的光。"
    },
    {
      number: "02",
      title: "普通玻璃透镜在这里帮不上忙",
      tag: "早期EUV实验设备",
      image: publicAsset("images/euv-mirror/euv-tool.jpg"),
      alt: "研究人员站在早期极紫外光刻实验设备旁",
      text: "13.5纳米的极紫外光会被普通玻璃吸收，因此设备不能像照相机那样主要依靠透镜，只能让光在多面超精密反射镜之间接力传播。"
    },
    {
      number: "03",
      title: "最后把微小图案投向硅晶圆",
      tag: "晶圆与芯片阵列",
      image: publicAsset("images/euv-mirror/silicon-wafer.jpg"),
      alt: "表面排列着大量方形芯片图案的硅晶圆",
      text: "反射镜不仅改变光的方向，还要把光准确整形和聚焦，最终将掩模上的图案缩小投射到涂有感光材料的晶圆上。"
    }
  ];

  return <section className="rainbow-life-section euv-life-section" aria-labelledby="euv-life-title">
    <header>
      <div><span>PHYSICS AT THE FRONTIER / 物理走进科技</span><h2 id="euv-life-title">制造先进芯片，<br />为什么要用“超级反射镜”？</h2></div>
      <div><Atom size={22} /><p><strong>因为EUV光几乎会被所有普通材料吸收。</strong>光刻机要在真空中，用一组表面极其精密、覆盖多层薄膜的反射镜，把13.5纳米的极紫外光一步步送到晶圆。</p></div>
    </header>
    <div className="rainbow-life-grid euv-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="euv-path-lab">
      <div className="euv-path-copy">
        <span>INTERACTIVE OPTICAL PATH / 动态光路</span>
        <h3>让极紫外光经过几面反射镜？</h3>
        <p>拖动滑杆，观察光怎样在镜面之间一次次改变方向。每一次碰到镜面，入射角与反射角仍然相等；“超级”来自镜面精度和多层薄膜，而不是违反反射定律。</p>
        <label htmlFor="euv-mirror-count"><b>参与反射的镜面数</b><output>{mirrorCount} 面</output></label>
        <input id="euv-mirror-count" type="range" min="1" max="6" step="1" value={mirrorCount} onChange={(event) => setMirrorCount(Number(event.target.value))} />
        <div className="euv-energy-meter"><span style={{ width: `${remaining}%` }} /><b>示意剩余光强约 {remaining.toFixed(1)}%</b></div>
        <small>简化估算：假设每面镜保留约70%的入射光，经过 {mirrorCount} 面后约为 70%<sup>{mirrorCount}</sup>。真实设备还包含其他光学环节。</small>
      </div>
      <div className="euv-path-visual">
        <svg viewBox="0 0 820 320" role="img" aria-label={`极紫外光经过${mirrorCount}面反射镜的动态示意图`}>
          <defs>
            <filter id="euvGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="euvMirror" x1="0" x2="1"><stop offset="0" stopColor="#6c7c91" /><stop offset="0.5" stopColor="#edf6ff" /><stop offset="1" stopColor="#4f6278" /></linearGradient>
          </defs>
          <g className="euv-grid">{Array.from({ length: 13 }, (_, index) => <line x1={45 + index * 60} x2={45 + index * 60} y1="36" y2="274" key={`euv-v-${index}`} />)}{Array.from({ length: 5 }, (_, index) => <line x1="38" x2="782" y1={50 + index * 52} y2={50 + index * 52} key={`euv-h-${index}`} />)}</g>
          <polyline className="euv-path-ghost" points={[source, ...mirrorPoints].map((point) => `${point.x},${point.y}`).join(" ")} />
          <polyline className="euv-path-active" points={activePoints.map((point) => `${point.x},${point.y}`).join(" ")} filter="url(#euvGlow)" />
          <g className="euv-source" transform={`translate(${source.x} ${source.y})`}><circle r="21" /><circle r="8" /><text x="-24" y="45">EUV光源</text></g>
          {mirrorPoints.map((point, index) => <g className={`euv-mirror ${index < mirrorCount ? "is-active" : ""}`} transform={`translate(${point.x} ${point.y}) rotate(${index % 2 === 0 ? -36 : 36})`} key={index}><ellipse rx="30" ry="9" fill="url(#euvMirror)" /><line x1="-27" x2="27" y1="0" y2="0" /><text transform={`rotate(${index % 2 === 0 ? 36 : -36})`} x="-15" y={index % 2 === 0 ? -23 : 34}>M{index + 1}</text></g>)}
          <g className="euv-wafer"><ellipse cx="780" cy="282" rx="31" ry="9" /><path d="M749 282 v10 c0 7 62 7 62 0 v-10" /><text x="755" y="318">晶圆</text></g>
        </svg>
        <div className="euv-visual-caption"><b>{mirrorCount < 6 ? `光正在第 ${mirrorCount} 面镜处等待继续传递` : "六面投影反射镜完成光束整形与投射"}</b><span>镜面上的每一次转折，都遵守初中物理中的光的反射定律。</span></div>
      </div>
    </div>
    <div className="rainbow-mechanism-strip euv-mechanism-strip">
      <span><b>产生EUV光</b><small>工作波长约13.5纳米，肉眼不可见</small></span><i>→</i>
      <span><b>进入真空光路</b><small>避免空气把极紫外光吸收</small></span><i>→</i>
      <span><b>多面镜接力反射</b><small>多层薄膜提高反射能力并整形光束</small></span><i>→</i>
      <span><b>图案投向晶圆</b><small>把掩模图案缩小成芯片上的微小结构</small></span>
    </div>
    <aside><Info size={19} /><p><b>一句话理解：</b>普通镜子主要反射可见光；EUV“超级反射镜”要反射肉眼看不见的极紫外光。它并非100%反射，所以每增加一次反射都会损失一部分光。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Clean_room.jpg" target="_blank" rel="noreferrer">NASA（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Extreme_ultraviolet_lithography_tool.jpg" target="_blank" rel="noreferrer">Lawrence Livermore National Laboratory（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Silicon_wafer.jpg" target="_blank" rel="noreferrer">Inductiveload（公共领域）</a>；知识参考：<a href="https://www.asml.com/en/technology/lithography-principles/lenses-and-mirrors" target="_blank" rel="noreferrer">ASML</a>、<a href="https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html" target="_blank" rel="noreferrer">ZEISS</a>。</small>
  </section>;
}
