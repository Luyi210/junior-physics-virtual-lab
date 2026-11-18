import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { formatMeasurement } from '../experiments/workbench';
import { mechanicalEnergyGeometry, MECHANICAL_ENERGY_GEOMETRY as G } from './mechanicalEnergyGeometry';

export function MechanicalEnergyDiagram({ parameters, simulation }: { parameters: Record<string, number>; simulation: HighSchoolSimulation }) {
  const s = simulation.state;
  const scene = mechanicalEnergyGeometry(parameters.dropHeight, s.position);
  const initialEnergy = s.potentialEnergy + s.potentialEnergyLoss;
  const energies = [{ key: 'potentialEnergy', label: '势能', color: '#4f7659' }, { key: 'kineticEnergy', label: '动能', color: '#bd6e3e' }, { key: 'dissipatedEnergy', label: '耗散', color: '#92987b' }];
  return <g>
    <path d="M135 330V59H280M100 330H393" fill="none" stroke="#6d8065" strokeWidth="7" />
    <path d={`M135 ${scene.svgReleaseY - 26}H270`} stroke="#849577" strokeWidth="5" />
    <rect x="220" y={scene.svgReleaseY - 28} width="40" height="10" rx="3" fill="#41614a" />
    <path d={`M210 ${scene.svgReleaseY}H360`} stroke="#70836a" strokeDasharray="4 4" />
    <text x="198" y={scene.svgReleaseY + 4} textAnchor="end">释放点</text>
    <rect x="330" y={scene.svgReleaseY - 7} width="46" height={scene.svgEndY - scene.svgReleaseY + 15} fill="#ece5d2" stroke="#a3ad96" />
    {scene.ticks.map((tick) => <g key={tick.distance}><path d={`M332 ${tick.svgY}h${tick.major ? 15 : 8}`} stroke="#5c7259" />{tick.major && <text x="351" y={tick.svgY + 4} fontSize="10">{formatMeasurement(tick.distance, 1)}</text>}</g>)}
    <text x="354" y={scene.svgReleaseY - 15} textAnchor="middle">下降 / m</text>
    <path d={`M${G.svgBallX} ${scene.svgReleaseY}V${scene.svgY}`} stroke="#d6c8aa" strokeWidth="10" />
    <circle data-mechanical-ball="true" cx={G.svgBallX} cy={scene.svgY} r={G.svgBallRadius} fill="#b86b3e" stroke="#7f492d" strokeWidth="2" />
    <path d={`M254 ${scene.svgY}H329`} stroke="#b56c40" strokeDasharray="3 3" />
    <text x="240" y="43" textAnchor="middle">重物与纸带位置示意</text>
    <text x="435" y="72">能量 / J · 共用初始能量刻度</text>
    {energies.map((energy, index) => { const value = s[energy.key]; const height = initialEnergy > 0 ? Math.max(0, Math.min(1, value / initialEnergy)) * 160 : 0; const x = 450 + index * 70; return <g key={energy.key}><rect x={x} y="106" width="35" height="160" fill="#e5e8db" /><rect x={x} y={266 - height} width="35" height={height} fill={energy.color} /><text x={x + 17.5} y="288" textAnchor="middle">{energy.label}</text><text x={x + 17.5} y="310" textAnchor="middle">{formatMeasurement(value, 2)}</text></g>; })}
    <text x="350" y="363" textAnchor="middle">固定长度比例；球心为位移参考。到达下端显示接触前读数，不模拟碰撞。</text>
  </g>;
}
