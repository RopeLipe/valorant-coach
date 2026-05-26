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
    // Captured at archive time so post-round consumers see what happened without
    // re-querying volatile state. `ultsUsed` is the accumulator from continuous
    // sampling (see processScoreboard) rather than a one-shot end-of-round diff.
    ultsUsed?: string[]
    enemyFirstKill?: string | null
    plantSite?: 'A' | 'B' | 'C' | null
    aggressivePlay?: boolean
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
    score: { won: number; lost: number }  // Track team score

    // === RESET EACH ROUND ===
    roundPhase: 'shopping' | 'combat' | 'end' | 'unknown'
    roundStartTime: number  // For timing analysis
    thisRoundKills: KillEvent[]
    thisRoundSpike?: SpikeEvent
    aliveAllies: string[]
    aliveEnemies: string[]
    previousUltPoints: Map<string, number>  // Track ult usage by comparing
    // Accumulator for enemy ults used during the current round. Populated by
    // continuous sampling inside processScoreboard — the prior approach only
    // sampled at round-end and missed any ult used mid-combat whose previous
    // snapshot had already decayed.
    thisRoundUltsUsed: string[]

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
// Timestamp of the last scoreboard update. Used by hasFreshEconomyData() to
// suppress economy output built from stale data (e.g. seconds after a round
// reset, before GEP has sent refreshed credit values).
let lastScoreboardUpdateAt = 0

function createInitialState(): GameEventsState {
    return {
        currentRound: 0,
        team: 'unknown',
        roundHistory: [],
        roundPhase: 'unknown',
        score: { won: 0, lost: 0 },
        roundStartTime: 0,
        thisRoundKills: [],
        thisRoundSpike: undefined,
        aliveAllies: [],
        aliveEnemies: [],
        previousUltPoints: new Map(),
        thisRoundUltsUsed: [],
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
    lastScoreboardUpdateAt = 0
}

/**
 * Returns true if the scoreboard has been updated recently AND at least half
 * the ally slots have a non-zero credit value. Used to gate economy output —
 * otherwise a partially-populated scoreboard right after a round reset can
 * make the team look broke when it isn't.
 */
export function hasFreshEconomyData(): boolean {
    if (lastScoreboardUpdateAt === 0) return false
    if (Date.now() - lastScoreboardUpdateAt > 15000) return false
    const allies = state.scoreboard.filter(p => p.teammate)
    if (allies.length === 0) return false
    const withCredits = allies.filter(p => p.money > 0).length
    return withCredits >= Math.min(2, allies.length)
}

// ============ PERSISTENCE ============

const STORAGE_PREFIX = 'valorant_coach_tracker_'
const STORAGE_SCHEMA = 1

type PersistedState = {
    schema: number
    state: Omit<GameEventsState, 'previousUltPoints'> & {
        previousUltPoints: Array<[string, number]>
    }
}

function storageKeyFor(matchId: string | undefined): string {
    return `${STORAGE_PREFIX}${matchId || 'anonymous'}`
}

/** Snapshot the live state so it survives an overlay window reload. */
export function saveState(): void {
    try {
        if (typeof localStorage === 'undefined') return
        const payload: PersistedState = {
            schema: STORAGE_SCHEMA,
            state: {
                ...state,
                previousUltPoints: Array.from(state.previousUltPoints.entries()),
            },
        }
        localStorage.setItem(storageKeyFor(state.matchId), JSON.stringify(payload))
    } catch { }
}

/** Restore state for a given match id. Returns true if hydration happened. */
export function hydrate(matchId?: string): boolean {
    try {
        if (typeof localStorage === 'undefined') return false
        const raw = localStorage.getItem(storageKeyFor(matchId))
        if (!raw) return false
        const parsed = JSON.parse(raw) as PersistedState
        if (parsed.schema !== STORAGE_SCHEMA) return false
        state = {
            ...parsed.state,
            previousUltPoints: new Map(parsed.state.previousUltPoints || []),
            // Backfill fields added after a persisted snapshot was written.
            thisRoundUltsUsed: parsed.state.thisRoundUltsUsed || [],
        }
        return true
    } catch {
        return false
    }
}

/** Remove stored tracker snapshots older than N days to avoid bloat. */
export function pruneOldSnapshots(maxAgeDays = 3): void {
    try {
        if (typeof localStorage === 'undefined') return
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue
            try {
                const raw = localStorage.getItem(key)
                if (!raw) continue
                const parsed = JSON.parse(raw) as PersistedState
                const rs = parsed.state?.roundStartTime ?? 0
                if (rs && rs < cutoff) localStorage.removeItem(key)
            } catch {
                localStorage.removeItem(key)
            }
        }
    } catch { }
}

// ============ EVENT PROCESSORS ============

/**
 * Normalize the raw GEP phase string into the internal FSM buckets. Valorant
 * occasionally emits `game_end`, `pre_round`, `match_end`, and a few other
 * undocumented values that we previously dropped into the 'unknown' bin,
 * breaking round-end side effects on reload.
 */
function normalizePhase(raw: string): GameEventsState['roundPhase'] {
    const p = (raw || '').toLowerCase()
    if (p === 'shopping' || p === 'pre_round' || p === 'preround') return 'shopping'
    if (p === 'combat' || p === 'active' || p === 'round' || p === 'playing') return 'combat'
    if (p === 'end' || p === 'round_end' || p === 'post_round' || p === 'postround') return 'end'
    if (p === 'game_end' || p === 'match_end') return 'end'
    return 'unknown'
}

/**
 * Process round phase change - CRITICAL for state reset
 */
export function onRoundPhaseChange(phase: string, roundNum?: number): void {
    const newRound = roundNum ?? state.currentRound
    const normalized = normalizePhase(phase)

    // Archive on any new-round transition (shopping with a higher round number).
    // The previous implementation required `thisRoundKills.length > 0`, which
    // silently dropped pistol-round saves and one-sided rounds where no kills
    // were recorded — poisoning downstream pattern analysis.
    if (normalized === 'shopping' && newRound > state.currentRound && state.currentRound > 0) {
        const roundSummary: RoundSummary = {
            roundNumber: state.currentRound,
            kills: [...state.thisRoundKills],
            spikeEvent: state.thisRoundSpike,
            ultsUsed: [...state.thisRoundUltsUsed],
            enemyFirstKill: getEnemyFirstKill(),
            plantSite: (state.thisRoundSpike?.location as 'A' | 'B' | 'C') || null,
            aggressivePlay: wasAggressiveRound(),
        }
        state.roundHistory.push(roundSummary)
        if (state.roundHistory.length > MAX_ROUND_HISTORY) {
            state.roundHistory.shift()
        }

        // Reset per-round state
        state.thisRoundKills = []
        state.thisRoundSpike = undefined
        state.thisRoundUltsUsed = []
        state.roundStartTime = 0

        refreshAliveStatusFromScoreboard()
    }

    state.currentRound = newRound
    state.roundPhase = normalized
}

/**
 * Process kill feed events
 */
export function processKillFeed(data: any): void {
    if (!data) return

    const now = Date.now()

    // Resolve agent names from the scoreboard. Falling back to the raw player
    // name would pollute downstream pattern analysis (enemyFirstKill, agent
    // tendencies) with non-agent strings, so we use 'Unknown' until the
    // scoreboard catches up.
    const attackerAgent = getAgentByPlayerName(data.attacker || '')
    const victimAgent = getAgentByPlayerName(data.victim || '')

    const killEvent: KillEvent = {
        timestamp: now,
        roundNumber: state.currentRound,
        attacker: attackerAgent || 'Unknown',
        victim: victimAgent || 'Unknown',
        weapon: getWeaponName(data.weapon || ''),
        headshot: data.headshot === true,
        isAttackerTeammate: data.is_attacker_teammate === true,
        isVictimTeammate: data.is_victim_teammate === true,
        assists: [
            data.assist1,
            data.assist2,
            data.assist3,
            data.assist4,
        ].filter(Boolean).map(name => getAgentByPlayerName(name) || 'Unknown'),
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
 * Process scoreboard update.
 *
 * GEP frequently sends PARTIAL scoreboard payloads (e.g. just `{ alive: false }`
 * or `{ money: 4200 }`). A wholesale replace would zero out every field the
 * partial didn't include — that's why the economy readout kept going wrong.
 * We merge only the fields that are explicitly present in the incoming payload
 * and fall back to the previous record (or the type default for brand-new
 * players) for everything else.
 */
export function processScoreboard(key: string, data: any): void {
    if (!data) return

    const rawPlayer: any = typeof data === 'string' ? JSON.parse(data) : data
    if (!rawPlayer || typeof rawPlayer !== 'object') return

    const existingIndex = state.scoreboard.findIndex(
        p => (rawPlayer.player_id && p.playerId === rawPlayer.player_id) ||
             (rawPlayer.name && p.name === rawPlayer.name)
    )
    const prev: ScoreboardPlayer | undefined = existingIndex >= 0 ? state.scoreboard[existingIndex] : undefined
    const has = (k: string) => Object.prototype.hasOwnProperty.call(rawPlayer, k) && rawPlayer[k] !== undefined && rawPlayer[k] !== null

    const merged: ScoreboardPlayer = {
        name: has('name') ? String(rawPlayer.name) : (prev?.name ?? ''),
        character: has('character') ? getAgentName(String(rawPlayer.character)) : (prev?.character ?? ''),
        teammate: has('teammate') ? rawPlayer.teammate === true : (prev?.teammate ?? false),
        team: has('team') ? Number(rawPlayer.team) : (prev?.team ?? 0),
        alive: has('alive') ? rawPlayer.alive !== false : (prev?.alive ?? true),
        playerId: has('player_id') ? String(rawPlayer.player_id) : (prev?.playerId ?? ''),
        shield: has('shield') ? Number(rawPlayer.shield) : (prev?.shield ?? 0),
        weapon: has('weapon') ? getWeaponName(String(rawPlayer.weapon)) : (prev?.weapon ?? ''),
        spike: has('spike') ? rawPlayer.spike === true : (prev?.spike ?? false),
        ultPoints: has('ult_points') ? Number(rawPlayer.ult_points) : (prev?.ultPoints ?? 0),
        ultMax: has('ult_max') ? Number(rawPlayer.ult_max) : (prev?.ultMax ?? 8),
        kills: has('kills') ? Number(rawPlayer.kills) : (prev?.kills ?? 0),
        deaths: has('deaths') ? Number(rawPlayer.deaths) : (prev?.deaths ?? 0),
        assists: has('assists') ? Number(rawPlayer.assists) : (prev?.assists ?? 0),
        money: has('money') ? Number(rawPlayer.money) : (prev?.money ?? 0),
        isLocal: has('is_local') ? rawPlayer.is_local === true : (prev?.isLocal ?? false),
    }

    if (existingIndex >= 0) {
        state.scoreboard[existingIndex] = merged
        lastScoreboardUpdateAt = Date.now()
    } else if (merged.name || merged.playerId) {
        state.scoreboard.push(merged)
        lastScoreboardUpdateAt = Date.now()
    }

    // Continuous ult sampling: detect a drop in any enemy's ult points vs. the
    // previous snapshot. Only sampling at round-end (the prior behaviour) missed
    // any ult whose post-use points had already been overwritten by a later
    // partial scoreboard update.
    if (!merged.teammate && merged.character && merged.ultMax > 0) {
        const agentKey = merged.character
        const prevPoints = state.previousUltPoints.get(agentKey)
        if (prevPoints !== undefined &&
            prevPoints >= merged.ultMax &&
            merged.ultPoints < prevPoints &&
            !state.thisRoundUltsUsed.includes(agentKey)) {
            state.thisRoundUltsUsed.push(agentKey)
        }
        state.previousUltPoints.set(agentKey, merged.ultPoints)
    }

    // Refresh alive status after scoreboard update
    refreshAliveStatusFromScoreboard()
}

/**
 * Drop scoreboard entries for players who haven't been touched in a while.
 * Valorant leaves ghost entries behind for disconnects which quietly skew
 * economy averages and ult-alert counts. Caller decides when to prune
 * (e.g. on round start).
 */
export function pruneDisconnectedPlayers(): number {
    const before = state.scoreboard.length
    // Heuristic: if we haven't seen a scoreboard update in > 30s, assume GEP
    // is no longer pushing for that player. We don't get per-player timestamps,
    // so we rely on a hard cap of 10 entries (5v5 max) and trim the oldest
    // duplicates by playerId.
    const seen = new Map<string, ScoreboardPlayer>()
    for (const p of state.scoreboard) {
        const k = p.playerId || p.name
        if (k) seen.set(k, p)
    }
    state.scoreboard = Array.from(seen.values()).slice(0, 10)
    return before - state.scoreboard.length
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
    lastScoreboardUpdateAt = 0
}

/**
 * Process match end - clear all state
 */
export function onMatchEnd(): void {
    state = createInitialState()
    lastScoreboardUpdateAt = 0
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

    // Team economy summary with affordable weapons per player.
    // Only emit when the scoreboard is fresh AND actually has credit values —
    // otherwise we risk telling the AI "Team broke, full eco" when in reality
    // GEP just hasn't pushed the new round's credits yet.
    const allies = state.scoreboard.filter(p => p.teammate)
    const enemies = state.scoreboard.filter(p => !p.teammate)

    if (allies.length > 0 && hasFreshEconomyData()) {
        const teamEconomy = allies.map(p => ({
            name: p.name,
            agent: p.character,
            credits: p.money,
            isLocal: p.isLocal
        }))
        lines.push(getTeamEconomyContext(teamEconomy))
    } else if (allies.length > 0) {
        lines.push(`Team Economy: Unknown (scoreboard not yet populated for this round)`)
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

// ============ PREDICTION ENGINE INTEGRATION ============

/**
 * Process score update from GEP
 */
export function processScore(won: number, lost: number): void {
    state.score = { won, lost }
}

/**
 * Returns the ults observed this round (continuous-sampling accumulator).
 * Previous one-shot sampling is preserved below as trackUltUsageNow() for
 * callers that want a spot-check diff, but getRoundDataForPrediction reads
 * the accumulator so it cannot miss ults between snapshots.
 */
export function getThisRoundUltsUsed(): string[] {
    return [...state.thisRoundUltsUsed]
}

/**
 * Spot-check diff of current ult points vs previous snapshot. Kept for
 * backwards compatibility; continuous sampling in processScoreboard is the
 * source of truth now.
 */
export function trackUltUsage(): string[] {
    const ultsUsed: string[] = []
    const enemies = state.scoreboard.filter(p => !p.teammate)

    for (const enemy of enemies) {
        const agent = getAgentName(enemy.character)
        const prevPoints = state.previousUltPoints.get(agent)

        if (prevPoints !== undefined && prevPoints >= enemy.ultMax && enemy.ultPoints < prevPoints) {
            ultsUsed.push(agent)
        }
        state.previousUltPoints.set(agent, enemy.ultPoints)
    }

    return ultsUsed
}

/**
 * Get the first enemy kill of the round
 */
export function getEnemyFirstKill(): string | null {
    // Find first kill where enemy killed us (is_attacker_teammate = false)
    const enemyKills = state.thisRoundKills.filter(k => !k.isAttackerTeammate)
    if (enemyKills.length === 0) return null

    // Sort by timestamp and return attacker of first kill
    const sorted = [...enemyKills].sort((a, b) => a.timestamp - b.timestamp)
    return sorted[0].attacker
}

/**
 * Determine if the round was aggressive based on timing
 * Aggressive = first major event (kill or plant) within 25 seconds of round start
 */
export function wasAggressiveRound(): boolean {
    if (state.roundStartTime === 0) return false

    const AGGRESSIVE_THRESHOLD_MS = 25000  // 25 seconds

    // Check first kill timing
    const firstKill = state.thisRoundKills[0]
    if (firstKill && (firstKill.timestamp - state.roundStartTime) < AGGRESSIVE_THRESHOLD_MS) {
        return true
    }

    // Check plant timing (if attacking)
    if (state.thisRoundSpike?.type === 'planted') {
        const plantTime = state.thisRoundSpike.timestamp - state.roundStartTime
        if (plantTime < AGGRESSIVE_THRESHOLD_MS) {
            return true
        }
    }

    return false
}

/**
 * Infer round outcome from score change
 * Call this AFTER score has been updated for the new round
 * @param prevWon - Previous won count before this round
 */
export function inferRoundOutcome(prevWon: number): 'win' | 'loss' | 'unknown' {
    if (state.score.won > prevWon) {
        return 'win'
    } else if (state.score.lost > prevWon) {
        // This shouldn't happen but indicates a loss
        return 'loss'
    }
    // Score unchanged or decreased means loss (enemy scored)
    const totalBefore = prevWon
    const totalNow = state.score.won
    if (totalNow > totalBefore) {
        return 'win'
    }
    return 'loss'
}

/**
 * Get complete round data ready for prediction engine
 * Call at end of each round
 */
export function getRoundDataForPrediction(): {
    round: number
    site: 'A' | 'B' | 'C' | null
    enemyFirstKill: string | null
    aggressivePlay: boolean
    ultsUsed: string[]
    outcome: 'win' | 'loss' | 'unknown'
} {
    return {
        round: state.currentRound,
        site: (state.thisRoundSpike?.location as 'A' | 'B' | 'C') || null,
        enemyFirstKill: getEnemyFirstKill(),
        aggressivePlay: wasAggressiveRound(),
        ultsUsed: getThisRoundUltsUsed(),
        outcome: 'unknown'  // Will be set by caller with inferRoundOutcome
    }
}

/**
 * Current enemy agents from the live scoreboard. Used by predictionEngine
 * to grow the enemy roster over time rather than relying on an incomplete
 * snapshot taken at initMatch (before GEP has pushed all 5 players).
 */
export function getEnemyAgents(): string[] {
    return state.scoreboard
        .filter(p => !p.teammate && p.character)
        .map(p => p.character)
}

/**
 * Set round start time - call when combat phase begins
 */
export function setRoundStartTime(): void {
    state.roundStartTime = Date.now()
}

// ============ RESPONSE TIMING / OBJECTIVE COACHING ============

export type PhaseGate = {
    safeToSpeak: boolean
    reason: 'shopping' | 'end' | 'dead' | 'combat' | 'unknown'
    objective: 'economy' | 'execute' | 'retake' | 'postplant' | 'rotate' | 'reflect' | 'general'
}

/**
 * Decide whether it is safe to deliver coaching right now, and what the
 * current tactical objective is. Used to gate proactive prompts so the
 * AI never talks over active combat.
 */
export function getPhaseGate(): PhaseGate {
    const phase = state.roundPhase
    const meDead = state.myHealth <= 0 && state.scoreboard.length > 0
    const planted = state.thisRoundSpike?.type === 'planted'
    const side = state.team

    if (phase === 'shopping') {
        return { safeToSpeak: true, reason: 'shopping', objective: 'economy' }
    }
    if (phase === 'end') {
        return { safeToSpeak: true, reason: 'end', objective: 'reflect' }
    }
    if (meDead) {
        const obj: PhaseGate['objective'] = planted
            ? (side === 'attack' ? 'postplant' : 'retake')
            : 'rotate'
        return { safeToSpeak: true, reason: 'dead', objective: obj }
    }
    if (phase === 'combat') {
        if (planted) {
            return {
                safeToSpeak: false,
                reason: 'combat',
                objective: side === 'attack' ? 'postplant' : 'retake',
            }
        }
        return { safeToSpeak: false, reason: 'combat', objective: 'execute' }
    }
    return { safeToSpeak: false, reason: 'unknown', objective: 'general' }
}

/**
 * Build an objective-focused task directive based on the current phase,
 * economy, spike state, and alive count. Paired with buildContextSummary()
 * it gives the AI clear, winning-oriented coaching targets.
 */
export function buildObjectiveDirective(): string {
    const gate = getPhaseGate()
    const alliesAlive = state.aliveAllies.length
    const enemiesAlive = state.aliveEnemies.length
    const planted = state.thisRoundSpike?.type === 'planted'
    const site = state.thisRoundSpike?.location
    const round = state.currentRound
    const isPistol = round === 1 || round === 13

    switch (gate.objective) {
        case 'economy': {
            if (isPistol) {
                return 'Task: Pistol round buy call. Recommend one concrete loadout (Ghost/Classic + abilities + shield choice) and a first-contact plan. No rifles.'
            }
            return 'Task: Buy-phase call. Give ONE concrete team buy decision (full buy / force / save) grounded in the team economy table above, call out who should drop if needed, and a 1-line opener.'
        }
        case 'retake': {
            return `Task: Site retake. Spike is down${site ? ' at ' + site : ''}, ${alliesAlive}v${enemiesAlive}. Give one retake plan: utility order, entry angle, and kill priority. Under 2 sentences.`
        }
        case 'postplant': {
            return `Task: Post-plant lurk${site ? ' on ' + site : ''}. ${alliesAlive}v${enemiesAlive}. Call one defuse-denial angle or util line that wins the timer.`
        }
        case 'execute': {
            return `Task: Mid-round read. ${alliesAlive}v${enemiesAlive}. Suggest one rotation OR site commit based on info, not generic aim advice.`
        }
        case 'rotate': {
            return 'Task: You are dead — coach your teammates through comms. One rotation or trade call.'
        }
        case 'reflect': {
            return 'Task: Round just ended. One sharp takeaway to carry into the next round (positioning, utility, or economy). No fluff.'
        }
        default:
            return 'Task: Give one immediately actionable tactical tip for the current situation.'
    }
}

/**
 * Returns a compact indicator string so the UI can show what the coach
 * is currently focusing on (e.g., "Buy Phase", "Retake", "Post-plant").
 */
export function getObjectiveLabel(): string {
    const gate = getPhaseGate()
    switch (gate.objective) {
        case 'economy': return 'Buy Phase'
        case 'retake': return 'Retake'
        case 'postplant': return 'Post-Plant'
        case 'execute': return 'Mid-Round'
        case 'rotate': return 'Spectating'
        case 'reflect': return 'Round End'
        default: return 'Standby'
    }
}
