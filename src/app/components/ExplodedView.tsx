import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Component {
  id: string; label: string; sub: string; color: string;
  qty?: number; desc: string; x: number; y: number; ew?: number; eh?: number;
}

const COMPONENTS: Component[] = [
  { id:"cam",      label:"Camera Module",         sub:"USB 1080p Wide-Angle",  color:"#60a5fa", qty:1, desc:"Captures images of waste items for AI classification. 160° FOV, 30fps, IR night vision.",    x:280, y:30  },
  { id:"hopper",   label:"Hopper / Funnel",   sub:"ABS Plastic",           color:"#94a3b8", qty:1, desc:"Funnels waste toward the sorting gate. Designed to handle solid waste up to 20cm.",          x:480, y:30  },
  { id:"rpi",      label:"Raspberry Pi 4B",   sub:"4GB RAM · Quad-Core",   color:"#4ade80", qty:1, desc:"Main controller running YOLOv8 AI model, servo control, IoT dashboard, and WiFi comm.",    x:80,  y:180 },
  { id:"servo",    label:"Servo Motor",        sub:"MG996R High Torque",    color:"#fbbf24", qty:3, desc:"Controls sorting flap gate angle. High-torque 11kg/cm, 270° rotation, PWM-controlled.",     x:280, y:180 },
  { id:"gate",     label:"Sorting Flap Gate", sub:"3D Printed ABS",        color:"#c084fc", qty:3, desc:"Rotates to route waste into the correct bin compartment based on AI classification.",         x:480, y:180 },
  { id:"bin_p",    label:"Plastic Waste Bin", sub:"5L Blue Container",     color:"#3b82f6", qty:1, desc:"Collects PET, HDPE, and other recyclable plastics. Blue coded per waste management standard.",x:80,  y:330 },
  { id:"bin_y",    label:"Paper Waste Bin",   sub:"5L Yellow Container",   color:"#eab308", qty:1, desc:"Collects newspapers, cardboard, and dry paper waste for paper recycling stream.",             x:280, y:330 },
  { id:"bin_o",    label:"Organic Waste Bin", sub:"5L Green Container",    color:"#22c55e", qty:1, desc:"Collects food scraps, peels, and biodegradable organic waste for composting.",                x:480, y:330 },
  { id:"bin_g",    label:"General Waste Bin", sub:"5L Black Container",    color:"#6b7280", qty:1, desc:"Collects non-recyclable general waste. Dark-coded to distinguish from sorted waste streams.", x:80,  y:480 },
  { id:"us",       label:"Ultrasonic Sensor", sub:"HC-SR04 / JSN-SR04T",   color:"#fb923c", qty:4, desc:"Measures fill level in each bin and the hopper area. Range 2–450cm, ±3mm accuracy.",        x:80,  y:480 },
  { id:"driver",   label:"Motor Driver",      sub:"DRV8825 Stepper Board", color:"#a78bfa", qty:1, desc:"Controls 3× servo motors via PWM signals from the Raspberry Pi GPIO pins.",                   x:280, y:480 },
  { id:"battery",  label:"Battery Pack",      sub:"12V 22Ah Li-Ion",       color:"#f87171", qty:1, desc:"Rechargeable lithium-ion pack powering all electronics. 8–12hr runtime per charge.",          x:480, y:480 },
  { id:"switch",   label:"Power Switch",      sub:"DC Circuit Breaker",    color:"#64748b", qty:1, desc:"Main power on/off with circuit protection. Rated 30A DC for safe system disconnect.",         x:80,  y:620 },
];

const WIRING = [
  { from:"rpi", to:"cam",    color:"#60a5fa", label:"USB 3.0" },
  { from:"rpi", to:"driver", color:"#fbbf24", label:"GPIO PWM" },
  { from:"rpi", to:"us",     color:"#fb923c", label:"GPIO" },
  { from:"driver", to:"servo", color:"#c084fc", label:"PWM ×3" },
  { from:"servo",  to:"gate",  color:"#94a3b8", label:"Shaft" },
  { from:"battery","to":"rpi", color:"#f87171", label:"12V DC" },
  { from:"battery","to":"switch",color:"#64748b",label:"Power" },
];

export default function ExplodedView() {
  const [active, setActive] = useState<string | null>(null);
  const [exploded, setExploded] = useState(false);
  const activeComp = COMPONENTS.find(c => c.id === active);

  return (
    <div className="flex h-full overflow-hidden bg-[#07101f]">
      {/* Main diagram */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-8">
        <div className="relative" style={{ width: 660, height: 730 }}>
          {/* Title */}
          <div className="absolute top-0 left-0 right-0 text-center">
            <h2 className="text-white/60 text-sm font-bold tracking-wider uppercase">
              Exploded Component Assembly View
            </h2>
          </div>

          {/* Robot silhouette hint in center */}
          <div className="absolute" style={{ left:200, top:80, width:220, height:480 }}>
            <div className="w-full h-full rounded-2xl border border-dashed border-white/8 bg-white/[0.02] flex items-center justify-center">
              <span className="text-white/10 text-6xl">🤖</span>
            </div>
            <div className="text-center mt-2 text-white/15 text-[10px] tracking-widest">ROBOT BODY</div>
          </div>

          {/* Component boxes */}
          {COMPONENTS.map(c => (
            <motion.button
              key={c.id}
              onClick={() => setActive(a => a === c.id ? null : c.id)}
              className="absolute text-left focus:outline-none"
              style={{ left: exploded ? c.x - 40 : c.x, top: exploded ? c.y + 40 : c.y, width: 160 }}
              animate={{ x: 0, y: 0 }}
              whileHover={{ scale: 1.04, zIndex: 20 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className={`rounded-xl border p-3 transition-all cursor-pointer ${
                active === c.id
                  ? "border-white/40 shadow-lg"
                  : "border-white/10 hover:border-white/25 bg-[#0d1f3c]"
              }`}
                style={{
                  backgroundColor: active === c.id ? c.color + "18" : undefined,
                  borderColor: active === c.id ? c.color + "80" : undefined,
                  boxShadow: active === c.id ? `0 0 20px ${c.color}22` : undefined,
                }}
              >
                {/* Color dot + label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}88` }} />
                  <span className="text-white/80 text-xs font-bold leading-tight">{c.label}</span>
                </div>
                <div className="text-[10px] text-white/35 mb-1">{c.sub}</div>
                {c.qty && c.qty > 1 && (
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                    style={{ backgroundColor: c.color + "25", color: c.color }}>
                    ×{c.qty}
                  </div>
                )}
              </div>
              {/* Connector line to center */}
              <ConnectorLine from={[c.x + 80, c.y + 24]} to={[310, 320]} color={c.color} active={active === c.id} />
            </motion.button>
          ))}

          {/* Numbered component label */}
          {COMPONENTS.map((c, i) => (
            <div key={c.id} className="absolute pointer-events-none"
              style={{ left: c.x + 148, top: c.y + 6, fontSize: 8, color: c.color + "80", fontWeight:"bold" }}>
              {String(i+1).padStart(2,"0")}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <aside className="w-64 bg-[#0b1628] border-l border-white/10 flex flex-col shrink-0 overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-white/10">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">View Controls</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => setExploded(e => !e)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                exploded ? "bg-purple-600 text-white shadow-lg" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}>
              {exploded ? "↗ Collapse View" : "↘ Explode Components"}
            </button>
            <button onClick={() => setActive(null)}
              className="w-full py-2 rounded-xl text-xs text-white/40 border border-white/8 hover:bg-white/5 transition-all">
              Clear Selection
            </button>
          </div>
        </div>

        {/* Component detail */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeComp ? (
              <motion.div key={activeComp.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeComp.color, boxShadow:`0 0 8px ${activeComp.color}88` }} />
                  <h3 className="font-bold text-sm text-white">{activeComp.label}</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/4 rounded-xl p-3">
                    <p className="text-[10px] text-white/30 mb-1">Part Number</p>
                    <p className="text-xs text-white/70 font-mono">{activeComp.sub}</p>
                  </div>
                  {activeComp.qty && activeComp.qty > 1 && (
                    <div className="bg-white/4 rounded-xl p-3">
                      <p className="text-[10px] text-white/30 mb-1">Quantity</p>
                      <p className="text-xs font-bold" style={{ color: activeComp.color }}>×{activeComp.qty} units</p>
                    </div>
                  )}
                  <div className="bg-white/4 rounded-xl p-3">
                    <p className="text-[10px] text-white/30 mb-1.5">Description</p>
                    <p className="text-[11px] text-white/60 leading-relaxed">{activeComp.desc}</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Component Index</p>
                <div className="flex flex-col gap-1">
                  {COMPONENTS.map((c, i) => (
                    <button key={c.id} onClick={() => setActive(c.id)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
                      <span className="text-[9px] text-white/20 font-mono w-5">{String(i+1).padStart(2,"0")}</span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-white/60 font-medium truncate">{c.label}</div>
                        {c.qty && c.qty > 1 && <div className="text-[9px]" style={{ color: c.color }}>×{c.qty}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer count */}
        <div className="p-3 border-t border-white/8 text-center">
          <p className="text-[10px] text-white/25">
            {COMPONENTS.length} components · {COMPONENTS.reduce((s,c)=>s+(c.qty||1),0)} total parts
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ── SVG connector line (drawn via absolute positioned SVG overlay) ── */
function ConnectorLine({ from, to, color, active }: { from:[number,number]; to:[number,number]; color:string; active:boolean }) {
  const [fx,fy] = from; const [tx,ty] = to;
  const mx = (fx+tx)/2; const my = (fy+ty)/2;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: Math.min(fx,tx)-2, top: Math.min(fy,ty)-2,
        width: Math.abs(fx-tx)+4, height: Math.abs(fy-ty)+4,
        overflow:"visible", opacity: active ? 0.8 : 0.18,
        transition:"opacity 0.2s",
        zIndex: active ? 5 : 1,
      }}
    >
      <path
        d={`M ${fx-Math.min(fx,tx)+2} ${fy-Math.min(fy,ty)+2} Q ${mx-Math.min(fx,tx)+2} ${fy-Math.min(fy,ty)+2} ${tx-Math.min(fx,tx)+2} ${ty-Math.min(fy,ty)+2}`}
        fill="none" stroke={color} strokeWidth={active ? 1.5 : 1} strokeDasharray={active?"none":"4 3"}
        strokeLinecap="round"
      />
      {active && (
        <circle cx={tx-Math.min(fx,tx)+2} cy={ty-Math.min(fy,ty)+2} r="3" fill={color} opacity="0.8" />
      )}
    </svg>
  );
}
