import { useId } from "react";

/** Original vector mascot; resolution-independent and usable without image downloads. */
export function LegacyCorgiAvatar({ speaking = false }: { speaking?: boolean }) {
  const id = useId().replaceAll(":", "");
  return <svg className={`lili-corgi-vector${speaking ? " is-speaking" : ""}`} viewBox="0 0 160 160" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#f2b266" /><stop offset="1" stopColor="#c87835" /></linearGradient>
      <radialGradient id={`${id}-cream`}><stop stopColor="#fffef3" /><stop offset="1" stopColor="#f1dfc4" /></radialGradient>
    </defs>
    <ellipse cx="81" cy="145" rx="47" ry="7" fill="#163f35" opacity=".12" />
    <g className="lili-corgi-body"><path d="M49 102Q80 91 112 103L119 139Q113 148 99 143L93 130H66L61 143Q47 148 41 138Z" fill={`url(#${id}-fur)`} /><path d="M62 108Q80 101 99 108L92 135H68Z" fill={`url(#${id}-cream)`} /><path d="M45 132Q54 127 64 133L61 143H43Z M96 133Q107 127 117 132L119 141Q108 146 98 142Z" fill="#fff8e7" /></g>
    <g className="lili-corgi-head">
      <path d="M37 70Q20 42 27 12Q48 15 65 52Z" fill={`url(#${id}-fur)`} stroke="#ad6633" strokeWidth="2" /><path d="M123 70Q140 42 133 12Q111 15 96 52Z" fill={`url(#${id}-fur)`} stroke="#ad6633" strokeWidth="2" />
      <path d="M37 52Q30 34 33 24Q47 31 52 49Z M108 49Q114 31 127 24Q131 36 123 53Z" fill="#d99183" />
      <path d="M33 63Q41 42 79 43Q118 41 128 65L136 91Q133 118 81 125Q29 120 23 93Z" fill={`url(#${id}-fur)`} />
      <path d="M77 45L66 70L73 87Q48 75 34 90Q26 108 60 120Q80 128 101 120Q134 109 126 91Q112 76 87 87L93 70L83 45Z" fill={`url(#${id}-cream)`} />
      <g className="lili-corgi-eyes"><ellipse cx="54" cy="76" rx="7" ry="8" fill="#243830" /><ellipse cx="106" cy="76" rx="7" ry="8" fill="#243830" /><circle cx="56" cy="73" r="2.2" fill="white" /><circle cx="108" cy="73" r="2.2" fill="white" /></g>
      <path d="M71 91Q80 86 90 91Q89 100 80 102Q72 99 71 91Z" fill="#27382f" /><path d="M80 102V107M80 106Q70 115 62 108M80 106Q90 115 99 107" fill="none" stroke="#704e38" strokeWidth="2.4" strokeLinecap="round" />
      <path className="lili-corgi-tongue" d="M74 112Q80 115 86 111L85 120Q80 126 75 120Z" fill="#d3847c" /><ellipse cx="41" cy="93" rx="8" ry="3" fill="#e0a087" opacity=".6" /><ellipse cx="119" cy="93" rx="8" ry="3" fill="#e0a087" opacity=".6" />
    </g>
    <path d="M49 117Q80 129 111 117L110 125Q82 137 50 125Z" fill="#245b4b" /><path d="M79 128L91 133L83 147L71 134Z" fill="#d9a558" /><path d="M80 133V140H84" fill="none" stroke="#fff7df" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
