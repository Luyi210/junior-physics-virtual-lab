import { drawLight, drawSound, drawCircuit, drawThermal, drawDensity } from "./coreDrawers";
import { drawLens, drawLever, drawBuoyancy, drawMagnet } from "./extendedDrawers";

export const scenes = [
  { key: "light", title: "光现象 · 三棱镜色散", note: "白光进入棱镜，不同色光沿不同方向传播" },
  { key: "sound", title: "声现象 · 振动与波", note: "声源振动，波形向前传播" },
  { key: "mechanics", title: "运动与力 · 杠杆平衡", note: "比较力与力臂共同产生的转动效果" },
  { key: "circuit", title: "电与磁 · 闭合电路", note: "开关闭合后，电流沿完整路径运动" },
  { key: "thermal", title: "热与物态 · 分子运动", note: "温度升高，微观粒子运动更加剧烈" },
  { key: "density", title: "质量与密度 · 排水法测量", note: "用天平测质量，用量筒示数差测体积" },
  { key: "lens", title: "光学应用 · 凸透镜成像", note: "改变物距，观察会聚光线与倒立实像的位置" },
  { key: "lever", title: "简单机械 · 杠杆平衡", note: "动力乘动力臂等于阻力乘阻力臂" },
  { key: "buoyancy", title: "力与运动 · 浮力与浮沉", note: "比较浮力与重力，判断物体的浮沉状态" },
  { key: "magnet", title: "电与磁 · 电磁铁", note: "电流通过线圈，铁芯周围产生磁场" }
] as const;

// Both mechanics and lever tabs use the same lever drawing.
export const drawers = [drawLight, drawSound, drawLever, drawCircuit, drawThermal, drawDensity, drawLens, drawLever, drawBuoyancy, drawMagnet] as const;

export type DashboardPhysicsScene = typeof scenes[number]["key"];
