import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { PlatformUser } from '@physics-lab/contracts';
import type { StudentRecordScope } from '../../../data/studentRecordScope';
import { StudentDashboard } from './StudentDashboard';
import { StudentTextbookLibrary } from './StudentTextbookLibrary';
import { scrollToStudentSection } from '../components/scrollToStudentSection';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const state = vi.hoisted(() => ({ frame: null as Frame | null, writes: 0, scope: null as StudentRecordScope | null,
  token: 'synthetic-a', health: vi.fn(), me: vi.fn(), login: vi.fn(), logout: vi.fn(), hasSession: vi.fn(), navigate: vi.fn() }));
// Actual TSX callbacks and effects, with controlled hook state and API replies.
// This is not a DOM renderer or a real browser/network/credential-store test.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const slot = () => { const frame = state.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) => !a || !b || a.length !== b.length || b.some((value, i) => !Object.is(value, a[i]));
  return { ...actual,
    useState: (initial: unknown) => {
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { state.writes++; item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = { current: initial }; return item.value; },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => { const item = slot(); if (changed(item.deps, deps)) { item.value = factory(); item.deps = deps; } return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const item = slot(); if (changed(item.deps, deps)) { item.deps = deps; state.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
vi.mock('react-router-dom', () => ({ Link: 'route-link', useNavigate: () => state.navigate }));
vi.mock('../../../data/studentRecordScope', () => ({ getStudentRecordScope: () => state.scope }));
vi.mock('../../../data/teacherApi', () => ({ DEMO_ONLY: false,
  getStudentAuthMetadata: () => ({ apiNamespace: state.scope!.apiNamespace, studentToken: state.token }),
  studentApi: { health: () => state.health(), me: () => state.me(), hasSession: () => state.hasSession(),
    login: (...args: unknown[]) => state.login(...args), logout: () => state.logout() },
}));
vi.mock('../../../data/studentSessionSync', () => ({ clearActiveStudentSession: vi.fn() }));
vi.mock('../../../shared/components/BrandMark', () => ({ BrandMark: 'brand-mark' }));
vi.mock('../../../shared/components/PageIntroduction', () => ({ PageIntroduction: 'page-introduction' }));
vi.mock('../../../shared/hooks/useElementActivity', () => ({ useElementActivity: () => false }));
vi.mock('../../assistant/OrangeCatAvatar', () => ({ OrangeCatAvatar: 'cat-avatar', shuffleOrangeCatAvatar: vi.fn(), useOrangeCatAvatarLabel: () => 'cat' }));
vi.mock('../components/DashboardPhysicsCanvas', () => ({ DashboardPhysicsCanvas: 'physics-canvas' }));
vi.mock('../components/StudentIdentityPortal', () => ({ StudentIdentityPortal: 'student-identity' }));
vi.mock('../components/StudentTaskCenter', () => ({ StudentTaskCenter: 'student-tasks' }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(all);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : [];
}
const cleanups: Array<() => void> = [];
function mount(component: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render() { frame.cursor = 0; state.frame = frame; try { app.tree = component(); } finally { state.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; },
    element(type: string) { const result = all(app.tree).find((node) => node.type === type); expect(result, type).toBeDefined(); return result!; },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(app.unmount); return app;
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const userA: PlatformUser = { id: 'a', schoolId: 'school-a', role: 'student', status: 'active', name: '合成甲', email: 'a@example.invalid', classIds: [], classNames: [], lastLoginAt: null, createdAt: '2026-11-11T00:00:00Z' };
const userB = { ...userA, id: 'b', name: '合成乙' };
function changeScope(patch: Partial<StudentRecordScope> = {}) { state.scope = { ...state.scope!, revision: state.scope!.revision + 1, ...patch }; }
async function loginB(app: ReturnType<typeof mount>) {
  state.login.mockImplementation(async () => { state.token = 'synthetic-b'; changeScope({ studentId: 'b', key: 'backend:school-a:b' }); return { user: userB, accessToken: state.token }; });
  await (app.element('student-identity').props.onLogin as (email: string, password: string) => Promise<void>)('b@example.invalid', 'synthetic-only'); app.render();
  expect(app.element('student-tasks').props.user).toEqual(userB);
}
beforeEach(() => {
  state.frame = null; state.writes = 0; state.token = 'synthetic-a';
  state.scope = { key: 'backend:school-a:a', apiNamespace: 'https://synthetic.invalid/api', schoolId: 'school-a', studentId: 'a', mode: 'account', label: '合成甲', canWrite: true, revision: 1 };
  state.health.mockReset().mockResolvedValue({}); state.me.mockReset().mockResolvedValue(userA); state.hasSession.mockReset().mockReturnValue(true);
  state.login.mockReset(); state.logout.mockReset(); state.navigate.mockReset();
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('student dashboard late session checks', () => {
  it.each(['resolve', 'reject'] as const)('keeps the new login when an old me request later %ss', async (result) => {
    const old = deferred<PlatformUser>(); state.me.mockReturnValueOnce(old.promise);
    const app = mount(StudentDashboard); await settle(); await loginB(app);
    const writes = state.writes;
    if (result === 'resolve') old.resolve(userA); else old.reject(new Error('ACCOUNT_CHANGED'));
    await settle(); app.render();
    expect(state.logout).not.toHaveBeenCalled(); expect(state.writes).toBe(writes);
    expect(app.element('student-tasks').props.user).toEqual(userB);
  });

  it.each(['renewal', 'school', 'backend', 'unmount'] as const)('does not logout or update from a stale check after %s', async (change) => {
    const old = deferred<PlatformUser>(); state.me.mockReturnValueOnce(old.promise);
    const app = mount(StudentDashboard); await settle();
    if (change === 'renewal') changeScope();
    if (change === 'school') changeScope({ schoolId: 'school-b', key: 'backend:school-b:a' });
    if (change === 'backend') changeScope({ apiNamespace: 'https://other.invalid/api', key: 'other:school-a:a' });
    if (change === 'unmount') app.unmount();
    const writes = state.writes; old.reject(new Error('stale request')); await settle();
    expect(state.logout).not.toHaveBeenCalled(); expect(state.writes).toBe(writes);
  });

  it('does not let a late health failure replace a successful login with offline status', async () => {
    const health = deferred<object>(); state.health.mockReturnValueOnce(health.promise);
    const app = mount(StudentDashboard); await loginB(app); const writes = state.writes;
    health.reject(new Error('old server failed')); await settle(); app.render();
    expect(state.writes).toBe(writes); expect(state.me).not.toHaveBeenCalled();
    expect(app.element('student-tasks').props.user).toEqual(userB);
  });

  it('keeps guest choice and gives the latest retry precedence over older checks', async () => {
    const old = deferred<PlatformUser>(); state.me.mockReturnValueOnce(old.promise);
    const app = mount(StudentDashboard); await settle();
    (app.element('student-identity').props.onGuest as () => void)(); app.render();
    const writes = state.writes; old.resolve(userA); await settle(); app.render();
    expect(state.writes).toBe(writes); expect(all(app.tree).some((node) => node.type === 'student-tasks')).toBe(false);
    app.unmount();
    const earlier = deferred<PlatformUser>(); state.me.mockReturnValueOnce(earlier.promise).mockResolvedValueOnce(userA);
    const retryApp = mount(StudentDashboard); await settle();
    await (retryApp.element('student-identity').props.onRetry as () => Promise<void>)();
    earlier.reject(new Error('earlier check failed')); await settle(); retryApp.render();
    expect(state.logout).not.toHaveBeenCalled(); expect(retryApp.element('student-tasks').props.user).toEqual(userA);
  });

  it('still logs out the same current account when its own me check fails, and permits retry', async () => {
    state.me.mockRejectedValueOnce(new Error('invalid session'));
    const app = mount(StudentDashboard); await settle(); app.render();
    expect(state.logout).toHaveBeenCalledTimes(1); expect(app.element('student-identity').props.connection).toBe('online');
    state.me.mockResolvedValue(userA);
    await (app.element('student-identity').props.onRetry as () => Promise<void>)(); app.render();
    expect(app.element('student-tasks').props.user).toEqual(userA);
  });
});

describe('student page section navigation preserves the hash route', () => {
  function browser(hash: string, reduced: boolean) {
    const location = { hash }; const scroll = vi.fn(); const lookup = vi.fn(() => ({ scrollIntoView: scroll }));
    vi.stubGlobal('window', { location, matchMedia: vi.fn(() => ({ matches: reduced })) });
    vi.stubGlobal('document', { getElementById: lookup });
    return { location, scroll, lookup };
  }
  function activate(link: Element, location: { hash: string }) {
    let prevented = false;
    (link.props.onClick as (event: unknown) => void)({ preventDefault() { prevented = true; } });
    // Model the native anchor default action only; layout and scrolling are not rendered.
    if (!prevented) location.hash = String(link.props.href);
    expect(prevented).toBe(true);
  }
  it('scrolls every desktop/mobile dashboard section, including task links, without changing the route', async () => {
    const app = mount(StudentDashboard); await settle(); app.render();
    const env = browser('#/student', false);
    const links = all(app.tree).filter((node) => node.type === 'a' && String(node.props.href).startsWith('#'));
    expect(links.length).toBeGreaterThanOrEqual(7);
    for (const link of links) { activate(link, env.location); expect(env.lookup).toHaveBeenLastCalledWith(String(link.props.href).slice(1)); }
    expect(env.location.hash).toBe('#/student'); expect(env.scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
  });
  it('keeps the textbook route and instantly scrolls all section links when reduced motion is selected', () => {
    const app = mount(StudentTextbookLibrary); const env = browser('#/student/textbook', true);
    const links = all(app.tree).filter((node) => node.type === 'a' && String(node.props.href).startsWith('#'));
    expect(links.map((link) => link.props.href)).toEqual(['#chapter-atlas', '#usage-note', '#chapter-atlas']);
    for (const link of links) activate(link, env.location);
    expect(env.location.hash).toBe('#/student/textbook'); expect(env.scroll).toHaveBeenCalledTimes(3);
    expect(env.scroll).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });
  });
  it('suppresses broken fragment navigation even if its target is absent', () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('document', { getElementById: () => null });
    const preventDefault = vi.fn(); expect(() => scrollToStudentSection({ preventDefault }, 'missing')).not.toThrow();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
