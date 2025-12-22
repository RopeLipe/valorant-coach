/**
 * Game Events Tracker Service
 * Maintains round-aware state of game events for contextual AI coaching
 */

import { getAgentName } from '../src/utils/agentMapping'
import { getWeaponName } from '../src/utils/weaponMapping'
import { getEconomyContext, getTeamEconomyContext } from '../src/utils/economyReference'

// ============ TYPE DEFINITIONS ============

export interface KillEvent {
    timestamp: number
    roundNumber: number
    attacker: string
    victim: string
    weapon: string
    headshot: boolean
    isAttackerTeammate: boolean
    isVictimTeammate: boolean
    assists: string[]
}

export interface SpikeEvent {
    timestamp: number
    roundNumber: number
    type: 'planted' | 'defused' | 'detonated'
    location?: 'A' | 'B' | 'C'
}

export interface RoundSummary {
    roundNumber: number
    outcome?: 'won' | 'lost'
    kills: KillEvent[]
    spikeEvent?: SpikeEvent
}

export interface UltAlert {
    agent: string
    status: 'ready' | 'almost'  // ready = has ult, almost = 1-2 orbs away
    orbsAway: number
    ultPoints: number
    ultMax: number
}

export interface ScoreboardPlayer {
    name: string
    character: string
    teammate: boolean
    team: number
    alive: boolean
    playerId: string
    shield: number
    weapon: string
    spike: boolean
    ultPoints: number
    ultMax: number
    kills: number
    deaths: number
    assists: number
    money: number
    isLocal: boolean
}

export interface GameEventsState {
    // === PERSISTENT (match-level) ===
    currentRound: number
    team: 'attack' | 'defense' | 'unknown'
    roundHistory: RoundSummary[]
    matchId?: string

    // === RESET EACH ROUND ===
    roundPhase: 'shopping' | 'combat' | 'end' | 'unknown'
    thisRoundKills: KillEvent[]
    thisRoundSpike?: SpikeEvent
    aliveAllies: string[]
    aliveEnemies: string[]

    // === LIVE (updates constantly) ===
    scoreboard: ScoreboardPlayer[]
    myAbilities: { C: boolean; Q: boolean; E: boolean; X: boolean }
    myHealth: number
    myAgent: string
    map: string
}

// ============ STATE ============

const MAX_ROUND_HISTORY = 3
const MAX_EVENT_AGE_MS = 3 * 60 * 1000 // 3 minutes

let state: GameEventsState = createInitialState()

function createInitialState(): GameEventsState {
    return {
        currentRound: 0,
        team: 'unknown',
        roundHistory: [],
        roundPhase: 'unknown',
        thisRoundKills: [],
        thisRoundSpike: undefined,
        aliveAllies: [],
        aliveEnemies: [],
        scoreboard: [],
        myAbilities: { C: false, Q: false, E: false, X: false },
        myHealth: 100,
        myAgent: 'unknown',
        map: 'unknown',
    }
}

// ============ STATE ACCESSORS ============

export function getState(): Readonly<GameEventsState> {
    return state
}

export function resetState(): void {
    state = createInitialState()
}

// ============ EVENT PROCESSORS ============

/**
 * Process round phase change - CRITICAL for state reset
 */
export function onRoundPhaseChange(phase: string, roundNum?: number): void {
    const now = Date.now()
    const newRound = roundNum ?? state.currentRound

    // Detect new round start (shopping phase)
    if (phase === 'shopping' && newRound > state.currentRound) {
        // Archive previous round if we have data
        if (state.currentRound > 0 && state.thisRoundKills.length > 0) {
            const roundSummary: RoundSummary = {
                roundNumber: state.currentRound,
                kills: [...state.thisRoundKills],
                spikeEvent: state.thisRoundSpike,
            }
            state.roundHistory.push(roundSummary)
            // Keep only last N rounds
            if (state.roundHistory.length > MAX_ROUND_HISTORY) {
                state.roundHistory.shift()
            }
        }

        // Reset per-round state
        state.thisRoundKills = []
        state.thisRoundSpike = undefined

        // Alive status will be refreshed from scoreboard
        refreshAliveStatusFromScoreboard()
    }

    state.currentRound = newRound
    state.roundPhase = phase as GameEventsState['roundPhase']
}

/**
 * Process kill feed events
 */
export function processKillFeed(data: any): void {
    if (!data) return

    const now = Date.now()

    // Look up agent names from scoreboard using player names
    const attackerAgent = getAgentByPlayerName(data.attacker || '')
    const victimAgent = getAgentByPlayerName(data.victim || '')

    const killEvent: KillEvent = {
        timestamp: now,
        roundNumber: state.currentRound,
        attacker: attackerAgent || data.attacker || 'Unknown',
        victim: victimAgent || data.victim || 'Unknown',
        weapon: getWeaponName(data.weapon || ''),
        headshot: data.headshot === true,
        isAttackerTeammate: data.is_attacker_teammate === true,
        isVictimTeammate: data.is_victim_teammate === true,
        assists: [
            data.assist1,
            data.assist2,
            data.assist3,
            data.assist4,
        ].filter(Boolean).map(name => getAgentByPlayerName(name)),
    }

    state.thisRoundKills.push(killEvent)

    // Update alive status based on kill
    if (killEvent.isVictimTeammate) {
        state.aliveAllies = state.aliveAllies.filter(a => a !== victimAgent)
    } else {
        state.aliveEnemies = state.aliveEnemies.filter(a => a !== victimAgent)
    }
}

/**
 * Process spike events (planted, defused, detonated)
 */
export function processSpikeEvent(eventName: string, data?: any): void {
    const now = Date.now()

    if (eventName === 'planted_location') {
        state.thisRoundSpike = {
            timestamp: now,
            roundNumber: state.currentRound,
            type: 'planted',
            location: data as 'A' | 'B' | 'C',
        }
    } else if (eventName === 'spike_defused') {
        state.thisRoundSpike = {
            timestamp: now,
            roundNumber: state.currentRound,
            type: 'defused',
            location: state.thisRoundSpike?.location,
        }
    } else if (eventName === 'spike_detonated') {
        state.thisRoundSpike = {
            timestamp: now,
            roundNumber: state.currentRound,
            type: 'detonated',
            location: state.thisRoundSpike?.location,
        }
    }
}

/**
 * Process scoreboard update
 */
export function processScoreboard(key: string, data: any): void {
    if (!data) return

    // Parse if string - raw data from Overwolf uses snake_case
    const rawPlayer: any = typeof data === 'string' ? JSON.parse(data) : data

    // Find existing player or add new
    const existingIndex = state.scoreboard.findIndex(
        p => p.playerId === rawPlayer.player_id || p.name === rawPlayer.name
    )

    const scoreboardPlayer: ScoreboardPlayer = {
        name: rawPlayer.name || '',
        character: getAgentName(rawPlayer.character || ''),
        teammate: rawPlayer.teammate === true,
        team: rawPlayer.team ?? 0,
        alive: rawPlayer.alive !== false,
        playerId: rawPlayer.player_id || '',
        shield: rawPlayer.shield ?? 0,
        weapon: getWeaponName(rawPlayer.weapon || ''),
        spike: rawPlayer.spike === true,
        ultPoints: rawPlayer.ult_points ?? 0,
        ultMax: rawPlayer.ult_max ?? 8,
        kills: rawPlayer.kills ?? 0,
        deaths: rawPlayer.deaths ?? 0,
        assists: rawPlayer.assists ?? 0,
        money: rawPlayer.money ?? 0,
        isLocal: rawPlayer.is_local === true,
    }

    if (existingIndex >= 0) {
        state.scoreboard[existingIndex] = scoreboardPlayer
    } else {
        state.scoreboard.push(scoreboardPlayer)
    }

    // Refresh alive status after scoreboard update
    refreshAliveStatusFromScoreboard()
}

/**
 * Process player abilities info
 */
export function processAbilities(data: any): void {
    if (!data) return
    const abilities = typeof data === 'string' ? JSON.parse(data) : data
    state.myAbilities = {
        C: abilities.C === true,
        Q: abilities.Q === true,
        E: abilities.E === true,
        X: abilities.X === true,
    }
}

/**
 * Process player health
 */
export function processHealth(health: number): void {
    state.myHealth = health
}

/**
 * Process team side (attack/defense)
 */
export function processTeam(team: string): void {
    if (team === 'attack' || team === 'defense') {
        state.team = team
    }
}

/**
 * Process map info
 */
export function processMap(map: string): void {
    if (map) {
        state.map = map
    }
}

/**
 * Process agent info
 */
export function processAgent(agent: string): void {
    if (agent) {
        state.myAgent = getAgentName(agent)
    }
}

/**
 * Process match start - clear all state
 */
export function onMatchStart(matchId?: string): void {
    state = createInitialState()
    state.matchId = matchId
}

/**
 * Process match end - clear all state
 */
export function onMatchEnd(): void {
    state = createInitialState()
}

// ============ HELPERS ============

function refreshAliveStatusFromScoreboard(): void {
    state.aliveAllies = state.scoreboard
        .filter(p => p.teammate && p.alive)
        .map(p => p.character)

    state.aliveEnemies = state.scoreboard
        .filter(p => !p.teammate && p.alive)
        .map(p => p.character)
}

/**
 * Look up agent name from player name using scoreboard
 */
function getAgentByPlayerName(playerName: string): string {
    const player = state.scoreboard.find(p => p.name === playerName)
    return player?.character || playerName // Fallback to player name if not found
}

function filterStaleEvents<T extends { timestamp: number }>(events: T[]): T[] {
    const now = Date.now()
    return events.filter(e => now - e.timestamp < MAX_EVENT_AGE_MS)
}

// ============ CONTEXT BUILDER ============

/**
 * Check if we have enough game data to make a useful AI query
 * Returns false if all data is unknown/default
 */
export function hasUsefulData(): boolean {
    // If we're in round 1 or later, we're definitely in an active match
    // This is the most reliable indicator
    if (state.currentRound >= 1) return true

    // Otherwise, check if we have ANY valid game data
    // (This handles pre-round scenarios or delayed data arrival)
    const hasMap = state.map !== 'unknown' && state.map !== ''
    const hasAgent = state.myAgent !== 'unknown' && state.myAgent !== ''
    const hasScoreboard = state.scoreboard.length > 0

    return hasMap || hasAgent || hasScoreboard
}

export function buildContextSummary(): string {
    const now = Date.now()
    const lines: string[] = []

    // Basic match info
    lines.push(`Map: ${state.map}`)
    lines.push(`My Agent: ${state.myAgent}`)
    lines.push(`Side: ${state.team}`)
    lines.push(`Round: ${state.currentRound} (${state.roundPhase})`)

    // Player status
    lines.push(`My Health: ${state.myHealth}`)
    const abilities = Object.entries(state.myAbilities)
        .filter(([_, available]) => available)
        .map(([key]) => key)
    lines.push(`My Abilities Ready: ${abilities.length > 0 ? abilities.join(', ') : 'None'}`)

    // Alive status
    lines.push(`Allies Alive: ${state.aliveAllies.length > 0 ? state.aliveAllies.join(', ') : 'Unknown'}`)
    lines.push(`Enemies Alive: ${state.aliveEnemies.length > 0 ? state.aliveEnemies.join(', ') : 'Unknown'}`)

    // Spike status
    if (state.thisRoundSpike) {
        const spike = state.thisRoundSpike
        if (spike.type === 'planted') {
            lines.push(`Spike: Planted at ${spike.location || 'unknown site'}`)
        } else if (spike.type === 'defused') {
            lines.push(`Spike: Defused`)
        } else if (spike.type === 'detonated') {
            lines.push(`Spike: Detonated`)
        }
    }

    // Recent kills this round
    const recentKills = filterStaleEvents(state.thisRoundKills)
        .filter(k => k.roundNumber === state.currentRound)
        .slice(-5) // Last 5 kills

    if (recentKills.length > 0) {
        lines.push(`This Round Kills:`)
        for (const kill of recentKills) {
            const headshotStr = kill.headshot ? ' (headshot)' : ''
            const teamStr = kill.isAttackerTeammate ? 'Ally' : 'Enemy'
            const victimTeamStr = kill.isVictimTeammate ? 'ally' : 'enemy'
            lines.push(`  - ${teamStr} ${kill.attacker} killed ${victimTeamStr} ${kill.victim} with ${kill.weapon}${headshotStr}`)
        }
    }

    // Team economy summary with affordable weapons per player
    const allies = state.scoreboard.filter(p => p.teammate)
    const enemies = state.scoreboard.filter(p => !p.teammate)

    // Build team economy context with individual player data
    if (allies.length > 0) {
        const teamEconomy = allies.map(p => ({
            name: p.name,
            agent: p.character,
            credits: p.money,
            isLocal: p.isLocal
        }))
        lines.push(getTeamEconomyContext(teamEconomy))
    }

    if (enemies.length > 0) {
        const enemyUltsReady = enemies.filter(p => p.ultPoints >= p.ultMax).length
        lines.push(`Enemy Ults Ready: ~${enemyUltsReady}`)
    }

    // Brief round history
    if (state.roundHistory.length > 0) {
        const lastRound = state.roundHistory[state.roundHistory.length - 1]
        const outcome = lastRound.outcome || 'unknown'
        const kills = lastRound.kills.length
        lines.push(`Last Round: ${outcome} (${kills} kills)`)
    }

    return lines.join('\n')
}

/**
 * Get alerts for enemy ultimates that are ready or almost ready
 */
export function getUltAlerts(): UltAlert[] {
    const alerts: UltAlert[] = []
    const enemies = state.scoreboard.filter(p => !p.teammate)

    for (const enemy of enemies) {
        if (enemy.ultMax <= 0) continue  // Invalid data

        const orbsAway = enemy.ultMax - enemy.ultPoints

        if (orbsAway <= 0) {
            // Ult is ready
            alerts.push({
                agent: getAgentName(enemy.character),
                status: 'ready',
                orbsAway: 0,
                ultPoints: enemy.ultPoints,
                ultMax: enemy.ultMax
            })
        } else if (orbsAway <= 2) {
            // Almost ready (1-2 orbs away)
            alerts.push({
                agent: getAgentName(enemy.character),
                status: 'almost',
                orbsAway,
                ultPoints: enemy.ultPoints,
                ultMax: enemy.ultMax
            })
        }
    }

    return alerts
}
