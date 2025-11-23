const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://valorant-api.com/v1/agents?isPlayableCharacter=true';
const OUTPUT_FILE = path.join(__dirname, '../src/utils/agentAssets.ts');

// Ensure directory exists
const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

https.get(API_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.status !== 200) {
                console.error('API returned status:', json.status);
                process.exit(1);
            }

            const agents = json.data.map((agent) => ({
                uuid: agent.uuid,
                displayName: agent.displayName,
                developerName: agent.developerName,
                displayIcon: agent.displayIcon,
                fullPortrait: agent.fullPortrait,
                role: agent.role ? agent.role.displayName : 'Unknown',
                background: agent.background,
                backgroundGradientColors: agent.backgroundGradientColors,
                abilities: agent.abilities ? agent.abilities.map(a => ({
                    slot: a.slot,
                    displayName: a.displayName,
                    displayIcon: a.displayIcon
                })) : []
            }));

            // Sort alphabetically
            agents.sort((a, b) => a.displayName.localeCompare(b.displayName));

            const fileContent = `// This file is auto-generated. Do not edit manually.
// Generated from ${API_URL}

export interface AgentAsset {
    uuid: string;
    displayName: string;
    developerName: string;
    displayIcon: string;
    fullPortrait: string;
    role: string;
    background?: string;
    backgroundGradientColors?: string[];
    abilities?: {
        slot: string;
        displayName: string;
        displayIcon: string;
    }[];
}

export const AGENT_ASSETS: Record<string, AgentAsset> = {
${agents.map((agent) => `    "${agent.displayName}": {
        uuid: "${agent.uuid}",
        displayName: "${agent.displayName}",
        developerName: "${agent.developerName}",
        displayIcon: "${agent.displayIcon}",
        fullPortrait: "${agent.fullPortrait}",
        role: "${agent.role}",
        background: "${agent.background}",
        backgroundGradientColors: ${JSON.stringify(agent.backgroundGradientColors)},
        abilities: ${JSON.stringify(agent.abilities)}
    }`).join(',\n')}
};

export const AGENT_LIST = Object.values(AGENT_ASSETS);
`;

            fs.writeFileSync(OUTPUT_FILE, fileContent);
            console.log(`Successfully generated ${OUTPUT_FILE} with ${agents.length} agents.`);

        } catch (e) {
            console.error('Error parsing JSON:', e);
            process.exit(1);
        }
    });
}).on('error', (e) => {
    console.error('Error fetching data:', e);
    process.exit(1);
});
