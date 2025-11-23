
const https = require('https');

const API_KEY = 'RGAPI-95a3c136-ee6a-4cf0-98e2-74d09925e7c1';
const NAME = 'EC Z1n3x';
const TAG = 'ELITE';

function request(hostname, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            path: path,
            method: 'GET',
            headers: {
                'X-Riot-Token': API_KEY
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    data: data
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    });
}

async function test() {
    console.log(`Testing API Key: ${API_KEY}`);
    const regions = ['americas', 'europe', 'asia', 'esports'];

    for (const region of regions) {
        console.log(`\nTesting Region: ${region.toUpperCase()}...`);
        try {
            const hostname = `${region}.api.riotgames.com`;
            const accountRes = await request(hostname, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(NAME)}/${encodeURIComponent(TAG)}`);
            console.log(`Status: ${accountRes.statusCode} ${accountRes.statusMessage}`);

            if (accountRes.statusCode === 200) {
                console.log(`SUCCESS! Found account in ${region}`);
                const account = JSON.parse(accountRes.data);
                console.log('PUUID:', account.puuid);

                // Test Match History in this region
                console.log(`Testing Match History in ${region}...`);
                const matchRes = await request(hostname, `/val/match/v1/matchlists/by-puuid/${account.puuid}`);
                console.log(`Match History Status: ${matchRes.statusCode}`);

                // Test Ranked Data in this region
                console.log(`Testing Ranked Data in ${region}...`);
                const rankRes = await request(hostname, `/val/ranked/v1/by-puuid/${account.puuid}`);
                console.log(`Ranked Data Status: ${rankRes.statusCode}`);

                return;
            } else if (accountRes.statusCode === 403) {
                console.log('403 Forbidden - Key invalid.');
            } else {
                console.log('Error:', accountRes.data);
            }
        } catch (e) {
            console.error(`Failed to test ${region}:`, e.message);
        }
    }
}

test();
