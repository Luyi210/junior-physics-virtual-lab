import { ExpandedInstrumentIcon } from './expanded/ExpandedInstrumentIcon';
import { isExpandedExperiment } from './expanded/expandedGeometry';

export function InstrumentIllustration({ small = false, kind = "pendulum" }: { small?: boolean; kind?: string }) {
  if (small && isExpandedExperiment(kind)) return <svg viewBox="0 0 240 120" className="hs-instrument-small" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.5" fill="none"><ExpandedInstrumentIcon kind={kind} /></g></svg>;
  if (small) return <svg viewBox="0 0 240 120" className="hs-instrument-small" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.5" fill="none">
    {kind === "force-composition" ? <><path d="M55 95h95l32-65H87Z" strokeDasharray="4 4" /><path d="M55 95h95m-7-5 7 5-7 5" stroke="#386e52" strokeWidth="2.5" /><path d="M55 95l32-65m-7 4 7-4 1 8" stroke="#bd642f" strokeWidth="2.5" /><path d="M55 95l127-65m-9-1 9 1-4 7" stroke="#233f40" strokeWidth="2.5" /><circle cx="55" cy="95" r="3" fill="currentColor" /></> : kind === "spring-force" ? <><path d="M62 105V15h73M45 105h115M128 15v10l-9 4 18 6-18 6 18 6-18 6 18 6-18 6 18 6-9 4v7M169 20v78m-6-68h6m-6 15h6m-6 15h6m-6 15h6m-6 15h6" /><rect x="116" y="82" width="24" height="19" rx="3" fill="#bd642f" stroke="none" /></> : kind === "pendulum" ? <><path d="M50 98H188M120 98V15M94 15H150M120 20L155 77" /><circle cx="155" cy="77" r="10" fill="#bd642f" stroke="none" /><path d="M120 21v66M83 76Q120 99 159 76" strokeDasharray="3 4" /></>
      : kind === "double-slit" ? <><path d="M40 20v80M85 16v38m0 12v38M174 16v88M40 60l45-14 89 14-89 14zM85 46l89 32M85 74l89-32" /><path d="M180 36h20m-20 12h30m-30 12h38m-38 12h30m-30 12h20" stroke="#bd642f" strokeWidth="3" /></>
        : kind === "emf-internal-resistance" ? <><path d="M40 60V23h63m17 0h72v68H40V60m63-12V8m9 8v16M120 91h-17m34 0h55" /><rect x="103" y="84" width="34" height="14" fill="#eee7d9" /><circle cx="40" cy="60" r="13" fill="#f6f3eb" /><path d="M35 65l5-12 5 12m-8-4h6" stroke="#bd642f" /></>
          : kind === "projectile-motion" ? <><path d="M34 96H214M40 96V22M45 85Q119-21 201 86" strokeDasharray="4 4" /><circle cx="104" cy="35" r="7" fill="#bd642f" stroke="none" /><path d="M104 35l27-8m-5-3 5 3-4 5" /></>
            : <><path d="M23 88H214M35 93v8m25-8v5m25-5v8m25-8v5m25-5v8m25-8v5m25-5v8" /><rect x="75" y="58" width="67" height="23" rx="4" fill="#b9c9b4" /><circle cx="88" cy="83" r="6" fill="#294439" /><circle cx="130" cy="83" r="6" fill="#294439" /><path d="M143 67h37m-6-5 6 5-6 5" stroke="#bd642f" />{kind === "newton-second-law" && <><path d="M142 62h58v40" /><rect x="190" y="98" width="20" height="17" /></>}</>}
  </g></svg>;
  return <svg className="hs-hero-instrument" viewBox="0 0 600 470" role="img" aria-label="带有刻度、悬线和铜质摆球的单摆实验装置示意图">
    <defs><linearGradient id="hs-metal" x1="0" x2="1"><stop stopColor="#a64c26" /><stop offset=".45" stopColor="#edb27a" /><stop offset="1" stopColor="#92502e" /></linearGradient><pattern id="hs-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#2b493e" strokeOpacity=".09" strokeWidth=".6" /></pattern><filter id="hs-shadow"><feGaussianBlur stdDeviation="10" /></filter></defs>
    <rect x="40" y="10" width="510" height="430" fill="url(#hs-grid)" />
    <ellipse cx="293" cy="412" rx="174" ry="15" fill="#233d32" opacity=".13" filter="url(#hs-shadow)" />
    <path d="M143 388l212-22 95 34-213 24z" fill="#deddd0" stroke="#b2baaa" /><path d="M143 388v11l94 36v-11m0 0 213-24v10l-213 25" fill="#c0c6b5" stroke="#aab19f" />
    <path d="M261 385V67l14-5v320" fill="#6b8171" stroke="#385344" /><path d="M252 72l94-8 1 10-95 9z" fill="#bac1af" stroke="#617364" /><path d="M269 80v252" stroke="#d4d9cd" strokeWidth="3" />
    <path d="M329 77v267" fill="none" stroke="#819386" strokeDasharray="5 6" /><path d="M211 301Q329 391 451 302" fill="none" stroke="#8e9b8a" strokeDasharray="4 6" /><path d="M329 77L441 310" stroke="#334d3e" strokeWidth="2" />
    <path d="M330 136Q346 137 355 133" fill="none" stroke="#be622e" /><circle cx="441" cy="310" r="27" fill="url(#hs-metal)" stroke="#8a452b" /><ellipse cx="433" cy="300" rx="7" ry="9" fill="#f3c9a0" opacity=".45" /><circle cx="329" cy="78" r="5" fill="#be622e" />
    <path d="M190 97v237m-4-232 4-5 4 5m-8 227 4 5 4-5M175 97h28m-28 237h28" stroke="#9aa695" strokeWidth="1" fill="none" /><text x="171" y="219" fontSize="14" fill="#5b6a5c" textAnchor="end" fontStyle="italic">L</text>
    <path d="M445 276l42-37h45M300 70l-46-33h-74" stroke="#718271" fill="none" /><text x="489" y="227" fill="#4e6253" fontSize="11">观察运动</text><text x="177" y="28" fill="#4e6253" fontSize="11">提出问题</text>
    <text x="52" y="410" fill="#86917e" fontSize="10" letterSpacing="2">从一个摆动开始</text><circle cx="500" cy="74" r="32" fill="none" stroke="#b8c1ae" /><text x="500" y="72" textAnchor="middle" fill="#294839" fontSize="13">高中</text><text x="500" y="89" textAnchor="middle" fill="#63745f" fontSize="10">探究实验</text>
  </svg>;
}
