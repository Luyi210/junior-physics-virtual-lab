import { calculateProjectileMotion, calculateSpringForce } from "@physics-lab/physics/high-school";
import { formatQuantity } from "./problemVisualization";

type ProjectileState = ReturnType<typeof calculateProjectileMotion>;
type SpringState = ReturnType<typeof calculateSpringForce>;

export function ProjectileScene({ parameters, state }: { parameters: Record<string, number>; state: ProjectileState }) {
  const initial = calculateProjectileMotion({
    initialSpeed: parameters.initialSpeed!, angleDegrees: parameters.angleDegrees!, initialHeight: parameters.initialHeight!
  }, 0);
  const width = Math.max(2, initial.range * 1.12);
  const height = Math.max(2, initial.maximumHeight * 1.22);
  const mapX = (x: number) => 80 + x / width * 590;
  const mapY = (y: number) => 336 - y / height * 265;
  const trajectory = Array.from({ length: 61 }, (_, index) => {
    const sample = calculateProjectileMotion({
      initialSpeed: parameters.initialSpeed!, angleDegrees: parameters.angleDegrees!, initialHeight: parameters.initialHeight!
    }, initial.flightTime * index / 60);
    return `${index ? "L" : "M"}${mapX(sample.x).toFixed(1)} ${mapY(sample.y).toFixed(1)}`;
  }).join(" ");
  const ballX = mapX(state.x);
  const ballY = mapY(state.y);
  const launchY = mapY(parameters.initialHeight!);
  return <svg className="hs-problem-svg" viewBox="0 0 760 410" role="img" aria-label={`抛体轨迹：当前水平位移 ${formatQuantity(state.x)} 米，离地高度 ${formatQuantity(state.y)} 米`}>
    <defs><pattern id="problem-grid-projectile" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#31516b" strokeWidth=".8" opacity=".45" /></pattern><linearGradient id="problem-path-gradient" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#71e5ff" /><stop offset="1" stopColor="#e8b686" /></linearGradient><filter id="problem-ball-glow"><feGaussianBlur stdDeviation="8" /></filter></defs>
    <rect width="760" height="410" fill="url(#problem-grid-projectile)" />
    <text x="30" y="30" className="hs-problem-svg-caption">TRAJECTORY / XY PLANE</text>
    <path d="M42 336H720" className="hs-problem-axis" /><path d="M80 360V54" className="hs-problem-axis" />
    <text x="707" y="355" className="hs-problem-svg-label">x / m</text><text x="91" y="60" className="hs-problem-svg-label">y / m</text>
    <path d={`M52 ${launchY} H80 V336 H52 Z`} fill="#29516a" stroke="#78bad0" strokeWidth="1.5" />
    <path d={trajectory} fill="none" stroke="#397a92" strokeWidth="2" strokeDasharray="5 8" />
    <path d={trajectory} fill="none" stroke="url(#problem-path-gradient)" strokeWidth="2" className="hs-problem-path-flow" opacity=".6" />
    <line x1={ballX} y1={ballY} x2={ballX} y2="336" stroke="#7abed3" strokeDasharray="5 5" opacity=".8" />
    <circle cx={ballX} cy={ballY} r="20" fill="#74eaff" opacity=".26" filter="url(#problem-ball-glow)" />
    <circle cx={ballX} cy={ballY} r="8" fill="#f3c295" stroke="#fff3da" strokeWidth="2" className="hs-problem-ball" />
    <circle cx={mapX(initial.range)} cy="336" r="4" fill="#f3c295" />
    <text x={Math.max(88, Math.min(590, ballX + 15))} y={Math.max(83, ballY - 13)} className="hs-problem-svg-value">({formatQuantity(state.x)}, {formatQuantity(state.y)}) m</text>
    <text x="92" y={Math.max(81, launchY - 12)} className="hs-problem-svg-label">h₀ = {formatQuantity(parameters.initialHeight!)} m</text>
    <text x="540" y="381" className="hs-problem-svg-label">落点 R = {formatQuantity(initial.range)} m</text>
  </svg>;
}

export function SpringScene({ state, parameters }: { state: SpringState; parameters: Record<string, number> }) {
  const natural = parameters.naturalLength!;
  const total = state.length;
  const top = 74;
  const sceneScale = Math.min(900, 230 / Math.max(total, .25));
  const naturalEnd = top + natural * sceneScale;
  const end = top + total * sceneScale;
  const turns = 11;
  const springPath = Array.from({ length: turns * 2 + 1 }, (_, index) => {
    const x = index === 0 || index === turns * 2 ? 235 : (index % 2 ? 208 : 262);
    const y = top + 19 + (end - top - 42) * index / (turns * 2);
    return `${index ? "L" : "M"}${x} ${y.toFixed(1)}`;
  }).join(" ");
  const graphLeft = 430;
  const graphBottom = 320;
  const graphX = graphLeft + state.extension / .25 * 230;
  const graphY = graphBottom - state.force / 2.5 * 225;
  return <svg className="hs-problem-svg" viewBox="0 0 760 410" role="img" aria-label={`弹簧静态平衡：弹力 ${formatQuantity(state.force)} 牛，伸长 ${formatQuantity(state.extension * 100)} 厘米`}>
    <defs><pattern id="problem-grid-spring" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#31516b" strokeWidth=".8" opacity=".45" /></pattern><linearGradient id="problem-spring-gradient" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#80ecff" /><stop offset="1" stopColor="#e8b686" /></linearGradient></defs>
    <rect width="760" height="410" fill="url(#problem-grid-spring)" />
    <text x="30" y="30" className="hs-problem-svg-caption">STATIC EQUILIBRIUM / F–ΔL</text>
    <path d="M150 65H320M235 65V86" stroke="#aac9d4" strokeWidth="4" />
    <path d={springPath} fill="none" stroke="url(#problem-spring-gradient)" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round" />
    <path d={`M235 ${end - 10}V${end + 10}`} stroke="#e9c299" strokeWidth="3" />
    <rect x="207" y={end + 10} width="56" height="48" rx="8" fill="#d1a876" stroke="#fce0b5" strokeWidth="1.5" />
    <text x="235" y={end + 39} textAnchor="middle" className="hs-problem-svg-mass">m</text>
    <path d={`M300 ${top}h16M300 ${naturalEnd}h16M308 ${top}V${naturalEnd}`} className="hs-problem-measure" />
    <path d={`M337 ${naturalEnd}h16M337 ${end}h16M345 ${naturalEnd}V${end}`} className="hs-problem-measure accent" />
    <text x="289" y="60" className="hs-problem-svg-label">L₀</text><text x="354" y={Math.max(100, naturalEnd + 20)} className="hs-problem-svg-label">ΔL</text>
    <path d={`M${graphLeft} ${graphBottom}H690M${graphLeft} ${graphBottom}V70`} className="hs-problem-axis" />
    <path d={`M${graphLeft} ${graphBottom}L660 95`} stroke="#4da8c1" strokeWidth="2.5" />
    <circle cx={graphX} cy={graphY} r="7" fill="#f2c293" stroke="#fff0d6" strokeWidth="2" />
    <path d={`M${graphX} ${graphY}V${graphBottom}M${graphLeft} ${graphY}H${graphX}`} stroke="#75dbea" strokeDasharray="5 5" />
    <text x="644" y="347" className="hs-problem-svg-label">ΔL / m</text><text x="441" y="82" className="hs-problem-svg-label">F / N</text>
    <text x="480" y="382" className="hs-problem-svg-value">F = {formatQuantity(state.force)} N · ΔL = {formatQuantity(state.extension * 100)} cm</text>
  </svg>;
}
