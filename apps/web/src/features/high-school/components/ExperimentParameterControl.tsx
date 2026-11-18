import { useEffect, useId, useRef, useState } from 'react';
import type { HighSchoolExperimentDefinition } from '@physics-lab/physics';
import { commitParameterDraft } from '../experiments/parameterInput';
import './ExperimentParameterControl.css';

type Parameter = HighSchoolExperimentDefinition['parameters'][number];

export function ExperimentParameterControl({ parameter, value, onChange }: { parameter: Parameter; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submittedValue = useRef<number | null>(null);
  const messageId = useId();
  useEffect(() => {
    setDraft(String(value));
    if (submittedValue.current !== value) { setNotice(''); setInvalid(false); }
    submittedValue.current = null;
  }, [value]);
  function commit() {
    const result = commitParameterDraft(draft, parameter.min, parameter.max);
    if (!result) {
      setInvalid(true);
      setNotice('请输入完整的有限数值；已保留原来的条件。');
      return;
    }
    if (parameter.integral && !Number.isInteger(result.value)) {
      setInvalid(true); setNotice('此项必须是整数；已保留原来的条件。'); return;
    }
    setInvalid(false); setDraft(String(result.value));
    setNotice(result.clamped ? `可用范围为 ${parameter.min} 至 ${parameter.max} ${parameter.unit}，已调整到范围内。` : '');
    submittedValue.current = result.value;
    if (result.value !== value) onChange(result.value);
  }
  if (parameter.choices) return <div className="hs-parameter">
    <label htmlFor={`hs-range-${parameter.key}`}>{parameter.label}<span>{parameter.unit}</span></label>
    <select id={`hs-range-${parameter.key}`} className="hs-parameter-choice" value={value}
      onChange={(event) => { const next = Number(event.target.value); if (parameter.choices?.some((choice) => choice.value === next)) onChange(next); }}>
      {parameter.choices.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
    </select>
  </div>;
  return <div className="hs-parameter">
    <label htmlFor={`hs-range-${parameter.key}`}>{parameter.label}<span>{parameter.unit}</span></label>
    <div className="hs-parameter-inputs">
      <input id={`hs-range-${parameter.key}`} type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={value} onChange={(event) => { const next = Number(event.target.value); setDraft(String(next)); setNotice(''); setInvalid(false); onChange(next); }} />
      <input className="hs-parameter-number" type="text" inputMode={parameter.min < 0 ? "text" : parameter.integral ? "numeric" : "decimal"} enterKeyHint="done" autoComplete="off" spellCheck={false}
        aria-label={`${parameter.label}数值，单位${parameter.unit || '无'}`} aria-invalid={invalid || undefined} aria-describedby={messageId}
        value={draft} onChange={(event) => { setDraft(event.target.value); setNotice(''); setInvalid(false); }} onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(String(value)); setNotice(''); setInvalid(false); }
        }} />
    </div>
    <div className="hs-range-bounds"><span>{parameter.min}</span><span>{parameter.max}</span></div>
    <p id={messageId} className={`hs-parameter-edit-note${invalid ? ' is-invalid' : ''}`} aria-live="polite">{notice || '数字输入后按 Enter 或移开焦点生效'}</p>
  </div>;
}
