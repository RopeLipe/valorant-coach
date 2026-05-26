/**
 * Per-map callout dictionaries.
 *
 * These are injected into the Gemini system instruction when the current
 * map is known, so the coach speaks in real callouts instead of
 * generic "A site / B site" language. Names are community-standard.
 */

export type MapCallouts = {
    sites: string[]
    keyAreas: string[]
}

const CALLOUTS: Record<string, MapCallouts> = {
    Ascent: {
        sites: ['A Main', 'A Garden', 'A Generator', 'A Dice', 'A Rafters', 'B Main', 'B Stairs', 'B Back Site', 'B Lane'],
        keyAreas: ['Mid Catwalk', 'Mid Link', 'Mid Pizza', 'Mid Market', 'Mid Top', 'Heaven', 'Tree'],
    },
    Bind: {
        sites: ['A Short', 'A Lamps', 'A Elbow', 'A Showers', 'A Bath', 'B Long', 'B Window', 'B Hookah', 'B Elbow'],
        keyAreas: ['Teleporter A', 'Teleporter B', 'Truck', 'U-Hall', 'Fountain'],
    },
    Haven: {
        sites: ['A Long', 'A Short', 'A Link', 'A Sewer', 'A Heaven', 'B Site', 'B Garage', 'B Back', 'C Long', 'C Garage', 'C Cubby', 'C Window'],
        keyAreas: ['Mid Window', 'Mid Courtyard', 'Mid Doors'],
    },
    Split: {
        sites: ['A Main', 'A Lobby', 'A Screens', 'A Ramps', 'A Rafters', 'A Tower', 'B Main', 'B Back', 'B Alley', 'B Tower'],
        keyAreas: ['Mid Vent', 'Mid Mail', 'Mid Sewer', 'Rope'],
    },
    Icebox: {
        sites: ['A Site', 'A Belt', 'A Rafters', 'A Screens', 'A Pipes', 'B Site', 'B Green', 'B Yellow', 'B Orange', 'B Tube', 'B Boiler'],
        keyAreas: ['Mid', 'Kitchen', 'Nest'],
    },
    Breeze: {
        sites: ['A Main', 'A Shop', 'A Hall', 'A Pyramids', 'A Cave', 'B Main', 'B Elbow', 'B Bridge', 'B Tunnel', 'B Back'],
        keyAreas: ['Mid Top', 'Mid Bottom', 'Mid Wood'],
    },
    Fracture: {
        sites: ['A Main', 'A Drop', 'A Dish', 'A Rope', 'A Hall', 'B Main', 'B Tower', 'B Tree', 'B Arcade', 'B Canteen'],
        keyAreas: ['Dorms', 'Generator', 'Bridge'],
    },
    Pearl: {
        sites: ['A Main', 'A Dugout', 'A Art', 'A Screens', 'A Link', 'B Main', 'B Hall', 'B Club', 'B Tower'],
        keyAreas: ['Mid Connector', 'Mid Top', 'Mid Doors', 'Mid Shops'],
    },
    Lotus: {
        sites: ['A Main', 'A Rubble', 'A Tree', 'A Drop', 'A Hut', 'B Main', 'B Drop', 'B Waterfall', 'C Main', 'C Mound', 'C Tree', 'C Hall'],
        keyAreas: ['A Door', 'B Door', 'C Door', 'Root'],
    },
    Sunset: {
        sites: ['A Main', 'A Lobby', 'A Alley', 'A Back', 'A Elbow', 'B Main', 'B Market', 'B Boba', 'B Tiles'],
        keyAreas: ['Mid Courtyard', 'Mid Top', 'Mid Bottom'],
    },
    Abyss: {
        sites: ['A Main', 'A Top', 'A Back', 'A Link', 'B Main', 'B Back', 'B Nest', 'B Tree'],
        keyAreas: ['Mid', 'Bridge'],
    },
    Corrode: {
        sites: ['A Main', 'A Site', 'B Main', 'B Site'],
        keyAreas: ['Mid'],
    },
}

/**
 * Return callouts for a given map, or null if we don't have coverage.
 * Map names are matched case-insensitively.
 */
export function getMapCallouts(mapName: string | undefined | null): MapCallouts | null {
    if (!mapName) return null
    const key = Object.keys(CALLOUTS).find(k => k.toLowerCase() === mapName.toLowerCase())
    return key ? CALLOUTS[key] : null
}

/**
 * Return a compact single-line callout reference ready for a system prompt.
 */
export function formatCalloutsForPrompt(mapName: string | undefined | null): string {
    const c = getMapCallouts(mapName)
    if (!c) return ''
    return `Sites: ${c.sites.join(', ')}. Key areas: ${c.keyAreas.join(', ')}.`
}
