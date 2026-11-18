import { ArrowDownRight, ChartNoAxesCombined, FlaskConical, NotebookPen, SlidersHorizontal } from 'lucide-react';

export function scrollToWorkbenchSection(id: string) {
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = document.getElementById(id);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function WorkbenchNavigation() {
  return <nav className="hs-workbench-nav" aria-label="实验工作区导航">
    <span>实验工作区 <ArrowDownRight size={15} /></span>
    <button type="button" onClick={() => scrollToWorkbenchSection('hs-stage')}><FlaskConical size={16} />装置与操作</button>
    <button type="button" onClick={() => scrollToWorkbenchSection('hs-conditions')}><SlidersHorizontal size={16} />条件与记录</button>
    <button type="button" onClick={() => scrollToWorkbenchSection('hs-graphs')}><ChartNoAxesCombined size={16} />图像与规律</button>
    <button type="button" onClick={() => scrollToWorkbenchSection('hs-evidence')}><NotebookPen size={16} />实验记录</button>
  </nav>;
}

/** Observation progress reflects the existing clock, never another animation clock. */
export function ExperimentPlaybackStatus({ time, duration, running }: { time: number; duration: number; running: boolean }) {
  const dynamic = Number.isFinite(duration) && duration > 0;
  const position = dynamic ? Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0)) : 0;
  const state = !dynamic ? 'steady' : position >= duration ? 'ended' : running ? 'running' : position > 0 ? 'paused' : 'ready';
  const labels = { steady: '稳态模型', ended: '观察结束', running: '模型运行中', paused: '已暂停', ready: '准备就绪' };
  return <div className="hs-playback-status" data-state={state}>
    <span className="hs-run-indicator"><i aria-hidden="true" />{labels[state]}</span>
    {dynamic ? <div className="hs-observation-progress" role="progressbar" aria-label="本轮实验观察进度" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={position}><span style={{ width: `${position / duration * 100}%` }} /></div> : <span className="hs-steady-hint">改变条件，即时比较新的工作点</span>}
    <span className="hs-model-source">虚拟模型</span>
  </div>;
}
