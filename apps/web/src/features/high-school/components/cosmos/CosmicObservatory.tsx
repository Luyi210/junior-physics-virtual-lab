import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  COSMIC_HEIGHT, COSMIC_MODES, COSMIC_WIDTH, DEFAULT_COSMIC_VIEW,
  clampCosmicView, cosmicBackingSize, cosmicPointerView, cosmicViewDegrees,
  type CosmicMode, type CosmicView,
} from './cosmicGeometry';
import { createCosmicLoop } from './cosmicLoop';
import { paintCosmicObservatory } from './cosmicPainter';
import { CosmicStaticArt } from './CosmicStaticArt';
import './CosmicObservatory.css';

export { CosmicStaticArt } from './CosmicStaticArt';
type Drag = { id: number; x: number; y: number; view: CosmicView; target: HTMLDivElement };

export function CosmicObservatory() {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const resizeCanvas = useRef<(() => void) | null>(null);
  const loop = useRef<ReturnType<typeof createCosmicLoop> | null>(null);
  const view = useRef<CosmicView>({ ...DEFAULT_COSMIC_VIEW });
  const modeRef = useRef<CosmicMode>('orbit');
  const alive = useRef(false);
  const intent = useRef<boolean | null>(null);
  const drag = useRef<Drag | null>(null);
  const [mode, setMode] = useState<CosmicMode>('orbit');
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manualView, setManualView] = useState<CosmicView>({ ...DEFAULT_COSMIC_VIEW });
  const info = COSMIC_MODES[mode];
  const angles = cosmicViewDegrees(manualView);

  function releaseDrag() {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    try {
      if (current.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id);
    } catch { /* Detached elements may already have released capture. */ }
  }

  useEffect(() => {
    alive.current = true;
    const target = host.current, element = canvas.current;
    let context: CanvasRenderingContext2D | null = null;
    try { context = element?.getContext('2d', { alpha: false }) ?? null; }
    catch { /* Deterministic SVG remains visible without Canvas2D. */ }
    if (!target || !element || !context) {
      setAvailable(false); setReady(false);
      return () => { alive.current = false; releaseDrag(); };
    }
    setAvailable(true);
    let active = true, painted = false;
    let inView = typeof IntersectionObserver === 'undefined';
    const ctx = context;
    const controller = createCosmicLoop({
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: handle => window.cancelAnimationFrame(handle),
      draw: time => {
        paintCosmicObservatory(ctx, modeRef.current, view.current, time);
        if (active && !painted) { painted = true; setReady(true); }
      },
      onError: () => {
        if (active) { setReady(false); setAvailable(false); setPlaying(false); }
      },
    });
    loop.current = controller;

    const resize = () => {
      if (!active) return;
      const rect = target.getBoundingClientRect();
      const { width: w, height: h } = cosmicBackingSize(rect.width, window.devicePixelRatio);
      if (element.width !== w || element.height !== h) {
        element.width = w; element.height = h;
        ctx.setTransform(w / COSMIC_WIDTH, 0, 0, h / COSMIC_HEIGHT, 0, 0);
      }
      controller.invalidate();
    };
    const visibility = () => { if (active) controller.setVisible(inView && !document.hidden); };
    resizeCanvas.current = resize;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReduced(motion?.matches ?? false);
    if (intent.current === null) intent.current = !(motion?.matches ?? false);
    const onMotion = (event: MediaQueryListEvent) => {
      if (!active) return;
      setReduced(event.matches);
      if (event.matches) { intent.current = false; controller.setRunning(false); setPlaying(false); }
    };
    motion?.addEventListener?.('change', onMotion);
    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (!active) return;
      const entry = entries.find(item => item.target === target);
      if (entry) { inView = entry.isIntersecting; visibility(); }
    }, { threshold: .01 });
    intersection?.observe(target);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(target);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize);
    resize(); controller.setRunning(intent.current); setPlaying(intent.current); visibility();

    return () => {
      active = false; alive.current = false; releaseDrag(); controller.dispose();
      if (loop.current === controller) loop.current = null;
      if (resizeCanvas.current === resize) resizeCanvas.current = null;
      intersection?.disconnect(); observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize);
      motion?.removeEventListener?.('change', onMotion);
    };
  }, []);

  // The inline layout changes even in browsers without ResizeObserver.
  useEffect(() => { resizeCanvas.current?.(); }, [expanded]);

  const changeView = (next: CosmicView) => {
    if (!alive.current || !available) return;
    view.current = clampCosmicView(next);
    setManualView(view.current); // Only user input updates React, never the animation tick.
    loop.current?.invalidate();
  };
  const choose = (next: CosmicMode) => {
    if (!alive.current) return;
    releaseDrag(); modeRef.current = next; setMode(next); loop.current?.invalidate();
  };
  const toggle = () => {
    if (!alive.current || !loop.current || loop.current.snapshot().disposed) return;
    const next = !loop.current.snapshot().running;
    intent.current = next; setPlaying(next); loop.current.setRunning(next);
  };
  const reset = () => { releaseDrag(); changeView({ ...DEFAULT_COSMIC_VIEW }); };
  const toggleExpanded = () => {
    if (!alive.current) return;
    releaseDrag(); setExpanded(value => !value);
  };
  const escapeExpanded = (event: KeyboardEvent<HTMLElement>) => {
    if (!alive.current || event.key !== 'Escape' || !expanded) return;
    event.preventDefault(); releaseDrag(); setExpanded(false);
    expandButton.current?.focus();
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!alive.current || !available || event.button !== 0 || drag.current) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view.current }, target: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { releaseDrag(); }
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!alive.current || !start || start.id !== event.pointerId) return;
    changeView(cosmicPointerView(start.view, event.clientX - start.x, event.clientY - start.y, event.currentTarget.getBoundingClientRect().width));
  };
  const pointerEnd = (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.id === event.pointerId) releaseDrag(); };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!alive.current) return;
    const delta: Record<string, CosmicView> = {
      ArrowLeft: { yaw: -.1, pitch: 0 }, ArrowRight: { yaw: .1, pitch: 0 },
      ArrowUp: { yaw: 0, pitch: -.08 }, ArrowDown: { yaw: 0, pitch: .08 },
    };
    if (event.key === ' ') { event.preventDefault(); toggle(); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
    else if (delta[event.key]) {
      event.preventDefault();
      changeView({ yaw: view.current.yaw + delta[event.key].yaw, pitch: view.current.pitch + delta[event.key].pitch });
    }
  };

  return <section className={`cosmic-observatory${expanded ? ' is-expanded' : ''}`} data-expanded={expanded ? 'true' : 'false'} aria-label="物理意象观测舱" onKeyDown={escapeExpanded}>
    <div className="cosmic-observatory__mast">
      <span><i/>PHYSICS OBSERVATORY<small>交互观测舱</small></span>
      <button ref={expandButton} type="button" onClick={toggleExpanded} aria-expanded={expanded} aria-controls={`${id}-view-controls`} className="cosmic-observatory__expand">{expanded ? '↙' : '↗'}<span>{expanded ? '收起观测' : '展开观测'}</span></button>
    </div>
    <div ref={host} className="cosmic-observatory__scene" role="group" tabIndex={0} aria-label={`${info.label}视角，方向键调整，空格播放或暂停，Home 重置`} aria-describedby={`${id}-description ${id}-controls`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onKeyDown={keyDown}>
      {!ready && <CosmicStaticArt mode={mode} id={id}/>}
      <canvas ref={canvas} className={ready ? 'cosmic-canvas is-ready' : 'cosmic-canvas'} width="650" height="420" aria-hidden="true"/>
      <span className="cosmic-observatory__coordinate">{info.english}<small>{info.concept} / {info.feature}</small></span>
      <span className="cosmic-observatory__view-readout" aria-label="手动视角"><span>VIEW / 手动视角</span><b>{angles.yaw.toFixed(1)}° <i>/</i> {angles.pitch.toFixed(1)}°</b></span>
      <span className="cosmic-observatory__caption">物理意象 · 非定量实验</span>
    </div>
    <div className="cosmic-observatory__modes" aria-label="选择物理意象">
      {(Object.keys(COSMIC_MODES) as CosmicMode[]).map((key, index) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => choose(key)}><span>0{index + 1}</span>{COSMIC_MODES[key].label}</button>)}
    </div>
    <div id={`${id}-view-controls`} className="cosmic-observatory__view-controls" hidden={!expanded}>
      <p>调整你的观察方向 <span>视角角度，不是实验读数 · Esc 收起</span></p>
      <div>{(['yaw', 'pitch'] as const).map(axis => <label key={axis}>
        <span>{axis === 'yaw' ? '水平旋转' : '俯仰视角'}<output>{angles[axis].toFixed(1)}°</output></span>
        <input type="range" aria-label={axis === 'yaw' ? '水平视角' : '俯仰视角'} min={axis === 'yaw' ? -71.6 : -35.5} max={axis === 'yaw' ? 71.6 : 35.5} step="0.1" value={Number(angles[axis].toFixed(1))} disabled={!available} onChange={event => { releaseDrag(); changeView({ ...view.current, [axis]: Number(event.currentTarget.value) * Math.PI / 180 }); }}/>
      </label>)}</div>
    </div>
    <div className="cosmic-observatory__footer">
      <p id={`${id}-description`}>{info.detail}</p>
      <div className="cosmic-observatory__tools"><span id={`${id}-controls`}>{!available ? '静态意象' : reduced && !playing ? '减少动态 · 可手动播放' : '拖动旋转 · 方向键调整'}</span><div>
        <button type="button" onClick={reset} disabled={!available} aria-label="重置意象视角" title="重置视角（Home）">↺<span>重置</span></button>
        <button type="button" onClick={toggle} disabled={!available} aria-label={playing ? '暂停意象动画' : '播放意象动画'} title="播放或暂停（空格）">{playing ? 'Ⅱ' : '▷'}<span>{playing ? '暂停' : '播放'}</span></button>
      </div></div>
    </div>
  </section>;
}
