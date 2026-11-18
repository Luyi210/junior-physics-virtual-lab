import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LearningFeedback } from "@physics-lab/contracts";
import { LearningFeedbackDisclosure, LearningFeedbackList, LearningFeedbackSnapshot } from "./LearningFeedbackList";

const ui = vi.hoisted(() => ({ intercept: false, open: false, setOpen: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useId: () => ui.intercept ? "disclosure" : actual.useId(), useState: (initial: unknown) => ui.intercept ? [ui.open, ui.setOpen] : actual.useState(initial) };
});
afterEach(() => { ui.intercept = false; ui.open = false; ui.setOpen.mockClear(); });

const item: LearningFeedback = {
  id: "feedback-a", schoolId: "school", classId: "class", taskId: "task", sessionId: "session", learnerId: "learner",
  authorId: "teacher", authorName: "物理老师", authorRole: "teacher", body: "先核对变量，再检查你的结论。\n保留原始读数。",
  reportRevision: 2, reportUpdatedAt: "2026-11-11T00:00:00Z", createdAt: "2026-11-11T01:00:00Z", mutationId: "op",
  reportSnapshot: { prediction: "  原预测\n", measurements: "<script>原始测量</script>", conclusion: "第2版结论", question: "" }
};

describe("feedback is explicitly tied to a preserved report snapshot", () => {
  it("keeps the original full text and distinguishes it from a newer account report", () => {
    const html = renderToStaticMarkup(<LearningFeedbackList feedback={[item]} currentRevision={3} />);
    expect(html).toContain("针对报告第 2 版"); expect(html).toContain("当前已读取的账号报告为第 3 版");
    const snapshot = renderToStaticMarkup(<LearningFeedbackSnapshot item={item} />);
    expect(snapshot).toContain("  原预测\n"); expect(snapshot).toContain("第2版结论"); expect(snapshot).toContain("当时尚未填写");
    expect(html).toContain("保留原始读数。"); expect(html).toContain('dateTime="2026-11-11T01:00:00Z"');
    expect(html).not.toContain("已达标"); expect(html).not.toContain("评分");
  });
  it("renders student and teacher text safely without HTML interpretation or collapsed truncation", () => {
    const html = renderToStaticMarkup(<LearningFeedbackList feedback={[{ ...item, body: "<img src=x onerror=alert(1)>", authorName: "<b>老师</b>" }]} currentRevision={2} />);
    expect(renderToStaticMarkup(<LearningFeedbackSnapshot item={item} />)).toContain("&lt;script&gt;原始测量&lt;/script&gt;"); expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script>"); expect(html).not.toContain("<img"); expect(html).not.toContain("<b>老师</b>");
    expect(html).not.toContain("当前已读取"); expect(html).not.toContain("<textarea");
    expect(html).not.toContain("第2版结论");
  });
  it("handles missing date readability without hiding the immutable report version", () => {
    const html = renderToStaticMarkup(<LearningFeedbackList feedback={[{ ...item, authorRole: "admin", createdAt: "invalid" }]} />);
    expect(html).toContain("管理员"); expect(html).toContain("时间暂不可用"); expect(html).toContain("报告原文（第 2 版）");
    const stale = renderToStaticMarkup(<LearningFeedbackList feedback={[item]} currentRevision={1} />);
    expect(stale).toContain("本页账号记录较旧，请重新读取报告");
  });
  it("rejects an old reveal callback after its account guard changes, and hides an already open snapshot", () => {
    ui.intercept = true;
    let allowed = true;
    const tree = LearningFeedbackDisclosure({ item, canReveal: () => allowed });
    const button = tree.props.children[0];
    button.props.onClick(); expect(ui.setOpen).toHaveBeenCalledOnce();
    ui.setOpen.mockClear(); allowed = false;
    button.props.onClick(); expect(ui.setOpen).not.toHaveBeenCalled();
    ui.open = true;
    const guarded = LearningFeedbackDisclosure({ item, canReveal: () => allowed });
    expect(guarded.props.children[0].props["aria-expanded"]).toBe(false);
    expect(guarded.props.children[1].props.hidden).toBe(true);
    expect(guarded.props.children[1].props.children).toBe(false);
  });
});
