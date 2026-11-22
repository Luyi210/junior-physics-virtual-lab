import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, Orbit, Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateProjectileMotion, calculateSpringForce } from "@physics-lab/physics/high-school";
import { ProjectileScene, SpringScene } from "./ProblemScenes";
import { defaultProblemParameters, formatQuantity, parsePastedProblem, problemCases, problemDefinitions } from "./problemVisualization";
import type { ParsedProblem, ProblemKind } from "./problemVisualization";
import "../styles/HighSchoolTheme.css";
import "../styles/HighSchoolTypography.css";
import "./HighSchoolProblemPage.css";

type Overlay = "question" | "model" | null;

export function HighSchoolProblemPage() {
  const [kind, setKind] = useState<ProblemKind>("projectile");
  const [parameters, setParameters] = useState(() => defaultProblemParameters("projectile"));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [pasteText, setPasteText] = useState("");
  const [parseResult, setParseResult] = useState<ParsedProblem | null>(null);
  const [activeImport, setActiveImport] = useState<Extract<ParsedProblem, { status: "matched" }> | null>(null);
  const [modifiedImported, setModifiedImported] = useState(false);
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const question = problemCases[kind];
  const importedQuestion = activeImport?.kind === kind ? activeImport.original : null;
  const definition = problemDefinitions[kind];
  const controls = definition.parameters.filter((parameter) => new Set<string>(question.parameters).has(parameter.key));
  const projectileParameters = {
    initialSpeed: parameters.initialSpeed ?? 8,
    angleDegrees: parameters.angleDegrees ?? 0,
    initialHeight: parameters.initialHeight ?? 2
  };
  const springParameters = {
    stiffness: parameters.stiffness ?? 20,
    naturalLength: parameters.naturalLength ?? .15,
    loadMassGrams: parameters.loadMassGrams ?? 100
  };
  const projectile = kind === "projectile" ? calculateProjectileMotion(projectileParameters, time) : null;
  const spring = kind === "spring" ? calculateSpringForce(springParameters) : null;
  const duration = projectile?.flightTime ?? 0;

  useEffect(() => {
    if (!playing || kind !== "projectile") return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(.05, (now - previous) / 1000);
      previous = now;
      setTime((current) => Math.min(duration, current + elapsed * .55));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, kind, playing]);

  useEffect(() => { if (playing && time >= duration) setPlaying(false); }, [duration, playing, time]);

  useEffect(() => {
    if (!overlay) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlay(null);
      if (event.key === "Tab") {
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button, a, input, select, textarea") ?? [])].filter((item) => !item.hasAttribute("disabled"));
        if (!controls.length) return;
        const first = controls[0]!;
        const last = controls[controls.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [overlay]);

  const selectCase = (next: ProblemKind) => {
    setKind(next);
    setParameters(defaultProblemParameters(next));
    setTime(0);
    setPlaying(false);
    setParseResult(null);
    setActiveImport(null);
    setModifiedImported(false);
  };
  const changeParameter = (key: string, value: number) => {
    setParameters((current) => ({ ...current, [key]: value }));
    setTime(0);
    setPlaying(false);
    if (importedQuestion) setModifiedImported(true);
  };
  const importProblem = (source: string) => {
    const result = parsePastedProblem(source);
    setParseResult(result);
    if (result.status === "matched") {
      setActiveImport(result);
      setModifiedImported(false);
      setKind(result.kind);
      setParameters(result.parameters);
      setTime(0);
      setPlaying(false);
    }
  };

  return <div className="hs-page hs-lab-theme hs-problem-page">
    <header className="hs-problem-header">
      <Link to="/high-school"><ArrowLeft size={17} />返回高中实验室</Link>
      <span><Orbit size={21} />格物 <i /> 题目可视化</span>
      <button type="button" onClick={() => setOverlay("model")}><CircleHelp size={17} />模型说明</button>
    </header>
    <main className="hs-problem-main">
      <div className="hs-problem-hero"><span className="hs-problem-kicker">PROBLEM → MODEL → EVIDENCE / 题目可视化</span><h1>把题目条件，<em>变成看得见的物理过程。</em></h1><p>粘贴一道题，识别后自动绘制；也可以从典型题开始，调整已知量。</p></div>

      <form className="hs-problem-import" onSubmit={(event) => { event.preventDefault(); importProblem(pasteText); }}><div><span className="hs-problem-kicker">PASTE A QUESTION / 粘贴题目</span><label htmlFor="hs-problem-paste">把题目文字粘贴到这里</label><p>目前可可靠生成抛体运动和弹簧静态平衡场景；需要题干包含完整数值与单位。</p></div><textarea id="hs-problem-paste" value={pasteText} maxLength={2000} rows={3} placeholder="例如：小球从高为2m的平台以8m/s的速度平抛，求落地时间和水平射程。" onChange={(event) => setPasteText(event.target.value)} onPaste={(event) => { const source = event.clipboardData.getData("text").slice(0, 2000); if (source) { event.preventDefault(); setPasteText(source); importProblem(source); } }} /><div className="hs-problem-import-footer"><small>粘贴后自动尝试识别；手动输入可点击生成。原题只在当前页面使用。</small><button type="submit">识别题目并生成场景<ArrowRight size={17} /></button></div>{parseResult && <p className={`hs-problem-import-status${parseResult.status === "unsupported" ? " is-error" : " is-success"}`} role="status">{parseResult.status === "matched" ? `已识别${parseResult.kind === "projectile" ? "抛体运动" : "弹簧静态平衡"}，已按题目数值生成下方场景。` : `${parseResult.message} 当前场景未更新。`}</p>}</form>

      <div className="hs-problem-example-heading"><span className="hs-problem-kicker">OR START HERE / 典型题示例</span><p>不粘贴题目，也可以从两个可验证的示例开始。</p></div>
      <div className="hs-problem-tabs" role="group" aria-label="选择题型">
        {(Object.keys(problemCases) as ProblemKind[]).map((entry) => <button key={entry} type="button" className={entry === kind ? "is-active" : ""} aria-pressed={entry === kind} onClick={() => selectCase(entry)}><small>{problemCases[entry].number} / {problemCases[entry].field}</small><strong>{problemCases[entry].title}</strong><ArrowRight size={17} /></button>)}
      </div>

      <div className="hs-problem-workspace">
        <section className="hs-problem-controls" aria-labelledby="hs-problem-controls-title"><div className="hs-problem-panel-heading"><span><SlidersHorizontal size={18} />已知条件</span><small>{importedQuestion ? "PASTED QUESTION" : "GIVENS"}</small></div><h2 id="hs-problem-controls-title">{importedQuestion ? "你粘贴的题目" : question.title}</h2><p>{importedQuestion ?? question.question}</p>{modifiedImported && <p className="hs-problem-edited-note">当前数值已由你调整，画面是原题的改编情境。</p>}<button className="hs-problem-text-button" type="button" onClick={() => setOverlay("question")}>打开完整题目<ArrowRight size={16} /></button>
          <div className="hs-problem-slider-list">{controls.map((parameter) => <label key={parameter.key} className="hs-problem-slider"><span><b>{parameter.label}</b><strong>{formatQuantity(parameters[parameter.key] ?? parameter.defaultValue)} <small>{parameter.unit}</small></strong></span><input type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={parameters[parameter.key] ?? parameter.defaultValue} onChange={(event) => changeParameter(parameter.key, Number(event.target.value))} aria-label={`${parameter.label}，单位${parameter.unit}`} /><small>范围 {formatQuantity(parameter.min)}–{formatQuantity(parameter.max)} {parameter.unit}</small></label>)}</div>
          <button className="hs-problem-reset" type="button" onClick={() => { if (activeImport?.kind === kind) { setParameters(activeImport.parameters); setTime(0); setPlaying(false); setModifiedImported(false); } else selectCase(kind); }}><RotateCcw size={16} />恢复这道题的初始条件</button>
        </section>

        <section className="hs-problem-observation" aria-labelledby="hs-problem-observation-title"><div className="hs-problem-panel-heading"><span><Orbit size={18} />场景与读数</span><small>LIVE MODEL</small></div><div className="hs-problem-scene"><span className="hs-problem-scene-index">MODEL / {question.number}</span>{projectile ? <ProjectileScene parameters={parameters} state={projectile} /> : spring ? <SpringScene parameters={parameters} state={spring} /> : null}</div>
          {projectile && <div className="hs-problem-timeline"><button type="button" aria-label={playing ? "暂停动画" : time >= duration ? "重播动画" : "播放动画"} onClick={() => { if (time >= duration) setTime(0); setPlaying((value) => !value); }} disabled={duration <= 0}>{playing ? <Pause size={19} /> : time >= duration ? <RotateCcw size={19} /> : <Play size={19} />}</button><label><span>观察时刻 <b>{formatQuantity(time)} / {formatQuantity(duration)} s</b></span><input type="range" min="0" max={Math.max(duration, .001)} step="0.01" value={time} onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)); }} aria-label="观察时刻，单位秒" /></label><small>慢速观察 · 模型时间</small></div>}
          <div className="hs-problem-readouts" aria-live="polite">{projectile ? <><div><small>飞行时间 T</small><strong>{formatQuantity(projectile.flightTime)} <em>s</em></strong></div><div><small>水平射程 R</small><strong>{formatQuantity(projectile.range)} <em>m</em></strong></div><div><small>当前水平位移 x</small><strong>{formatQuantity(projectile.x)} <em>m</em></strong></div><div><small>当前竖直速度 vᵧ</small><strong>{formatQuantity(projectile.vy)} <em>m/s</em></strong></div></> : spring ? <><div><small>悬挂物重力 mg</small><strong>{formatQuantity(spring.force)} <em>N</em></strong></div><div><small>弹簧伸长量 ΔL</small><strong>{formatQuantity(spring.extension * 100)} <em>cm</em></strong></div><div><small>弹簧总长 L</small><strong>{formatQuantity(spring.length * 100)} <em>cm</em></strong></div><div><small>模型劲度系数 k</small><strong>{formatQuantity(spring.stiffness)} <em>N/m</em></strong></div></> : null}</div>
        </section>
      </div>

      <section className="hs-problem-reasoning" aria-labelledby="hs-problem-reasoning-title"><div><span className="hs-problem-kicker">REASONING / 推演路线</span><h2 id="hs-problem-reasoning-title">图像之后，<em>把理由说清楚。</em></h2></div><ol>{projectile ? <><li><b>01</b><strong>拆解运动</strong><p>水平方向匀速：vₓ = v₀cosθ = {formatQuantity(projectile.vx)} m/s；竖直方向只受重力。</p></li><li><b>02</b><strong>找落地时刻</strong><p>令 y = h₀ + v₀sinθ·t − ½gt² = 0，取非负根，得 T = {formatQuantity(projectile.flightTime)} s。</p></li><li><b>03</b><strong>求水平射程</strong><p>R = vₓT = {formatQuantity(projectile.range)} m。改变高度或角度，再观察它怎样变化。</p></li></> : spring ? <><li><b>01</b><strong>确认静态平衡</strong><p>物体已静止，弹簧向上的弹力大小与悬挂总重力相等。</p></li><li><b>02</b><strong>先算弹力</strong><p>F = mg = {formatQuantity(spring.loadMassKg, 3)} × 9.8 = {formatQuantity(spring.force)} N。</p></li><li><b>03</b><strong>再算伸长</strong><p>在线性范围内，ΔL = F/k = {formatQuantity(spring.extension, 3)} m = {formatQuantity(spring.extension * 100)} cm。</p></li></> : null}</ol><div className="hs-problem-bottom"><button type="button" onClick={() => setOverlay("model")}><BookOpen size={17} />查看适用条件</button><Link to={`/high-school/experiments/${question.experimentId}`}>进入对应实验，继续验证<ArrowRight size={17} /></Link></div></section>
    </main>
    {overlay && createPortal(<div className="hs-problem-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOverlay(null); }}><section ref={dialogRef} className="hs-problem-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><button ref={closeButton} className="hs-problem-dialog-close" type="button" aria-label="关闭弹窗" onClick={() => setOverlay(null)}><X size={20} /></button><span className="hs-problem-kicker">{overlay === "question" ? "READ THE PROBLEM / 读题" : "MODEL BOUNDARY / 模型边界"}</span><h2 id={titleId}>{overlay === "question" ? importedQuestion ? "你粘贴的题目" : question.title : "这张图能说明什么？"}</h2>{overlay === "question" ? <><p>{importedQuestion ?? question.question}</p><dl>{controls.map((parameter) => <div key={parameter.key}><dt>{parameter.label}</dt><dd>{formatQuantity(parameters[parameter.key] ?? parameter.defaultValue)} {parameter.unit}</dd></div>)}</dl><p className="hs-problem-dialog-note">{modifiedImported ? "已调整原题数值。" : ""}任务：{kind === "projectile" ? "求落地时间和水平射程，并解释水平与竖直分运动。" : "求弹力与伸长量，并解释静态平衡条件。"}</p></> : <><p>这里展示的是按给定条件计算的理想模型。滑杆改变的是题目已知量，画面与数字不是实体实验测得的证据。</p><ul>{definition.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></>}<button className="hs-problem-dialog-done" type="button" onClick={() => setOverlay(null)}>{overlay === "question" ? "开始看图解题" : "了解，继续探索"}<ArrowRight size={17} /></button></section></div>, document.body)}
  </div>;
}
