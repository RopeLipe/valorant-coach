/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RAG Store Configuration
 */

/**
 * Get default RAG store ID from environment
 */
export function getDefaultStoreId(): string {
    // Browser/Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAG_STORE_ID) {
        return import.meta.env.VITE_RAG_STORE_ID;
    }

    // Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        const storeId = process.env.VITE_RAG_STORE_ID || process.env.RAG_STORE_ID;
        if (storeId) return storeId;
    }

    // Fallback to hardcoded default
    return 'fileSearchStores/valorant-coach-knowledge-ba-bxtfsydndmc8';
}

/**
 * Default RAG store configuration
 */
export const RAG_CONFIG = {
    // Default model to use
    defaultModel: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
                  (typeof process !== 'undefined' && process.env?.VITE_GEMINI_MODEL) ||
                  'gemini-3.1-flash-lite',

    // Your persistent file search store
    defaultStoreId: getDefaultStoreId(),

    // Store display name
    defaultStoreName: 'Valorant Coach Knowledge Base',

    // Chunking configuration
    chunkingConfig: {
        maxTokensPerChunk: 400,
        maxOverlapTokens: 40
    },

    // Auto-extract metadata from filenames
    autoExtractMetadata: true
};

export default RAG_CONFIG;
