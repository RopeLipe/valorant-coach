/**
 * Prediction Engine Service
 * Tracks enemy patterns across rounds and persists data per match.
 */

import { getAgentName } from '../src/utils/agentMapping'
import {
    runAdvancedAnalysis,
    type AdvancedPatternAnalysis,
    type AgentPattern,
    type EconomyPrediction,
    type TimingPattern
} from './advancedPatternDetection'

// Re-export advanced types for consumers
export type {
    AdvancedPatternAnalysis,
    AgentPattern,
    EconomyPrediction,
    TimingPattern
}

// ============ TYPES ============

export interface RoundData {
    round: number
    site: 'A' | 'B' | 'C' | null
    enemyFirstKill: string | null  // Agent who got first kill
    aggressivePlay: boolean
    ultsUsed: string[]  // Agent names who used ults
    userNote: string  // From round-end voice question
    outcome: 'win' | 'loss' | 'unknown'
    plantedSite: string | null
}

export interface MatchData {
    matchId: string
    map: string
    startTime: number
    rounds: RoundData[]
    enemyTeam: string[]  // Agent names
}

export interface PatternAnalysis {
    sitePreference: { A: number; B: number; C: number }
    aggressionRate: number  // 0-1
    avgUltsPerRound: number
    commonFirstKillers: string[]
    summary: string
}

// ============ STORAGE ============

const STORAGE_KEY_PREFIX = 'valorant_coach_match_'
const CURRENT_MATCH_KEY = 'valorant_coach_current_match'

function getStorageKey(matchId: string): string {
    return `${STORAGE_KEY_PREFIX}${matchId}`
}

// ============ STATE ============

let currentMatch: MatchData | null = null

// ============ CORE FUNCTIONS ============

/**
 * Initialize a new match
 */
export function initMatch(matchId: string, map: string, enemyTeam: string[]): void {
    // Check if resuming existing match
    const existing = loadMatch(matchId)
    if (existing) {
        currentMatch = existing
        // Opportunistically merge any newly-observed enemies into the roster
        // so resumed matches still benefit from later scoreboard arrivals.
        refreshEnemyTeam(enemyTeam)
        console.log('[PredictionEngine] Resumed match:', matchId)
        return
    }

    currentMatch = {
        matchId,
        map,
        startTime: Date.now(),
        rounds: [],
        enemyTeam: enemyTeam.map(id => getAgentName(id)).filter(Boolean)
    }

    saveCurrentMatch()
    localStorage.setItem(CURRENT_MATCH_KEY, matchId)
    console.log('[PredictionEngine] Initialized match:', matchId, 'on', map)
}

/**
 * Grow-only enemy roster update. The scoreboard frequently arrives partial
 * (GEP batches 1–3 players at a time) so the initial snapshot may be missing
 * agents. Call this whenever fresh scoreboard data arrives — we only add
 * new distinct agents, never drop (so an agent who briefly vanishes from a
 * partial update is not erased).
 */
export function refreshEnemyTeam(agents: string[]): void {
    if (!currentMatch) return
    const mapped = agents.map(a => getAgentName(a)).filter(Boolean)
    let changed = false
    for (const a of mapped) {
        if (!currentMatch.enemyTeam.includes(a)) {
            currentMatch.enemyTeam.push(a)
            changed = true
        }
    }
    if (changed) {
        // Cap at 5 to stop mid-match agent swaps from ballooning the list.
        if (currentMatch.enemyTeam.length > 5) {
            currentMatch.enemyTeam = currentMatch.enemyTeam.slice(0, 5)
        }
        saveCurrentMatch()
    }
}

/**
 * Record data for a completed round
 */
export function recordRound(data: Partial<RoundData>): void {
    if (!currentMatch) {
        console.warn('[PredictionEngine] No active match to record round')
        return
    }

    const roundNumber = data.round ?? currentMatch.rounds.length + 1

    // Check if round already exists (update) or new
    const existingIndex = currentMatch.rounds.findIndex(r => r.round === roundNumber)

    const roundData: RoundData = {
        round: roundNumber,
        site: data.site ?? null,
        enemyFirstKill: data.enemyFirstKill ?? null,
        aggressivePlay: data.aggressivePlay ?? false,
        ultsUsed: data.ultsUsed ?? [],
        userNote: data.userNote ?? '',
        outcome: data.outcome ?? 'unknown',
        plantedSite: data.plantedSite ?? null
    }

    if (existingIndex >= 0) {
        // Merge with existing data
        currentMatch.rounds[existingIndex] = {
            ...currentMatch.rounds[existingIndex],
            ...roundData
        }
    } else {
        currentMatch.rounds.push(roundData)
    }

    saveCurrentMatch()
    console.log('[PredictionEngine] Recorded round', roundNumber)
}

/**
 * Add user note to current/last round
 */
export function addUserNote(note: string, roundNumber?: number): void {
    if (!currentMatch) return

    const round = roundNumber
        ? currentMatch.rounds.find(r => r.round === roundNumber)
        : currentMatch.rounds[currentMatch.rounds.length - 1]

    if (round) {
        round.userNote = note
        saveCurrentMatch()
    }
}

/**
 * Analyze patterns from recorded rounds
 */
export function analyzePatterns(): PatternAnalysis {
    if (!currentMatch || currentMatch.rounds.length === 0) {
        return {
            sitePreference: { A: 0, B: 0, C: 0 },
            aggressionRate: 0,
            avgUltsPerRound: 0,
            commonFirstKillers: [],
            summary: 'Not enough data yet.'
        }
    }

    const rounds = currentMatch.rounds
    const siteCount = { A: 0, B: 0, C: 0 }
    let aggressiveCount = 0
    let totalUlts = 0
    const firstKillers: Record<string, number> = {}

    for (const r of rounds) {
        // Site preference — dedup the two equivalent fields. Callers set both
        // `site` and `plantedSite` to the same value for plant-confirmed rounds,
        // so counting both double-weighted every plant. Prefer `site` when
        // present, fall back to `plantedSite` only when `site` is null.
        const siteSource = r.site || (r.plantedSite && ['A', 'B', 'C'].includes(r.plantedSite)
            ? (r.plantedSite as 'A' | 'B' | 'C')
            : null)
        if (siteSource) siteCount[siteSource]++

        // Aggression
        if (r.aggressivePlay) aggressiveCount++

        // Ults
        totalUlts += r.ultsUsed.length

        // First killers
        if (r.enemyFirstKill) {
            firstKillers[r.enemyFirstKill] = (firstKillers[r.enemyFirstKill] || 0) + 1
        }
    }

    const total = rounds.length
    const sitePreference = {
        A: Math.round((siteCount.A / total) * 100),
        B: Math.round((siteCount.B / total) * 100),
        C: Math.round((siteCount.C / total) * 100)
    }
    const aggressionRate = aggressiveCount / total
    const avgUltsPerRound = totalUlts / total

    // Top first killers
    const sortedKillers = Object.entries(firstKillers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([agent]) => agent)

    // Generate summary
    const summaryParts: string[] = []

    const maxSite = Object.entries(sitePreference).sort((a, b) => b[1] - a[1])[0]
    if (maxSite[1] > 40) {
        summaryParts.push(`Enemies favor ${maxSite[0]} site (${maxSite[1]}%)`)
    }

    if (aggressionRate > 0.6) {
        summaryParts.push('Enemies play aggressive/rush style')
    } else if (aggressionRate < 0.3) {
        summaryParts.push('Enemies play passive/default')
    }

    if (sortedKillers.length > 0) {
        summaryParts.push(`Watch for ${sortedKillers[0]} - often gets first kill`)
    }

    return {
        sitePreference,
        aggressionRate,
        avgUltsPerRound,
        commonFirstKillers: sortedKillers,
        summary: summaryParts.join('. ') || 'Building pattern data...'
    }
}

/**
 * Get pattern summary for AI context
 */
export function getPatternSummary(): string {
    const advanced = getAdvancedAnalysis()
    if (!currentMatch || currentMatch.rounds.length < 2) {
        return ''
    }

    const lines = [
        `[Enemy Pattern Analysis - ${currentMatch.rounds.length} rounds played]`,
        advanced.summary
    ]

    // Economy prediction
    if (advanced.economyPrediction.confidence > 0.4) {
        lines.push(`Economy: ${advanced.economyPrediction.likelyBuyType.toUpperCase()} (${Math.round(advanced.economyPrediction.confidence * 100)}% conf)`)
        if (advanced.economyPrediction.opWarning) {
            lines.push('⚠️ OP LIKELY')
        }
    }

    // Timing tendency
    if (advanced.timingPattern.tendency !== 'mixed') {
        lines.push(`Timing: ${advanced.timingPattern.tendency} executes (~${advanced.timingPattern.avgExecuteTimeSeconds}s avg)`)
    }

    // Tactical prediction — only surface when we have genuine confidence.
    // confidenceScore ≥ 0.5 corresponds to ≥4 rounds with known outcomes
    // under the new gating in runAdvancedAnalysis.
    if (advanced.predictedNextPlay && advanced.confidenceScore >= 0.5) {
        lines.push(`Prediction: ${advanced.predictedNextPlay}`)
    }

    // Add user notes if any
    const recentNotes = currentMatch.rounds
        .filter(r => r.userNote)
        .slice(-3)
        .map(r => `R${r.round}: ${r.userNote}`)

    if (recentNotes.length > 0) {
        lines.push('Notes: ' + recentNotes.join('; '))
    }

    return lines.join('\n')
}

/**
 * Get full advanced pattern analysis
 */
export function getAdvancedAnalysis(): AdvancedPatternAnalysis {
    return runAdvancedAnalysis(currentMatch)
}

/**
 * Get current match data
 */
export function getCurrentMatch(): MatchData | null {
    return currentMatch
}

/**
 * Clear current match
 */
export function clearMatch(): void {
    if (currentMatch) {
        localStorage.removeItem(getStorageKey(currentMatch.matchId))
    }
    localStorage.removeItem(CURRENT_MATCH_KEY)
    currentMatch = null
}

// ============ PERSISTENCE ============

function saveCurrentMatch(): void {
    if (!currentMatch) return
    try {
        localStorage.setItem(
            getStorageKey(currentMatch.matchId),
            JSON.stringify(currentMatch)
        )
    } catch (e) {
        console.error('[PredictionEngine] Failed to save match:', e)
    }
}

function loadMatch(matchId: string): MatchData | null {
    try {
        const data = localStorage.getItem(getStorageKey(matchId))
        if (data) {
            return JSON.parse(data)
        }
    } catch (e) {
        console.error('[PredictionEngine] Failed to load match:', e)
    }
    return null
}

/**
 * Resume current match on app start
 */
export function resumeCurrentMatch(): boolean {
    try {
        const matchId = localStorage.getItem(CURRENT_MATCH_KEY)
        if (matchId) {
            const match = loadMatch(matchId)
            if (match) {
                currentMatch = match
                console.log('[PredictionEngine] Resumed match from storage:', matchId)
                return true
            }
        }
    } catch (e) {
        console.error('[PredictionEngine] Failed to resume match:', e)
    }
    return false
}
