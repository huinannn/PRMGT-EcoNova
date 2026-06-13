import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────────────────────────────
   BOX DIMENSIONS  (wider to fit 4 bins)
   W=280  H=368  D=168   →  HW=140  HH=184  HD=84
───────────────────────────────────────────────────────────────── */
const W = 320, H = 420, D = 168;
const HW = 160, HH = 210, HD = 84;

type SortPhase = "idle" | "hovering" | "scanning" | "detected" | "sorted";
type WasteType = "plastic" | "paper" | "organic" | "general";
type ViewMode  = "normal" | "cutaway" | "exploded";

interface WasteItem { id: WasteType; label: string; emoji: string; color: string; binIdx: number; }
const WASTE: WasteItem[] = [
  { id:"plastic", label:"Plastic Bottle", emoji:"🍶", color:"#3b82f6", binIdx:0 },
  { id:"paper",   label:"Newspaper",      emoji:"📰", color:"#eab308", binIdx:1 },
  { id:"organic", label:"Banana Peel",    emoji:"🍌", color:"#22c55e", binIdx:2 },
  { id:"general", label:"Tissue",          emoji:"🧻", color:"#9ca3af", binIdx:3 },
];

const PRESETS: Record<string,[number,number]> = {
  iso:   [-30,  28],
  front: [  0,   0],
  back:  [  0, 180],
  left:  [  0, -90],
  right: [  0,  90],
  top:   [-88,  18],
};

/* ─── generic face wrapper ─── */
function Face({ w, h, tf, hidden=false, opacity=1, style, children }: {
  w:number; h:number; tf:string; hidden?:boolean; opacity?:number;
  style?: React.CSSProperties; children?: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div style={{
      position:"absolute", width:w, height:h,
      marginLeft:-w/2, marginTop:-h/2,
      transform:tf, backfaceVisibility:"hidden",
      overflow:"hidden", opacity,
      borderRadius:12, ...style,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FRONT FACE  (280 × 368)
   Top: scanning bay → divider shelf → 4-bin section → control strip → wheels
═══════════════════════════════════════════════════════════════ */
function FrontFace({ phase, item, fills, scanPct, ex }:{
  phase:SortPhase; item:WasteItem; fills:number[]; scanPct:number; ex:number;
}) {
  const scanning = phase === "scanning";
  const detected = phase === "detected" || phase === "sorted";

  const BINS = [
    { col:"#1a4fd6", dark:"#0f3ab0", light:"#60a5fa", label:"PLASTIC", icon:"♻" },
    { col:"#c49200", dark:"#9a7000", light:"#fcd34d", label:"PAPER",   icon:"📰" },
    { col:"#179947", dark:"#0d7034", light:"#4ade80", label:"ORGANIC", icon:"🌿" },
    { col:"#232323", dark:"#111111", light:"#9ca3af", label:"TRASH",   icon:"🗑" },
  ];

  /* 4 bins layout: BW=57, gap=10, margin=10 */
  const BX = [10, 87, 164, 241];
  const BW = 69, BH = 150, BY = 190;

  /* Bin centers for sorting animation target */
  const BIN_CENTERS = BX.map(x => x + BW / 2);

  return (
    <Face w={W} h={H} tf={`translateZ(${HD+ex}px)`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fbody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#9ea4b0"/>
            <stop offset="4%"   stopColor="#d2d6df"/>
            <stop offset="16%"  stopColor="#eef0f4"/>
            <stop offset="84%"  stopColor="#eaecf1"/>
            <stop offset="96%"  stopColor="#cdd1da"/>
            <stop offset="100%" stopColor="#a6abb6"/>
          </linearGradient>
          <linearGradient id="fbayBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0c0e18"/>
            <stop offset="8%"   stopColor="#181b26"/>
            <stop offset="50%"  stopColor="#1c1f2c"/>
            <stop offset="92%"  stopColor="#171a24"/>
            <stop offset="100%" stopColor="#0b0d16"/>
          </linearGradient>
          <linearGradient id="fbinBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#bfc4cc"/>
            <stop offset="8%"   stopColor="#dde0e8"/>
            <stop offset="50%"  stopColor="#e6e8ee"/>
            <stop offset="92%"  stopColor="#d8dbe4"/>
            <stop offset="100%" stopColor="#c2c6ce"/>
          </linearGradient>
          <radialGradient id="fcamLens" cx="34%" cy="30%">
            <stop offset="0%"   stopColor="#a0f2ff"/>
            <stop offset="22%"  stopColor="#22d3ee"/>
            <stop offset="58%"  stopColor="#0369a1"/>
            <stop offset="86%"  stopColor="#1e3a8a"/>
            <stop offset="100%" stopColor="#020810"/>
          </radialGradient>
          <linearGradient id="fshelf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e6e8ec"/>
            <stop offset="50%"  stopColor="#cdd0d8"/>
            <stop offset="100%" stopColor="#c0c4cc"/>
          </linearGradient>
          <linearGradient id="fscan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={item.color} stopOpacity="0.5"/>
            <stop offset="100%" stopColor={item.color} stopOpacity="0"/>
          </linearGradient>
          {BINS.map((b,i)=>(
            <linearGradient key={i} id={`fbl${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={b.col}/>
              <stop offset="100%" stopColor={b.dark}/>
            </linearGradient>
          ))}
          <clipPath id="fcbay"><rect x="27" y="19" width={W-54} height="58" rx="11"/></clipPath>
          <linearGradient id="fcambeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#60d8ff" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#60d8ff" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* ═══ CABINET OUTER BODY ═══ */}
        <rect width={W} height={H-24} rx="16" fill="url(#fbody)"/>
        {/* INSERT WASTE label on the top rim of the cabinet */}
        {phase==="idle" && (
          <text x={W/2} y="16" textAnchor="middle" fontSize="7" fontWeight="700"
            fill="#7a8898" letterSpacing="1.5">▼  INSERT WASTE HERE</text>
        )}
        <g transform="translate(0, 18)">

        {/* ═══ WASTE INPUT HOUSING (y 10–154) ═══ */}
        <rect x="10" y="10" width={W-20} height="145" rx="13" fill="black" opacity="0.20"/>
        <rect x="13" y="13" width={W-26} height="139" rx="11" fill="#0d1018"/>

        {/* ── WASTE INPUT OPENING ── */}
        <rect x="24" y="16" width={W-48} height="64" rx="13" fill="black" opacity="0.45"/>
        <rect x="27" y="19" width={W-54} height="58" rx="11" fill="#020304"/>
        <rect x="30" y="20" width={W-60} height="6"  rx="4"  fill="white" opacity="0.05"/>
        <rect x="30" y="74" width={W-60} height="3"  rx="2"  fill="black" opacity="0.30"/>
        <rect x="30" y="22" width="5"    height="52" rx="3"  fill="white" opacity="0.022"/>
        <rect x={W-35} y="22" width="5"  height="52" rx="3"  fill="black" opacity="0.35"/>

        {/* LED ring around opening */}
        {scanning ? (
          <motion.rect x="24" y="16" width={W-48} height="64" rx="13" fill="none"
            stroke="#0ea5e9" strokeWidth="2.5"
            animate={{opacity:[0.35,1,0.35]}} transition={{duration:0.7,repeat:Infinity}}
            style={{filter:"drop-shadow(0 0 12px #0ea5e9)"}}/>
        ) : detected ? (
          <rect x="24" y="16" width={W-48} height="64" rx="13" fill="none"
            stroke="#22c55e" strokeWidth="2"
            style={{filter:"drop-shadow(0 0 8px #22c55e)"}}/>
        ) : (
          <rect x="24" y="16" width={W-48} height="64" rx="13" fill="none"
            stroke="#1d2d42" strokeWidth="1.5"/>
        )}


        {/* Top status LED strip */}
        {[-20,-10,0,10,20].map((dx,j)=>(
          <circle key={j} cx={W/2+dx} cy="17" r="1.8"
            fill={scanning?"#0ea5e9":detected?"#22c55e":"#1a2d45"}
            opacity={scanning||detected?0.9:0.4}
            style={(scanning||detected)?{filter:`drop-shadow(0 0 3px ${scanning?"#0ea5e9":"#22c55e"})`}:undefined}/>
        ))}

        {/* Camera mounted at top of opening, looking DOWN into the bin */}
        <rect x={W/2-14} y="20" width="28" height="16" rx="5"
          fill="#0a0c14" stroke="#1a2438" strokeWidth="1"/>
        <circle cx={W/2} cy="28" r="9"   fill="#060810" stroke="#182035" strokeWidth="1.2"/>
        <circle cx={W/2} cy="28" r="6"   fill="url(#fcamLens)"/>
        <circle cx={W/2} cy="28" r="2.5" fill="#0369a1" opacity="0.85"/>
        <circle cx={W/2-1.8} cy="26.5" r="1.5" fill="white" opacity="0.28"/>
        {/* Light cone projecting downward from camera lens */}
        <motion.polygon
          points={`${W/2-2},31 ${W/2+2},31 ${W/2+44},75 ${W/2-44},75`}
          fill="url(#fcambeam)"
          clipPath="url(#fcbay)"
          style={{mixBlendMode:"screen"}}
          animate={{opacity:[0.45,0.9,0.45]}}
          transition={{duration:2.2,repeat:Infinity,ease:"easeInOut"}}/>

        {/* Scan line sweeping inside opening */}
        {scanning && (
          <motion.rect x="29" y="21" width={W-58} height="3" rx="1.5"
            fill="#0ea5e9" opacity="0.9"
            animate={{y:[21,71,21]}} transition={{duration:1.3,repeat:Infinity,ease:"easeInOut"}}
            clipPath="url(#fcbay)"
            style={{filter:"drop-shadow(0 0 6px #0ea5e9)"}}/>
        )}

        {/* ── Speaker grille (left housing margin) ── */}
        {[0,1,2,3,4,5].map(j=>(
          <rect key={j} x="13" y={96+j*9} width="9" height="3.5" rx="1.5"
            fill="#081420" stroke="#0d1e30" strokeWidth="0.3"/>
        ))}

        {/* ── AI Display Screen ── */}
        <rect x="16" y="88" width={W-32} height="58" rx="9" fill="#070a12"/>
        <rect x="16" y="88" width={W-32} height="58" rx="9" fill="none" stroke="#16202e" strokeWidth="1"/>
        <rect x="18" y="90" width={W-36} height="4" rx="3" fill="white" opacity="0.04"/>
        {Array.from({length:7},(_,j)=>(
          <rect key={j} x="18" y={91+j*8} width={W-36} height="0.8" rx="0.4" fill="white" opacity="0.012"/>
        ))}
        {/* AI screen messages */}
        <AnimatePresence mode="wait">
          {phase==="hovering" && (
            <motion.g key="hover" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <motion.text x={W/2} y="120" textAnchor="middle" fontSize="10" fontWeight="700"
                fill="#fcd34d" animate={{opacity:[0.6,1,0.6]}} transition={{duration:0.5,repeat:Infinity}}>
                Item detected...
              </motion.text>
              <text x={W/2} y="134" textAnchor="middle" fontSize="7.5" fill="#9a8020">Hold still for scan</text>
            </motion.g>
          )}
          {phase==="scanning" && (
            <motion.g key="scan" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <motion.text x={W/2} y="112" textAnchor="middle" fontSize="9.5" fontWeight="700"
                fill="#38bdf8" animate={{opacity:[0.5,1,0.5]}} transition={{duration:0.6,repeat:Infinity}}>
                Analysing waste...
              </motion.text>
              <rect x="38" y="120" width={W-76} height="6" rx="3" fill="#0c1a28"/>
              <motion.rect x="38" y="120" width={(scanPct/100)*(W-76)} height="6" rx="3"
                fill="#0ea5e9" style={{filter:"drop-shadow(0 0 4px #0ea5e9)"}}/>
              <text x={W/2} y="138" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#38bdf8">
                {Math.round(scanPct)}%
              </text>
            </motion.g>
          )}
          {detected && (
            <motion.g key="det" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <rect x="20" y="93" width={W-52} height="16" rx="4" fill={item.color} opacity="0.15"/>
              <text x={W/2} y="105" textAnchor="middle" fill={item.color}
                fontSize="8" fontWeight="800" letterSpacing="0.5"
                style={{filter:`drop-shadow(0 0 6px ${item.color}99)`}}>
                {item.id.toUpperCase()} · {item.label}
              </text>
              <text x={W/2} y="120" textAnchor="middle" fontSize="10" fontWeight="700" fill={item.color}>
                → {BINS[item.binIdx].label} BIN
              </text>
              <text x={W/2} y="134" textAnchor="middle" fontSize="7.5" fill="#4ade80">
                ✓ 95% confidence
              </text>
            </motion.g>
          )}
        </AnimatePresence>


        {/* ── Animated waste item (falls into opening) ── */}
        <AnimatePresence>
          {phase!=="idle" && (
            <motion.g
              initial={{x:W/2,y:-30,opacity:0,scale:0.2,rotate:-90}}
              animate={
                (phase==="hovering"||phase==="scanning")
                  ? {x:W/2,y:60,opacity:1,scale:0.65,rotate:0}
                  : phase==="detected"
                  ? {x:W/2,y:60,opacity:1,scale:0.65,rotate:0}
                  : {x:BIN_CENTERS[item.binIdx],y:215,opacity:0,scale:0.4,rotate:180}
              }
              transition={
                phase==="hovering"?{type:"spring",bounce:0.4,duration:0.5}
                :phase==="sorted"?{duration:0.7,ease:"easeIn"}
                :{duration:0.3}
              }
            >
              <motion.text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fontSize="30"
                animate={{rotate:phase==="scanning"?[0,-12,12,0]:0}}
                transition={{duration:0.4,repeat:Infinity}}
                style={{filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.7))"}}>
                {item.emoji}
              </motion.text>
              {phase==="scanning" && (
                <motion.circle cx="0" cy="0" r="22" fill="none"
                  stroke={item.color} strokeWidth="2.5"
                  initial={{strokeDasharray:"0 138",rotate:-90}}
                  animate={{strokeDasharray:`${(scanPct/100)*138} 138`,rotate:-90}}
                  style={{filter:`drop-shadow(0 0 5px ${item.color})`}}/>
              )}
            </motion.g>
          )}
        </AnimatePresence>
        </g>

        {/* ═══ BIN SECTION ═══ */}

        {BINS.map((b,i)=>{
          const bx      = BX[i];
          const iconY   = BY + Math.round(BH * 0.45);
          const isActive = detected && item.binIdx === i;

          return (
            <g key={i}>
              {/* Drop shadow */}
              <rect x={bx+2} y={BY+4} width={BW} height={BH} rx="10"
                fill="black" opacity="0.28"/>

              {/* Main colored body */}
              <rect x={bx} y={BY} width={BW} height={BH} rx="10"
                fill={b.col}
                style={isActive ? {filter:`drop-shadow(0 0 10px ${b.light}99)`} : undefined}/>

              {/* Top specular */}
              <rect x={bx+3} y={BY+3} width={BW-6} height="8" rx="4"
                fill="white" opacity="0.14"/>


              {/* Border for dark trash bin */}
              {i === 3 && (
                <rect x={bx} y={BY} width={BW} height={BH} rx="10"
                  fill="none" stroke="#505050" strokeWidth="1.5"/>
              )}

              {/* ── 洞口 (waste input slot) ── */}
              <rect x={bx+8} y={BY+12} width={BW-16} height="26" rx="6"
                fill="black" opacity="0.65"/>
              <rect x={bx+10} y={BY+14} width={BW-20} height="22" rx="5"
                fill="#0a0a0a"/>
              <rect x={bx+10} y={BY+14} width={BW-20} height="5" rx="4"
                fill="white" opacity="0.06"/>
              <rect x={bx+10} y={BY+28} width={BW-20} height="8" rx="4"
                fill="black" opacity="0.65"/>
              <rect x={bx+8} y={BY+10} width={BW-16} height="3" rx="2"
                fill="white" opacity="0.22"/>

              {/* Icon */}
              <text x={bx+BW/2} y={iconY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="24" fill="white" opacity={isActive ? 1 : 0.85}>
                {b.icon}
              </text>

              {/* Label */}
              <text x={bx+BW/2} y={BY+BH-20}
                textAnchor="middle" fontSize="7" fontWeight="800"
                fill="white" letterSpacing="0.5" opacity="0.95">
                {b.label}
              </text>

              {/* Fill % */}
              <text x={bx+BW/2} y={BY+BH-8}
                textAnchor="middle" fontSize="7.5" fontWeight="700"
                fill="white" opacity="0.75">
                {fills[i]}%
              </text>

              {/* Active glow ring */}
              {isActive && (
                <motion.rect x={bx-2} y={BY-2} width={BW+4} height={BH+4} rx="11"
                  fill="none" stroke={b.light} strokeWidth="2"
                  animate={{opacity:[0.3,1,0.3]}} transition={{duration:0.6,repeat:Infinity}}
                  style={{filter:`drop-shadow(0 0 8px ${b.light})`}}/>
              )}
            </g>
          );
        })}

        {/* ═══ BOTTOM RIM ═══ */}
        <rect x="0" y="356" width={W} height="4" rx="2" fill="#b4b9c4" opacity="0.85"/>

        {/* ═══ CASTER WHEELS ═══ */}
        {[36, W-36].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-32} width="24" height="12" rx="3" fill="#9ca3af"/>
            <rect x={wx-10} y={H-30} width="20" height="8"  rx="2" fill="#d4d8df"/>
            <rect x={wx-8}  y={H-20} width="16" height="9"  rx="2.5" fill="#6b7280"/>
            <circle cx={wx} cy={H-10} r="11"  fill="#1f2937"/>
            <circle cx={wx} cy={H-10} r="7.5" fill="#2d3748"/>
            <circle cx={wx} cy={H-10} r="3.5" fill="#4a5568"/>
            <ellipse cx={wx-3} cy={H-13} rx="2.5" ry="1.5" fill="white" opacity="0.11"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RIGHT FACE  (168 × 368)
═══════════════════════════════════════════════════════════════ */
function SideFaceContent() {
  return <>
    {/* Recessed pull handle */}
    {/* Outer surround — inset into panel */}
    <rect x={D/2-32} y={H/2-18} width="64" height="36" rx="8"
      fill="#a8acb8" stroke="#9298a8" strokeWidth="1"/>
    {/* Recessed cavity — dark hollow where fingers go */}
    <rect x={D/2-28} y={H/2-14} width="56" height="28" rx="6"
      fill="#1a1c22"/>
    {/* Top shadow inside cavity */}
    <rect x={D/2-28} y={H/2-14} width="56" height="8" rx="4"
      fill="black" opacity="0.4"/>
    {/* Grip bar */}
    <rect x={D/2-22} y={H/2-5} width="44" height="10" rx="5"
      fill="#b8bcc8" stroke="#9ea2ae" strokeWidth="0.8"/>
    <rect x={D/2-20} y={H/2-4} width="40" height="4" rx="2"
      fill="white" opacity="0.18"/>
  </>;
}

function RightFace({ ex }:{ ex:number }) {
  return (
    <Face w={D} h={H} tf={`rotateY(90deg) translateZ(${HW+ex}px)`}>
      <svg width={D} height={H} viewBox={`0 0 ${D} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={D} height={H-24} rx="16" fill="#e2e5ec"/>
        <rect x="1" y="1" width={D-2} height={H-26} rx="15" fill="none" stroke="#bcc0ca" strokeWidth="1"/>
        <SideFaceContent/>
        {[36, D-36].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-32} width="24" height="12" rx="3" fill="#9ca3af"/>
            <rect x={wx-10} y={H-30} width="20" height="8"  rx="2" fill="#d4d8df"/>
            <rect x={wx-8}  y={H-20} width="16" height="9"  rx="2.5" fill="#6b7280"/>
            <circle cx={wx} cy={H-10} r="11"  fill="#1f2937"/>
            <circle cx={wx} cy={H-10} r="7.5" fill="#2d3748"/>
            <circle cx={wx} cy={H-10} r="3.5" fill="#4a5568"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT FACE  (168 × 368)
═══════════════════════════════════════════════════════════════ */
function LeftFace({ hidden, ex }:{ hidden:boolean; ex:number }) {
  return (
    <Face w={D} h={H} tf={`rotateY(-90deg) translateZ(${HW+ex}px)`} hidden={hidden}>
      <svg width={D} height={H} viewBox={`0 0 ${D} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={D} height={H-24} rx="16" fill="#dde0e8"/>
        <rect x="1" y="1" width={D-2} height={H-26} rx="15" fill="none" stroke="#bcc0ca" strokeWidth="1"/>
        <SideFaceContent/>
        {[36, D-36].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-32} width="24" height="12" rx="3" fill="#9ca3af"/>
            <rect x={wx-10} y={H-30} width="20" height="8"  rx="2" fill="#d4d8df"/>
            <rect x={wx-8}  y={H-20} width="16" height="9"  rx="2.5" fill="#6b7280"/>
            <circle cx={wx} cy={H-10} r="11"  fill="#1f2937"/>
            <circle cx={wx} cy={H-10} r="7.5" fill="#2d3748"/>
            <circle cx={wx} cy={H-10} r="3.5" fill="#4a5568"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BACK FACE  (280 × 368)
═══════════════════════════════════════════════════════════════ */
function BackFace({ ex }:{ ex:number }) {

  return (
    <Face w={W} h={H} tf={`rotateY(180deg) translateZ(${HD+ex}px)`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bb" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#b8bcc6"/>
            <stop offset="5%"   stopColor="#dde0e8"/>
            <stop offset="95%"  stopColor="#dde0e8"/>
            <stop offset="100%" stopColor="#b0b5bf"/>
          </linearGradient>
        </defs>
        <rect width={W} height={H-24} rx="16" fill="url(#bb)"/>
        <rect x="1" y="1" width={W-2} height={H-26} rx="15" fill="none" stroke="#c4c8d0" strokeWidth="1"/>


        {/* ── Clean minimal door seam ── */}
        <rect x="14" y="14" width={W-28} height="316" rx="11"
          fill="none" stroke="#9ea4ae" strokeWidth="1"/>
        <rect x="15" y="15" width={W-30} height="314" rx="10"
          fill="none" stroke="white" strokeWidth="0.6" opacity="0.6"/>

        {/* ── Door hinges (left side) ── */}
        {[60, 280].map((hy,i)=>(
          <g key={i}>
            <rect x="10" y={hy} width="14" height="28" rx="3" fill="#a0a8b4" stroke="#8890a0" strokeWidth="0.8"/>
            <rect x="11" y={hy+2} width="12" height="24" rx="2" fill="#b8bec8"/>
            <circle cx="17" cy={hy+14} r="2.5" fill="#8890a0"/>
            <rect x="13" y={hy+4} width="8" height="2" rx="1" fill="white" opacity="0.2"/>
          </g>
        ))}

        {/* ── Pull handle (right side, inside door) ── */}
        <rect x={W-44} y="160" width="20" height="38" rx="6"
          fill="#b0b6c0" stroke="#9298a8" strokeWidth="0.8"/>
        <rect x={W-43} y="161" width="18" height="36" rx="5"
          fill="#c4cad4"/>
        {/* Recessed grip cavity */}
        <rect x={W-41} y="166" width="14" height="26" rx="7"
          fill="#1a1c22" stroke="#2a2e38" strokeWidth="0.6"/>
        {/* Grip bar */}
        <rect x={W-39} y="172" width="10" height="14" rx="5"
          fill="#0e1018"/>
        <rect x={W-38} y="174" width="8" height="3" rx="1.5"
          fill="white" opacity="0.08"/>

        {/* ── Charging port (bottom-left) ── */}
        <rect x="22" y={H-78} width="52" height="34" rx="7"
          fill="#b0b4be" stroke="#9298a8" strokeWidth="1"/>
        <rect x="25" y={H-75} width="46" height="28" rx="5"
          fill="#1a1c24"/>
        {/* DC barrel connector */}
        <circle cx="48" cy={H-61} r="10" fill="#0e1018" stroke="#2a2e3a" strokeWidth="1"/>
        <circle cx="48" cy={H-61} r="6"  fill="#161820"/>
        <circle cx="48" cy={H-61} r="2.5" fill="#080a0e"/>
        <circle cx="48" cy={H-61} r="1"  fill="#22d3ee" opacity="0.7"/>

        {[36, W-36].map((wx,i)=>(
          <g key={i}>
            <rect x={wx-12} y={H-32} width="24" height="12" rx="3" fill="#9ca3af"/>
            <rect x={wx-10} y={H-30} width="20" height="8"  rx="2" fill="#d4d8df"/>
            <rect x={wx-8}  y={H-20} width="16" height="9"  rx="2.5" fill="#6b7280"/>
            <circle cx={wx} cy={H-10} r="11"  fill="#1f2937"/>
            <circle cx={wx} cy={H-10} r="7.5" fill="#2d3748"/>
            <circle cx={wx} cy={H-10} r="3.5" fill="#4a5568"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP FACE  (280 × 168)
═══════════════════════════════════════════════════════════════ */
function TopFace({ scanActive, ex }:{ scanActive:boolean; ex:number }) {
  return (
    <Face w={W} h={D} tf={`rotateX(90deg) translateZ(${HH+ex}px)`}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#dde0e8"/>
            <stop offset="100%" stopColor="#cdd1d9"/>
          </linearGradient>
          <radialGradient id="thole" cx="50%" cy="45%" r="55%">
            <stop offset="0%"   stopColor="#010305"/>
            <stop offset="55%"  stopColor="#030810"/>
            <stop offset="100%" stopColor="#080f1c"/>
          </radialGradient>
        </defs>
        <rect width={W} height={D} rx="16" fill="url(#tb)"/>
        <rect x="1" y="1" width={W-2} height={D-2} rx="15" fill="none" stroke="#c4c8d0" strokeWidth="1"/>
        <rect x="0" y="0" width={W} height="8" rx="8" fill="white" opacity="0.16"/>
        <rect x="12" y="38" width={W-24} height={D-50} rx="10" fill="#181e2c"/>
        <rect x="13" y="39" width={W-26} height="5"  rx="4" fill="white" opacity="0.05"/>
        <rect x="13" y="39" width="5"    height={D-52} rx="3" fill="white" opacity="0.04"/>
        <rect x="18" y="44" width={W-36} height={D-56} rx="8" fill="url(#thole)"/>
        <rect x="18" y="44" width={W-36} height="18" rx="7" fill="black" opacity="0.52"/>
        <rect x="18" y="44" width="15"   height={D-56} rx="6" fill="black" opacity="0.38"/>
        <rect x={W-33} y="44" width="15" height={D-56} rx="6" fill="black" opacity="0.14"/>
        <rect x="18" y="44" width={W-36} height={D-56} rx="8" fill="none"
          stroke={scanActive?"#0ea5e9":"#0e1a2e"}
          strokeWidth={scanActive?2:1}
          opacity={scanActive?0.95:0.7}
          style={scanActive?{filter:"drop-shadow(0 0 8px #0ea5e9)"}:undefined}/>
        {scanActive && (
          <motion.rect x="18" y="44" width={W-36} height={D-56} rx="8"
            fill="#0ea5e9" opacity={0}
            animate={{opacity:[0,0.07,0]}}
            transition={{duration:0.8,repeat:Infinity}}/>
        )}
        {[[20,46],[W-20,46],[20,D-14],[W-20,D-14]].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r="2.5"
            fill={scanActive?"#0ea5e9":"#2a3a52"} opacity="0.65"/>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM FACE  (280 × 168)
═══════════════════════════════════════════════════════════════ */
function BottomFace({ ex }:{ ex:number }) {
  return (
    <Face w={W} h={D} tf={`rotateX(-90deg) translateZ(${HH+ex}px)`}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={D} rx="10" fill="#dde0e5"/>
        <rect x="1" y="1" width={W-2} height={D-2} rx="9" fill="none" stroke="#c5c9d1" strokeWidth="1.5"/>
        {[
          [28,28],[W-28,28],[28,D-28],[W-28,D-28]
        ].map(([cx,cy],i)=>(
          <g key={i}>
            <rect x={cx-10} y={cy-12} width="20" height="24" rx="3" fill="#111827"/>
            <rect x={cx-5} y={cy-8} width="10" height="16" fill="#374151"/>
          </g>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL CUTAWAY CROSS-SECTION  (4 bins)
═══════════════════════════════════════════════════════════════ */
function CutawayInterior({ fills }: { fills: number[] }) {
  const glowBlue = "drop-shadow(0 0 4px #22d3ee) drop-shadow(0 0 8px #0ea5e9)";
  return (
    <Face w={W} h={H} tf="translateZ(0px)" opacity={0.97}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="batFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#06b6d4"/>
            <stop offset="60%"  stopColor="#22d3ee"/>
            <stop offset="100%" stopColor="#67e8f9"/>
          </linearGradient>
          <linearGradient id="ciBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#010810"/>
            <stop offset="100%" stopColor="#020c1a"/>
          </linearGradient>
          <radialGradient id="ciGlow1" cx="30%" cy="35%" r="40%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ciGlow2" cx="70%" cy="65%" r="40%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08"/>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="url(#ciBg)"/>
        <rect width={W} height={H} fill="url(#ciGlow1)"/>
        <rect width={W} height={H} fill="url(#ciGlow2)"/>
        <rect x="1" y="1" width={W-2} height={H-2} fill="none" stroke="#0c2a42" strokeWidth="1"/>

        {/* ── Vertical structural rails ── */}
        {[6, W-8].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="8" width="4" height={H-40} rx="2" fill="#0d1f30" stroke="#1a3a54" strokeWidth="0.5"/>
            {Array.from({length:10},(_,j)=>(
              <rect key={j} x={x-1} y={28+j*36} width="6" height="3" rx="1" fill="#1e3a54"/>
            ))}
          </g>
        ))}

        {/* Shelf dividers aligned to front face zones */}
        {[188, 342].map((y,i)=>(
          <rect key={i} x="10" y={y} width={W-20} height="2" rx="1" fill="#0f2030" stroke="#1a3550" strokeWidth="0.4"/>
        ))}

        {/* ══ ZONE 1: AI Housing y=12–186 ══ */}
        <rect x="12" y="12" width={W-24} height="174" rx="6" fill="#050f1c" stroke="#0c2038" strokeWidth="0.8"/>

        {/* Camera — centered at W/2, matching front face */}
        <circle cx={W/2} cy="44" r="22" fill="#030c18" stroke="#0a1e32" strokeWidth="1.2"/>
        <circle cx={W/2} cy="44" r="16" fill="#04111e" stroke="#0e2840" strokeWidth="1"/>
        <circle cx={W/2} cy="44" r="10" fill="#071828" stroke="#1a4060" strokeWidth="0.8"/>
        <circle cx={W/2} cy="44" r="6"  fill="#0a1f35" style={{filter:glowBlue}}/>
        <circle cx={W/2} cy="44" r="3"  fill="#22d3ee" opacity="0.95" style={{filter:glowBlue}}/>
        {/* Light cone downward from camera */}
        <path d={`M${W/2-4},62 L${W/2+4},62 L${W/2+50},182 L${W/2-50},182`} fill="#22d3ee" opacity="0.05"/>

        {/* Left PCB — camera board */}
        <rect x="16" y="20" width="82" height="44" rx="4" fill="#061020" stroke="#0d2040" strokeWidth="0.6"/>
        {Array.from({length:5},(_,i)=>(
          <circle key={i} cx={24+i*14} cy="32" r="2" fill="#22d3ee" opacity="0.55" style={{filter:glowBlue}}/>
        ))}
        {Array.from({length:3},(_,i)=>(
          <rect key={i} x={18+i*24} y="40" width="16" height="8" rx="2" fill="#081828" stroke="#122840" strokeWidth="0.4"/>
        ))}
        <text x="57" y="57" textAnchor="middle" fill="#1e5070" fontSize="5" letterSpacing="0.3">CAMERA PCB</text>

        {/* Right PCB — AI processor */}
        <rect x={W-98} y="20" width="82" height="44" rx="4" fill="#040d1a" stroke="#0d2038" strokeWidth="0.6"/>
        <rect x={W-92} y="26" width="44" height="28" rx="3" fill="#060f1e" stroke="#1a3254" strokeWidth="0.8"/>
        {Array.from({length:4},(_,i)=>(
          <rect key={i} x={W-90+i*10} y="29" width="7" height="22" rx="1.5" fill="#081828" stroke="#122840" strokeWidth="0.3"/>
        ))}
        <circle cx={W-38} cy="30" r="3.5" fill="#22d3ee" opacity="0.5" style={{filter:glowBlue}}/>
        <text x={W-57} y="57" textAnchor="middle" fill="#1e5070" fontSize="5" letterSpacing="0.3">AI PROCESSOR</text>

        {/* AI Display screen y=72–180 */}
        <rect x="18" y="72" width={W-36} height="108" rx="5" fill="#030a16" stroke="#0a1c30" strokeWidth="0.8"/>
        {Array.from({length:8},(_,i)=>(
          <rect key={i} x="22" y={78+i*12} width={W-44} height="7" rx="1" fill="#060e1c" opacity="0.7"/>
        ))}
        <text x={W/2} y="132" textAnchor="middle" fill="#1e4060" fontSize="6" letterSpacing="0.8">AI DISPLAY</text>

        {/* ══ ZONE 2: Sorting deflector + chutes y=188–208 ══ */}
        <rect x="12" y="188" width={W-24} height="16" rx="3" fill="#040c18" stroke="#0a1c30" strokeWidth="0.6"/>
        <line x1="20" y1="194" x2={W-20} y2="200" stroke="#0d2038" strokeWidth="2" strokeLinecap="round"/>
        {/* 4 servo dots + sorting chute funnels */}
        {[44,121,198,275].map((cx,i)=>(
          <g key={i}>
            <circle cx={cx} cy="196" r="3.5" fill="#040c18" stroke="#1a3050" strokeWidth="0.5"/>
            <circle cx={cx} cy="196" r="1.6" fill="#22d3ee" opacity="0.8" style={{filter:glowBlue}}/>
            {/* Chute funnel channel into each bin */}
            <path d={`M${cx-8},204 L${cx+8},204 L${cx+16},208 L${cx-16},208`}
              fill="#060d1c" stroke="#0d2038" strokeWidth="0.5"/>
          </g>
        ))}

        {/* ══ 4 BINS — aligned to front BX=[10,87,164,241] BY=190 BH=150 ══ */}
        {[
          {x:10,  accent:"#050f2a", stroke:"#1d4ed8", light:"#3b82f6", label:"PLASTIC", fill:fills[0]/100},
          {x:87,  accent:"#120a00", stroke:"#a16207", light:"#eab308", label:"PAPER",   fill:fills[1]/100},
          {x:164, accent:"#041408", stroke:"#15803d", light:"#22c55e", label:"ORGANIC", fill:fills[2]/100},
          {x:241, accent:"#080808", stroke:"#374151", light:"#6b7280", label:"TRASH",   fill:fills[3]/100},
        ].map(b=>{
          const bw=69, bh=130, by=208;
          const fillH = bh * b.fill;
          return (
            <g key={b.label}>
              <rect x={b.x} y={by} width={bw} height={bh} rx="4"
                fill={b.accent} stroke={b.stroke} strokeWidth="0.8"/>
              <rect x={b.x+2} y={by+bh-fillH} width={bw-4} height={fillH} rx="3"
                fill={b.stroke} opacity="0.3"/>
              {b.fill>0 && <rect x={b.x+4} y={by+bh-fillH} width={bw-8} height="2" rx="1"
                fill={b.light} opacity="0.8" style={{filter:`drop-shadow(0 0 3px ${b.light})`}}/>}
              <text x={b.x+bw/2} y={by+18} textAnchor="middle" fontSize="10" fontWeight="800" fill={b.light} opacity="0.9">
                {Math.round(b.fill*100)}%
              </text>
              <text x={b.x+bw/2} y={by+bh-6} textAnchor="middle" fontSize="5" fontWeight="700" fill={b.light} letterSpacing="0.3">
                {b.label}
              </text>
            </g>
          );
        })}


        {/* ══ ZONE 3: Backup Battery Pack y=346–408 ══ */}
        <rect x="12" y="346" width={W-24} height="60" rx="6" fill="#040c14" stroke="#0a1c2c" strokeWidth="0.8"/>
        {/* Label */}
        <text x={W/2} y="360" textAnchor="middle" fontSize="6" fontWeight="700" fill="#22d3ee" letterSpacing="1"
          style={{filter:glowBlue}}>BACKUP BATTERY  ·  12V 22Ah  ·  Li-ion</text>
        {/* Battery body */}
        <rect x="32" y="365" width={W-64} height="32" rx="6" fill="#060e1c" stroke="#0d2038" strokeWidth="1"/>
        {/* Negative terminal (left) */}
        <rect x="20" y="374" width="14" height="14" rx="3" fill="#0a1828" stroke="#122030" strokeWidth="0.8"/>
        {/* Positive terminal (right) */}
        <rect x={W-34} y="374" width="14" height="14" rx="3" fill="#0a1828" stroke="#122030" strokeWidth="0.8"/>
        {/* Charge fill track */}
        <rect x="38" y="376" width={W-76} height="6" rx="3" fill="#030810" stroke="#0a1828" strokeWidth="0.5"/>
        {/* Charge fill (82%) with gradient */}
        <rect x="40" y="377" width={(W-80)*0.90} height="4" rx="2" fill="url(#batFill)" opacity="0.75"/>
        {/* Percentage label — right end of fill */}
        <text x={40+(W-80)*0.90} y="374" textAnchor="end" fontSize="5.5" fontWeight="700"
          fill="#22d3ee" letterSpacing="0.5" style={{filter:glowBlue}}>90%</text>
        {/* DC charging cable from back */}
        <path d={`M${W-20},379 Q${W-10},379 ${W-10},350`} fill="none" stroke="#22d3ee" strokeWidth="1.5"
          strokeDasharray="3 2" opacity="0.45" style={{filter:glowBlue}}/>
        {/* Power Control Unit (PCU) — right of battery */}
        <rect x={W-30} y="350" width="16" height="42" rx="3" fill="#04091a" stroke="#0d1e30" strokeWidth="0.6"/>
        {[0,1,2].map(j=>(
          <rect key={j} x={W-28} y={354+j*12} width="12" height="8" rx="1.5" fill="#060e1c" stroke="#102030" strokeWidth="0.3"/>
        ))}
        <text x={W-22} y="396" textAnchor="middle" fontSize="4" fill="#1a4060" letterSpacing="0.3">PCU</text>

        {/* ── Wiring ── */}
        {[
          {x1:W/2, y1:66, x2:W/2, y2:72, c:"#22d3ee"},
          {x1:44,  y1:204,x2:44,  y2:208, c:"#3b82f6"},
          {x1:121, y1:204,x2:121, y2:208, c:"#eab308"},
          {x1:198, y1:204,x2:198, y2:208, c:"#22c55e"},
          {x1:275, y1:204,x2:275, y2:208, c:"#6b7280"},
          {x1:20,  y1:338,x2:20,  y2:346, c:"#f87171"},
          {x1:W-20,y1:338,x2:W-20,y2:346,c:"#f87171"},
        ].map((l,i)=>(
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.c} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6"
            style={{filter:`drop-shadow(0 0 2px ${l.c})`}}/>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPLODED INTERNALS (3D component slabs)
═══════════════════════════════════════════════════════════════ */
function ExplodedInternals(_: { fills: number[] }) {
  const gBlue  = "drop-shadow(0 0 4px #22d3ee)";
  const gAmber = "drop-shadow(0 0 3px #fbbf24)";
  // Slab face: w=W-20=300, h=D-20=148
  // X in slab = front-face X - 10  (slab is 10px narrower each side)
  // Bin slab X: BX-10 = [0, 77, 154, 231], BW=69
  // Bin servo centers: [35, 112, 189, 266]
  const SW = W-20, SD = D-20;           // slab width=300, depth=148
  const SBX = [0, 77, 154, 231];        // bin X in slab (aligned to front face BX-10)
  const SBW = 69;                        // bin width = front face BW
  const SC  = [35, 112, 189, 266];      // servo centers above each bin

  return (
    <>
      {/* ══ Layer 1: AI Brain Housing ══ */}
      <Face w={SW} h={SD} tf="translateY(-160px) rotateX(90deg)" opacity={0.95}>
        <svg width={SW} height={SD} viewBox={`0 0 ${SW} ${SD}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={SW} height={SD} rx="8" fill="#040c18" stroke="#0a1e34" strokeWidth="1.5"/>
          {/* PCB grid lines */}
          {Array.from({length:10},(_,i)=>(
            <line key={i} x1={i*30} y1="0" x2={i*30} y2={SD} stroke="#061628" strokeWidth="0.4"/>
          ))}
          {/* Camera — centered at SW/2=150, near front (y≈90) matching front face center */}
          <circle cx={SW/2} cy="90" r="22" fill="#030c18" stroke="#0e2840" strokeWidth="1.5"/>
          <circle cx={SW/2} cy="90" r="16" fill="#040f20" stroke="#122a44" strokeWidth="1"/>
          <circle cx={SW/2} cy="90" r="10" fill="#060f1e" stroke="#1a3454" strokeWidth="1"/>
          <circle cx={SW/2} cy="90" r="5"  fill="#08121e" style={{filter:gBlue}}/>
          <circle cx={SW/2} cy="90" r="3"  fill="#22d3ee" opacity="0.9" style={{filter:gBlue}}/>
          <text x={SW/2} y="118" textAnchor="middle" fontSize="5" fill="#1a4060" letterSpacing="0.5">CAMERA</text>
          {/* Camera PCB — left of center */}
          <rect x="8" y="14" width="92" height="48" rx="4" fill="#061020" stroke="#0d2040" strokeWidth="0.6"/>
          {Array.from({length:5},(_,i)=>(
            <circle key={i} cx={16+i*16} cy="28" r="2.5" fill="#22d3ee" opacity={0.55} style={{filter:gBlue}}/>
          ))}
          {[0,1,2].map(i=>(
            <rect key={i} x={10+i*28} y="38" width="22" height="10" rx="2" fill="#081828" stroke="#122840" strokeWidth="0.4"/>
          ))}
          <text x="54" y="56" textAnchor="middle" fill="#1e5070" fontSize="5">CAMERA PCB</text>
          {/* AI Processor (Raspberry Pi) — right of center */}
          <rect x="200" y="14" width="92" height="48" rx="4" fill="#040d1a" stroke="#0d2038" strokeWidth="0.6"/>
          <rect x="208" y="20" width="44" height="28" rx="3" fill="#060f1e" stroke="#1a3254" strokeWidth="0.8"/>
          {Array.from({length:4},(_,i)=>(
            <rect key={i} x={210+i*10} y="23" width="7" height="22" rx="1.5" fill="#081828" stroke="#122840" strokeWidth="0.3"/>
          ))}
          <circle cx="264" cy="24" r="3.5" fill="#22d3ee" opacity="0.5" style={{filter:gBlue}}/>
          <text x="246" y="56" textAnchor="middle" fill="#1e5070" fontSize="5">RASPBERRY PI</text>
          {/* Display — front edge, full width */}
          <rect x="8" y="110" width={SW-16} height="24" rx="4" fill="#030a16" stroke="#0a1c30" strokeWidth="0.8"/>
          {Array.from({length:6},(_,i)=>(
            <rect key={i} x={10+i*46} y="114" width="40" height="16" rx="2" fill="#060e1c" opacity="0.7"/>
          ))}
          <text x={SW/2} y="127" textAnchor="middle" fill="#1e4060" fontSize="5" letterSpacing="0.5">AI DISPLAY SCREEN</text>
          {/* Speaker — left margin (matches front face speaker grille) */}
          {[0,1,2,3].map(j=>(
            <rect key={j} x="2" y={30+j*16} width="6" height="6" rx="1.5" fill="#0a1828" opacity="0.8"/>
          ))}
        </svg>
      </Face>

      {/* ══ Layer 2: Sorting Mechanism ══ */}
      <Face w={SW} h={SD} tf="translateY(-50px) rotateX(90deg)" opacity={0.95}>
        <svg width={SW} height={SD} viewBox={`0 0 ${SW} ${SD}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={SW} height={SD} rx="8" fill="#040e1a" stroke="#0a2030" strokeWidth="1.5"/>
          {/* Arduino board */}
          <rect x="8" y="74" width="110" height="60" rx="4" fill="#050c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          {Array.from({length:8},(_,i)=>(
            <rect key={i} x={12+i*12} y="78" width="9" height="14" rx="1.5" fill="#060e1e" stroke="#0d1e30" strokeWidth="0.3"/>
          ))}
          {[0,1,2].map(i=>(
            <circle key={i} cx={16+i*28} cy="104" r="6" fill="#061020" stroke="#0d2038" strokeWidth="0.6"/>
          ))}
          <text x="63" y="128" textAnchor="middle" fill="#1e5070" fontSize="5">ARDUINO</text>
          {/* 4 servo motors — X aligned to bin centers in slab */}
          {SC.map((cx,i)=>(
            <g key={i}>
              {/* Servo body */}
              <rect x={cx-22} y="8" width="44" height="54" rx="5" fill="#050c1c" stroke="#0d2038" strokeWidth="0.8"/>
              <rect x={cx-18} y="12" width="28" height="22" rx="2" fill="#040a18" stroke="#122030" strokeWidth="0.5"/>
              {/* Servo coil dots */}
              {[0,1,2,3].map(j=>(
                <circle key={j} cx={cx-12+j*8} cy="22" r="2.5" fill="#fbbf24" opacity="0.65" style={{filter:gAmber}}/>
              ))}
              {/* Servo shaft */}
              <circle cx={cx} cy="50" r="9" fill="#040c18" stroke="#0d2038" strokeWidth="0.8"/>
              <circle cx={cx} cy="50" r="5" fill="#060e1e" stroke="#142840" strokeWidth="0.5"/>
              <circle cx={cx} cy="50" r="2.5" fill="#22d3ee" opacity="0.8" style={{filter:gBlue}}/>
              {/* Deflector arm */}
              <rect x={cx-14} y="55" width="28" height="10" rx="3" fill="#040a16" stroke="#a78bfa" strokeWidth="0.8"/>
            </g>
          ))}
          {/* Bus lines */}
          {Array.from({length:4},(_,i)=>(
            <line key={i} x1="8" y1={68+i*3} x2={SW-8} y2={68+i*3} stroke="#0a1e30" strokeWidth="0.7"/>
          ))}
          <text x={SW/2} y={SD-6} textAnchor="middle" fill="#0e2840" fontSize="5" letterSpacing="0.8">SORTING DRIVE BOARD  ·  DEFLECTOR MECHANISM</text>
        </svg>
      </Face>

      {/* ══ Layer 3: Bin Compartments ══ */}
      <Face w={SW} h={SD} tf="translateY(60px) rotateX(90deg)" opacity={0.95}>
        <svg width={SW} height={SD} viewBox={`0 0 ${SW} ${SD}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={SW} height={SD} rx="8" fill="#040a14" stroke="#081828" strokeWidth="1.5"/>
          {/* 4 bins — X positions aligned to front face BX-10 */}
          {([
            {stroke:"#1d4ed8", light:"#3b82f6", label:"PLASTIC"},
            {stroke:"#a16207", light:"#eab308", label:"PAPER"},
            {stroke:"#15803d", light:"#22c55e", label:"ORGANIC"},
            {stroke:"#374151", light:"#6b7280", label:"TRASH"},
          ] as {stroke:string,light:string,label:string}[]).map((b,i)=>(
            <g key={i}>
              <rect x={SBX[i]} y="6" width={SBW} height={SD-16} rx="5"
                fill="#040c18" stroke={b.stroke} strokeWidth="1.2"/>
              {/* Inner ridges */}
              {Array.from({length:4},(_,j)=>(
                <line key={j} x1={SBX[i]+6} y1={20+j*20} x2={SBX[i]+SBW-6} y2={20+j*20}
                  stroke={b.stroke} strokeWidth="0.4" opacity="0.25"/>
              ))}
              {/* Status dot */}
              <circle cx={SBX[i]+SBW/2} cy={SD-12} r="3.5"
                fill={b.light} opacity="0.8" style={{filter:`drop-shadow(0 0 3px ${b.light})`}}/>
              {/* Label */}
              <text x={SBX[i]+SBW/2} y="16" textAnchor="middle" fontSize="5" fontWeight="700"
                fill={b.light} letterSpacing="0.3">{b.label}</text>
            </g>
          ))}
        </svg>
      </Face>

      {/* ══ Layer 4: Power Base ══ */}
      <Face w={SW} h={SD} tf="translateY(170px) rotateX(90deg)" opacity={0.95}>
        <svg width={SW} height={SD} viewBox={`0 0 ${SW} ${SD}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={SW} height={SD} rx="8" fill="#040810" stroke="#081420" strokeWidth="1.5"/>
          {/* Battery pack — full width */}
          <rect x="8" y="10" width={SW-42} height={SD-24} rx="6" fill="#060e1c" stroke="#0d2038" strokeWidth="1"/>
          {/* Cell indicators */}
          {Array.from({length:6},(_,i)=>(
            <g key={i}>
              <rect x={14+i*40} y="18" width="32" height={SD-44} rx="3" fill="#040a18" stroke="#0a1c30" strokeWidth="0.6"/>
              <circle cx={30+i*40} cy={(SD-20)/2} r="5" fill="#22d3ee" opacity="0.65" style={{filter:gBlue}}/>
            </g>
          ))}
          {/* Terminals */}
          <rect x="8"    y="28" width="8" height="12" rx="2" fill="#0a1828"/>
          <rect x={SW-42} y="28" width="8" height="12" rx="2" fill="#0a1828"/>
          <text x={(SW-42)/2+8} y={SD-8} textAnchor="middle" fill="#0e2840" fontSize="5" letterSpacing="0.8">BACKUP BATTERY PACK  ·  12V 22Ah  ·  Li-ion</text>
          {/* Power Control Unit (PCU) — right */}
          <rect x={SW-30} y="10" width="22" height={SD-24} rx="4" fill="#04091a" stroke="#0d1e30" strokeWidth="0.6"/>
          {[0,1,2,3].map(j=>(
            <rect key={j} x={SW-28} y={16+j*20} width="18" height="12" rx="2" fill="#060e1c" stroke="#102030" strokeWidth="0.3"/>
          ))}
          <text x={SW-19} y={SD-8} textAnchor="middle" fontSize="4" fill="#1a4060">PCU</text>
        </svg>
      </Face>

      {/* ── 3D Edge strips — give each layer real depth ── */}
      {([
        { Y:-160, color:"#22d3ee" },
        { Y: -50, color:"#f59e0b" },
        { Y:  60, color:"#3b82f6" },
        { Y: 170, color:"#f87171" },
      ] as {Y:number, color:string}[]).flatMap(({Y, color}, i)=>[
        /* Front face edge */
        <Face key={`f${i}`} w={W-20} h={18}
          tf={`translateY(${Y+9}px) translateZ(${(D-20)/2}px)`}
          style={{ borderRadius:3, backfaceVisibility:"visible" as const }}
          opacity={0.92}>
          <svg width={W-20} height={18} viewBox={`0 0 ${W-20} 18`} xmlns="http://www.w3.org/2000/svg">
            <rect width={W-20} height={18} fill="#050c1c"/>
            <rect width={W-20} height={4} fill={color} opacity={0.12}/>
            <rect x="0" y="14" width={W-20} height={4} fill="black" opacity={0.3}/>
            <line x1="0" y1="0" x2={W-20} y2="0" stroke={color} strokeWidth="1.2" opacity={0.9}/>
          </svg>
        </Face>,
        /* Right side edge */
        <Face key={`r${i}`} w={D-20} h={18}
          tf={`translateY(${Y+9}px) rotateY(90deg) translateZ(${(W-20)/2}px)`}
          style={{ borderRadius:3, backfaceVisibility:"visible" as const }}
          opacity={0.85}>
          <svg width={D-20} height={18} viewBox={`0 0 ${D-20} 18`} xmlns="http://www.w3.org/2000/svg">
            <rect width={D-20} height={18} fill="#040b18"/>
            <line x1="0" y1="0" x2={D-20} y2="0" stroke={color} strokeWidth="1.2" opacity={0.8}/>
          </svg>
        </Face>,
        /* Left side edge */
        <Face key={`l${i}`} w={D-20} h={18}
          tf={`translateY(${Y+9}px) rotateY(-90deg) translateZ(${(W-20)/2}px)`}
          style={{ borderRadius:3, backfaceVisibility:"visible" as const }}
          opacity={0.85}>
          <svg width={D-20} height={18} viewBox={`0 0 ${D-20} 18`} xmlns="http://www.w3.org/2000/svg">
            <rect width={D-20} height={18} fill="#040b18"/>
            <line x1="0" y1="0" x2={D-20} y2="0" stroke={color} strokeWidth="1.2" opacity={0.8}/>
          </svg>
        </Face>,
      ])}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPLODED LABELS OVERLAY
═══════════════════════════════════════════════════════════════ */
function ExplodedLabels() {
  const layers = [
    {
      color:"#22d3ee", num:"01", name:"AI BRAIN LAYER",
      items:["Raspberry Pi (AI Processor)","Camera Module","AI Display Screen","LED Scanning Ring","Speaker"],
    },
    {
      color:"#f59e0b", num:"02", name:"SORTING MECHANISM",
      items:["Arduino Microcontroller","4× Servo Motor + Driver","Deflector Flap / Auto Gate","Sorting Chute Channels"],
    },
    {
      color:"#3b82f6", num:"03", name:"BIN COMPARTMENTS",
      items:["Plastic Bin (Blue · 5L)","Paper Bin (Yellow · 5L)","Organic Bin (Green · 5L)","General Bin (Black · 5L)"],
    },
    {
      color:"#f87171", num:"04", name:"POWER BASE",
      items:["Rechargeable Battery Pack (12V 22Ah)","Power Control Unit (PCU)","Charging Port (DC IN)","Wheels / Casters"],
    },
  ];
  return (
    <motion.div
      className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col gap-2 z-20"
      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}
      transition={{ duration:0.3 }}
    >
      {layers.map((layer, i)=>(
        <motion.div key={i}
          className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 shadow-lg"
          initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
          transition={{ delay:i*0.07, duration:0.25 }}
          style={{ borderLeft:`3px solid ${layer.color}` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black" style={{ color:layer.color }}>{layer.num}</span>
            <span className="text-slate-700 text-[10px] font-bold tracking-wide">{layer.name}</span>
          </div>
          {layer.items.map((item,j)=>(
            <div key={j} className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor:layer.color, opacity:0.6 }}/>
              <span className="text-slate-500 text-[9px] whitespace-nowrap">{item}</span>
            </div>
          ))}
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SmartBin3D() {
  const [rotX, setRotX] = useState(-30);
  const [rotY, setRotY] = useState(28);
  const [zoom, setZoom]   = useState(0.92);
  const [viewMode, setViewMode]   = useState<ViewMode>("normal");
  const [autoRotate, setAutoRotate] = useState(false);
  const [phase, setPhase] = useState<SortPhase>("idle");
  const [activeItem, setActiveItem] = useState<WasteItem>(WASTE[0]);
  const [scanPct, setScanPct] = useState(0);
  const [fills, setFills] = useState([29, 18, 43, 7]);

  const drag = useRef<{sx:number;sy:number;rx:number;ry:number}|null>(null);
  const raf  = useRef<number>(0);

  useEffect(()=>{
    if(!autoRotate){ cancelAnimationFrame(raf.current); return; }
    let last=performance.now();
    const tick=(now:number)=>{
      setRotY(y=>y+(now-last)/1000*26);
      last=now;
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf.current);
  },[autoRotate]);

  useEffect(()=>{
    if(phase==="hovering"){
      const t = setTimeout(()=>setPhase("scanning"), 600);
      return ()=>clearTimeout(t);
    }
    if(phase==="scanning") {
      let v=0;
      const iv=setInterval(()=>{
        v+=2.5; setScanPct(Math.min(v,100));
        if(v>=100){ clearInterval(iv); setPhase("detected"); }
      },40);
      return()=>clearInterval(iv);
    }
    if(phase==="detected"){
      const t=setTimeout(()=>{
        setPhase("sorted");
        setFills(prev=>{ const n=[...prev]; n[activeItem.binIdx]=Math.min(n[activeItem.binIdx]+14,95); return n; });
        setTimeout(()=>setPhase("idle"),2400);
      },1800);
      return()=>clearTimeout(t);
    }
  },[phase,activeItem]);

  const onDown=useCallback((e:React.MouseEvent)=>{
    setAutoRotate(false);
    drag.current={sx:e.clientX,sy:e.clientY,rx:rotX,ry:rotY};
  },[rotX,rotY]);
  const onMove=useCallback((e:React.MouseEvent)=>{
    if(!drag.current) return;
    setRotY(drag.current.ry+(e.clientX-drag.current.sx)*0.36);
    setRotX(Math.max(-82,Math.min(82,drag.current.rx-(e.clientY-drag.current.sy)*0.26)));
  },[]);
  const onUp=useCallback(()=>{ drag.current=null; },[]);

  function goPreset(name:string){
    setAutoRotate(false);
    const [rx,ry]=PRESETS[name];
    setRotX(rx); setRotY(ry);
  }

  function triggerSort(item:WasteItem){
    if(phase!=="idle") return;
    setActiveItem(item); setScanPct(0); setPhase("hovering");
  }

  const ex = viewMode==="exploded" ? 72 : 0;
  const cutaway = viewMode==="cutaway";

  const BIN_COLOR_NAMES = ["BLUE","YELLOW","GREEN","BLACK"];

  return (
    <div className="size-full flex flex-col overflow-hidden bg-white">

      {/* ── Brand header ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-20 pointer-events-none">
        <div />
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-slate-400 text-[10px] mr-1">DEMO SORT:</span>
            {WASTE.map(item=>(
              <button key={item.id} onClick={()=>triggerSort(item)}
                disabled={phase!=="idle"}
                className={`text-xl leading-none transition-all ${phase!=="idle"?"opacity-30 cursor-not-allowed":"hover:scale-125 cursor-pointer"}`}
                title={item.label}>
                {item.emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale:[1,1.4,1] }} transition={{ duration:2, repeat:Infinity }}
              style={{ filter:"drop-shadow(0 0 4px #34d399)" }}/>
            <span className="text-emerald-400 text-[10px] font-medium">ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── 3D VIEWPORT ── */}
      <div className="flex-1 relative flex items-center justify-center"
        style={{ cursor: drag.current ? "grabbing" : "grab" }}
        onMouseDown={onDown} onMouseMove={onMove}
        onMouseUp={onUp} onMouseLeave={onUp}
        onWheel={e=>setZoom(z=>Math.max(0.38,Math.min(1.7,z-e.deltaY*0.001)))}>


        <AnimatePresence>
          {!drag.current && (
            <motion.div className="absolute top-16 left-1/2 -translate-x-1/2 text-slate-400 text-xs pointer-events-none font-medium tracking-widest"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
              DRAG TO ROTATE  ·  SCROLL TO ZOOM
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-20 right-6 text-slate-400 text-[10px] font-mono text-right pointer-events-none">
          <div>X {Math.round(rotX)}°</div>
          <div>Y {Math.round(rotY%360)}°</div>
          <div>Z {Math.round(zoom*100)}%</div>
        </div>

        <AnimatePresence>
          {viewMode==="exploded" && <ExplodedLabels/>}
        </AnimatePresence>

        {/* ══ CSS 3D SCENE ══ */}
        <div style={{ perspective:1300, perspectiveOrigin:"50% 50%" }}>
          <motion.div
            animate={{ rotateX:rotX, rotateY:rotY, scale:zoom }}
            transition={{ type:"spring", stiffness:160, damping:28, mass:0.8 }}
            style={{ transformStyle:"preserve-3d", position:"relative", width:0, height:0 }}
          >
            {/* Floor shadow */}
            <Face w={W+100} h={D+50} tf={`rotateX(90deg) translateZ(${HH+2}px)`} opacity={0.5}>
              <div style={{ width:W+100, height:D+50,
                background:"radial-gradient(ellipse, rgba(0,0,0,0.9) 0%, transparent 68%)",
                borderRadius:999 }}/>
            </Face>

            {/* Ambient product glow */}
            <Face w={W+180} h={H+120} tf="translateZ(-50px)" opacity={0.6}>
              <div style={{ width:W+180, height:H+120,
                background:"radial-gradient(ellipse 60% 60% at 50% 40%, rgba(14,165,233,0.06), transparent)",
              }}/>
            </Face>

            {/* ── Six bin faces ── */}
            {(!cutaway) && (
              <FrontFace phase={phase} item={activeItem} fills={fills} scanPct={scanPct} ex={ex}/>
            )}
            <RightFace ex={ex}/>
            <LeftFace hidden={cutaway} ex={ex}/>
            <BackFace ex={ex}/>
            <TopFace scanActive={phase==="scanning"} ex={ex}/>
            <BottomFace ex={ex}/>

            {cutaway && <CutawayInterior fills={fills} />}
            {viewMode === "exploded" && <ExplodedInternals fills={fills} />}
          </motion.div>
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ── */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-6 pb-5 pt-3">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 backdrop-blur-sm shadow-sm">
          <CtrlBtn active={autoRotate} onClick={()=>setAutoRotate(r=>!r)} label="360°"
            title={autoRotate?"Stop Rotation":"Auto Rotate 360°"}/>
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          <CtrlBtn onClick={()=>setZoom(z=>Math.min(1.7,z+0.12))} label="ZOOM +" title="Zoom In"/>
          <CtrlBtn onClick={()=>setZoom(z=>Math.max(0.38,z-0.12))} label="ZOOM −" title="Zoom Out"/>
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          {(["front","back","left","right","top","iso"] as const).map(p=>(
            <CtrlBtn key={p} onClick={()=>goPreset(p)} label={p.toUpperCase()} title={`${p} view`}/>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          <CtrlBtn active={viewMode==="cutaway"} label="CUTAWAY"
            onClick={()=>{ setViewMode(v=>v==="cutaway"?"normal":"cutaway"); goPreset("iso"); }}
            title="Cutaway internal view"/>
          <CtrlBtn active={viewMode==="exploded"} label="EXPLODED VIEW"
            onClick={()=>setViewMode(v=>v==="exploded"?"normal":"exploded")}
            title="Exploded component view"/>
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          <CtrlBtn onClick={()=>{ setRotX(-30); setRotY(28); setZoom(0.92); setViewMode("normal"); setAutoRotate(false); }}
            label="RESET" title="Reset view"/>
        </div>
      </div>

      {/* Scanning badge overlay */}
      <AnimatePresence>
        {(phase==="hovering" || phase==="scanning") && (
          <motion.div
            className="absolute top-20 left-8 flex items-center gap-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-2.5 backdrop-blur-sm"
            initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
            <motion.div className="w-3 h-3 rounded-full bg-amber-400"
              animate={{ scale:[1,1.5,1] }} transition={{ duration:0.7, repeat:Infinity }}
              style={{ filter:"drop-shadow(0 0 5px #fbbf24)" }}/>
            <span className="text-amber-300 text-xs font-bold">AI SCANNING · {Math.round(scanPct)}%</span>
          </motion.div>
        )}
        {(phase==="detected"||phase==="sorted") && (
          <motion.div
            className="absolute top-20 left-8 flex items-center gap-2.5 rounded-xl px-4 py-2.5 backdrop-blur-sm border"
            style={{ backgroundColor:`${activeItem.color}18`, borderColor:`${activeItem.color}40` }}
            initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
            <span className="text-2xl">{activeItem.emoji}</span>
            <div>
              <div className="text-xs font-bold text-slate-800">{activeItem.label}</div>
              <div className="text-[10px] font-bold" style={{color:activeItem.color}}>
                {phase==="sorted"
                  ?`✓ SORTED INTO ${BIN_COLOR_NAMES[activeItem.binIdx]} BIN`
                  :"DETECTED · 95% confidence"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── tiny control button ── */
function CtrlBtn({ label, active=false, onClick, title }:{
  label:string; active?:boolean; onClick:()=>void; title?:string;
}){
  return (
    <button onClick={onClick} title={title}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all select-none ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
      }`}>
      {label}
    </button>
  );
}
