/**
 * Advanced Pattern Detection Module
 * Provides sophisticated analysis algorithms for enemy behavior prediction.
 */

import type { RoundData, MatchData } from './predictionEngine'

// ============ TYPES ============

export interface AgentPattern {
    agent: string
    firstKillRate: number           // 0-1, percentage of rounds this agent gets opening kill
    ultUsageRounds: number[]        // Round numbers where ult was used
    preferredSites: ('A' | 'B' | 'C')[]
    playstyle: 'entry' | 'lurk' | 'anchor' | 'support' | 'flex' | 'unknown'
    deathPositions: string[]        // Common death locations (for future vision)
}

export interface EconomyPrediction {
    likelyBuyType: 'full' | 'force' | 'half' | 'eco' | 'save'
    confidence: number              // 0-1
    opWarning: boolean              // True if enemies likely have Operator
    rifleCount: number              // Estimated rifles on enemy team
    reasoning: string
}

export interface TimingPattern {
    avgExecuteTimeSeconds: number   // Average seconds after round start for site take
    rushFrequency: number           // 0-1, % of rounds with sub-25s execute
    defaultFrequency: number        // 0-1, % of rounds with 45s+ execute
    splitFrequency: number          // 0-1, % of rounds with split execute
    tendency: 'fast' | 'slow' | 'mixed'
}

export interface AdvancedPatternAnalysis {
    // Core stats (from base PatternAnalysis)
    sitePreference: { A: number; B: number; C: number }
    aggressionRate: number
    avgUltsPerRound: number
    commonFirstKillers: string[]

    // New advanced analysis
    agentPatterns: AgentPattern[]
    economyPrediction: EconomyPrediction
    timingPattern: TimingPattern
    confidenceScore: number         // 0-1, overall prediction reliability
    predictedNextPlay: string       // Natural language tactical prediction

    // NEW: Map-aware site patterns
    mapSitePattern: {
        map: string
        dominantSite: 'A' | 'B' | 'C' | null
        siteExecuteStyle: Record<string, 'rush' | 'default' | 'split' | 'unknown'>
    }

    // NEW: Round type context
    roundType: 'pistol' | 'anti_eco' | 'eco' | 'gun_round' | 'force'
    roundTypeAdvice: string

    // NEW: Loss streak behavior
    lossStreakBehavior: {
        currentStreak: number
        behaviorShift: 'tilting_aggressive' | 'playing_scared' | 'normal'
        baselineAggression: number
        currentAggression: number
    }

    summary: string
}

// ============ ECONOMY PREDICTION ============

const ECONOMY_CONSTANTS = {
    WIN_BONUS: 3000,
    LOSS_BASE: 1900,
    LOSS_STREAK_BONUS: 500,
    MAX_LOSS_STREAK_BONUS: 2900,    // Total at 5 losses
    KILL_REWARD: 200,
    PLANT_REWARD: 300,
    FULL_BUY_THRESHOLD: 3900,
    FORCE_BUY_THRESHOLD: 2500,
    HALF_BUY_THRESHOLD: 2000,
    ECO_THRESHOLD: 1500,
    OP_COST: 4700,
    RIFLE_COST: 2900,
}

/**
 * Predict enemy economy state for the next round
 */
export function predictEnemyEconomy(
    rounds: RoundData[],
    currentRound: number,
    enemyTeamSize: number = 5
): EconomyPrediction {
    if (rounds.length < 2) {
        return {
            likelyBuyType: 'full',
            confidence: 0.3,
            opWarning: false,
            rifleCount: 0,
            reasoning: 'Insufficient data for economy prediction'
        }
    }

    // Track enemy economy state
    let estimatedTeamCredits = 0
    let lossStreak = 0
    let lastEnemyWin = false

    // Walk through round history to estimate current economy
    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i]
        const roundNum = round.round

        // Reset on pistol rounds
        if (roundNum === 1 || roundNum === 13) {
            estimatedTeamCredits = 800 * enemyTeamSize
            lossStreak = 0
            continue
        }

        // Enemy perspective: our loss = their win
        const enemyWon = round.outcome === 'loss'

        if (enemyWon) {
            estimatedTeamCredits += ECONOMY_CONSTANTS.WIN_BONUS * enemyTeamSize
            lossStreak = 0
            lastEnemyWin = true
        } else {
            const lossBonus = Math.min(
                ECONOMY_CONSTANTS.LOSS_BASE + (lossStreak * ECONOMY_CONSTANTS.LOSS_STREAK_BONUS),
                ECONOMY_CONSTANTS.MAX_LOSS_STREAK_BONUS
            )
            estimatedTeamCredits += lossBonus * enemyTeamSize
            lossStreak++
            lastEnemyWin = false
        }

        // Subtract estimated spending (rough: assume full buy when they can)
        if (estimatedTeamCredits >= ECONOMY_CONSTANTS.FULL_BUY_THRESHOLD * enemyTeamSize) {
            estimatedTeamCredits -= (ECONOMY_CONSTANTS.RIFLE_COST + 1000) * enemyTeamSize
        }
    }

    const avgCredits = estimatedTeamCredits / enemyTeamSize

    // Determine buy type
    let likelyBuyType: EconomyPrediction['likelyBuyType']
    let confidence = 0.5
    let reasoning = ''

    if (avgCredits >= ECONOMY_CONSTANTS.FULL_BUY_THRESHOLD) {
        likelyBuyType = 'full'
        confidence = 0.75
        reasoning = `Estimated ${Math.round(avgCredits)} credits avg - expect full buy`
    } else if (avgCredits >= ECONOMY_CONSTANTS.FORCE_BUY_THRESHOLD) {
        // Check if they might force after loss
        if (!lastEnemyWin && lossStreak >= 2) {
            likelyBuyType = 'force'
            confidence = 0.6
            reasoning = `${lossStreak} loss streak, may force to break economy cycle`
        } else {
            likelyBuyType = 'half'
            confidence = 0.55
            reasoning = `Mid economy (~${Math.round(avgCredits)}) - likely half-buy or light force`
        }
    } else if (avgCredits >= ECONOMY_CONSTANTS.ECO_THRESHOLD) {
        likelyBuyType = 'eco'
        confidence = 0.65
        reasoning = `Low economy - expect eco with possible upgrades`
    } else {
        likelyBuyType = 'save'
        confidence = 0.7
        reasoning = `Very low credits - full save expected`
    }

    // OP warning: check if they could have saved for it
    const opWarning = avgCredits >= ECONOMY_CONSTANTS.OP_COST && lastEnemyWin
    const rifleCount = likelyBuyType === 'full' ? 5 :
        likelyBuyType === 'force' ? 3 :
            likelyBuyType === 'half' ? 2 : 0

    if (opWarning) {
        reasoning += ' | ⚠️ OP likely in play'
    }

    return {
        likelyBuyType,
        confidence,
        opWarning,
        rifleCount,
        reasoning
    }
}

// ============ AGENT TENDENCY ANALYSIS ============

/**
 * Analyze individual agent patterns from round history
 */
export function analyzeAgentTendencies(
    rounds: RoundData[],
    enemyTeam: string[]
): AgentPattern[] {
    const patterns: Map<string, {
        firstKills: number
        totalRounds: number
        ultRounds: number[]
        sites: ('A' | 'B' | 'C')[]
    }> = new Map()

    // Initialize patterns for each enemy agent
    for (const agent of enemyTeam) {
        patterns.set(agent, {
            firstKills: 0,
            totalRounds: 0,
            ultRounds: [],
            sites: []
        })
    }

    // Process each round
    for (const round of rounds) {
        // Track first kills
        if (round.enemyFirstKill && patterns.has(round.enemyFirstKill)) {
            const p = patterns.get(round.enemyFirstKill)!
            p.firstKills++
        }

        // Track ult usage
        for (const agent of round.ultsUsed) {
            if (patterns.has(agent)) {
                patterns.get(agent)!.ultRounds.push(round.round)
            }
        }

        // Track site preference (from plant site)
        if (round.plantedSite && ['A', 'B', 'C'].includes(round.plantedSite)) {
            // Associate with likely entry fraggers - simplified heuristic
            for (const agent of enemyTeam) {
                patterns.get(agent)!.sites.push(round.plantedSite as 'A' | 'B' | 'C')
            }
        }

        // Increment round count for all agents
        for (const agent of enemyTeam) {
            patterns.get(agent)!.totalRounds++
        }
    }

    // Convert to AgentPattern array
    const result: AgentPattern[] = []

    for (const [agent, data] of patterns) {
        const firstKillRate = data.totalRounds > 0
            ? data.firstKills / data.totalRounds
            : 0

        // Determine playstyle from agent type (simplified mapping)
        const playstyle = inferPlaystyle(agent, firstKillRate)

        // Find most common sites
        const siteCounts = { A: 0, B: 0, C: 0 }
        for (const site of data.sites) {
            siteCounts[site]++
        }
        const preferredSites = (Object.entries(siteCounts) as [('A' | 'B' | 'C'), number][])
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([site]) => site)

        result.push({
            agent,
            firstKillRate,
            ultUsageRounds: data.ultRounds,
            preferredSites,
            playstyle,
            deathPositions: []  // Reserved for future vision/heatmap
        })
    }

    return result.sort((a, b) => b.firstKillRate - a.firstKillRate)
}

/**
 * Infer playstyle from agent type and first-kill stats
 */
function inferPlaystyle(
    agent: string,
    firstKillRate: number
): AgentPattern['playstyle'] {
    const agentLower = agent.toLowerCase()

    // Duelists with high first-kill rate = entry
    const duelists = ['jett', 'reyna', 'phoenix', 'raze', 'neon', 'iso', 'yoru']
    if (duelists.includes(agentLower)) {
        return firstKillRate > 0.15 ? 'entry' : 'flex'
    }

    // Controllers typically anchor
    const controllers = ['omen', 'brimstone', 'viper', 'astra', 'harbor', 'clove']
    if (controllers.includes(agentLower)) {
        return 'anchor'
    }

    // Sentinels lurk or anchor
    const sentinels = ['cypher', 'killjoy', 'sage', 'chamber', 'deadlock', 'vyse']
    if (sentinels.includes(agentLower)) {
        return firstKillRate > 0.1 ? 'lurk' : 'anchor'
    }

    // Initiators support
    const initiators = ['sova', 'breach', 'skye', 'kayo', 'fade', 'gekko']
    if (initiators.includes(agentLower)) {
        return 'support'
    }

    return 'unknown'
}

// ============ TIMING PATTERN ANALYSIS ============

/**
 * Analyze round timing patterns from spike events
 */
export function analyzeTimingPatterns(rounds: RoundData[]): TimingPattern {
    if (rounds.length < 3) {
        return {
            avgExecuteTimeSeconds: 45,
            rushFrequency: 0.3,
            defaultFrequency: 0.3,
            splitFrequency: 0.2,
            tendency: 'mixed'
        }
    }

    // Without actual timestamps, we infer from aggression and site data
    const aggressiveRounds = rounds.filter(r => r.aggressivePlay).length
    const total = rounds.length

    const rushFrequency = aggressiveRounds / total
    const defaultFrequency = 1 - rushFrequency - 0.2  // Reserve some for split
    const splitFrequency = 0.2  // Placeholder - would need kill location data

    // Estimate average execute time
    const avgExecuteTimeSeconds = rushFrequency > 0.5 ? 25 :
        rushFrequency < 0.3 ? 55 : 40

    const tendency: TimingPattern['tendency'] =
        rushFrequency > 0.5 ? 'fast' :
            rushFrequency < 0.25 ? 'slow' : 'mixed'

    return {
        avgExecuteTimeSeconds,
        rushFrequency,
        defaultFrequency: Math.max(0, defaultFrequency),
        splitFrequency,
        tendency
    }
}

// ============ MAP-AWARE SITE ANALYSIS ============

const MAP_SITE_COUNT: Record<string, number> = {
    'haven': 3,
    'bind': 2,
    'split': 2,
    'ascent': 2,
    'icebox': 2,
    'breeze': 2,
    'fracture': 2,
    'pearl': 2,
    'lotus': 3,
    'sunset': 2,
    'abyss': 2,
    'corrode': 2
}

/**
 * Analyze site patterns specific to the current map
 */
export function analyzeMapSitePattern(
    rounds: RoundData[],
    map: string
): AdvancedPatternAnalysis['mapSitePattern'] {
    const mapLower = map.toLowerCase()
    const siteCount = { A: 0, B: 0, C: 0 }
    const siteStyles: Record<string, { rush: number; default: number; split: number }> = {
        A: { rush: 0, default: 0, split: 0 },
        B: { rush: 0, default: 0, split: 0 },
        C: { rush: 0, default: 0, split: 0 }
    }

    for (const r of rounds) {
        const site = r.site || r.plantedSite
        if (site && ['A', 'B', 'C'].includes(site)) {
            siteCount[site as 'A' | 'B' | 'C']++

            // Infer execute style from aggression
            if (r.aggressivePlay) {
                siteStyles[site].rush++
            } else {
                siteStyles[site].default++
            }
        }
    }

    // Find dominant site
    const total = siteCount.A + siteCount.B + siteCount.C
    let dominantSite: 'A' | 'B' | 'C' | null = null
    if (total > 0) {
        const entries = Object.entries(siteCount) as ['A' | 'B' | 'C', number][]
        const sorted = entries.sort((a, b) => b[1] - a[1])
        if (sorted[0][1] / total > 0.5) {
            dominantSite = sorted[0][0]
        }
    }

    // Determine execute style per site
    const siteExecuteStyle: Record<string, 'rush' | 'default' | 'split' | 'unknown'> = {}
    for (const site of ['A', 'B', 'C']) {
        const styles = siteStyles[site]
        const siteTotal = styles.rush + styles.default + styles.split
        if (siteTotal === 0) {
            siteExecuteStyle[site] = 'unknown'
        } else if (styles.rush / siteTotal > 0.6) {
            siteExecuteStyle[site] = 'rush'
        } else if (styles.default / siteTotal > 0.6) {
            siteExecuteStyle[site] = 'default'
        } else {
            siteExecuteStyle[site] = 'split'
        }
    }

    return {
        map: mapLower,
        dominantSite,
        siteExecuteStyle
    }
}

// ============ ROUND TYPE AWARENESS ============

/**
 * Determine the round type for tactical context
 */
export function determineRoundType(
    currentRound: number,
    economyPrediction: EconomyPrediction
): { type: AdvancedPatternAnalysis['roundType']; advice: string } {
    // Pistol rounds
    if (currentRound === 1 || currentRound === 13) {
        return {
            type: 'pistol',
            advice: 'Pistol round: Aim for heads, play for trades, utility is key'
        }
    }

    // Post-pistol / Anti-eco
    if (currentRound === 2 || currentRound === 3 || currentRound === 14 || currentRound === 15) {
        if (economyPrediction.likelyBuyType === 'eco' || economyPrediction.likelyBuyType === 'save') {
            return {
                type: 'anti_eco',
                advice: 'Anti-eco: Expect Spectres/Sheriffs, don\'t overpeek or give away weapons'
            }
        }
    }

    // Based on economy prediction
    switch (economyPrediction.likelyBuyType) {
        case 'full':
            return {
                type: 'gun_round',
                advice: 'Full buy round: Play fundamentals, trade kills, use utility'
            }
        case 'force':
            return {
                type: 'force',
                advice: 'Force buy: Enemies may have mixed loadouts, target players with weak guns'
            }
        case 'half':
            return {
                type: 'force',
                advice: 'Half-buy: Expect SMGs and light armor, play close angles'
            }
        case 'eco':
        case 'save':
            return {
                type: 'eco',
                advice: 'Eco round: Play for picks, don\'t feed weapons, stack a site'
            }
        default:
            return {
                type: 'gun_round',
                advice: 'Standard round'
            }
    }
}

// ============ LOSS STREAK BEHAVIOR ============

/**
 * Analyze behavioral shifts during loss streaks
 */
export function analyzeLossStreakBehavior(
    rounds: RoundData[]
): AdvancedPatternAnalysis['lossStreakBehavior'] {
    if (rounds.length < 4) {
        return {
            currentStreak: 0,
            behaviorShift: 'normal',
            baselineAggression: 0.5,
            currentAggression: 0.5
        }
    }

    // Calculate current loss streak (from enemy perspective: our wins = their losses)
    let currentStreak = 0
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i].outcome === 'win') {
            currentStreak++
        } else {
            break
        }
    }

    // Calculate baseline aggression (first half of rounds)
    const midpoint = Math.floor(rounds.length / 2)
    const firstHalf = rounds.slice(0, midpoint)
    const secondHalf = rounds.slice(midpoint)

    const baselineAggression = firstHalf.filter(r => r.aggressivePlay).length / Math.max(firstHalf.length, 1)
    const currentAggression = secondHalf.filter(r => r.aggressivePlay).length / Math.max(secondHalf.length, 1)

    // Determine behavior shift
    let behaviorShift: AdvancedPatternAnalysis['lossStreakBehavior']['behaviorShift'] = 'normal'

    if (currentStreak >= 3) {
        const aggressionDelta = currentAggression - baselineAggression
        if (aggressionDelta > 0.2) {
            behaviorShift = 'tilting_aggressive'
        } else if (aggressionDelta < -0.2) {
            behaviorShift = 'playing_scared'
        }
    }

    return {
        currentStreak,
        behaviorShift,
        baselineAggression,
        currentAggression
    }
}

// ============ TACTICAL PREDICTION GENERATOR ============

/**
 * Generate a natural language tactical prediction
 */
export function generateTacticalPrediction(
    analysis: Omit<AdvancedPatternAnalysis, 'predictedNextPlay'>
): string {
    const parts: string[] = []

    // Round type advice (HIGH PRIORITY)
    if (analysis.roundTypeAdvice && analysis.roundType !== 'gun_round') {
        parts.push(analysis.roundTypeAdvice)
    }

    // Loss streak behavior (HIGH PRIORITY)
    const lsBehavior = analysis.lossStreakBehavior
    if (lsBehavior.currentStreak >= 3) {
        if (lsBehavior.behaviorShift === 'tilting_aggressive') {
            parts.push(`Enemies on ${lsBehavior.currentStreak} loss streak - tilting aggressive, expect early pushes`)
        } else if (lsBehavior.behaviorShift === 'playing_scared') {
            parts.push(`Enemies on ${lsBehavior.currentStreak} loss streak - playing passive, exploit with aggression`)
        }
    }

    // Economy insight
    const econ = analysis.economyPrediction
    if (econ.confidence > 0.5) {
        if (econ.likelyBuyType === 'eco' || econ.likelyBuyType === 'save') {
            parts.push(`Enemies on ${econ.likelyBuyType.toUpperCase()} - play for trades, don't give free kills`)
        } else if (econ.opWarning) {
            parts.push(`Watch for OP - they have credits for it`)
        }
    }

    // Map-aware site preference
    const mapPattern = analysis.mapSitePattern
    if (mapPattern.dominantSite) {
        const style = mapPattern.siteExecuteStyle[mapPattern.dominantSite]
        if (style && style !== 'unknown') {
            parts.push(`On ${mapPattern.map}: ${mapPattern.dominantSite}-site dominant with ${style} executes`)
        } else {
            parts.push(`Heavy ${mapPattern.dominantSite}-site tendency - stack or set up for retake`)
        }
    } else {
        // Fallback to basic site preference
        const sites = analysis.sitePreference
        const maxSite = Object.entries(sites).sort((a, b) => b[1] - a[1])[0]
        if (maxSite[1] > 50) {
            parts.push(`Heavy ${maxSite[0]}-site tendency (${maxSite[1]}%) - stack or set up for retake`)
        }
    }

    // Timing
    const timing = analysis.timingPattern
    if (timing.tendency === 'fast') {
        parts.push(`Fast executes - be ready for early contact`)
    } else if (timing.tendency === 'slow') {
        parts.push(`Slow default style - don't overcommit early, hold util`)
    }

    // Top threat
    if (analysis.commonFirstKillers.length > 0) {
        const threat = analysis.commonFirstKillers[0]
        parts.push(`Priority: Trade ${threat} if they entry`)
    }

    return parts.length > 0
        ? parts.join('. ') + '.'
        : 'Continue gathering intel on enemy patterns.'
}

// ============ MAIN ANALYSIS FUNCTION ============

/**
 * Run full advanced pattern analysis
 */
export function runAdvancedAnalysis(match: MatchData | null): AdvancedPatternAnalysis {
    // Default empty analysis
    const empty: AdvancedPatternAnalysis = {
        sitePreference: { A: 0, B: 0, C: 0 },
        aggressionRate: 0,
        avgUltsPerRound: 0,
        commonFirstKillers: [],
        agentPatterns: [],
        economyPrediction: {
            likelyBuyType: 'full',
            confidence: 0,
            opWarning: false,
            rifleCount: 0,
            reasoning: 'No data'
        },
        timingPattern: {
            avgExecuteTimeSeconds: 45,
            rushFrequency: 0.3,
            defaultFrequency: 0.4,
            splitFrequency: 0.2,
            tendency: 'mixed'
        },
        mapSitePattern: {
            map: 'unknown',
            dominantSite: null,
            siteExecuteStyle: { A: 'unknown', B: 'unknown', C: 'unknown' }
        },
        roundType: 'gun_round',
        roundTypeAdvice: 'Standard round',
        lossStreakBehavior: {
            currentStreak: 0,
            behaviorShift: 'normal',
            baselineAggression: 0.5,
            currentAggression: 0.5
        },
        confidenceScore: 0,
        predictedNextPlay: 'Not enough data for prediction.',
        summary: 'Collecting round data...'
    }

    if (!match || match.rounds.length < 2) {
        return empty
    }

    const rounds = match.rounds
    const enemyTeam = match.enemyTeam

    // Base stats
    const siteCount = { A: 0, B: 0, C: 0 }
    let aggressiveCount = 0
    let totalUlts = 0
    const firstKillers: Record<string, number> = {}

    for (const r of rounds) {
        // Same de-duplication as analyzePatterns: `site` and `plantedSite` are
        // almost always the same value, counting both double-weights plants.
        const siteSource = r.site || (r.plantedSite && ['A', 'B', 'C'].includes(r.plantedSite)
            ? (r.plantedSite as 'A' | 'B' | 'C')
            : null)
        if (siteSource) siteCount[siteSource]++
        if (r.aggressivePlay) aggressiveCount++
        totalUlts += r.ultsUsed.length
        if (r.enemyFirstKill && r.enemyFirstKill !== 'Unknown') {
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
    const commonFirstKillers = Object.entries(firstKillers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([agent]) => agent)

    // Advanced analysis
    const currentRound = rounds.length + 1
    const economyPrediction = predictEnemyEconomy(rounds, currentRound)
    const agentPatterns = analyzeAgentTendencies(rounds, enemyTeam)
    const timingPattern = analyzeTimingPatterns(rounds)

    // NEW: Map-aware, round-type, loss-streak
    const mapSitePattern = analyzeMapSitePattern(rounds, match.map)
    const roundTypeResult = determineRoundType(currentRound, economyPrediction)
    const lossStreakBehavior = analyzeLossStreakBehavior(rounds)

    // Confidence is anchored to rounds with *known outcomes*. A match that has
    // 8 recorded rounds but only 2 confirmed outcomes should not pretend to be
    // high-confidence — outcome is what most downstream heuristics (economy,
    // loss-streak, timing) actually depend on.
    const knownOutcomeRounds = rounds.filter(r => r.outcome === 'win' || r.outcome === 'loss').length
    const confidenceScore = knownOutcomeRounds < 4
        ? Math.min(0.4, 0.1 + knownOutcomeRounds * 0.07)
        : Math.min(0.9, 0.4 + knownOutcomeRounds * 0.05)

    // Build partial analysis for prediction
    const partialAnalysis = {
        sitePreference,
        aggressionRate,
        avgUltsPerRound,
        commonFirstKillers,
        agentPatterns,
        economyPrediction,
        timingPattern,
        mapSitePattern,
        roundType: roundTypeResult.type,
        roundTypeAdvice: roundTypeResult.advice,
        lossStreakBehavior,
        confidenceScore,
        summary: ''
    }

    const predictedNextPlay = generateTacticalPrediction(partialAnalysis)

    // Summary
    const summaryParts: string[] = []
    const maxSite = Object.entries(sitePreference).sort((a, b) => b[1] - a[1])[0]
    if (maxSite[1] > 40) {
        summaryParts.push(`${maxSite[0]}-site favored (${maxSite[1]}%)`)
    }
    if (aggressionRate > 0.6) {
        summaryParts.push('Aggressive playstyle')
    } else if (aggressionRate < 0.3) {
        summaryParts.push('Passive/default style')
    }
    summaryParts.push(`Economy: ${economyPrediction.likelyBuyType}`)

    return {
        ...partialAnalysis,
        predictedNextPlay,
        summary: summaryParts.join(' | ') || 'Building data...'
    }
}
