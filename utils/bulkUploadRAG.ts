/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bulk Upload Utility for Valorant RAG Files
 * Uploads all files from the "Valorant AI RAG" folder with metadata
 */

import {
    initialize,
    createRagStore,
    uploadToRagStore,
    extractMetadataFromFilename,
    type ChunkingConfig,
    type UploadOptions
} from '../services/geminiFileSearch';

interface BulkUploadConfig {
    storeName?: string;
    storeDisplayName?: string;
    chunkingConfig?: ChunkingConfig;
    autoExtractMetadata?: boolean;
}

/**
 * Bulk upload files from a folder to a RAG store
 */
export async function bulkUploadFromFolder(
    files: File[],
    config: BulkUploadConfig = {},
    onProgress?: (completed: number, total: number, fileName: string, status: 'uploading' | 'completed' | 'error', error?: string) => void
): Promise<{ success: number; failed: number; errors: { file: string; error: string }[] }> {

    const {
        storeDisplayName = 'Valorant Coach Knowledge Base',
        chunkingConfig = {
            maxTokensPerChunk: 400,
            maxOverlapTokens: 40
        },
        autoExtractMetadata = true
    } = config;

    // Initialize Gemini AI
    initialize();

    const results = {
        success: 0,
        failed: 0,
        errors: [] as { file: string; error: string }[]
    };

    let storeName = config.storeName;

    // Create store if not provided
    if (!storeName) {
        try {
            storeName = await createRagStore(storeDisplayName, 'Valorant coaching guides, strategies, and tips');
            console.log(`Created RAG store: ${storeName}`);
        } catch (error) {
            throw new Error(`Failed to create RAG store: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Upload files one by one with progress tracking
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            if (onProgress) {
                onProgress(i, files.length, file.name, 'uploading');
            }

            const uploadOptions: UploadOptions = {
                displayName: file.name.replace(/\.(txt|md|pdf)$/i, ''),
                chunkingConfig
            };

            // Auto-extract metadata from filename
            if (autoExtractMetadata) {
                const metadata = extractMetadataFromFilename(file.name);
                if (metadata.length > 0) {
                    uploadOptions.customMetadata = metadata;
                }
            }

            await uploadToRagStore(storeName, file, uploadOptions);

            results.success++;

            if (onProgress) {
                onProgress(i + 1, files.length, file.name, 'completed');
            }

            console.log(`✓ Uploaded: ${file.name}`);
        } catch (error) {
            results.failed++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            results.errors.push({ file: file.name, error: errorMsg });

            if (onProgress) {
                onProgress(i + 1, files.length, file.name, 'error', errorMsg);
            }

            console.error(`✗ Failed to upload ${file.name}:`, errorMsg);
        }
    }

    return results;
}

/**
 * Create a File object from a file path (Node.js environment)
 */
export async function createFileFromPath(filePath: string): Promise<File> {
    const fs = await import('fs');
    const path = await import('path');

    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Create a File object
    const blob = new Blob([buffer]);
    return new File([blob], fileName, { type: 'text/plain' });
}

/**
 * Load all files from the Valorant AI RAG folder
 */
export async function loadRAGFolderFiles(folderPath: string): Promise<File[]> {
    const fs = await import('fs');
    const path = await import('path');

    const files: File[] = [];
    const fileNames = fs.readdirSync(folderPath);

    for (const fileName of fileNames) {
        const filePath = path.join(folderPath, fileName);
        const stats = fs.statSync(filePath);

        // Only process text files
        if (stats.isFile() && /\.(txt|md)$/i.test(fileName)) {
            const file = await createFileFromPath(filePath);
            files.push(file);
        }
    }

    return files;
}

/**
 * Example usage function
 */
export async function uploadValorantRAGFiles(
    ragFolderPath: string = 'c:\\Users\\Z1n3x\\Downloads\\Valorant AI RAG',
    storeName?: string
): Promise<void> {
    console.log('🚀 Starting bulk upload of Valorant RAG files...');
    console.log(`📁 Source folder: ${ragFolderPath}`);

    try {
        // Load all files from the folder
        const files = await loadRAGFolderFiles(ragFolderPath);
        console.log(`📚 Found ${files.length} files to upload`);

        // Upload with progress tracking
        const results = await bulkUploadFromFolder(
            files,
            {
                storeName,
                storeDisplayName: 'Valorant Coach Knowledge Base',
                chunkingConfig: {
                    maxTokensPerChunk: 400,
                    maxOverlapTokens: 40
                },
                autoExtractMetadata: true
            },
            (completed, total, fileName, status, error) => {
                const progress = Math.round((completed / total) * 100);

                if (status === 'uploading') {
                    console.log(`⏳ [${progress}%] Uploading: ${fileName}`);
                } else if (status === 'completed') {
                    console.log(`✅ [${progress}%] Completed: ${fileName}`);
                } else if (status === 'error') {
                    console.error(`❌ [${progress}%] Failed: ${fileName} - ${error}`);
                }
            }
        );

        console.log('\n📊 Upload Summary:');
        console.log(`✅ Success: ${results.success}`);
        console.log(`❌ Failed: ${results.failed}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors:');
            results.errors.forEach(({ file, error }) => {
                console.log(`  - ${file}: ${error}`);
            });
        }

        console.log('\n✨ Bulk upload complete!');
    } catch (error) {
        console.error('❌ Bulk upload failed:', error);
        throw error;
    }
}
