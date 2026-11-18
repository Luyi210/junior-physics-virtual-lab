import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createShowcaseModel, SHOWCASE_EXHIBITS, showcasePosition, showcaseReadings, type ShowcaseKind, type ShowcaseModel } from './showcaseModel';
import { createShowcasePlayback, type ShowcaseClockSnapshot } from './showcasePlayback';
import './HighSchoolShowcase.css';

const choices: ShowcaseKind[] = ['pendulum', 'projectile', 'collision'];
const emptyClock: ShowcaseClockSnapshot = { time: 0, playing: false, active: false, finished: false };
type ClockState = ShowcaseClockSnapshot & { key: string };

/** Standalone homepage preview: no record store, assistant context, or Three imports. */
export function HighSchoolShowcase() {
  const id = useId().replace(/:/g, '');
  const [selection, setSelection] = useState<{ kind: ShowcaseKind; index: number }>({ kind: 'pendulum', index: 1 });
  const key = `${selection.kind}:${selection.index}`;
  const model = useMemo(() => createShowcaseModel(selection.kind, selection.index), [selection.kind, selection.index]);
  const exhibit = SHOWCASE_EXHIBITS[selection.kind];
  const [clockState, setClock] = useState<ClockState>({ ...emptyClock, key: 'pendulum:1' });
  const [reducedMotion, setReducedMotion] = useState(false);
  const clock = clockState.key === key ? clockState : emptyClock;
  const state = model.stateAt(clock.time);
  const container = useRef<HTMLElement | null>(null);
  const playback = useRef<ReturnType<typeof createShowcasePlayback> | null>(null);
  const intent = useRef(true);
  const preferenceKnown = useRef(false);

  useEffect(() => {
    const controller = createShowcasePlayback({ durationSeconds: model.durationSeconds, rate: model.rate,
      requestFrame: callback => window.requestAnimationFrame(callback), cancelFrame: frame => window.cancelAnimationFrame(frame),
      onChange: snapshot => { if (snapshot.finished) intent.current = false; setClock({ ...snapshot, key }); },
    });
    playback.current = controller;
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    setReducedMotion(Boolean(media?.matches));
    if (!preferenceKnown.current) { intent.current = !media?.matches; preferenceKnown.current = true; }
    let inView = typeof IntersectionObserver === 'undefined';
    const updateVisibility = () => controller.setVisible(inView && !document.hidden);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === container.current);
      if (entry) { inView = entry.isIntersecting && entry.intersectionRatio > 0; updateVisibility(); }
    }, { threshold: [0, .05] });
    if (container.current) observer?.observe(container.current);
    const motionChanged = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) { intent.current = false; controller.pause(); }
    };
    document.addEventListener('visibilitychange', updateVisibility);
    if (media?.addEventListener) media.addEventListener('change', motionChanged); else media?.addListener(motionChanged);
    setClock({ ...emptyClock, key });
    updateVisibility();
    if (intent.current) controller.play();
    return () => {
      controller.dispose(); observer?.disconnect(); document.removeEventListener('visibilitychange', updateVisibility);
      if (media?.removeEventListener) media.removeEventListener('change', motionChanged); else media?.removeListener(motionChanged);
      if (playback.current === controller) playback.current = null;
    };
  }, [model, key]);

  function toggle() {
    const controller = playback.current;
    if (!controller) return;
    intent.current = !controller.snapshot().playing;
    if (intent.current) controller.play(); else controller.pause();
  }
  function choose(kind: ShowcaseKind, index: number) {
    if (kind !== selection.kind || index !== selection.index) setSelection({ kind, index });
  }
  const status = clock.finished ? '本轮结束' : clock.active ? '正在播放' : clock.playing ? '离开展台时暂停' : '已暂停';
  return <section ref={container} className="hs-showcase" aria-label="高中物理动态模型展台">
    <header className="hs-showcase-top"><span className="hs-showcase-eyebrow"><i aria-hidden="true" />模型展台 / MODEL STUDIO</span><span className={`hs-showcase-status${clock.active ? ' is-active' : ''}`} role="status">{status}</span></header>
    <div className="hs-showcase-tabs" role="group" aria-label="选择预览现象">{choices.map(kind => <button type="button" key={kind} aria-pressed={selection.kind === kind} aria-controls={`${id}-scene`} onClick={() => choose(kind, SHOWCASE_EXHIBITS[kind].defaultIndex)}><span>{SHOWCASE_EXHIBITS[kind].number}</span>{SHOWCASE_EXHIBITS[kind].label}</button>)}</div>
    <div className="hs-showcase-heading"><h2>{exhibit.title}</h2><p>{exhibit.question}</p></div>
    <div className="hs-showcase-stage" id={`${id}-scene`}>
      <div className="hs-showcase-time"><span>物理时间</span><b>{clock.time.toFixed(2)}<small> s</small></b>{model.rate !== 1 && <em>0.5× 慢放</em>}</div>
      <ShowcaseApparatus model={model} state={state} id={id} />
      <p className="hs-showcase-stage-note">{exhibit.note}</p>
    </div>
    <div className="hs-showcase-readings" aria-label="当前模型读数">{showcaseReadings(selection.kind, state).map(reading => <div key={reading.label}><span>{reading.label}</span><strong>{reading.value}<small>{reading.unit}</small></strong></div>)}</div>
    <div className="hs-showcase-control-area"><fieldset><legend>{exhibit.variable}<span>改变一个条件，从头对照</span></legend><div className="hs-showcase-options">{exhibit.options.map((label,index) => <button type="button" key={label} aria-pressed={selection.index === index} onClick={() => choose(selection.kind,index)}>{label}</button>)}</div></fieldset>
      <div className="hs-showcase-bottom"><button className="hs-showcase-play" type="button" onClick={toggle} aria-label={clock.playing ? '暂停模型预览' : clock.finished ? '重新播放模型预览' : '播放模型预览'}><svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">{clock.playing ? <path d="M6 4v12M14 4v12" stroke="currentColor" strokeWidth="3"/> : <path d="M6 3l10 7-10 7z" fill="currentColor"/>}</svg>{clock.playing ? '暂停' : clock.finished ? '重新播放' : '播放'}</button><Link to={`/high-school/experiments/${exhibit.route}`}>进入{exhibit.label}实验<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></Link></div>
      <p className="hs-showcase-boundary">{reducedMotion ? '已启用减少动态效果；仅在你选择播放后运动。' : '模型预览，终点停下；切换条件不保存实验档案。'}{selection.kind === 'projectile' ? '落点为碰地前状态，不模拟反弹。' : selection.kind === 'pendulum' ? '本轮观察8秒，周期来自非线性单摆模型。' : '本轮观察6秒，e=0后两车同速，不必静止。'}</p>
    </div>
  </section>;
}

function Cart({ x, color, metal }: { x: number; color: string; metal: string }) {
  return <g><path d={`M${x} 254l8-12h68l-8 12z`} fill={metal}/><rect x={x} y="254" width="68" height="34" rx="5" fill={color}/><path d={`M${x+68} 254l8-12v33l-8 13z`} fill={color} opacity=".65"/><path d={`M${x+8} 262h50`} stroke="#f7e6bd" strokeOpacity=".35"/>{[15,53].map(dx=><g key={dx}><circle cx={x+dx} cy="292" r="10" fill="#081f29" stroke="#7b999c" strokeWidth="2"/><circle cx={x+dx} cy="292" r="3" fill="#a8bbb4"/></g>)}</g>;
}
function VelocityArrow({ x, y, velocity, color }: { x: number; y: number; velocity: number; color: string }) {
  if (Math.abs(velocity) < 1e-10) return null;
  const end = x + velocity * 55, sign = Math.sign(velocity);
  return <path d={`M${x} ${y}H${end}m${-sign*7}-5 ${sign*7} 5 ${-sign*7} 5`} stroke={color} strokeWidth="2" fill="none"/>;
}

/** SVG is a depth illustration; physical coordinates use fixed affine mappings. */
export function ShowcaseApparatus({ model, state, id }: { model: ShowcaseModel; state: Record<string, number>; id: string }) {
  const gold = `url(#${id}-gold)`, steel = `url(#${id}-steel)`, shadow = `url(#${id}-shadow)`;
  const point = model.kind === 'pendulum' ? showcasePosition.pendulum(state.x,state.y) : model.kind === 'projectile' ? showcasePosition.projectile(state.x,state.y) : null;
  const path = model.path.map(p => model.kind === 'pendulum' ? showcasePosition.pendulum(p.x,p.y) : showcasePosition.projectile(p.x,p.y));
  const trace = model.kind === 'projectile' ? [...model.path.filter(p=>p.time<=state.time).map(p=>showcasePosition.projectile(p.x,p.y)),point!] : [];
  const one = showcasePosition.collision(state.x1 ?? 0), two = showcasePosition.collision(state.x2 ?? 0);
  return <svg className="hs-showcase-svg" viewBox="0 0 640 410" role="img" aria-labelledby={`${id}-art-title`}>
    <title id={`${id}-art-title`}>{`${SHOWCASE_EXHIBITS[model.kind].label}模型预览；当前读数与控制在图外列出，器材具有示意深度。`}</title>
    <defs>
      <radialGradient id={`${id}-gold`} cx="32%" cy="25%" r="75%"><stop offset="0" stopColor="#fff1cd"/><stop offset=".25" stopColor="#f0c486"/><stop offset=".65" stopColor="#bc7943"/><stop offset="1" stopColor="#5d3e2d"/></radialGradient>
      <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#385b64"/><stop offset=".35" stopColor="#a0b8b3"/><stop offset=".5" stopColor="#5f858b"/><stop offset="1" stopColor="#28464f"/></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#020f15" stopOpacity=".6"/><stop offset="1" stopColor="#020f15" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#1d4852"/><stop offset="1" stopColor="#12323e"/></linearGradient>
      <radialGradient id={`${id}-ambient`}><stop stopColor="#66c0af" stopOpacity=".15"/><stop offset="1" stopColor="#66c0af" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="332" cy="230" rx="245" ry="160" fill={`url(#${id}-ambient)`}/>
    <path d="M62 330 499 310 602 367 151 394Z" fill={`url(#${id}-floor)`} stroke="#6fc3b2" strokeOpacity=".2"/>
    <path d="M151 394v8l451-27v-8M62 330v8l89 64" fill="#0a222c" stroke="#83a49e" strokeOpacity=".16"/>
    <g stroke="#75b4a7" strokeWidth=".6" strokeOpacity=".12">{[0,1,2,3,4,5].map(i=><path key={i} d={`M${89+i*73} ${329-i*3.3}l92 61`}/>)}{[0,1,2].map(i=><path key={i} d={`M${88+i*28} ${347+i*17}l441-22`}/>)}</g>
    {model.kind === 'pendulum' && point && <g data-showcase-apparatus="pendulum">
      <ellipse cx="320" cy="337" rx="170" ry="29" fill={shadow}/>
      <path d="M173 325V68h300v257" stroke="#081c24" strokeWidth="14" fill="none"/><path d="M169 321V64h300v257" stroke={steel} strokeWidth="10" fill="none"/>
      <path d="M145 323h49l17 11h-50zM447 323h47l18 11h-50z" fill={steel}/>
      <rect x="304" y="58" width="32" height="18" rx="3" fill={steel}/><path d="M320 75v10" stroke="#d7c5a1" strokeWidth="4"/>
      <path d={`M320 85v${model.initial.length*130}`} stroke="#9bbaa9" strokeOpacity=".3" strokeDasharray="4 6"/>
      <polyline points={path.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#60cbb7" strokeOpacity=".4" strokeDasharray="3 7"/>
      <ellipse cx={point.x+8} cy="334" rx={21+Math.max(0,(310-point.y))*.04} ry="7" fill={shadow}/>
      <path data-showcase-string="true" d={`M320 85L${point.x} ${point.y}`} stroke="#e1d7b9" strokeWidth="1.8"/>
      <circle cx="320" cy="85" r="4" fill="#e1aa67"/><circle data-showcase-body="true" cx={point.x} cy={point.y} r="17" fill={gold}/><circle cx={point.x-5} cy={point.y-6} r="3" fill="#fff0d0" opacity=".7"/>
      <text x="320" y="373" textAnchor="middle">悬点至球心 · 固定米比例</text>
    </g>}
    {model.kind === 'projectile' && point && <g data-showcase-apparatus="projectile">
      <ellipse cx="335" cy="334" rx="220" ry="24" fill={shadow}/>
      <path d="M75 316h492" stroke={steel} strokeWidth="6"/><path d="M95 316v-55" stroke={steel} strokeWidth="9"/><path d="M79 264h32" stroke="#dfb779" strokeWidth="4"/>
      <polyline points={path.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#83b6ac" strokeOpacity=".4" strokeDasharray="4 7"/>
      <polyline points={trace.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#60cbb7" strokeWidth="2.5"/>
      <path d={`M${point.x} ${point.y}V316`} stroke="#90bcad" strokeOpacity=".3" strokeDasharray="3 6"/>
      <ellipse cx={point.x+5} cy="324" rx="22" ry="7" fill={shadow}/>
      <circle data-showcase-body="true" cx={point.x} cy={point.y} r="11" fill={gold}/>
      {[0,2,4].map(x=><g key={x}><path d={`M${showcasePosition.projectile(x,0).x} 316v8`} stroke="#91aaa3"/><text x={showcasePosition.projectile(x,0).x} y="346" textAnchor="middle">{x} m</text></g>)}
      <text x="335" y="377" textAnchor="middle">虚线为模型轨迹 · 亮线为已走过的路程</text>
    </g>}
    {model.kind === 'collision' && <g data-showcase-apparatus="collision">
      <ellipse cx="334" cy="327" rx="231" ry="24" fill={shadow}/>
      <path d="M65 303h512l13 9H77z" fill={steel}/><path d="M77 312h513v9H77z" fill="#304e58"/>
      <path d="M128 321v15m397-15v15" stroke={steel} strokeWidth="8"/>
      <Cart x={one-68} color="#b9804e" metal="#e1b174"/><Cart x={two} color="#397f79" metal="#71c8b1"/>
      <VelocityArrow x={one-34} y={219} velocity={state.velocity1} color="#e1aa67"/><VelocityArrow x={two+34} y={190} velocity={state.velocity2} color="#60cbb7"/>
      <text x={one-34} y="246" textAnchor="middle" className="hs-showcase-cart-label">1</text><text x={two+34} y="246" textAnchor="middle" className="hs-showcase-cart-label">2</text>
      <g transform="translate(320 115)"><rect x="-62" y="-16" width="124" height="31" rx="15" fill={state.collided?'#285950':'#294450'}/><text textAnchor="middle" y="5" className="hs-showcase-phase">{state.collided?'相碰后':'相碰前'}</text></g>
      <text x="332" y="369" textAnchor="middle">接触端为位置参考 · 恢复系数改变能量转化</text>
    </g>}
  </svg>;
}
