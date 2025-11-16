#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CLI Script to upload Valorant RAG files to a PERSISTENT file search store
 *
 * Usage:
 *   npx tsx scripts/uploadRAGFiles.ts                           # Use default folder
 *   npx tsx scripts/uploadRAGFiles.ts "custom/path"             # Use custom folder
 *   npx tsx scripts/uploadRAGFiles.ts --store-name="store-id"   # Upload to existing store
 *   npx tsx scripts/uploadRAGFiles.ts --list-stores              # List all stores
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { uploadValorantRAGFiles } from '../utils/bulkUploadRAG';
import { initialize, listRagStores, listDocuments } from '../services/geminiFileSearch';

async function listStores() {
    console.log('📚 Listing all persistent RAG stores...\n');

    initialize();
    const stores = await listRagStores();

    if (stores.length === 0) {
        console.log('No stores found. Create one by uploading files.');
        return;
    }

    for (const store of stores) {
        console.log(`📦 ${store.displayName}`);
        console.log(`   ID: ${store.name}`);

        // List documents in store
        try {
            const docs = await listDocuments(store.name);
            console.log(`   Documents: ${docs.length}`);

            if (docs.length > 0) {
                console.log('   Files:');
                docs.forEach((doc, i) => {
                    console.log(`     ${i + 1}. ${doc.displayName}`);
                });
            }
        } catch (err) {
            console.log(`   Documents: Unable to list`);
        }
        console.log('');
    }
}

async function main() {
    const args = process.argv.slice(2);

    // Check for --list-stores flag
    if (args.includes('--list-stores')) {
        await listStores();
        process.exit(0);
    }

    // Parse arguments
    const folderPath = args.find(arg => !arg.startsWith('--')) || 'c:\\Users\\Z1n3x\\Downloads\\Valorant AI RAG';
    const storeNameArg = args.find(arg => arg.startsWith('--store-name='));
    const storeName = storeNameArg ? storeNameArg.split('=')[1] : undefined;

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Valorant RAG Files → Persistent File Search Store    ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📝 Note: File search stores are PERSISTENT');
    console.log('   Your files will be stored permanently until you delete them.');
    console.log('');

    if (storeName) {
        console.log(`📦 Using existing store: ${storeName}`);
    } else {
        console.log('📦 Creating new persistent store: "Valorant Coach Knowledge Base"');
    }
    console.log('');

    try {
        await uploadValorantRAGFiles(folderPath, storeName);

        console.log('\n✅ Upload complete! Your files are now in a persistent store.');
        console.log('');
        console.log('🔍 To list all your stores, run:');
        console.log('   npx tsx scripts/uploadRAGFiles.ts --list-stores');

        process.exit(0);
    } catch (error) {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    }
}

main();
