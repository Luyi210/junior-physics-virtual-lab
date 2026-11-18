import { formatMeasurement } from '../experiments/workbench';
import { SPRING_SCENE, springSceneGeometry } from './springSceneGeometry';

/** Coordinates and all three length markers use the same calibrated ruler. */
export function SpringDiagram({ naturalLength, length, force, loadMassGrams }: { naturalLength: number; length: number; force: number; loadMassGrams: number }) {
  const scene = springSceneGeometry(naturalLength, length);
  return <g>
    <path d="M170 335V43H310M125 335H375" fill="none" stroke="#60745d" strokeWidth="8" strokeLinejoin="round" />
    <path d={`M${SPRING_SCENE.svgX} 43V${scene.svgTop}`} stroke="#465f47" strokeWidth="3" />
    <rect x="369" y="45" width="43" height="263" rx="3" fill="#ece5d1" stroke="#a0aa91" />
    {scene.ticks.map((tick) => <g key={tick.centimetres}><path d={`M370 ${tick.svgY}h${tick.major ? 14 : 7}`} stroke="#61745a" /><text x="390" y={tick.svgY + 4} fontSize="10">{tick.major ? tick.centimetres : ''}</text></g>)}
    <text x="391" y="326" textAnchor="middle">cm</text>
    <path d={scene.svgCoilPath} fill="none" stroke="#4b6951" strokeWidth="3" strokeLinecap="round" />
    <path data-spring-natural-marker="true" d={`M225 ${scene.svgNaturalEnd}H368`} stroke="#87967a" strokeDasharray="5 4" />
    <path data-spring-length-marker="true" d={`M290 ${scene.svgEnd}H368`} stroke="#b56536" strokeWidth="2" />
    <path d={`M235 ${scene.svgTop}h-10v${scene.svgNaturalEnd - scene.svgTop}h10`} fill="none" stroke="#778b70" />
    <text x="211" y={(scene.svgTop + scene.svgNaturalEnd) / 2} textAnchor="end">L₀</text>
    {length > naturalLength && <><path d={`M425 ${scene.svgNaturalEnd}h10v${scene.svgEnd - scene.svgNaturalEnd}h-10`} fill="none" stroke="#b56536" strokeWidth="2" /><text x="448" y={(scene.svgNaturalEnd + scene.svgEnd) / 2 + 4}>x</text></>}
    {loadMassGrams > 0 && <g><path d={`M290 ${scene.svgEnd}v9`} stroke="#3f5946" strokeWidth="2" /><rect x="267" y={scene.svgEnd + 9} width="46" height="30" rx="4" fill="#b66a3e" stroke="#8f4c2b" /><path d={`M272 ${scene.svgEnd + 17}h36M272 ${scene.svgEnd + 29}h36`} stroke="#e4b18a" /><text x="251" y={scene.svgEnd + 30} textAnchor="end">{formatMeasurement(loadMassGrams)} g</text></g>}
    <text x="485" y="63" className="hs-diagram-value">F = {formatMeasurement(force)} N</text>
    <text x="485" y="86">原长 {formatMeasurement(naturalLength * 100)} cm</text>
    <text x="485" y="108">总长 {formatMeasurement(length * 100)} cm</text>
    <text x="350" y="366" textAnchor="middle">{loadMassGrams === 0 ? '未加载：弹簧恢复原长。' : '静态平衡，载荷质量包含托盘。'}刻度尺与长度标记使用同一比例。</text>
  </g>;
}
