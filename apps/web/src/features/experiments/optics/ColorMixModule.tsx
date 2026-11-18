import { useState } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { Atom, Focus, Info } from "lucide-react";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function ColorMixModule() {
  const [red, setRed] = useState(0);
  const [green, setGreen] = useState(0);
  const [blue, setBlue] = useState(0);
  const interacted = red + green + blue > 0;
  const mixedColor = `rgb(${Math.round(red * 2.55)}, ${Math.round(green * 2.55)}, ${Math.round(blue * 2.55)})`;
  const colorName = red > 75 && green > 75 && blue > 75 ? "接近白光" : red > 55 && green > 55 && blue < 25 ? "黄色光" : red > 55 && blue > 55 && green < 25 ? "品红色光" : green > 55 && blue > 55 && red < 25 ? "青色光" : "混合色光";

  return <div className="open-experience">
    <ModuleIntro eyebrow="活动 2.2 / 色光的混合" title="把红、绿、蓝三束光投到同一张白纸上" text="分别改变三束色光的强度，观察重叠区域。红、绿、蓝是光的三原色，色光采用加法混合：叠加的光越多，重叠区域通常越亮；电视和显示器正是用微小的 RGB 发光单元产生彩色画面。" />
    <div className="color-mix-lab">
      <div className="rgb-projectors"><span style={{ opacity: red / 100 }}>R</span><span style={{ opacity: green / 100 }}>G</span><span style={{ opacity: blue / 100 }}>B</span></div>
      <svg viewBox="0 0 900 430" aria-label="红绿蓝三原色色光混合实验">
        <defs><filter id="rgbBlur"><feGaussianBlur stdDeviation="8" /></filter></defs>
        <g className="rgb-beams"><path d="M115 90 L420 215 L115 215 Z" fill={`rgba(255,45,45,${red / 180})`} /><path d="M115 340 L420 215 L115 215 Z" fill={`rgba(35,255,80,${green / 180})`} /><path d="M785 215 L420 215 L785 85 Z" fill={`rgba(55,105,255,${blue / 180})`} /><path className="rgb-direction red" d="M145 153 L388 211" /><path className="rgb-direction green" d="M145 277 L388 219" /><path className="rgb-direction blue" d="M755 151 L452 211" /></g>
        <g className="rgb-overlap" filter="url(#rgbBlur)"><circle cx="382" cy="190" r="105" fill="#ff2929" opacity={red / 100} /><circle cx="458" cy="190" r="105" fill="#2dff62" opacity={green / 100} /><circle cx="420" cy="258" r="105" fill="#3f67ff" opacity={blue / 100} /></g>
        <circle className="mixed-sample" cx="420" cy="216" r="42" fill={interacted ? mixedColor : "#18313a"} />
        <text className="diagram-label" x="355" y="396">白色光屏上的重叠区域</text>
      </svg>
      {!interacted && <OpticsInteractionCue text="打开任意一束色光，开始混合" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "ADDITIVE RGB MIXING" : "RGB PROJECTORS OFF"}</span><strong>{interacted ? colorName : "三束色光尚未开启"}</strong><small>{interacted ? `屏幕模拟色值：${mixedColor}` : "先增加红、绿或蓝光强度"}</small></div>
    </div>
    <div className="rgb-controls"><RangeControl label="红光 R" value={red} min={0} max={100} step={5} unit="%" onChange={setRed} /><RangeControl label="绿光 G" value={green} min={0} max={100} step={5} unit="%" onChange={setGreen} /><RangeControl label="蓝光 B" value={blue} min={0} max={100} step={5} unit="%" onChange={setBlue} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>与颜料混合的区别</span><strong>{interacted ? "色光越叠加，重叠区越亮" : "等待打开色光"}</strong><p>色光是加法混合，RGB 常用于屏幕；颜料主要吸收部分色光，属于减法混合，规律不能直接照搬。</p></div></div>
    <MicroDisplayTechnology red={red} green={green} blue={blue} mixedColor={mixedColor} onRedChange={setRed} onGreenChange={setGreen} onBlueChange={setBlue} />
  </div>;
}

type MicroDisplayMode = "micro-led" | "micro-rgb";

type MicroDisplayView = "pixel" | "picture";

function MicroDisplayTechnology({ red, green, blue, mixedColor, onRedChange, onGreenChange, onBlueChange }: { red: number; green: number; blue: number; mixedColor: string; onRedChange: (value: number) => void; onGreenChange: (value: number) => void; onBlueChange: (value: number) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<MicroDisplayMode>("micro-led");
  const [view, setView] = useState<MicroDisplayView>("pixel");
  const [magnification, setMagnification] = useState(3);
  const active = red + green + blue > 0;
  const dominant = red === green && green === blue ? "三色均衡" : red >= green && red >= blue ? "红色分量较强" : green >= red && green >= blue ? "绿色分量较强" : "蓝色分量较强";
  const pixelSize = 11 + magnification * 3;
  const selectMode = (next: MicroDisplayMode) => { setMode(next); recordHarness("configuration.changed", { experiment: "micro-display", control: "显示技术", value: next }); };
  const selectView = (next: MicroDisplayView) => { setView(next); recordHarness("view.changed", { experiment: "micro-display", view: next, technology: mode }); };
  const applyPreset = (name: string, values: [number, number, number]) => { onRedChange(values[0]); onGreenChange(values[1]); onBlueChange(values[2]); recordHarness("configuration.changed", { experiment: "micro-display", control: "RGB颜色预设", value: name, red: values[0], green: values[1], blue: values[2] }); };
  const activePreset = red === 0 && green === 0 && blue === 0 ? "关闭" : red === 100 && green === 100 && blue === 100 ? "白色" : red === 100 && green === 100 && blue === 0 ? "黄色" : red === 0 && green === 100 && blue === 100 ? "青色" : red === 100 && green === 0 && blue === 100 ? "品红" : "自定义";

  return <section className={`micro-display-technology technology-${mode}`} aria-label="Micro LED与Micro RGB显示科技案例">
    <header><div><span>PHYSICS INTO TECHNOLOGY / 物理走进科技</span><h2>Micro LED 与 Micro RGB：下一代高端显示</h2><p>上面的三束光被缩小到屏幕像素中，仍然遵守红、绿、蓝色光的加法混合。切换两种技术并放大像素，看看它们都使用 RGB，却为什么不是同一种显示结构。</p></div><div className="micro-tech-badge"><Atom size={24} /><strong>RGB × 微米制造</strong><small>从初中光学走向显示工程</small></div></header>
    <div className="micro-operation-guide" aria-label="科技案例操作步骤"><span><b>01</b><strong>调节RGB</strong><small>滑动下面三条彩色控制杆</small></span><i>→</i><span><b>02</b><strong>选择技术</strong><small>比较Micro LED与Micro RGB</small></span><i>→</i><span><b>03</b><strong>观察像素</strong><small>切换视图并调整放大倍数</small></span></div>
    <section className="micro-local-controller" aria-label="Micro显示本地控制台">
      <header><div><span>LOCAL CONTROL / 本地控制</span><strong>不用返回上方，在这里直接调节像素</strong></div><nav aria-label="RGB颜色预设"><button className={activePreset === "关闭" ? "active" : ""} onClick={() => applyPreset("关闭", [0,0,0])}>关闭</button><button className={activePreset === "白色" ? "active" : ""} onClick={() => applyPreset("白色", [100,100,100])}>白色</button><button className={activePreset === "黄色" ? "active" : ""} onClick={() => applyPreset("黄色", [100,100,0])}>黄色</button><button className={activePreset === "青色" ? "active" : ""} onClick={() => applyPreset("青色", [0,100,100])}>青色</button><button className={activePreset === "品红" ? "active" : ""} onClick={() => applyPreset("品红", [100,0,100])}>品红</button></nav></header>
      <div><RangeControl label="红子像素 R" value={red} min={0} max={100} step={5} unit="%" onChange={onRedChange} /><RangeControl label="绿子像素 G" value={green} min={0} max={100} step={5} unit="%" onChange={onGreenChange} /><RangeControl label="蓝子像素 B" value={blue} min={0} max={100} step={5} unit="%" onChange={onBlueChange} /><RangeControl label="像素放大" value={magnification} min={1} max={6} step={1} unit="×" onChange={setMagnification} /></div>
    </section>
    <div className="micro-tech-switch" aria-label="切换显示技术">
      <button className={mode === "micro-led" ? "active" : ""} onClick={() => selectMode("micro-led")}><b>01</b><span><strong>Micro LED</strong><small>RGB微型芯片直接作为自发光子像素</small></span></button>
      <button className={mode === "micro-rgb" ? "active" : ""} onClick={() => selectMode("micro-rgb")}><b>02</b><span><strong>Micro RGB</strong><small>微米级RGB LED在液晶面板后方提供精细背光</small></span></button>
    </div>
    <div className="micro-display-workbench">
      <div className="micro-screen-observer">
        <div className="micro-observer-toolbar"><span>PIXEL MICROSCOPE / 像素显微镜</span><div><button className={view === "pixel" ? "active" : ""} onClick={() => selectView("pixel")}>单像素结构</button><button className={view === "picture" ? "active" : ""} onClick={() => selectView("picture")}>整屏成像</button></div></div>
        <div className={`micro-pixel-field view-${view}`} style={{ gridTemplateColumns: `repeat(12, ${pixelSize}px)`, gridAutoRows: `${pixelSize}px` }}>
          {Array.from({ length: 84 }, (_, index) => {
            const pictureFactor = view === "picture" ? .28 + ((index * 17 + Math.floor(index / 12) * 13) % 70) / 100 : 1;
            return <i className="micro-rgb-pixel" key={index}><b className="subpixel-red" style={{ opacity: active ? red / 100 * pictureFactor : .05 }} /><b className="subpixel-green" style={{ opacity: active ? green / 100 * pictureFactor : .05 }} /><b className="subpixel-blue" style={{ opacity: active ? blue / 100 * pictureFactor : .05 }} />{mode === "micro-rgb" && <em />}</i>;
          })}
        </div>
        {!active && <div className="micro-screen-standby"><Focus size={19} /><span><strong>先调节上方RGB光强</strong><small>这里直接使用三原色实验的数据</small></span></div>}
        <div className="micro-color-sample"><i style={{ background: active ? mixedColor : "#142731" }} /><span><small>当前模拟合成色</small><strong>{active ? dominant : "像素尚未点亮"}</strong></span></div>
      </div>
      <div className="micro-layer-inspector">
        <span>DISPLAY CROSS SECTION / 显示剖面</span><h3>{mode === "micro-led" ? "RGB子像素直接发光" : "RGB微型背光位于液晶层后方"}</h3>
        {mode === "micro-led" ? <div className="display-layer-stack micro-led-stack"><i className="eye-side">观察者</i><i className="emission-arrows"><b /><b /><b /></i><i className="rgb-emitter-layer"><b>R</b><b>G</b><b>B</b></i><i className="driver-layer">驱动背板</i></div> : <div className="display-layer-stack micro-rgb-stack"><i className="eye-side">观察者</i><i className="lcd-layer">液晶成像层</i><i className="optical-layer">光学控制层</i><i className="rgb-backlight-layer"><b>R</b><b>G</b><b>B</b></i><i className="driver-layer">微型RGB背光驱动</i></div>}
        <p>{mode === "micro-led" ? "每个红、绿、蓝微型LED都能独立发光，子像素本身直接组成画面，不需要传统背光源。" : "红、绿、蓝微型LED被精细排列并独立控制，但它们在当前Micro RGB电视结构中承担的是背光角色，前方仍有液晶成像层。"}</p>
        <div className="micro-inspector-hint"><Focus size={18} /><span><strong>放大控制已移到上方本地控制台</strong><small>调节后，这里的像素矩阵和剖面会同步更新。</small></span></div>
      </div>
    </div>
    <div className="micro-rgb-live-meter"><div><span>红子像素</span><strong>{red}%</strong><i style={{ transform: `scaleX(${red / 100})` }} /></div><div><span>绿子像素</span><strong>{green}%</strong><i style={{ transform: `scaleX(${green / 100})` }} /></div><div><span>蓝子像素</span><strong>{blue}%</strong><i style={{ transform: `scaleX(${blue / 100})` }} /></div><div><span>物理规律</span><strong>色光加法混合</strong><small>改变RGB比例，就能产生不同颜色</small></div></div>
    <div className="micro-tech-comparison">
      <article><span>共同基础</span><strong>都用红、绿、蓝控制颜色</strong><p>无论芯片位于像素表面还是面板背后，最终都要调节三种色光的相对强度来合成画面颜色。</p></article>
      <article><span>关键区别</span><strong>RGB微光源承担的角色不同</strong><p>Micro LED中它们直接构成自发光子像素；Micro RGB中它们组成更精细的RGB背光系统，不能只看名称就判断结构相同。</p></article>
      <article><span>工程挑战</span><strong>微小、数量巨大，还要几乎没有坏点</strong><p>4K屏幕包含约八百万像素；若每个像素包含RGB子像素，就涉及约两千四百万个发光单元的制造、转移、检测与修复。</p></article>
    </div>
    <aside className="micro-tech-note"><Info size={19} /><div><strong>一句话连接上面的实验</strong><p>三原色实验研究的是“RGB怎样混成颜色”；显示工程研究的是“怎样把数以千万计的RGB发光单元做得足够小、控制得足够准”。</p></div></aside>
    <footer><span>资料依据</span><a href="https://www.nature.com/articles/s41928-022-00828-5" target="_blank" rel="noreferrer">Nature Electronics · Micro light-emitting diodes</a><a href="https://news.samsung.com/global/samsung-launches-world-first-micro-rgb-setting-new-standard-for-premium-tv-technology" target="_blank" rel="noreferrer">Samsung Global Newsroom · Micro RGB</a></footer>
  </section>;
}
