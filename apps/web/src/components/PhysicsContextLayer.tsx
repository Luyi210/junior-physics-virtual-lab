import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Atom, X } from "lucide-react";
import type { PhysicsField } from "./PhysicsFieldMotif";

interface ContextSpec {
  field: PhysicsField;
  title: string;
  formula: string;
  note: string;
  symbols: string[];
}

const defaultSpecs: Record<PhysicsField, ContextSpec> = {
  mixed: { field: "mixed", title: "初中物理开放实验", formula: "v=s/t · ρ=m/V", note: "观察 · 操作 · 证据", symbols: ["光", "声", "力", "电", "热", "测"] },
  light: { field: "light", title: "光现象", formula: "λν=c", note: "追踪光路，而非只看结果", symbols: ["F", "2F", "u", "v", "光轴"] },
  sound: { field: "sound", title: "声现象", formula: "v=fλ", note: "从振动到接收", symbols: ["A", "f", "λ", "dB"] },
  mechanics: { field: "mechanics", title: "运动与力", formula: "F₁l₁=F₂l₂", note: "确定对象，再分析变量", symbols: ["F", "s", "t", "p"] },
  circuit: { field: "circuit", title: "电与磁", formula: "I=U/R", note: "先寻找闭合电流路径", symbols: ["I", "U", "R", "P"] },
  thermal: { field: "thermal", title: "热与物态", formula: "Q=cmΔT", note: "连续记录时间与状态", symbols: ["T", "t", "Q", "℃"] },
  measurement: { field: "measurement", title: "质量与密度", formula: "ρ=m/V", note: "零点 · 分度值 · 读数", symbols: ["m", "V", "ρ", "Δ"] }
};

const lightModes: Record<string, Partial<ContextSpec>> = {
  overview: { title: "光学探究总览", formula: "c=3.0×10⁸ m/s", note: "传播路径决定看见什么" },
  dispersion: { title: "光的色散", formula: "n=n(λ)", note: "不同色光 · 不同偏折" },
  straight: { title: "光的直线传播", formula: "A → O → A′", note: "小孔处交叉 · 光屏承接" },
  reflection: { title: "光的反射", formula: "∠i=∠r", note: "角度以法线为基准" },
  refraction: { title: "光的折射", formula: "n₁sin i=n₂sin r", note: "跨越介质界面 · 方向改变" },
  "color-mix": { title: "色光三原色", formula: "R+G+B≈W", note: "加法混色 · 独立调光" },
  celestial: { title: "日食与月食", formula: "本影 / 半影", note: "天体排列 · 光沿直线" },
  "plane-mirror": { title: "平面镜成像", formula: "d像=d物", note: "等大 · 等距 · 正立虚像" },
  "curved-mirror": { title: "曲面镜", formula: "近轴平行光 ↔ F", note: "凹面近轴光会聚 · 凸面近轴光发散" },
  "invisible-light": { title: "红外线与紫外线", formula: "λIR＞λ可见＞λUV", note: "借助探测器看见不可见光" },
  magnifier: { title: "放大镜", formula: "u＜f", note: "正立 · 放大 · 虚像" },
  bench: { title: "凸透镜成像", formula: "1/f=1/u+1/v", note: "物距 · 像距 · 焦距" },
  camera: { title: "照相机", formula: "u＞2f", note: "倒立缩小实像落在传感器" },
  eye: { title: "眼睛的调节", formula: "像面=视网膜", note: "改变晶状体会聚能力" },
  correction: { title: "视力矫正", formula: "近视→凹 · 远视→凸", note: "让焦点重新落回视网膜" },
  instruments: { title: "光学仪器", formula: "物镜→中间像→目镜", note: "两级成像 · 分工协作" }
};

const scienceModules: Record<string, Partial<ContextSpec>> = {
  "sound-medium": { title: "声音的产生与传播", formula: "振动 → 介质 → 接收", note: "真空不能传声" },
  "sound-features": { title: "声音的特性", formula: "响度↔A · 音调↔f", note: "一次只改变一个量" },
  "sound-noise": { title: "噪声控制", formula: "声源→传播→人耳", note: "三个环节都能减弱噪声" },
  "sound-echo": { title: "回声测距", formula: "s=vt/2", note: "声波经历往返路程" },
  "mechanics-speed": { title: "运动与速度", formula: "v=s/t", note: "先统一单位" },
  "mechanics-friction": { title: "滑动摩擦力", formula: "匀速时 f=F拉", note: "压力 · 粗糙程度" },
  "mechanics-lever": { title: "杠杆平衡", formula: "F₁l₁=F₂l₂", note: "力与力臂共同决定转动效果" },
  "mechanics-pressure": { title: "压强", formula: "p=F/S", note: "单位面积上的压力" },
  "mechanics-buoyancy": { title: "浮力与浮沉", formula: "F浮=ρ液gV排", note: "比较浮力与重力" },
  "circuit-basic": { title: "串联与并联", formula: "闭合回路 → 电流", note: "一条路径与多条支路" },
  "circuit-ohm": { title: "欧姆定律", formula: "I=U/R", note: "控制变量 · 定量比较" },
  "circuit-power": { title: "电功率", formula: "P=UI", note: "描述电流做功的快慢" },
  "circuit-magnet": { title: "电流的磁效应", formula: "I↑ / N↑ → 磁性↑", note: "通电线圈产生磁场" },
  "thermal-thermometer": { title: "温度测量", formula: "量程 · 分度值 · 平视", note: "先认仪器，再读数" },
  "thermal-boiling": { title: "水的沸腾", formula: "吸热 · T≈沸点", note: "同时记录温度与状态" },
  "thermal-melting": { title: "熔化与凝固", formula: "晶体熔化 · T≈熔点", note: "寻找温度平台" },
  "thermal-evaporation": { title: "蒸发", formula: "温度↑ / 表面积↑ / 风速↑", note: "蒸发加快并吸热" },
  "measurement-balance": { title: "托盘天平", formula: "m物=m砝+m游码", note: "归零 · 调平 · 称量" },
  "measurement-mass-volume": { title: "质量与体积", formula: "同种物质 m∝V", note: "图像斜率反映密度" },
  "measurement-density": { title: "固体密度", formula: "ρ=m/(V₂−V₁)", note: "天平称量 · 排水测体积" },
  "measurement-liquid-density": { title: "液体密度", formula: "ρ=(m总−m杯)/V", note: "用质量差扣除容器" }
};

function resolveContext(pathname: string, search: string): ContextSpec {
  if (pathname === "/" || pathname === "/student" || pathname === "/teacher") return defaultSpecs.mixed;
  if (pathname === "/lab/lens") return { ...defaultSpecs.light, title: "凸透镜精密工作台", formula: "1/f=1/u+1/v", note: "场景状态与物理计算实时同步" };

  const params = new URLSearchParams(search);
  if (pathname === "/student/explore/light") return { ...defaultSpecs.light, ...(lightModes[params.get("mode") ?? "overview"] ?? {}) };

  const field = pathname.match(/^\/student\/explore\/(sound|mechanics|circuit|thermal|measurement)$/)?.[1] as Exclude<PhysicsField, "light" | "mixed"> | undefined;
  if (!field) return defaultSpecs.mixed;
  return { ...defaultSpecs[field], ...(scienceModules[params.get("module") ?? ""] ?? {}) };
}

function ContextSketch({ field }: { field: PhysicsField }) {
  return <svg className="physics-context-sketch" viewBox="0 0 280 190" aria-hidden="true">
    <g className="context-grid">{[20, 60, 100, 140, 180, 220, 260].map((x) => <path d={`M${x} 8V182`} key={`x${x}`} />)}{[20, 60, 100, 140, 180].map((y) => <path d={`M8 ${y}H272`} key={`y${y}`} />)}</g>
    {field === "mixed" && <g className="context-mixed"><ellipse cx="140" cy="95" rx="98" ry="38" /><ellipse cx="140" cy="95" rx="98" ry="38" transform="rotate(60 140 95)" /><ellipse cx="140" cy="95" rx="98" ry="38" transform="rotate(-60 140 95)" /><circle cx="140" cy="95" r="17" /><circle className="context-particle p1" cx="42" cy="95" r="6" /><circle className="context-particle p2" cx="188" cy="10" r="6" /><circle className="context-particle p3" cx="223" cy="160" r="6" /></g>}
    {field === "light" && <g className="context-light"><path className="context-axis" d="M8 102H272" /><path className="context-optic" d="M140 18C112 52 112 139 140 172C168 139 168 52 140 18Z" /><path className="context-energy e1" d="M14 45H140L252 137" /><path className="context-energy e2" d="M14 45L140 102L252 137" /><circle cx="86" cy="102" r="4" /><circle cx="194" cy="102" r="4" /></g>}
    {field === "sound" && <g className="context-sound"><path className="context-device" d="M36 44V100M63 44V100M36 44Q50 28 63 44M50 100V158M31 158H69" /><path className="context-energy sound-wave" d="M75 96Q95 42 115 96T155 96T195 96T235 96T275 96" /><path className="context-energy sound-wave second" d="M75 125Q95 94 115 125T155 125T195 125T235 125T275 125" /></g>}
    {field === "mechanics" && <g className="context-mechanics"><path className="context-beam" d="M26 103L252 76" /><path className="context-fulcrum" d="M137 90L112 164H164Z" /><path className="context-force f1" d="M57 33V92M47 79L57 92L67 79" /><path className="context-force f2" d="M223 142V84M213 97L223 84L233 97" /></g>}
    {field === "circuit" && <g className="context-circuit"><path className="context-wire" d="M25 44H100M124 44H250V145H197M167 145H88M58 145H25Z" /><path className="context-battery" d="M100 25V63M124 17V71" /><path className="context-resistor" d="M197 145L190 134L182 156L174 134L167 145" />{[54, 91, 151, 194, 230].map((x, index) => <circle className="context-charge" cx={x} cy="44" r="4" style={{ animationDelay: `${index * -.35}s` }} key={x} />)}</g>}
    {field === "thermal" && <g className="context-thermal"><path className="context-beaker" d="M52 27H155M65 27V145Q65 164 84 164H123Q142 164 142 145V27" /><path className="context-water" d="M66 103Q84 95 104 103T141 103V145Q141 163 123 163H84Q66 163 66 145Z" />{[82, 105, 126].map((x, index) => <circle className={`context-heat h${index + 1}`} cx={x} cy="132" r="5" key={x} />)}<path className="context-curve" d="M177 155L196 145L216 119L237 78L258 58H274" /></g>}
    {field === "measurement" && <g className="context-measurement"><path className="context-balance" d="M20 63H165M92 63V153M65 168H119M92 63L77 153H107Z" /><path className="context-pan" d="M20 63L8 108H50ZM165 63L135 108H195Z" /><path className="context-cylinder" d="M217 25V159Q217 174 231 174H254Q268 174 268 159V25" /><path className="context-water" d="M218 104H267V159Q267 173 254 173H231Q218 173 218 159Z" /></g>}
  </svg>;
}

export function PhysicsContextLayer() {
  const location = useLocation();
  const context = useMemo(() => resolveContext(location.pathname, location.search), [location.pathname, location.search]);
  const [expanded, setExpanded] = useState(false);

  return <aside className={`physics-context-layer context-${context.field}`}>
    <div className="physics-context-rail" aria-hidden="true">{Array.from({ length: 23 }, (_, index) => <i className={index % 5 === 0 ? "major" : ""} key={index}><b>{index % 5 === 0 ? index * 5 : ""}</b></i>)}</div>
    <div className={`physics-context-plate ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <button className="physics-context-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "收起物理情境提示" : `展开物理情境提示：${context.title}`} title={expanded ? "收起物理提示" : `${context.title} · ${context.formula}`}>
        {expanded ? <X size={15} /> : <Atom size={20} />}
      </button>
      <div className="physics-context-plate-body">
        <span><i />LIVE PHYSICS CONTEXT</span>
        <strong>{context.title}</strong>
        <code>{context.formula}</code>
        <small>{context.note}</small>
        <div>{context.symbols.map((symbol) => <b key={symbol}>{symbol}</b>)}</div>
      </div>
    </div>
    <div aria-hidden="true"><ContextSketch field={context.field} /><div className="physics-context-scan" /></div>
  </aside>;
}
