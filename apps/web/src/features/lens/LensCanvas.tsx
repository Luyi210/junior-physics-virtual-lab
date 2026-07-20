import { useEffect, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { Pause, Play } from "lucide-react";
import type { LensResult } from "@physics-lab/physics";
import type { LensSceneState } from "./lensStore";
import { useLensStore } from "./lensStore";
import { useElementSize } from "./useElementSize";

const WORLD = { minX: -80, maxX: 100, minY: -30, maxY: 34 };

interface LensCanvasProps {
  scene: LensSceneState;
  result: LensResult;
  onInteract?: () => void;
  revealResult?: boolean;
}

export function LensCanvas({ scene, result, onInteract, revealResult = true }: LensCanvasProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const preview = useLensStore((state) => state.preview);
  const remember = useLensStore((state) => state.remember);
  const dragStart = useRef<LensSceneState | null>(null);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      if (now - previous > 32) {
        setPhase((value) => (value + (now - previous) / 2600) % 1);
        previous = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const width = Math.max(540, size.width);
  const height = Math.max(420, size.height);
  const padding = { x: 36, y: 30 };
  const scaleX = (width - padding.x * 2) / (WORLD.maxX - WORLD.minX);
  const scaleY = (height - padding.y * 2) / (WORLD.maxY - WORLD.minY);
  const scale = Math.min(scaleX, scaleY);
  const drawWidth = (WORLD.maxX - WORLD.minX) * scale;
  const drawHeight = (WORLD.maxY - WORLD.minY) * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  const sx = (x: number) => offsetX + (x - WORLD.minX) * scale;
  const sy = (y: number) => offsetY + (WORLD.maxY - y) * scale;
  const wx = (x: number) => (x - offsetX) / scale + WORLD.minX;
  const axisY = sy(0);
  const lensX = sx(scene.lensX);
  const objectX = sx(scene.objectX);
  const objectTop = sy(scene.objectHeight);
  const screenX = sx(scene.screenX);
  const imageVisible = result.finite && result.imageX >= WORLD.minX && result.imageX <= WORLD.maxX;
  const imageX = imageVisible ? sx(result.imageX) : 0;
  const imageY = imageVisible ? sy(result.imageHeight) : 0;
  const nearFocus = sx(scene.lensX - scene.focalLength);
  const farFocus = sx(scene.lensX + scene.focalLength);

  const beginDrag = () => { dragStart.current = scene; onInteract?.(); };
  const finishDrag = () => {
    if (dragStart.current) remember(dragStart.current);
    dragStart.current = null;
  };

  const gridLines = [];
  for (let x = -80; x <= 100; x += 10) {
    gridLines.push(
      <Line key={`gx-${x}`} points={[sx(x), sy(WORLD.maxY), sx(x), sy(WORLD.minY)]} stroke={x === 0 ? "#58727a" : "#193741"} strokeWidth={x === 0 ? 1.2 : 0.7} opacity={x === 0 ? 0.7 : 0.55} />
    );
  }
  for (let y = -30; y <= 30; y += 10) {
    gridLines.push(
      <Line key={`gy-${y}`} points={[sx(WORLD.minX), sy(y), sx(WORLD.maxX), sy(y)]} stroke="#193741" strokeWidth={0.7} opacity={0.5} />
    );
  }

  const rayEndX = sx(WORLD.maxX);
  const rayColor = "#66f2d5";
  const ghostColor = "#66f2d5";
  const rays = [];
  const photonPaths: number[][] = [];
  if (scene.showRays && revealResult) {
    if (result.finite && result.real && imageVisible) {
      photonPaths.push(
        [objectX, objectTop, lensX, objectTop, imageX, imageY],
        [objectX, objectTop, lensX, axisY, imageX, imageY],
        [objectX, objectTop, lensX, imageY, imageX, imageY]
      );
      rays.push(
        <Line key="r1a" points={[objectX, objectTop, lensX, objectTop, imageX, imageY]} stroke={rayColor} strokeWidth={2.2} shadowColor={rayColor} shadowBlur={7} lineCap="round" lineJoin="round" />,
        <Line key="r2" points={[objectX, objectTop, lensX, axisY, imageX, imageY]} stroke="#f2c96d" strokeWidth={2} opacity={0.95} lineCap="round" />,
        <Line key="r3" points={[objectX, objectTop, lensX, imageY, imageX, imageY]} stroke="#ff8f70" strokeWidth={2} opacity={0.92} lineCap="round" />
      );
    } else if (result.finite && !result.real && imageVisible) {
      const slopeToFarFocus = (axisY - objectTop) / (farFocus - lensX);
      const refractedEndY = objectTop + slopeToFarFocus * (rayEndX - lensX);
      const centerSlope = (axisY - objectTop) / (lensX - objectX);
      const centerEndY = axisY + centerSlope * (rayEndX - lensX);
      photonPaths.push(
        [objectX, objectTop, lensX, objectTop, rayEndX, refractedEndY],
        [objectX, objectTop, lensX, axisY, rayEndX, centerEndY]
      );
      rays.push(
        <Line key="vr1" points={[objectX, objectTop, lensX, objectTop, rayEndX, refractedEndY]} stroke={rayColor} strokeWidth={2.2} shadowColor={rayColor} shadowBlur={6} />,
        <Line key="vr1g" points={[lensX, objectTop, imageX, imageY]} stroke={ghostColor} strokeWidth={1.5} dash={[7, 6]} opacity={0.65} />,
        <Line key="vr2" points={[objectX, objectTop, lensX, axisY, rayEndX, centerEndY]} stroke="#f2c96d" strokeWidth={2} />,
        <Line key="vr2g" points={[lensX, axisY, imageX, imageY]} stroke="#f2c96d" strokeWidth={1.5} dash={[7, 6]} opacity={0.65} />
      );
    } else {
      photonPaths.push(
        [objectX, objectTop, lensX, objectTop, rayEndX, sy(-scene.objectHeight * 1.2)],
        [objectX, objectTop, lensX, axisY, rayEndX, axisY + (axisY - objectTop) * 1.5]
      );
      rays.push(
        <Line key="focus1" points={[objectX, objectTop, lensX, objectTop, rayEndX, sy(-scene.objectHeight * 1.2)]} stroke={rayColor} strokeWidth={2.1} />,
        <Line key="focus2" points={[objectX, objectTop, lensX, axisY, rayEndX, axisY + (axisY - objectTop) * 1.5]} stroke="#f2c96d" strokeWidth={2} />
      );
    }
  }

  return (
    <div className="lens-canvas-host" ref={ref}>
      <Stage width={width} height={height}>
        <Layer listening={false}>
          <Rect x={0} y={0} width={width} height={height} fill="#071c24" />
          {scene.showGrid && gridLines}
          <Line points={[sx(WORLD.minX), axisY, sx(WORLD.maxX), axisY]} stroke="#a9c3c8" strokeWidth={1.4} opacity={0.7} />
          {Array.from({ length: 19 }, (_, index) => -80 + index * 10).map((x) => (
            <Group key={x}>
              <Line points={[sx(x), axisY - 5, sx(x), axisY + 5]} stroke="#a9c3c8" strokeWidth={1} opacity={0.75} />
              <Text x={sx(x) - 14} y={axisY + 10} width={28} align="center" text={`${x}`} fontSize={10} fill="#6f949b" />
            </Group>
          ))}
          {[nearFocus, farFocus, sx(scene.lensX - scene.focalLength * 2), sx(scene.lensX + scene.focalLength * 2)].map((x, index) => (
            <Group key={index}>
              <Circle x={x} y={axisY} radius={3.5} fill={index < 2 ? "#f2c96d" : "#6f949b"} />
              {scene.showLabels && <Text x={x - 18} y={axisY + 24} width={36} align="center" text={index < 2 ? "F" : "2F"} fill={index < 2 ? "#f2c96d" : "#6f949b"} fontSize={12} fontStyle="bold" />}
            </Group>
          ))}
          {rays}
          {running && photonPaths.map((path, index) => {
            const point = pointOnPolyline(path, (phase + index * 0.23) % 1);
            const colors = ["#d6fff7", "#fff1a8", "#ffc1b0"];
            const color = colors[index % colors.length] ?? "#ffffff";
            return <Circle key={`photon-${index}`} x={point.x} y={point.y} radius={4.2} fill={color} shadowColor={color} shadowBlur={13} opacity={0.95} />;
          })}
          {revealResult && imageVisible && (
            <Group opacity={result.real ? 0.8 : 0.55}>
              <Arrow points={[imageX, axisY, imageX, imageY]} stroke={result.real ? "#ff8f70" : "#66f2d5"} fill={result.real ? "#ff8f70" : "#66f2d5"} strokeWidth={4} pointerLength={10} pointerWidth={9} dash={result.real ? [] : [6, 5]} />
              {scene.showLabels && <Text x={imageX - 34} y={result.imageHeight < 0 ? imageY + 10 : imageY - 25} width={68} align="center" text={result.real ? "实像" : "虚像"} fill={result.real ? "#ffb09b" : "#8cf8e1"} fontSize={12} />}
            </Group>
          )}
        </Layer>

        <Layer>
          <Group
            x={objectX}
            draggable
            dragBoundFunc={(position) => ({ x: Math.min(sx(scene.lensX - 6), Math.max(sx(-75), position.x)), y: 0 })}
            onDragStart={beginDrag}
            onDragMove={(event) => preview({ objectX: Math.round(wx(event.target.x()) * 10) / 10 })}
            onDragEnd={finishDrag}
          >
            <Circle x={0} y={axisY + 7} radius={12} fill="#102f38" stroke="#66f2d5" strokeWidth={1.4} shadowColor="#66f2d5" shadowBlur={8} />
            <Arrow points={[0, axisY, 0, objectTop]} stroke="#f4eee1" fill="#66f2d5" strokeWidth={5} pointerLength={11} pointerWidth={10} />
            {scene.showLabels && <Text x={-38} y={axisY + 24} width={76} align="center" text="发光物体 · 拖动" fill="#d8e7e8" fontSize={11} />}
          </Group>

          <Group x={lensX}>
            <Line points={[0, sy(25), -8, sy(18), -10, sy(0), -8, sy(-18), 0, sy(-25)]} stroke="#85d8ff" strokeWidth={3} tension={0.35} shadowColor="#60cfff" shadowBlur={12} closed={false} />
            <Line points={[0, sy(25), 8, sy(18), 10, sy(0), 8, sy(-18), 0, sy(-25)]} stroke="#85d8ff" strokeWidth={3} tension={0.35} shadowColor="#60cfff" shadowBlur={12} />
            {scene.showLabels && <Text x={-48} y={sy(27)} width={96} align="center" text="凸透镜" fill="#aee5ff" fontSize={12} fontStyle="bold" />}
          </Group>

          <Group
            x={screenX}
            draggable
            dragBoundFunc={(position) => ({ x: Math.min(sx(95), Math.max(sx(scene.lensX + 4), position.x)), y: 0 })}
            onDragStart={beginDrag}
            onDragMove={(event) => preview({ screenX: Math.round(wx(event.target.x()) * 10) / 10 })}
            onDragEnd={finishDrag}
          >
            <Rect x={-8} y={sy(22)} width={16} height={sy(-22) - sy(22)} fill={revealResult && result.screenFocused ? "#d9fff4" : "#dbe1d9"} opacity={revealResult && result.screenFocused ? 0.26 : 0.12} stroke={revealResult && result.screenFocused ? "#66f2d5" : "#8a9b99"} strokeWidth={2} shadowColor={revealResult && result.screenFocused ? "#66f2d5" : "#000"} shadowBlur={revealResult && result.screenFocused ? 22 : 4} />
            <Line points={[-18, sy(-23), 18, sy(-23)]} stroke="#9eb2b1" strokeWidth={2} />
            {scene.showLabels && <Text x={-42} y={sy(25)} width={84} align="center" text={revealResult && result.screenFocused ? "光屏 · 清晰" : "光屏 · 拖动"} fill={revealResult && result.screenFocused ? "#8cf8e1" : "#a9b8b6"} fontSize={11} />}
          </Group>
        </Layer>
      </Stage>
      <div className="canvas-scale-note">横向标尺 / cm　·　拖动物体与光屏</div>
      <button className="canvas-motion-toggle" onClick={() => { setRunning((value) => !value); onInteract?.(); }}>{running ? <Pause size={12} /> : <Play size={12} />}{running ? "暂停光子" : "继续运行"}</button>
    </div>
  );
}

function pointOnPolyline(points: number[], progress: number) {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; length: number }> = [];
  let total = 0;
  for (let index = 0; index < points.length - 2; index += 2) {
    const x1 = points[index]!;
    const y1 = points[index + 1]!;
    const x2 = points[index + 2]!;
    const y2 = points[index + 3]!;
    const length = Math.hypot(x2 - x1, y2 - y1);
    segments.push({ x1, y1, x2, y2, length });
    total += length;
  }
  let target = progress * total;
  for (const segment of segments) {
    if (target <= segment.length) {
      const ratio = segment.length === 0 ? 0 : target / segment.length;
      return { x: segment.x1 + (segment.x2 - segment.x1) * ratio, y: segment.y1 + (segment.y2 - segment.y1) * ratio };
    }
    target -= segment.length;
  }
  const last = segments.at(-1);
  return last ? { x: last.x2, y: last.y2 } : { x: 0, y: 0 };
}
