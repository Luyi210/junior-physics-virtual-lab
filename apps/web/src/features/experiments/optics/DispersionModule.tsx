import { useState, useRef, useEffect } from "react";
import { type TutorialTarget, subscribeTutorialCommands, publishExperimentSnapshot, publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { useHarnessStore } from "../../assistant/harnessStore";
import { calculateTriangularPrismRayPath } from "@physics-lab/physics";
import { Sun, RotateCcw, Info, WandSparkles, Eye, Sparkles } from "lucide-react";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";
import { publicAsset } from "./shared/assets";

type DispersionLightMode = "white" | "red" | "green" | "blue" | "rgb";

const dispersionColors = ["#ff5d56", "#ff9d45", "#f2d44c", "#69d56e", "#4bb9f1", "#5578e8", "#9b62d2"];

const spectrumRefractiveIndices = [1.49, 1.50, 1.51, 1.52, 1.53, 1.54, 1.55];

const dispersionLightOptions: Array<{ key: DispersionLightMode; label: string; note: string; color: string; beam: string; components: Array<{ color: string; refractiveIndex: number }> }> = [
  { key: "white", label: "白光", note: "连续七色光谱", color: "#fff7c5", beam: "#fffde9", components: dispersionColors.map((color, index) => ({ color, refractiveIndex: spectrumRefractiveIndices[index]! })) },
  { key: "red", label: "红光", note: "单色光，只偏折", color: "#ff5d56", beam: "#ff5d56", components: [{ color: "#ff5d56", refractiveIndex: 1.49 }] },
  { key: "green", label: "绿光", note: "单色光，只偏折", color: "#69d56e", beam: "#69d56e", components: [{ color: "#69d56e", refractiveIndex: 1.52 }] },
  { key: "blue", label: "蓝光", note: "单色光，只偏折", color: "#4bb9f1", beam: "#4bb9f1", components: [{ color: "#4bb9f1", refractiveIndex: 1.54 }] },
  { key: "rgb", label: "RGB混合光", note: "分离为三条色光", color: "#f8f8ef", beam: "#fffde9", components: [{ color: "#ff5d56", refractiveIndex: 1.49 }, { color: "#69d56e", refractiveIndex: 1.52 }, { color: "#4bb9f1", refractiveIndex: 1.54 }] }
];

export function DispersionModule() {
  const [prismAngle, setPrismAngle] = useState(0);
  const [screenDistance, setScreenDistance] = useState(250);
  const [slitWidth, setSlitWidth] = useState(3);
  const [lightMode, setLightMode] = useState<DispersionLightMode>("white");
  const [sourceOn, setSourceOn] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [tutorialFocus, setTutorialFocus] = useState<TutorialTarget>();
  const changeOrigin = useRef<"learner" | "tutorial">("learner");
  const recordHarness = useHarnessStore((state) => state.record);
  const distanceRatio = (screenDistance - 120) / 260;
  const screenX = 610 + distanceRatio * 190;
  const selectedLight = dispersionLightOptions.find((option) => option.key === lightMode)!;
  const componentRays = selectedLight.components.map((component) => calculateTriangularPrismRayPath({ prismAngleDegrees: prismAngle, refractiveIndex: component.refractiveIndex, screenX }));
  const referenceRay = componentRays[Math.floor(componentRays.length / 2)]!;
  const bandThickness = 5 + slitWidth * 1.15;
  const landingPoints = componentRays.map((ray) => ray.landing.y);
  const screenBandTop = Math.min(...landingPoints) - bandThickness / 2;
  const screenBandBottom = Math.max(...landingPoints) + bandThickness / 2;
  const spectrumHeight = screenBandBottom - screenBandTop;
  const active = interacted && sourceOn;
  const interact = () => { changeOrigin.current = "learner"; setInteracted(true); setSourceOn(true); };
  const toggleSource = () => {
    changeOrigin.current = "learner";
    setInteracted(true);
    setSourceOn((value) => {
      recordHarness("simulation.toggled", { running: !value, action: `${selectedLight.label}光源` });
      return !value;
    });
  };
  const selectLight = (next: DispersionLightMode) => {
    changeOrigin.current = "learner";
    setLightMode(next);
    setSourceOn(true);
    setInteracted(true);
    recordHarness("configuration.changed", { experiment: "dispersion", light: next });
  };
  const reset = () => {
    changeOrigin.current = "learner";
    setPrismAngle(0);
    setScreenDistance(250);
    setSlitWidth(3);
    setLightMode("white");
    setSourceOn(false);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "dispersion", action: "reset" });
  };

  useEffect(() => subscribeTutorialCommands((command) => {
    if (command.module !== "dispersion") return;
    if (command.type === "widget_clearHighlight") {
      setTutorialFocus(undefined);
      return;
    }
    if (command.type === "widget_highlight") {
      setTutorialFocus(command.target);
      window.setTimeout(() => (document.querySelector(`[data-tutorial-spotlight="${command.target}"]`) ?? document.querySelector(`[data-tutorial-target="${command.target}"]`))?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      return;
    }
    changeOrigin.current = "tutorial";
    if (command.state.prismAngle !== undefined) setPrismAngle(command.state.prismAngle);
    if (command.state.screenDistance !== undefined) setScreenDistance(command.state.screenDistance);
    if (command.state.slitWidth !== undefined) setSlitWidth(command.state.slitWidth);
    if (command.state.lightMode !== undefined) setLightMode(command.state.lightMode);
    if (command.state.sourceOn !== undefined) {
      setSourceOn(command.state.sourceOn);
      setInteracted(command.state.sourceOn);
    }
  }), []);

  useEffect(() => {
    publishExperimentSnapshot({
      module: "dispersion",
      origin: changeOrigin.current,
      state: { prismAngle, screenDistance, slitWidth, lightMode, sourceOn }
    });
    const observation = !sourceOn ? "光源关闭，等待观察" : lightMode === "white" ? "形成连续七色光谱" : lightMode === "rgb" ? "分离为红绿蓝三条色光" : `${selectedLight.label}只发生偏折`;
    publishApparatusSnapshot({
      module: "dispersion", capturedAt: new Date().toISOString(), origin: changeOrigin.current,
      controls: [
        { id: "prism-angle", label: "三棱镜转角", value: prismAngle, unit: "°", source: "control" },
        { id: "screen-distance", label: "棱镜到光屏距离", value: screenDistance, unit: "mm", source: "control" },
        { id: "slit-width", label: "狭缝宽度", value: slitWidth, unit: "mm", source: "control" },
        { id: "light-mode", label: "入射光", value: selectedLight.label, source: "control" }
      ],
      apparatus: [{ id: "source-on", label: "光源开启", value: sourceOn, source: "apparatus" }],
      readings: [
        { id: "screen-observation", label: "光屏现象", value: observation, source: "reading" },
        { id: "spectrum-width", label: "光屏色带宽度", value: sourceOn ? screenBandBottom - screenBandTop : null, unit: "px（示意）", source: "reading" }
      ],
      derived: [{ id: "optical-model", label: "物理模型", value: lightMode === "white" || lightMode === "rgb" ? "复色光中不同成分的折射程度不同" : "单色光折射但不产生新颜色", source: "model" }],
      validity: { ready: sourceOn, issues: sourceOn ? [] : ["先打开光源，再观察光屏上的色带数量和位置。"] }
    });
    changeOrigin.current = "learner";
  }, [lightMode, prismAngle, screenBandBottom, screenBandTop, screenDistance, selectedLight.label, slitWidth, sourceOn]);
  const resultTitle = lightMode === "white" ? "白光展开成连续的七色光谱" : lightMode === "rgb" ? "RGB混合光分离成三条色光" : `${selectedLight.label}发生折射，但没有分解出新颜色`;
  const resultDetail = lightMode === "white" ? "不同色光的偏折程度不同，红光偏折较小，紫光偏折较大" : lightMode === "rgb" ? "混合光中原本包含的红、绿、蓝重新分开" : "单色光只有一种主要波长，因此光屏上只出现一条同色光带";

  return <div className={`open-experience dispersion-tutorial-connected ${tutorialFocus ? `tutorial-focus-${tutorialFocus}` : ""}`} data-tutorial-target="experiment">
    <ModuleIntro eyebrow="活动 2.1 / 三棱镜色散" title="让白光和彩色光，穿过同一块三棱镜" text="色散实验不一定只能使用白光。切换白光、单色光或 RGB 混合光，再比较它们经过三棱镜后的光路和光屏结果：复色光会分开，单色光只发生偏折。" />
    <div className={`dispersion-toolbar ${tutorialFocus === "source" ? "tutorial-target-active" : ""}`} data-tutorial-target="source" data-tutorial-spotlight="source" aria-label="色散实验快捷操作">
      <button className={sourceOn ? "source-active" : ""} onClick={toggleSource}><Sun size={16} />{sourceOn ? "关闭光源" : "打开光源"}</button>
      <span><i className={sourceOn ? "on" : ""} />{sourceOn ? `${selectedLight.label}已开启，观察光屏` : `${selectedLight.label}已选择，光源关闭`}</span>
      <button onClick={reset}><RotateCcw size={15} />恢复初始位置</button>
    </div>
    <section className={`dispersion-light-picker ${tutorialFocus === "light-picker" ? "tutorial-target-active" : ""}`} data-tutorial-target="light-picker" data-tutorial-spotlight="light-picker" aria-label="选择入射光颜色">
      <div><small>LIGHT SOURCE / 选择入射光</small><strong>光的色散一定要用白光吗？</strong><p>不一定。任何颜色的光都能发生折射；但只有包含多种颜色的复色光，经过三棱镜后才会分离出多条色光。</p></div>
      <nav>{dispersionLightOptions.map((option) => <button className={lightMode === option.key ? "active" : ""} onClick={() => selectLight(option.key)} key={option.key}><i className={`light-swatch swatch-${option.key}`} style={{ "--swatch": option.color } as React.CSSProperties} /><span><b>{option.label}</b><small>{option.note}</small></span></button>)}</nav>
    </section>
    <div className={`ray-law-lab dispersion-lab ${tutorialFocus === "prism" || tutorialFocus === "screen" || tutorialFocus === "result" ? "tutorial-target-active" : ""}`} data-tutorial-target="experiment-visual" data-tutorial-spotlight="experiment">
      <svg viewBox="0 0 900 430" preserveAspectRatio="xMidYMid meet" aria-label="三棱镜色散动态实验">
        <defs><linearGradient id="spectrumScreen" x1="0" y1="0" x2="0" y2="1">{dispersionColors.map((color, index) => <stop offset={`${index / 6 * 100}%`} stopColor={color} key={color} />)}</linearGradient><linearGradient id="rgbSourceFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff5d56" /><stop offset="50%" stopColor="#69d56e" /><stop offset="100%" stopColor="#4bb9f1" /></linearGradient><filter id="spectrumGlow"><feGaussianBlur stdDeviation={Math.max(.35, slitWidth * .17)} result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`dv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`dh-${index}`} />)}</g>
        <g className={`white-light-source ${sourceOn ? "source-on" : "source-off"}`}><rect x="65" y="155" width="82" height="140" rx="4" /><circle cx="105" cy="225" r="23" style={{ fill: sourceOn ? lightMode === "rgb" ? "url(#rgbSourceFill)" : selectedLight.color : "#596b6d", filter: sourceOn ? `drop-shadow(0 0 13px ${selectedLight.color})` : "none" }} /><path d={`M128 225 L${referenceRay.entry.x} ${referenceRay.entry.y}`} style={{ stroke: selectedLight.beam, strokeWidth: Math.max(2.4, 2.4 + slitWidth * .32), filter: sourceOn ? `drop-shadow(0 0 5px ${selectedLight.color})` : "none" }} /><text x="64" y="320">{selectedLight.label}光源 + 狭缝</text><text className="device-state" x="82" y="341">{sourceOn ? "ON" : "OFF"}</text></g>
        <g className={`prism-optic ${tutorialFocus === "prism" ? "tutorial-svg-focus" : ""}`} data-tutorial-spotlight="prism" transform={`rotate(${prismAngle} 410 225)`}><path d="M410 115 L460 305 L360 305 Z" /><text x="383" y="285">三棱镜</text></g>
        {active && <g className="in-prism-spectrum" filter="url(#spectrumGlow)">{componentRays.map((ray, index) => <path className="in-prism-ray" d={`M${ray.entry.x} ${ray.entry.y} L${ray.exit.x} ${ray.exit.y}`} style={{ stroke: selectedLight.components[index]!.color }} key={`inside-${index}`}/>)}</g>}
        <g className={`spectrum-screen ${tutorialFocus === "screen" || tutorialFocus === "result" ? "tutorial-svg-focus" : ""}`} data-tutorial-spotlight="screen"><rect x={screenX} y="62" width="26" height="326" rx="2" /><line className="screen-ruler" x1={screenX + 31} x2={screenX + 31} y1={screenBandTop} y2={screenBandBottom} /><text x={screenX - 2} y="411">光屏</text>{active && <>{lightMode === "white" ? <rect className="spectrum-patch" x={screenX + 3} y={screenBandTop} width="17" height={spectrumHeight} rx="3" fill="url(#spectrumScreen)" style={{ opacity: .66 + slitWidth * .025, filter: `blur(${Math.max(0, slitWidth - 3) * .12}px)` }} /> : selectedLight.components.map((component, index) => <rect className="spectrum-patch spectrum-line" x={screenX + 3} y={componentRays[index]!.landing.y - bandThickness / 2} width="17" height={bandThickness} rx="2" fill={component.color} style={{ filter: `blur(${Math.max(0, slitWidth - 3) * .1}px)` }} key={`${component.color}-${index}`} />)}<text className="screen-hit-label" x={screenX - 104} y={screenBandTop - 13}>{lightMode === "white" ? "连续七色光谱" : lightMode === "rgb" ? "三条色光落在这里" : `${selectedLight.label}落在这里`}</text><path className="screen-hit-arrow" d={`M${screenX - 18} ${screenBandTop - 16} L${screenX + 2} ${screenBandTop + 2}`} /></>}</g>
        {active && <g className="spectrum-rays" filter="url(#spectrumGlow)">{selectedLight.components.map((component, index) => { const ray = componentRays[index]!; return <g key={`${component.color}-${index}`}><path d={`M${ray.exit.x} ${ray.exit.y} L${screenX + 3} ${ray.landing.y}`} stroke={component.color} style={{ opacity: .58 + slitWidth * .035 }} /><circle className="spectrum-impact" cx={screenX + 3} cy={ray.landing.y} r={2.5 + slitWidth * .08} fill={component.color} /></g>; })}</g>}
        <g className="distance-measure"><line x1="460" x2={screenX} y1="374" y2="374" /><line x1="460" x2="460" y1="367" y2="381" /><line x1={screenX} x2={screenX} y1="367" y2="381" /><text x={(460 + screenX) / 2 - 35} y="365">棱镜—光屏 {screenDistance} mm</text></g>
      </svg>
      {!interacted && <OpticsInteractionCue text="选择一种入射光，开始比较光屏结果" />}
      <div className={`law-readout ${active ? "" : "awaiting-reading"} ${tutorialFocus === "result" ? "tutorial-target-active" : ""}`} data-tutorial-spotlight="result"><span>{active ? lightMode === "white" ? "CONTINUOUS SPECTRUM" : lightMode === "rgb" ? "THREE-COLOR SPECTRUM" : "MONOCHROMATIC LIGHT" : "LIGHT SOURCE STANDBY"}</span><strong>{active ? resultTitle : `等待开启${selectedLight.label}`}</strong><small>{active ? resultDetail : "先选择一种光源，再沿光路观察最终落点"}</small></div>
    </div>
    <div className="open-control-deck dispersion-controls"><RangeControl label="三棱镜转角" value={prismAngle} min={-16} max={16} step={1} unit="°" onChange={setPrismAngle} onInteract={interact} tutorialTarget="prism" highlighted={tutorialFocus === "prism"} /><RangeControl label="棱镜到光屏距离" value={screenDistance} min={120} max={380} step={10} unit="mm" onChange={setScreenDistance} onInteract={interact} tutorialTarget="screen-distance" highlighted={tutorialFocus === "screen-distance"} /><RangeControl label="狭缝宽度" value={slitWidth} min={1} max={10} step={1} unit="mm" onChange={setSlitWidth} onInteract={interact} /><div className={`observation-output ${active ? "" : "awaiting-reading"} ${tutorialFocus === "result" ? "tutorial-target-active" : ""}`} data-tutorial-spotlight="result"><span>{active ? `当前光源 · ${selectedLight.label}` : "实验尚未开始"}</span><strong>{active ? lightMode === "white" ? "复色光形成连续光谱" : lightMode === "rgb" ? "三种成分光重新分离" : "单色光不会产生新的颜色" : "选择一种光源开始比较"}</strong><p>{active ? "保持其他条件不变，只切换入射光，比较光屏上色带的数量和位置。" : "实验结果会在你的操作之后出现。"}</p></div></div>
    <section className="dispersion-guide" aria-label="三棱镜色散实验说明">
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>这是什么实验？应该怎样操作？</h2><p>这是一套可更换光源的三棱镜色散实验。它用白光、单色光和 RGB 混合光进行对照，把“复色光会分离、单色光只偏折”变成可以直接观察的光屏现象。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>色散的关键是“复色光”</strong><p>白光含有多种颜色，所以能展开成连续光谱；红、绿、蓝单色光只有一种主要波长，通过三棱镜后会改变方向，却不会凭空产生其他颜色。</p></span></article>
        <article><i><WandSparkles size={19} /></i><span><small>02 · 怎么操作</small><strong>固定装置，只切换入射光</strong><p>依次选择白光、红光、绿光、蓝光和 RGB 混合光，比较光屏结果；然后再移动光屏或改变狭缝宽度，研究同一种光在不同条件下的变化。</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>比较色带数量与偏折位置</strong><p>白光形成连续光谱，RGB 混合光分成三条，单色光只留下一条。再比较落点：红光偏折较小，蓝光偏折更大。</p></span></article>
      </div>
      <footer><b>建议比较：</b>先固定三棱镜、光屏和狭缝，只改变光源颜色；再固定光源，只改变光屏距离。一次只改变一个条件，才能判断现象究竟由什么引起。</footer>
    </section>
    <RainbowLifeSection />
  </div>;
}

function RainbowLifeSection() {
  const scenes = [
    {
      number: "01",
      title: "雨后彩虹",
      tag: "最典型的自然色散",
      image: publicAsset("images/rainbow/rainbow-after-rain.webp"),
      alt: "雨后乌云和阳光之间出现完整的主虹",
      text: "太阳光进入雨滴时先折射并发生色散，在水滴内部反射一次，离开水滴时再次折射。不同颜色以不同方向进入眼睛，于是我们看见外红内紫的圆弧。"
    },
    {
      number: "02",
      title: "喷泉与水雾彩虹",
      tag: "生活中可以主动寻找",
      image: publicAsset("images/rainbow/fountain-rainbow.webp"),
      alt: "阳光照射公园喷泉水雾形成近距离彩虹",
      text: "喷泉、瀑布和洒水器产生的大量小水滴，也能像雨滴一样分解阳光。背对太阳、面向水雾并改变观察位置，常能找到一段近距离彩虹。"
    },
    {
      number: "03",
      title: "双彩虹",
      tag: "一次反射与两次反射",
      image: publicAsset("images/rainbow/double-rainbow.webp"),
      alt: "山脉上方同时出现明亮主虹和较暗副虹",
      text: "较亮的主虹来自水滴内一次反射；较暗的副虹来自两次反射，损失的光更多，而且颜色顺序与主虹相反。两道虹之间通常还会显得更暗。"
    }
  ];
  return <section className="rainbow-life-section" aria-labelledby="rainbow-life-title">
    <header>
      <div><span>NATURE &amp; DAILY LIFE / 自然与生活</span><h2 id="rainbow-life-title">天空把每一颗雨滴，<br />都变成了一枚小棱镜。</h2></div>
      <div><Sparkles size={21} /><p><strong>彩虹不只是“白光被分成七色”。</strong>一束阳光还要在水滴中经历折射、色散和内部反射，并以合适的角度进入观察者眼睛，彩虹才会出现。</p></div>
    </header>
    <div className="rainbow-life-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="rainbow-mechanism-strip">
      <span><b>阳光进入水滴</b><small>第一次折射并发生色散</small></span><i>→</i>
      <span><b>水滴内部反射</b><small>光线改变传播方向</small></span><i>→</i>
      <span><b>离开水滴</b><small>再次折射，颜色继续分开</small></span><i>→</i>
      <span><b>进入观察者眼睛</b><small>太阳应在观察者身后</small></span>
    </div>
    <aside><Sun size={19} /><p><b>观察小提示：</b>雨后或喷泉旁，背对太阳、面向水滴，再缓慢改变站立位置。不要为了寻找彩虹而直视太阳。</p></aside>
  </section>;
}
