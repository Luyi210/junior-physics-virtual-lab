export type PhysicsField = "light" | "sound" | "mechanics" | "circuit" | "thermal" | "measurement" | "mixed";

export function PhysicsFieldMotif({ field, className = "" }: { field: PhysicsField; className?: string }) {
  return <div className={`physics-field-motif field-${field} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet">
      <g className="field-motif-grid">
        {[20, 60, 100, 140, 180, 220, 260, 300, 340].map((x) => <line x1={x} x2={x} y1="10" y2="170" key={`x-${x}`} />)}
        {[20, 60, 100, 140].map((y) => <line x1="10" x2="350" y1={y} y2={y} key={`y-${y}`} />)}
      </g>

      {field === "light" && <g className="field-drawing drawing-light">
        <path className="field-axis" d="M18 92 H344" /><path className="field-glass" d="M181 22 C147 52 147 133 181 158 C215 133 215 52 181 22 Z" />
        <path className="field-energy warm" d="M28 48 L181 48 L304 132" /><path className="field-energy cool" d="M28 48 L181 92 L304 132" />
        <circle className="field-point" cx="116" cy="92" r="4" /><circle className="field-point" cx="246" cy="92" r="4" />
        <text x="20" y="166">1/f = 1/u + 1/v</text><text x="108" y="84">F</text><text x="238" y="84">F</text>
      </g>}

      {field === "sound" && <g className="field-drawing drawing-sound">
        <path className="field-device" d="M70 28 V92 M106 28 V92 M70 28 Q88 10 106 28 M88 92 V154 M65 154 H111" />
        <path className="field-wave wave-a" d="M118 90 Q138 45 158 90 T198 90 T238 90 T278 90 T338 90" />
        <path className="field-wave wave-b" d="M118 118 Q138 92 158 118 T198 118 T238 118 T278 118 T338 118" />
        <path className="field-measure" d="M128 35 H328 M128 30 V40 M328 30 V40" />
        <text x="185" y="28">λ</text><text x="18" y="168">v = fλ</text><text x="235" y="168">A → 响度</text>
      </g>}

      {field === "mechanics" && <g className="field-drawing drawing-mechanics">
        <path className="field-beam" d="M35 91 L328 69" /><path className="field-fulcrum" d="M176 83 L145 148 H207 Z" />
        <path className="field-force warm" d="M75 28 V78 M65 66 L75 78 L85 66" /><path className="field-force cool" d="M286 122 V78 M276 90 L286 78 L296 90" />
        <path className="field-measure" d="M75 107 H176 M75 102 V112 M176 102 V112 M176 122 H286 M286 117 V127" />
        <text x="112" y="126">l₁</text><text x="230" y="141">l₂</text><text x="18" y="170">F₁l₁ = F₂l₂</text>
      </g>}

      {field === "circuit" && <g className="field-drawing drawing-circuit">
        <path className="field-wire" d="M42 43 H126 M154 43 H306 V136 H246 M207 136 H112 M73 136 H42 Z" />
        <path className="field-battery" d="M126 25 V61 M154 17 V69" /><path className="field-resistor" d="M246 136 L238 124 L228 148 L218 124 L207 136" />
        <path className="field-switch" d="M73 136 H86 L106 119 M106 136 H112" />
        {[76, 114, 182, 224, 278].map((x, index) => <circle className="field-charge" cx={x} cy={43} r="4" style={{ animationDelay: `${index * -.3}s` }} key={x} />)}
        <text x="22" y="171">I = U / R</text><text x="245" y="112">R</text><text x="132" y="91">U</text>
      </g>}

      {field === "thermal" && <g className="field-drawing drawing-thermal">
        <path className="field-beaker" d="M55 30 H157 M68 30 V135 Q68 153 86 153 H126 Q144 153 144 135 V30" /><path className="field-water" d="M69 93 Q87 86 106 93 T144 93 V136 Q144 152 126 152 H86 Q69 152 69 136 Z" />
        <path className="field-thermometer" d="M184 31 V125 A17 17 0 1 0 210 125 V31 A13 13 0 0 0 184 31 Z" /><path className="field-mercury" d="M197 48 V132" />
        <path className="field-curve" d="M230 142 L250 132 L270 110 L292 78 L314 58 L338 58" /><path className="field-measure" d="M226 28 V146 H344" />
        <text x="226" y="169">Q = cmΔT</text><text x="311" y="50">100℃</text>
      </g>}

      {field === "measurement" && <g className="field-drawing drawing-measurement">
        <path className="field-balance" d="M42 58 H192 M117 58 V135 M89 153 H145 M117 58 L102 135 H132 Z" />
        <path className="field-pan" d="M42 58 L25 105 H77 Z M192 58 L157 105 H227 Z" /><rect className="field-sample" x="41" y="77" width="23" height="22" />
        <path className="field-cylinder" d="M261 27 V146 Q261 157 272 157 H312 Q323 157 323 146 V27" /><path className="field-water" d="M262 91 H322 V146 Q322 156 312 156 H272 Q262 156 262 146 Z" />
        {[48, 70, 92, 114, 136].map((y) => <path className="field-tick" d={`M306 ${y} H322`} key={y} />)}
        <text x="18" y="173">ρ = m / V</text><text x="271" y="82">V</text>
      </g>}

      {field === "mixed" && <g className="field-drawing drawing-mixed">
        <path className="mixed-orbit orbit-one" d="M45 88 C80 15 280 15 315 88 C280 161 80 161 45 88 Z" />
        <path className="mixed-orbit orbit-two" d="M77 30 C154 11 281 91 277 146 C198 169 77 91 77 30 Z" />
        <circle className="mixed-core" cx="180" cy="88" r="25" />
        <g className="mixed-nodes"><circle cx="45" cy="88" r="13" /><circle cx="105" cy="31" r="13" /><circle cx="255" cy="31" r="13" /><circle cx="315" cy="88" r="13" /><circle cx="255" cy="145" r="13" /><circle cx="105" cy="145" r="13" /></g>
        <text className="mixed-symbol" x="172" y="94">物理</text><text x="39" y="93">光</text><text x="99" y="36">声</text><text x="249" y="36">力</text><text x="309" y="93">电</text><text x="249" y="150">热</text><text x="99" y="150">测</text>
      </g>}
    </svg>
  </div>;
}
