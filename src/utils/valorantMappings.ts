export const MAP_NAME_MAP: Record<string, string> = {
    "Infinity": "Abyss",
    "Triad": "Haven",
    "Duality": "Bind",
    "Bonsai": "Split",
    "Ascent": "Ascent",
    "Port": "Icebox",
    "Foxtrot": "Breeze",
    "Canyon": "Fracture",
    "Pitt": "Pearl",
    "Jam": "Lotus",
    "Juliett": "Sunset",
    "Rook": "Corrode",
    "Range": "Practice Range",
    "HURM_Alley": "District",
    "HURM_Yard": "Piazza",
    "HURM_Bowl": "Kasbah",
    "HURM_Helix": "Drift",
    "HURM_HighTide": "Glitch",
    6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
    9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
    12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
    15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
    18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
    21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
    24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3",
    27: "Radiant"
};

export function getMapName(internalName: string): string {
    return MAP_NAME_MAP[internalName] || internalName;
}

export function getRankName(rankId: number): string {
    return RANK_MAP[rankId] || `Rank ${rankId}`;
}
