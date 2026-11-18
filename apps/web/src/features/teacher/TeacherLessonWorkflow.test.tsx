import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { TeacherTeachingFlow } from "./TeacherTeachingFlow";
import { TeacherLessons } from "./sections/TeacherLessons";
import { TeacherRealClasses } from "./TeacherRealClasses";
import { createDefaultTeacherWorkspace, teacherExperimentCatalog, teacherLessonDefaults } from "./teacherWorkspace";

// A small in-memory hook adapter drives the real component callbacks. This is
// not a browser renderer; keys are checked explicitly for uncontrolled inputs.
const state = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }));
const api = vi.hoisted(() => ({ createLesson: vi.fn(), createClass: vi.fn(), createTask: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.cells)) state.cells[index] = typeof initial === "function" ? initial() : initial;
    return [state.cells[index], (next: unknown) => { state.cells[index] = typeof next === "function" ? next(state.cells[index]) : next; }];
  }, useMemo: (factory: () => unknown) => factory()
}));
vi.mock("react-router-dom", () => ({ Link: "a", useNavigate: () => vi.fn() }));
vi.mock("./useTeacherSessionGuard", () => ({ useTeacherSessionGuard: () => () => true }));
vi.mock("../../data/teacherApi", () => ({ teacherApi: api, TeacherApiError: class extends Error {} }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...all(node.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : "";
}
function render(component: () => ReactNode) { state.cursor = 0; return component(); }
function button(tree: ReactNode, label: string) { return all(tree).find((item) => item.type === "button" && text(item).includes(label))!; }
function click(element: Element) { (element.props.onClick as () => void)(); }
function formValues(form: Element) {
  return Object.fromEntries(all(form).filter((item) => typeof item.props.name === "string").map((item) => [item.props.name, item.props.defaultValue ?? item.props.value ?? ""]));
}
async function submit(form: Element, values: Record<string, unknown>) {
  vi.stubGlobal("FormData", class { get(key: string) { return values[key] ?? null; } });
  try { await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: {} }); }
  finally { vi.unstubAllGlobals(); }
}

beforeEach(() => {
  state.cells = []; state.cursor = 0; vi.clearAllMocks();
  api.createLesson.mockResolvedValue({ id: "lesson-new" });
  api.createClass.mockResolvedValue({ id: "class-new", name: "高二（1）班", joinCode: "TEST" });
});

describe("teacher classroom authoring callbacks", () => {
  it("selects a high-school experiment, renders all new defaults and submits the teacher's edited fields", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const component = () => TeacherTeachingFlow({ classes: [], lessons: [], tasks: [], onRefresh });
    let tree = render(component);
    const spring = teacherExperimentCatalog.find(({ id }) => id === "spring-force")!;
    expect(text(button(tree, spring.title))).toContain("高中");
    expect(text(button(tree, "凸透镜成像"))).toContain("初中");
    click(button(tree, spring.title)); tree = render(component);
    click(button(tree, "创建课例")); tree = render(component);
    const form = all(tree).find((item) => item.type === "form")!;
    const values = formValues(form);
    expect(form.key).toBe("spring-force");
    for (const [key, value] of Object.entries(teacherLessonDefaults(spring))) expect(values[key]).toBe(value);
    await submit(form, { ...values, title: "本班弹簧探究", objective: "教师修改后的目标", durationMinutes: "40" });
    expect(api.createLesson).toHaveBeenCalledWith(expect.objectContaining({ experimentId: "spring-force", title: "本班弹簧探究", objective: "教师修改后的目标", controlledVariable: values.controlledVariable, evidenceRequirement: values.evidenceRequirement, status: "ready" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("replaces all template fields on a demo lesson switch while preserving stored lesson content", () => {
    const workspace = createDefaultTeacherWorkspace();
    const before = JSON.stringify(workspace);
    const component = () => TeacherLessons({ workspace, onAdd: vi.fn(), onLaunch: vi.fn() });
    const first = render(component);
    const firstFields = all(first).filter((item) => typeof item.props.name === "string");
    const pendulum = teacherExperimentCatalog.find(({ id }) => id === "pendulum")!;
    click(button(first, pendulum.title));
    const next = render(component);
    const nextForm = all(next).find((item) => item.type === "form")!;
    const values = formValues(nextForm);
    for (const [key, value] of Object.entries(teacherLessonDefaults(pendulum))) {
      expect(values[key]).toBe(value);
      const previous = firstFields.find((item) => item.props.name === key)!;
      const changed = all(nextForm).find((item) => item.props.name === key)!;
      expect(changed.key).not.toBe(previous.key);
    }
    expect(JSON.stringify(workspace)).toBe(before);
    expect(text(next)).toContain(workspace.lessons[0]!.predictionPrompt);
  });

  it("offers all three high-school grades and submits the chosen grade unchanged", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const component = () => TeacherRealClasses({ classes: [], students: [], onRefresh });
    let tree = render(component);
    click(button(tree, "创建教学班")); tree = render(component);
    const form = all(tree).find((item) => item.type === "form")!;
    const select = all(form).find((item) => item.type === "select" && item.props.name === "grade")!;
    expect(all(select).filter((item) => item.type === "option").map((item) => text(item))).toEqual(["七年级", "八年级", "九年级", "高一", "高二", "高三"]);
    await submit(form, { name: "高二（1）班", grade: "高二" });
    expect(api.createClass).toHaveBeenCalledWith({ name: "高二（1）班", grade: "高二" });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
