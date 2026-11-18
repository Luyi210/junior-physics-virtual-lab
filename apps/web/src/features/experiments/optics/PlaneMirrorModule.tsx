import { lazy, useState, Suspense } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { Eye, Info } from "lucide-react";
import { PlaneMirrorDiagram2D } from "./components/OpticsLawDiagram2D";
import { OpticsSceneErrorBoundary } from "./components/OpticsSceneErrorBoundary";
import { type LawViewMode, LawDimensionSwitch } from "./shared/LawControls";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

const PlaneMirrorScene3D = lazy(async () => {
  const module = await import("./components/OpticsLawScene3D");
  return { default: module.PlaneMirrorScene3D };
});

type MirrorLifeMode = "ar" | "infinity";

function PlaneMirrorLifeTechnology() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<MirrorLifeMode>("ar");
  const [reflectivity, setReflectivity] = useState(55);
  const [screenDistance, setScreenDistance] = useState(55);
  const [mirrorGap, setMirrorGap] = useState(42);
  const [reflectionRounds, setReflectionRounds] = useState(7);
  const transmission = 100 - reflectivity;
  const retainedLight = Math.pow(reflectivity / 100, reflectionRounds) * 100;
  const frameStep = 11 + mirrorGap * .13;
  const changeMode = (next: MirrorLifeMode) => {
    setMode(next);
    recordHarness("view.changed", { experiment: "plane-mirror-life", view: next });
  };
  const changeValue = (control: string, value: number, setter: (next: number) => void) => {
    setter(value);
    recordHarness("configuration.changed", { experiment: "plane-mirror-life", mode, control, value });
  };

  return <section className={`mirror-life-technology mirror-life-${mode}`} aria-labelledby="mirror-life-title">
    <header>
      <div><span>PHYSICS INTO LIFE &amp; TECHNOLOGY / 物理走进生活与科技</span><h2 id="mirror-life-title">一块“能看穿”的镜子，<br />怎样连接 AR 与“无底洞”？</h2><p>它们都使用半透半反表面，却把光送上了两条不同的道路：AR 把显示画面叠加到真实世界；“无底洞”让光在两面镜子之间反复往返，形成越来越深、越来越暗的重复虚像。</p></div>
      <div className="mirror-life-badge"><Eye size={27} /><strong>真实世界 + 虚像</strong><small>看见的空间，未必是光真正到达的位置</small></div>
    </header>

    <div className="mirror-life-route" aria-label="选择生活科技案例">
      <button className={mode === "ar" ? "active" : ""} onClick={() => changeMode("ar")}><b>01</b><span><strong>简单 AR 显示</strong><small>半透半反 · 虚实叠加</small></span></button>
      <button className={mode === "infinity" ? "active" : ""} onClick={() => changeMode("infinity")}><b>02</b><span><strong>无限镜“无底洞”</strong><small>两镜平行 · 多次反射</small></span></button>
    </div>

    <div className="mirror-life-workbench">
      <div className="mirror-life-visual">
        {mode === "ar" ? <svg viewBox="0 0 900 470" role="img" aria-label="简单AR半透半反动态光路">
          <defs>
            <linearGradient id="arNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#092b3a" /><stop offset="1" stopColor="#07141c" /></linearGradient>
            <linearGradient id="arGlass" x1="0" x2="1"><stop offset="0" stopColor="#7ce2e8" stopOpacity=".08" /><stop offset=".52" stopColor="#d8ffff" stopOpacity=".42" /><stop offset="1" stopColor="#5ac4d2" stopOpacity=".08" /></linearGradient>
            <filter id="arGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="900" height="470" fill="url(#arNight)" />
          <g className="ar-real-world" opacity={Math.max(.28, transmission / 100)}>
            <path d="M0 318 L390 218 L900 315 L900 470 L0 470 Z" fill="#16333d" />
            <path d="M360 470 L435 220 L515 220 L620 470 Z" fill="#263d43" />
            <path d="M435 470 L468 222" stroke="#e6c975" strokeWidth="4" strokeDasharray="24 20" />
            <path d="M545 470 L493 222" stroke="#e6c975" strokeWidth="4" strokeDasharray="24 20" />
            <path d="M30 318 v-150 h115 v122 M170 280 v-190 h138 v160 M690 268 v-145 h160 v178" fill="none" stroke="#315764" strokeWidth="8" />
            <g fill="#e9bd61">{[[62,204],[110,204],[202,130],[250,130],[724,165],[790,165]].map(([x,y], index) => <rect x={x} y={y} width="18" height="28" opacity={.55} key={index} />)}</g>
            <text x="35" y="443">真实街景 · 透过半透镜进入眼睛</text>
          </g>
          <g className="ar-combiner">
            <polygon points="425,70 632,348 588,372 381,94" fill="url(#arGlass)" stroke="#90e8e8" strokeWidth="3" />
            <line x1="413" y1="81" x2="620" y2="359" stroke="#e8ffff" strokeWidth="1" strokeDasharray="8 7" />
            <text x="555" y="95">半透半反镜</text>
          </g>
          <g className="ar-display-source" transform={`translate(${210 - screenDistance * .35} 374)`}>
            <rect x="-60" y="-37" width="120" height="74" rx="5" />
            <path d="M-40 -14 h80 M-40 0 h52 M-40 14 h72" />
            <text x="-47" y="60">微型显示屏</text>
          </g>
          <g className="ar-light-path" filter="url(#arGlow)">
            <path d={`M${210 - screenDistance * .35} 340 L505 207 L748 160`} />
            <path className="virtual" d={`M505 207 L${350 - screenDistance * .32} ${91 - screenDistance * .12}`} />
          </g>
          <g className="ar-floating-card" transform={`translate(${335 - screenDistance * .24} ${112 - screenDistance * .08})`} opacity={.35 + reflectivity / 145}>
            <rect x="-93" y="-48" width="186" height="96" rx="5" />
            <path d="M-64 10 h45 v-24 h45 l-12 -13 m12 13 l-12 13" />
            <text x="-65" y="31">前方 200 m 右转</text>
            <text className="ar-virtual-label" x="-74" y="-61">导航虚像 · 镜后</text>
          </g>
          <g className="ar-eye" transform="translate(762 160)"><path d="M-29 0 Q0 -23 29 0 Q0 23 -29 0 Z" /><circle r="8" /><text x="-17" y="42">眼睛</text></g>
          <g className="ar-legend" transform="translate(608 407)"><line x1="0" x2="45" /><text x="55" y="4">真实光路</text><line className="virtual" x1="145" x2="190" /><text x="200" y="4">反向延长线</text></g>
        </svg> : <svg viewBox="0 0 900 470" role="img" aria-label="无限镜无底洞多次反射动态示意">
          <defs>
            <radialGradient id="infinityVoid"><stop offset="0" stopColor="#061015" /><stop offset=".72" stopColor="#071820" /><stop offset="1" stopColor="#102a34" /></radialGradient>
            <filter id="infinityGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="900" height="470" fill="#07161d" />
          <rect x="102" y="34" width="696" height="402" rx="12" fill="url(#infinityVoid)" stroke="#a5d5d7" strokeWidth="8" />
          <g className="infinity-frames" filter="url(#infinityGlow)">{Array.from({ length: reflectionRounds }, (_, index) => {
            const inset = 24 + index * frameStep;
            const opacity = Math.max(.08, Math.pow(reflectivity / 100, index) * .94);
            const width = Math.max(80, 696 - inset * 2);
            const height = Math.max(52, 402 - inset * 1.12);
            return <g opacity={opacity} key={index}>
              <rect x={102 + inset} y={34 + inset * .56} width={width} height={height} rx="8" />
              <circle cx={102 + inset} cy={34 + inset * .56} r="5" /><circle cx={798 - inset} cy={34 + inset * .56} r="5" />
              <circle cx={102 + inset} cy={436 - inset * .56} r="5" /><circle cx={798 - inset} cy={436 - inset * .56} r="5" />
            </g>;
          })}</g>
          <g className="infinity-front-glass"><path d="M102 34 h696 v402 H102 Z" /><text x="126" y="68">前层：半透半反镜</text></g>
          <g className="infinity-back-label"><path d="M752 112 l33 -22" /><text x="592" y="91">后层：普通全反射镜</text></g>
          <g className="infinity-depth-readout"><text x="450" y="217" textAnchor="middle">{reflectionRounds} 层重复虚像</text><text x="450" y="242" textAnchor="middle">每一轮往返光程约增加 2d</text></g>
          <g className="infinity-side-path" transform="translate(28 366)"><path d="M0 0 h45 l36 -45 l38 45 l38 -45 l38 45" /><text x="0" y="28">光在两镜间反复往返，并逐次透出</text></g>
        </svg>}
        <div className="mirror-life-live-label"><b>{mode === "ar" ? "AR COMBINER" : "INFINITY MIRROR"}</b><span>{mode === "ar" ? `约 ${transmission}% 真实环境光透过 · ${reflectivity}% 显示光参与反射` : `第 ${reflectionRounds} 轮示意剩余光强约 ${retainedLight.toFixed(1)}%`}</span></div>
      </div>

      <aside className="mirror-life-controller">
        <span>LIVE OPTICS CONTROL / 动态光学控制</span>
        <h3>{mode === "ar" ? "把导航信息“放”到真实道路上" : "把有限镜距“延伸”成无限深处"}</h3>
        <p>{mode === "ar" ? "显示屏发出的光被半透镜反射进眼睛，人眼沿直线反向追踪，在镜后看见导航虚像；真实街景的光同时穿过镜片。" : "后镜把灯光反射回来，前面的半透镜再把一部分送回去、另一部分送进眼睛。每次循环都会产生一层更深、更暗的虚像。"}</p>
        <label><b>半透镜反射率</b><output>{reflectivity}%</output><input type="range" min="20" max="85" step="5" value={reflectivity} onChange={(event) => changeValue("半透镜反射率", Number(event.target.value), setReflectivity)} /></label>
        {mode === "ar" ? <label><b>显示屏到半透镜距离</b><output>{screenDistance} cm</output><input type="range" min="20" max="100" step="5" value={screenDistance} onChange={(event) => changeValue("显示屏距离", Number(event.target.value), setScreenDistance)} /></label> : <>
          <label><b>两面镜之间距离 d</b><output>{mirrorGap} cm</output><input type="range" min="12" max="72" step="3" value={mirrorGap} onChange={(event) => changeValue("两镜距离", Number(event.target.value), setMirrorGap)} /></label>
          <label><b>追踪反射轮次</b><output>{reflectionRounds} 次</output><input type="range" min="3" max="10" step="1" value={reflectionRounds} onChange={(event) => changeValue("反射轮次", Number(event.target.value), setReflectionRounds)} /></label>
        </>}
        <div className="mirror-life-result"><small>当前观察</small><strong>{mode === "ar" ? `虚像位于镜后约 ${screenDistance} cm（对称简化模型）` : `往返 ${reflectionRounds} 轮，累计增加约 ${2 * mirrorGap * reflectionRounds} cm 光程`}</strong><p>{mode === "ar" ? "提高反射率会让显示像更亮，但真实环境可能相对变暗。" : "真实装置还会受到镜面吸收、散射和LED位置影响，所以深处会逐渐消失。"}</p></div>
      </aside>
    </div>

    <div className="mirror-life-comparison">
      <article><b>共同元件</b><strong>都需要半透半反表面</strong><p>它既让一部分光穿过，又让另一部分光发生反射，因此观察者能够同时接收到两条不同来源的光。</p></article>
      <article><b>AR 的目标</b><strong>把一幅虚像叠加到现实中</strong><p>简单装置只需要一次主要反射；现代 AR 眼镜还可能使用光波导、全反射和衍射结构，让设备更轻薄。</p></article>
      <article><b>无底洞的目标</b><strong>用重复虚像制造空间纵深</strong><p>它依靠两面近似平行的镜子多次反射。镜距改变纵深间隔，反射率影响能够看清多少层。</p></article>
    </div>
    <aside className="mirror-life-note"><Info size={20} /><div><strong>把它与上面的平面镜实验连接起来</strong><p>每一层仍然只是虚像，光并没有真的进入“镜子深处”。实线表示实际传播的光，虚线只表示人眼判断虚像位置时使用的反向延长线。</p></div></aside>
  </section>;
}

export function PlaneMirrorModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [objectDistance, setObjectDistance] = useState(175);
  const [observerPosition, setObserverPosition] = useState(0);
  const [screenPlaced, setScreenPlaced] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LawViewMode>("2d");
  const interact = () => setInteracted(true);
  const toggleScreen = () => {
    const next = !screenPlaced;
    setScreenPlaced(next);
    interact();
    recordHarness("configuration.changed", { experiment: "plane-mirror", control: "像位置光屏", value: next ? "placed" : "removed" });
  };
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "plane-mirror", action, objectDistance, observerPosition, screenPlaced });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "plane-mirror", view, objectDistance, observerPosition, screenPlaced });
  const changeViewMode = (next: LawViewMode) => { setViewMode(next); recordHarness("view.changed", { experiment: "plane-mirror", view: next, objectDistance, observerPosition, screenPlaced }); };

  return <div className="open-experience">
    <ModuleIntro eyebrow="活动 2.4 / 平面镜成像" title="走进镜面两侧，追踪虚像在空间中怎样形成" text="二维视图用于精确追踪实际光路与反向延长线；三维视图可以从侧面、正面或上方观察空间关系。移动物体和观察者，再放置光屏验证这个像能否被承接。" action={<button onClick={toggleScreen}>{screenPlaced ? "移开验证光屏" : "在像的位置放光屏"}</button>} />
    <LawDimensionSwitch mode={viewMode} apparatus="plane-mirror" onChange={changeViewMode} />
    <div className={`ray-law-lab plane-mirror-lab view-${viewMode} ${viewMode === "3d" ? "optics-3d-lab" : "optics-2d-lab"}`}>
      {viewMode === "2d"
        ? <PlaneMirrorDiagram2D objectDistance={objectDistance} observerPosition={observerPosition} screenPlaced={screenPlaced} interacted={interacted} />
        : <OpticsSceneErrorBoundary onUse2D={() => changeViewMode("2d")} label="三维平面镜实验台"><Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维镜面实验台</strong><span>准备镜面、观察者与空间光路…</span></div>}><PlaneMirrorScene3D objectDistance={objectDistance} observerPosition={observerPosition} screenPlaced={screenPlaced} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense></OpticsSceneErrorBoundary>}
      {!interacted && <OpticsInteractionCue text="移动物体、观察者，或拖动三维实验台" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? `${viewMode.toUpperCase()} VIRTUAL IMAGE PATH` : "MIRROR LAB STANDBY"}</span><strong>{interacted ? screenPlaced ? "验证光屏上没有清晰实像" : "像与物关于镜面对称" : "等待第一次操作"}</strong><small>{interacted ? `物距 ${objectDistance} 格 = 像距 ${objectDistance} 格；改变视图不会改变成像规律` : "黄色、绿色为真实光路，蓝色虚线为反向延长线"}</small></div>
    </div>
    <div className="open-control-deck plane-mirror-controls"><RangeControl label="物体到镜面距离" value={objectDistance} min={90} max={260} step={5} unit="格" onChange={setObjectDistance} onInteract={interact} /><RangeControl label="观察者左右位置" value={observerPosition} min={-100} max={100} step={5} unit="%" onChange={setObserverPosition} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>对应基础规律 · 光的反射</span><strong>{interacted ? "虚像由反射光的反向延长线相交形成" : "先移动物体或观察者"}</strong><p>{interacted ? screenPlaced ? "光屏没有接到真实会聚的光，因此不能呈现清晰的像。" : "左右移动观察者会改变反射点和可见光路，但像的位置、大小不变。" : "操作后会同步显示光路、虚像和实验结论。"}</p></div></div>
    <PlaneMirrorLifeTechnology />
  </div>;
}
