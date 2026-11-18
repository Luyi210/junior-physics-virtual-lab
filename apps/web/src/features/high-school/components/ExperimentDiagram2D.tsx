import { useId, useMemo } from "react";
import type { HighSchoolExperimentId, HighSchoolSimulation } from "@physics-lab/physics";
import { formatMeasurement, positionExtent, sceneDescriptions } from "../experiments/workbench";
import { DOUBLE_SLIT_SCREEN_2D, doubleSlitScreenFraction, doubleSlitScreenY } from "./sceneGeometry";

import type { CapacitorMode } from "@physics-lab/contracts";
import { CapacitorDiagram } from "./CapacitorDiagram";
import { MechanicalEnergyDiagram } from "./MechanicalEnergyDiagram";
import { SpringDiagram } from "./SpringDiagram";
import { ForceCompositionDiagram } from "./ForceCompositionDiagram";
import { PendulumDiagram } from './flagship/PendulumDiagram';
import { ExpandedDiagram2D } from './expanded/ExpandedDiagram2D';
import { isExpandedExperiment } from './expanded/expandedGeometry';

export interface ExperimentSceneProps {
  experimentId: HighSchoolExperimentId;
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  trajectory: Array<{ x: number; y: number }>;
  onParametersChange?: (patch: Record<string, number>) => void;
  capacitorMode?: CapacitorMode;
  onCapacitorModeChange?: (mode: CapacitorMode) => void;
  capacitorSwitchDisabled?: boolean;
}

export function ExperimentDiagram2D({ experimentId, parameters: p, simulation, trajectory, onParametersChange, capacitorMode, onCapacitorModeChange, capacitorSwitchDisabled }: ExperimentSceneProps) {
  const titleId = useId();
  const markerId = useId().replace(/:/g, "");
  const gradientId = useId().replace(/:/g, "");
  const s = simulation.state;
  const extent = positionExtent(simulation);
  const cartX = 90 + (s.position - extent.low) / (extent.high - extent.low) * 460;
  const fraction = p.travelDistance ? (s.position ?? 0) / p.travelDistance : 0;
  const projectileXMax = Math.max(1, ...trajectory.map((point) => point.x));
  const projectileYMax = Math.max(1, ...trajectory.map((point) => point.y));
  const px = (x: number) => 80 + x / projectileXMax * 540;
  const py = (y: number) => 306 - y / projectileYMax * 220;
  const intensity = simulation.series.find((series) => series.key === "intensity")?.points ?? [];
  const intensityGradient = useMemo(() => experimentId === "double-slit" && <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1={doubleSlitScreenY(-20)} x2="0" y2={doubleSlitScreenY(20)}>{intensity.map((point, index) => <stop key={index} offset={doubleSlitScreenFraction(point.x)} stopColor="#bd6436" stopOpacity={.06 + Math.max(0, Math.min(1, point.y)) * .94} />)}</linearGradient>, [experimentId, gradientId, intensity]);
  if (isExpandedExperiment(experimentId)) return <ExpandedDiagram2D experimentId={experimentId} parameters={p} simulation={simulation} onChange={onParametersChange} />;
  if (experimentId === "capacitor-charge") return <CapacitorDiagram parameters={p} simulation={simulation} mode={capacitorMode ?? simulation.capacitor?.mode ?? "open"} onModeChange={onCapacitorModeChange} switchDisabled={capacitorSwitchDisabled} />;
  if (experimentId === "pendulum") return <PendulumDiagram parameters={p} simulation={simulation} onChange={onParametersChange} />;
  if (experimentId === "force-composition") return <ForceCompositionDiagram parameters={p} simulation={simulation} onChange={onParametersChange} />;
  return <svg className="hs-diagram" viewBox="0 0 700 380" role="img" aria-labelledby={titleId}><title id={titleId}>{sceneDescriptions[experimentId]}</title><defs><marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3 0 6" fill="#bb6236" /></marker>{intensityGradient}</defs>
    <g stroke="#d7ddce" strokeWidth="1">{Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${50 + index * 55} 40V330`} />)}{Array.from({ length: 6 }, (_, index) => <path key={index} d={`M50 ${55 + index * 55}H655`} />)}</g>
    {experimentId === "mechanical-energy" && <MechanicalEnergyDiagram parameters={p} simulation={simulation} />}
    {experimentId === "spring-force" && <SpringDiagram naturalLength={s.naturalLength} length={s.length} force={s.force} loadMassGrams={p.loadMassGrams} />}
    {experimentId === "uniform-acceleration" && <g><path d="M60 270H650" stroke="#425f4b" strokeWidth="3" />{Array.from({ length: 11 }, (_, index) => <g key={index}><path d={`M${90 + index * 46} 270v12`} stroke="#6c7e68" /><text x={90 + index * 46} y="302" textAnchor="middle">{formatMeasurement(extent.low + (extent.high - extent.low) * index / 10, 1)}</text></g>)}<text x="635" y="325">x / m</text><g transform={`translate(${cartX} 232)`}><rect x="-30" y="-12" width="60" height="31" rx="5" fill="#496c53" /><rect x="-17" y="-22" width="34" height="10" fill="#aebc9e" /><circle cx="-19" cy="27" r="10" fill="#273f32" /><circle cx="19" cy="27" r="10" fill="#273f32" /><path d={`M0 -42h${Math.max(-80, Math.min(80, s.velocity * 10))}`} stroke="#bb6236" strokeWidth="2" markerEnd={`url(#${markerId})`} /></g><text x="66" y="65" className="hs-diagram-label">正方向 →</text><text x="350" y="115" textAnchor="middle" className="hs-diagram-value">v = {formatMeasurement(s.velocity)} m/s</text></g>}
    {experimentId === "newton-second-law" && <g><path d="M65 202H575M130 202V320M505 202V320" stroke="#69806c" strokeWidth="6" /><rect x={190 + fraction * 80} y="159" width="66" height="28" rx="4" fill="#496c53" /><circle cx={203 + fraction * 80} cy="193" r="9" fill="#273f32" /><circle cx={242 + fraction * 80} cy="193" r="9" fill="#273f32" /><circle cx="580" cy="178" r="15" stroke="#405d49" strokeWidth="5" fill="#f2eee2" /><path d={`M${256 + fraction * 80} 164H581Q595 164 595 178V${232 + fraction * 80}`} stroke="#bd683b" fill="none" strokeWidth="2" /><rect x="581" y={232 + fraction * 80} width="28" height="36" rx="3" fill="#ad643b" /><text x={223 + fraction * 80} y="141" textAnchor="middle">M = {formatMeasurement(p.cartMass)} kg</text><text x="630" y={254 + fraction * 80} textAnchor="middle">m</text><text x="350" y="80" textAnchor="middle" className="hs-diagram-value">a = {formatMeasurement(s.acceleration)} m/s²</text><text x="350" y="348" textAnchor="middle">小车与挂码作为一个系统分析</text></g>}
    {experimentId === "projectile-motion" && <g><path d="M65 306H650M80 320V55" stroke="#6b7d67" strokeWidth="2" /><path d={trajectory.map((point, index) => `${index ? "L" : "M"}${px(point.x)},${py(point.y)}`).join(" ")} stroke="#a8b49c" strokeDasharray="5 5" strokeWidth="2" fill="none" /><path d={`M${px(s.x)} ${py(s.y)}H${px(s.x) + Math.min(65, s.vx * 4)}M${px(s.x)} ${py(s.y)}v${Math.max(-65, Math.min(65, -s.vy * 4))}`} stroke="#bd6638" strokeWidth="2" fill="none" markerEnd={`url(#${markerId})`} /><circle cx={px(s.x)} cy={py(s.y)} r="10" fill="#b56437" stroke="#fbf8ee" strokeWidth="3" /><text x="640" y="335" textAnchor="end">水平位移 x / m</text><text x="80" y="40">高度 y / m</text><text x="88" y="327">0</text><text x="620" y="327" textAnchor="middle">{formatMeasurement(projectileXMax, 1)}</text><text x="67" y="90" textAnchor="end">{formatMeasurement(projectileYMax, 1)}</text><text x="340" y="365" textAnchor="middle">铜色箭头表示速度分量；水平、竖直方向分别缩放</text></g>}
    {experimentId === "emf-internal-resistance" && <g fill="none" stroke="#4e6c56" strokeWidth="2.5"><path d="M165 110H270m13 0h252v175H165V110" /><path d="M270 86v48m13-36v23" stroke="#b46138" strokeWidth="4" /><rect x="340" y="99" width="52" height="22" fill="#e4d8c2" /><rect x="312" y="271" width="70" height="28" fill="#e8e6d5" /><circle cx="165" cy="200" r="24" fill="#f7f4ea" /><circle cx="350" cy="200" r="24" fill="#f7f4ea" /><path d="M165 110V150H326V200M535 110V150H374V200" stroke="#7a936b" /><text x="165" y="206" textAnchor="middle" fill="#31513b" stroke="none" fontSize="18">A</text><text x="350" y="206" textAnchor="middle" fill="#31513b" stroke="none" fontSize="18">V</text><text x="278" y="65" textAnchor="middle" stroke="none">E = {formatMeasurement(s.emf)} V</text><text x="365" y="85" textAnchor="middle" stroke="none">r = {formatMeasurement(p.internalResistance)} Ω</text><text x="347" y="325" textAnchor="middle" stroke="none">R = {formatMeasurement(p.loadResistance)} Ω</text><text x="104" y="249" textAnchor="middle" stroke="none">{formatMeasurement(s.current)} A</text><text x="350" y="246" textAnchor="middle" stroke="none">{formatMeasurement(s.terminalVoltage)} V</text><text x="350" y="366" textAnchor="middle" stroke="none">电源内部压降与端电压分开读取</text></g>}
    {experimentId === "double-slit" && <g><path d="M93 189L220 155L425 190L220 224Z" fill="#d8834a" fillOpacity=".08" stroke="#c68251" strokeWidth="1" /><path d="M220 155L425 230M220 224L425 150" stroke="#c68251" strokeDasharray="4 3" /><rect x="66" y="176" width="44" height="27" rx="3" fill="#49694d" /><path d="M220 70v80m0 10v59m0 10v80" stroke="#738068" strokeWidth="7" /><path d="M425 65V315" stroke="#61705a" strokeWidth="4" /><text x="88" y="244" textAnchor="middle">相干光源</text><text x="220" y="336" textAnchor="middle">双缝</text><text x="425" y="336" textAnchor="middle">观察屏</text><text x="565" y="48" textAnchor="middle">屏上光强分布</text><rect x={DOUBLE_SLIT_SCREEN_2D.left} y={DOUBLE_SLIT_SCREEN_2D.top} width={DOUBLE_SLIT_SCREEN_2D.width} height={DOUBLE_SLIT_SCREEN_2D.height} fill={`url(#${gradientId})`} /><path d={`M480 ${doubleSlitScreenY(p.screenPositionMm)}H630`} stroke="#183b2a" strokeWidth="1.5" /><text x="640" y={doubleSlitScreenY(p.screenPositionMm) + 5}>{formatMeasurement(p.screenPositionMm, 1)}</text><text x="565" y="337" textAnchor="middle">−20 至 20 mm</text><text x="350" y="368" textAnchor="middle">装置尺寸示意放大；条纹位置按模型显示</text></g>}
  </svg>;
}
