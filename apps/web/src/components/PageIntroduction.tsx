import { ArrowLeft, ArrowRight, BookOpenText, Check, CircleHelp, Compass, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export interface IntroductionStep {
  eyebrow?: string;
  title: string;
  description: string;
  points?: string[];
  icon?: LucideIcon;
}

interface PageIntroductionProps {
  pageKey: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  icon: LucideIcon;
  accent?: string;
  enterLabel?: string;
  variant?: "field" | "optics" | "home" | "teacher" | "student";
  steps?: IntroductionStep[];
  persistence?: "session" | "local";
  triggerLabel?: string;
}

const STORAGE_PREFIX = "physics-page-guide-v3:";

export function PageIntroduction({
  pageKey, eyebrow, title, description, points, icon: Icon, accent = "#29d8bb", enterLabel = "进入页面",
  variant = "field", steps, persistence = "session", triggerLabel = "使用引导"
}: PageIntroductionProps) {
  const titleId = useId();
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;
  const storage = () => persistence === "local" ? window.localStorage : window.sessionStorage;
  const guideSteps: IntroductionStep[] = steps?.length ? steps : [{ eyebrow, title, description, points, icon: Icon }];
  const [open, setOpen] = useState(() => typeof window !== "undefined" && storage().getItem(storageKey) !== "seen");
  const [stepIndex, setStepIndex] = useState(0);
  const step = guideSteps[stepIndex];
  const StepIcon = step.icon ?? Icon;
  const finished = stepIndex === guideSteps.length - 1;

  const close = () => {
    storage().setItem(storageKey, "seen");
    setOpen(false);
  };

  const reopen = () => { setStepIndex(0); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" && stepIndex < guideSteps.length - 1) setStepIndex((value) => value + 1);
      if (event.key === "ArrowLeft" && stepIndex > 0) setStepIndex((value) => value - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [guideSteps.length, open, stepIndex]);

  const modal = open ? createPortal(
    <div className={`page-intro-backdrop guide-variant-${variant} ${variant === "home" ? "home-intro-backdrop" : ""}`} role="presentation">
      <section className={`page-intro-dialog page-guide-dialog ${variant === "home" ? "home-intro-dialog" : ""}`} style={{ "--intro-accent": accent } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <GuideVisual variant={variant} icon={StepIcon} step={stepIndex} total={guideSteps.length} />
        <div className="page-intro-content page-guide-content">
          <button className="page-intro-close" type="button" onClick={close} aria-label="稍后查看引导"><X size={18} /></button>
          <div className="page-guide-progress"><span>{String(stepIndex + 1).padStart(2, "0")} / {String(guideSteps.length).padStart(2, "0")}</span><i><b style={{ width: `${((stepIndex + 1) / guideSteps.length) * 100}%` }} /></i></div>
          <span className="page-intro-eyebrow">{step.eyebrow ?? eyebrow}</span>
          <h2 id={titleId}>{step.title}</h2>
          <p>{step.description}</p>
          {!!step.points?.length && <ul>{step.points.slice(0, 4).map((point, index) => <li key={point}><b>{String(index + 1).padStart(2, "0")}</b><span>{point}</span></li>)}</ul>}
          <div className="page-guide-actions">
            <button className="page-guide-later" type="button" onClick={close}>{guideSteps.length > 1 ? "稍后查看" : "跳过介绍"}</button>
            {stepIndex > 0 && <button className="page-guide-previous" type="button" onClick={() => setStepIndex((value) => value - 1)}><ArrowLeft size={15} />上一步</button>}
            <button className="page-intro-enter" type="button" onClick={() => finished ? close() : setStepIndex((value) => value + 1)}>{finished ? <Check size={16} /> : null}{finished ? enterLabel : "下一步"}{!finished && <ArrowRight size={17} />}</button>
          </div>
          <small className="page-intro-hint">关闭后可通过右下角“{triggerLabel}”随时重新查看</small>
        </div>
      </section>
    </div>, document.body
  ) : null;

  return <><button className="page-intro-trigger" type="button" onClick={reopen} aria-label={`打开${triggerLabel}`}><CircleHelp size={17} /><span>{triggerLabel}</span></button>{modal}</>;
}

function GuideVisual({ variant, icon: Icon, step, total }: { variant: NonNullable<PageIntroductionProps["variant"]>; icon: LucideIcon; step: number; total: number }) {
  if (variant === "optics") return <OpticsIntroVisual step={step} total={total} />;
  if (variant === "home") return <HomeIntroVisual icon={Icon} step={step} total={total} />;
  return <div className={`page-intro-visual page-guide-visual visual-${variant}`} aria-hidden="true">
    <header><span>{variant === "teacher" ? "TEACHING WORKFLOW" : variant === "student" ? "DISCOVERY ROUTE" : "PHYSICS OPEN LAB"}</span><b>GUIDE / {String(step + 1).padStart(2, "0")}</b></header>
    <span className="page-intro-orbit orbit-a" /><span className="page-intro-orbit orbit-b" /><i />
    <Icon className="page-intro-icon" size={42} strokeWidth={1.6} />
    <div className="page-guide-coordinate"><Compass size={14} /><span>{step + 1} / {total}</span></div>
    <small>{variant === "teacher" ? "ORGANIZE · PUBLISH · OBSERVE" : "QUESTION · OPERATE · EVIDENCE"}</small>
  </div>;
}

function HomeIntroVisual({ icon: Icon, step, total }: { icon: LucideIcon; step: number; total: number }) {
  return <div className="page-intro-visual home-intro-visual" aria-hidden="true"><header><span>PHYSICS OBSERVATORY</span><strong>格物实验室</strong><small>GUIDE {step + 1} / {total}</small></header><div className="home-intro-radar"><i className="radar-ring ring-one" /><i className="radar-ring ring-two" /><i className="radar-sweep" /><span className="radar-axis axis-x" /><span className="radar-axis axis-y" /><b className="radar-node node-a" /><b className="radar-node node-b" /><b className="radar-node node-c" /><Icon size={43} strokeWidth={1.45} /></div><div className="home-intro-formulas"><span>F = ma</span><span>λ = v / f</span><span>ρ = m / V</span><span>P = UI</span></div><footer><i /><span>OBSERVE · OPERATE · EXPLAIN</span></footer></div>;
}

function OpticsIntroVisual({ step, total }: { step: number; total: number }) {
  return <div className="page-intro-visual optics-intro-visual" aria-hidden="true"><div className="optics-art-title"><span>OPTICAL PATH / {step + 1} OF {total}</span><strong>看见光怎样前进</strong></div><svg className="optics-intro-diagram" viewBox="0 0 270 390" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="intro-spectrum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff6a63" /><stop offset=".28" stopColor="#ffd85e" /><stop offset=".52" stopColor="#66e2a3" /><stop offset=".76" stopColor="#66c9ff" /><stop offset="1" stopColor="#9e7cff" /></linearGradient><marker id="intro-ray-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 9 5 1 9Z" fill="context-stroke" /></marker></defs><g className="optics-axis"><line x1="18" y1="210" x2="252" y2="210" /><text x="20" y="224">主光轴</text></g><g className="optics-object"><line x1="55" y1="210" x2="55" y2="128" /><path d="m48 140 7-13 7 13" /><text x="40" y="238">物体</text></g><path className="optics-lens-glow" d="M136 98 Q105 210 136 322 Q167 210 136 98Z" /><path className="optics-lens" d="M136 98 Q105 210 136 322 Q167 210 136 98Z" fill="rgba(120,220,255,.08)" /><line className="optics-lens-center" x1="136" y1="98" x2="136" y2="322" /><g className="optics-rays"><path className="ray-cyan" d="M55 128 L136 128 L223 210" markerEnd="url(#intro-ray-arrow)" /><path className="ray-amber" d="M55 128 L136 210 L223 280" markerEnd="url(#intro-ray-arrow)" /><path className="ray-coral" d="M55 128 L136 174 L223 245" markerEnd="url(#intro-ray-arrow)" /></g><g className="optics-spectrum"><path className="spectrum-band" d="M175 245 L240 280" /></g><g className="optics-photons"><circle className="photon-cyan" cx="103" cy="128" r="3" /><circle className="photon-amber" cx="170" cy="238" r="3" /><circle className="photon-coral" cx="205" cy="230" r="3" /></g><g className="optics-image"><line x1="223" y1="210" x2="223" y2="280" /><path d="m216 267 7 13 7-13" /><text x="209" y="302">成像 / 观察</text></g></svg><BookOpenText className="optics-intro-book" size={18} /><small className="optics-signature">OBSERVE · OPERATE · EXPLAIN</small></div>;
}
