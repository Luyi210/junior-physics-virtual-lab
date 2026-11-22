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
    version: "2026.11.22.4",
    date: "2026-11-22",
    title: "力力增加现场判断与思路检查",
    summary: "高中实验中可直接查看当前卡点、下一步，并检查自己写下的观察与结论。",
    changes: [
      "力力新增现场判断：结合当前实验条件、过程时间和可用记录提示下一步。",
      "可检查观察、假设、推理和结论的表述结构；记录来源与物理结论仍需学生自行核实。"
    ]
  },
  {
    version: "2026.11.22.3",
    date: "2026-11-22",
    title: "高中实验动态更容易观察",
    summary: "短暂的实验现象默认慢放，并可在实验台上切换观察速度。",
    changes: [
      "有过程的高中实验增加 0.1× 至 2× 观察速度选择，短过程默认慢放。",
      "高中首页的单摆、抛体和碰撞预览放慢；实验时间与读数仍使用物理秒。"
    ]
  },
  {
    version: "2026.11.22.2",
    date: "2026-11-22",
    title: "初高中入口并列展示",
    summary: "首页的初中探索与高中实验室现在并列呈现，方便直接选择。",
    changes: [
      "高中实验室进入首页主入口区，与初中探索并列。",
      "移除页面下方重复的高中入口，教师空间保留独立入口。"
    ]
  },
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
