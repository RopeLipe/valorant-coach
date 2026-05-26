export const AGENT_ID_MAP: Record<string, string> = {
    // Long IDs
    "Clay_PC_C": "Raze",
    "Pandemic_PC_C": "Viper",
    "Wraith_PC_C": "Omen",
    "Hunter_PC_C": "Sova",
    "Thorne_PC_C": "Sage",
    "Phoenix_PC_C": "Phoenix",
    "Wushu_PC_C": "Jett",
    "Gumshoe_PC_C": "Cypher",
    "Sarge_PC_C": "Brimstone",
    "Breach_PC_C": "Breach",
    "Vampire_PC_C": "Reyna",
    "Killjoy_PC_C": "Killjoy",
    "Guide_PC_C": "Skye",
    "Stealth_PC_C": "Yoru",
    "Rift_PC_C": "Astra",
    "Grenadier_PC_C": "KAY/O",
    "Deadeye_PC_C": "Chamber",
    "Sprinter_PC_C": "Neon",
    "BountyHunter_PC_C": "Fade",
    "Mage_PC_C": "Harbor",
    "AggroBot_PC_C": "Gekko",
    "Cable_PC_C": "Deadlock",
    "Sequoia_PC_C": "Iso",
    "Smonk_PC_C": "Clove",
    "Nox_PC_C": "Vyse",
    "Cashew_PC_C": "Tejo",
    "Terra_PC_C": "Waylay",
    "Pine_PC_C": "Veto",

    // Short IDs (seen in match_info)
    "Clay": "Raze",
    "Pandemic": "Viper",
    "Wraith": "Omen",
    "Hunter": "Sova",
    "Thorne": "Sage",
    "Phoenix": "Phoenix",
    "Wushu": "Jett",
    "Gumshoe": "Cypher",
    "Sarge": "Brimstone",
    "Breach": "Breach",
    "Vampire": "Reyna",
    "Killjoy": "Killjoy",
    "Guide": "Skye",
    "Stealth": "Yoru",
    "Rift": "Astra",
    "Grenadier": "KAY/O",
    "Deadeye": "Chamber",
    "Sprinter": "Neon",
    "BountyHunter": "Fade",
    "Mage": "Harbor",
    "AggroBot": "Gekko",
    "Cable": "Deadlock",
    "Sequoia": "Iso",
    "Smonk": "Clove",
    "Nox": "Vyse",
    "Cashew": "Tejo",
    "Terra": "Waylay",
    "Pine": "Veto"
};

export function getAgentName(id: string): string {
    if (!id) return "Unknown";

    // 1. Exact match
    if (AGENT_ID_MAP[id]) return AGENT_ID_MAP[id];

    // 2. Case-insensitive match
    const lowerId = id.toLowerCase();
    for (const key in AGENT_ID_MAP) {
        if (key.toLowerCase() === lowerId) return AGENT_ID_MAP[key];
    }

    // 3. Substring match (if id is "Characters/Clay_PC_C")
    for (const key in AGENT_ID_MAP) {
        if (id.includes(key)) return AGENT_ID_MAP[key];
    }

    return id;
}
