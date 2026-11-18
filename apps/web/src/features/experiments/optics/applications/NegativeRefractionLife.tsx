import { useState } from "react";
import { Waves, Info } from "lucide-react";
import { publicAsset } from "../shared/assets";

type FrontierRefractionMode = "ordinary" | "negative" | "cloak";

export function NegativeRefractionLife() {
  const [mode, setMode] = useState<FrontierRefractionMode>("ordinary");
  const [controlValue, setControlValue] = useState(36);
  const center = { x: 410, y: 178 };
  const incidenceRadians = controlValue * Math.PI / 180;
  const refractedRadians = controlValue * 0.62 * Math.PI / 180;
  const incidentStart = { x: center.x - Math.tan(incidenceRadians) * 142, y: 36 };
  const refractedEnd = { x: center.x + (mode === "negative" ? -1 : 1) * Math.tan(refractedRadians) * 142, y: 320 };
  const cloakSpread = 34 + controlValue * 0.75;
  const scenes = [
    {
      number: "01",
      title: "关键不只在材料成分，更在微小结构",
      tag: "NASA超材料阵列",
      image: publicAsset("images/negative-refraction/split-ring-array.jpg"),
      alt: "由许多铜制开口环和导线单元排列成的超材料阵列",
      text: "超材料常由大量比工作波长更小的人工单元按规律排列。电磁波感受到的是整体结构产生的效果，因此它可能表现出普通天然材料没有的性质。"
    },
    {
      number: "02",
      title: "折射光跑到了法线的“反常”一侧",
      tag: "正折射与负折射",
      image: publicAsset("images/negative-refraction/negative-index-focusing.png"),
      alt: "正折射、负折射和负折射材料聚焦光线的对比示意图",
      text: "普通材料中，折射光与入射光分居法线两侧；在负折射示意中，折射光会落在法线的另一种位置，看起来像向通常相反的方向偏折。"
    },
    {
      number: "03",
      title: "让电磁波像水流绕过石头",
      tag: "实验性电磁隐身样品",
      image: publicAsset("images/negative-refraction/electromagnetic-cloak.jpg"),
      alt: "由多层金属圆片组成的宽带电磁隐身实验样品",
      text: "某些隐身设计尝试让电磁波在物体周围分流，经过后再重新汇合，减少反射和阴影。已有代表性实验主要针对微波等特定波段，并非肉眼可见的万能隐身衣。"
    }
  ];

  return <section className="rainbow-life-section negative-life-section" aria-labelledby="negative-life-title">
    <header>
      <div><span>PHYSICS AT THE FRONTIER / 物理走进科技</span><h2 id="negative-life-title">负折射与隐身材料：<br />让光向“反常方向”偏折</h2></div>
      <div><Waves size={22} /><p><strong>“反常”并不代表违反物理规律。</strong>科学家通过设计微小结构，改变材料与电磁波的整体作用方式，让折射方向或传播路径呈现普通水和玻璃中看不到的现象。</p></div>
    </header>
    <div className="rainbow-life-grid negative-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="negative-path-lab">
      <div className="negative-path-copy">
        <span>INTERACTIVE FRONTIER LAB / 前沿光路体验</span>
        <h3>同一束光，材料怎样安排它的路线？</h3>
        <p>先在普通折射和负折射之间切换，再开启隐身光路。这里使用的是帮助理解的简化模型，不表示所有超材料都具有负折射或隐身能力。</p>
        <div className="negative-mode-tabs" role="group" aria-label="选择前沿折射演示模式">
          <button className={mode === "ordinary" ? "active" : ""} onClick={() => setMode("ordinary")}>普通折射</button>
          <button className={mode === "negative" ? "active" : ""} onClick={() => setMode("negative")}>负折射</button>
          <button className={mode === "cloak" ? "active" : ""} onClick={() => setMode("cloak")}>绕流隐身</button>
        </div>
        <label htmlFor="frontier-refraction-control"><b>{mode === "cloak" ? "电磁波绕行幅度" : "入射角"}</b><output>{controlValue}{mode === "cloak" ? "%" : "°"}</output></label>
        <input id="frontier-refraction-control" type="range" min="15" max="65" step="1" value={controlValue} onChange={(event) => setControlValue(Number(event.target.value))} />
        <div className={`negative-status mode-${mode}`}><i /><span><small>当前观察</small><strong>{mode === "ordinary" ? "折射光进入法线右侧" : mode === "negative" ? "折射光进入法线左侧" : "波在障碍物两侧分开并重新汇合"}</strong></span></div>
      </div>
      <div className="negative-path-visual">
        <svg viewBox="0 0 820 360" role="img" aria-label={mode === "cloak" ? "电磁波绕过物体并重新汇合的隐身原理示意" : `${mode === "negative" ? "负" : "普通"}折射动态光路示意`}>
          <defs>
            <filter id="negativeGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="cloakCore"><stop offset="0" stopColor="#25313a" /><stop offset="1" stopColor="#090e12" /></radialGradient>
          </defs>
          <g className="frontier-grid">{Array.from({ length: 13 }, (_, index) => <line x1={48 + index * 60} x2={48 + index * 60} y1="30" y2="330" key={`frontier-v-${index}`} />)}{Array.from({ length: 6 }, (_, index) => <line x1="35" x2="785" y1={40 + index * 55} y2={40 + index * 55} key={`frontier-h-${index}`} />)}</g>
          {mode !== "cloak" ? <>
            <rect className={`frontier-medium ${mode}`} x="35" y={center.y} width="750" height={160} />
            <line className="frontier-interface" x1="35" x2="785" y1={center.y} y2={center.y} />
            <line className="frontier-normal" x1={center.x} x2={center.x} y1="25" y2="337" />
            <path className="frontier-incident" d={`M${incidentStart.x} ${incidentStart.y} L${center.x} ${center.y}`} filter="url(#negativeGlow)" />
            <path className={`frontier-refracted ${mode}`} d={`M${center.x} ${center.y} L${refractedEnd.x} ${refractedEnd.y}`} filter="url(#negativeGlow)" />
            <circle className="frontier-point" cx={center.x} cy={center.y} r="5" />
            <path className="frontier-angle" d={`M${center.x} 120 A58 58 0 0 0 ${center.x - Math.sin(incidenceRadians) * 58} ${center.y - Math.cos(incidenceRadians) * 58}`} />
            <text className="frontier-label" x="57" y="69">空气 · 正折射率</text>
            <text className="frontier-label lower" x="57" y="310">{mode === "ordinary" ? "普通材料 · 正折射率" : "超材料示意 · 负折射率"}</text>
            <text className="frontier-normal-label" x={center.x + 10} y="50">法线</text>
          </> : <>
            <g className="cloak-field" filter="url(#negativeGlow)">{[-70, -35, 0, 35, 70].map((offset, index) => {
              const y = 180 + offset;
              const bend = Math.max(28, cloakSpread - Math.abs(offset) * .32);
              const direction = offset === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(offset);
              const controlY = y + direction * bend;
              return <path d={`M40 ${y} C220 ${y},255 ${controlY},330 ${controlY} C375 ${controlY},445 ${controlY},490 ${controlY} C565 ${controlY},600 ${y},780 ${y}`} key={offset} />;
            })}</g>
            <circle className="cloak-shell" cx="410" cy="180" r="94" />
            <circle className="cloak-object" cx="410" cy="180" r="48" fill="url(#cloakCore)" />
            <text className="cloak-object-label" x="385" y="185">隐藏区</text>
            <text className="frontier-label" x="55" y="55">入射波</text><text className="frontier-label" x="702" y="55">重新汇合</text>
          </>}
        </svg>
        <div className="negative-visual-caption"><b>{mode === "ordinary" ? "课本范围：光从空气进入普通介质" : mode === "negative" ? "拓展范围：折射率取负值时，折射方向发生反转" : "研究设想：减少物体对特定电磁波的反射与遮挡"}</b><span>{mode === "cloak" ? "隐身光路与负折射都可借助超材料研究，但隐身并不等同于负折射。" : "改变滑杆，比较入射角变化时折射光的方向。"}</span></div>
      </div>
    </div>
    <div className="rainbow-mechanism-strip negative-mechanism-strip">
      <span><b>设计微小单元</b><small>形状、尺寸和排列共同决定整体响应</small></span><i>→</i>
      <span><b>组合成超材料</b><small>材料性质更多来自结构而非单一成分</small></span><i>→</i>
      <span><b>重新安排传播方向</b><small>可以研究负折射、聚焦和波前调控</small></span><i>→</i>
      <span><b>探索隐身与成像</b><small>目前通常受波段、方向、损耗等条件限制</small></span>
    </div>
    <aside><Info size={19} /><p><b>科学边界：</b>2006年的代表性隐身实验让微波绕过小型物体，并不是让物体在可见光下消失。真正面向所有颜色、所有方向和大型物体的“万能隐身衣”仍未实现。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Split-ring_resonator_array_10K_sq_nm.jpg" target="_blank" rel="noreferrer">NASA（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Negative_refraction_index_focusing.png" target="_blank" rel="noreferrer">Pyjeon（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Broadband_electromagnetic_cloak_of_cylindrical_objects.jpg" target="_blank" rel="noreferrer">Picassonok（CC BY-SA 4.0）</a>；研究参考：<a href="https://www.science.org/doi/10.1126/science.1058847" target="_blank" rel="noreferrer">负折射实验</a>、<a href="https://today.duke.edu/2006/10/cloakdemo.html" target="_blank" rel="noreferrer">Duke微波隐身实验</a>。</small>
  </section>;
}
