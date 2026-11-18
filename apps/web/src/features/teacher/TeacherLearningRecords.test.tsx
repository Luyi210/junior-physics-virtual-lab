import type { LearningRecord, SessionLearningRecord } from "@physics-lab/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearningRecordDetails } from "./TeacherLearningRecords";

const emptyRecord: LearningRecord = {
  sessionId: "session-1", learnerId: "student-1", revision: 1, lastMutationId: "mutation-1",
  prediction: "", measurements: "", conclusion: "", question: "", updatedAt: "2026-11-10T06:00:00.000Z"
};

function recordItem(record: LearningRecord | null = null): SessionLearningRecord {
  return {
    session: {
      id: "session-1", schoolId: "school-1", taskId: "task-1", classId: "class-1", learnerId: "student-1",
      experimentId: "lens", status: "active", startedAt: "2026-11-10T05:00:00.000Z",
      updatedAt: "2026-11-10T06:00:00.000Z", completedAt: null
    },
    learnerName: "学生甲", taskTitle: "凸透镜实验", className: "八年级一班", lessonTitle: "探究凸透镜成像", record
  };
}

describe("teacher learning record details", () => {
  it("shows an unfilled session without inventing student answers or an update time", () => {
    const html = renderToStaticMarkup(<LearningRecordDetails item={recordItem()} />);
    expect(html).toContain("未填写");
    expect(html).toContain("尚未保存实验记录");
    expect(html).toContain("学生保存后");
    expect(html).not.toContain("<dl>");
    expect(html).not.toContain("记录更新于");
  });

  it("treats a saved whitespace-only draft as unfilled and shows all missing fields", () => {
    const html = renderToStaticMarkup(<LearningRecordDetails item={recordItem({ ...emptyRecord, prediction: " \n " })} />);
    expect(html).toContain('is-empty">未填写');
    expect(html.match(/尚未填写/g)).toHaveLength(4);
    expect(html).toContain('dateTime="2026-11-10T06:00:00.000Z"');
  });

  it("shows a partial saved answer as in progress, preserving the actual answer", () => {
    const html = renderToStaticMarkup(<LearningRecordDetails item={recordItem({ ...emptyRecord, measurements: "物距 30 cm\n像距 15 cm" })} />);
    expect(html).toContain('is-active">进行中');
    expect(html).toContain("物距 30 cm\n像距 15 cm");
    expect(html.match(/尚未填写/g)).toHaveLength(3);
    expect(html).not.toContain('is-completed">已完成');
  });

  it("shows actual session completion independently from whether a record was saved", () => {
    const item = recordItem();
    item.session.status = "completed";
    item.session.completedAt = "2026-11-10T06:30:00.000Z";
    const html = renderToStaticMarkup(<LearningRecordDetails item={item} />);
    expect(html).toContain('is-completed">已完成');
    expect(html).toContain("尚未保存实验记录");
    expect(html).toContain("结束于");
  });

  it("renders all four fields and student metadata as text, escaping supplied HTML", () => {
    const item = recordItem({
      ...emptyRecord,
      prediction: '<script>alert("prediction")</script>',
      measurements: '<img src=x onerror="alert(1)">',
      conclusion: '<a href="javascript:alert(1)">结论</a>',
      question: '<iframe srcdoc="malicious"></iframe>'
    });
    item.learnerName = "<b>学生甲</b>";
    item.className = "<svg onload=alert(1)>";
    const html = renderToStaticMarkup(<LearningRecordDetails item={item} />);
    for (const title of ["实验预测", "测量数据与观察", "实验结论", "疑问与反思"]) expect(html).toContain(title);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;a href=");
    expect(html).toContain("&lt;iframe");
    expect(html).toContain("&lt;b&gt;学生甲&lt;/b&gt;");
    expect(html).toContain("&lt;svg onload=");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain('<a href="javascript:');
  });
});
