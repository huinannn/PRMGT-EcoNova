import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WasteType } from "../App";

type Phase = "idle" | "hovering" | "scanning" | "identified" | "gating" | "falling" | "done";

interface WasteItem { id: WasteType; label: string; emoji: string; desc: string; color: string; binIdx: number; confidence: number; }
const ITEMS: WasteItem[] = [
  { id:"plastic", label:"Plastic Bottle", emoji:"🍶", desc:"PET · 500ml", color:"#3b82f6", binIdx:0, confidence:95 },
  { id:"paper",   label:"Newspaper",      emoji:"📰", desc:"Cellulose paper", color:"#eab308", binIdx:2, confidence:97 },
  { id:"organic", label:"Banana Peel",    emoji:"🍌", desc:"Organic waste",   color:"#22c55e", binIdx:1, confidence:93 },
];
const BINS = [
  { label:"PLASTIC", color:"#3b82f6", bg:"#1d4ed8", light:"#93c5fd", icon:"♻" },
  { label:"ORGANIC", color:"#22c55e", bg:"#15803d", light:"#86efac", icon:"🌿" },
  { label:"PAPER",   color:"#eab308", bg:"#a16207", light:"#fde047", icon:"📰" },
];
const GATE_ANGLES = [-36, 0, 36];
const ITEM_DROP_X = [52, 152, 252]; // bin center X in robot SVG

interface Props { onSorted: (t: WasteType) => void; fills: { plastic: number; organic: number; paper: number }; }

export default function SortingDemo({ onSorted, fills }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<WasteItem>(ITEMS[0]);
  const [scanPct, setScanPct] = useState(0);
  const [gateAngle, setGateAngle] = useState(0);
  const [localFills, setLocalFills] = useState(fills);
  const [splashIdx, setSplashIdx] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>(["System ready. Select a waste item to begin."]);
  const [sortCount, setSortCount] = useState({ plastic:0, organic:0, paper:0 });
  const logRef = useRef<HTMLDivElement>(null);

  const busy = !["idle","done"].includes(phase);
  const fillArr = [localFills.plastic, localFills.organic, localFills.paper];

  useEffect(() => { setLocalFills(fills); }, [fills]);

  function addLog(msg: string) {
    setLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()} › ${msg}`]);
    setTimeout(() => logRef.current?.scrollTo(0, 99999), 50);
  }

  function startSort(item: WasteItem) {
    if (busy) return;
    setActive(item);
    setPhase("hovering");
    setScanPct(0);
    addLog(`Item selected: ${item.label}`);
  }

  /* ── Phase sequence ── */
  useEffect(() => {
    if (phase === "hovering") {
      const t = setTimeout(() => { setPhase("scanning"); addLog("Camera activated — scanning object…"); }, 500);
      return () => clearTimeout(t);
    }
    if (phase === "identified") {
      addLog(`Detected: ${active.label} · Category: ${active.id.toUpperCase()} · Confidence: ${active.confidence}%`);
      const t = setTimeout(() => {
        setPhase("gating");
        setGateAngle(GATE_ANGLES[active.binIdx]);
        addLog(`Servo gate rotating → ${BINS[active.binIdx].label} bin`);
      }, 1200);
      return () => clearTimeout(t);
    }
    if (phase === "gating") {
      const t = setTimeout(() => { setPhase("falling"); addLog("Dropping waste…"); }, 800);
      return () => clearTimeout(t);
    }
    if (phase === "falling") {
      const t = setTimeout(() => {
        setLocalFills(prev => {
          const k = active.id;
          return { ...prev, [k]: Math.min(prev[k] + 14, 95) };
        });
        setSplashIdx(active.binIdx);
        setSortCount(prev => ({ ...prev, [active.id]: prev[active.id] + 1 }));
        onSorted(active.id);
        addLog(`✓ Sorted into ${BINS[active.binIdx].label} bin. Fill level updated.`);
        setTimeout(() => {
          setSplashIdx(null);
          setGateAngle(0);
          setPhase("done");
          setTimeout(() => setPhase("idle"), 800);
        }, 1000);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  /* ── Scan progress ── */
  useEffect(() => {
    if (phase !== "scanning") return;
    let v = 0;
    const iv = setInterval(() => {
      v += 2.8;
      setScanPct(Math.min(v, 100));
      if (v >= 100) { clearInterval(iv); setPhase("identified"); }
    }, 38);
    return () => clearInterval(iv);
  }, [phase]);

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* ── Left: Item tray ── */}
      <aside className="w-52 bg-[#0b1628] border-r border-white/10 p-4 flex flex-col gap-4 shrink-0">
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Waste Items</p>
          <p className="text-[10px] text-white/30 mb-3 leading-relaxed">Click an item to place it into the robot's hopper and start the AI sorting process.</p>
          <div className="flex flex-col gap-2">
            {ITEMS.map(item => (
              <motion.button key={item.id} onClick={() => startSort(item)}
                disabled={busy}
                whileHover={!busy ? { scale: 1.03, x: 3 } : {}}
                whileTap={!busy ? { scale: 0.97 } : {}}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  active.id === item.id && phase !== "idle"
                    ? "border-white/30 bg-white/10"
                    : "border-white/8 bg-white/4 hover:bg-white/8"
                } ${busy ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className="text-3xl leading-none">{item.emoji}</span>
                <div>
                  <div className="text-xs font-semibold text-white/80">{item.label}</div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: item.color }}>{item.id.toUpperCase()}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{item.desc}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Session counters */}
        <div className="mt-auto">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Session Sorted</p>
          {ITEMS.map(item => (
            <div key={item.id} className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-white/40">{item.label}</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: item.color }}>{sortCount[item.id]}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Center: Robot visual ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-white">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(90deg,#3b82f6 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Robot front SVG */}
        <div className="relative z-10 drop-shadow-2xl">
          <RobotFrontSVG
            phase={phase}
            active={active}
            gateAngle={gateAngle}
            fills={fillArr}
            splashIdx={splashIdx}
            scanPct={scanPct}
          />
        </div>

        {/* AI Detection card */}
        <AnimatePresence>
          {(phase === "identified" || phase === "gating" || phase === "falling" || phase === "done") && (
            <motion.div
              className="absolute right-8 top-1/2 -translate-y-1/2 z-40 w-52 bg-[#0b1628]/95 backdrop-blur-sm border border-white/15 rounded-2xl p-4 shadow-2xl"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <motion.div className="w-2.5 h-2.5 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                <span className="text-xs font-bold text-white/80">AI DETECTION RESULT</span>
              </div>
              <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-white/5">
                <span className="text-3xl">{active.emoji}</span>
                <div>
                  <div className="text-sm font-bold text-white">{active.label}</div>
                  <div className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                    style={{ backgroundColor: active.color + "22", color: active.color }}>
                    {active.id.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-white/40">Confidence</span>
                    <span className="font-bold text-emerald-400">{active.confidence}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-emerald-500"
                      initial={{ width: 0 }} animate={{ width: `${active.confidence}%` }}
                      transition={{ duration: 0.6 }} />
                  </div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/40">Material</span>
                  <span className="text-white/70 font-medium">{active.desc}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/40">Route to</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BINS[active.binIdx].color }} />
                    <span className="font-bold" style={{ color: BINS[active.binIdx].color }}>
                      {BINS[active.binIdx].label} BIN
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/40">Status</span>
                  <span className="text-white/70">{
                    phase === "identified" ? "🔄 Routing gate…" :
                    phase === "gating"     ? "⚙ Gate opening…" :
                    phase === "falling"    ? "⬇ Sorting…" : "✅ Sorted!"
                  }</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan progress bar */}
        <AnimatePresence>
          {phase === "scanning" && (
            <motion.div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">AI Scanning…</span>
                <span className="font-bold" style={{ color: active.color }}>{Math.round(scanPct)}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: active.color }}
                  animate={{ width: `${scanPct}%` }} transition={{ duration: 0.1 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right: Log + bin status ── */}
      <aside className="w-56 bg-[#0b1628] border-l border-white/10 p-4 flex flex-col gap-4 shrink-0">
        {/* Bin fill levels */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Bin Fill Levels</p>
          <div className="flex flex-col gap-3">
            {BINS.map((b, i) => (
              <div key={b.label}>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-white/50 font-medium">{b.label}</span>
                  </div>
                  <motion.span className="font-bold" style={{ color: b.color }} animate={{ opacity: 1 }}>
                    {fillArr[i]}%
                  </motion.span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: b.color }}
                    animate={{ width: `${fillArr[i]}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
                </div>
                {fillArr[i] > 80 && (
                  <p className="text-[10px] text-amber-400 mt-0.5">⚠ Nearly full</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System event log */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Event Log</p>
          <div ref={logRef}
            className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0 pr-1"
            style={{ scrollBehavior: "smooth" }}>
            {log.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                className="text-[9px] text-white/35 leading-relaxed border-l border-white/10 pl-2 py-0.5">
                {l}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
          <p className="text-[10px] text-blue-300/70 leading-relaxed">
            💡 Click any waste item on the left to simulate the full AI sorting process.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ROBOT FRONT SVG (detailed front view)
══════════════════════════════════════════════ */
function RobotFrontSVG({ phase, active, gateAngle, fills, splashIdx, scanPct }: {
  phase: Phase; active: WasteItem; gateAngle: number; fills: number[];
  splashIdx: number | null; scanPct: number;
}) {
  const W = 310; const H = 480;
  const scanning = phase === "scanning";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="lens2" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0a0f1e" />
        </radialGradient>
        <linearGradient id="frontBodySim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="5%" stopColor="#e8eaed" />
          <stop offset="95%" stopColor="#e8eaed" />
          <stop offset="100%" stopColor="#9ca3af" />
        </linearGradient>
        <linearGradient id="lcdGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#040d1a" />
          <stop offset="100%" stopColor="#061428" />
        </linearGradient>
        <clipPath id="binWinClip">
          <rect x="18" y="218" width="274" height="218" rx="6" />
        </clipPath>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={active.color} stopOpacity="0.5"/>
          <stop offset="100%" stopColor={active.color} stopOpacity="0.0"/>
        </linearGradient>
      </defs>

      {/* Cabinet */}
      <rect x="2" y="2" width={W-4} height={H-24} rx="14" fill="url(#frontBodySim)" />
      <rect x="4" y="4" width={W-8} height={H-28} rx="13" fill="none" stroke="#d5d8de" strokeWidth="1.5" />
      <rect x="6" y="6" width="14" height={H-32} rx="7" fill="white" opacity="0.12" />

      {/* ── Top module ── */}
      <rect x="12" y="10" width={W-24} height="108" rx="8" fill="#111827" />
      <rect x="14" y="12" width={W-28} height="104" rx="7" fill="#0d1420" />

      {/* Camera housing */}
      <rect x="18" y="16" width="88" height="96" rx="8" fill="#0a0f1a" stroke="#1e293b" strokeWidth="2" />
      <path d="M 32 30 L 92 30 L 100 100 L 24 100 Z" fill="#040812"/>

      {scanning && (
        <motion.rect x="18" y="16" width="88" height="5" rx="2" fill={active.color} opacity="0.9"
          animate={{ y: [16, 106, 16] }} transition={{ duration: 1.1, repeat: Infinity, ease:"linear" }} 
          style={{ filter: `drop-shadow(0 0 6px ${active.color})` }} />
      )}
      <circle cx="62" cy="64" r="32" fill="#060c16" stroke="#1e3a5f" strokeWidth="2" />
      {/* IR LEDs */}
      {[0,45,90,135,180,225,270,315].map(deg=>(
          <circle key={deg} cx={62 + Math.cos(deg*Math.PI/180)*26} cy={64 + Math.sin(deg*Math.PI/180)*26} r="2" fill={scanning ? active.color : "#334155"} opacity={scanning ? 0.8 : 0.3}/>
      ))}
      <circle cx="62" cy="64" r="22" fill="#091422" stroke={scanning ? active.color : "#1d4ed8"} strokeWidth="1.5"
        style={{ filter: scanning ? `drop-shadow(0 0 6px ${active.color})` : "none" }} />
      <circle cx="62" cy="64" r="14" fill="url(#lens2)" />
      <circle cx="62" cy="64" r="6" fill="#1e40af" opacity="0.7" />
      <circle cx="56" cy="58" r="3" fill="white" opacity="0.4" />
      
      <circle cx="28" cy="24" r="4" fill={scanning ? "#f59e0b" : "#22c55e"}
        style={{ filter: `drop-shadow(0 0 4px ${scanning ? "#f59e0b" : "#22c55e"})` }} />
      <text x="62" y="106" textAnchor="middle" fill="#3b82f6" fontSize="7" fontWeight="700" letterSpacing="1">CAMERA</text>

      {/* ── Scan Beam ── */}
      {scanning && (
        <motion.polygon
          points={`62,64 ${W/2-50},136 ${W/2+50},136`}
          fill="url(#beamGrad)"
          style={{ mixBlendMode: "plus-lighter" }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}

      {/* Main LCD */}
      <rect x="114" y="15" width="178" height="100" rx="6" fill="url(#lcdGrad)" />
      <rect x="116" y="17" width="174" height="96" rx="5" fill="#040a14" />
      {/* Scan bar on LCD */}
      {scanning && (
        <motion.rect x="116" y="17" width="174" height="4" rx="2" fill={active.color} opacity="0.6"
          animate={{ y:[17, 108, 17] }} transition={{ duration: 1.3, repeat:Infinity, ease:"linear"}} />
      )}
      {/* LCD grid */}
      {[35,53,71,89].map(y => (
        <line key={y} x1="116" y1={y} x2="290" y2={y} stroke="#0d2040" strokeWidth="0.5" />
      ))}
      <circle cx="126" cy="26" r="4.5" fill={scanning ? "#f59e0b" : "#22c55e"}
        style={{ filter: `drop-shadow(0 0 4px ${scanning ? "#f59e0b" : "#22c55e"})` }} />
      <text x="136" y="29.5" fill="#94a3b8" fontSize="7.5" fontWeight="600" letterSpacing="0.5">SYSTEM STATUS</text>
      <text x="282" y="29.5" textAnchor="end" fill={scanning ? "#f59e0b" : "#22c55e"} fontSize="7.5" fontWeight="700">
        {scanning ? "SCANNING" : "ONLINE"}
      </text>

      <text x="120" y="45" fill="#60a5fb" fontSize="7.5">Model:</text>
      <text x="148" y="45" fill="#e2e8f0" fontSize="7.5" fontWeight="500">YOLOv8-Waste-v2</text>

      <text x="120" y="60" fill="#60a5fb" fontSize="7.5">Status:</text>
      <text x="148" y="60" fill={scanning ? "#fbbf24" : "#86efac"} fontSize="7.5" fontWeight="600">
        {phase === "idle" || phase === "done" ? "Ready for Input" :
         phase === "scanning"   ? `Scanning… ${Math.round(scanPct)}%` :
         phase === "identified" ? `Detected: ${active.label}` :
         phase === "gating"     ? `Routing → ${["PLASTIC","ORGANIC","PAPER"][active.binIdx]}` :
         phase === "falling"    ? "Sorting waste…" : "Sort complete ✓"}
      </text>

      <text x="120" y="75" fill="#60a5fb" fontSize="7.5">Confidence:</text>
      <rect x="172" y="67" width="80" height="10" rx="5" fill="#0d2040" />
      <motion.rect x="172" y="67"
        width={phase === "identified" || phase === "gating" || phase === "falling" ? (80*active.confidence/100) : scanning ? (80*scanPct/100) : 0}
        height="10" rx="5" fill={active.color} opacity="0.9"
        animate={{ width: phase === "identified" || phase === "gating" || phase === "falling" ? (80*active.confidence/100) : scanning ? (80*scanPct/100) : 0 }}
        transition={{ duration: 0.2 }} />
      <text x="260" y="75" textAnchor="end" fill="white" fontSize="6.5" fontWeight="700">
        {(phase === "identified" || phase === "gating" || phase === "falling") ? `${active.confidence}%` : scanning ? `${Math.round(scanPct)}%` : "—"}
      </text>

      <text x="120" y="90" fill="#60a5fb" fontSize="7.5">Mode:</text>
      <text x="148" y="90" fill="#fde047" fontSize="7.5" fontWeight="500">AUTO SORT · ENABLED</text>
      <text x="120" y="105" fill="#60a5fb" fontSize="7.5">WiFi:</text>
      <text x="148" y="105" fill="#86efac" fontSize="7.5">192.168.1.42 · Connected</text>

      {/* ── Hopper ── */}
      <path d={`M ${W/2-62} 126 L ${W/2-36} 152 L ${W/2+36} 152 L ${W/2+62} 126 Z`} fill="#9ca3af" />
      <path d={`M ${W/2-36} 152 L ${W/2-24} 178 L ${W/2+24} 178 L ${W/2+36} 152 Z`} fill="#6b7280" />
      <ellipse cx={W/2} cy="178" rx="24" ry="6" fill="#111827" /> {/* Dark hole to drop into */}
      {/* Hopper rim */}
      <rect x={W/2-64} y="120" width="128" height="9" rx="4.5" fill="#4b5563" />
      <rect x={W/2-62} y="121" width="124" height="6" rx="3" fill="#374151" />
      <text x={W/2} y="118" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="800" letterSpacing="1.5">WASTE INPUT</text>

      {/* Hopper drop shadow */}
      <ellipse cx={W/2} cy="178" rx="22" ry="4" fill="black" opacity="0.4" />

      {/* ── Animated Trash Item ── */}
      <AnimatePresence>
        {phase !== "idle" && phase !== "done" && (
          <motion.g
            initial={{ x: -80, y: 200, opacity: 0, scale: 0.2, rotate: -180 }}
            animate={
              (phase === "hovering" || phase === "scanning" || phase === "identified")
                ? { x: W/2, y: 100, opacity: 1, scale: 1, rotate: 0 }
                : phase === "gating"
                ? { x: W/2, y: 160, opacity: 1, scale: 0.5, rotate: 0 }
                : /* falling */ { x: W/2 + (active.binIdx-1)*92, y: 380, opacity: 0, scale: 0.2, rotate: 180 }
            }
            transition={
              phase === "hovering" ? { type: "spring", bounce: 0.4, duration: 0.5 }
              : phase === "gating" ? { duration: 0.8, ease: "easeIn" }
              : phase === "falling" ? { duration: 0.8, ease: "easeIn" }
              : { duration: 0.3 }
            }
            exit={{ opacity: 0, scale: 0 }}
          >
            <motion.text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fontSize="60"
              animate={{ rotate: phase === "scanning" ? [0,-10,10,0] : 0 }}
              transition={{ duration: 0.4, repeat: Infinity }}
              style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.3))" }}>
              {active.emoji}
            </motion.text>
            
            {/* Scanning Ring */}
            {phase === "scanning" && (
              <motion.circle cx="0" cy="0" r="40" fill="none" stroke={active.color} strokeWidth="3" strokeLinecap="round"
                initial={{ strokeDasharray: "0 251.2", rotate: -90 }}
                animate={{ strokeDasharray: `${(scanPct/100)*251.2} 251.2`, rotate: -90 }}
                style={{ filter: `drop-shadow(0 0 6px ${active.color})` }} />
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* ── Servo gate mechanism ── */}
      <rect x="40" y="190" width={W-80} height="24" rx="5" fill="#1e293b" />
      <rect x="42" y="192" width={W-84} height="20" rx="4" fill="#0d1a2a" />
      <text x={W/2} y="185" textAnchor="middle" fill="#4b5563" fontSize="6.5" fontWeight="600">SERVO SORTING GATE</text>

      {/* Gate flap */}
      <motion.g style={{ originX: `${W/2}px`, originY: "202px" }}
        animate={{ rotate: gateAngle }} transition={{ type:"spring", stiffness:200, damping:22 }}>
        <rect x="60" y="200" width={W-120} height="7" rx="3.5" fill="#4b5563" />
        {Array.from({length:10},(_,i)=>(
          <rect key={i} x={64+i*17} y="200" width="2" height="7" rx="1" fill="#6b7280" opacity="0.6" />
        ))}
      </motion.g>

      {/* Servo indicators */}
      {[56, W/2-14, W-70].map((sx, i) => (
        <g key={i}>
          <rect x={sx} y="192" width="20" height="17" rx="3" fill="#374151" />
          <circle cx={sx+10} cy="200" r="5" fill="#4b5563" />
          <circle cx={sx+10} cy="200" r="2.5" fill="#6b7280" />
          {gateAngle !== 0 && i === active.binIdx && (
            <motion.circle cx={sx+10} cy="200" r="5" fill="none" stroke={active.color} strokeWidth="1.5"
              animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease:"linear" }}
              style={{ filter: `drop-shadow(0 0 3px ${active.color})` }} />
          )}
        </g>
      ))}

      {/* ── Bin compartment window ── */}
      <rect x="14" y="216" width={W-28} height="222" rx="8" fill="#0d1a2a" stroke="#1e3a5f" strokeWidth="1.5" />
      <rect x="16" y="218" width={W-32} height="218" rx="6" fill="#060f1e" />
      {/* Glass sheen */}
      <rect x="16" y="218" width="24" height="218" rx="6" fill="white" opacity="0.015" />

      {/* Bin dividers */}
      <line x1="108" y1="218" x2="108" y2="436" stroke="#1e3a5f" strokeWidth="2" />
      <line x1="200" y1="218" x2="200" y2="436" stroke="#1e3a5f" strokeWidth="2" />

      {/* ── Three bins ── */}
      {BINS.map((b, i) => {
        const bx = [17, 109, 201][i];
        const bw = 90;
        const bh = 216;
        const by = 220;
        const fillH = (bh * fills[i]) / 100;
        const isSplash = splashIdx === i;
        return (
          <g key={b.label}>
            {/* Bin bg */}
            <rect x={bx} y={by} width={bw} height={bh} rx="4" fill={b.bg} opacity="0.08" />
            {/* Fill */}
            <clipPath id={`sf${i}`}>
              <rect x={bx} y={by} width={bw} height={bh} rx="4" />
            </clipPath>
            <motion.rect x={bx} y={by+bh-fillH} width={bw} height={fillH}
              fill={b.bg} opacity="0.5" clipPath={`url(#sf${i})`}
              animate={{ y: by+bh-fillH, height: fillH }} transition={{ duration:0.8, ease:"easeOut" }} />
            {/* Surface shimmer */}
            <motion.rect x={bx+4} y={by+bh-fillH} width={bw-8} height="4" rx="2"
              fill={b.light} opacity="0.6" clipPath={`url(#sf${i})`}
              animate={{ y: by+bh-fillH }} transition={{ duration:0.8, ease:"easeOut" }} />
            {/* Bin border highlight when active */}
            <rect x={bx} y={by} width={bw} height={bh} rx="4" fill="none"
              stroke={gateAngle !== 0 && active.binIdx === i ? b.color : "#1e3a5f"}
              strokeWidth={gateAngle !== 0 && active.binIdx === i ? 2 : 1}
              style={{ filter: gateAngle !== 0 && active.binIdx === i ? `drop-shadow(0 0 4px ${b.color})` : "none" }} />
            {/* Icon */}
            <text x={bx+bw/2} y={by+bh*0.42} textAnchor="middle" dominantBaseline="middle"
              fontSize="32" fill={b.color} opacity="0.18">{b.icon}</text>
            {/* Fill % */}
            <text x={bx+bw/2} y={by+22} textAnchor="middle" fontSize="10" fontWeight="700" fill={b.light}>{fills[i]}%</text>
            <rect x={bx+10} y={by+26} width={bw-20} height="4" rx="2" fill="#0d2040" />
            <motion.rect x={bx+10} y={by+26} height="4" rx="2" fill={b.light}
              animate={{ width: (bw-20)*fills[i]/100 }} transition={{ duration:0.8 }} />
            {/* Label */}
            <rect x={bx+10} y={by+bh-22} width={bw-20} height="16" rx="5" fill={b.bg} opacity="0.8" />
            <text x={bx+bw/2} y={by+bh-11} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="white">{b.label}</text>

            {/* Splash particles */}
            <AnimatePresence>
              {isSplash && (
                <>
                  {[-18,-6,6,18].map((ox,pi)=>(
                    <motion.circle key={pi} r={5} fill={b.light} opacity={0.9}
                      cx={bx+bw/2+ox} cy={by+bh-fillH-4}
                      initial={{ cy: by+bh-fillH-4, opacity:0.9, r:5 }}
                      animate={{ cy: by+bh-fillH-24, opacity:0, r:2 }}
                      exit={{}}
                      transition={{ delay:pi*0.07, duration:0.7, ease:"easeOut" }} />
                  ))}
                </>
              )}
            </AnimatePresence>
          </g>
        );
      })}

      {/* ── Wheels & Foot Pedal ── */}
      <rect x={W/2-50} y={H-36} width="100" height="12" rx="5" fill="#6b7280" stroke="#4b5563" strokeWidth="1.5"/>
      <rect x={W/2-44} y={H-33} width="88" height="5" rx="2.5" fill="#d1d5db"/>

      {[44, W-44].map((wx, i) => (
        <g key={i}>
          <rect x={wx-16} y={H-34} width="32" height="14" rx="3" fill="#4b5563"/>
          <rect x={wx-8} y={H-20} width="16" height="8" fill="#374151"/>
          <circle cx={wx} cy={H-12} r="12" fill="#111827"/>
          <circle cx={wx} cy={H-12} r="5" fill="#6b7280"/>
        </g>
      ))}

      {/* Active bin glow */}
      {(phase === "gating" || phase === "falling") && (
        <motion.rect
          x={[17,109,201][active.binIdx]} y="218"
          width="90" height="218" rx="4" fill={active.color} opacity="0"
          animate={{ opacity:[0, 0.1, 0] }} transition={{ duration:1.2, repeat:Infinity }} />
      )}
    </svg>
  );
}
