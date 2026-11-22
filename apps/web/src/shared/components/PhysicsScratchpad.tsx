import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Eraser, Grid, PenTool, SendHorizontal } from "lucide-react";

type ToolMode = "pen" | "arrow";
type Point = { x: number; y: number };
type Stroke = { kind: ToolMode; color: string; points: Point[] };

const COLORS = [
  { id: "amber", value: "#d97706", label: "橙色（光线/主路径）" },
  { id: "blue", value: "#2563eb", label: "蓝色（受力/速度矢量）" },
  { id: "emerald", value: "#059669", label: "绿色（辅助线/法线）" },
  { id: "rose", value: "#e11d48", label: "红色（标注重点）" }
];

export function PhysicsScratchpad({
  tone = "warm",
  disabled = false,
  onSendSummary
}: {
  tone?: "warm" | "cosmic";
  disabled?: boolean;
  onSendSummary: (summary: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ToolMode>("arrow");
  const [color, setColor] = useState(COLORS[1]!.value);
  const [showGrid, setShowGrid] = useState(true);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const redraw = (list: Stroke[], preview?: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showGrid) {
      ctx.strokeStyle = tone === "cosmic" ? "rgba(148, 163, 184, 0.14)" : "rgba(180, 130, 80, 0.14)";
      ctx.lineWidth = 1;
      for (let x = 20; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 20; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    const drawItem = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.kind === "pen") {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
        for (let i = 1; i < stroke.points.length; i += 1) {
          ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
        }
        ctx.stroke();
      } else {
        const start = stroke.points[0]!;
        const end = stroke.points[stroke.points.length - 1]!;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 9;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    };

    for (const s of list) drawItem(s);
    if (preview) drawItem(preview);
  };

  useEffect(() => {
    redraw(strokes);
  }, [strokes, showGrid, tone]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pt = getPoint(event);
    activeStrokeRef.current = { kind: tool, color, points: [pt, pt] };
    redraw(strokes, activeStrokeRef.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    const pt = getPoint(event);
    if (activeStrokeRef.current.kind === "pen") {
      activeStrokeRef.current.points.push(pt);
    } else {
      activeStrokeRef.current.points = [activeStrokeRef.current.points[0]!, pt];
    }
    redraw(strokes, activeStrokeRef.current);
  };

  const handlePointerUp = () => {
    if (!activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const arrowCount = strokes.filter((s) => s.kind === "arrow").length;
  const penCount = strokes.filter((s) => s.kind === "pen").length;

  const sendToAssistant = () => {
    const summary = `我在物理草图白板上画了 ${arrowCount} 条箭头和 ${penCount} 笔轨迹。你看不到草图的具体方向和位置，不能判断我画得对不对；请结合当前实验，指出两处常见画法错误，并告诉我怎样用实验台自行核对。`;
    onSendSummary(summary);
  };

  return (
    <div className={`physics-scratchpad tone-${tone}`} aria-label="物理互动草图白板">
      <div className="scratchpad-toolbar">
        <div className="scratchpad-tools">
          <button
            type="button"
            className={tool === "arrow" ? "active" : ""}
            onClick={() => setTool("arrow")}
            title="绘制力/光线矢量箭头"
          >
            <ArrowUpRight size={13} aria-hidden="true" />
            <span>矢量箭头</span>
          </button>
          <button
            type="button"
            className={tool === "pen" ? "active" : ""}
            onClick={() => setTool("pen")}
            title="自由画笔"
          >
            <PenTool size={13} aria-hidden="true" />
            <span>画笔</span>
          </button>
          <button
            type="button"
            className={showGrid ? "active" : ""}
            onClick={() => setShowGrid((v) => !v)}
            title="切换坐标网格"
          >
            <Grid size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
            title="清空草图"
          >
            <Eraser size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="scratchpad-colors" role="group" aria-label="画笔颜色">
          {COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`scratchpad-swatch${color === item.value ? " active" : ""}`}
              style={{ backgroundColor: item.value }}
              aria-label={item.label}
              onClick={() => setColor(item.value)}
            />
          ))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={340}
        height={160}
        className="scratchpad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="scratchpad-footer">
        <span>已画 {arrowCount} 条矢量 · {penCount} 笔草图</span>
        <button
          type="button"
          className="scratchpad-send"
          disabled={disabled || strokes.length === 0}
          onClick={sendToAssistant}
        >
          <SendHorizontal size={12} aria-hidden="true" />
          <span>询问常见画法错误</span>
        </button>
      </div>
    </div>
  );
}
