import { Users, Waves, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

type MetricCardProps = { icon: typeof Users; code: string; value: string; label: string; note: string; tone: string };

export function MetricCard({ icon: Icon, code, value, label, note, tone }: MetricCardProps) {
  return <article className={`teacher-metric-card tone-${tone}`}><header><span>{code}</span><Icon size={17} /></header><div><strong>{value}</strong><span>{label}</span></div><p>{note}</p></article>;
}

export function PanelHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: typeof Users }) {
  return <header className="teacher-panel-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><i><Icon size={18} /></i></header>;
}

export function EmptyState({ title, text, action, to }: { title: string; text: string; action?: string; to?: string }) {
  return <div className="teacher-empty"><Waves size={30} /><strong>{title}</strong><p>{text}</p>{action && to && <Link to={to}>{action} <ArrowRight size={14} /></Link>}</div>;
}
