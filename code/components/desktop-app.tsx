"use client"

import { Card } from "@ui/card"
import { Button } from "@ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs"
import { Badge } from "@ui/badge"
import { Progress } from "@ui/progress"
import { Home, User, BarChart3, History, Brain, Settings, Send, Bot, Sparkles, AlertCircle, X, Minus, Trophy, Target, Crosshair, Activity, TrendingUp, TrendingDown, ChevronRight, Award } from 'lucide-react'
import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import DesktopSettingsPanel from "../../components/DesktopSettingsPanel"
import logoUrl from "../../logo.svg?url"
import AICoachView from "./AICoachView"
import OnboardingFlow from "./OnboardingFlow"
import * as geminiService from "../../services/geminiFileSearch"
import * as voice from "../../services/voice"
import { runDiagnostics, type DiagnosticResult } from "../../services/diagnostics"
import { RAG_CONFIG } from "../../config/ragConfig"
import { ChatMessage } from "../../types"
import { AGENT_LIST, AgentAsset, AGENT_ASSETS } from "../../src/utils/agentAssets"
import { AgentCard } from "../../src/components/AgentCard"
import { RiotService } from "../../services/riotService"

export function DesktopApp() {
  const [selectedTab, setSelectedTab] = useState("home")
  const [selectedSubTab, setSelectedSubTab] = useState("overview")
  const [expandedAgents, setExpandedAgents] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const topAgentsRef = useRef<HTMLDivElement | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    try {
      const completed = localStorage.getItem("coach_onboarding_complete")
      if (!completed) {
        setShowOnboarding(true)
      }
    } catch { }
  }, [])

  const handleOnboardingComplete = (id?: string) => {
    if (id) {
      setRiotId(id)
      try {
        localStorage.setItem("riot_id", id)
      } catch { }
    }
    // Save to local storage
    try {
      localStorage.setItem("coach_onboarding_complete", "true")
    } catch { }
    setShowOnboarding(false)
  }

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false)

  useEffect(() => {
    // Auto-request microphone permission on startup if not already granted
    const requestMic = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return
      try {
        const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
        if (status.state !== 'granted') {
          await navigator.mediaDevices.getUserMedia({ audio: true })
        }
      } catch (e) {
        console.log("Auto-permission request failed (expected if no user gesture)", e)
      }
    }
    requestMic()
  }, [])

  const handleRunDiagnostics = async () => {
    setDiagnosticsRunning(true)
    try {
      const results = await runDiagnostics()
      setDiagnostics(results)
    } catch (e) {
      console.error("Diagnostics failed", e)
    } finally {
      setDiagnosticsRunning(false)
    }
  }

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isQueryLoading, setIsQueryLoading] = useState(false)
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([])
  const [documentName, setDocumentName] = useState<string>('Valorant Knowledge Base')
  const activeRagStoreName = RAG_CONFIG.defaultStoreId

  useEffect(() => {
    const initChat = async () => {
      try {
        geminiService.initialize()
        const questions = await geminiService.generateExampleQuestions(activeRagStoreName)
        setExampleQuestions(questions)
      } catch (e) {
        console.error("Failed to init chat", e)
      }
    }
    initChat()
  }, [])

  // Riot Data State
  const [riotId, setRiotId] = useState<string>("Z1n3x#NA1") // Default for dev/demo

  useEffect(() => {
    try {
      const savedId = localStorage.getItem("riot_id")
      if (savedId) setRiotId(savedId)
    } catch { }
  }, [])
  const [matchData, setMatchData] = useState<any[]>([])
  const [playerStats, setPlayerStats] = useState<any>(null)
  const [rankedData, setRankedData] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string>("")

  useEffect(() => {
    const fetchData = async () => {
      if (!riotId) return
      setLoadingData(true)
      setError(null)
      try {
        const [name, tag] = riotId.split("#")
        if (!name || !tag) {
          setError("Invalid Riot ID format. Use Name#Tag")
          setLoadingData(false)
          return
        }

        const account = await RiotService.getAccount(name, tag)
        if (account?.puuid) {
          const [stats, rank] = await Promise.all([
            RiotService.getAggregatedStats(account.puuid),
            RiotService.getRankedData(account.puuid)
          ])

          if (stats) {
            setPlayerStats(stats)
            setMatchData(stats.matches || [])

            // Trigger AI Analysis
            const analysis = await geminiService.analyzeMatchHistory(stats.matches)
            setAiAnalysis(analysis)
          }
          if (rank) {
            setRankedData(rank)
          }
        } else {
          setError("Account not found")
        }
      } catch (e: any) {
        console.error("Failed to fetch riot data", e)
        setError(`Failed to load data: ${e.message || "Unknown error"}`)
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [riotId])

  const handleSendMessage = async (message: string) => {
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] }
    setChatHistory(prev => [...prev, userMessage])
    setIsQueryLoading(true)

    try {
      const result = await geminiService.fileSearch(activeRagStoreName, message)
      const modelMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: result.text }],
        groundingChunks: result.groundingChunks
      }
      setChatHistory(prev => [...prev, modelMessage])
      try { voice.speak(result.text) } catch { }
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: "Sorry, I encountered an error. Please try again." }]
      }
      setChatHistory(prev => [...prev, errorMessage])
    } finally {
      setIsQueryLoading(false)
    }
  }

  const handleNewChat = () => {
    setChatHistory([])
  }
  useEffect(() => {
    const parsePayload = (raw: any): any => {
      if (!raw) return null
      if (raw.source === "valorant" && raw.payload) return raw.payload
      if (typeof raw === "string") {
        try { return parsePayload(JSON.parse(raw)) } catch { return null }
      }
      if (typeof raw === "object") {
        if (raw.payload && raw.source === "valorant") return raw.payload
        if (raw.data) return parsePayload(raw.data)
        if (raw.content) return parsePayload(raw.content)
      }
      return null
    }

    const handlePayload = (incoming: any) => {
      const payload = parsePayload(incoming)
      if (payload?.type === "toggle_settings" || payload?.type === "hotkey_unassigned") {
        setSettingsOpen(true)
      }
    }

    const ow: any = (window as any).overwolf
    const windowListener = (event: MessageEvent) => handlePayload(event.data)
    const owListener = (event: any) => handlePayload(event)
    try { window.addEventListener("message", windowListener) } catch { }
    try { ow?.windows?.onMessageReceived?.addListener(owListener) } catch { }

    return () => {
      try { window.removeEventListener("message", windowListener) } catch { }
      try { ow?.windows?.onMessageReceived?.removeListener(owListener) } catch { }
    }
  }, [])

  // Derived Stats from Real Data
  const stats = playerStats ? {
    currentRank: rankedData ? `TIER ${rankedData.tier}` : "UNRANKED", // Map tier ID to name if possible, for now just show tier
    rr: rankedData ? `${rankedData.rankedRating} RR` : "0 RR",
    winRate: playerStats.winRate,
    kd: playerStats.kd,
    hs: "28.4%", // Need round-level parsing for HS%
    acs: playerStats.acs,
  } : loadingData ? {
    currentRank: "Loading...",
    rr: "...",
    winRate: "...",
    kd: "...",
    hs: "...",
    acs: "...",
  } : error && error.includes("403") ? {
    currentRank: "Access Denied",
    rr: "-",
    winRate: "-",
    kd: "-",
    hs: "-",
    acs: "-",
  } : {
    currentRank: "No Data",
    rr: "-",
    winRate: "-",
    kd: "-",
    hs: "-",
    acs: "-",
  }

  const recentMatches = matchData.map(m => {
    const player = m.players.find((p: any) => p.gameName === riotId.split("#")[0]) // Simple check
    const teamId = player?.teamId
    const team = m.teams.find((t: any) => t.teamId === teamId)
    const won = team?.won ?? false
    const agentName = player?.characterId ? (AGENT_LIST.find(a => a.uuid === player.characterId)?.displayName || "Unknown") : "Unknown"

    return {
      map: m.mapId ? m.mapId.split("/").pop() : "Unknown", // Simplify map path
      result: won ? "win" : "loss",
      score: "13-?", // Need round calculation
      agent: agentName,
      kda: `${player?.stats?.kills}/${player?.stats?.deaths}/${player?.stats?.assists}`,
      acs: Math.round(player?.stats?.score / (m.roundResults?.length || 1)).toString(),
      hs: "?%",
      mvp: false, // Need calc
      timeAgo: new Date(m.gameStartMillis).toLocaleDateString(),
    }
  })

  // Placeholder for agent stats until we aggregate them properly
  const agentStats = [
    { agent: "Jett", matches: 0, wr: "0%", kd: "0.00", acs: "0", hs: "0%", picks: "0%" },
  ]

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  }

  return (
    <div className="relative h-screen bg-black text-white font-sans selection:bg-white/20">
      <div className="t-app t-window flex h-screen overflow-hidden">
        {/* Sidebar */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 flex flex-col items-center py-6 gap-4 bg-black border-r border-white/10 z-30"
        >
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-6 shadow-lg shadow-white/10 overflow-hidden">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain invert" />
          </div>

          <div className="flex flex-col gap-3 w-full px-3">
            {[
              { id: "home", icon: Home, label: "Home" },
              { id: "agents", icon: User, label: "Agents" },
              { id: "stats", icon: BarChart3, label: "Stats" },
              { id: "matches", icon: History, label: "Matches" },
              { id: "guides", icon: Brain, label: "Coach" }
            ].map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="icon"
                onClick={() => setSelectedTab(tab.id)}
                className={`w-full h-14 rounded-xl transition-all duration-300 relative group ${selectedTab === tab.id
                  ? "bg-white text-black"
                  : "text-white/40 hover:text-white hover:bg-white/10"
                  }`}
              >
                <tab.icon className={`w-6 h-6 transition-transform duration-300 ${selectedTab === tab.id ? "scale-110" : "group-hover:scale-110"}`} />
                {selectedTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-black rounded-r-full"
                  />
                )}
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-6 h-6" />
          </Button>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black relative">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg mb-6 flex items-center justify-between z-50">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {error.includes("403")
                    ? "API Key Restricted: Your key does not have access to Valorant Match/Ranked data. You may need a Production Key."
                    : error}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-24 border-b border-white/10 flex items-center justify-between px-10 bg-black/90 backdrop-blur-md shrink-0 z-20 relative"
            onMouseDown={() => {
              const ow = (window as any).overwolf
              if (!ow) return
              try {
                ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                  if (res?.success && res.window?.id) {
                    ow.windows.dragMove(res.window.id)
                  }
                })
              } catch { }
            }}
          >
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center shadow-2xl border border-white/10">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-4 border-black" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold tracking-tight text-white">{riotId.split('#')[0]}</span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-mono text-white/60">#{riotId.split('#')[1]}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <Badge className="bg-white text-black border-0 text-xs font-bold h-6 px-3 rounded-md shadow-lg shadow-white/10">
                    {stats.currentRank}
                  </Badge>
                  <span className="text-white/40 text-xs font-medium tracking-wider">{stats.rr}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button className="bg-white text-black hover:bg-gray-200 h-10 px-8 font-bold text-sm rounded-lg shadow-lg shadow-white/5 transition-all duration-200 hover:scale-105 active:scale-95">
                Start Coaching
              </Button>
              <div className="h-8 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200"
                  onClick={() => {
                    const ow = (window as any).overwolf
                    if (!ow) return
                    try {
                      ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                        if (res?.success && res.window?.id) {
                          ow.windows.minimize(res.window.id)
                        }
                      })
                    } catch { }
                  }}
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200"
                  onClick={() => {
                    const ow = (window as any).overwolf
                    if (!ow) return
                    try {
                      ow.windows.obtainDeclaredWindow('desktop', (res: any) => {
                        if (res?.success && res.window?.id) {
                          ow.windows.hide(res.window.id)
                        }
                      })
                    } catch { }
                  }}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Content Area */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <div
              className={`flex-1 ${selectedTab === "guides" ? "overflow-hidden" : "overflow-y-auto no-scrollbar scroll-smooth"}`}
              ref={contentRef}
            >
              <AnimatePresence mode="wait">
                {selectedTab === "home" && (
                  <motion.div
                    key="home"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="p-8 pb-24 space-y-8"
                  >
                    <section>
                      <div className="grid grid-cols-4 gap-5">
                        {[
                          { label: "Win Rate", value: stats.winRate, icon: Trophy, trend: "up", color: "text-white" },
                          { label: "K/D Ratio", value: stats.kd, icon: Target, trend: "up", color: "text-white" },
                          { label: "Headshot %", value: stats.hs, icon: Crosshair, trend: "down", color: "text-white/60" },
                          { label: "Avg ACS", value: stats.acs, icon: Activity, trend: "up", color: "text-white" }
                        ].map((stat, i) => (
                          <motion.div key={i} variants={itemVariants}>
                            <Card className="relative p-6 glass-card rounded-2xl overflow-hidden group cursor-default transition-all duration-300 hover:-translate-y-1 bg-white/5 border-white/10">
                              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                                <stat.icon className="w-16 h-16 text-white" />
                              </div>
                              <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
                                  <stat.icon className="w-5 h-5 text-white" />
                                </div>
                                {stat.trend === "up" ? (
                                  <TrendingUp className={`w-4 h-4 ${stat.color}`} />
                                ) : (
                                  <TrendingDown className={`w-4 h-4 ${stat.color}`} />
                                )}
                              </div>
                              <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">{stat.label}</div>
                              <div className="text-3xl font-black text-white tracking-tight">{stat.value}</div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="grid grid-cols-3 gap-6">
                        {/* AI Insights */}
                        <motion.div variants={itemVariants} className="col-span-2">
                          <Card className="h-full p-8 glass-card rounded-2xl border border-white/10 bg-white/5">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-lg font-bold uppercase tracking-wide text-white flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/10">
                                  <Brain className="w-5 h-5 text-white" />
                                </div>
                                AI Coach Insights
                              </h3>
                              <Badge className="bg-white/5 text-white/60 hover:bg-white/10 border-0 text-[10px] font-bold h-6 px-3 rounded-lg tracking-wide">LAST 20 GAMES</Badge>
                            </div>

                            <Tabs value={selectedSubTab} onValueChange={setSelectedSubTab} className="w-full">
                              <TabsList className="w-full grid grid-cols-3 h-12 bg-black/40 border border-white/5 rounded-xl p-1 mb-6">
                                {["overview", "strengths", "improve"].map((tab) => (
                                  <TabsTrigger
                                    key={tab}
                                    value={tab}
                                    className="text-xs font-bold text-white/40 uppercase tracking-wider data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-lg transition-all duration-200"
                                  >
                                    {tab}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              <TabsContent value="overview" className="space-y-6">
                                <div className="p-6 rounded-xl bg-white/5 border border-white/5">
                                  <div className="flex justify-between items-end mb-4">
                                    <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Performance Score</div>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-4xl font-black text-white">8.2</span>
                                      <span className="text-sm font-bold text-white/40">/ 10</span>
                                    </div>
                                  </div>
                                  <Progress value={82} className="h-2 bg-black/40" indicatorClassName="bg-white" />

                                  <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                      <div className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Focus Area</div>
                                      <div className="text-sm font-medium text-white/90">Consistency and utility usage</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                      <div className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Next Step</div>
                                      <div className="text-sm font-medium text-white/90">Improve economy decisions</div>
                                    </div>
                                  </div>
                                </div>
                              </TabsContent>

                              {/* Add other tab contents similarly if needed, keeping it simple for now */}
                              <TabsContent value="strengths" className="text-white/60 text-sm p-4">
                                Analysis of your strengths goes here...
                              </TabsContent>
                              <TabsContent value="improve" className="text-white/60 text-sm p-4">
                                {aiAnalysis ? (
                                  <div className="whitespace-pre-wrap">{aiAnalysis}</div>
                                ) : (
                                  "Analyzing match history..."
                                )}
                              </TabsContent>
                            </Tabs>
                          </Card>
                        </motion.div>

                        {/* Recent Matches Sidebar */}
                        <motion.div variants={itemVariants} className="col-span-1">
                          <Card className="h-full p-6 glass-card rounded-2xl border border-white/10 bg-white/5 flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
                                <History className="w-4 h-4 text-white/60" />
                                Recent Matches
                              </h3>
                              <ChevronRight
                                className="w-4 h-4 text-white/40 hover:text-white transition-colors cursor-pointer"
                                onClick={() => setSelectedTab("stats")}
                              />
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-2">
                              {recentMatches.map((match, i) => (
                                <motion.div
                                  key={i}
                                  whileHover={{ scale: 1.02, x: 4 }}
                                  className={`group p-4 rounded-xl border transition-all duration-200 cursor-pointer ${match.result === "win"
                                    ? "bg-white/10 border-white/10 hover:bg-white/20"
                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                                    }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-sm">{match.map}</span>
                                      {match.mvp && (<Badge className="bg-white text-black border-0 text-[9px] px-1.5 h-4">MVP</Badge>)}
                                    </div>
                                    <span className={`text-sm font-bold ${match.result === "win" ? "text-white" : "text-white/40"}`}>{match.score}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                                        {AGENT_ASSETS[match.agent] ? (
                                          <img
                                            src={AGENT_ASSETS[match.agent].displayIcon}
                                            alt={match.agent}
                                            className="w-full h-full object-cover scale-125 translate-y-1"
                                          />
                                        ) : (
                                          <span className="text-[10px] font-bold text-white/80">{match.agent[0]}</span>
                                        )}
                                      </div>
                                      <span className="text-xs text-white/60">{match.agent}</span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-white/80">{match.kda}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </Card>
                        </motion.div>
                      </div>
                    </section>

                    <section className="mb-8" ref={topAgentsRef}>
                      <motion.div variants={itemVariants}>
                        <Card className="p-8 glass-card rounded-2xl border border-white/10 bg-white/5">
                          <h3 className="text-lg font-bold uppercase tracking-wide mb-6 text-white flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/10">
                              <Award className="w-5 h-5 text-white" />
                            </div>
                            Top Agents
                          </h3>
                          <div className="grid grid-cols-5 gap-4">
                            {agentStats.slice(0, 5).map((agent, i) => (
                              <motion.div
                                key={i}
                                whileHover={{ y: -4 }}
                                className="p-5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group"
                              >
                                <div className="text-lg font-black text-white mb-4">{agent.agent}</div>
                                <div className="space-y-3">
                                  <div className="flex justify-between text-xs items-center">
                                    <span className="text-white/40 font-medium">Win Rate</span>
                                    <span className="text-white font-bold">{agent.wr}</span>
                                  </div>
                                  <div className="flex justify-between text-xs items-center">
                                    <span className="text-white/40 font-medium">K/D</span>
                                    <span className="text-white font-bold">{agent.kd}</span>
                                  </div>
                                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-2">
                                    <div className="h-full bg-white/40 group-hover:bg-white transition-colors" style={{ width: agent.wr }} />
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                      </motion.div>
                    </section>
                  </motion.div>
                )}

                {selectedTab === "agents" && (
                  <motion.div
                    key="agents"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full overflow-y-auto p-8"
                  >
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-6">
                      {AGENT_LIST.map(agent => (
                        <AgentCard
                          key={agent.uuid}
                          agent={agent}
                          onClick={(a) => {
                            window.open(`https://valorant.fandom.com/wiki/${agent.displayName}`, '_blank')
                          }}
                          className="aspect-square shadow-xl"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {selectedTab === "guides" && (
                  <motion.div
                    key="guides"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full flex flex-col"
                  >
                    <AICoachView
                      history={chatHistory}
                      isQueryLoading={isQueryLoading}
                      onSendMessage={handleSendMessage}
                      onNewChat={handleNewChat}
                      exampleQuestions={exampleQuestions}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {settingsOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <DesktopSettingsPanel
              diagnostics={diagnostics}
              diagnosticsRunning={diagnosticsRunning}
              onRunDiagnostics={handleRunDiagnostics}
            />
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DesktopApp
