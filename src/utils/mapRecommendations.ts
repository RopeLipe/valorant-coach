export const MAP_RECOMMENDATIONS: Record<string, string[]> = {
    "Ascent": ["Jett", "Sova", "Omen"],
    "Bind": ["Raze", "Viper", "Skye"],
    "Breeze": ["Jett", "Viper", "Sova"],
    "Fracture": ["Breach", "Raze", "Brimstone"],
    "Haven": ["Jett", "Sova", "Breach"],
    "Icebox": ["Jett", "Viper", "Sova"],
    "Lotus": ["Raze", "Viper", "Omen"],
    "Pearl": ["Jett", "Viper", "Astra"],
    "Split": ["Raze", "Viper", "Omen"],
    "Sunset": ["Raze", "Viper", "Omen"],
    "Abyss": ["Jett", "Sova", "Omen"], // Guess for new map
    // Fallback
    "Unknown": ["Jett", "Reyna", "Omen"]
};

export function getRecommendations(mapName: string): string[] {
    if (!mapName) return MAP_RECOMMENDATIONS["Unknown"];
    // Simple case-insensitive partial match
    const key = Object.keys(MAP_RECOMMENDATIONS).find(k => mapName.toLowerCase().includes(k.toLowerCase()));
    return MAP_RECOMMENDATIONS[key || "Unknown"];
}
