#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Manage persistent file search stores
 *
 * Usage:
 *   npx tsx scripts/manageStores.ts list               # List all stores
 *   npx tsx scripts/manageStores.ts create "name"      # Create new store
 *   npx tsx scripts/manageStores.ts delete "store-id"  # Delete a store
 *   npx tsx scripts/manageStores.ts info "store-id"    # Show store details
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import {
    initialize,
    listRagStores,
    createRagStore,
    deleteRagStore,
    listDocuments
} from '../services/geminiFileSearch';

async function listStores() {
    console.log('📚 Persistent File Search Stores:\n');

    const stores = await listRagStores();

    if (stores.length === 0) {
        console.log('❌ No stores found.');
        console.log('\nCreate one with:');
        console.log('  npx tsx scripts/manageStores.ts create "My Store Name"');
        return;
    }

    for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        console.log(`${i + 1}. 📦 ${store.displayName}`);
        console.log(`   ID: ${store.name}`);

        try {
            const docs = await listDocuments(store.name);
            console.log(`   Documents: ${docs.length}`);
        } catch {
            console.log(`   Documents: 0`);
        }
        console.log('');
    }

    console.log('💡 Tip: Use "info" command to see document details');
}

async function createStore(displayName: string) {
    console.log(`📦 Creating persistent store: "${displayName}"...\n`);

    const storeName = await createRagStore(displayName);

    console.log('✅ Store created successfully!');
    console.log(`   Name: ${displayName}`);
    console.log(`   ID: ${storeName}`);
    console.log('\n💡 This store is persistent and will remain until you delete it.');
    console.log('\nUpload files with:');
    console.log(`  npx tsx scripts/uploadRAGFiles.ts --store-name="${storeName}"`);
}

async function deleteStore(storeName: string) {
    console.log(`🗑️  Deleting persistent store: ${storeName}...\n`);

    // Confirm deletion
    console.log('⚠️  Warning: This will permanently delete the store and all its documents!');

    await deleteRagStore(storeName);

    console.log('✅ Store deleted successfully.');
}

async function showStoreInfo(storeName: string) {
    console.log(`📦 Store Information: ${storeName}\n`);

    const docs = await listDocuments(storeName);

    console.log(`Total Documents: ${docs.length}\n`);

    if (docs.length === 0) {
        console.log('No documents in this store.');
        return;
    }

    console.log('Documents:');
    docs.forEach((doc, i) => {
        console.log(`\n${i + 1}. 📄 ${doc.displayName}`);
        console.log(`   ID: ${doc.name}`);

        if (doc.customMetadata && doc.customMetadata.length > 0) {
            console.log('   Metadata:');
            doc.customMetadata.forEach(meta => {
                const value = meta.stringValue || meta.numericValue || meta.stringListValue?.join(', ');
                console.log(`     - ${meta.key}: ${value}`);
            });
        }
    });

    console.log('\n💡 Total storage used: ~' + (docs.length * 20) + ' KB (estimated)');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const param = args[1];

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Persistent File Search Store Manager              ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Initialize
    initialize();

    try {
        switch (command) {
            case 'list':
                await listStores();
                break;

            case 'create':
                if (!param) {
                    console.error('❌ Error: Store name required');
                    console.log('Usage: npx tsx scripts/manageStores.ts create "Store Name"');
                    process.exit(1);
                }
                await createStore(param);
                break;

            case 'delete':
                if (!param) {
                    console.error('❌ Error: Store ID required');
                    console.log('Usage: npx tsx scripts/manageStores.ts delete "fileSearchStores/store-id"');
                    process.exit(1);
                }
                await deleteStore(param);
                break;

            case 'info':
                if (!param) {
                    console.error('❌ Error: Store ID required');
                    console.log('Usage: npx tsx scripts/manageStores.ts info "fileSearchStores/store-id"');
                    process.exit(1);
                }
                await showStoreInfo(param);
                break;

            default:
                console.log('Available commands:');
                console.log('  list              - List all persistent stores');
                console.log('  create "name"     - Create a new persistent store');
                console.log('  delete "id"       - Delete a persistent store');
                console.log('  info "id"         - Show store details');
                console.log('\nExamples:');
                console.log('  npx tsx scripts/manageStores.ts list');
                console.log('  npx tsx scripts/manageStores.ts create "My Knowledge Base"');
                console.log('  npx tsx scripts/manageStores.ts info "fileSearchStores/abc123"');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n💥 Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
