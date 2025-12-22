/**
 * Prediction Engine Service
 * Tracks enemy patterns across rounds and persists data per match.
 */

import { getAgentName } from '../src/utils/agentMapping'

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
        console.log('[PredictionEngine] Resumed match:', matchId)
        return
    }

    currentMatch = {
        matchId,
        map,
        startTime: Date.now(),
        rounds: [],
        enemyTeam: enemyTeam.map(id => getAgentName(id))
    }

    saveCurrentMatch()
    localStorage.setItem(CURRENT_MATCH_KEY, matchId)
    console.log('[PredictionEngine] Initialized match:', matchId, 'on', map)
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
        // Site preference
        if (r.site) siteCount[r.site]++
        if (r.plantedSite && ['A', 'B', 'C'].includes(r.plantedSite)) {
            siteCount[r.plantedSite as 'A' | 'B' | 'C']++
        }

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
    const analysis = analyzePatterns()
    if (!currentMatch || currentMatch.rounds.length < 2) {
        return ''
    }

    const lines = [
        `[Enemy Pattern Analysis - ${currentMatch.rounds.length} rounds played]`,
        analysis.summary
    ]

    // Add user notes if any
    const recentNotes = currentMatch.rounds
        .filter(r => r.userNote)
        .slice(-3)
        .map(r => `R${r.round}: ${r.userNote}`)

    if (recentNotes.length > 0) {
        lines.push('Recent observations: ' + recentNotes.join('; '))
    }

    return lines.join('\n')
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
