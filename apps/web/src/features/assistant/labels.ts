import { type HarnessEventType, type HarnessArea } from "@physics-lab/harness";

export const eventNames: Record<HarnessEventType, string> = {
  "module.entered": "进入实验情境",
  "control.changed": "调整实验参数",
  "simulation.toggled": "改变动态状态",
  "configuration.changed": "切换实验配置",
  "scene.navigated": "旋转或缩放三维场景",
  "view.changed": "切换三维观察视角",
  "observation.created": "保存一条观察",
  "insight.read": "查看方法提示",
  "dialogue.asked": "向探究伙伴提问"
};

export const areaNames: Record<HarnessArea, string> = {
  optics: "光现象",
  lens: "透镜",
  sound: "声现象",
  mechanics: "运动与力",
  circuit: "电与磁",
  thermal: "热与物态",
  measurement: "质量与密度"
};

export type PanelView = "dialogue" | "tutorial" | "review";
