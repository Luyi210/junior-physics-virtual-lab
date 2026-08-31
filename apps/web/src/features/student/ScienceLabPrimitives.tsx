import type { ReactNode } from "react";
import { CheckCircle2, Compass, Info, Pause, Play } from "lucide-react";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import { useHarnessStore } from "../harness/harnessStore";

type ScienceFieldKey = "sound" | "mechanics" | "circuit" | "thermal" | "measurement";

export function LabFrame({ field, eyebrow, title, description, running, onToggle, playLabel = "启动动态", runningLabel = "暂停", actionDisabled = false, disabledLabel = "先选择样品", children }: {
  field: ScienceFieldKey;
  experiment: string;
  eyebrow: string;
  title: string;
  description: string;
  running: boolean;
  onToggle: () => void;
  playLabel?: string;
  runningLabel?: string;
  actionDisabled?: boolean;
  disabledLabel?: string;
  children: ReactNode;
}) {
  const recordHarness = useHarnessStore((state) => state.record);
  const toggle = () => {
    onToggle();
    recordHarness("simulation.toggled", { running: !running, action: playLabel });
  };
  return <div className="science-lab"><header><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><PhysicsFieldMotif field={field} className="science-lab-physics" /><div className="science-lab-header-actions"><button className={running ? "running" : ""} onClick={toggle} disabled={actionDisabled}>{running ? <Pause size={16} /> : <Play size={16} />}{actionDisabled ? disabledLabel : running ? runningLabel : playLabel}</button></div></header>{children}</div>;
}

export function ScienceRange({ label, value, min, max, step, unit, onChange, onInteract }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  onInteract?: () => void;
}) {
  const recordHarness = useHarnessStore((state) => state.record);
  const fractionDigits = step >= 1 ? 0 : Math.min(3, Math.max(1, (step.toString().split(".")[1] ?? "").length));
  const formattedValue = value.toLocaleString("zh-CN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  const change = (next: number) => {
    onChange(next);
    onInteract?.();
    recordHarness("control.changed", { control: label, value: next, unit });
  };
  return <label className="science-range"><span>{label}<output>{formattedValue} {unit}</output></span><input type="range" min={min} max={max} step={step} value={value} aria-label={`${label}，当前 ${formattedValue} ${unit}`} onChange={(event) => change(Number(event.target.value))} /></label>;
}

export function ResultCell({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return <div className={`science-result-cell ${pending ? "awaiting-reading" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function InteractionCue({ text }: { text: string }) {
  return <div className="interaction-cue" role="status" aria-live="polite"><Compass size={18} aria-hidden="true" /><span><small>装置等待你的操作</small><strong>{text}</strong></span></div>;
}

export function EvidenceVerdict({ valid, title, detail }: { valid: boolean; title: string; detail: string }) {
  return <div className={`evidence-verdict ${valid ? "valid" : "warning"}`} role="status" aria-live="polite">{valid ? <CheckCircle2 size={19} aria-hidden="true" /> : <Info size={19} aria-hidden="true" />}<span><small>{valid ? "CONTROLLED EVIDENCE / 有效证据" : "COMPARISON CHECK / 对照检查"}</small><strong>{title}</strong><em>{detail}</em></span></div>;
}

export function FactorEvidenceStatus({ className, items }: { className: string; items: Array<{ label: string; note?: string; done: boolean }> }) {
  return <div className={className} role="status" aria-live="polite">{items.map((item, index) => <span className={item.done ? "done" : ""} key={item.label}>{item.done ? <CheckCircle2 size={14} aria-hidden="true" /> : <b>{index + 1}</b>}{item.label}{item.note && <small>{item.note}</small>}</span>).flatMap((item, index, all) => index < all.length - 1 ? [item, <i aria-hidden="true" key={`connector-${index}`} />] : [item])}</div>;
}
