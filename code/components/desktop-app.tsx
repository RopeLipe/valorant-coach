"use client"

import { Card } from "@ui/card"
import { Button } from "@ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs"
import { Badge } from "@ui/badge"
import { Progress } from "@ui/progress"
import { TrendingUp, TrendingDown, Target, Crosshair, Trophy, Activity, User, Settings, Home, BarChart3, History, BookOpen, Sparkles, ChevronRight, Minus, X, Zap, Shield, Sword, Map, Award, Brain } from "lucide-react"
import { useState, useRef } from "react"
import logoUrl from "../../logo.svg?url"

export function DesktopApp() {
  const [selectedTab, setSelectedTab] = useState("home")
  const [selectedSubTab, setSelectedSubTab] = useState("overview")
  const [expandedAgents, setExpandedAgents] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const topAgentsRef = useRef<HTMLDivElement | null>(null)

  const stats = {
    currentRank: "IMMORTAL 2",
    rr: "423 RR",
    winRate: "58.3%",
    kd: "1.42",
    hs: "28.4%",
    acs: "223",
  }

  const recentMatches = [
    {
      map: "Ascent",
      result: "win",
      score: "13-9",
      agent: "Jett",
      kda: "22/14/8",
      acs: "285",
      hs: "32%",
      mvp: true,
      timeAgo: "2h ago",
    },
    {
      map: "Bind",
      result: "win",
      score: "13-11",
      agent: "Omen",
      kda: "18/16/12",
      acs: "212",
      hs: "26%",
      mvp: false,
      timeAgo: "4h ago",
    },
    {
      map: "Haven",
      result: "loss",
      score: "11-13",
      agent: "Jett",
      kda: "19/18/6",
      acs: "245",
      hs: "31%",
      mvp: false,
      timeAgo: "6h ago",
    },
    {
      map: "Split",
      result: "win",
      score: "13-7",
      agent: "Reyna",
      kda: "26/12/5",
      acs: "312",
      hs: "35%",
      mvp: true,
      timeAgo: "1d ago",
    },
    {
      map: "Icebox",
      result: "loss",
      score: "10-13",
      agent: "Sage",
      kda: "12/15/14",
      acs: "178",
      hs: "24%",
      mvp: false,
      timeAgo: "1d ago",
    },
  ]

  const agentStats = [
    { agent: "Jett", matches: 87, wr: "62%", kd: "1.68", acs: "256", hs: "31%", picks: "35%" },
    { agent: "Reyna", matches: 52, wr: "58%", kd: "1.52", acs: "241", hs: "29%", picks: "21%" },
    { agent: "Omen", matches: 41, wr: "54%", kd: "1.32", acs: "198", hs: "26%", picks: "16%" },
    { agent: "Phoenix", matches: 28, wr: "50%", kd: "1.28", acs: "215", hs: "27%", picks: "11%" },
    { agent: "Sage", matches: 22, wr: "59%", kd: "1.18", acs: "186", hs: "25%", picks: "9%" },
  ]

  const weaponStats = [
    { weapon: "Vandal", kills: 1842, hs: "32%", acc: "24%", damage: "142k" },
    { weapon: "Phantom", kills: 1523, hs: "29%", acc: "26%", damage: "118k" },
    { weapon: "Sheriff", kills: 287, hs: "45%", acc: "31%", damage: "21k" },
    { weapon: "Operator", kills: 156, hs: "91%", acc: "48%", damage: "19k" },
    { weapon: "Spectre", kills: 143, hs: "27%", acc: "21%", damage: "12k" },
  ]

  const mapStats = [
    { map: "Ascent", matches: 45, wr: "62%", kd: "1.54", acs: "235" },
    { map: "Bind", matches: 38, wr: "55%", kd: "1.38", acs: "218" },
    { map: "Haven", matches: 42, wr: "57%", kd: "1.45", acs: "228" },
    { map: "Split", matches: 31, wr: "61%", kd: "1.52", acs: "242" },
    { map: "Icebox", matches: 34, wr: "53%", kd: "1.35", acs: "212" },
  ]

  return (
    <div className="t-app t-window flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="ml-5 w-16 t-sidebar flex flex-col items-center py-4 gap-2">
        <div className="w-16 h-16 rounded-xl bg-black flex items-center justify-center mb-4 shadow-lg overflow-hidden">
          <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
        </div>

        <div className="flex flex-col gap-1 w-full px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTab("home")}
            className={`w-full h-12 rounded-xl transition-all duration-200 ${
              selectedTab === "home" 
                ? "bg-white text-black shadow-lg scale-105" 
                : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
            }`}
          >
            <Home className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTab("stats")}
            className={`w-full h-12 rounded-xl transition-all duration-200 ${
              selectedTab === "stats" 
                ? "bg-white text-black shadow-lg scale-105" 
                : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTab("matches")}
            className={`w-full h-12 rounded-xl transition-all duration-200 ${
              selectedTab === "matches" 
                ? "bg-white text-black shadow-lg scale-105" 
                : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
            }`}
          >
            <History className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTab("guides")}
            className={`w-full h-12 rounded-xl transition-all duration-200 ${
              selectedTab === "guides" 
                ? "bg-white text-black shadow-lg scale-105" 
                : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
            }`}
          >
            <Brain className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-xl text-white/60 hover:text-white hover:bg-white/10 hover:scale-105 transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="h-20 t-header border-b border-border flex items-center justify-between px-8"
          onMouseDown={() => {
            const ow = (window as any).overwolf
            if (!ow) return
            try {
              ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                if (res?.success && res.window?.id) {
                  ow.windows.dragMove(res.window.id)
                }
              })
            } catch {}
          }}
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-xl bg-black flex items-center justify-center shadow-lg">
              <User className="w-7 h-7 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold tracking-tight text-white">PlayerName</span>
                <span className="text-white/50 text-sm font-medium">#TAG</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-6 px-3 rounded-md shadow-sm">
                  {stats.currentRank}
                </Badge>
                <span className="text-white/60 text-xs font-semibold">{stats.rr}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button className="bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 h-10 px-8 font-bold text-sm rounded-lg shadow-lg transition-all duration-200">
              Start Coaching
            </Button>
            <div className="flex items-center gap-3">
              <Button
                className="h-10 px-6 rounded-lg bg-white/10 text-white hover:bg-white/20"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const ow = (window as any).overwolf
                  if (!ow) return
                  try {
                    ow.settings.games.getOverlayEnabled(21640, (r: any) => {
                      try { if (!r?.enabled) ow.settings.games.enableOverlay(21640, () => {}) } catch {}
                      try { ow.utils.openUrl('overwolf://settings/games-overlay?hotkey=voice_command&gameId=21640') } catch {}
                    })
                  } catch {}
                }}
              >
                Enable Overlays
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const ow = (window as any).overwolf
                  if (!ow) return
                  try {
                    ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                      if (res?.success && res.window?.id) {
                        ow.windows.minimize(res.window.id)
                      }
                    })
                  } catch {}
                }}
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl text-white/70 hover:text-white hover:bg-red-500/20 transition-all duration-200"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const ow = (window as any).overwolf
                  if (!ow) return
                  try {
                    ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                      if (res?.success && res.window?.id) {
                        ow.windows.hide(res.window.id)
                      }
                    })
                  } catch {}
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto no-scrollbar snap-container"
          ref={contentRef}
          onWheel={(e) => {
            const container = contentRef.current
            const target = topAgentsRef.current
            if (!container || !target) return
            if (e.deltaY > 0 && !expandedAgents) {
              e.preventDefault()
              target.scrollIntoView({ behavior: "smooth", block: "start" })
              setExpandedAgents(true)
            } else if (e.deltaY < 0 && expandedAgents) {
              e.preventDefault()
              container.scrollTo({ top: 0, behavior: "smooth" })
              setExpandedAgents(false)
            }
          }}
        >
          {selectedTab === "home" && (
            <div className="p-6 pb-24 space-y-6">
              <section className="snap-section">
              <div className="grid grid-cols-4 gap-4">
                <Card className="relative p-6 t-card rounded-xl transition-all duration-200 hover:translate-y-0.5">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white to-gray-300 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-label mb-2">Win Rate</div>
                  <div className="text-stat">{stats.winRate}</div>
                </Card>

                <Card className="relative p-6 t-card rounded-xl transition-all duration-200 hover:translate-y-0.5">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white to-gray-300 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-label mb-2">K/D Ratio</div>
                  <div className="text-stat">{stats.kd}</div>
                </Card>

                <Card className="relative p-6 t-card rounded-xl transition-all duration-200 hover:translate-y-0.5">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white to-gray-300 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Crosshair className="w-5 h-5 text-white" />
                    </div>
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-label mb-2">Headshot %</div>
                  <div className="text-stat">{stats.hs}</div>
                </Card>

                <Card className="relative p-6 t-card rounded-xl transition-all duration-200 hover:translate-y-0.5">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white to-gray-300 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-label mb-2">Avg ACS</div>
                  <div className="text-stat">{stats.acs}</div>
                </Card>
              </div>
              </section>
              <section className="snap-section">
              <div className="grid grid-cols-3 gap-4">
                {/* AI Insights */}
                <Card className="col-span-2 p-6 t-card rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      AI Coach Insights
                    </h3>
                    <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-5 px-2 rounded-lg">LAST 20 GAMES</Badge>
                  </div>

                  <Tabs value={selectedSubTab} onValueChange={setSelectedSubTab}>
                    <TabsList className="w-full grid grid-cols-3 h-8 bg-secondary/50 border border-border mb-2">
                      <TabsTrigger
                        value="overview"
                        className="text-xs font-bold text-white/70 hover:text-white data-[state=active]:!bg-white data-[state=active]:!text-black rounded-sm"
                      >
                        Overview
                      </TabsTrigger>
                      <TabsTrigger
                        value="strengths"
                        className="text-xs font-bold text-white/70 hover:text-white data-[state=active]:!bg-white data-[state=active]:!text-black rounded-sm"
                      >
                        Strengths
                      </TabsTrigger>
                      <TabsTrigger
                        value="improve"
                        className="text-xs font-bold text-white/70 hover:text-white data-[state=active]:!bg-white data-[state=active]:!text-black rounded-sm"
                      >
                        Improve
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-3">
                      <div className="p-5 rounded-sm border-l-2 border-white bg-white/5">
                        <div className="text-label mb-2">Performance Score</div>
                        <div className="flex items-end gap-3 mb-3">
                          <div className="text-stat">8.2</div>
                          <div className="text-sm text-white/60 mb-1">/ 10</div>
                        </div>
                        <Progress value={82} className="h-2 bg-white/10" />
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="p-3 rounded-sm bg-white/5 border border-white/10">
                            <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Focus</div>
                            <div className="text-xs text-white">Consistency and utility usage</div>
                          </div>
                          <div className="p-3 rounded-sm bg-white/5 border border-white/10">
                            <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Next Step</div>
                            <div className="text-xs text-white">Improve economy decisions</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-sm bg-white/5 border border-white/10">
                          <div className="text-label mb-2">
                            Best Role
                          </div>
                          <div className="text-sm font-bold text-white">Duelist</div>
                        </div>
                        <div className="p-4 rounded-sm bg-white/5 border border-white/10">
                          <div className="text-label mb-2">
                            Best Map
                          </div>
                          <div className="text-sm font-bold text-white">Ascent</div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="strengths" className="space-y-2">
                      <div className="p-3 rounded-sm border-l-2 border-white bg-white/5">
                        <div className="text-xs font-bold text-white mb-1">Aim Consistency</div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Your crosshair placement and spray control are strong. 32% headshot rate is above average.
                        </p>
                      </div>
                      <div className="p-3 rounded-sm border-l-2 border-white bg-white/5">
                        <div className="text-xs font-bold text-white mb-1">Clutch Performance</div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          62% 1vX win rate shows excellent decision-making under pressure.
                        </p>
                      </div>
                      <div className="p-3 rounded-sm border-l-2 border-white bg-white/5">
                        <div className="text-xs font-bold text-white mb-1">Agent Pool</div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Versatile agent pool with high performance across duelists and controllers.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="improve" className="space-y-3">
                      <div className="p-3 rounded-sm bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-bold text-white">Utility Usage</div>
                          <Badge className="bg-white text-black text-[8px] font-bold h-4 px-1.5">PRIORITY</Badge>
                        </div>
                        <Progress value={58} className="h-1.5 bg-white/10 mb-2" />
                        <p className="text-xs text-white/60 leading-relaxed">
                          You're only using 58% of abilities. Save less and use utility to gain map control.
                        </p>
                      </div>
                      <div className="p-3 rounded-sm bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-bold text-white">Economy Management</div>
                          <Badge className="bg-white/20 text-white text-[8px] font-bold h-4 px-1.5">MEDIUM</Badge>
                        </div>
                        <Progress value={42} className="h-1.5 bg-white/10 mb-2" />
                        <p className="text-xs text-white/60 leading-relaxed">
                          Force buying too often. Coordinate with team for better full buy rounds.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>

                {/* Recent Matches Sidebar */}
                <Card className="p-6 t-card rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Recent Matches
                    </h3>
                    <ChevronRight
                      className="w-4 h-4 text-white/60 hover:text-white transition-colors cursor-pointer"
                      onClick={() => setSelectedTab("stats")}
                    />
                  </div>
                  <div className="space-y-2">
                    {recentMatches.slice(0, 3).map((match, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-sm border-l-2 ${
                          match.result === "win" ? "bg-green-500/5 border-green-400" : "bg-red-500/5 border-red-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-hero text-white">{match.map}</span>
                            {match.mvp && (<Badge className="pill accent-green">MVP</Badge>)}
                          </div>
                          <span className="text-base text-white/80 text-value-strong">{match.score}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-white/10 text-white text-[10px] h-5 px-2">{match.agent}</Badge>
                          <span className="text-base text-white/80 font-mono font-bold">{match.kda}</span>
                        </div>
                        <div className="mt-2 text-xs text-white/50">{match.timeAgo}</div>
                      </div>
                    ))}

                  </div>
                </Card>
              </div>
              </section>
              <section className="snap-section mb-8" ref={topAgentsRef}>
              {/* Top Agents */}
              <Card className="p-6 t-card rounded-xl">
                <h3 className="text-base font-bold uppercase tracking-wide mb-4 text-white flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Top Agents
                </h3>
                <div className="grid grid-cols-5 gap-4">
                  {agentStats.slice(0, 5).map((agent, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/20 hover:from-white/10 hover:to-white/15 transition-all duration-300 cursor-pointer hover:scale-105 shadow-lg"
                    >
                      <div className="text-hero mb-3">{agent.agent}</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/60">Win Rate</span>
                          <span className="text-white text-value-strong">{agent.wr}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-white/60">K/D</span>
                          <span className="text-white text-value-strong">{agent.kd}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-white/60">Games</span>
                          <span className="text-white/80 font-mono">{agent.matches}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {expandedAgents && (
                  <div className="mt-6 border-t border-white/10 pt-6 transition-all duration-500">
                    <div className="grid grid-cols-7 gap-3 py-2 border-b border-white/10">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Agent</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">Matches</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">Win %</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">K/D</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">ACS</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">HS%</span>
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">Pick %</span>
                    </div>
                    {agentStats.map((agent, i) => (
                      <div key={i} className="grid grid-cols-7 gap-3 py-3 hover:bg-white/5 rounded-sm transition-colors">
                        <span className="text-sm font-bold text-white">{agent.agent}</span>
                        <span className="text-sm text-white/60 text-right font-mono">{agent.matches}</span>
                        <span className="text-sm font-bold text-white text-right">{agent.wr}</span>
                        <span className="text-sm font-bold text-white text-right">{agent.kd}</span>
                        <span className="text-sm text-white/60 text-right font-mono">{agent.acs}</span>
                        <span className="text-sm text-white/60 text-right font-mono">{agent.hs}</span>
                        <span className="text-sm text-white/60 text-right font-mono">{agent.picks}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              </section>
            </div>
          )}

          {selectedTab === "stats" && (
            <div className="p-8 space-y-6">
              <Tabs defaultValue="agents">
                <TabsList className="h-12 bg-secondary/50 border border-border rounded-xl">
                  <TabsTrigger
                    value="agents"
                    className="text-sm font-bold text-white/70 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-gray-200 data-[state=active]:!text-black rounded-lg px-6 transition-all duration-200"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Agents
                  </TabsTrigger>
                  <TabsTrigger
                    value="weapons"
                    className="text-sm font-bold text-white/70 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-gray-200 data-[state=active]:!text-black rounded-lg px-6 transition-all duration-200"
                  >
                    <Sword className="w-4 h-4 mr-2" />
                    Weapons
                  </TabsTrigger>
                  <TabsTrigger
                    value="maps"
                    className="text-sm font-bold text-white/70 hover:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-gray-200 data-[state=active]:!text-black rounded-lg px-6 transition-all duration-200"
                  >
                    <Map className="w-4 h-4 mr-2" />
                    Maps
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="agents" className="mt-6">
                  <Card className="p-8 t-card rounded-xl">
                    <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                      <Shield className="w-6 h-6" />
                      Agent Statistics
                    </h3>
                    <div className="space-y-1">
                      <div className="grid grid-cols-7 gap-3 py-2 border-b border-white/10">
                        <span className="text-label">Agent</span>
                        <span className="text-label text-right">
                          Matches
                        </span>
                        <span className="text-label text-right">
                          Win %
                        </span>
                        <span className="text-label text-right">
                          K/D
                        </span>
                        <span className="text-label text-right">
                          ACS
                        </span>
                        <span className="text-label text-right">
                          HS%
                        </span>
                        <span className="text-label text-right">
                          Pick %
                        </span>
                      </div>
                      {agentStats.map((agent, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-7 gap-3 py-3 hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <span className="text-sm font-bold text-white">{agent.agent}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{agent.matches}</span>
                          <span className="text-sm text-value-strong text-white text-right">{agent.wr}</span>
                          <span className="text-sm text-value-strong text-white text-right">{agent.kd}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{agent.acs}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{agent.hs}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{agent.picks}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="weapons" className="mt-6">
                  <Card className="p-8 t-card rounded-xl">
                    <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                      <Sword className="w-6 h-6" />
                      Weapon Statistics
                    </h3>
                    <div className="space-y-1">
                      <div className="grid grid-cols-5 gap-3 py-2 border-b border-white/10">
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Weapon</span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          Kills
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          HS%
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          Accuracy
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          Damage
                        </span>
                      </div>
                      {weaponStats.map((weapon, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-5 gap-3 py-3 hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <span className="text-sm font-bold text-white">{weapon.weapon}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{weapon.kills}</span>
                          <span className="text-sm font-bold text-white text-right">{weapon.hs}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{weapon.acc}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{weapon.damage}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="maps" className="mt-6">
                  <Card className="p-8 t-card rounded-xl">
                    <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                      <Map className="w-6 h-6" />
                      Map Statistics
                    </h3>
                    <div className="space-y-1">
                      <div className="grid grid-cols-5 gap-3 py-2 border-b border-white/10">
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Map</span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          Matches
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          Win %
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          K/D
                        </span>
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold text-right">
                          ACS
                        </span>
                      </div>
                      {mapStats.map((map, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-5 gap-3 py-3 hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <span className="text-sm font-bold text-white">{map.map}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{map.matches}</span>
                          <span className="text-sm font-bold text-white text-right">{map.wr}</span>
                          <span className="text-sm font-bold text-white text-right">{map.kd}</span>
                          <span className="text-sm text-white/60 text-right font-mono">{map.acs}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {selectedTab === "matches" && (
            <div className="p-8">
              <Card className="p-8 t-card rounded-xl">
                <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                  <History className="w-6 h-6" />
                  Match History
                </h3>
                <div className="space-y-2">
                  {recentMatches.map((match, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-sm border-l-2 ${
                        match.result === "win" ? "bg-green-500/5 border-green-400" : "bg-red-500/5 border-red-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white">{match.map}</span>
                          {match.mvp && (
                            <Badge className="bg-white text-black text-[9px] h-5 px-2 font-bold">MVP</Badge>
                          )}
                          <Badge className="bg-white/10 text-white text-[10px] h-5 px-2">{match.agent}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-white">{match.score}</span>
                          <span className="text-xs text-white/40">{match.timeAgo}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-white/50">K/D/A</span>
                          <div className="text-white font-mono font-bold">{match.kda}</div>
                        </div>
                        <div>
                          <span className="text-white/50">ACS</span>
                          <div className="text-white font-bold">{match.acs}</div>
                        </div>
                        <div>
                          <span className="text-white/50">HS%</span>
                          <div className="text-white font-bold">{match.hs}</div>
                        </div>
                        <div>
                          <span className="text-white/50">Result</span>
                          <div
                            className={`font-bold uppercase ${
                              match.result === "win" ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {match.result}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {selectedTab === "guides" && (
            <div className="p-8">
              <Card className="p-8 t-card rounded-xl">
                <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                  <Brain className="w-6 h-6" />
                  AI Learning Center
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-xl t-inset transition-all duration-200 cursor-pointer hover:bg-secondary/60">
                    <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-6 px-3 rounded-lg mb-4">POSITIONING</Badge>
                    <h4 className="text-lg font-bold text-white mb-3">Advanced Off-Angles</h4>
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                      Learn pro-level off-angle positions to catch enemies off-guard and secure first picks.
                    </p>
                    <Button className="w-full bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 h-10 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105">
                      Start Lesson
                    </Button>
                  </div>

                  <div className="p-6 rounded-xl t-inset transition-all duration-200 cursor-pointer hover:bg-secondary/60">
                    <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-6 px-3 rounded-lg mb-4">UTILITY</Badge>
                    <h4 className="text-lg font-bold text-white mb-3">Ability Combos</h4>
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                      Master powerful ability combinations for each agent to maximize round impact.
                    </p>
                    <Button className="w-full bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 h-10 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105">
                      Start Lesson
                    </Button>
                  </div>

                  <div className="p-6 rounded-xl t-inset transition-all duration-200 cursor-pointer hover:bg-secondary/60">
                    <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-6 px-3 rounded-lg mb-4">MECHANICS</Badge>
                    <h4 className="text-lg font-bold text-white mb-3">Crosshair Placement</h4>
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                      Improve your aim by mastering head-level crosshair placement in all scenarios.
                    </p>
                    <Button className="w-full bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 h-10 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105">
                      Start Lesson
                    </Button>
                  </div>

                  <div className="p-6 rounded-xl t-inset transition-all duration-200 cursor-pointer hover:bg-secondary/60">
                    <Badge className="bg-gradient-to-r from-white to-gray-200 text-black text-xs font-bold h-6 px-3 rounded-lg mb-4">STRATEGY</Badge>
                    <h4 className="text-lg font-bold text-white mb-3">Map Control</h4>
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                      Learn how to take and maintain map control for strategic advantages.
                    </p>
                    <Button className="w-full bg-gradient-to-r from-white to-gray-200 text-black hover:from-gray-100 hover:to-gray-300 h-10 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-105">
                      Start Lesson
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
