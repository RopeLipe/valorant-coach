/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Examples of using Gemini File Search API
 * Based on: https://ai.google.dev/gemini-api/docs/file-search
 */

import {
    initialize,
    createRagStore,
    uploadToRagStore,
    fileSearch,
    listRagStores,
    listDocuments,
    deleteDocument,
    deleteRagStore,
    extractMetadataFromFilename,
    type FileSearchOptions,
    type UploadOptions
} from '../services/geminiFileSearch';

// ========== EXAMPLE 1: Basic Setup ==========

export async function example1_basicSetup() {
    console.log('Example 1: Basic Setup');

    // Initialize the service
    initialize();

    // Create a RAG store
    const storeName = await createRagStore('My Valorant Coach Store');
    console.log(`Created store: ${storeName}`);

    return storeName;
}

// ========== EXAMPLE 2: Upload with Chunking Configuration ==========

export async function example2_uploadWithChunking(storeName: string, file: File) {
    console.log('Example 2: Upload with Chunking Configuration');

    const options: UploadOptions = {
        displayName: 'Haven Attack Strategy',
        chunkingConfig: {
            maxTokensPerChunk: 400,  // Larger chunks for better context
            maxOverlapTokens: 40      // 10% overlap for continuity
        }
    };

    await uploadToRagStore(storeName, file, options);
    console.log('✓ File uploaded with custom chunking');
}

// ========== EXAMPLE 3: Upload with Custom Metadata ==========

export async function example3_uploadWithMetadata(storeName: string, file: File) {
    console.log('Example 3: Upload with Custom Metadata');

    const options: UploadOptions = {
        displayName: 'Haven Attack Strategy',
        customMetadata: [
            { key: 'map', stringValue: 'Haven' },
            { key: 'type', stringValue: 'attack' },
            { key: 'category', stringValue: 'strategy' },
            { key: 'difficulty', stringValue: 'intermediate' }
        ]
    };

    await uploadToRagStore(storeName, file, options);
    console.log('✓ File uploaded with metadata');
}

// ========== EXAMPLE 4: Auto-Extract Metadata from Filename ==========

export async function example4_autoMetadata(storeName: string, file: File) {
    console.log('Example 4: Auto-Extract Metadata');

    // Extract metadata from filename like "valorant_haven_attack.txt"
    const metadata = extractMetadataFromFilename(file.name);
    console.log('Extracted metadata:', metadata);

    const options: UploadOptions = {
        customMetadata: metadata,
        chunkingConfig: {
            maxTokensPerChunk: 400,
            maxOverlapTokens: 40
        }
    };

    await uploadToRagStore(storeName, file, options);
    console.log('✓ File uploaded with auto-extracted metadata');
}

// ========== EXAMPLE 5: Basic File Search ==========

export async function example5_basicSearch(storeName: string) {
    console.log('Example 5: Basic File Search');

    const result = await fileSearch(
        storeName,
        "What are the best attacking strategies for Haven?"
    );

    console.log('Answer:', result.text);
    console.log('Grounding chunks:', result.groundingChunks?.length);

    return result;
}

// ========== EXAMPLE 6: Search with Metadata Filtering ==========

export async function example6_searchWithFilter(storeName: string) {
    console.log('Example 6: Search with Metadata Filtering');

    const options: FileSearchOptions = {
        metadataFilter: 'map="Haven" AND type="attack"'
    };

    const result = await fileSearch(
        storeName,
        "What are the key setups for A site?",
        options
    );

    console.log('Answer:', result.text);
    console.log('Sources:', result.groundingChunks?.map(chunk => chunk.document?.displayName));

    return result;
}

// ========== EXAMPLE 7: Search with Custom System Instruction ==========

export async function example7_customSystemInstruction(storeName: string) {
    console.log('Example 7: Custom System Instruction');

    const options: FileSearchOptions = {
        systemInstruction: 'You are a professional esports coach specializing in Valorant. Provide detailed, tactical advice with specific examples and scenarios.',
        model: 'gemini-3.1-flash-lite-preview'
    };

    const result = await fileSearch(
        storeName,
        "Analyze the best utility usage for attacking B site on Haven",
        options
    );

    console.log('Detailed answer:', result.text);

    return result;
}

// ========== EXAMPLE 8: Complex Metadata Filtering ==========

export async function example8_complexFiltering(storeName: string) {
    console.log('Example 8: Complex Metadata Filtering');

    // Search only in fundamentals guides for ranked play
    const options: FileSearchOptions = {
        metadataFilter: 'category="fundamentals" OR category="ranked"'
    };

    const result = await fileSearch(
        storeName,
        "What should I focus on to improve my rank?",
        options
    );

    console.log('Focused answer:', result.text);

    return result;
}

// ========== EXAMPLE 9: Accessing Grounding Metadata ==========

export async function example9_groundingMetadata(storeName: string) {
    console.log('Example 9: Accessing Grounding Metadata');

    const result = await fileSearch(
        storeName,
        "What are the best agents for Pearl?"
    );

    console.log('Answer:', result.text);
    console.log('\nGrounding Details:');

    // Access detailed grounding information
    if (result.groundingChunks) {
        result.groundingChunks.forEach((chunk, index) => {
            console.log(`\nSource ${index + 1}:`);
            console.log(`  Document: ${chunk.document?.displayName}`);
            console.log(`  Chunk: ${chunk.chunk?.text?.substring(0, 100)}...`);
        });
    }

    // Access grounding support scores
    if (result.groundingSupport) {
        console.log('\nGrounding Support Scores:');
        result.groundingSupport.forEach((support, index) => {
            console.log(`  Claim ${index + 1}: Confidence ${support.confidenceScore || 'N/A'}`);
        });
    }

    return result;
}

// ========== EXAMPLE 10: List and Manage Documents ==========

export async function example10_manageDocuments(storeName: string) {
    console.log('Example 10: List and Manage Documents');

    // List all documents in the store
    const documents = await listDocuments(storeName);
    console.log(`Found ${documents.length} documents`);

    documents.forEach((doc, index) => {
        console.log(`\n${index + 1}. ${doc.displayName}`);
        console.log(`   ID: ${doc.name}`);
        console.log(`   Metadata:`, doc.customMetadata);
    });

    return documents;
}

// ========== EXAMPLE 11: Complete Workflow ==========

export async function example11_completeWorkflow() {
    console.log('Example 11: Complete Workflow');

    try {
        // 1. Initialize
        initialize();

        // 2. Create store
        const storeName = await createRagStore('Valorant Pro Tips');
        console.log('✓ Store created:', storeName);

        // 3. Upload files with metadata (simulated with dummy file)
        // In real usage, you would load actual files

        // 4. List all stores
        const stores = await listRagStores();
        console.log(`✓ Found ${stores.length} stores`);

        // 5. Search with filtering
        const searchResult = await fileSearch(
            storeName,
            "Best strategies for Pearl",
            { metadataFilter: 'map="Pearl"' }
        );
        console.log('✓ Search completed:', searchResult.text.substring(0, 100));

        // 6. Cleanup (optional)
        // await deleteRagStore(storeName);
        // console.log('✓ Store deleted');

        return storeName;
    } catch (error) {
        console.error('Error in workflow:', error);
        throw error;
    }
}

// ========== EXAMPLE 12: Agent-Specific Search ==========

export async function example12_agentSpecificSearch(storeName: string) {
    console.log('Example 12: Agent-Specific Search');

    const options: FileSearchOptions = {
        metadataFilter: 'agent="Astra"',
        systemInstruction: 'You are a Valorant agent specialist. Provide specific tips for playing this agent effectively.'
    };

    const result = await fileSearch(
        storeName,
        "How should I use Astra's abilities in post-plant situations?",
        options
    );

    console.log('Agent-specific answer:', result.text);

    return result;
}

// ========== EXAMPLE 13: Map-Specific Search ==========

export async function example13_mapSpecificSearch(storeName: string, map: string) {
    console.log(`Example 13: ${map}-Specific Search`);

    const options: FileSearchOptions = {
        metadataFilter: `map="${map}"`
    };

    const result = await fileSearch(
        storeName,
        `What are the most important callouts and positions on ${map}?`,
        options
    );

    console.log(`${map} answer:`, result.text);

    return result;
}

// Export all examples
export const examples = {
    example1_basicSetup,
    example2_uploadWithChunking,
    example3_uploadWithMetadata,
    example4_autoMetadata,
    example5_basicSearch,
    example6_searchWithFilter,
    example7_customSystemInstruction,
    example8_complexFiltering,
    example9_groundingMetadata,
    example10_manageDocuments,
    example11_completeWorkflow,
    example12_agentSpecificSearch,
    example13_mapSpecificSearch
};
