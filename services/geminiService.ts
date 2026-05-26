/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RagStore, Document, QueryResult } from '../types';

let ai: GoogleGenAI;

export function initialize() {
    ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listRagStores(): Promise<RagStore[]> {
    if (!ai) throw new Error("Gemini AI not initialized");

    try {
        // FIX: The list method now returns a Pager, so we need to iterate over it to get the stores.
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

export async function listDocuments(ragStoreName: string): Promise<Document[]> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate RAG store name
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

        // Distinguish between empty store (OK) and actual errors
        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            // Store doesn't exist - this is a real error
            throw new Error(`RAG store not found: ${ragStoreName}. Please verify it exists.`);
        } else if (errorMessage.includes('permission')) {
            throw new Error(`Permission denied. Your API key may not have access to list documents in: ${ragStoreName}`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else {
            console.error(`Failed to list documents for ${ragStoreName}`, err);
            // For unknown errors, return empty array to avoid breaking the UI
            // but log the error for debugging
            return [];
        }
    }
}

export async function createRagStore(displayName: string): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate display name
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        throw new Error("Invalid display name: must be a non-empty string");
    }

    try {
        const ragStore = await ai.fileSearchStores.create({ config: { displayName } });
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

export async function uploadToRagStore(ragStoreName: string, file: File): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate inputs
    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid file: must be a File object");
    }

    try {
        let op = await ai.fileSearchStores.uploadToFileSearchStore({
            fileSearchStoreName: ragStoreName,
            file: file
        });

        // Poll for operation completion with timeout
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max (300 seconds)

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
            throw new Error(`File "${file.name}" is too large. Please check the file size limits.`);
        } else if (errorMessage.includes('unsupported') || errorMessage.includes('file type')) {
            throw new Error(`File type not supported for "${file.name}". Please check supported file formats.`);
        } else {
            throw new Error(`Failed to upload "${file.name}" to ${ragStoreName}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

export async function uploadFilesToRagStore(ragStoreName: string, files: File[]): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    const uploadPromises = files.map(file => uploadToRagStore(ragStoreName, file));

    await Promise.all(uploadPromises);
}

// Helper function to extract error message from various error formats
function extractErrorMessage(err: any): string {
    // Handle Error objects first
    if (err instanceof Error) {
        // Check if the error message itself is a JSON string with nested error
        try {
            const parsed = JSON.parse(err.message);
            if (parsed && parsed.error && parsed.error.message) {
                return parsed.error.message;
            }
        } catch {
            // Not JSON, use the message as-is
            return err.message;
        }
        return err.message;
    }

    // Handle API error objects with nested error structure
    // Format: { error: { code: 400, message: "...", status: "..." } }
    if (err && typeof err === 'object') {
        // Direct error.message access
        if (err.error && typeof err.error === 'object' && err.error.message) {
            return err.error.message;
        }
        // Simple message property
        if (err.message) {
            return err.message;
        }
    }

    // Try to stringify and parse
    try {
        const errStr = String(err);
        const parsed = JSON.parse(errStr);
        if (parsed && parsed.error && parsed.error.message) {
            return parsed.error.message;
        }
    } catch {
        // Not JSON
    }

    // Fallback to string conversion
    return String(err);
}

export async function deleteDocument(docName: string): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate document name format
    if (!docName || typeof docName !== 'string') {
        throw new Error("Invalid document name: must be a non-empty string");
    }

    // Check if the document name follows the expected format
    // Expected format: fileSearchStores/{storeName}/documents/{documentId}
    if (!docName.includes('fileSearchStores/') || !docName.includes('/documents/')) {
        throw new Error(`Invalid document name format. Expected: fileSearchStores/{storeName}/documents/{documentId}, received: ${docName}`);
    }

    try {
        await ai.fileSearchStores.documents.delete({ name: docName });
    } catch (err) {
        // Use helper to extract error message
        const fullErrorMessage = extractErrorMessage(err);
        const errorMessage = fullErrorMessage.toLowerCase();

        console.error("Delete document error:", err);
        console.error("Extracted error message:", fullErrorMessage);

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`Document not found. It may have already been deleted or the name is incorrect.`);
        } else if (errorMessage.includes('permission') || errorMessage.includes('invalid_argument')) {
            throw new Error(`Permission denied or invalid resource. Verify the document exists and your API key has proper access.`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else {
            // Re-throw with additional context
            throw new Error(`Failed to delete document: ${fullErrorMessage}`);
        }
    }
}


export async function fileSearch(ragStoreName: string, query: string): Promise<QueryResult> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate inputs
    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error("Invalid query: must be a non-empty string");
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: query,
            config: {
                systemInstruction: "You are a professional Valorant coach. You have access to a knowledge base that contains information about NEW and CUSTOM agents (specifically Veto, Tejo, Waylay, Clove, Vyse) that are NOT in your general training data. CRITICAL: If the user asks about 'Veto' or any other custom agent, you MUST use the provided context. Do NOT say the agent does not exist. ALWAYS prioritize the information found in the provided context over your internal knowledge. If the context describes an agent, assume they exist and give advice based on that context. \n\nCONTEXT AWARENESS: You will be provided with lists of 'Allies' and 'Enemies'. Use this information to provide smarter, context-aware advice. For example, if the enemy has a Cypher, warn about trips. If the player's team lacks smokes, suggest cautious pathing. Analyze the team compositions for tactical advantages and disadvantages.\n\nYour answers must be extremely brief, concise, and actionable. Limit your response to a maximum of 2 short sentences. Focus on immediate tactical advice.",
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [`fileSearchStores/${ragStoreName}`],
                        }
                    }
                ]
            }
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return {
            text: response.text,
            groundingChunks: groundingChunks,
        };
    } catch (err) {
        // Use helper to extract error message
        const fullErrorMessage = extractErrorMessage(err);
        const errorMessage = fullErrorMessage.toLowerCase();

        console.error("File search error:", err);
        console.error("Extracted error message:", fullErrorMessage);

        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`The RAG store "${ragStoreName}" was not found. Please create it in the admin page first: http://localhost:3002/admin.html`);
        } else if (errorMessage.includes('permission') || errorMessage.includes('invalid_argument')) {
            throw new Error(`Permission denied or the store doesn't exist. Please verify the store "valorant-coach-shared-store" exists in the admin page.`);
        } else if (errorMessage.includes('api key not valid')) {
            throw new Error("Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local");
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            throw new Error("API quota exceeded or rate limit reached. Please try again later.");
        } else {
            throw new Error(`Search failed: ${fullErrorMessage}`);
        }
    }
}

export async function generateExampleQuestions(ragStoreName: string): Promise<string[]> {
    if (!ai) throw new Error("Gemini AI not initialized");
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: "You are a professional Valorant coach. Based on the provided gameplay data (VOD reviews, match history, etc.), generate 4 short and practical example questions a player might ask to improve. Return the questions as a JSON array of strings. For example: [\"What could I have done better in round 5?\", \"How can I improve my crosshair placement based on this data?\"]",
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [`fileSearchStores/${ragStoreName}`],
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


export async function deleteRagStore(ragStoreName: string): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");

    // Validate RAG store name
    if (!ragStoreName || typeof ragStoreName !== 'string') {
        throw new Error("Invalid RAG store name: must be a non-empty string");
    }

    try {
        await ai.fileSearchStores.delete({
            name: ragStoreName,
            config: { force: true },
        });
    } catch (err) {
        // Provide better error messages for common issues
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
