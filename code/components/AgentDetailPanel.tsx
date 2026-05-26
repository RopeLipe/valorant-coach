import React from "react"
import { motion } from "framer-motion"
import { X, Shield, Crosshair, HelpCircle, AlertCircle, Sparkles } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { AgentAsset } from "../../src/utils/agentAssets"

interface AgentDetailPanelProps {
  agent: AgentAsset | null
  isOpen: boolean
  onClose: () => void
}

// Custom curated AI coaching tips for agents (including custom agents)
const CUSTOM_COACH_TIPS: Record<string, string[]> = {
  Veto: [
    "Place the Interceptor trap slightly elevated to avoid ground spam detours.",
    "Chokehold traps work best on drop-offs where enemies cannot slow down easily.",
    "Use your Evolution ultimate when the enemy is fully committed to a site retake."
  ],
  Tejo: [
    "Guided Salvo can clear back-site corners without exposing you to angles.",
    "Launch the Stealth Drone from safety and coordinate with a duelist's push.",
    "Armageddon is perfect for denying plant or defusal, covering a massive area."
  ],
  Waylay: [
    "Activate Refract right before taking mid-fights to absorb initial shots.",
    "Throw Saturate grenade high to cover standard escape pathings.",
    "Lightspeed dashes should be used to clear utility zones rapidly."
  ],
  Jett: [
    "Tailwind is your primary escape option; play off-angles and dash to cover instantly.",
    "Combine Updraft with Blade Storm to gain vertical sights over Sage walls or boxes.",
    "Cloudburst smokes last only a few seconds, use them purely to cross chokes or create temporary visual cover."
  ],
  Reyna: [
    "Devour requires line of sight to the soul orb; make sure you aren't exposed to trade fires.",
    "Dismiss allows you to scout site positions safely after securing an entry kill.",
    "Empress increases reload and fire rate significantly; take aggressive engagements."
  ],
  Cypher: [
    "Vary your Trapwire placements each round to keep the enemy guessing and avoid easy clears.",
    "Spycam should be placed on high, hidden structures to maintain sightlines post-plant.",
    "Cyber Cages can be activated through walls; use them to isolate fights or hide trap activations."
  ],
  Sage: [
    "Barrier Orb is perfect for blocking chokes or allowing safe defuses, but don't waste it in the first 5 seconds.",
    "Slow Orbs can halt fast rushes; combine them with damage utility from teammates.",
    "Your Healing Orb is a high-value tool, prioritize teammates who have active ultimates or high combat presence."
  ]
}

export default function AgentDetailPanel({ agent, isOpen, onClose }: AgentDetailPanelProps) {
  if (!agent) return null

  // Get tips or fallback to general tips
  const tips = CUSTOM_COACH_TIPS[agent.displayName] || [
    `Leverage your role as a ${agent.role} to coordinate executes.`,
    "Coordinate utility usage with your team's primary duelists/initiators.",
    "Communicate when your ultimate is ready to maximize execution timing."
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Translucent Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black backdrop-blur-sm cursor-pointer"
      />

      {/* Slide-out Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md h-full bg-[#050505] border-l border-white/10 shadow-2xl flex flex-col z-10 text-white"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/40 uppercase font-bold tracking-wider">Agent Dossier</span>
            <Badge className="bg-white/10 text-white/80 border-none font-mono text-[9px]">VITE_VERIFIED</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          {/* Agent Banner */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 overflow-hidden flex flex-col items-center text-center">
            {/* Agent portrait behind / icon */}
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center mb-4 relative group">
              <img
                src={agent.displayIcon}
                alt={agent.displayName}
                className="w-full h-full object-cover scale-110"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/80" />
              </div>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-tight font-sans text-white">{agent.displayName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/40 font-mono">Developer Name: {agent.developerName}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <Badge className="bg-white text-black border-none text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                {agent.role}
              </Badge>
            </div>

            {agent.background && (
              <div className="absolute -bottom-16 -right-16 w-32 h-32 opacity-[0.03] pointer-events-none select-none">
                <img src={agent.background} alt="" className="w-full h-full object-contain" />
              </div>
            )}
          </div>

          {/* AI Coach Tips Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              AI Coach Strategic Tips
            </h3>
            <div className="space-y-3">
              {tips.map((tip, idx) => (
                <div key={idx} className="flex gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-xl text-xs leading-relaxed text-white/80 hover:bg-white/[0.05] transition-all duration-200">
                  <span className="text-white/40 font-mono font-bold">0{idx + 1}.</span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Abilities Section */}
          {agent.abilities && agent.abilities.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Signature Abilities</h3>
              <div className="space-y-3">
                {agent.abilities.map((ability, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-white/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 p-1 flex items-center justify-center overflow-hidden">
                        {ability.displayIcon ? (
                          <img
                            src={ability.displayIcon}
                            alt={ability.displayName}
                            className="w-full h-full object-contain invert"
                          />
                        ) : (
                          <HelpCircle className="w-5 h-5 text-white/30" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white">{ability.displayName}</span>
                        <span className="text-[9px] font-mono text-white/40 uppercase">{ability.slot}</span>
                      </div>
                    </div>
                    <Badge className="bg-white/5 hover:bg-white/5 border border-white/10 text-white/60 font-mono text-[9px]">
                      Slot {idx + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Riot Disclaimer */}
        <div className="p-6 border-t border-white/10 bg-black/60 text-center">
          <p className="text-[9px] text-white/30 leading-relaxed font-sans">
            Owned isn't endorsed by Riot Games. Agent designs and trademarks are property of Riot Games, Inc.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
