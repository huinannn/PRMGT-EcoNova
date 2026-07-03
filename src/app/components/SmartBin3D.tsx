import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────────────────────────────
   BOX DIMENSIONS  — wider/taller with wedge top like Bin-e
   W=460  H=420  D=210   →  HW=230  HH=210  HD=105
───────────────────────────────────────────────────────────────── */
const W = 460, H = 420, D = 210;
const HW = 230, HH = 210, HD = 105;
// Caster wheels (CasterWheel3D) sit this far in from each of the box's 4 bottom
// corners, in world units, along both the width (x) and depth (z) axes.
const WHEEL_INSET = 45;

/* ─── Top wedge shape ─────────────────────────────────────────── */
const SLOPE   = 160; // vertical rise of the slope
const FLAT_D  = 70;  // depth of the flat top section at the back
const SLOPE_D = D - FLAT_D; // depth the slope covers
const LID_H   = Math.round(Math.sqrt(SLOPE*SLOPE + SLOPE_D*SLOPE_D)); // hypotenuse
const SLOPE_CY = -(HH + SLOPE/2); // y-center of the sloped section

type SortPhase = "idle" | "hovering" | "scanning" | "detected" | "breakdown" | "sorted";
type WasteType = "plastic" | "can" | "paper" | "glass" | "general";

interface WasteItem { id: WasteType; label: string; emoji: string; color: string; binIdx: number; }
const WASTE: WasteItem[] = [
  { id:"plastic", label:"Plastic Bottle", emoji:"🍶", color:"#f97316", binIdx:0 },
  { id:"can",     label:"Aluminium Can",  emoji:"🥫", color:"#f97316", binIdx:0 },
  { id:"paper",   label:"Paper",          emoji:"📰", color:"#2563eb", binIdx:1 },
  { id:"glass", label:"Glass Bottle",   emoji:"🫙", color:"#92400e", binIdx:2 },
  { id:"general", label:"Trash",          emoji:"🗑", color:"#6b7280", binIdx:3 },
];

interface Material { name: string; pct: number; bin: string; color: string; icon: string; note?: string; }
const BREAKDOWN: Record<WasteType, Material[]> = {
  plastic: [
    { name:"PET Bottle Body",  pct:85, bin:"CAN & PLASTIC", color:"#f97316", icon:"🍶" },
    { name:"PP Bottle Cap",    pct:12, bin:"TRASH",         color:"#6b7280", icon:"🔘", note:"Remove cap first" },
    { name:"Residual Liquid",  pct:3,  bin:"Empty out",     color:"#60a5fa", icon:"💧", note:"Empty before placing" },
  ],
  can: [
    { name:"Aluminium Body",    pct:92, bin:"CAN & PLASTIC", color:"#f97316", icon:"🥫" },
    { name:"Paper Label",       pct:5,  bin:"PAPER",         color:"#2563eb", icon:"🏷️" },
    { name:"Aluminium Ring Tab",pct:3,  bin:"CAN & PLASTIC", color:"#f97316", icon:"⭕" },
  ],
  paper: [
    { name:"Cellulose Fibre",  pct:90, bin:"PAPER",         color:"#2563eb", icon:"📰" },
    { name:"Ink / Coating",    pct:10, bin:"PAPER",         color:"#2563eb", icon:"🖋️", note:"Recyclable with paper" },
  ],
  glass: [
    { name:"Glass Body",  pct:88, bin:"GLASS",         color:"#92400e", icon:"🫙" },
    { name:"Metal Cap",   pct:8,  bin:"CAN & PLASTIC", color:"#f97316", icon:"🔘", note:"Remove cap first" },
    { name:"Paper Label", pct:4,  bin:"PAPER",         color:"#2563eb", icon:"🏷️" },
  ],
  general: [
    { name:"Mixed Plastics",  pct:45, bin:"TRASH", color:"#6b7280", icon:"🧴" },
    { name:"Organic Waste",   pct:35, bin:"TRASH", color:"#6b7280", icon:"🍂" },
    { name:"Other / Unknown", pct:20, bin:"TRASH", color:"#6b7280", icon:"❓" },
  ],
};

// Maps each breakdown material's destination bin label to the actual bin index
// ("Empty out" isn't a bin — that material is just discarded, not sorted anywhere).
const BIN_LABEL_TO_IDX: Record<string, number> = {
  "CAN & PLASTIC": 0, "PAPER": 1, "GLASS": 2, "TRASH": 3,
};

const PRESETS: Record<string,[number,number]> = {
  front: [  0,   0],
  back:  [  0, 180],
  left:  [  0, -90],
  right: [  0,  90],
  top:   [-88,  18],
  bottom:[ 90,   0],
};

function Face({ w, h, tf, hidden=false, opacity=1, overflow="hidden", bfv="hidden", style, children }: {
  w:number; h:number; tf:string; hidden?:boolean; opacity?:number; overflow?:string;
  bfv?: "hidden"|"visible"; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <div style={{
      position:"absolute", width:w, height:h,
      marginLeft:-w/2, marginTop:-h/2,
      transform:tf, backfaceVisibility:bfv,
      overflow, opacity,
      borderRadius:14, ...style,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FRONT FACE  (460 × 420)  — white body, wide horizontal form
═══════════════════════════════════════════════════════════════ */
function FrontFace({ phase, item, fills, scanPct, ex }:{
  phase:SortPhase; item:WasteItem; fills:number[]; scanPct:number; ex:number;
}) {
  const scanning = phase === "scanning";
  const detected = phase === "detected" || phase === "breakdown" || phase === "sorted";

  const BINS = [
    { col:"#e8893a", dark:"#c4601a", light:"#fcd5a0", label:"CAN & PLASTIC" },
    { col:"#4278cc", dark:"#2857a0", light:"#b8d0f8", label:"PAPER"         },
    { col:"#8c5c28", dark:"#624010", light:"#e8c898", label:"GLASS"         },
    { col:"#232323", dark:"#111111", light:"#9ca3af", label:"TRASH"         },
  ];

  /* Bin layout — computed from current W and H */
  const BW = Math.round((W - 38) / 4);   // 4 bins, 10px margin each side, 6px gaps
  const BX = [10, 10+BW+6, 10+2*(BW+6), 10+3*(BW+6)];
  const BY = 188;                          // scanner scaled to ~0.88, ends ~y=180
  const BH = H - BY - 62; // grows to fill space; rim pinned at H-56, text at H-36/H-22
  const BIN_CENTERS = BX.map(x => x + BW / 2);

  return (
    <Face w={W} h={H} tf={`translateZ(${HD+ex}px)`} style={{ borderRadius: 0 }} overflow="visible">
      <svg width={W} height={H+30} viewBox={`0 0 ${W} ${H+30}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* White/pearl body gradient */}
          <linearGradient id="fbody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d0d5e5"/>
            <stop offset="10%"  stopColor="#e6eaf3"/>
            <stop offset="50%"  stopColor="#eef0f7"/>
            <stop offset="90%"  stopColor="#e2e6f0"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
          <linearGradient id="fbayBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0c0e18"/>
            <stop offset="8%"   stopColor="#181b26"/>
            <stop offset="50%"  stopColor="#1c1f2c"/>
            <stop offset="92%"  stopColor="#171a24"/>
            <stop offset="100%" stopColor="#0b0d16"/>
          </linearGradient>
          <linearGradient id="fbinBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#c8ccd8"/>
            <stop offset="8%"   stopColor="#e4e8f2"/>
            <stop offset="50%"  stopColor="#edf0f6"/>
            <stop offset="92%"  stopColor="#dde1ec"/>
            <stop offset="100%" stopColor="#c4c8d8"/>
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
          <clipPath id="fcbay"><rect x="29" y="19" width={W-58} height="58" rx="11"/></clipPath>
          <linearGradient id="fcambeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#60d8ff" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#60d8ff" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* ═══ CABINET OUTER BODY — all straight ═══ */}
        <rect width={W} height={H-24} fill="url(#fbody)"/>
        <g transform="translate(0, 22) scale(1, 0.88)">

        {/* ═══ WASTE INPUT HOUSING (y 10–174) ═══ */}
        <rect x="10" y="10" width={W-20} height="164" rx="14" fill="black" opacity="0.18"/>
        <rect x="13" y="13" width={W-26} height="158" rx="12" fill="#0d1018"/>

        {/* ── WASTE INPUT OPENING ── */}
        <rect x="26" y="16" width={W-52} height="64" rx="13" fill="black" opacity="0.45"/>
        <rect x="29" y="19" width={W-58} height="58" rx="11" fill="#020304"/>
        <rect x="32" y="20" width={W-64} height="6"  rx="4"  fill="white" opacity="0.05"/>
        <rect x="32" y="74" width={W-64} height="3"  rx="2"  fill="black" opacity="0.30"/>
        <rect x="32" y="22" width="5"    height="52" rx="3"  fill="white" opacity="0.022"/>
        <rect x={W-37} y="22" width="5"  height="52" rx="3"  fill="black" opacity="0.35"/>

        {/* LED ring around opening */}
        {scanning ? (
          <motion.rect x="26" y="16" width={W-52} height="64" rx="13" fill="none"
            stroke="#0ea5e9" strokeWidth="2.5"
            animate={{opacity:[0.35,1,0.35]}} transition={{duration:0.7,repeat:Infinity}}
            style={{filter:"drop-shadow(0 0 12px #0ea5e9)"}}/>
        ) : detected ? (
          <rect x="26" y="16" width={W-52} height="64" rx="13" fill="none"
            stroke="#22c55e" strokeWidth="2"
            style={{filter:"drop-shadow(0 0 8px #22c55e)"}}/>
        ) : (
          <rect x="26" y="16" width={W-52} height="64" rx="13" fill="none"
            stroke="#1d2d42" strokeWidth="1.5"/>
        )}

        {/* Top status LED strip */}
        {[-20,-10,0,10,20].map((dx,j)=>(
          <circle key={j} cx={W/2+dx} cy="17" r="1.8"
            fill={scanning?"#0ea5e9":detected?"#22c55e":"#1a2d45"}
            opacity={scanning||detected?0.9:0.4}
            style={(scanning||detected)?{filter:`drop-shadow(0 0 3px ${scanning?"#0ea5e9":"#22c55e"})`}:undefined}/>
        ))}

        {/* Camera mounted at top of opening */}
        <rect x={W/2-14} y="20" width="28" height="16" rx="5"
          fill="#0a0c14" stroke="#1a2438" strokeWidth="1"/>
        <circle cx={W/2} cy="28" r="9"   fill="#060810" stroke="#182035" strokeWidth="1.2"/>
        <circle cx={W/2} cy="28" r="6"   fill="url(#fcamLens)"/>
        <circle cx={W/2} cy="28" r="2.5" fill="#0369a1" opacity="0.85"/>
        <circle cx={W/2-1.8} cy="26.5" r="1.5" fill="white" opacity="0.28"/>
        {/* Light cone */}
        <motion.polygon
          points={`${W/2-2},31 ${W/2+2},31 ${W/2+56},77 ${W/2-56},77`}
          fill="url(#fcambeam)"
          clipPath="url(#fcbay)"
          style={{mixBlendMode:"screen"}}
          animate={{opacity:[0.45,0.9,0.45]}}
          transition={{duration:2.2,repeat:Infinity,ease:"easeInOut"}}/>

        {/* Scan line */}
        {scanning && (
          <motion.rect x="31" y="21" width={W-62} height="3" rx="1.5"
            fill="#0ea5e9" opacity="0.9"
            animate={{y:[21,71,21]}} transition={{duration:1.3,repeat:Infinity,ease:"easeInOut"}}
            clipPath="url(#fcbay)"
            style={{filter:"drop-shadow(0 0 6px #0ea5e9)"}}/>
        )}

        {/* ── Speaker grille ── */}
        {[0,1,2,3,4,5].map(j=>(
          <rect key={j} x="13" y={96+j*9} width="9" height="3.5" rx="1.5"
            fill="#081420" stroke="#0d1e30" strokeWidth="0.3"/>
        ))}

        {/* ── AI Display Screen ── */}
        <rect x="18" y="88" width={W-36} height="78" rx="9" fill="#070a12"/>
        <rect x="18" y="88" width={W-36} height="78" rx="9" fill="none" stroke="#16202e" strokeWidth="1"/>
        <rect x="20" y="90" width={W-40} height="4" rx="3" fill="white" opacity="0.04"/>
        {Array.from({length:9},(_,j)=>(
          <rect key={j} x="20" y={91+j*8} width={W-40} height="0.8" rx="0.4" fill="white" opacity="0.012"/>
        ))}

        {/* AI screen messages */}
        <AnimatePresence mode="wait">
          {phase==="hovering" && (
            <motion.g key="hover" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <motion.text x={W/2} y="122" textAnchor="middle" fontSize="10" fontWeight="700"
                fill="#fcd34d" animate={{opacity:[0.6,1,0.6]}} transition={{duration:0.5,repeat:Infinity}}>
                Item detected...
              </motion.text>
              <text x={W/2} y="136" textAnchor="middle" fontSize="7.5" fill="#9a8020">Hold still for scan</text>
            </motion.g>
          )}
          {phase==="scanning" && (
            <motion.g key="scan" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <motion.text x={W/2} y="112" textAnchor="middle" fontSize="9.5" fontWeight="700"
                fill="#38bdf8" animate={{opacity:[0.5,1,0.5]}} transition={{duration:0.6,repeat:Infinity}}>
                Analysing waste...
              </motion.text>
              <rect x="42" y="120" width={W-84} height="6" rx="3" fill="#0c1a28"/>
              <motion.rect x="42" y="120" width={(scanPct/100)*(W-84)} height="6" rx="3"
                fill="#0ea5e9" style={{filter:"drop-shadow(0 0 4px #0ea5e9)"}}/>
              <text x={W/2} y="138" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#38bdf8">
                {Math.round(scanPct)}%
              </text>
            </motion.g>
          )}
          {phase==="sorted" && (
            <motion.g key="sorted" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <text x={W/2} y="100" textAnchor="middle" fontSize="10" fontWeight="800"
                fill="#4ade80" letterSpacing="0.5">
                ✓ SORTED
              </text>
              {BREAKDOWN[item.id].map((m,mi)=>{
                const idx = BIN_LABEL_TO_IDX[m.bin];
                const dest = idx===undefined ? "Water Tank" : `${m.bin} BIN`;
                return (
                  <text key={m.name} x={W/2} y={118+mi*16} textAnchor="middle" fontSize="8" fill={m.color}>
                    {m.name} → {dest}
                  </text>
                );
              })}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Animated waste item ── */}
        <AnimatePresence>
          {phase!=="idle" && (
            <motion.g
              initial={{x:W/2,y:-30,opacity:0,scale:0.2,rotate:-90}}
              animate={
                (phase==="hovering"||phase==="scanning")
                  ? {x:W/2,y:60,opacity:1,scale:0.65,rotate:0}
                  : (phase==="detected"||phase==="breakdown")
                  ? {x:W/2,y:60,opacity:1,scale:0.65,rotate:0}
                  : {x:BIN_CENTERS[item.binIdx],y:BY+40,opacity:0,scale:0.4,rotate:180}
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

        {/* ── Other breakdown materials — each flies to its own bin instead of all landing together ── */}
        <AnimatePresence>
          {phase==="sorted" && BREAKDOWN[item.id].map((m,mi)=>{
            const idx = BIN_LABEL_TO_IDX[m.bin];
            if(idx===item.binIdx) return null; // already represented by the main item's flight
            const baseDelay = 0.1+mi*0.12;
            if(idx===undefined){
              // No real bin (e.g. residual liquid) — drips down and drains away into the interior water tank
              return (
                <g key={m.name}>
                  {[0,1,2].map(d=>(
                    <motion.text key={d}
                      textAnchor="middle" dominantBaseline="middle" fontSize="9"
                      initial={{x:W/2,y:60,opacity:1,scale:1}}
                      animate={{x:W/2,y:170,opacity:[1,1,0],scale:[1,0.8,0.5]}}
                      transition={{duration:0.5,ease:"easeIn",delay:baseDelay+d*0.13}}
                      style={{filter:`drop-shadow(0 0 3px ${m.color})`}}>
                      {m.icon}
                    </motion.text>
                  ))}
                </g>
              );
            }
            return (
              <motion.text key={m.name}
                textAnchor="middle" dominantBaseline="middle" fontSize="13"
                initial={{x:W/2,y:60,opacity:1,scale:1}}
                animate={{x:BIN_CENTERS[idx],y:BY+40,opacity:0,scale:0.6}}
                transition={{duration:0.7,ease:"easeIn",delay:baseDelay}}
                style={{filter:`drop-shadow(0 0 3px ${m.color})`}}>
                {m.icon}
              </motion.text>
            );
          })}
        </AnimatePresence>

        {/* ── Breakdown overlay on face ── */}
        <AnimatePresence>
          {phase==="breakdown" && (
            <motion.g key="breakdown-face"
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <rect x="10" y="10" width={W-20} height="164" rx="14" fill="black" opacity="0.18"/>
              <rect x="13" y="13" width={W-26} height="158" rx="12" fill="#060810" opacity="0.97"/>
              <text x="22" y="28" fontSize="7" fontWeight="900" fill={item.color} letterSpacing="0.8">
                ✦ MATERIAL BREAKDOWN
              </text>
              <text x="22" y="50" fontSize="18">{item.emoji}</text>
              <text x="50" y="47" fontSize="8.5" fontWeight="700" fill="white">{item.label}</text>
              <text x="50" y="59" fontSize="6" fill={item.color}>Detected · 95% confidence</text>
              <text x={W-24} y="47" textAnchor="middle" fontSize="13">🦾</text>
              <text x={W-24} y="59" textAnchor="middle" fontSize="5" fill="#4b6080">sorting</text>
              <rect x="16" y="66" width={W-32} height="0.8" fill="#1e2535"/>
              {BREAKDOWN[item.id].map((m,mi)=>(
                <g key={mi} transform={`translate(16,${74+mi*32})`}>
                  <text y="8" fontSize="8">{m.icon}</text>
                  <text x="12" y="8" fontSize="7" fontWeight="600" fill="#cbd5e1">{m.name}</text>
                  <text x={W-32} y="8" textAnchor="end" fontSize="7.5" fontWeight="800" fill={m.color}>{m.pct}%</text>
                  <rect y="12" width={W-32} height="5" rx="2.5" fill="#1e2535"/>
                  <motion.rect y="12" width={(m.pct/100)*(W-32)} height="5" rx="2.5" fill={m.color}
                    initial={{width:0}} animate={{width:(m.pct/100)*(W-32)}}
                    transition={{delay:mi*0.15+0.1, duration:0.5}}/>
                  <text y="25" fontSize="5.5" fill="#4b6080">→ {m.bin}</text>
                  {m.note && <text x={W-32} y="25" textAnchor="end" fontSize="5.5" fill="#f59e0b">{m.note}</text>}
                </g>
              ))}
              <motion.text x={W/2} y="168" textAnchor="middle" fontSize="6" fill="#2a4060"
                animate={{opacity:[0.5,1,0.5]}} transition={{duration:1,repeat:Infinity}}>
                Routing to correct bin...
              </motion.text>
            </motion.g>
          )}
        </AnimatePresence>

        </g>

        {/* ═══ BIN SECTION — prominent colored panels ═══ */}
        {/* Bin area background */}
        <rect x="6" y={BY-6} width={W-12} height={BH+14} rx="14" fill="url(#fbinBg)"/>

        {BINS.map((b,i)=>{
          const bx      = BX[i];
          const isActive = detected && item.binIdx === i;
          const isFull   = fills[i] >= 100;
          return (
            <g key={i}>
              {/* Drop shadow */}
              <rect x={bx+3} y={BY+5} width={BW} height={BH} rx="12"
                fill="black" opacity="0.22"/>
              {/* Main colored body */}
              <rect x={bx} y={BY} width={BW} height={BH} rx="12"
                fill={`url(#fbl${i})`}
                style={isActive ? {filter:`drop-shadow(0 0 12px ${b.light}aa)`} : undefined}/>
              {/* Top specular */}
              <rect x={bx+4} y={BY+4} width={BW-8} height="10" rx="5"
                fill="white" opacity="0.18"/>
              {/* Subtle side highlight */}
              <rect x={bx+3} y={BY+4} width="4" height={BH-10} rx="2"
                fill="white" opacity="0.08"/>
              {/* Border for dark trash bin */}
              {i === 3 && (
                <rect x={bx} y={BY} width={BW} height={BH} rx="12"
                  fill="none" stroke="#505060" strokeWidth="1.5"/>
              )}
              {/* ── Waste input slot ── */}
              <rect x={bx+8} y={BY+12} width={BW-16} height="26" rx="6"
                fill="black" opacity="0.65"/>
              <rect x={bx+10} y={BY+14} width={BW-20} height="22" rx="5"
                fill="#0a0a0a"/>
              <rect x={bx+10} y={BY+14} width={BW-20} height="5" rx="4"
                fill="white" opacity="0.06"/>
              <rect x={bx+10} y={BY+28} width={BW-20} height="8" rx="4"
                fill="black" opacity="0.65"/>
              <rect x={bx+8} y={BY+10} width={BW-16} height="3" rx="2"
                fill="white" opacity="0.24"/>
              {/* Center icon */}
              <text x={bx+BW/2} y={BY+Math.round(BH*0.56)} textAnchor="middle" dominantBaseline="middle"
                fontSize="26" opacity={isActive ? 1 : 0.85}>♻</text>
              {/* Label */}
              <text x={bx+BW/2} y={BY+BH-20} textAnchor="middle"
                fontSize={i===0?6.5:7} fontWeight="900" fill="white" letterSpacing="0.4" opacity="0.95">
                {b.label}
              </text>
              {/* Fill % */}
              {isFull ? (
                <motion.text x={bx+BW/2} y={BY+BH-8}
                  textAnchor="middle" fontSize="7.5" fontWeight="900"
                  fill="#f87171" letterSpacing="0.5"
                  animate={{opacity:[0.5,1,0.5]}} transition={{duration:0.7,repeat:Infinity}}>
                  FULL
                </motion.text>
              ) : (
                <text x={bx+BW/2} y={BY+BH-8}
                  textAnchor="middle" fontSize="7.5" fontWeight="700"
                  fill="white" opacity="0.72">
                  {fills[i]}%
                </text>
              )}
              {/* Active glow ring */}
              {isActive && (
                <motion.rect x={bx-2} y={BY-2} width={BW+4} height={BH+4} rx="13"
                  fill="none" stroke={b.light} strokeWidth="2"
                  animate={{opacity:[0.3,1,0.3]}} transition={{duration:0.6,repeat:Infinity}}
                  style={{filter:`drop-shadow(0 0 8px ${b.light})`}}/>
              )}
              {/* Full warning ring */}
              {isFull && (
                <motion.rect x={bx-2} y={BY-2} width={BW+4} height={BH+4} rx="13"
                  fill="none" stroke="#f87171" strokeWidth="2"
                  animate={{opacity:[0.3,1,0.3]}} transition={{duration:0.5,repeat:Infinity}}
                  style={{filter:"drop-shadow(0 0 8px #f87171)"}}/>
              )}
            </g>
          );
        })}


        {/* ═══ BRAND STRIP ═══ */}
        <text x={W/2} y={BY+BH+26} textAnchor="middle" fontSize="10" fontWeight="900"
          fill="#8898a8" letterSpacing="4" opacity="0.85">SMART TRASH BIN</text>
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDE FACE CONTENT (shared by left & right)
═══════════════════════════════════════════════════════════════ */
function SideFaceContent({ onQrScan, qrScanning, qrDone }: {
  onQrScan?: ()=>void; qrScanning?: boolean; qrDone?: boolean;
}) {
  return <>
    {/* Recessed pull handle */}
    <rect x={D/2-22} y={H/2-7} width="44" height="14" rx="6"
      fill="#a8acb8" stroke="#9298a8" strokeWidth="1"/>
    <rect x={D/2-19} y={H/2-4} width="38" height="8" rx="5"
      fill="#1a1c22"/>
    <rect x={D/2-19} y={H/2-4} width="38" height="3" rx="3"
      fill="black" opacity="0.4"/>
    <rect x={D/2-13} y={H/2-1} width="26" height="5" rx="3"
      fill="#b8bcc8" stroke="#9ea2ae" strokeWidth="0.8"/>
    <rect x={D/2-11} y={H/2-0.5} width="22" height="2" rx="1"
      fill="white" opacity="0.18"/>

    {/* QR Reward — minimal sticker, upper face (right face only) */}
    {onQrScan !== undefined && (
      <g>
        <g transform={`translate(${D/2-45},36)`}>
          <rect width="90" height="7" rx="4"
            fill={qrDone?"#16a34a":qrScanning?"#2563eb":"#94a3b8"}/>
          <rect y="5" width="90" height="84" rx="5" fill="white"
            stroke={qrDone?"#16a34a":qrScanning?"#93c5fd":"#d1d5db"} strokeWidth="1.5"/>
          <image href="/qr_code.png" x="5" y="10" width="80" height="74"
            style={{imageRendering:"pixelated"}}/>
          {qrScanning && (
            <motion.rect x="0" y="5" width="90" height="3" rx="1.5"
              fill="#3b82f6" opacity="0.65"
              animate={{y:[5,87,5]}} transition={{duration:1.1,repeat:Infinity,ease:"easeInOut"}}/>
          )}
          {qrDone && (
            <rect y="5" width="90" height="84" fill="#16a34a" fillOpacity="0.15" rx="5"/>
          )}
        </g>
        <text x={D/2} y="138" textAnchor="middle" fontSize="6.5" fontWeight="900"
          fill="#64748b" letterSpacing="1.5">★ ECONOVA REWARDS</text>
        <text x={D/2} y="150" textAnchor="middle" fontSize="6" fontWeight="700"
          fill={qrDone?"#16a34a":qrScanning?"#2563eb":"#6b7280"} letterSpacing="0.3">
          {qrDone ? "✓ +10 PTS EARNED!" : qrScanning ? "SCANNING..." : "Scan here to earn rewards"}
        </text>
        <rect x={D/2-45} y="36" width="90" height="96" rx="5"
          fill="transparent" style={{cursor:"pointer"}} onClick={onQrScan}/>
      </g>
    )}
  </>;
}

/* ═══════════════════════════════════════════════════════════════
   RIGHT FACE  (180 × 360)
═══════════════════════════════════════════════════════════════ */
function RightFace({ ex, onQrScan, qrScanning, qrDone }: { ex: number; onQrScan: () => void; qrScanning: boolean; qrDone: boolean }) {
  const TH = H + SLOPE;
  /* RightFace SVG: svg_x=0 → FRONT (z=+HD), svg_x=D → BACK (z=-HD).
     Correct clipPath: back is taller with flat top, front is shorter. */
  return (
    <Face w={D} h={TH}
      tf={`translateY(-${SLOPE / 2}px) rotateY(90deg) translateZ(${HW + ex}px)`}
      style={{ borderRadius: 0 }} overflow="visible">
      <svg width={D} height={TH + 20} viewBox={`0 0 ${D} ${TH + 20}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="rtClip">
            <polygon points={`${D},0 ${D - FLAT_D},0 0,${SLOPE} 0,${TH - 24} ${D},${TH - 24}`}/>
          </clipPath>
          <linearGradient id="rtBodyGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#e6eaf3"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
        </defs>
        <g clipPath="url(#rtClip)">
          <rect width={D} height={TH} fill="url(#rtBodyGrad)"/>
          <g transform={`translate(0,${SLOPE})`}>
            <SideFaceContent onQrScan={onQrScan} qrScanning={qrScanning} qrDone={qrDone}/>
            <rect x={D/2-36} y={H-106} width="72" height="36" rx="7"
              fill="#b0b4be" stroke="#9298a8" strokeWidth="1"/>
            <rect x={D/2-34} y={H-104} width="68" height="32" rx="6" fill="#1a1c24"/>
            <circle cx={D/2-12} cy={H-88} r="11" fill="#0e1018" stroke="#2a2e3a" strokeWidth="1"/>
            <circle cx={D/2-12} cy={H-88} r="6.5" fill="#161820"/>
            <circle cx={D/2-12} cy={H-88} r="2.5" fill="#080a0e"/>
            <circle cx={D/2-12} cy={H-88} r="1" fill="#22d3ee" opacity="0.9"/>
            <text x={D/2+8} y={H-85} textAnchor="middle" fontSize="6" fill="#4a5568" fontWeight="700" letterSpacing="0.5">DC</text>
            <text x={D/2+8} y={H-77} textAnchor="middle" fontSize="5.5" fill="#4a5568" letterSpacing="0.5">IN</text>
          </g>
        </g>
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT FACE
═══════════════════════════════════════════════════════════════ */
function LeftFace({ hidden, ex }: { hidden: boolean; ex: number }) {
  const TH = H + SLOPE;
  /* LeftFace SVG: svg_x=0 → BACK (z=-HD), svg_x=D → FRONT (z=+HD). */
  return (
    <Face w={D} h={TH}
      tf={`translateY(-${SLOPE / 2}px) rotateY(-90deg) translateZ(${HW + ex}px)`}
      hidden={hidden} style={{ borderRadius: 0 }} overflow="visible">
      <svg width={D} height={TH + 20} viewBox={`0 0 ${D} ${TH + 20}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="ltClip">
            <polygon points={`0,0 ${FLAT_D},0 ${D},${SLOPE} ${D},${TH - 24} 0,${TH - 24}`}/>
          </clipPath>
          <linearGradient id="ltBodyGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d0d5e5"/>
            <stop offset="100%" stopColor="#e6eaf3"/>
          </linearGradient>
        </defs>
        <g clipPath="url(#ltClip)">
          <rect width={D} height={TH} fill="url(#ltBodyGrad)"/>
          <g transform={`translate(0,${SLOPE})`}>
            <SideFaceContent/>
          </g>
        </g>
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTERIOR WALLS  — visible room inside when back door is open
═══════════════════════════════════════════════════════════════ */
function InteriorWalls({ ex }: { ex:number }) {
  return (
    <>
      {/* Left inner wall — at x=-(HW-2), facing right (+x); shaped to follow the sloped top like the front */}
      <Face w={D} h={H+SLOPE} bfv="visible" overflow="hidden" style={{ borderRadius:0 }}
        tf={`translateY(${-SLOPE/2}px) rotateY(90deg) translateZ(-${HW-2}px)`}>
        <svg width={D} height={H+SLOPE} viewBox={`0 0 ${D} ${H+SLOPE}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="inLtClip">
              <polygon points={`${D},0 ${D-FLAT_D},0 0,${SLOPE} 0,${H+SLOPE-24} ${D},${H+SLOPE-24}`}/>
            </clipPath>
            <linearGradient id="inLtGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#d0d5e5"/>
              <stop offset="100%" stopColor="#e6eaf3"/>
            </linearGradient>
          </defs>
          <g clipPath="url(#inLtClip)">
            <rect width={D} height={H+SLOPE} fill="url(#inLtGrad)"/>
          </g>
        </svg>
      </Face>
      {/* Right inner wall — at x=+(HW-2), facing left (-x); shaped to follow the sloped top like the front */}
      <Face w={D} h={H+SLOPE} bfv="visible" overflow="hidden" style={{ borderRadius:0 }}
        tf={`translateY(${-SLOPE/2}px) rotateY(-90deg) translateZ(-${HW-2}px)`}>
        <svg width={D} height={H+SLOPE} viewBox={`0 0 ${D} ${H+SLOPE}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="inRtClip">
              <polygon points={`0,0 ${FLAT_D},0 ${D},${SLOPE} ${D},${H+SLOPE-24} 0,${H+SLOPE-24}`}/>
            </clipPath>
            <linearGradient id="inRtGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#e6eaf3"/>
              <stop offset="100%" stopColor="#d0d5e5"/>
            </linearGradient>
          </defs>
          <g clipPath="url(#inRtClip)">
            <rect width={D} height={H+SLOPE} fill="url(#inRtGrad)"/>
          </g>
        </svg>
      </Face>
      {/* Front inner wall — far end of interior, facing back (-z); trimmed to match FrontFace's own body so it doesn't peek through the gap above the wheels */}
      <Face w={W} h={H-24} bfv="visible" overflow="hidden" style={{ borderRadius:0 }}
        tf={`rotateY(180deg) translateY(-12px) translateZ(-${HD+ex-4}px)`}>
        <div style={{ width:"100%", height:"100%",
          background:"linear-gradient(90deg, #d0d5e5 0%, #e6eaf3 10%, #eef0f7 50%, #e2e6f0 90%, #d0d5e5 100%)" }}/>
      </Face>
      {/* Interior floor — raised to meet the visible edge of the outer body panels (which stop
          24px short of the true bottom) so it reads as connected instead of floating below a gap */}
      <Face w={W} h={D} bfv="visible" overflow="hidden" style={{ borderRadius:0 }}
        tf={`rotateX(90deg) translateZ(-${HH-24}px)`}>
        <div style={{ width:"100%", height:"100%",
          background:"linear-gradient(90deg, #d0d5e5 0%, #e6eaf3 10%, #eef0f7 50%, #e2e6f0 90%, #d0d5e5 100%)" }}/>
      </Face>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTERIOR BINS  — 3D CSS elements inside the box, pull-out via back door
═══════════════════════════════════════════════════════════════ */
function InteriorBins({ ex, doorOpen, pulledBins, onPullBin, phase, item }: {
  ex:number; doorOpen:boolean; pulledBins:boolean[]; onPullBin:(i:number)=>void;
  phase:SortPhase; item:WasteItem;
}) {
  const sorting = phase==="breakdown" || phase==="sorted";
  // item.binIdx is indexed against FrontFace's bin order [CAN&PLASTIC,PAPER,GLASS,TRASH] —
  // InteriorBins' own array below is mirrored for the back view, so look up by label, not raw index.
  const FRONT_BIN_LABELS = ["CAN & PLASTIC","PAPER","GLASS","TRASH"];
  const targetLabel = FRONT_BIN_LABELS[item.binIdx];
  // Instant cut, no fade — opacity set directly via style so it snaps immediately.
  const visStyle = { opacity: doorOpen?1:0, pointerEvents: doorOpen?("auto" as const):("none" as const) };
  // Match front-face bin width, but stretch height so the bins actually reach the floor
  // (front-face proportions leave a gap at the bottom here in 3D, unlike the 2D scanner UI)
  const BW = Math.round((W - 38) / 4); // 106 — same formula as FrontFace, used for spacing between bins
  const BW_R = BW - 14; // rendered a bit narrower than the spacing width, so the outer bins clear the side walls
  const BIN_TOP = 63 - (H - 188 - 62) / 2; // -22 — same top edge as before, right under the sorting divider
  const BIN_BOTTOM = 185;                  // reaches down toward the floor without poking past the side walls
  const BH = BIN_BOTTOM - BIN_TOP;
  const BY = (BIN_TOP + BIN_BOTTOM) / 2;   // 93
  const baseZ = -(HD + ex) - 4; // slightly in front of BackFace so bins render over interior SVG

  // worldX = W/2 − SVG_bin_centre_x; order: left-to-right from BACK view
  const BX_SVG = [10, 10+BW+6, 10+2*(BW+6), 10+3*(BW+6)];
  const BINS = [
    { col:"#3c404e", dark:"#282c38", worldX: HW - (BX_SVG[0]+BW/2), label:"TRASH"        },
    { col:"#8c5c28", dark:"#624010", worldX: HW - (BX_SVG[1]+BW/2), label:"GLASS"        },
    { col:"#4278cc", dark:"#2857a0", worldX: HW - (BX_SVG[2]+BW/2), label:"PAPER"        },
    { col:"#e8893a", dark:"#c4601a", worldX: HW - (BX_SVG[3]+BW/2), label:"CAN & PLASTIC" },
  ];
  const targetBinIdx = BINS.findIndex(b => b.label === targetLabel);

  // Some items break down into multiple materials that go to DIFFERENT bins (e.g. a can's aluminium
  // body goes to CAN & PLASTIC while its paper label goes to PAPER) — the front panel shows each
  // material flying to its own bin, so the interior needs to open a hole and drop something at each
  // one too, not just the primary target.
  const secondaryMaterials = BREAKDOWN[item.id]
    .filter(m => m.bin !== targetLabel && BIN_LABEL_TO_IDX[m.bin] !== undefined)
    .map(m => ({ ...m, idx: BINS.findIndex(b => b.label === m.bin) }))
    .filter((m, mi, arr) => m.idx !== -1 && arr.findIndex(o => o.idx === m.idx) === mi);
  const allTargetIdxs = sorting ? Array.from(new Set([targetBinIdx, ...secondaryMaterials.map(m=>m.idx)])) : [];

  // Sorting divider — a shelf above the bins with 4 holes (one per bin) that waste drops through once sorted
  const DIV_W = BX_SVG[3] + BW; // spans the same footprint as the 4 bins together
  const DIV_H = 22;
  const DIV_Y = BY - BH/2 - DIV_H/2 - 4;
  // The divider's own local coords run left-to-right un-mirrored, but BINS[i].worldX is already
  // mirrored for the back view — convert world position back into the divider's local space,
  // otherwise the hole opens on the opposite side from the bin it's meant to align with.
  const holeX = (i:number) => BINS[i].worldX + DIV_W/2 - BW/2;

  return (
    <>
      {(() => {
        const pivotY = -155;
        const ARM_LEN = 80;
        const targetX = sorting ? BINS[targetBinIdx].worldX : 0;
        const targetY = BY - BH/2 - 15;
        const armAngle = sorting ? Math.atan2(targetX - 0, targetY - pivotY) * 180 / Math.PI : 0;
        const tipX = (ARM_LEN - 10) * Math.sin(armAngle * Math.PI / 180);
        const tipY = pivotY + (ARM_LEN - 10) * Math.cos(armAngle * Math.PI / 180);
        return (
          <>
            {/* ── Robot arm base mount — fixed near the top of the interior ── */}
            <motion.div
              animate={{ z: baseZ }}
              style={{
                position:"absolute", width:24, height:20,
                marginLeft:-12, marginTop:-10,
                x:0, y:pivotY, rotateY:180,
                ...visStyle, pointerEvents:"none",
              }}>
              <svg width="24" height="20" viewBox="0 0 24 20">
                {/* Ceiling mounting plate with bolts */}
                <rect x="1" y="0" width="22" height="5" rx="1" fill="#2a3444" stroke="#111827" strokeWidth="1"/>
                <circle cx="4.5" cy="2.5" r="1" fill="#111827"/>
                <circle cx="19.5" cy="2.5" r="1" fill="#111827"/>
                {/* Shoulder housing — tapers down into the rod */}
                <polygon points="7,5 17,5 15,18 9,18" fill="#374151" stroke="#111827" strokeWidth="1"/>
                <rect x="9" y="15" width="6" height="3" fill="#2a3444" stroke="#111827" strokeWidth="0.75"/>
              </svg>
            </motion.div>

            {/* ── Arm segment + gripper — rotates to point at the target bin while sorting ── */}
            <motion.div
              animate={{ rotate: -armAngle, z: baseZ + 2 }}
              transition={{ duration:0.55, ease:"easeInOut", delay:sorting?0.35:0 }}
              style={{
                position:"absolute", width:26, height:ARM_LEN,
                marginLeft:-13, marginTop:0,
                x:0, y:pivotY, rotateY:180,
                transformOrigin:"50% 0%",
                ...visStyle, pointerEvents:"none",
              }}>
              <svg width="26" height={ARM_LEN} viewBox={`0 0 26 ${ARM_LEN}`}>
                <defs>
                  <linearGradient id="armMetal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6b7280"/>
                    <stop offset="50%" stopColor="#9ca3af"/>
                    <stop offset="100%" stopColor="#4b5563"/>
                  </linearGradient>
                </defs>
                {/* Rod, with a mechanical collar ring partway down */}
                <rect x="11" y="0" width="4" height={ARM_LEN-32} fill="url(#armMetal)" stroke="#1f2937" strokeWidth="0.5"/>
                <rect x="9" y={(ARM_LEN-32)*0.55} width="8" height="3" fill="#374151" stroke="#111827" strokeWidth="0.5"/>
                {/* Knuckle housing — chamfered (cut-corner) casing with corner rivets */}
                <polygon
                  points={`9,${ARM_LEN-32} 17,${ARM_LEN-32} 19,${ARM_LEN-30} 19,${ARM_LEN-20} 17,${ARM_LEN-18} 9,${ARM_LEN-18} 7,${ARM_LEN-20} 7,${ARM_LEN-30}`}
                  fill="#2a3444" stroke="#111827" strokeWidth="1"/>
                <circle cx="8.5" cy={ARM_LEN-30.5} r="0.8" fill="#111827"/>
                <circle cx="17.5" cy={ARM_LEN-30.5} r="0.8" fill="#111827"/>
                <circle cx="8.5" cy={ARM_LEN-19.5} r="0.8" fill="#111827"/>
                <circle cx="17.5" cy={ARM_LEN-19.5} r="0.8" fill="#111827"/>
                <circle cx="13" cy={ARM_LEN-25} r="2"
                  fill={sorting ? "#ef4444" : "#374151"}
                  style={sorting ? { filter:"drop-shadow(0 0 3px #ef4444)" } : undefined}/>
                {/* Left finger — two hinged segments with pivot rivets and a squared pincer tip */}
                <circle cx="8" cy={ARM_LEN-20} r="1" fill="#111827"/>
                <rect x="4.5" y={ARM_LEN-20} width="3.5" height="10" rx="0.5" fill="url(#armMetal)" stroke="#1f2937" strokeWidth="0.5"
                  transform={`rotate(${sorting?-18:-8} 8 ${ARM_LEN-20})`}/>
                <circle cx="6" cy={ARM_LEN-11} r="0.8" fill="#111827"/>
                <rect x="2.5" y={ARM_LEN-11} width="3.5" height="9" rx="0.5" fill="url(#armMetal)" stroke="#1f2937" strokeWidth="0.5"
                  transform={`rotate(${sorting?-30:-14} 6 ${ARM_LEN-11})`}/>
                <rect x="2" y={ARM_LEN-4} width="4.5" height="3" fill="#374151" stroke="#111827" strokeWidth="0.5"
                  transform={`rotate(${sorting?-30:-14} 6 ${ARM_LEN-11})`}/>
                {/* Right finger — mirrored */}
                <circle cx="18" cy={ARM_LEN-20} r="1" fill="#111827"/>
                <rect x="18" y={ARM_LEN-20} width="3.5" height="10" rx="0.5" fill="url(#armMetal)" stroke="#1f2937" strokeWidth="0.5"
                  transform={`rotate(${sorting?18:8} 18 ${ARM_LEN-20})`}/>
                <circle cx="20" cy={ARM_LEN-11} r="0.8" fill="#111827"/>
                <rect x="20" y={ARM_LEN-11} width="3.5" height="9" rx="0.5" fill="url(#armMetal)" stroke="#1f2937" strokeWidth="0.5"
                  transform={`rotate(${sorting?30:14} 20 ${ARM_LEN-11})`}/>
                <rect x="19.5" y={ARM_LEN-4} width="4.5" height="3" fill="#374151" stroke="#111827" strokeWidth="0.5"
                  transform={`rotate(${sorting?30:14} 20 ${ARM_LEN-11})`}/>
              </svg>
            </motion.div>

            {/* ── The item — sits on the gripper the instant sorting starts, swings with the arm, then drops into the bin ── */}
            <AnimatePresence>
              {doorOpen && phase!=="idle" && (
                <motion.div
                  key={item.id}
                  initial={{ x:0, y:pivotY+ARM_LEN-10, z:baseZ, opacity:1, scale:0.6 }}
                  animate={
                    phase==="sorted"
                      ? { x:targetX, y:BY-BH/2+20, z:baseZ+20, opacity:0, scale:0.4 }
                      : { x: sorting?tipX:0, y: sorting?tipY:pivotY+ARM_LEN-10, z: sorting?baseZ+2:baseZ, opacity:1, scale:0.6 }
                  }
                  exit={{ opacity:0 }}
                  transition={
                    phase==="sorted"
                      ? { duration:0.45, ease:"easeIn" }
                      : { duration:0.55, ease:"easeInOut", delay: sorting?0.35:0 }
                  }
                  style={{
                    position:"absolute", width:30, height:30,
                    marginLeft:-15, marginTop:-15,
                    fontSize:22, display:"flex", alignItems:"center", justifyContent:"center",
                    filter:"drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
                    ...visStyle,
                  }}>
                  {item.emoji}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Secondary breakdown materials — same idea as the front panel's "each material flies to its
                own bin" animation, so items that split across multiple bins actually show it back here too ── */}
            <AnimatePresence>
              {doorOpen && phase==="sorted" && secondaryMaterials.map((m, mi) => (
                <motion.div key={m.name}
                  initial={{ x:0, y:pivotY+ARM_LEN-10, z:baseZ, opacity:1, scale:0.5 }}
                  animate={{ x:BINS[m.idx].worldX, y:BY-BH/2+20, z:baseZ+20, opacity:0, scale:0.3 }}
                  exit={{ opacity:0 }}
                  transition={{ duration:0.5, ease:"easeIn", delay:0.15+mi*0.12 }}
                  style={{
                    position:"absolute", width:18, height:18,
                    marginLeft:-9, marginTop:-9,
                    fontSize:14, display:"flex", alignItems:"center", justifyContent:"center",
                    filter:`drop-shadow(0 0 3px ${m.color})`,
                    ...visStyle, pointerEvents:"none",
                  }}>
                  {m.icon}
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        );
      })()}

      {/* Front edge trim of the divider — thin strip, always solid shape, no hole, but transparent like the shelf */}
      <motion.div
        animate={{ z: baseZ }}
        style={{
          position:"absolute", width:DIV_W, height:DIV_H,
          marginLeft:-DIV_W/2, marginTop:-DIV_H/2,
          x:0, y:BY-BH/2-DIV_H/2-4, rotateY:180,
          background:"linear-gradient(180deg, rgba(200,204,216,0.18) 0%, rgba(154,160,176,0.18) 100%)",
          border:"1px solid rgba(122,128,144,0.5)",
          boxSizing:"border-box",
          backfaceVisibility:"hidden",
          ...visStyle, pointerEvents:"none",
        }}/>
      {/* ── Sorting divider shelf top surface — extends all the way back, matching the bins' own depth;
          closed by default, one hole opens matching the currently-sorting item's target bin ── */}
      <motion.div
        animate={{ z: baseZ + 65 }}
        style={{
          position:"absolute", width:DIV_W, height:130,
          marginLeft:-DIV_W/2, marginTop:-65,
          x:0, y:BY-BH/2-DIV_H-4,
          rotateX:-90,
          backfaceVisibility:"visible",
          ...visStyle, pointerEvents:"none",
        }}>
        <svg width={DIV_W} height="130" viewBox={`0 0 ${DIV_W} 130`} style={{position:"absolute",top:0,left:0}}>
          <defs>
            <linearGradient id="dividerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8ccd8"/>
              <stop offset="100%" stopColor="#9aa0b0"/>
            </linearGradient>
          </defs>
          <motion.path
            fillRule="evenodd"
            fill="url(#dividerGrad)"
            fillOpacity="0.18"
            stroke="#7a8090"
            strokeOpacity="0.5"
            strokeWidth="1"
            animate={{
              d: sorting
                ? `M0,0 H${DIV_W} V130 H0 Z ` + allTargetIdxs
                    .map(idx => `M${holeX(idx)},0 H${holeX(idx)+BW} V130 H${holeX(idx)} Z`)
                    .join(" ")
                : `M0,0 H${DIV_W} V130 H0 Z`
            }}
            transition={{ duration:0.25 }}
          />
        </svg>
      </motion.div>

      {/* ── Pullout bins — individual scene-space faces per bin ── */}
      {BINS.flatMap((b, i) => {
        const BD = 130;
        const pulled = pulledBins[i];
        const bZ = pulled ? baseZ - 190 : baseZ;
        const shade = `linear-gradient(180deg, ${b.col} 0%, ${b.dark} 100%)`;
        const sideShade = `linear-gradient(90deg, ${b.dark} 0%, ${b.col} 60%, ${b.dark} 100%)`;
        const spring = { type:"spring" as const, stiffness:160, damping:22 };

        return [
          /* Front face — rotateY:180 so it faces back-viewer */
          <motion.div key={`${i}f`}
            onClick={() => onPullBin(i)}
            animate={{ z: bZ }}
            transition={spring}
            style={{
              position:"absolute", width:BW, height:BH,
              marginLeft:-BW/2, marginTop:-BH/2,
              x:b.worldX, y:BY, rotateY:180,
              background:shade, borderRadius:8,
              backfaceVisibility:"hidden", cursor:"pointer",
              boxShadow: pulled
                ? `0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px ${b.col}88`
                : "0 4px 14px rgba(0,0,0,0.35)",
              ...visStyle,
            }}>
            <div style={{ position:"absolute", top:6, left:6, right:6, height:13, background:b.dark, borderRadius:4 }}/>
          </motion.div>,

          /* Top face — at bin top edge, rotateX(90) faces up; a real rim around a dark opening, not a flat panel */
          <motion.div key={`${i}t`}
            animate={{ z: bZ + BD/2 }}
            transition={spring}
            style={{
              position:"absolute", width:BW_R, height:BD,
              marginLeft:-BW_R/2, marginTop:-BD/2,
              x:b.worldX, y:BY - BH/2,
              rotateX:-90,
              background:sideShade,
              backfaceVisibility:"visible",
              ...visStyle,
            }}>
            <svg width={BW_R} height={BD} viewBox={`0 0 ${BW_R} ${BD}`} style={{position:"absolute",top:0,left:0}}>
              <rect x="0" y="0" width={BW_R} height="3" fill="white" opacity="0.25"/>
              <rect x={BW_R*0.1} y={BD*0.12} width={BW_R*0.8} height={BD*0.76} rx="6" fill="#050505"/>
              <rect x={BW_R*0.1} y={BD*0.12} width={BW_R*0.8} height={BD*0.76} rx="6" fill="none" stroke={b.dark} strokeWidth="2.5"/>
              <rect x={BW_R*0.1} y={BD*0.12} width={BW_R*0.8} height="6" rx="3" fill="black" opacity="0.55"/>
            </svg>
          </motion.div>,

          /* Bottom face — at bin bottom edge, horizontal */
          <motion.div key={`${i}b`}
            animate={{ z: bZ + BD/2 }}
            transition={spring}
            style={{
              position:"absolute", width:BW_R, height:BD,
              marginLeft:-BW_R/2, marginTop:-BD/2,
              x:b.worldX, y:BY + BH/2,
              rotateX:90,
              background: b.dark,
              backfaceVisibility:"visible",
              ...visStyle,
            }}/>,

          /* Left side — at left edge of bin */
          <motion.div key={`${i}l`}
            animate={{ z: bZ + BD/2 }}
            transition={spring}
            style={{
              position:"absolute", width:BD, height:BH,
              marginLeft:-BD/2, marginTop:-BH/2,
              x:b.worldX - BW_R/2, y:BY,
              rotateY:-90,
              background:shade,
              backfaceVisibility:"visible",
              ...visStyle,
            }}/>,

          /* Right side — at right edge of bin */
          <motion.div key={`${i}r`}
            animate={{ z: bZ + BD/2 }}
            transition={spring}
            style={{
              position:"absolute", width:BD, height:BH,
              marginLeft:-BD/2, marginTop:-BH/2,
              x:b.worldX + BW_R/2, y:BY,
              rotateY:90,
              background:shade,
              backfaceVisibility:"visible",
              ...visStyle,
            }}/>,
        ];
      })}

    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CASTER WHEEL  — a standalone 3D element (not part of any single
   face's SVG) built from three perpendicular copies of the same wheel
   graphic sharing one 3D point: two upright ones (visible face-on from
   front/back and left/right) plus one lying flat (visible from directly
   above/below). A flat decal drawn on just one face goes edge-on (and
   vanishes, or degenerates into a thin sliver) from a perpendicular
   viewing angle — three orientations sharing one pivot point is what
   keeps it reading as a single wheel from every angle.
═══════════════════════════════════════════════════════════════ */
function CasterWheel3D({ x, z }: { x: number; z: number }) {
  const gradId = `wheelGrad_${x}_${z}`;
  const orientations = [
    { key: "front", rot: "rotateY(0deg)",  bracket: true  },
    { key: "side",  rot: "rotateY(90deg)", bracket: true  },
    { key: "top",   rot: "rotateX(90deg)", bracket: false },
  ];
  return (
    <>
      {orientations.map(({ key, rot, bracket }) => (
        // Tiny epsilon nudge along each plane's own (rotated) Z axis — otherwise the
        // planes share one exact 3D point and cross through each other, which puts the
        // browser's depth sort in a degenerate tie and can hide all of them.
        <Face key={key} w={40} h={70} bfv="visible" overflow="visible" style={{ borderRadius: 0 }}
          tf={`translateX(${x}px) translateY(${HH - 4}px) translateZ(${z}px) ${rot} translateZ(0.5px)`}>
          <svg width="40" height="70" viewBox="0 0 40 70" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <defs>
              <radialGradient id={`${gradId}_${key}`} cx="35%" cy="30%">
                <stop offset="0%"   stopColor="#6b7280"/>
                <stop offset="30%"  stopColor="#374151"/>
                <stop offset="65%"  stopColor="#161a24"/>
                <stop offset="100%" stopColor="#04060a"/>
              </radialGradient>
            </defs>
            {bracket && <>
              <rect x="5" y="15" width="30" height="13" rx="4" fill="#c9cdd6" stroke="#9aa0ac" strokeWidth="1"/>
              <rect x="5" y="15" width="30" height="4" rx="2" fill="white" opacity="0.35"/>
            </>}
            <circle cx="20" cy="35" r="15" fill={`url(#${gradId}_${key})`} stroke="#04060a" strokeWidth="1"/>
            <circle cx="15.5" cy="30" r="4.5" fill="white" opacity="0.25"/>
          </svg>
        </Face>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BACK FACE  (420 × 360)
═══════════════════════════════════════════════════════════════ */
function BackFace({ ex, doorOpen, onDoorToggle }: {
  ex:number; doorOpen:boolean; onDoorToggle:()=>void;
}) {
  return (
    <Face w={W} h={H} tf={`rotateY(180deg) translateZ(${HD+ex}px)`} overflow="visible" bfv="visible" style={{ borderRadius: 0 }}>
      {/* ── Interior bg — visible from all back angles ── */}
      <svg width={W} height={H+30} viewBox={`0 0 ${W} ${H+30}`} xmlns="http://www.w3.org/2000/svg"
        style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}>
        <defs>
          <linearGradient id="interiorBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d0d5e5"/>
            <stop offset="10%"  stopColor="#e6eaf3"/>
            <stop offset="50%"  stopColor="#eef0f7"/>
            <stop offset="90%"  stopColor="#e2e6f0"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
        </defs>
      </svg>

      {/* ── Animated door panel ── */}
      <div
        onClick={onDoorToggle}
        title={doorOpen ? "Close door" : "Open maintenance door"}
        style={{
          position:'absolute', top:0, left:0, width:W, height:H,
          transformOrigin:'0% 50%',
          transform: doorOpen ? 'perspective(900px) rotateY(-118deg)' : 'rotateY(0deg)',
          transition:'transform 0.75s cubic-bezier(0.4,0,0.2,1)',
          borderRadius:0, overflow:'hidden',
          cursor:'pointer',
          transformStyle:'preserve-3d',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
          style={{display:'block',position:'absolute',top:0,left:0}}>
          <defs>
            <linearGradient id="doorGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#d0d5e5"/>
              <stop offset="10%"  stopColor="#e6eaf3"/>
              <stop offset="50%"  stopColor="#eef0f7"/>
              <stop offset="90%"  stopColor="#e2e6f0"/>
              <stop offset="100%" stopColor="#d0d5e5"/>
            </linearGradient>
          </defs>
          <rect width={W} height={H-24} fill="url(#doorGrad)"/>
          {/* Decorative frame outline */}
          <rect x="14" y="14" width={W-28} height={H-24-28} rx="18"
            fill="none" stroke="#aab0c0" strokeWidth="1.25" opacity="0.8"/>
          {/* Hinges */}
          {[50, 240].map((hy,i)=>(
            <g key={i}>
              <rect x="4" y={hy} width="16" height="32" rx="3" fill="#9098a8" stroke="#7880a0" strokeWidth="0.8"/>
              <rect x="5" y={hy+2} width="14" height="28" rx="2" fill="#a8b0c0"/>
              <circle cx="12" cy={hy+16} r="3.5" fill="#7880a0"/>
              <rect x="7" y={hy+5} width="10" height="2" rx="1" fill="white" opacity="0.25"/>
            </g>
          ))}
          {/* Pull handle */}
          <rect x={W-46} y={H/2-60} width="24" height="80" rx="8" fill="#b0b8c4" stroke="#9298a8" strokeWidth="1"/>
          <rect x={W-45} y={H/2-59} width="22" height="78" rx="7" fill="#c8d0dc"/>
          <rect x={W-43} y={H/2-50} width="18" height="60" rx="9" fill="#1a1e28" stroke="#22283a" strokeWidth="0.6"/>
          <rect x={W-41} y={H/2-42} width="14" height="44" rx="7" fill="#0e1018"/>
          <rect x={W-40} y={H/2-40} width="12" height="5" rx="2" fill="white" opacity="0.08"/>
          {/* Vent slots */}
          {[H-108,H-98,H-88,H-78,H-68].map((y,i)=>(
            <rect key={i} x="60" y={y} width={W-120} height="5" rx="2.5" fill="#c8ccd8" opacity="0.55"/>
          ))}
        </svg>
        {/* Door inside face */}
        <div style={{
          position:'absolute', top:0, left:0, width:W, height:H,
          backfaceVisibility:'hidden', transform:'rotateY(180deg)',
          background:'linear-gradient(90deg, #7888a0, #9aa0b2)',
          borderRadius:0,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{color:'#5a6270', fontSize:10, fontWeight:700, letterSpacing:4, writingMode:'vertical-rl'}}>
            DOOR PANEL
          </div>
        </div>
      </div>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP FACE  (420 × 180)
═══════════════════════════════════════════════════════════════ */
function SlopedTopFace({ ex }: { ex: number }) {
  /* Slope goes from front-bottom (z=+HD+ex, y=-HH) to back-top (z=+HD+ex-SLOPE_D, y=-(HH+SLOPE)).
     sinA = SLOPE_D/LID_H, cosA = SLOPE/LID_H.
     Center: y_c=-(HH+SLOPE/2), z_c=(HD+ex-SLOPE_D/2).
     P = y_c*cosA + z_c*sinA,  T = z_c*cosA - y_c*sinA.
     Transform: rotateX(A) translateY(P) translateZ(T)  (right-to-left). */
  const sinA = SLOPE_D / LID_H;
  const cosA = SLOPE / LID_H;
  const A_deg = Math.asin(sinA) * 180 / Math.PI;
  const y_c = -(HH + SLOPE / 2);
  const z_c = HD + ex - SLOPE_D / 2;
  const P = Math.round(y_c * cosA + z_c * sinA);
  const T = Math.round(z_c * cosA - y_c * sinA);
  return (
    <Face w={W} h={LID_H} bfv="visible" style={{ borderRadius: 0 }}
      tf={`rotateX(${A_deg.toFixed(2)}deg) translateY(${P}px) translateZ(${T}px)`}>
      <svg width={W} height={LID_H} viewBox={`0 0 ${W} ${LID_H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="slopeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e6eaf3"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
        </defs>
        <rect width={W} height={LID_H} fill="url(#slopeGrad)"/>
        {/* Top edge highlight */}
        <rect width={W} height="5" fill="white" opacity="0.3"/>
        {/* EcoNova brand */}
        <text x={W/2} y={LID_H * 0.32} textAnchor="middle" dominantBaseline="middle"
          fontSize="42" fontWeight="800" fontStyle="italic" fill="#8898b8" opacity="0.55"
          letterSpacing="5">EcoNova</text>

        {/* ── WASTE INPUT SLOT ── */}
        {/* Label above slot */}
        <text x={W/2} y={LID_H*0.44} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fontWeight="700" fill="#8898a8" letterSpacing="2" opacity="0.75">
          ▼  INSERT WASTE
        </text>
        {/* Outer rim / raised lip */}
        <rect x={W/2-170} y={LID_H*0.47} width="340" height="86" rx="12"
          fill="#c0c4d0" opacity="0.65"/>
        {/* Slot opening */}
        <rect x={W/2-168} y={LID_H*0.47+3} width="336" height="80" rx="10"
          fill="#07090e"/>
        {/* Inner top-edge shadow (depth) */}
        <rect x={W/2-168} y={LID_H*0.47+3} width="336" height="16" rx="8"
          fill="black" opacity="0.65"/>
        {/* Inner bottom reflection */}
        <rect x={W/2-168} y={LID_H*0.47+60} width="336" height="18" rx="6"
          fill="#181c28" opacity="0.45"/>
        {/* Side shadow lines */}
        <rect x={W/2-168} y={LID_H*0.47+3} width="8" height="80" rx="4"
          fill="black" opacity="0.3"/>
        <rect x={W/2+160} y={LID_H*0.47+3} width="8" height="80" rx="4"
          fill="black" opacity="0.4"/>
        {/* Rim top highlight */}
        <rect x={W/2-170} y={LID_H*0.47} width="340" height="3" rx="2"
          fill="white" opacity="0.45"/>
        {/* Rim bottom shadow */}
        <rect x={W/2-170} y={LID_H*0.47+83} width="340" height="3" rx="2"
          fill="black" opacity="0.2"/>

        {/* Front edge accent line */}
        <rect y={LID_H-3} width={W} height="3" fill="white" opacity="0.45"/>
      </svg>
    </Face>
  );
}

function FlatTopFace({ ex }: { ex: number }) {
  /* Horizontal surface at y=-(HH+SLOPE), spanning z from -(HD+ex) to -(HD+ex)+FLAT_D.
     Using rotateX(90deg) translateZ(HH+SLOPE) translateY(Y_shift):
       world y = -(HH+SLOPE),  world z_center = -(HD+ex) + FLAT_D/2 = Y_shift. */
  const Y_shift = -(HD + ex) + FLAT_D / 2;
  return (
    <Face w={W} h={FLAT_D} bfv="visible" style={{ borderRadius: 0 }}
      tf={`rotateX(90deg) translateZ(${HH + SLOPE}px) translateY(${Math.round(Y_shift)}px)`}>
      <svg width={W} height={FLAT_D} viewBox={`0 0 ${W} ${FLAT_D}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flatTopGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e6eaf3"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
          <radialGradient id="camLensTop" cx="38%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#1e3a5f"/>
            <stop offset="60%"  stopColor="#0a1628"/>
            <stop offset="100%" stopColor="#060c14"/>
          </radialGradient>
        </defs>
        <rect width={W} height={FLAT_D} fill="url(#flatTopGrad)"/>
        <rect width={W} height="2" fill="white" opacity="0.25"/>
        {/* Sensor / camera dome centered */}
        <ellipse cx={W/2} cy={FLAT_D/2} rx="22" ry="19" fill="#1a1c26" opacity="0.82"/>
        <circle  cx={W/2} cy={FLAT_D/2} r="14" fill="#0d0f18" opacity="0.95"/>
        <circle  cx={W/2} cy={FLAT_D/2} r="9"  fill="url(#camLensTop)"/>
        <circle  cx={W/2} cy={FLAT_D/2} r="4"  fill="#38bdf8" opacity="0.8"/>
        <circle  cx={W/2-2} cy={FLAT_D/2-2} r="1.5" fill="white" opacity="0.45"/>
        {/* Status LEDs flanking the sensor */}
        <circle cx={W/2-38} cy={FLAT_D/2} r="3.5" fill="#22c55e" opacity="0.9"
          style={{filter:"drop-shadow(0 0 3px #22c55e)"}}/>
        <circle cx={W/2+38} cy={FLAT_D/2} r="3.5" fill="#22c55e" opacity="0.9"
          style={{filter:"drop-shadow(0 0 3px #22c55e)"}}/>
        {/* Clean accent line along front edge */}
        <rect x="40" y={FLAT_D-5} width={W-80} height="2" rx="1" fill="white" opacity="0.45"/>
      </svg>
    </Face>
  );
}

function SlopeBackFill({ ex }: { ex: number }) {
  /* Vertical fill at z=-(HD+ex), from y=-(HH+SLOPE) to y=-HH.
     rotateY(180deg) translateY(SLOPE_CY) translateZ(HD+ex) → world z=-(HD+ex).
     Extended 3px past its bottom edge (top edge left untouched) to overlap BackFace
     underneath and hide the antialiasing seam where the two flat 3D planes meet. */
  const OVERLAP = 3;
  return (
    <Face w={W} h={SLOPE+OVERLAP} bfv="visible" style={{ borderRadius: 0 }}
      tf={`rotateY(180deg) translateY(${SLOPE_CY + OVERLAP/2}px) translateZ(${HD + ex}px)`}>
      <svg width={W} height={SLOPE+OVERLAP} viewBox={`0 0 ${W} ${SLOPE+OVERLAP}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="backFillGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d0d5e5"/>
            <stop offset="10%"  stopColor="#e6eaf3"/>
            <stop offset="50%"  stopColor="#eef0f7"/>
            <stop offset="90%"  stopColor="#e2e6f0"/>
            <stop offset="100%" stopColor="#d0d5e5"/>
          </linearGradient>
        </defs>
        <rect width={W} height={SLOPE+OVERLAP} fill="url(#backFillGrad)"/>
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP WEDGE (Combined Top Faces)
═══════════════════════════════════════════════════════════════ */
function TopWedge({ ex }: { ex: number }) {
  return (
    <>
      <SlopedTopFace ex={ex} />
      <FlatTopFace ex={ex} />
      <SlopeBackFill ex={ex} />
    </>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function _TopFace_deleted({ scanActive, ex }: { scanActive: boolean; ex: number }) {
  return (
    <Face w={W} h={D} tf={`rotateX(90deg) translateZ(${HH + ex}px)`} style={{ borderRadius: 0 }}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaeef6" />
            <stop offset="100%" stopColor="#d8dce8" />
          </linearGradient>
          <radialGradient id="thole" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#010305" />
            <stop offset="55%"  stopColor="#030810"/>
            <stop offset="100%" stopColor="#080f1c"/>
          </radialGradient>
        </defs>
        <rect width={W} height={D} rx="16" fill="url(#tb)"/>
        <rect x="1" y="1" width={W-2} height={D-2} rx="15" fill="none" stroke="#c8ccd8" strokeWidth="1"/>
        <rect x="0" y="0" width={W} height="8" rx="8" fill="white" opacity="0.20"/>
        <rect x="14" y="36" width={W-28} height={D-52} rx="10" fill="#181e2c"/>
        <rect x="15" y="37" width={W-30} height="5"  rx="4" fill="white" opacity="0.05"/>
        <rect x="15" y="37" width="5"    height={D-54} rx="3" fill="white" opacity="0.04"/>
        <rect x="20" y="42" width={W-40} height={D-58} rx="8" fill="url(#thole)"/>
        <rect x="20" y="42" width={W-40} height="18" rx="7" fill="black" opacity="0.52"/>
        <rect x="20" y="42" width="18"   height={D-58} rx="6" fill="black" opacity="0.38"/>
        <rect x={W-38} y="42" width="18" height={D-58} rx="6" fill="black" opacity="0.14"/>
        <rect x="20" y="42" width={W-40} height={D-58} rx="8" fill="none"
          stroke={scanActive?"#0ea5e9":"#0e1a2e"}
          strokeWidth={scanActive?2:1}
          opacity={scanActive?0.95:0.7}
          style={scanActive?{filter:"drop-shadow(0 0 8px #0ea5e9)"}:undefined}/>
        {scanActive && (
          <motion.rect x="20" y="42" width={W-40} height={D-58} rx="8"
            fill="#0ea5e9" opacity={0}
            animate={{opacity:[0,0.07,0]}}
            transition={{duration:0.8,repeat:Infinity}}/>
        )}
        {[[22,44],[W-22,44],[22,D-14],[W-22,D-14]].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r="2.5"
            fill={scanActive?"#0ea5e9":"#2a3a52"} opacity="0.65"/>
        ))}
      </svg>
    </Face>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM FACE  (420 × 180)
═══════════════════════════════════════════════════════════════ */
function BottomFace({ ex }: { ex: number }) {
  return (
    <Face w={W} h={D} tf={`rotateX(-90deg) translateZ(${HH+ex}px)`} style={{ borderRadius: 0 }}>
      <svg width={W} height={D} viewBox={`0 0 ${W} ${D}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={D} fill="#e0e4ee"/>
        <rect x="1" y="1" width={W-2} height={D-2} fill="none" stroke="#c8ccd8" strokeWidth="1.5"/>
        {[
          [32,28],[W-32,28],[32,D-28],[W-32,D-28]
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
   INTERNAL CUTAWAY CROSS-SECTION
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
        <rect width={W} height={H} fill="url(#ciBg)"/>
        <rect width={W} height={H} fill="url(#ciGlow1)"/>
        <rect width={W} height={H} fill="url(#ciGlow2)"/>
        <rect x="1" y="1" width={W-2} height={H-2} fill="none" stroke="#0c2a42" strokeWidth="1"/>
        {/* Rails */}
        {[6, W-8].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="8" width="4" height={H-40} rx="2" fill="#0d1f30" stroke="#1a3a54" strokeWidth="0.5"/>
            {Array.from({length:10},(_,j)=>(
              <rect key={j} x={x-1} y={28+j*30} width="6" height="3" rx="1" fill="#1e3a54"/>
            ))}
          </g>
        ))}
        {/* Shelf dividers */}
        {[164, 350].map((y,i)=>(
          <rect key={i} x="10" y={y} width={W-20} height="2" rx="1" fill="#0f2030" stroke="#1a3550" strokeWidth="0.4"/>
        ))}
        {/* Zone 1: AI Housing */}
        <rect x="12" y="12" width={W-24} height="150" rx="6" fill="#050f1c" stroke="#0c2038" strokeWidth="0.8"/>
        <circle cx={W/2} cy="44" r="22" fill="#030c18" stroke="#0a1e32" strokeWidth="1.2"/>
        <circle cx={W/2} cy="44" r="16" fill="#04111e" stroke="#0e2840" strokeWidth="1"/>
        <circle cx={W/2} cy="44" r="10" fill="#071828" stroke="#1a4060" strokeWidth="0.8"/>
        <circle cx={W/2} cy="44" r="6"  fill="#0a1f35" style={{filter:glowBlue}}/>
        <circle cx={W/2} cy="44" r="3"  fill="#22d3ee" opacity="0.95" style={{filter:glowBlue}}/>
        <path d={`M${W/2-4},62 L${W/2+4},62 L${W/2+60},160 L${W/2-60},160`} fill="#22d3ee" opacity="0.05"/>
        <rect x="18" y="20" width="100" height="44" rx="4" fill="#061020" stroke="#0d2040" strokeWidth="0.6"/>
        {Array.from({length:5},(_,i)=>(
          <circle key={i} cx={26+i*16} cy="32" r="2" fill="#22d3ee" opacity="0.55" style={{filter:glowBlue}}/>
        ))}
        <text x="68" y="57" textAnchor="middle" fill="#1e5070" fontSize="5" letterSpacing="0.3">CAMERA PCB</text>
        <rect x={W-118} y="20" width="100" height="44" rx="4" fill="#040d1a" stroke="#0d2038" strokeWidth="0.6"/>
        <rect x={W-112} y="26" width="50" height="28" rx="3" fill="#060f1e" stroke="#1a3254" strokeWidth="0.8"/>
        {Array.from({length:4},(_,i)=>(
          <rect key={i} x={W-110+i*11} y="29" width="8" height="22" rx="1.5" fill="#081828" stroke="#122840" strokeWidth="0.3"/>
        ))}
        <text x={W-68} y="57" textAnchor="middle" fill="#1e5070" fontSize="5" letterSpacing="0.3">AI PROCESSOR</text>
        <rect x="18" y="72" width={W-36} height="88" rx="5" fill="#030a16" stroke="#0a1c30" strokeWidth="0.8"/>
        <text x={W/2} y="118" textAnchor="middle" fill="#1e4060" fontSize="6" letterSpacing="0.8">AI DISPLAY</text>
        {/* Zone 2: Sorting */}
        <rect x="12" y="166" width={W-24} height="16" rx="3" fill="#040c18" stroke="#0a1c30" strokeWidth="0.6"/>
        {[57,159,261,363].map((cx,i)=>(
          <g key={i}>
            <circle cx={cx} cy="174" r="3.5" fill="#040c18" stroke="#1a3050" strokeWidth="0.5"/>
            <circle cx={cx} cy="174" r="1.6" fill="#22d3ee" opacity="0.8" style={{filter:glowBlue}}/>
            <path d={`M${cx-8},182 L${cx+8},182 L${cx+14},186 L${cx-14},186`}
              fill="#060d1c" stroke="#0d2038" strokeWidth="0.5"/>
          </g>
        ))}
        {/* Zone 3: 4 Bins */}
        {[
          {x:10,  stroke:"#ea580c", light:"#f97316", label:"PLASTIC", fill:fills[0]/100},
          {x:112, stroke:"#1d4ed8", light:"#2563eb", label:"PAPER",   fill:fills[1]/100},
          {x:214, stroke:"#78350f", light:"#92400e", label:"GLASS",   fill:fills[2]/100},
          {x:316, stroke:"#374151", light:"#6b7280", label:"TRASH",   fill:fills[3]/100},
        ].map(b=>{
          const bw=94, bh=158, by=186;
          const fillH = bh * b.fill;
          return (
            <g key={b.label}>
              <rect x={b.x} y={by} width={bw} height={bh} rx="4"
                fill="#050f1a" stroke={b.stroke} strokeWidth="0.8"/>
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
        {/* Zone 4: Battery */}
        <rect x="12" y="352" width={W-24} height="58" rx="6" fill="#040c14" stroke="#0a1c2c" strokeWidth="0.8"/>
        <text x={W/2} y="366" textAnchor="middle" fontSize="6" fontWeight="700" fill="#22d3ee" letterSpacing="1"
          style={{filter:glowBlue}}>BACKUP BATTERY  ·  12V 22Ah  ·  Li-ion</text>
        <rect x="32" y="370" width={W-64} height="30" rx="6" fill="#060e1c" stroke="#0d2038" strokeWidth="1"/>
        <rect x="20" y="378" width="14" height="10" rx="3" fill="#0a1828"/>
        <rect x={W-34} y="378" width="14" height="10" rx="3" fill="#0a1828"/>
        <rect x="38" y="380" width={W-76} height="5" rx="3" fill="#030810"/>
        <rect x="40" y="381" width={(W-80)*0.90} height="3" rx="2" fill="url(#batFill)" opacity="0.75"/>
        <text x={W/2} y="398" textAnchor="middle" fontSize="5.5" fontWeight="700"
          fill="#22d3ee" style={{filter:glowBlue}}>90%</text>
        {/* Wiring */}
        {[
          {x1:W/2, y1:62, x2:W/2, y2:68, c:"#22d3ee"},
          {x1:57,  y1:182,x2:57,  y2:186, c:"#f97316"},
          {x1:159, y1:182,x2:159, y2:186, c:"#2563eb"},
          {x1:261, y1:182,x2:261, y2:186, c:"#92400e"},
          {x1:363, y1:182,x2:363, y2:186, c:"#6b7280"},
          {x1:20,  y1:346,x2:20,  y2:352, c:"#f87171"},
          {x1:W-20,y1:346,x2:W-20,y2:352,c:"#f87171"},
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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SmartBin3D() {
  const [rotX, setRotX] = useState(-24);
  const [rotY, setRotY] = useState(28);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [zoom, setZoom]   = useState(isMobile ? 0.42 : 0.76);
  const [autoRotate, setAutoRotate] = useState(false);
  const [phase, setPhase] = useState<SortPhase>("idle");
  const [activeItem, setActiveItem] = useState<WasteItem>(WASTE[0]);
  const [scanPct, setScanPct] = useState(0);
  const [fills, setFills] = useState([0, 0, 0, 0]);

  const [doorOpen, setDoorOpen] = useState(false);
  const [binsVisible, setBinsVisible] = useState(false);
  const [pulledBins, setPulledBins] = useState([false,false,false,false]);
  const [qrPoints, setQrPoints] = useState(120);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrDone, setQrDone] = useState(false);

  useEffect(()=>{
    const t = setTimeout(()=>setBinsVisible(doorOpen), 200);
    return ()=>clearTimeout(t);
  },[doorOpen]);

  function pullBin(i:number) {
    if(!doorOpen) return;
    setPulledBins(prev=>{ const n=[...prev]; n[i]=!n[i]; return n; });
  }

  function toggleDoor() {
    setDoorOpen(d=>{
      if(d){ setPulledBins([false,false,false,false]); }
      else { goPreset("back"); }
      return !d;
    });
  }

  const drag = useRef<{sx:number;sy:number;rx:number;ry:number}|null>(null);
  const pinch = useRef<{dist:number;z:number}|null>(null);
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
        if(v>=100){ clearInterval(iv); setPhase("breakdown"); }
      },40);
      return()=>clearInterval(iv);
    }
    if(phase==="detected"){
      const t=setTimeout(()=>setPhase("breakdown"), 1600);
      return()=>clearTimeout(t);
    }
    if(phase==="breakdown"){
      const t=setTimeout(()=>{
        setPhase("sorted");
        setFills(prev=>{
          const n=[...prev];
          for(const m of BREAKDOWN[activeItem.id]){
            const idx = BIN_LABEL_TO_IDX[m.bin];
            if(idx===undefined) continue; // e.g. residual liquid — not sorted into any bin
            n[idx] = Math.min(n[idx] + Math.round(m.pct*0.16), 100);
          }
          return n;
        });
        setTimeout(()=>setPhase("idle"),2000);
      },3000);
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

  const touchDist=(e:React.TouchEvent)=>{
    const [a,b]=[e.touches[0],e.touches[1]];
    return Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY);
  };
  const onTouchStart=useCallback((e:React.TouchEvent)=>{
    setAutoRotate(false);
    if(e.touches.length>=2){
      drag.current=null;
      pinch.current={dist:touchDist(e),z:zoom};
      return;
    }
    pinch.current=null;
    const t=e.touches[0];
    drag.current={sx:t.clientX,sy:t.clientY,rx:rotX,ry:rotY};
  },[rotX,rotY,zoom]);
  const onTouchMove=useCallback((e:React.TouchEvent)=>{
    if(e.touches.length>=2 && pinch.current){
      e.preventDefault();
      const scale=touchDist(e)/pinch.current.dist;
      setZoom(Math.max(0.38,Math.min(1.7,pinch.current.z*scale)));
      return;
    }
    if(!drag.current) return;
    e.preventDefault();
    const t=e.touches[0];
    setRotY(drag.current.ry+(t.clientX-drag.current.sx)*0.36);
    setRotX(Math.max(-82,Math.min(82,drag.current.rx-(t.clientY-drag.current.sy)*0.26)));
  },[]);
  const onTouchEnd=useCallback((e:React.TouchEvent)=>{
    drag.current=null;
    pinch.current=null;
    if(e.touches.length===1){
      const t=e.touches[0];
      drag.current={sx:t.clientX,sy:t.clientY,rx:rotX,ry:rotY};
    }
  },[rotX,rotY]);

  function goPreset(name:string){
    setAutoRotate(false);
    const [rx,ry]=PRESETS[name];
    setRotX(rx); setRotY(ry);
  }

  function triggerSort(item:WasteItem){
    if(phase!=="idle") return;
    setActiveItem(item); setScanPct(0); setPhase("hovering");
  }

  function scanQR() {
    if(qrScanning||qrDone) return;
    setQrScanning(true);
    setTimeout(()=>{
      setQrPoints(p=>p+10);
      setQrScanning(false);
      setQrDone(true);
      setTimeout(()=>setQrDone(false), 3000);
    }, 2000);
  }

  const ex = 0;

  const BIN_COLOR_NAMES = ["ORANGE","BLUE","BROWN","BLACK"];

  return (
    <div className="size-full flex flex-col overflow-hidden bg-white">

      {/* ── Brand header ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-end px-3 sm:px-8 py-2 sm:py-4 z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap justify-end">
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5">
            <span className="text-slate-400 text-[9px] sm:text-[10px] mr-0.5 hidden sm:inline">DEMO SORT:</span>
            {WASTE.map(item=>(
              <button key={item.id} onClick={()=>triggerSort(item)}
                disabled={phase!=="idle"}
                className={`text-base sm:text-xl leading-none transition-all ${phase!=="idle"?"opacity-30 cursor-not-allowed":"hover:scale-125 cursor-pointer"}`}
                title={item.label}>
                {item.emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5">
            <span className="text-amber-600 text-[9px] sm:text-[10px] font-black">⭐ {qrPoints}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale:[1,1.4,1] }} transition={{ duration:2, repeat:Infinity }}
              style={{ filter:"drop-shadow(0 0 4px #34d399)" }}/>
            <span className="text-emerald-400 text-[10px] font-medium">ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── 3D VIEWPORT ── */}
      <div className="flex-1 relative flex items-center justify-center pt-20 sm:pt-36"
        style={{ cursor: drag.current ? "grabbing" : "grab", touchAction:"none" }}
        onMouseDown={onDown} onMouseMove={onMove}
        onMouseUp={onUp} onMouseLeave={onUp}
        onWheel={e=>setZoom(z=>Math.max(0.38,Math.min(1.7,z-e.deltaY*0.001)))}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        <AnimatePresence>
          {!drag.current && (
            <motion.div className="absolute top-16 left-1/2 -translate-x-1/2 text-slate-400 text-xs pointer-events-none font-medium tracking-widest whitespace-nowrap hidden sm:block"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
              DRAG TO ROTATE  ·  SCROLL TO ZOOM
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-8 right-3 sm:top-20 sm:right-6 text-slate-400 text-[9px] sm:text-[10px] font-mono text-right pointer-events-none hidden sm:block">
          <div>X {Math.round(rotX)}°</div>
          <div>Y {Math.round(rotY%360)}°</div>
          <div>Z {Math.round(zoom*100)}%</div>
        </div>

        <AnimatePresence>
        </AnimatePresence>

        {/* ══ CSS 3D SCENE ══ */}
        <div style={{ perspective:1400, perspectiveOrigin:"50% 50%" }}>
          <motion.div
            animate={{ rotateX:rotX, rotateY:rotY, scale:zoom }}
            transition={{ type:"spring", stiffness:160, damping:28, mass:0.8 }}
            style={{ transformStyle:"preserve-3d", position:"relative", width:0, height:0 }}
          >
            <FrontFace phase={phase} item={activeItem} fills={fills} scanPct={scanPct} ex={ex}/>
            <RightFace ex={ex} onQrScan={scanQR} qrScanning={qrScanning} qrDone={qrDone}/>
            <LeftFace hidden={false} ex={ex}/>
            <BackFace ex={ex} doorOpen={doorOpen} onDoorToggle={toggleDoor}/>
            <TopWedge ex={ex} />
            <InteriorWalls ex={ex}/>
            <InteriorBins ex={ex} doorOpen={binsVisible} pulledBins={pulledBins} onPullBin={pullBin}
              phase={phase} item={activeItem}/>
            <CasterWheel3D x={-(HW-WHEEL_INSET)} z={ (HD-WHEEL_INSET)}/>
            <CasterWheel3D x={ (HW-WHEEL_INSET)} z={ (HD-WHEEL_INSET)}/>
            <CasterWheel3D x={-(HW-WHEEL_INSET)} z={-(HD-WHEEL_INSET)}/>
            <CasterWheel3D x={ (HW-WHEEL_INSET)} z={-(HD-WHEEL_INSET)}/>
          </motion.div>
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ── */}
      <div className="shrink-0 w-full overflow-x-auto pb-5 pt-3 px-3">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 backdrop-blur-sm shadow-sm w-max mx-auto">
          <CtrlBtn active={autoRotate} onClick={()=>setAutoRotate(r=>!r)} label="360°"
            title={autoRotate?"Stop Rotation":"Auto Rotate 360°"}/>
          <CtrlBtn onClick={()=>setZoom(z=>Math.min(1.7,z+0.12))} label="ZOOM +" title="Zoom In"/>
          <CtrlBtn onClick={()=>setZoom(z=>Math.max(0.38,z-0.12))} label="ZOOM −" title="Zoom Out"/>
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          {(["front","back","left","right","top","bottom"] as const).map(p=>(
            <CtrlBtn key={p} onClick={()=>goPreset(p)} label={p.toUpperCase()} title={`${p} view`}/>
          ))}
          <CtrlBtn
            active={doorOpen}
            onClick={toggleDoor}
            label={doorOpen ? "CLOSE DOOR" : "DOOR"}
            title="Toggle maintenance door"/>
          <div className="w-px h-6 bg-slate-200 mx-1"/>
          <CtrlBtn
            onClick={() => { setRotX(-24); setRotY(28); setZoom(isMobile ? 0.42 : 0.76); setAutoRotate(false); setFills([0, 0, 0, 0]); }}
            label="RESET"
            title="Reset view and bin fills"/>
        </div>
      </div>

      {/* Status badges */}
      <AnimatePresence>
        {(phase==="hovering" || phase==="scanning") && (
          <motion.div
            className="absolute top-10 sm:top-20 left-3 sm:left-8 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2.5 backdrop-blur-sm"
            initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
            <motion.div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400"
              animate={{ scale:[1,1.5,1] }} transition={{ duration:0.7, repeat:Infinity }}
              style={{ filter:"drop-shadow(0 0 5px #fbbf24)" }}/>
            <span className="text-amber-300 text-[10px] sm:text-xs font-bold">AI SCANNING · {Math.round(scanPct)}%</span>
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
