/**
 * Valorant Economy Reference
 * Weapon prices and economy rules for AI buy advice
 */

export const WEAPON_PRICES: Record<string, number> = {
    // Sidearms (Pistols)
    'Classic': 0,      // Free
    'Shorty': 150,
    'Frenzy': 450,
    'Ghost': 500,
    'Sheriff': 800,

    // SMGs
    'Stinger': 950,
    'Spectre': 1600,

    // Shotguns
    'Bucky': 850,
    'Judge': 1850,

    // Rifles
    'Bulldog': 2050,
    'Guardian': 2250,
    'Phantom': 2900,
    'Vandal': 2900,

    // Snipers
    'Marshal': 950,
    'Outlaw': 2400,
    'Operator': 4700,

    // Machine Guns
    'Ares': 1600,
    'Odin': 3200,
}

export const SHIELD_PRICES: Record<string, number> = {
    'Light Shield': 400,  // 25 armor
    'Heavy Shield': 1000, // 50 armor
}

// Standard starting credits
export const PISTOL_ROUND_CREDITS = 800
export const ROUND_WIN_BONUS = 3000
export const ROUND_LOSS_BASE = 1900 // Increases with loss streak

// Full buy thresholds
export const FULL_BUY_THRESHOLD = 3900 // Vandal/Phantom + Heavy Shield
export const OPERATOR_THRESHOLD = 5700 // Operator + Heavy Shield

/**
 * Get list of weapons affordable with given credits
 */
export function getAffordableWeapons(credits: number): string[] {
    return Object.entries(WEAPON_PRICES)
        .filter(([_, price]) => price <= credits)
        .map(([weapon]) => weapon)
        .sort((a, b) => WEAPON_PRICES[b] - WEAPON_PRICES[a]) // Most expensive first
}

/**
 * Get best affordable rifle/sniper for a player
 */
export function getBestAffordableGun(credits: number): string {
    const affordable = getAffordableWeapons(credits)
    // Prioritize: Vandal/Phantom > Guardian > Bulldog > Spectre > Marshal
    const priorities = ['Vandal', 'Phantom', 'Operator', 'Guardian', 'Outlaw', 'Bulldog', 'Spectre', 'Marshal', 'Ares', 'Judge', 'Bucky', 'Stinger', 'Sheriff', 'Ghost', 'Frenzy', 'Shorty', 'Classic']
    for (const gun of priorities) {
        if (affordable.includes(gun)) {
            const price = WEAPON_PRICES[gun]
            // Check if can afford gun + at least light shield
            if (credits >= price + SHIELD_PRICES['Light Shield']) {
                return gun
            }
        }
    }
    return affordable[0] || 'Classic'
}

/**
 * Generate economy advice context for AI - single player
 */
export function getEconomyContext(credits: number): string {
    if (credits <= 0) return 'Credits: Unknown'

    const affordable = getAffordableWeapons(credits)
    const canBuyLight = credits >= SHIELD_PRICES['Light Shield']
    const canBuyHeavy = credits >= SHIELD_PRICES['Heavy Shield']

    let economyType = 'unknown'
    if (credits <= 800) {
        economyType = 'PISTOL ROUND'
    } else if (credits < 2000) {
        economyType = 'ECO/SAVE'
    } else if (credits < FULL_BUY_THRESHOLD) {
        economyType = 'FORCE BUY'
    } else {
        economyType = 'FULL BUY'
    }

    const shieldStatus = canBuyHeavy ? 'can buy Heavy' : (canBuyLight ? 'can buy Light only' : 'no shield affordable')

    // For pistol round, be explicit about limitations
    if (credits <= 800) {
        return `Economy: ${economyType} (${credits} credits). ONLY Ghost (500) or abilities+light shield. NO Sheriff (800) leaves no shield.`
    }

    // Top 3 affordable weapons
    const topWeapons = affordable.slice(0, 3).join(', ') || 'None'

    return `Economy: ${economyType} (${credits} credits). Best affordable: ${topWeapons}. Shield: ${shieldStatus}.`
}

/**
 * Type for player economy data
 */
export interface PlayerEconomy {
    name: string
    agent: string
    credits: number
    isLocal: boolean
}

/**
 * Generate full team economy context for AI
 * This tells the AI exactly what each player can afford
 */
export function getTeamEconomyContext(players: PlayerEconomy[]): string {
    if (!players.length) return 'Team Economy: Unknown'

    const lines: string[] = []
    let teamTotal = 0
    let canFullBuy = 0
    let canBuyOp = 0
    let needsEco = 0

    for (const p of players) {
        teamTotal += p.credits

        if (p.credits >= OPERATOR_THRESHOLD) {
            canBuyOp++
            canFullBuy++
        } else if (p.credits >= FULL_BUY_THRESHOLD) {
            canFullBuy++
        } else if (p.credits < 2000) {
            needsEco++
        }

        const bestGun = getBestAffordableGun(p.credits)
        const canHeavy = p.credits >= WEAPON_PRICES[bestGun] + SHIELD_PRICES['Heavy Shield']
        const shieldStr = canHeavy ? '+Heavy' : (p.credits >= WEAPON_PRICES[bestGun] + SHIELD_PRICES['Light Shield'] ? '+Light' : '')

        const prefix = p.isLocal ? '(ME) ' : ''
        lines.push(`  ${prefix}${p.agent}: ${p.credits} → ${bestGun}${shieldStr}`)
    }

    // Team summary
    let buyCall = 'ECO/SAVE'
    if (canFullBuy >= 4) {
        buyCall = canBuyOp >= 1 ? 'FULL BUY (OP viable for 1)' : 'FULL BUY'
    } else if (canFullBuy >= 2) {
        buyCall = 'FORCE BUY'
    } else if (needsEco >= 3) {
        buyCall = 'FULL ECO - DO NOT BUY'
    }

    // Critical warning if OP is NOT affordable by anyone
    const opWarning = canBuyOp === 0 ? '\n⚠️ NO ONE CAN AFFORD OPERATOR (needs 5700+)' : ''

    return `Team Economy (${teamTotal} total): ${buyCall}${opWarning}\n${lines.join('\n')}`
}
