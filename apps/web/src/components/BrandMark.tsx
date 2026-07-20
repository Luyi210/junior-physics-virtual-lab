import { Atom } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="格物实验室">
      <span className="brand-symbol"><Atom size={21} strokeWidth={1.8} /></span>
      {!compact && (
        <span className="brand-words">
          <strong>格物实验室</strong>
          <small>PHYSICS LAB · V2</small>
        </span>
      )}
    </div>
  );
}
