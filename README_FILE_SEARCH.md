# Gemini File Search Implementation Guide

This project implements the official Gemini File Search API as documented at: https://ai.google.dev/gemini-api/docs/file-search

## 📚 Overview

The implementation provides advanced RAG (Retrieval Augmented Generation) capabilities including:

- **Intelligent Chunking** - Configurable document splitting for optimal context
- **Custom Metadata** - Tag and organize documents with custom attributes
- **Metadata Filtering** - Query specific subsets of your knowledge base
- **Grounding Citations** - Full transparency on source documents
- **Bulk Upload** - Efficiently upload entire folders with automatic metadata extraction

## 🚀 Quick Start

### 1. Initialize the Service

```typescript
import { initialize } from './services/geminiFileSearch';

initialize();
```

### 2. Create a RAG Store

```typescript
import { createRagStore } from './services/geminiFileSearch';

const storeName = await createRagStore('Valorant Coach Knowledge Base');
```

### 3. Upload Files with Metadata

```typescript
import { uploadToRagStore, extractMetadataFromFilename } from './services/geminiFileSearch';

const file = new File([...], 'valorant_haven_attack.txt');
const metadata = extractMetadataFromFilename(file.name);

await uploadToRagStore(storeName, file, {
    displayName: 'Haven Attack Strategy',
    chunkingConfig: {
        maxTokensPerChunk: 400,
        maxOverlapTokens: 40
    },
    customMetadata: metadata
});
```

### 4. Search with Filtering

```typescript
import { fileSearch } from './services/geminiFileSearch';

const result = await fileSearch(
    storeName,
    "What are the best attacking strategies for Haven?",
    {
        metadataFilter: 'map="Haven" AND type="attack"'
    }
);

console.log(result.text);
console.log('Sources:', result.groundingChunks);
```

## 📁 Project Structure

```
valorant-coach/
├── services/
│   ├── geminiService.ts          # Original implementation
│   └── geminiFileSearch.ts       # Enhanced file search (NEW)
├── utils/
│   └── bulkUploadRAG.ts          # Bulk upload utility (NEW)
├── scripts/
│   └── uploadRAGFiles.ts         # CLI upload tool (NEW)
├── examples/
│   └── fileSearchExamples.ts     # Usage examples (NEW)
└── types.ts                       # TypeScript definitions (UPDATED)
```

## 🔧 Features

### 1. Chunking Configuration

Control how documents are split for indexing:

```typescript
const options = {
    chunkingConfig: {
        maxTokensPerChunk: 400,  // Larger chunks = better context
        maxOverlapTokens: 40      // 10% overlap for continuity
    }
};
```

**Recommendations:**
- **Small docs** (guides, tips): 200 tokens
- **Medium docs** (strategies): 400 tokens
- **Large docs** (comprehensive guides): 600 tokens

### 2. Custom Metadata

Tag documents for better organization and filtering:

```typescript
const metadata = [
    { key: 'map', stringValue: 'Haven' },
    { key: 'type', stringValue: 'attack' },
    { key: 'category', stringValue: 'strategy' },
    { key: 'difficulty', stringValue: 'intermediate' }
];
```

**Auto-extraction** from filenames:
- `valorant_haven_attack.txt` → map: Haven, type: attack
- `valorant_pearl_fundamentals.txt` → map: Pearl, category: fundamentals
- `HOWTOPLAY_ASTRA.txt` → agent: Astra

### 3. Metadata Filtering

Query specific document subsets:

```typescript
// Single filter
metadataFilter: 'map="Haven"'

// Multiple conditions (AND)
metadataFilter: 'map="Haven" AND type="attack"'

// Multiple conditions (OR)
metadataFilter: 'category="fundamentals" OR category="ranked"'

// Complex queries
metadataFilter: '(map="Haven" OR map="Bind") AND type="defense"'
```

### 4. Grounding Metadata

Access detailed source information:

```typescript
const result = await fileSearch(storeName, "Best agents for Pearl?");

// View sources
result.groundingChunks?.forEach(chunk => {
    console.log('Document:', chunk.document?.displayName);
    console.log('Text:', chunk.chunk?.text);
});

// View confidence scores
result.groundingSupport?.forEach(support => {
    console.log('Confidence:', support.confidenceScore);
});
```

## 🎯 Use Cases

### Use Case 1: Map-Specific Coaching

```typescript
const result = await fileSearch(
    storeName,
    "What are the key positions on Haven A site?",
    { metadataFilter: 'map="Haven"' }
);
```

### Use Case 2: Agent-Specific Tips

```typescript
const result = await fileSearch(
    storeName,
    "How should I use Astra in post-plant situations?",
    { metadataFilter: 'agent="Astra"' }
);
```

### Use Case 3: Skill Level Progression

```typescript
const result = await fileSearch(
    storeName,
    "What should I focus on to climb ranks?",
    { metadataFilter: 'category="fundamentals" OR category="ranked"' }
);
```

### Use Case 4: Tactical Deep Dive

```typescript
const result = await fileSearch(
    storeName,
    "Analyze the best attacking strategies for Pearl B site",
    {
        metadataFilter: 'map="Pearl" AND type="attack"',
        systemInstruction: 'Provide detailed tactical analysis with specific examples'
    }
);
```

## 📦 Bulk Upload Utility

### Upload Valorant RAG Files

```bash
# Upload all files from the default folder
npx tsx scripts/uploadRAGFiles.ts

# Upload from custom folder
npx tsx scripts/uploadRAGFiles.ts "C:\path\to\your\files"

# Upload to specific store
npx tsx scripts/uploadRAGFiles.ts --store-name="fileSearchStores/your-store-id"
```

### Programmatic Bulk Upload

```typescript
import { uploadValorantRAGFiles } from './utils/bulkUploadRAG';

await uploadValorantRAGFiles(
    'c:\\Users\\Z1n3x\\Downloads\\Valorant AI RAG',
    'optional-store-name'
);
```

**Features:**
- ✅ Automatic metadata extraction from filenames
- ✅ Progress tracking with detailed logging
- ✅ Error handling and retry logic
- ✅ Parallel uploads for speed
- ✅ Configurable chunking

## 🎨 Examples

See [examples/fileSearchExamples.ts](examples/fileSearchExamples.ts) for 13 comprehensive examples:

1. Basic Setup
2. Upload with Chunking
3. Upload with Metadata
4. Auto-Extract Metadata
5. Basic Search
6. Search with Filtering
7. Custom System Instructions
8. Complex Filtering
9. Grounding Metadata
10. Document Management
11. Complete Workflow
12. Agent-Specific Search
13. Map-Specific Search

Run examples:
```typescript
import { examples } from './examples/fileSearchExamples';

const storeName = await examples.example1_basicSetup();
await examples.example5_basicSearch(storeName);
```

## 📊 File Support

Supports 100+ file types including:
- **Text**: .txt, .md, .json
- **Documents**: .pdf, .docx, .pptx, .xlsx
- **Code**: .js, .ts, .py, .java, .cpp
- **Data**: .csv, .xml, .yaml

**Limits:**
- Max file size: 100 MB
- Max total storage: 1 GB (free), up to 1 TB (Tier 3)
- Recommended: Keep stores under 20 GB for optimal performance

## 🎯 Best Practices

### 1. Chunking Strategy

- **Small chunks (200)**: Quick facts, tips, short guides
- **Medium chunks (400)**: Strategies, tutorials, explanations
- **Large chunks (600)**: Comprehensive guides, detailed analysis

### 2. Metadata Organization

Always include:
- **category**: fundamentals, strategy, tips, etc.
- **type**: attack, defense, guide
- **map/agent**: When applicable
- **difficulty**: beginner, intermediate, advanced

### 3. Search Optimization

- Use specific queries: "Haven A site attack strategies" vs "Haven strategies"
- Combine filters: `map="Haven" AND type="attack"`
- Adjust system instructions for different use cases

### 4. Performance

- Batch uploads for multiple files
- Use parallel processing for independent operations
- Keep stores under 20 GB for best latency

## 🔍 API Reference

### Functions

#### `initialize()`
Initialize the Gemini AI service with your API key.

#### `createRagStore(displayName, description?)`
Create a new RAG store/corpus.

#### `uploadToRagStore(storeName, file, options?)`
Upload a file with optional chunking and metadata.

#### `fileSearch(storeName, query, options?)`
Search the knowledge base with optional filtering.

#### `listRagStores()`
List all available RAG stores.

#### `listDocuments(storeName)`
List all documents in a store.

#### `deleteDocument(docName)`
Delete a specific document.

#### `deleteRagStore(storeName)`
Delete an entire RAG store.

#### `extractMetadataFromFilename(filename)`
Auto-extract metadata from filename patterns.

### Types

```typescript
interface ChunkingConfig {
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
}

interface CustomMetadata {
    key: string;
    stringValue?: string;
    numericValue?: number;
}

interface UploadOptions {
    displayName?: string;
    chunkingConfig?: ChunkingConfig;
    customMetadata?: CustomMetadata[];
}

interface FileSearchOptions {
    metadataFilter?: string;
    systemInstruction?: string;
    model?: string;
}
```

## 🐛 Troubleshooting

### "RAG store not found"
Ensure the store exists: `await createRagStore('My Store')`

### "File too large"
Max size is 100 MB. Split large files or compress.

### "Metadata filter syntax error"
Use proper syntax: `key="value"` with AND/OR operators

### "No results from search"
Check if documents are fully indexed (may take time after upload)

## 📚 Resources

- [Official Gemini File Search Docs](https://ai.google.dev/gemini-api/docs/file-search)
- [Gemini API Key Setup](https://ai.google.dev/gemini-api/docs/api-key)
- [File Search Best Practices](https://ai.google.dev/gemini-api/docs/file-search#best-practices)

## 📝 License

Apache-2.0
