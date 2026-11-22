export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly string[];
}

// Add each published release at the top. A new version shows its notice again
// even for visitors who dismissed a previous version.
export const releaseNotes: readonly ReleaseNote[] = [
  {
    version: "2026.11.22",
    date: "2026-11-22",
    title: "版本更新通知上线",
    summary: "首页现在会提示最新版本，并集中展示每次更新的内容。",
    changes: [
      "新增首页版本提示和更新记录入口。",
      "提示可关闭；下次发布新版本时会重新出现。"
    ]
  },
  {
    version: "2026.11.18",
    date: "2026-11-18",
    title: "初高中合版公开体验",
    summary: "初中探索与高中实验室汇集到同一个网页入口。",
    changes: [
      "从首页进入初中探索、高中实验室与教师演示。",
      "公开体验使用浏览器本地的演示数据。"
    ]
  }
];
