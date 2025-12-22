/**
 * Weapon code to human-readable name mapping
 * Based on Overwolf GEP documentation for Valorant
 */

// Kill Feed weapon codes
export const KILLFEED_WEAPON_MAP: Record<string, string> = {
    // Pistols
    'TX_Hud_Pistol_Glock_S': 'Classic',
    'TX_Hud_Pistol_SawedOff_S': 'Shorty',
    'TX_Hud_AutoPistol': 'Frenzy',
    'TX_Hud_Pistol_Luger_S': 'Ghost',
    'TX_Hud_Pistol_Revolver_S': 'Sheriff',
    // Shotguns
    'TX_Hud_Pump': 'Bucky',
    'TX_Hud_Shotguns_Spas12_S': 'Judge',
    // SMGs
    'TX_Hud_Vector': 'Stinger',
    'TX_Hud_SMG_MP5_S': 'Spectre',
    // Rifles
    'TX_Hud_Burst': 'Bulldog',
    'tx_hud_dmr': 'Guardian',
    'TX_Hud_Assault_AR10A2_S': 'Phantom',
    'TX_Hud_Volcano': 'Vandal',
    // Snipers
    'TX_Hud_Sniper_BoltAction_S': 'Marshal',
    'TX_Hud_Operator': 'Operator',
    'TX_Hud_DoubleSniper': 'Outlaw',
    // Machine Guns
    'TX_Hud_LMG': 'Ares',
    'TX_Hud_HMG': 'Odin',
    // Knife
    'TX_Hud_Knife_Standard_S': 'Knife',
    // Abilities
    'TX_Breach_FusionBlast': 'Breach Aftershock',
    'TX_Sarge_MolotovLauncher': 'Brimstone Incendiary',
    'TX_Sarge_OrbitalStrike': 'Brimstone Orbital Strike',
    'TX_Pheonix_FireWall': 'Phoenix Blaze',
    'TX_Pheonix_Molotov': 'Phoenix Hot Hands',
    'TX_Hunter_ShockArrow': 'Sova Shock Bolt',
    'TX_Hunter_BowBlast': 'Sova Hunters Fury',
    'TX_Hud_Deadeye_Q_Pistol': 'Chamber Headhunter',
    'TX_Hud_Deadeye_X_GiantSlayer': 'Chamber Tour de Force',
    'TX_Cable_FishingHook': 'Deadlock Annihilation',
    'TX_Hud_Wushu_X_Dagger': 'Jett Blade Storm',
    'TX_Neon_Ult': 'Neon Overdrive',
    'TX_Thorne_Heal': 'Sage Resurrection',
    'TX_Gumshoe_Tripwire': 'Cypher Trapwire',
    'TX_Gren_Icon': 'KAY/O Frag/ment',
    'TX_Aggrobot_Bubbles': 'Gekko Mosh Pit',
    'TX_KJ_Bees': 'Killjoy Nanoswarm',
    'tx_KJ_turret': 'Killjoy Turret',
    'TX_Clay_Boomba': 'Raze Boom Bot',
    'TX_Clay_ClusterBomb': 'Raze Paint Shells',
    'TX_Clay_RocketLauncher': 'Raze Showstopper',
    'TX_Guide4': 'Skye Trailblazer',
    'TX_Pandemic_AcidLauncher': 'Viper Snake Bite',
    'TX_UI_Cashew_E': 'Tejo Guided Salvo',
    'TX_UI_Cashew_X': 'Tejo Armageddon',
    // Spike/Fall damage
    'spike': 'Spike',
    'fall': 'Fall Damage',
}

// Scoreboard weapon codes (slightly different format)
export const SCOREBOARD_WEAPON_MAP: Record<string, string> = {
    'TX_Hud_Pistol_Classic': 'Classic',
    'TX_Hud_Pistol_Slim': 'Shorty',
    'TX_Hud_Pistol_AutoPistol': 'Frenzy',
    'TX_Hud_Pistol_Luger': 'Ghost',
    'TX_Hud_Pistol_Sheriff': 'Sheriff',
    'TX_Hud_Shotguns_Pump': 'Bucky',
    'TX_Hud_Shotguns_Persuader': 'Judge',
    'TX_Hud_SMGs_Vector': 'Stinger',
    'TX_Hud_SMGs_Ninja': 'Spectre',
    'TX_Hud_Rifles_Burst': 'Bulldog',
    'TX_Hud_Rifles_DMR': 'Guardian',
    'TX_Hud_Rifles_Ghost': 'Phantom',
    'TX_Hud_Rifles_Volcano': 'Vandal',
    'TX_Hud_Sniper_Bolt': 'Marshal',
    'TX_Hud_Sniper_Operater': 'Operator',
    'TX_Hud_Sniper_DoubleSniper': 'Outlaw',
    'TX_Hud_LMG': 'Ares',
    'TX_Hud_HMG': 'Odin',
    'knife': 'Knife',
}

/**
 * Get human-readable weapon name from Overwolf code
 */
export function getWeaponName(code: string): string {
    if (!code) return 'Unknown'

    // Try kill feed map first (more comprehensive)
    const killFeedMatch = KILLFEED_WEAPON_MAP[code]
    if (killFeedMatch) return killFeedMatch

    // Try scoreboard map
    const scoreboardMatch = SCOREBOARD_WEAPON_MAP[code]
    if (scoreboardMatch) return scoreboardMatch

    // Try case-insensitive match
    const lowerCode = code.toLowerCase()
    for (const [key, value] of Object.entries(KILLFEED_WEAPON_MAP)) {
        if (key.toLowerCase() === lowerCode) return value
    }

    // Extract readable name from code if no match
    // e.g., "TX_Hud_Something_Weapon" -> "Weapon"
    const parts = code.split('_')
    if (parts.length > 0) {
        return parts[parts.length - 1].replace(/[^a-zA-Z]/g, '')
    }

    return code
}

/**
 * Shield value to name mapping
 */
export function getShieldName(value: number): string {
    switch (value) {
        case 0: return 'No Shield'
        case 1: return 'Light Shield (25)'
        case 2: return 'Heavy Shield (50)'
        case 3: return 'Unknown Shield'
        case 4: return 'Regen Shield (25)'
        default: return 'Unknown'
    }
}
