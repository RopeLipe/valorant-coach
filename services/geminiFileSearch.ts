/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enhanced Gemini File Search Service
 * Implements advanced features from https://ai.google.dev/gemini-api/docs/file-search
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RagStore, Document, QueryResult } from '../types';
import { AGENT_ASSETS } from '../src/utils/agentAssets';
import { formatCalloutsForPrompt } from '../src/utils/mapCallouts';

let ai: GoogleGenAI;

/**
 * Get API key from environment (works in both browser and Node.js)
 */
function getApiKey(): string {
    // Browser/Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_GEMINI_API_KEY;
    }

    // Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    }

    throw new Error('No API key found. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY in environment.');
}

export function initialize(apiKey?: string) {
    const key = apiKey || getApiKey();

    if (!key) {
        throw new Error('Gemini API key is required. Set VITE_GEMINI_API_KEY in .env.local');
    }

    ai = new GoogleGenAI({ apiKey: key });
}

export function getClient(): GoogleGenAI {
    if (!ai) {
        initialize();
    }
    return ai;
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========== CORPUS/STORE MANAGEMENT ==========

export async function listRagStores(): Promise<RagStore[]> {
    if (!ai) throw new Error("Gemini AI not initialized");

    try {
        const response = await ai.fileSearchStores.list();
        const stores: RagStore[] = [];
        for await (const store of response) {
            stores.push(store);
        }
        return stores;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

        if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else if (errorMessage.includes('permission')) {
            throw new Error("Permission denied. Your API key may not have access to list RAG stores.");
        } else {
            throw new Error(`Failed to list RAG stores: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

export async function createRagStore(displayName: string, description?: string): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        throw new Error("Invalid display name: must be a non-empty string");
    }

    try {
        const ragStore = await ai.fileSearchStores.create({
            config: {
                displayName,
                ...(description && { description })
            }
        });

        if (!ragStore.name) {
            throw new Error("Failed to create RAG store: name is missing from response.");
        }

        return ragStore.name;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

        if (errorMessage.includes('already exists')) {
            throw new Error(`A RAG store with the name "${displayName}" already exists.`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else if (errorMessage.includes('permission')) {
            throw new Error("Permission denied. Your API key may not have access to create RAG stores.");
        } else {
            throw new Error(`Failed to create RAG store "${displayName}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

export async function deleteRagStore(ragStoreName: string): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }

    try {
        await ai.fileSearchStores.delete({
            name: ragStoreName,
            config: { force: true },
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`RAG store not found: ${ragStoreName}. It may have already been deleted.`);
        } else if (errorMessage.includes('permission') || errorMessage.includes('invalid_argument')) {
            throw new Error(`Permission denied or invalid resource. Verify your API key has proper access to delete: ${ragStoreName}`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else {
            throw new Error(`Failed to delete RAG store "${ragStoreName}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

// ========== DOCUMENT MANAGEMENT ==========

export async function listDocuments(ragStoreName: string): Promise<Document[]> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }

    try {
        const response = await ai.fileSearchStores.documents.list({
            parent: ragStoreName,
            pageSize: 100
        });

        const files: Document[] = [];
        for await (const file of response) {
            files.push(file);
        }

        return files;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`RAG store not found: ${ragStoreName}. Please verify it exists.`);
        } else if (errorMessage.includes('permission')) {
            throw new Error(`Permission denied. Your API key may not have access to list documents in: ${ragStoreName}`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else {
            console.error(`Failed to list documents for ${ragStoreName}`, err);
            return [];
        }
    }
}

export async function deleteDocument(docName: string): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!docName || typeof docName !== 'string') {
        throw new Error("Invalid document name: must be a non-empty string");
    }

    if (!docName.includes('fileSearchStores/') || !docName.includes('/documents/')) {
        throw new Error(`Invalid document name format. Expected: fileSearchStores/{storeName}/documents/{documentId}, received: ${docName}`);
    }

    try {
        await ai.fileSearchStores.documents.delete({ name: docName });
    } catch (err) {
        const fullErrorMessage = extractErrorMessage(err);
        const errorMessage = fullErrorMessage.toLowerCase();

        console.error("Delete document error:", err);

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`Document not found. It may have already been deleted or the name is incorrect.`);
        } else if (errorMessage.includes('permission') || errorMessage.includes('invalid_argument')) {
            throw new Error(`Permission denied or invalid resource. Verify the document exists and your API key has proper access.`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else {
            throw new Error(`Failed to delete document: ${fullErrorMessage}`);
        }
    }
}

// ========== FILE UPLOAD WITH CHUNKING & METADATA ==========

export interface ChunkingConfig {
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
}

export interface CustomMetadata {
    key: string;
    stringValue?: string;
    numericValue?: number;
}

export interface UploadOptions {
    displayName?: string;
    chunkingConfig?: ChunkingConfig;
    customMetadata?: CustomMetadata[];
}

/**
 * Upload a file to RAG store with advanced options
 * Supports chunking configuration and custom metadata
 * 
 * Best Practice: Use chunkingConfig to optimize retrieval.
 * Recommended: maxTokensPerChunk: 400, maxOverlapTokens: 40 for tactical guides.
 */
export async function uploadToRagStore(
    ragStoreName: string,
    file: File,
    options?: UploadOptions
): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid file: must be a File object");
    }

    try {
        const uploadConfig: any = {
            fileSearchStoreName: ragStoreName,
            file: file
        };

        // Add optional configuration
        if (options) {
            const config: any = {};

            if (options.displayName) {
                config.displayName = options.displayName;
            }

            // Default chunking config if not provided
            // Optimized for tactical advice: smaller chunks (200 tokens) to isolate specific tips
            const chunkingConfig = options?.chunkingConfig || {
                maxTokensPerChunk: 200,
                maxOverlapTokens: 20
            };

            config.chunkingConfig = {
                whiteSpaceConfig: {
                    maxTokensPerChunk: chunkingConfig.maxTokensPerChunk,
                    maxOverlapTokens: chunkingConfig.maxOverlapTokens
                }
            };

            if (options.customMetadata && options.customMetadata.length > 0) {
                config.customMetadata = options.customMetadata;
            }

            if (Object.keys(config).length > 0) {
                uploadConfig.config = config;
            }
        }

        let op = await ai.fileSearchStores.uploadToFileSearchStore(uploadConfig);

        // Poll for operation completion with timeout
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max

        while (!op.done && attempts < maxAttempts) {
            await delay(1000);
            op = await ai.operations.get({ operation: op });
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new Error(`Upload timeout: Operation took longer than ${maxAttempts} seconds`);
        }

        if (op.error) {
            throw new Error(`Upload failed: ${op.error.message}`);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`RAG store not found: ${ragStoreName}. Please verify it exists.`);
        } else if (errorMessage.includes('permission')) {
            throw new Error(`Permission denied. Your API key may not have upload access to: ${ragStoreName}`);
        } else if (errorMessage.includes('file size') || errorMessage.includes('too large')) {
            throw new Error(`File "${file.name}" is too large. Max size: 100MB`);
        } else if (errorMessage.includes('unsupported') || errorMessage.includes('file type')) {
            throw new Error(`File type not supported for "${file.name}". Please check supported file formats.`);
        } else {
            throw new Error(`Failed to upload "${file.name}" to ${ragStoreName}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

/**
 * Upload multiple files in parallel with progress tracking
 */
export async function uploadFilesToRagStore(
    ragStoreName: string,
    files: File[],
    options?: UploadOptions,
    onProgress?: (completed: number, total: number, fileName: string) => void
): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    const uploadPromises = files.map((file, index) =>
        uploadToRagStore(ragStoreName, file, options)
            .then(() => {
                if (onProgress) {
                    onProgress(index + 1, files.length, file.name);
                }
            })
    );

    await Promise.all(uploadPromises);
}

// ========== FILE SEARCH WITH METADATA FILTERING ==========

export interface FileSearchOptions {
    metadataFilter?: string;
    systemInstruction?: string;
    model?: string;
    // #8 caching + #11/#12 agent/map context
    context?: {
        agent?: string       // "Jett", "Cypher" — used for role-aware system prompt
        map?: string         // "Haven" — used to inject real callouts
        objective?: string   // "economy" | "retake" | ...
        economyBucket?: string // "eco" | "force" | "full" | "bonus"
        cacheKey?: string    // opt-in cache key; if omitted cache is skipped
        rejectPatterns?: string[] // #10 advice patterns the user has rejected
    };
    skipCache?: boolean;
}

// ========== PROMPT CACHE (#8) ==========
// Small LRU-ish map. Buy-phase / objective-driven prompts are highly repetitive
// across rounds (same map, same agent, same economy bucket) — cache hits turn
// a 2–3s Gemini round-trip into near-zero latency and free credits.
const PROMPT_CACHE_MAX = 64
const PROMPT_CACHE_TTL_MS = 15 * 60 * 1000 // 15 min — stale enough for a match
const promptCache = new Map<string, { at: number; result: QueryResult }>()

function cacheGet(key: string): QueryResult | null {
    const hit = promptCache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > PROMPT_CACHE_TTL_MS) {
        promptCache.delete(key)
        return null
    }
    // Refresh LRU order
    promptCache.delete(key)
    promptCache.set(key, hit)
    return hit.result
}

function cacheSet(key: string, result: QueryResult): void {
    if (!result?.text) return
    promptCache.set(key, { at: Date.now(), result })
    while (promptCache.size > PROMPT_CACHE_MAX) {
        const oldest = promptCache.keys().next().value
        if (oldest) promptCache.delete(oldest); else break
    }
}

export function clearPromptCache(): void { promptCache.clear() }

// #9 Safe fallback — if Gemini returns empty text twice in a row, we still
// want to surface SOMETHING useful, grounded in the objective we know about.
const OBJECTIVE_FALLBACKS: Record<string, string> = {
    economy: 'Match your team buy — nobody wins 2v5. Talk comms and sync full/force/save.',
    retake: 'Stall with util first, trade entries, never dry peek. Check defuse timing.',
    postplant: 'Hold multiple angles with ally; line up molly/util on default plant spot.',
    execute: 'Take info before committing. Ult economy matters more than first pick.',
    rotate: 'Call info for your team — enemy count, utility used, economy.',
    reflect: 'Note why the round went the way it did; adjust next buy and utility order.',
    general: 'Play the map, use callouts, and trust your crosshair placement.',
}

function getSafeFallback(options?: FileSearchOptions): string {
    const obj = options?.context?.objective || 'general'
    return OBJECTIVE_FALLBACKS[obj] || OBJECTIVE_FALLBACKS.general
}

// Build a dynamic system instruction that injects agent role + abilities (#11)
// and real map callouts (#12) when the context is known.
function buildSystemInstruction(opts?: FileSearchOptions): string {
    // System instruction is written as a prioritized list. The previous version
    // contradicted itself ("talk like a gamer" + "1-2 sentence hard limit" +
    // "no generic advice") which pushed the model toward either verbose
    // filler or truncated nonsense. Rules are now ordered so the model sees
    // hard constraints first and style guidance last.
    const base = `You are a live Valorant coach. Follow these rules in order:

1. LENGTH: 1–2 sentences maximum. Under 30 words.
2. NO INVENTED CONTEXT: Only reference enemies, agents, maps, sites, or economy that appear explicitly in the prompt. If none are provided, give advice that works without that context — do NOT fabricate a matchup or round state.
3. CASUAL INPUT: If the user says "hello", "can you hear me", etc., reply in one short conversational sentence. Don't force tactics.
4. FILES ARE TRUTH: Retrieved files are current Valorant data. Treat every agent and ability mentioned there as real, even if the name is unfamiliar. Never tell the user they got a name wrong.
5. STYLE: Direct, confident, gamer tone. No preamble ("Great question", "Based on the data"). No labels. No mentions of AI, files, retrieval, or tokens.
6. ACTIONABLE: Give one concrete thing to do, not generic advice like "use comms" or "aim well".`

    const ctx = opts?.context
    if (!ctx) return base

    const extras: string[] = []

    if (ctx.agent) {
        const asset = AGENT_ASSETS[ctx.agent]
        if (asset) {
            const abilityNames = (asset.abilities || [])
                .filter(a => a.displayName && a.displayName !== 'Info')
                .map(a => a.displayName)
                .join(', ')
            extras.push(`Player agent: ${asset.displayName} (${asset.role}). Abilities: ${abilityNames}. Refer to them by real names.`)
        }
    }
    const callouts = formatCalloutsForPrompt(ctx.map)
    if (callouts) extras.push(`Use real ${ctx.map} callouts, not generic "A site": ${callouts}`)

    if (ctx.rejectPatterns && ctx.rejectPatterns.length > 0) {
        extras.push(`Avoid these rejected patterns from prior rounds: ${ctx.rejectPatterns.slice(0, 5).join(' | ')}.`)
    }

    return `${base}\n\n${extras.join('\n')}`
}

/**
 * Enrich user query with retrieval-friendly keywords to improve RAG file matching.
 * Detects agent/map names and appends terms that match file naming conventions.
 */
function enrichQuery(query: string): string {
    const lower = query.toLowerCase();
    const enrichments: string[] = [];

    // Detect agent names (including newer agents the model may not know)
    const agents = [
        'astra', 'breach', 'brimstone', 'chamber', 'clove', 'cypher', 'deadlock', 'fade',
        'gekko', 'harbor', 'iso', 'jett', 'kay/o', 'kayo', 'killjoy', 'neon', 'omen',
        'phoenix', 'raze', 'reyna', 'sage', 'skye', 'sova', 'tejo', 'veto', 'viper',
        'vyse', 'waylay', 'yoru'
    ];
    for (const agent of agents) {
        if (lower.includes(agent)) {
            const name = agent === 'kayo' ? 'KAY/O' : agent.charAt(0).toUpperCase() + agent.slice(1);
            enrichments.push(`howtoplay ${name} guide tips abilities`);
            break;
        }
    }

    // Detect map names
    const maps = ['abyss', 'ascent', 'bind', 'breeze', 'corrode', 'fracture', 'haven', 'icebox', 'lotus', 'pearl', 'split', 'sunset'];
    for (const map of maps) {
        if (lower.includes(map)) {
            enrichments.push(`${map} strategy callouts`);
            break;
        }
    }

    if (enrichments.length === 0) return query;
    return `${query}\n\n[Search context: ${enrichments.join(', ')}]`;
}

/**
 * Search files with optional metadata filtering
 * Example metadataFilter: 'map="Haven" AND type="attack"'
 */
export async function fileSearch(
    ragStoreName: string,
    query: string,
    options?: FileSearchOptions
): Promise<QueryResult> {
    if (!ai) throw new Error("Gemini AI not initialized");

    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error("Invalid query: must be a non-empty string");
    }

    // #8 prompt cache lookup (caller opts in by passing context.cacheKey)
    const cacheKey = options?.context?.cacheKey
    if (!options?.skipCache && cacheKey) {
        const hit = cacheGet(cacheKey)
        if (hit) return hit
    }

    try {
        // Normalize store name - handle both "store-id" and "fileSearchStores/store-id" formats
        const normalizedStoreName = ragStoreName.startsWith('fileSearchStores/')
            ? ragStoreName
            : `fileSearchStores/${ragStoreName}`;

        const fileSearchConfig: any = {
            fileSearchStoreNames: [normalizedStoreName]
        };

        // Add metadata filter if provided
        if (options?.metadataFilter) {
            fileSearchConfig.metadataFilter = options.metadataFilter;
        }

        // Enrich query for better retrieval - append keywords that match RAG file naming
        const enrichedQuery = enrichQuery(query);
        const systemInstruction = options?.systemInstruction || buildSystemInstruction(options);
        const model = options?.model || 'gemini-3.1-flash-lite-preview';

        // Helper to invoke the model with a given token/thinking budget so we
        // can retry with more headroom if the first attempt returns empty.
        const invoke = async (maxOutputTokens: number, thinkingLevel: 'low' | 'none') => {
            return await ai.models.generateContent({
                model,
                contents: `Ground your answer on the retrieved file content. Treat everything in the files as real and current.\n\n${enrichedQuery}`,
                config: {
                    maxOutputTokens,
                    // @ts-ignore - thinkingConfig is valid for Gemini 3 but might not be in types yet
                    thinkingConfig: { thinkingLevel },
                    systemInstruction,
                    tools: [{ fileSearch: fileSearchConfig }]
                }
            }) as GenerateContentResponse;
        };

        let response = await invoke(1024, 'low');
        let text = (response.text || '').trim();
        // #9 empty-text fallback: thinking tokens can eat the whole budget. Retry
        // with a bigger budget and no thinking so the user still gets an answer.
        if (!text) {
            try {
                response = await invoke(2048, 'none');
                text = (response.text || '').trim();
            } catch { }
        }

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingSupport = (response.candidates?.[0]?.groundingMetadata as any)?.groundingSupports || [];

        const result: QueryResult = {
            text: text || getSafeFallback(options),
            groundingChunks: groundingChunks,
            groundingSupport: groundingSupport,
            fullMetadata: response.candidates?.[0]?.groundingMetadata
        };

        if (!options?.skipCache && cacheKey && result.text) cacheSet(cacheKey, result);
        return result;
    } catch (err) {
        const fullErrorMessage = extractErrorMessage(err);
        const errorMessage = fullErrorMessage.toLowerCase();

        console.error("File search error:", err);

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`The RAG store "${ragStoreName}" was not found.Please create it in the admin page first.`);
        } else if (errorMessage.includes('permission') || errorMessage.includes('invalid_argument')) {
            throw new Error(`Permission denied or the store doesn't exist. Please verify the store exists.`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            throw new Error("API quota exceeded or rate limit reached. Please try again later.");
        } else {
            throw new Error(`Search failed: ${fullErrorMessage}`);
        }
    }
}

/**
 * Generate example questions based on uploaded content
 */
export async function generateExampleQuestions(ragStoreName: string): Promise<string[]> {
    if (!ai) throw new Error("Gemini AI not initialized");

    try {
        // Normalize store name
        const normalizedStoreName = ragStoreName.startsWith('fileSearchStores/')
            ? ragStoreName
            : `fileSearchStores/${ragStoreName}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: "You are a professional Valorant coach. Based on the provided gameplay data (VOD reviews, match history, guides, etc.), generate 4 short and practical example questions a player might ask to improve. Return the questions as a JSON array of strings.",
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [normalizedStoreName]
                        }
                    }
                ]
            }
        });

        let jsonText = response.text.trim();

        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        } else {
            const firstBracket = jsonText.indexOf('[');
            const lastBracket = jsonText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                jsonText = jsonText.substring(firstBracket, lastBracket + 1);
            }
        }

        const questions = JSON.parse(jsonText);

        if (Array.isArray(questions) && questions.every(q => typeof q === 'string')) {
            return questions;
        }

        console.warn("Received unexpected format for example questions:", questions);
        return [];
    } catch (error) {
        console.error("Failed to generate or parse example questions:", error);
        return [
            "What's my biggest mistake in the early rounds?",
            "How can I improve my utility usage?",
            "Analyze my performance on attack vs. defense.",
            "Based on my stats, what agent should I practice?"
        ];
    }
}

// ========== UTILITY FUNCTIONS ==========

function extractErrorMessage(err: any): string {
    if (err instanceof Error) {
        try {
            const parsed = JSON.parse(err.message);
            if (parsed && parsed.error && parsed.error.message) {
                return parsed.error.message;
            }
        } catch {
            return err.message;
        }
        return err.message;
    }

    if (err && typeof err === 'object') {
        if (err.error && typeof err.error === 'object' && err.error.message) {
            return err.error.message;
        }
        if (err.message) {
            return err.message;
        }
    }

    try {
        const errStr = String(err);
        const parsed = JSON.parse(errStr);
        if (parsed && parsed.error && parsed.error.message) {
            return parsed.error.message;
        }
    } catch {
        // Not JSON
    }

    return String(err);
}

/**
 * Extract metadata from filename
 * Example: "valorant_haven_attack.txt" -> { map: "Haven", type: "attack" }
 */
export function extractMetadataFromFilename(filename: string): CustomMetadata[] {
    const metadata: CustomMetadata[] = [];
    const lower = filename.toLowerCase();

    // Extract map name
    const maps = ['abyss', 'ascent', 'bind', 'breeze', 'corrode', 'fracture', 'haven', 'icebox', 'lotus', 'pearl', 'split', 'sunset'];
    for (const map of maps) {
        if (lower.includes(map)) {
            metadata.push({ key: 'map', stringValue: map.charAt(0).toUpperCase() + map.slice(1) });
            break;
        }
    }

    // Extract type (attack/defense/guide)
    if (lower.includes('attack')) {
        metadata.push({ key: 'type', stringValue: 'attack' });
    } else if (lower.includes('defense') || lower.includes('defence')) {
        metadata.push({ key: 'type', stringValue: 'defense' });
    } else if (lower.includes('guide')) {
        metadata.push({ key: 'type', stringValue: 'guide' });
    } else if (lower.includes('tips')) {
        metadata.push({ key: 'type', stringValue: 'tips' });
    }

    // Extract agent name if present
    const agents = [
        'astra', 'breach', 'brimstone', 'chamber', 'clove', 'cypher', 'deadlock', 'fade',
        'gekko', 'harbor', 'iso', 'jett', 'kay/o', 'kayo', 'killjoy', 'neon', 'omen',
        'phoenix', 'raze', 'reyna', 'sage', 'skye', 'sova', 'tejo', 'veto', 'viper',
        'vyse', 'waylay', 'yoru'
    ];
    for (const agent of agents) {
        if (lower.includes(agent)) {
            // Handle special case for KAY/O to ensure consistent capitalization
            const agentName = agent === 'kayo' ? 'KAY/O' : agent.charAt(0).toUpperCase() + agent.slice(1);
            metadata.push({ key: 'agent', stringValue: agentName });
            break;
        }
    }

    // Extract category
    if (lower.includes('fundamentals')) {
        metadata.push({ key: 'category', stringValue: 'fundamentals' });
    } else if (lower.includes('pro')) {
        metadata.push({ key: 'category', stringValue: 'pro' });
    } else if (lower.includes('ranked')) {
        metadata.push({ key: 'category', stringValue: 'ranked' });
    } else if (lower.includes('igl')) {
        metadata.push({ key: 'category', stringValue: 'igl' });
    } else if (lower.includes('game_sense')) {
        metadata.push({ key: 'category', stringValue: 'game_sense' });
    }

    return metadata;
}

export async function analyzeMatchHistory(matches: any[]): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");
    if (!matches || matches.length === 0) return "No match data available to analyze.";

    const prompt = `
    You are an expert Valorant coach. Analyze the following recent match history for a player and provide 3 key insights:
    1. A major strength demonstrated in these games.
    2. A critical area for improvement.
    3. A specific actionable tip for their next game.

    Match Data:
    ${JSON.stringify(matches.slice(0, 5), null, 2)}

    Keep the response concise, encouraging, and tactical. Format as a bulleted list.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
        });
        return response.text;
    } catch (err) {
        console.error("Analysis failed:", err);
        return "Unable to analyze match history at this time.";
    }
}

