/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enhanced Gemini File Search Service
 * Implements advanced features from https://ai.google.dev/gemini-api/docs/file-search
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RagStore, Document, QueryResult } from '../types';

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
            parent: ragStoreName
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

            if (options.chunkingConfig) {
                config.chunkingConfig = {
                    whiteSpaceConfig: {
                        maxTokensPerChunk: options.chunkingConfig.maxTokensPerChunk || 200,
                        maxOverlapTokens: options.chunkingConfig.maxOverlapTokens || 20
                    }
                };
            }

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
            op = await ai.operations.get({operation: op});
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

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: options?.model || 'gemini-2.5-flash',
            contents: query,
            config: {
                systemInstruction: options?.systemInstruction ||
                    "You are a professional Valorant coach. Your answers must be brief, concise, and actionable, with a full explanation but limited to a maximum of 3-4 sentences. Be encouraging but direct.",
                tools: [
                    {
                        fileSearch: fileSearchConfig
                    }
                ]
            }
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingSupport = response.candidates?.[0]?.groundingMetadata?.groundingSupport || [];

        return {
            text: response.text,
            groundingChunks: groundingChunks,
            groundingSupport: groundingSupport,
            fullMetadata: response.candidates?.[0]?.groundingMetadata
        };
    } catch (err) {
        const fullErrorMessage = extractErrorMessage(err);
        const errorMessage = fullErrorMessage.toLowerCase();

        console.error("File search error:", err);

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`The RAG store "${ragStoreName}" was not found. Please create it in the admin page first.`);
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
            model: 'gemini-2.5-flash',
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
    const maps = ['haven', 'bind', 'split', 'ascent', 'icebox', 'breeze', 'fracture', 'pearl', 'lotus', 'sunset', 'abyss'];
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
    const agents = ['jett', 'phoenix', 'sage', 'sova', 'viper', 'cypher', 'reyna', 'killjoy', 'breach', 'omen', 'raze', 'skye', 'yoru', 'astra', 'kay/o', 'chamber', 'neon', 'fade', 'harbor', 'gekko', 'deadlock', 'iso'];
    for (const agent of agents) {
        if (lower.includes(agent)) {
            metadata.push({ key: 'agent', stringValue: agent.charAt(0).toUpperCase() + agent.slice(1) });
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
