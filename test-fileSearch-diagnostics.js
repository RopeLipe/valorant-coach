/**
 * Diagnostic script: Evaluate file search response quality
 * Outputs results to diagnostic-results.json
 */
import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "fs";

const API_KEY = "AIzaSyBKRLRt99vpDZvBtd3X3TN6KvLyuTE1Mak";
const STORE_ID = "fileSearchStores/valorant-coach-knowledge-ba-bxtfsydndmc8";
const MODEL = "gemini-3.1-flash-lite-preview";

const SYSTEM_PROMPT = `You are a sharp Valorant coach. Connect ideas and give creative angles — don't just recite textbook plays. Use callouts (Heaven, Elbow, Wine). Talk like a gamer.

CRITICAL: The retrieved files are your source of truth. Every agent, map, and ability mentioned in those files is REAL and current — even if you don't recognize the name. NEVER say "you're confusing the name" or claim an agent doesn't exist. If files mention it, it's real. Answer based on the file content.

HARD LIMIT: 1-2 sentences. Never more.

DO NOT use labels, mention AI/data/files, or give generic advice.`;

const TEST_QUERIES = [
    "how do I play reyna with a second duelist",
    "how do I play waylay",
];

function enrichQuery(query) {
    const agents = [
        'astra', 'breach', 'brimstone', 'chamber', 'clove', 'cypher', 'deadlock', 'fade',
        'gekko', 'harbor', 'iso', 'jett', 'kay/o', 'kayo', 'killjoy', 'neon', 'omen',
        'phoenix', 'raze', 'reyna', 'sage', 'skye', 'sova', 'tejo', 'veto', 'viper',
        'vyse', 'waylay', 'yoru'
    ];
    const lower = query.toLowerCase();
    for (const agent of agents) {
        if (lower.includes(agent)) {
            const name = agent === 'kayo' ? 'KAY/O' : agent.charAt(0).toUpperCase() + agent.slice(1);
            return `${query}\n\n[Search context: howtoplay ${name} guide tips abilities]`;
        }
    }
    return query;
}

async function runDiagnostic(ai, query) {
    const enrichedQuery = enrichQuery(query);
    const contents = `Ground your answer on the retrieved file content. Treat everything in the files as real and current.\n\n${enrichedQuery}`;

    const result = { query, enrichedContents: contents };

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: contents,
            config: {
                maxOutputTokens: 350,
                thinkingConfig: { thinkingLevel: "low" },
                systemInstruction: SYSTEM_PROMPT,
                tools: [{ fileSearch: { fileSearchStoreNames: [STORE_ID] } }]
            }
        });

        result.responseText = response.text;
        result.textLength = (response.text || '').length;

        // Token usage
        const usage = response.usageMetadata;
        if (usage) {
            result.tokenUsage = {
                promptTokens: usage.promptTokenCount,
                responseTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount,
                thinkingTokens: usage.thoughtsTokenCount
            };
        }

        // Candidate info
        const candidate = response.candidates?.[0];
        if (candidate) {
            result.finishReason = candidate.finishReason;

            // Extract thinking content
            if (candidate.content?.parts) {
                const thinkingParts = candidate.content.parts.filter(p => p.thought);
                const textParts = candidate.content.parts.filter(p => !p.thought && p.text);
                result.thinkingContent = thinkingParts.map(p => p.text);
                result.textParts = textParts.map(p => p.text);
                result.allParts = candidate.content.parts.map(p => ({
                    isThought: !!p.thought,
                    text: (p.text || '').substring(0, 500)
                }));
            }

            // Grounding
            const grounding = candidate.groundingMetadata;
            if (grounding) {
                result.groundingChunks = (grounding.groundingChunks || []).map(c => ({
                    uri: c.retrievedContext?.uri,
                    title: c.retrievedContext?.title,
                    textPreview: (c.retrievedContext?.text || '').substring(0, 200)
                }));
                result.groundingSupports = (grounding.groundingSupports || []).map(s => ({
                    segment: (s.segment?.text || '').substring(0, 200),
                    chunkIndices: s.groundingChunkIndices,
                    scores: s.confidenceScores
                }));
            } else {
                result.groundingChunks = [];
                result.groundingSupports = [];
            }
        }
    } catch (err) {
        result.error = err.message;
    }

    return result;
}

async function main() {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const results = [];

    for (const query of TEST_QUERIES) {
        const result = await runDiagnostic(ai, query);
        results.push(result);
        await new Promise(r => setTimeout(r, 2000));
    }

    writeFileSync("diagnostic-results.json", JSON.stringify(results, null, 2), "utf8");
    process.stdout.write("DONE - results written to diagnostic-results.json\n");
}

main().catch(e => { process.stdout.write("FATAL: " + e.message + "\n"); process.exit(1); });
