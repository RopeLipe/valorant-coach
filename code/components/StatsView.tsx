import React, { useState } from "react"
import { motion } from "framer-motion"
import { Card } from "./ui/card"
import { Progress } from "./ui/progress"
import { Badge } from "./ui/badge"
import { TrendingUp, TrendingDown, Target, Zap, Trophy, Shield, HelpCircle, ChevronRight, Activity, Crosshair } from 'lucide-react'

// Custom SVGs for a futuristic, modern monochrome look

export interface MapStats {
  name: string
  winRate: number
  wins: number
  losses: number
  coachTip: string
}

export interface WeaponStats {
  name: string
  kills: number
  headshotPct: number
  damagePerRound: number
  usagePct: number
}

export default function StatsView() {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  
  // Mock player data for Z1n3x#NA1
  const generalStats = {
    rank: "Diamond III",
    rr: 74,
    kdRatio: "1.24",
    winRate: "58.3%",
    headshotPct: "24.6%",
    acs: "248",
    winStreak: "3 Wins"
  }

  // Trend data for recent games
  const trendData = [
    { match: 1, acs: 210, kd: 1.1, result: "win" },
    { match: 2, acs: 185, kd: 0.9, result: "loss" },
    { match: 3, acs: 260, kd: 1.4, result: "win" },
    { match: 4, acs: 310, kd: 2.1, result: "win" },
    { match: 5, acs: 220, kd: 1.2, result: "win" },
    { match: 6, acs: 195, kd: 1.0, result: "loss" },
    { match: 7, acs: 280, kd: 1.6, result: "win" },
    { match: 8, acs: 245, kd: 1.3, result: "win" }
  ]

  const weaponStats: WeaponStats[] = [
    { name: "Vandal", kills: 142, headshotPct: 28.5, damagePerRound: 88, usagePct: 62 },
    { name: "Phantom", kills: 58, headshotPct: 22.1, damagePerRound: 82, usagePct: 25 },
    { name: "Sheriff", kills: 24, headshotPct: 45.8, damagePerRound: 35, usagePct: 8 },
    { name: "Operator", kills: 12, headshotPct: 15.0, damagePerRound: 95, usagePct: 5 }
  ]

  const mapStats: MapStats[] = [
    { name: "Ascent", winRate: 71.4, wins: 5, losses: 2, coachTip: "Control mid with A-main pressure. Your Cypher setups are highly effective here." },
    { name: "Sunset", winRate: 66.7, wins: 4, losses: 2, coachTip: "Fight for B-main early. Use smokes to block the elbow choke point." },
    { name: "Bind", winRate: 50.0, wins: 3, losses: 3, coachTip: "Vary your teleport timing. Push showers with flash coordination." },
    { name: "Split", winRate: 40.0, wins: 2, losses: 3, coachTip: "Struggle defending mid vents. Rotate faster when opponent splits." }
  ]

  // Math for SVG Area Chart
  const svgWidth = 600
  const svgHeight = 180
  const padding = 30
  const chartWidth = svgWidth - padding * 2
  const chartHeight = svgHeight - padding * 2

  const maxAcs = Math.max(...trendData.map(d => d.acs))
  const minAcs = Math.min(...trendData.map(d => d.acs))
  const acsRange = maxAcs - minAcs

  const points = trendData.map((d, index) => {
    const x = padding + (index / (trendData.length - 1)) * chartWidth
    // Invert Y since (0,0) is top-left
    const y = padding + chartHeight - ((d.acs - minAcs) / acsRange) * chartHeight
    return { x, y, acs: d.acs, kd: d.kd, result: d.result, match: d.match }
  })

  // Create path strings for SVG line and area
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${svgHeight - padding} L ${points[0].x} ${svgHeight - padding} Z`

  return (
    <div className="space-y-8 p-8 h-full overflow-y-auto no-scrollbar scroll-smooth bg-black text-white">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase font-sans">
              Tactical Performance
            </h1>
            <Badge className="bg-white text-black border-none text-xs font-mono px-2 py-0.5 rounded uppercase font-bold">
              Z1n3x#NA1
            </Badge>
          </div>
          <p className="text-sm text-white/50">
            Real-time telemetry analytics & customized AI training metrics.
          </p>
        </div>

        {/* Premium B&W Rank Display */}
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 pr-6 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.03)]">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20">
            <Shield className="w-6 h-6 text-white" />
            <div className="absolute inset-0 bg-white/5 animate-pulse rounded-xl" />
          </div>
          <div>
            <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider font-bold block">Current Rank</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white uppercase">{generalStats.rank}</span>
              <span className="text-xs font-mono text-white/70">{generalStats.rr} RR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "K/D Ratio", value: generalStats.kdRatio, icon: Activity, trend: "+0.04 vs last act", positive: true },
          { label: "Win Rate", value: generalStats.winRate, icon: Trophy, trend: "58.3% seasonal", positive: true },
          { label: "Headshot %", value: generalStats.headshotPct, icon: Target, trend: "Top 8% in Diamond", positive: true },
          { label: "Avg Combat Score (ACS)", value: generalStats.acs, icon: Zap, trend: "248.4 per game", positive: true }
        ].map((card, i) => (
          <Card key={i} className="relative bg-[#060606] border border-white/10 hover:border-white/20 p-5 rounded-2xl transition-all duration-300 overflow-hidden group shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-500" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs text-white/40 uppercase font-mono tracking-wider font-bold">{card.label}</span>
              <card.icon className="w-4 h-4 text-white/40 group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">{card.value}</div>
            <p className="text-[10px] font-mono text-white/40 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white/80" />
              {card.trend}
            </p>
          </Card>
        ))}
      </div>

      {/* Main Charts & Weapons Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ACS Trend Chart (SVG-based Area/Line) */}
        <Card className="xl:col-span-2 bg-[#060606] border border-white/10 p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Average Combat Score Trend</h3>
                <p className="text-xs text-white/40">Telemetry tracker over the last 8 match reviews</p>
              </div>
              <Badge className="bg-white/10 text-white/80 hover:bg-white/10 font-mono text-[10px]">VITE_TEAMS_UP_INTEGRATED</Badge>
            </div>

            {/* SVG Area Chart */}
            <div className="relative w-full h-[180px] mt-4 select-none">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="white" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0, 1, 2].map((i) => {
                  const y = padding + (chartHeight / 2) * i
                  const val = Math.round(maxAcs - (i * acsRange) / 2)
                  return (
                    <g key={i} className="opacity-20">
                      <line x1={padding} y1={y} x2={svgWidth - padding} y2={y} stroke="white" strokeWidth="0.5" strokeDasharray="3,3" />
                      <text x={padding - 5} y={y + 4} fill="white" fontSize="9" fontFamily="monospace" textAnchor="end">{val}</text>
                    </g>
                  )
                })}

                {/* Filled Area */}
                <path d={areaPath} fill="url(#areaGrad)" />

                {/* Path line */}
                <path d={linePath} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

                {/* Interactive Points */}
                {points.map((p, i) => (
                  <g key={i} className="cursor-pointer"
                     onMouseEnter={() => setHoveredPoint(i)}
                     onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Ripple animation on hover */}
                    {hoveredPoint === i && (
                      <circle cx={p.x} cy={p.y} r="10" fill="white" className="opacity-20" />
                    )}
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r={hoveredPoint === i ? "5" : "3.5"} 
                      fill={p.result === "win" ? "white" : "black"} 
                      stroke="white" 
                      strokeWidth="1.5" 
                      className="transition-all duration-150"
                    />
                  </g>
                ))}
              </svg>

              {/* HTML Tooltip overlay */}
              {hoveredPoint !== null && (
                <div 
                  className="absolute p-3 bg-black/90 border border-white/20 rounded-xl pointer-events-none backdrop-blur-md shadow-2xl z-20"
                  style={{
                    left: `${(points[hoveredPoint].x / svgWidth) * 100}%`,
                    top: `${(points[hoveredPoint].y / svgHeight) * 100 - 35}%`,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  <div className="text-[10px] text-white/40 uppercase font-mono font-bold">Match #{points[hoveredPoint].match}</div>
                  <div className="flex items-center gap-4 mt-1">
                    <div>
                      <span className="text-[9px] text-white/50 uppercase font-mono block">ACS</span>
                      <span className="text-sm font-black font-mono text-white">{points[hoveredPoint].acs}</span>
                    </div>
                    <div className="border-l border-white/10 pl-3">
                      <span className="text-[9px] text-white/50 uppercase font-mono block">K/D</span>
                      <span className="text-sm font-black font-mono text-white">{points[hoveredPoint].kd}</span>
                    </div>
                    <div className="border-l border-white/10 pl-3">
                      <span className="text-[9px] text-white/50 uppercase font-mono block">Result</span>
                      <span className={`text-xs font-bold uppercase ${points[hoveredPoint].result === 'win' ? 'text-white' : 'text-white/40'}`}>
                        {points[hoveredPoint].result}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-4 text-[10px] text-white/40 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Win Matches
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full border border-white" />
              Loss Matches
            </span>
            <span>Scale: Last 8 competitive games</span>
          </div>
        </Card>

        {/* Weapon Performance Table */}
        <Card className="bg-[#060606] border border-white/10 p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Weapon Accuracy Profile</h3>
            <p className="text-xs text-white/40">Telemetry breakdown based on hit registry</p>
          </div>
          <div className="space-y-4">
            {weaponStats.map((weapon, idx) => (
              <div key={idx} className="group">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-bold text-white tracking-wide">{weapon.name}</span>
                  <span className="text-white/40 font-mono font-bold text-[10px]">{weapon.headshotPct}% Headshot</span>
                </div>
                <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${weapon.headshotPct * 2}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className="absolute top-0 left-0 h-full bg-white"
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] text-white/30 font-mono mt-1">
                  <span>{weapon.kills} kills ({weapon.usagePct}% loadout)</span>
                  <span>{weapon.damagePerRound} ADR</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Map Analytics Panel */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Strategic Map Breakdown</h3>
          <p className="text-xs text-white/40">Tactical insights derived from combat heatmaps and plant success ratios</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {mapStats.map((map, i) => (
            <Card key={i} className="bg-[#060606] border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-all duration-300 flex flex-col justify-between gap-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] group">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-black text-white text-base tracking-tight group-hover:translate-x-1 transition-transform duration-300">{map.name}</h4>
                  <span className="text-xs font-mono font-bold text-white/70">{map.winRate}% Win</span>
                </div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden border border-white/10 mb-3">
                  <div className="bg-white h-full" style={{ width: `${map.winRate}%` }} />
                </div>
                <p className="text-[10px] text-white/40 font-mono">Record: {map.wins}W - {map.losses}L</p>
              </div>
              <div className="text-[11px] text-white/60 leading-relaxed bg-white/5 border border-white/5 p-3 rounded-xl">
                <span className="text-[9px] font-bold font-mono text-white/30 block mb-1 uppercase">COACH NOTE</span>
                {map.coachTip}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
