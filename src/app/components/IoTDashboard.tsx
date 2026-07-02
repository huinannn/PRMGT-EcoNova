import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import type { SortStats } from "../App";

interface HistoryEntry {
  time: string;
  plastic: number;
  organic: number;
  paper: number;
}

interface Props { stats: SortStats; fills: { plastic: number; organic: number; paper: number }; }

const BIN_CFG = [
  { key:"plastic", label:"Can & Plastic", color:"#f97316", light:"#fdba74", icon:"♻",  desc:"PET / Cans" },
  { key:"organic", label:"Glass",         color:"#92400e", light:"#d97706", icon:"🫙", desc:"Glass items" },
  { key:"paper",   label:"Paper",         color:"#2563eb", light:"#93c5fd", icon:"📰", desc:"Cardboard" },
] as const;

function StatCard({ label, value, unit, sub, color = "#60a5fa", icon }: {
  label:string; value:string|number; unit?:string; sub?:string; color?:string; icon?:string;
}) {
  return (
    <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg opacity-60">{icon}</span>}
      </div>
      <div className="flex items-end gap-1">
        <motion.span className="text-3xl font-bold" style={{ color }}
          key={String(value)} initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
          {value}
        </motion.span>
        {unit && <span className="text-sm text-white/30 mb-1">{unit}</span>}
      </div>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

function CircularFill({ pct, color, label, icon }: { pct:number; color:string; label:string; icon:string }) {
  const r = 38; const C = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#1e3a5f" strokeWidth="8" />
          <motion.circle cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C}
            animate={{ strokeDashoffset: C - (C * pct / 100) }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}55)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl leading-none">{icon}</span>
          <motion.span className="text-lg font-bold mt-0.5" style={{ color }}
            animate={{ opacity: 1 }}>{pct}%</motion.span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-white/70">{label}</p>
        <p className="text-[10px] text-white/30">Fill Level</p>
      </div>
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#0d1f3c", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#e2e8f0", fontSize: 11,
};

export default function IoTDashboard({ stats, fills }: Props) {
  const total = stats.plastic + stats.organic + stats.paper;
  const [uptime, setUptime] = useState(52320); // seconds
  const [aiFrames, setAiFrames] = useState(1242);

  // Live tick
  useEffect(() => {
    const iv = setInterval(() => {
      setUptime(u => u + 1);
      setAiFrames(f => f + Math.floor(Math.random() * 3));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const hhmmss = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const pieData = [
    { name:"Can & Plastic", value: stats.plastic, color:"#f97316" },
    { name:"Glass",         value: stats.organic, color:"#92400e" },
    { name:"Paper",         value: stats.paper,   color:"#2563eb" },
  ];

  const fillArr = [fills.plastic, fills.organic, fills.paper];

  return (
    <div className="h-full overflow-y-auto bg-white p-5">
      {/* ── Top status banner ── */}
      <div className="flex items-center justify-between mb-5 bg-[#0d1f3c] border border-emerald-500/20 rounded-2xl px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <motion.div className="w-3 h-3 rounded-full bg-emerald-400"
              animate={{ scale: [1,1.4,1], opacity:[1,0.6,1] }} transition={{ duration:2, repeat:Infinity }} />
            <span className="text-emerald-400 font-bold text-sm">SYSTEM ONLINE</span>
          </div>
          <span className="text-white/20">|</span>
          <span className="text-white/40 text-xs">AI Model: YOLOv8-Waste-v2</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40 text-xs">Mode: Auto Sort</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40 text-xs">IP: 192.168.1.42</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>Uptime: <b className="text-white font-mono">{hhmmss(uptime)}</b></span>
          <span>Frames: <b className="text-blue-400 font-mono">{aiFrames.toLocaleString()}</b></span>
          <span>{new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* ── Main stats row ── */}
      <div className="grid grid-cols-6 gap-4 mb-5">
        <StatCard label="Total Sorted" value={total} unit="items" sub="Since system start" color="#60a5fa" icon="🗂" />
        <StatCard label="AI Accuracy" value="98.7" unit="%" sub="Across all categories" color="#34d399" icon="🎯" />
        <StatCard label="Can/Plastic Sorted" value={stats.plastic} unit="items" sub={`${total>0?Math.round(stats.plastic/total*100):0}% of total`} color="#f97316" icon="♻" />
        <StatCard label="Glass Sorted"       value={stats.organic} unit="items" sub={`${total>0?Math.round(stats.organic/total*100):0}% of total`} color="#92400e" icon="🫙" />
        <StatCard label="Paper Sorted"       value={stats.paper}   unit="items" sub={`${total>0?Math.round(stats.paper/total*100):0}% of total`}   color="#2563eb" icon="📰" />
        <StatCard label="CO₂ Saved" value={(total*0.12).toFixed(1)} unit="kg" sub="Est. carbon offset" color="#a78bfa" icon="🌍" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {/* Pie chart */}
        <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Waste Distribution</h3>
          {total > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={72}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((d,i) => (
                      <Cell key={i} fill={d.color}
                        style={{ filter: `drop-shadow(0 0 4px ${d.color}55)` }} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-around mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-white/50">{d.name}</span>
                    <span className="text-[10px] font-bold" style={{ color: d.color }}>
                      {total > 0 ? Math.round(d.value/total*100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-white/20 text-xs">No data yet — use Sorting Demo</div>
          )}
        </div>

        {/* Bar chart - hourly history */}
        <div className="col-span-2 bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Hourly Sorting Activity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.history} margin={{ top:4, right:10, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="time" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize:10, color:"#64748b" }} />
              <Bar dataKey="plastic" name="Can & Plastic" fill="#f97316" radius={[3,3,0,0]} />
              <Bar dataKey="organic" name="Glass"         fill="#92400e" radius={[3,3,0,0]} />
              <Bar dataKey="paper"   name="Paper"         fill="#2563eb" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Fill gauges + line chart ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {/* Circular fill gauges */}
        <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Bin Fill Levels</h3>
          <div className="flex justify-around items-center h-36">
            {BIN_CFG.map((b, i) => (
              <CircularFill key={b.key} pct={fillArr[i]} color={b.color} label={b.label} icon={b.icon} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {BIN_CFG.map((b, i) => (
              <div key={b.key} className="flex items-center gap-3">
                <div className="w-16 text-[10px] text-white/40">{b.label}</div>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: b.color }}
                    animate={{ width: `${fillArr[i]}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="w-10 text-right text-[10px] font-bold" style={{ color: b.color }}>{fillArr[i]}%</div>
                {fillArr[i] > 80 && <span className="text-amber-400 text-[10px]">⚠</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Line chart */}
        <div className="col-span-2 bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Cumulative Sort Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.history.map((h: HistoryEntry, i: number, arr: HistoryEntry[])=>({
              time: h.time,
              plastic: arr.slice(0,i+1).reduce((s: number, r: HistoryEntry)=>s+r.plastic,0),
              organic: arr.slice(0,i+1).reduce((s: number, r: HistoryEntry)=>s+r.organic,0),
              paper:   arr.slice(0,i+1).reduce((s: number, r: HistoryEntry)=>s+r.paper,0),
            }))} margin={{ top:4, right:10, bottom:0, left:-20 }}>
              <defs>
                {[["plastic","#f97316"],["organic","#92400e"],["paper","#2563eb"]].map(([k,c])=>(
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={c} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="time" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="plastic" name="Can & Plastic" stroke="#f97316" strokeWidth={2}
                fill="url(#grad-plastic)" dot={false} />
              <Area type="monotone" dataKey="organic" name="Glass" stroke="#92400e" strokeWidth={2}
                fill="url(#grad-organic)" dot={false} />
              <Area type="monotone" dataKey="paper" name="Paper" stroke="#2563eb" strokeWidth={2}
                fill="url(#grad-paper)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom: System status table + AI feed ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* System status */}
        <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">System Component Status</h3>
          <div className="flex flex-col gap-2">
            {[
              { name:"Camera Module",           status:"ACTIVE",  detail:"1080p · 30fps",       ok:true },
              { name:"Raspberry Pi 4B",     status:"ONLINE",  detail:"CPU 34% · RAM 62%",   ok:true },
              { name:"Servo Motor #1 (Can/Plastic)", status:"READY", detail:"Angle: 0°", ok:true },
              { name:"Servo Motor #2 (Glass)",       status:"READY", detail:"Angle: 0°", ok:true },
              { name:"Servo Motor #3 (Paper)",       status:"READY", detail:"Angle: 0°", ok:true },
              { name:"Ultrasonic Sensor ×4", status:"ACTIVE", detail:"Range: 0–50cm",       ok:true },
              { name:"Wi-Fi Module",         status:"ONLINE",  detail:"192.168.1.42 · -42dBm",ok:true},
              { name:"Battery",             status:"CHARGING", detail:"12V · 87% · 22Ah",  ok:true },
              { name:"Motor Driver DRV8825",status:"STANDBY", detail:"Temp: 42°C",          ok:true },
              { name:"Power Switch",        status:"ON",      detail:"220V AC Input",        ok:true },
            ].map(row => (
              <div key={row.name} className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${row.ok ? "bg-emerald-400" : "bg-red-400"}`}
                    style={{ filter: row.ok ? "drop-shadow(0 0 3px #34d399)" : "drop-shadow(0 0 3px #f87171)" }} />
                  <span className="text-[11px] text-white/60">{row.name}</span>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold ${row.ok ? "text-emerald-400" : "text-red-400"}`}>{row.status}</div>
                  <div className="text-[9px] text-white/25">{row.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Camera feed simulation + recent events */}
        <div className="flex flex-col gap-4">
          {/* AI feed */}
          <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4 flex-1">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Live Camera Feed</h3>
            <div className="relative rounded-xl overflow-hidden bg-[#060f1e] border border-white/5" style={{ height:180 }}>
              {/* Simulated camera view */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0" style={{
                  backgroundImage: "linear-gradient(rgba(59,130,246,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.03) 1px,transparent 1px)",
                  backgroundSize: "20px 20px",
                }} />
                {/* Waste object placeholder */}
                <div className="relative">
                  <span className="text-7xl">🍶</span>
                  {/* Detection box */}
                  <div className="absolute -inset-3 border-2 border-blue-500 rounded-lg"
                    style={{ boxShadow: "0 0 10px #3b82f655" }}>
                    <div className="absolute -top-4 left-0 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      PLASTIC 95%
                    </div>
                    {/* Corner brackets */}
                    {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy],i)=>(
                      <div key={i} className="absolute w-3 h-3 border-blue-400"
                        style={{
                          top: sy < 0 ? -1 : "auto", bottom: sy > 0 ? -1 : "auto",
                          left: sx < 0 ? -1 : "auto", right: sx > 0 ? -1 : "auto",
                          borderTopWidth: sy < 0 ? 2 : 0, borderBottomWidth: sy > 0 ? 2 : 0,
                          borderLeftWidth: sx < 0 ? 2 : 0, borderRightWidth: sx > 0 ? 2 : 0,
                        }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* Scan line overlay */}
              <motion.div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60"
                animate={{ top: ["10%","90%","10%"] }} transition={{ duration:3, repeat:Infinity, ease:"linear" }} />
              {/* Camera info overlay */}
              <div className="absolute top-2 left-2 text-[9px] text-emerald-400 font-mono">
                <div>REC ●  30FPS</div>
                <div className="text-white/30">{new Date().toLocaleTimeString()}</div>
              </div>
              <div className="absolute bottom-2 right-2 text-[9px] text-white/30 font-mono">1920×1080</div>
            </div>
          </div>

          {/* AI Recognition log */}
          <div className="bg-[#0d1f3c] border border-white/8 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">AI Recognition Log</h3>
            <div className="flex flex-col gap-1.5">
              {[
                { time:"13:42:01", item:"Plastic Bottle", cat:"CAN/PLASTIC", conf:95, color:"#f97316" },
                { time:"13:38:44", item:"Glass Bottle",   cat:"GLASS",       conf:93, color:"#92400e" },
                { time:"13:35:12", item:"Newspaper",      cat:"PAPER",       conf:97, color:"#2563eb" },
                { time:"13:31:55", item:"Aluminium Can",  cat:"CAN/PLASTIC", conf:91, color:"#f97316" },
                { time:"13:28:30", item:"Wine Bottle",    cat:"GLASS",       conf:88, color:"#92400e" },
              ].map((ev,i)=>(
                <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5">
                  <span className="text-[9px] text-white/25 font-mono w-14">{ev.time}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                  <span className="text-[10px] text-white/60 flex-1">{ev.item}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: ev.color, backgroundColor: ev.color + "18" }}>{ev.cat}</span>
                  <span className="text-[9px] text-emerald-400 font-bold w-10 text-right">{ev.conf}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
