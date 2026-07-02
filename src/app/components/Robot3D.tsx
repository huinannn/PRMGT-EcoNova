import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ── Box dimensions ── */
const W = 210; const H = 340; const D = 170;
const HW = W / 2; const HH = H / 2; const HD = D / 2;

type ViewPreset = "iso" | "front" | "back" | "left" | "right" | "top" | "cutaway";
const PRESETS: Record<ViewPreset, [number, number]> = {
  iso:     [-22, 32],
  front:   [0,   0],
  back:    [0,   180],
  left:    [0,  -90],
  right:   [0,   90],
  top:     [-88, 20],
  cutaway: [-18, -50],
};
const PRESET_ICONS: Record<ViewPreset, string> = {
  iso: "⬡", front: "⬛", back: "⬜", left: "◀", right: "▶", top: "▲", cutaway: "✂",
};

/* ── Generic face container ── */
function Face({ w, h, tf, opacity = 1, children }: {
  w: number; h: number; tf: string; opacity?: number; children?: React.ReactNode;
}) {
  return (
    <div style={{
      position: "absolute",
      width: w, height: h,
      marginLeft: -w / 2, marginTop: -h / 2,
      transform: tf,
      backfaceVisibility: "hidden",
      overflow: "hidden",
      opacity,
    }}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   FRONT FACE  (W × H)
══════════════════════════════════════════════ */
function FrontFace({ scanActive }: { scanActive: boolean }) {
  return (
    <Face w={W} h={H} tf={`translateZ(${HD}px)`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="lens3d" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="50%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0a0f1e" />
          </radialGradient>
          <linearGradient id="frontBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#cdd0d5" />
            <stop offset="6%" stopColor="#eef0f3" />
            <stop offset="94%" stopColor="#eef0f3" />
            <stop offset="100%" stopColor="#b8bcc4" />
          </linearGradient>
          <linearGradient id="screenBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040d1a" />
            <stop offset="100%" stopColor="#061020" />
          </linearGradient>
          <linearGradient id="beamGrad3D" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0"/>
          </linearGradient>
          <clipPath id="binWindowClip">
            <rect x="12" y="152" width={W-24} height="156" rx="5" />
          </clipPath>
        </defs>

        {/* Cabinet body */}
        <rect x="0" y="0" width={W} height={H-24} rx="10" fill="url(#frontBody)" />
        <rect x="2" y="2" width={W-4} height={H-26} rx="9" fill="none" stroke="#d5d8de" strokeWidth="1.5" />

        {/* ── Top module: camera + main LCD ── */}
        <rect x="8" y="8" width={W-16} height="82" rx="7" fill="#111827" />
        <rect x="10" y="10" width={W-20} height="78" rx="6" fill="#0d1420" />

        {/* Camera housing */}
        <rect x="14" y="14" width="60" height="68" rx="6" fill="#0a0f1a" stroke="#1e293b" strokeWidth="1" />
        <path d="M 24 24 L 64 24 L 70 76 L 18 76 Z" fill="#040812"/>

        {/* Camera iris rings */}
        <circle cx="44" cy="48" r="22" fill="#060c16" stroke="#1e3a5f" strokeWidth="1.5" />
        {[0,45,90,135,180,225,270,315].map(deg=>(
          <circle key={deg} cx={44 + Math.cos(deg*Math.PI/180)*18} cy={48 + Math.sin(deg*Math.PI/180)*18} r="1" fill={scanActive ? "#f59e0b" : "#334155"} opacity={scanActive ? 0.8 : 0.3}/>
        ))}

        <circle cx="44" cy="48" r="14" fill="#091422" stroke="#1d4ed8" strokeWidth="1" />
        <circle cx="44" cy="48" r="10" fill="url(#lens3d)" />
        <circle cx="44" cy="48" r="3.5" fill="#1e40af" opacity="0.7" />
        <circle cx="42" cy="46" r="1.5" fill="white" opacity="0.35" />
        
        <circle cx="22" cy="22" r="3" fill={scanActive ? "#f59e0b" : "#22c55e"} style={{ filter: `drop-shadow(0 0 4px ${scanActive ? "#f59e0b" : "#22c55e"})` }} />
        <text x="44" y="78" textAnchor="middle" fill="#3b82f6" fontSize="5.5" fontWeight="700" letterSpacing="1">CAMERA</text>

        {/* Scan beam */}
        {scanActive && (
          <motion.polygon
            points={`44,48 ${W/2-30},105 ${W/2+30},105`}
            fill="url(#beamGrad3D)"
            style={{ mixBlendMode: "screen" }}
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}

        {/* Main LCD screen */}
        <rect x="80" y="13" width="122" height="72" rx="5" fill="url(#screenBg)" />
        <rect x="82" y="15" width="118" height="68" rx="4" fill="#040a14" />
        {/* LCD grid lines */}
        <line x1="82" y1="35" x2="200" y2="35" stroke="#0d2040" strokeWidth="0.5" />
        <line x1="82" y1="55" x2="200" y2="55" stroke="#0d2040" strokeWidth="0.5" />
        {/* Status row */}
        <circle cx="91" cy="24" r="3.5" fill="#22c55e" style={{ filter: "drop-shadow(0 0 3px #22c55e)" }} />
        <text x="99" y="27" fill="#94a3b8" fontSize="6.5" fontWeight="600" letterSpacing="0.5">SYSTEM STATUS</text>
        <text x="186" y="27" textAnchor="end" fill="#22c55e" fontSize="6.5" fontWeight="700">ONLINE</text>
        {/* AI Model row */}
        <text x="86" y="44" fill="#60a5fb" fontSize="6.5">Model:</text>
        <text x="108" y="44" fill="#e2e8f0" fontSize="6.5" fontWeight="500">YOLOv8-Waste-v2</text>
        {/* Confidence */}
        <text x="86" y="58" fill="#60a5fb" fontSize="6.5">Confidence:</text>
        <rect x="140" y="51" width="54" height="7" rx="3.5" fill="#0d2040" />
        <rect x="140" y="51" width="51" height="7" rx="3.5" fill="#22c55e" opacity="0.9" />
        <text x="167" y="57.5" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="700">98.7%</text>
        {/* Mode */}
        <text x="86" y="72" fill="#60a5fb" fontSize="6.5">Mode:</text>
        <text x="108" y="72" fill="#fde047" fontSize="6.5" fontWeight="500">AUTO SORT · READY</text>

        {/* ── Hopper funnel ── */}
        <path d={`M ${W/2-46} 98 L ${W/2-26} 118 L ${W/2+26} 118 L ${W/2+46} 98 Z`} fill="#9ca3af" />
        <path d={`M ${W/2-26} 118 L ${W/2-18} 140 L ${W/2+18} 140 L ${W/2+26} 118 Z`} fill="#6b7280" />
        <text x={W/2} y="111" textAnchor="middle" fill="#374151" fontSize="6.5" fontWeight="800" letterSpacing="1">WASTE INPUT</text>
        {/* Funnel rim */}
        <rect x={W/2-48} y="95" width="96" height="6" rx="3" fill="#6b7280" />
        <rect x={W/2-46} y="96" width="92" height="4" rx="2" fill="#4b5563" />

        {/* ── Bin compartment window ── */}
        <rect x="10" y="150" width={W-20} height="160" rx="6" fill="#09162a" stroke="#1e3a5f" strokeWidth="1.5" />
        <rect x="12" y="152" width={W-24} height="156" rx="5" fill="#060f1e" />
        {/* Window glass sheen */}
        <rect x="12" y="152" width="22" height="156" rx="5" fill="white" opacity="0.015" />

        {/* Bin dividers */}
        <line x1="82" y1="152" x2="82" y2="308" stroke="#1e3a5f" strokeWidth="1.5" />
        <line x1="150" y1="152" x2="150" y2="308" stroke="#1e3a5f" strokeWidth="1.5" />

        {/* Blue (Plastic) bin */}
        <rect x="13" y="155" width="68" height="150" rx="3" fill="#1d4ed8" opacity="0.08" />
        <rect x="13" y="238" width="68" height="67" rx="3" fill="#2563eb" opacity="0.45" clipPath="url(#binWindowClip)" />
        <rect x="15" y="237" width="64" height="3" rx="1.5" fill="#93c5fd" opacity="0.6" />
        <text x="47" y="196" textAnchor="middle" fontSize="22" fill="#3b82f6" opacity="0.25">♻</text>
        <text x="47" y="302" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#93c5fd" letterSpacing="0.5">PLASTIC</text>
        <text x="47" y="311" textAnchor="middle" fontSize="5.5" fill="#3b82f6" opacity="0.7">29%</text>

        {/* Green (Organic) bin */}
        <rect x="83" y="155" width="66" height="150" rx="3" fill="#15803d" opacity="0.08" />
        <rect x="83" y="222" width="66" height="83" rx="3" fill="#16a34a" opacity="0.45" clipPath="url(#binWindowClip)" />
        <rect x="85" y="221" width="62" height="3" rx="1.5" fill="#86efac" opacity="0.6" />
        <text x="116" y="196" textAnchor="middle" fontSize="20" fill="#22c55e" opacity="0.25">🌿</text>
        <text x="116" y="302" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#86efac" letterSpacing="0.5">ORGANIC</text>
        <text x="116" y="311" textAnchor="middle" fontSize="5.5" fill="#22c55e" opacity="0.7">44%</text>

        {/* Yellow (Paper) bin */}
        <rect x="151" y="155" width="66" height="150" rx="3" fill="#854d0e" opacity="0.08" />
        <rect x="151" y="256" width="66" height="49" rx="3" fill="#ca8a04" opacity="0.45" clipPath="url(#binWindowClip)" />
        <rect x="153" y="255" width="62" height="3" rx="1.5" fill="#fde047" opacity="0.6" />
        <text x="184" y="196" textAnchor="middle" fontSize="20" fill="#eab308" opacity="0.25">📰</text>
        <text x="184" y="302" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#fde047" letterSpacing="0.5">PAPER</text>
        <text x="184" y="311" textAnchor="middle" fontSize="5.5" fill="#eab308" opacity="0.7">18%</text>

        {/* ── Caster Wheels & Foot Pedal ── */}
        <rect x={W/2-30} y={H-36} width="60" height="10" rx="4" fill="#6b7280" stroke="#4b5563" strokeWidth="1"/>
        <rect x={W/2-26} y={H-34} width="52" height="4" rx="2" fill="#d1d5db"/>

        {[24, W-24].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-26} width="24" height="10" rx="2" fill="#4b5563"/>
            <rect x={wx-6} y={H-16} width="12" height="6" fill="#374151"/>
            <circle cx={wx} cy={H-10} r="10" fill="#111827"/>
            <circle cx={wx} cy={H-10} r="4" fill="#6b7280"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   BACK FACE  (W × H)
══════════════════════════════════════════════ */
function BackFace() {
  return (
    <Face w={W} h={H} tf={`rotateY(180deg) translateZ(${HD}px)`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={H-24} rx="10" fill="#e2e5e9" />
        <rect x="2" y="2" width={W-4} height={H-28} rx="9" fill="none" stroke="#c5c9d1" strokeWidth="1.5" />
        
        {/* Wheels */}
        {[24, W-24].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-26} width="24" height="10" rx="2" fill="#4b5563"/>
            <rect x={wx-6} y={H-16} width="12" height="6" fill="#374151"/>
            <circle cx={wx} cy={H-10} r="10" fill="#111827"/>
            <circle cx={wx} cy={H-10} r="4" fill="#6b7280"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   RIGHT FACE  (D × H)
══════════════════════════════════════════════ */
function RightFace() {
  return (
    <Face w={D} h={H} tf={`rotateY(90deg) translateZ(${HW}px)`}>
      <svg width={D} height={H} viewBox={`0 0 ${D} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={D} height={H-24} rx="8" fill="#e0e3e8" />
        <rect x="2" y="2" width={D-4} height={H-28} rx="7" fill="none" stroke="#c5c9d1" strokeWidth="1.5" />
        {/* Wheels */}
        {[24, D-24].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-26} width="24" height="10" rx="2" fill="#4b5563"/>
            <rect x={wx-6} y={H-16} width="12" height="6" fill="#374151"/>
            <circle cx={wx} cy={H-10} r="10" fill="#111827"/>
            <circle cx={wx} cy={H-10} r="4" fill="#6b7280"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   LEFT FACE  (D × H)
══════════════════════════════════════════════ */
function LeftFace() {
  return (
    <Face w={D} h={H} tf={`rotateY(-90deg) translateZ(${HW}px)`}>
      <svg width={D} height={H} viewBox={`0 0 ${D} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={D} height={H-24} rx="8" fill="#e0e3e8" />
        <rect x="2" y="2" width={D-4} height={H-28} rx="7" fill="none" stroke="#c5c9d1" strokeWidth="1.5" />
        {/* Wheels */}
        {[24, D-24].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-26} width="24" height="10" rx="2" fill="#4b5563"/>
            <rect x={wx-6} y={H-16} width="12" height="6" fill="#374151"/>
            <circle cx={wx} cy={H-10} r="10" fill="#111827"/>
            <circle cx={wx} cy={H-10} r="4" fill="#6b7280"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   TOP FACE  (W × D)
══════════════════════════════════════════════ */
function TopFace({ scanActive }: { scanActive: boolean }) {
  return (
    <Face w={W} h={D} tf={`rotateX(90deg) translateZ(${HH}px)`}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={D} rx="10" fill="#dde0e5" />
        <rect x="2" y="2" width={W-4} height={D-4} rx="9" fill="none" stroke="#c5c9d1" strokeWidth="1.5" />
        {/* Hopper opening (top view) */}
        <ellipse cx={W/2+20} cy={D/2} rx="44" ry="34" fill="#374151" />
        <ellipse cx={W/2+20} cy={D/2} rx="40" ry="30" fill="#1f2937" />
        <ellipse cx={W/2+20} cy={D/2} rx="36" ry="26" fill="#111827" />
        <text x={W/2+20} y={D/2+2} textAnchor="middle" fill="#6b7280" fontSize="6.5" fontWeight="700">WASTE</text>
        <text x={W/2+20} y={D/2+11} textAnchor="middle" fill="#6b7280" fontSize="6.5" fontWeight="700">INPUT</text>
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   BOTTOM FACE  (W × D)
══════════════════════════════════════════════ */
function BottomFace() {
  return (
    <Face w={W} h={D} tf={`rotateX(-90deg) translateZ(${HH}px)`}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={D} rx="10" fill="#dde0e5" />
        <rect x="2" y="2" width={W-4} height={D-4} rx="9" fill="none" stroke="#c5c9d1" strokeWidth="1.5" />

        {/* Wheel positions viewed from bottom */}
        {[[24,22],[W-24,22],[24,D-22],[W-24,D-22]].map(([cx,cy],i)=>(
          <g key={i}>
            <rect x={cx-10} y={cy-12} width="20" height="24" rx="3" fill="#111827"/>
            <rect x={cx-5} y={cy-8} width="10" height="16" fill="#374151"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ══════════════════════════════════════════════
   INTERNAL / CUTAWAY VIEW
══════════════════════════════════════════════ */
function InternalView() {
  return (
    <>
      {/* Internal cross-section plane */}
      <Face w={W} h={H} tf={`translateZ(0px)`} opacity={1}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={W} height={H} fill="#060f1e" opacity="0.97" />
          <rect x="2" y="2" width={W-4} height={H-4} fill="none" stroke="#1e3a5f" strokeWidth="1.5" />

          {/* AI Camera module */}
          <rect x="10" y="8" width="60" height="52" rx="5" fill="#0d1a2a" stroke="#3b82f6" strokeWidth="1" />
          <circle cx="40" cy="34" r="18" fill="#1d4ed8" opacity="0.3" stroke="#3b82f6" strokeWidth="1" />
          <circle cx="40" cy="34" r="10" fill="#60a5fa" opacity="0.5" />
          <text x="40" y="72" textAnchor="middle" fill="#60a5fb" fontSize="5.5" fontWeight="600">AI CAMERA</text>

          {/* Raspberry Pi */}
          <rect x="80" y="10" width="80" height="50" rx="4" fill="#14532d" stroke="#22c55e" strokeWidth="1" />
          <rect x="84" y="14" width="72" height="42" rx="3" fill="#166534" />
          <text x="120" y="36" textAnchor="middle" fill="#86efac" fontSize="6" fontWeight="600">Raspberry Pi 4B</text>
          <text x="120" y="47" textAnchor="middle" fill="#4ade80" fontSize="5">Main Controller</text>
          {Array.from({length:8},(_,i)=>(
            <rect key={i} x={84+i*9} y="13" width="5" height="4" rx="0.5" fill="#fbbf24" />
          ))}
          <text x="120" y="72" textAnchor="middle" fill="#4ade80" fontSize="5.5" fontWeight="600">CONTROLLER</text>

          {/* Motor driver */}
          <rect x="170" y="10" width="34" height="26" rx="3" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1" />
          <text x="187" y="27" textAnchor="middle" fill="#a5b4fc" fontSize="5" fontWeight="600">MOTOR</text>
          <text x="187" y="34" textAnchor="middle" fill="#a5b4fc" fontSize="5">DRIVER</text>
          <text x="187" y="48" textAnchor="middle" fill="#818cf8" fontSize="5">DRV8825</text>

          {/* Servo motors row */}
          <text x={W/2} y="98" textAnchor="middle" fill="#f59e0b" fontSize="6" fontWeight="700">── SERVO SORTING SYSTEM ──</text>
          {[0,1,2].map(i=>(
            <g key={i}>
              <rect x={16+i*65} y="105" width="58" height="26" rx="4" fill="#292524" stroke="#78716c" strokeWidth="1" />
              <rect x={16+i*65+4} y="109" width="30" height="18" rx="3" fill="#374151" />
              <circle cx={16+i*65+48} cy="118" r="8" fill="#1f2937" stroke="#6b7280" strokeWidth="1" />
              <circle cx={16+i*65+48} cy="118" r="4" fill="#374151" />
              <text x={16+i*65+29} y="142" textAnchor="middle" fill="#a8a29e" fontSize="5.5" fontWeight="600">
                {["PLASTIC","ORGANIC","PAPER"][i]} SERVO
              </text>
            </g>
          ))}

          {/* Sorting gates */}
          <text x={W/2} y="162" textAnchor="middle" fill="#94a3b8" fontSize="5.5">── SORTING FLAP GATES ──</text>
          {[0,1,2].map(i=>(
            <g key={i}>
              <rect x={20+i*64} y="168" width="52" height="8" rx="3" fill="#4b5563" stroke="#6b7280" strokeWidth="0.5" />
              <rect x={20+i*64} y="168" width="18" height="8" rx="2" fill="#22c55e" opacity="0.7" />
            </g>
          ))}

          {/* Three bins */}
          {[
            { x: 10,  color: "#ea580c", light: "#f97316", label: "CAN/PLASTIC", fill: 0.3 },
            { x: 78,  color: "#78350f", light: "#92400e", label: "GLASS",       fill: 0.45 },
            { x: 146, color: "#1d4ed8", light: "#2563eb", label: "PAPER",       fill: 0.19 },
          ].map(b => (
            <g key={b.label}>
              <rect x={b.x} y="185" width="60" height="120" rx="4" fill={b.color} opacity="0.12" stroke={b.light} strokeWidth="1" />
              <rect x={b.x+2} y={185+120*(1-b.fill)} width="56" height={120*b.fill} rx="3" fill={b.color} opacity="0.5" />
              <rect x={b.x+4} y={185+120*(1-b.fill)} width="52" height="3" rx="1.5" fill={b.light} opacity="0.7" />
              <text x={b.x+30} y="218" textAnchor="middle" fontSize="16" fill={b.light} opacity="0.2">
                {b.label==="CAN/PLASTIC"?"♻":b.label==="GLASS"?"🫙":"📰"}
              </text>
              <text x={b.x+30} y="300" textAnchor="middle" fontSize="6" fontWeight="700" fill={b.light}>{b.label}</text>
              <text x={b.x+30} y="310" textAnchor="middle" fontSize="5.5" fill={b.light} opacity="0.7">
                {Math.round(b.fill*100)}%
              </text>
            </g>
          ))}

          {/* Battery pack */}
          <rect x="10" y="316" width="85" height="18" rx="4" fill="#450a0a" stroke="#f87171" strokeWidth="1" />
          <text x="52" y="328" textAnchor="middle" fill="#fca5a5" fontSize="5.5" fontWeight="600">BATTERY · 12V 22Ah</text>

          {/* Wiring */}
          {[[10,60,80,60],[80,60,80,105],[144,60,144,105],[15,82,15,185],[79,82,79,185]].map((l,i)=>(
            <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]}
              stroke={["#f87171","#4ade80","#60a5fa","#fbbf24","#c084fc"][i]}
              strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
          ))}
        </svg>
      </Face>
    </>
  );
}

/* ══════════════════════════════════════════════
   MAIN Robot3D COMPONENT
══════════════════════════════════════════════ */
export default function Robot3D() {
  const [rotX, setRotX] = useState(-22);
  const [rotY, setRotY] = useState(32);
  const [zoom, setZoom] = useState(0.88);
  const [cutaway, setCutaway] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const drag = useRef<{ sx: number; sy: number; rx: number; ry: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!autoRotate) { cancelAnimationFrame(rafRef.current); return; }
    let last = performance.now();
    const tick = (now: number) => {
      setRotY(y => y + ((now - last) / 1000) * 28);
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoRotate]);

  const onDown = useCallback((e: React.MouseEvent) => {
    setAutoRotate(false);
    drag.current = { sx: e.clientX, sy: e.clientY, rx: rotX, ry: rotY };
  }, [rotX, rotY]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!drag.current) return;
    setRotY(drag.current.ry + (e.clientX - drag.current.sx) * 0.38);
    setRotX(Math.max(-82, Math.min(82, drag.current.rx - (e.clientY - drag.current.sy) * 0.28)));
  }, []);

  const onUp = useCallback(() => { drag.current = null; }, []);

  function goPreset(p: ViewPreset) {
    setAutoRotate(false);
    const [rx, ry] = PRESETS[p];
    setRotX(rx); setRotY(ry);
    setCutaway(p === "cutaway");
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 3D viewport */}
      <div
        className="flex-1 relative flex items-center justify-center select-none cursor-grab active:cursor-grabbing overflow-hidden bg-white"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onWheel={e => setZoom(z => Math.max(0.35, Math.min(1.6, z - e.deltaY * 0.001)))}
      >
        {/* Ambient grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(90deg,#3b82f6 1px,transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        {/* Floor glow */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-80 h-20 rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, #3b82f6, transparent)", filter: "blur(20px)" }} />

        {/* Hint */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-slate-400 text-xs pointer-events-none font-medium tracking-wide">
          Drag to rotate · Scroll to zoom
        </div>

        {/* ── CSS 3D Scene ── */}
        <div style={{ perspective: 1400, perspectiveOrigin: "50% 50%", width: 0, height: 0 }}>
          <div style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${zoom})`,
            position: "relative", width: 0, height: 0,
          }}>
            {/* Shadow plane */}
            <Face w={W+60} h={D+40} tf={`rotateX(90deg) translateZ(${HH+2}px)`} opacity={0.4}>
              <div style={{ width: W+60, height: D+40, background: "radial-gradient(ellipse, #000 0%, transparent 70%)", borderRadius: 999 }} />
            </Face>

            {/* Faces */}
            <FrontFace scanActive={scanActive} />
            {!cutaway && <LeftFace />}
            <RightFace />
            <BackFace />
            <TopFace scanActive={scanActive} />
            <BottomFace />

            {/* Cutaway interior */}
            {cutaway && <InternalView />}
          </div>
        </div>

        {/* Scan pulse badge */}
        <AnimatePresence>
          {scanActive && (
            <motion.div
              className="absolute top-6 right-6 flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-2"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            >
              <motion.div className="w-2 h-2 rounded-full bg-amber-400"
                animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
              <span className="text-amber-300 text-xs font-medium">Scanning…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rotation indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-xs text-slate-400">
          <span>X: {Math.round(rotX)}°</span>
          <span>Y: {Math.round(rotY % 360)}°</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* ── Right control panel ── */}
      <aside className="w-60 bg-[#0b1628] border-l border-white/10 flex flex-col gap-5 p-4 overflow-y-auto shrink-0">
        {/* View presets */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">View Presets</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(PRESETS) as ViewPreset[]).map(p => (
              <button key={p} onClick={() => goPreset(p)}
                className="flex items-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 capitalize transition-colors border border-white/8">
                <span className="text-white/40">{PRESET_ICONS[p]}</span> {p}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Controls</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setAutoRotate(r => !r); }}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${autoRotate ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "bg-white/5 text-white/60 border border-white/10"}`}>
              {autoRotate ? "⏹ Stop Rotation" : "▶ Auto Rotate 360°"}
            </button>
            <button onClick={() => setCutaway(c => !c)}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${cutaway ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "bg-white/5 text-white/60 border border-white/10"}`}>
              {cutaway ? "🔲 Full View" : "✂ Cutaway View"}
            </button>
            <button onClick={() => setScanActive(s => !s)}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${scanActive ? "bg-amber-600 text-white" : "bg-white/5 text-white/60 border border-white/10"}`}>
              {scanActive ? "⬛ Stop Scan" : "📷 Simulate Scan"}
            </button>
            <div className="mt-1">
              <div className="flex justify-between text-[10px] text-white/35 mb-1.5"><span>Zoom</span><span>{Math.round(zoom * 100)}%</span></div>
              <input type="range" min="35" max="160" value={Math.round(zoom * 100)}
                onChange={e => setZoom(Number(e.target.value) / 100)} className="w-full accent-blue-500 h-1" />
            </div>
          </div>
        </div>

        {/* Component legend */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Internal Components</p>
          <div className="flex flex-col gap-1.5">
            {[
              ["#60a5fa","AI Camera Module"],["#4ade80","Raspberry Pi 4B"],
              ["#f59e0b","Servo Motors ×3"],["#a78bfa","Motor Driver"],
              ["#fb923c","Ultrasonic Sensors ×4"],
              ["#3b82f6","Plastic Bin (Blue)"],["#22c55e","Organic Bin (Green)"],
              ["#eab308","Paper Bin (Yellow)"],["#f87171","Battery 12V 22Ah"],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-white/45">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spec table */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Specifications</p>
          <div className="flex flex-col gap-1">
            {[
              ["Dimensions","30×35×65 cm"],["Weight","~5 kg"],
              ["Power","12V Li-Ion"],["AI Model","YOLOv8"],
              ["Controller","RPi 4 Model B"],
              ["Camera","USB 1080p"],["Accuracy",">98%"],
              ["Connectivity","Wi-Fi / BT"],
            ].map(([k,v])=>(
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-white/30">{k}</span>
                <span className="text-white/60 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
