import { useState } from 'react';
import { evaluatePrecisionReading } from '../experiments/precisionReading';
import './InquiryGuide.css';

export function PrecisionReadingPractice({ instrument, contactMode, indicatedLengthMm, zeroReadingMm }: { instrument: number; contactMode: number; indicatedLengthMm: number; zeroReadingMm: number }) {
  const [main, setMain] = useState(''), [division, setDivision] = useState(''), [zero, setZero] = useState('');
  const [feedback, setFeedback] = useState('');
  function check() {
    if (contactMode !== 2) { setFeedback('请先闭合校零，再夹持样品后核对读数。'); return; }
    try {
      const result = evaluatePrecisionReading(instrument, main, division, zero);
      const matches = Math.abs(result.indicatedMm - indicatedLengthMm) < 1e-8 && Math.abs(result.zeroMm - zeroReadingMm) < 1e-8;
      setFeedback(`按你的输入：示值 ${result.indicatedMm.toFixed(2)} mm，零点修正后 ${result.correctedMm.toFixed(2)} mm。${matches ? '与当前虚拟仪器一致。' : '与当前虚拟仪器有差异，请复查主尺、对齐格和零点正负。'}`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : '请检查读数。'); }
  }
  return <section className="hs-inquiry-guide hs-precision-practice" aria-label="精密尺自主读数练习"><h2>先读尺，再核对。</h2><p>闭合校零时记下零点，再夹持样品：主尺加{instrument === 0 ? '游标对齐格 × 0.02' : '微分筒格 × 0.01'} mm，最后减去零点读数。</p><div className="hs-precision-inputs">
    <label htmlFor="precision-main">主尺 / mm<input id="precision-main" inputMode="decimal" value={main} onChange={(event) => { setMain(event.target.value); setFeedback(''); }} /></label>
    <label htmlFor="precision-division">{instrument === 0 ? '游标对齐格' : '微分筒格'}<input id="precision-division" inputMode="numeric" value={division} onChange={(event) => { setDivision(event.target.value); setFeedback(''); }} /></label>
    <label htmlFor="precision-zero">校零时的示值 / mm<input id="precision-zero" inputMode="decimal" value={zero} onChange={(event) => { setZero(event.target.value); setFeedback(''); }} /></label>
  </div><button className="hs-button" type="button" disabled={contactMode !== 2} onClick={check}>核对我的读数</button>{feedback && contactMode === 2 && <p role="status">{feedback}</p>}<p className="hs-control-note">此处是本页读数练习，刷新或更换器材、样品、零点设置后清空。不会自动保存到模型记录或发送给力力；课堂报告可自行填写原始读数。</p></section>;
}
