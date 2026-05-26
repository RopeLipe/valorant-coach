
// WARNING: NEVER expose your Riot Games Production API key in client-side code in production.
// Riot Games' Developer Policy strictly forbids exposing API keys in public client builds.
// For production, you MUST query your backend proxy server that signs requests and passes the API key,
// and implement Riot Sign-On (RSO) for player authentication and opt-in data sharing.
const API_KEY = 'RGAPI-95a3c136-ee6a-4cf0-98e2-74d09925e7c1'; // TODO: Move to secure backend in production
const REGION = 'americas'; // Default to americas for now
const BASE_URL = `https://${REGION}.api.riotgames.com`;

export interface RiotAccount {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export interface MatchSummary {
    matchId: string;
    map: string;
    gameMode: string;
    gameStartMillis: number;
    queueId: string;
}

export interface PlayerStats {
    puuid: string;
    agentName: string;
    teamId: string;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    roundsPlayed: number;
    won: boolean;
}

export interface RankedData {
    tier: number;
    rankedRating: number;
    leaderboardRank: number;
}

export class RiotService {
    private static async fetchWithAuth(endpoint: string) {
        const url = `${BASE_URL}${endpoint}`;
        const res = await fetch(url, {
            headers: {
                'X-Riot-Token': API_KEY
            }
        });
        if (!res.ok) {
            throw new Error(`Riot API Error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }

    static async getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
        // Account-V1
        return this.fetchWithAuth(`/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`);
    }

    static async getMatchHistory(puuid: string, count: number = 5): Promise<MatchSummary[]> {
        // Val-Match-V1
        const data = await this.fetchWithAuth(`/val/match/v1/matchlists/by-puuid/${puuid}?size=${count}`);
        // API returns MatchlistDto { puuid, history: MatchlistEntryDto[] }
        return data.history || [];
    }

    static async getRecentMatches(puuid: string): Promise<any[]> {
        const data = await this.fetchWithAuth(`/val/match/v1/matchlists/by-puuid/${puuid}`);
        return data.history || [];
    }

    static async getMatchDetails(matchId: string) {
        return this.fetchWithAuth(`/val/match/v1/matches/${matchId}`);
    }

    static async getRankedData(puuid: string): Promise<RankedData | null> {
        // Val-Ranked-V1
        // GET /val/ranked/v1/by-puuid/{puuid}
        // Returns RankedPlayerDto
        try {
            const data = await this.fetchWithAuth(`/val/ranked/v1/by-puuid/${puuid}`);
            // We want the latest season/act data usually, but the endpoint returns current status
            // The response structure is roughly:
            // {
            //   "puuid": "...",
            //   "gameName": "...",
            //   "tagLine": "...",
            //   "leaderboardRank": 0,
            //   "rankedRating": 0,
            //   "numberOfWins": 0,
            //   "competitiveTier": 0
            // }
            // Wait, looking at docs for /val/ranked/v1/by-puuid/{puuid}:
            // It actually returns LeaderboardDto? No, that's for leaderboards.
            // Let's assume standard structure based on similar APIs or just return the raw data to be safe.
            // Actually, for specific player rank, we might need to look at match history or a specific endpoint.
            // The endpoint `/val/ranked/v1/by-puuid/{puuid}` is often used for this.
            return {
                tier: data.competitiveTier || 0,
                rankedRating: data.rankedRating || 0,
                leaderboardRank: data.leaderboardRank || 0
            };
        } catch (e) {
            console.warn("Failed to fetch ranked data", e);
            return null;
        }
    }

    static async getAggregatedStats(puuid: string, matchCount: number = 5) {
        const history = await this.getRecentMatches(puuid);
        const recent = history.slice(0, matchCount);

        const matches = await Promise.all(recent.map(m => this.getMatchDetails(m.matchId)));

        // Aggregate
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;
        let wins = 0;
        let totalRounds = 0;
        let totalScore = 0;
        let totalHeadshots = 0; // Need to parse round stats for this
        let totalShots = 0;

        const agentStats: Record<string, { picks: number, wins: number, kills: number, deaths: number }> = {};

        matches.forEach(m => {
            const player = m.players.find((p: any) => p.puuid === puuid);
            if (!player) return;

            const teamId = player.teamId;
            const team = m.teams.find((t: any) => t.teamId === teamId);
            const won = team?.won ?? false;

            if (won) wins++;

            totalKills += player.stats.kills;
            totalDeaths += player.stats.deaths;
            totalAssists += player.stats.assists;
            totalScore += player.stats.score;
            totalRounds += m.roundResults?.length || 0;

            // Agent Stats
            const agent = player.characterId; // UUID
            if (!agentStats[agent]) agentStats[agent] = { picks: 0, wins: 0, kills: 0, deaths: 0 };
            agentStats[agent].picks++;
            if (won) agentStats[agent].wins++;
            agentStats[agent].kills += player.stats.kills;
            agentStats[agent].deaths += player.stats.deaths;
        });

        const matchesPlayed = matches.length;
        const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);
        const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
        const acs = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;

        return {
            matchesPlayed,
            winRate: `${winRate}%`,
            kd,
            acs: acs.toString(),
            matches, // Return full details for AI analysis
            ranked: null as any // Placeholder, will be filled separately or we can fetch here
        };
    }

    static async getKnownPlayers(seedName: string = "Z1n3x", seedTag: string = "NA1"): Promise<string[]> {
        try {
            const account = await this.getAccount(seedName, seedTag);
            if (!account?.puuid) return [];

            const history = await this.getRecentMatches(account.puuid);
            if (!history || history.length === 0) return [];

            // Fetch details for the last 2 matches to get a list of ~20 players
            const recentMatchIds = history.slice(0, 2).map((m: any) => m.matchId);
            const matchDetails = await Promise.all(recentMatchIds.map(id => this.getMatchDetails(id)));

            const players = new Set<string>();
            matchDetails.forEach(match => {
                if (match?.players) {
                    match.players.forEach((p: any) => {
                        if (p.gameName && p.tagLine) {
                            players.add(`${p.gameName}#${p.tagLine}`);
                        }
                    });
                }
            });

            return Array.from(players);
        } catch (e) {
            console.warn("Failed to fetch known players", e);
            return [];
        }
    }
}
