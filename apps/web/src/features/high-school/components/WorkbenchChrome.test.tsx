import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentPlaybackStatus, scrollToWorkbenchSection } from './WorkbenchChrome';

afterEach(() => vi.unstubAllGlobals());

describe('workbench observation status', () => {
  it('uses the supplied physical clock, distinguishes pause and gives completion priority', () => {
    const view = (time: number, running: boolean) => renderToStaticMarkup(<ExperimentPlaybackStatus time={time} duration={8} running={running} />);
    expect(view(0, false)).toContain('准备就绪');
    expect(view(2, true)).toContain('模型运行中');
    expect(view(2, false)).toContain('已暂停');
    expect(view(2, false)).toContain('aria-valuenow="2"');
    expect(view(2, false)).toContain('width:25%');
    expect(view(20, true)).toContain('观察结束');
    expect(view(20, true)).toContain('aria-valuenow="8"');
  });
  it('does not invent playback progress for steady models or invalid clock values', () => {
    const steady = renderToStaticMarkup(<ExperimentPlaybackStatus time={1} duration={0} running={true} />);
    expect(steady).toContain('稳态模型');
    expect(steady).not.toContain('progressbar');
    const invalid = renderToStaticMarkup(<ExperimentPlaybackStatus time={NaN} duration={8} running={false} />);
    expect(invalid).toContain('aria-valuenow="0"');
    expect(invalid).not.toContain('NaN');
  });
});

describe('keyboard workbench navigation', () => {
  it.each([true, false])('moves focus along with scrolling and honors reduced motion %s', reduced => {
    const target = { tabIndex: 0, hasAttribute: () => false, focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal('document', { getElementById: (id: string) => id === 'hs-evidence' ? target : null });
    scrollToWorkbenchSection('hs-evidence');
    expect(target.tabIndex).toBe(-1);
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    expect(() => scrollToWorkbenchSection('missing')).not.toThrow();
  });
});
