
export function getEconomyState(credits: number, roundNumber: number): string {
    if (roundNumber === 1 || roundNumber === 13) {
        return "Pistol Round";
    }

    if (credits < 3300) {
        return "Save / Eco";
    }

    if (credits >= 3300 && credits < 3900) {
        return "Light Buy / Force";
    }

    if (credits >= 3900) {
        return "Full Buy";
    }

    return "Unknown";
}

export function getAffordableLoadout(credits: number): string {
    const costs = {
        fullArmor: 1000,
        lightArmor: 400,
        vandal: 2900,
        phantom: 2900,
        operator: 4700,
        sheriff: 800,
        spectre: 1600,
        utilAvg: 600 // rough estimate for full util
    };

    if (credits >= costs.operator + costs.fullArmor) {
        return "Operator + Full Armor + Utility";
    }

    if (credits >= costs.vandal + costs.fullArmor + costs.utilAvg) {
        return "Rifle (Vandal/Phantom) + Full Armor + Full Utility";
    }

    if (credits >= costs.vandal + costs.lightArmor) {
        return "Rifle + Light Armor (Glass Cannon)";
    }

    if (credits >= costs.spectre + costs.fullArmor) {
        return "SMG + Full Armor + Utility";
    }

    if (credits >= costs.sheriff + costs.lightArmor) {
        return "Sheriff + Light Armor";
    }

    return "Pistol / Save";
}

export function getTeamEconomyState(teamCredits: number[], roundNumber: number): string {
    if (!teamCredits || teamCredits.length === 0) return "Unknown";

    if (roundNumber === 1 || roundNumber === 13) {
        return "Pistol Round";
    }

    const avgCredits = teamCredits.reduce((a, b) => a + b, 0) / teamCredits.length;
    const buys = teamCredits.filter(c => c >= 3900).length;
    const forces = teamCredits.filter(c => c >= 3300 && c < 3900).length;
    const saves = teamCredits.filter(c => c < 3300).length;

    if (buys >= 4) return "Full Buy";
    if (saves >= 4) return "Save / Eco";
    if (buys + forces >= 4) return "Force Buy";

    return `Mixed Economy (Avg: ${Math.round(avgCredits)})`;
}
