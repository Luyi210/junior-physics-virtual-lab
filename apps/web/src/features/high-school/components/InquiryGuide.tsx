import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { expandedProtocols } from '../experiments/expandedProtocols';
import './InquiryGuide.css';

export function InquiryGuide({ experimentId }: { experimentId: string }) {
  const protocol = expandedProtocols[experimentId];
  const [prediction, setPrediction] = useState('');
  if (!protocol) return null;
  return <section className="hs-inquiry-guide" aria-label="本实验探究任务">
    <header><span><BookOpen size={16} />本次探究</span><h2>{protocol.inquiryQuestion}</h2></header>
    <ol>{protocol.steps.map((step, index) => <li key={step}><b>{String(index + 1).padStart(2, '0')}</b><p>{step}</p></li>)}</ol>
    <details><summary>先写预测，再用记录检验<ChevronDown size={15} /></summary>
      <label htmlFor={`prediction-${experimentId}`}>{protocol.predictionPrompt}</label>
      <textarea id={`prediction-${experimentId}`} value={prediction} maxLength={1000} rows={3} onChange={(event) => setPrediction(event.target.value)} placeholder="我预测……因为……" />
      <small>此处为本页预测草稿，刷新后不保留。课堂任务请把预测填写并保存到课堂报告。</small>
      <p><strong>保持哪些条件：</strong>{protocol.controlledVariable}</p>
      <p><strong>留下哪些证据：</strong>{protocol.evidenceRequirement}</p>
    </details>
  </section>;
}
