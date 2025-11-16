/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Example: Using the default RAG store for searches
 */

import { initialize, fileSearch } from '../services/geminiFileSearch';
import { getDefaultStoreId } from '../config/ragConfig';

// For Node.js: Load environment variables
if (typeof process !== 'undefined') {
    const { config } = await import('dotenv');
    const { resolve } = await import('path');
    config({ path: resolve(process.cwd(), '.env.local') });
    config({ path: resolve(process.cwd(), '.env') });
}

async function main() {
    console.log('🎮 Valorant Coach - Search Example\n');

    // Initialize
    initialize();

    // Get default store from config
    const storeId = getDefaultStoreId();
    console.log(`📦 Using store: ${storeId}\n`);

    // Example 1: Basic search
    console.log('Example 1: Basic search');
    console.log('Query: "What are the best attacking strategies for Haven?"\n');

    const result1 = await fileSearch(
        storeId,
        "What are the best attacking strategies for Haven?"
    );

    console.log('Answer:', result1.text);
    console.log('\nSources:');
    result1.groundingChunks?.forEach((chunk, i) => {
        console.log(`  ${i + 1}. ${chunk.document?.displayName}`);
    });
    console.log('\n---\n');

    // Example 2: Filtered search
    console.log('Example 2: Filtered search (Haven + attack)');
    console.log('Query: "What positions should I hold on A site?"\n');

    const result2 = await fileSearch(
        storeId,
        "What positions should I hold on A site?",
        { metadataFilter: 'map="Haven" AND type="attack"' }
    );

    console.log('Answer:', result2.text);
    console.log('\nSources:');
    result2.groundingChunks?.forEach((chunk, i) => {
        console.log(`  ${i + 1}. ${chunk.document?.displayName}`);
    });
    console.log('\n---\n');

    // Example 3: Agent-specific search
    console.log('Example 3: Agent-specific search (Astra)');
    console.log('Query: "How should I use Astra\'s abilities?"\n');

    const result3 = await fileSearch(
        storeId,
        "How should I use Astra's abilities?",
        { metadataFilter: 'agent="Astra"' }
    );

    console.log('Answer:', result3.text);
    console.log('\nSources:');
    result3.groundingChunks?.forEach((chunk, i) => {
        console.log(`  ${i + 1}. ${chunk.document?.displayName}`);
    });
    console.log('\n---\n');

    console.log('✅ Examples complete!');
}

main().catch(console.error);
