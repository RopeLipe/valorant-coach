# 🎮 Getting Started with Gemini File Search

## 📦 Installation (1 Command)

```bash
cd c:\Users\Z1n3x\Downloads\valorant-coach && npm install
```

This installs:
- ✅ `tsx` - Run TypeScript scripts
- ✅ `@google/genai` - Gemini API client
- ✅ All dependencies

## 🔑 API Key Setup

1. Get your API key from [Google AI Studio](https://ai.google.dev/)
2. Create/update `.env.local`:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

## 🚀 Upload Your Files (3 Ways)

### Method 1: NPM Script (Easiest)
```bash
npm run upload:rag
```

### Method 2: Direct NPX
```bash
npx tsx scripts/uploadRAGFiles.ts
```

### Method 3: Custom Path
```bash
npx tsx scripts/uploadRAGFiles.ts "C:\your\custom\path"
```

## 📊 What Gets Uploaded

```
Valorant AI RAG/
├── Haven_Attack.txt              → map: Haven, type: attack
├── Haven_defense.txt             → map: Haven, type: defense
├── HOWTOPLAY_ASTRA.txt           → agent: Astra
├── valorant_abyss_guide.txt      → map: Abyss, type: guide
├── valorant_abyss_pro_tips.txt   → map: Abyss, type: tips, category: pro
├── valorant_bind_attack_defaults.txt
├── valorant_bind_attack_strategies.txt
├── valorant_corrode_attack_guide.txt
├── valorant_corrode_defense_guide.txt
├── valorant_game_sense_guide.txt → category: game_sense
├── valorant_igl_guide.txt        → category: igl
├── valorant_pearl_fundamentals.txt
├── valorant_pearl_guide.txt
├── valorant_ranked_guide.txt     → category: ranked
├── valorant_split_fundamentals.txt
├── valorant_split_guide.txt
├── valorant_sunset_guide.txt
└── valorant_sunset_ranked_tips.txt

Total: 18 files (~300KB)
Auto-metadata extracted for all!
```

## 🔍 Test Your Setup

Create a test file `test.ts`:

```typescript
import { initialize, fileSearch } from './services/geminiFileSearch';

async function test() {
    // Initialize
    initialize();

    // Search
    const result = await fileSearch(
        'valorant-coach-shared-store',
        "What are the best attacking strategies for Haven?",
        { metadataFilter: 'map="Haven" AND type="attack"' }
    );

    console.log('Answer:', result.text);
    console.log('\nSources:');
    result.groundingChunks?.forEach((chunk, i) => {
        console.log(`${i + 1}. ${chunk.document?.displayName}`);
    });
}

test();
```

Run it:
```bash
npx tsx test.ts
```

## 🎯 Quick Examples

### Example 1: Map-Specific Question
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "What positions should I hold on Haven A site?",
    { metadataFilter: 'map="Haven"' }
);
```

### Example 2: Attack Strategy
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "Best attacking defaults for Bind?",
    { metadataFilter: 'map="Bind" AND type="attack"' }
);
```

### Example 3: Agent-Specific
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "How should I use Astra's abilities?",
    { metadataFilter: 'agent="Astra"' }
);
```

### Example 4: Skill Development
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "What should I focus on to improve my rank?",
    { metadataFilter: 'category="ranked" OR category="fundamentals"' }
);
```

## 📁 Project Structure

```
valorant-coach/
├── services/
│   ├── geminiService.ts          # Original (still works)
│   └── geminiFileSearch.ts       # Enhanced version ⭐
│
├── utils/
│   └── bulkUploadRAG.ts          # Bulk upload helper ⭐
│
├── scripts/
│   └── uploadRAGFiles.ts         # CLI upload tool ⭐
│
├── examples/
│   └── fileSearchExamples.ts     # 13 examples ⭐
│
├── types.ts                       # Type definitions (updated)
├── package.json                   # Added upload scripts
│
└── Documentation/
    ├── GETTING_STARTED.md        # This file
    ├── QUICK_START.md            # 3-step guide
    ├── README_FILE_SEARCH.md     # Full API docs
    └── IMPLEMENTATION_SUMMARY.md # What was built
```

## 🎨 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             User asks question                       │  │
│  │  "What are the best strategies for Haven A site?"   │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         geminiFileSearch.ts                          │  │
│  │  fileSearch(store, query, { metadataFilter })        │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────-─┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Gemini API                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Parse query                                      │  │
│  │  2. Search indexed documents                         │  │
│  │  3. Filter by metadata: map="Haven" AND type="attack"│  │
│  │  4. Retrieve relevant chunks                         │  │
│  │  5. Generate answer with citations                   │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────-─┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              RAG Store (Knowledge Base)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📄 Haven_Attack.txt                                 │  │
│  │     Metadata: map=Haven, type=attack                 │  │
│  │     Chunks: [chunk1, chunk2, ...]                    │  │
│  │                                                       │  │
│  │  📄 valorant_pearl_guide.txt                         │  │
│  │     Metadata: map=Pearl, type=guide                  │  │
│  │     Chunks: [chunk1, chunk2, ...]                    │  │
│  │                                                       │  │
│  │  📄 18 total documents...                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Response                                  │
│  {                                                          │
│    text: "To attack A site on Haven...",                   │
│    groundingChunks: [                                       │
│      { document: "Haven_Attack.txt", chunk: "..." },       │
│      { document: "Haven_defense.txt", chunk: "..." }       │
│    ]                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
1. Upload Phase
   ├── Read files from "Valorant AI RAG" folder
   ├── Extract metadata from filenames
   ├── Configure chunking (400 tokens/chunk, 40 overlap)
   ├── Upload to Gemini
   └── Index and embed chunks

2. Query Phase
   ├── User asks question
   ├── Apply metadata filter (optional)
   ├── Search indexed chunks
   ├── Retrieve relevant context
   └── Generate answer with citations

3. Response Phase
   ├── Display answer to user
   ├── Show source documents
   └── Provide confidence scores
```

## 📝 Metadata Extraction Examples

```typescript
// Automatic extraction based on filename patterns

extractMetadataFromFilename("valorant_haven_attack.txt")
→ [
    { key: "map", stringValue: "Haven" },
    { key: "type", stringValue: "attack" }
  ]

extractMetadataFromFilename("valorant_pearl_fundamentals.txt")
→ [
    { key: "map", stringValue: "Pearl" },
    { key: "category", stringValue: "fundamentals" }
  ]

extractMetadataFromFilename("HOWTOPLAY_ASTRA.txt")
→ [
    { key: "agent", stringValue: "Astra" }
  ]

extractMetadataFromFilename("valorant_abyss_pro_tips.txt")
→ [
    { key: "map", stringValue: "Abyss" },
    { key: "type", stringValue: "tips" },
    { key: "category", stringValue: "pro" }
  ]
```

## 🎯 Filtering Syntax

```typescript
// Single condition
'map="Haven"'

// Multiple conditions (AND)
'map="Haven" AND type="attack"'

// Multiple conditions (OR)
'category="fundamentals" OR category="ranked"'

// Complex queries
'(map="Haven" OR map="Bind") AND type="defense"'

// Numeric filters (if using numericValue)
'difficulty=5 AND rating>3'
```

## 🚨 Common Issues & Solutions

### Issue: "API key not valid"
**Solution:** Check `.env.local` has correct key
```bash
# Verify the key is set
cat .env.local | grep VITE_GEMINI_API_KEY
```

### Issue: "RAG store not found"
**Solution:** Upload files first
```bash
npm run upload:rag
```

### Issue: "tsx command not found"
**Solution:** Install dependencies
```bash
npm install
```

### Issue: "No results from search"
**Solution:** Documents may still be indexing (wait 1-2 minutes)

### Issue: Upload fails
**Solution:** Check file paths and permissions
```bash
# Verify folder exists
ls "C:\Users\Z1n3x\Downloads\Valorant AI RAG"
```

## 🎓 Learning Path

1. **Start Here** → Read this file
2. **Quick Setup** → Run `npm install` and `npm run upload:rag`
3. **Test** → Try the examples in [QUICK_START.md](QUICK_START.md)
4. **Explore** → Check out [examples/fileSearchExamples.ts](examples/fileSearchExamples.ts)
5. **Deep Dive** → Read [README_FILE_SEARCH.md](README_FILE_SEARCH.md)
6. **Integrate** → Add to your application

## 📚 Documentation Overview

| File | Purpose | When to Read |
|------|---------|--------------|
| **GETTING_STARTED.md** | Installation & setup | First time setup |
| **QUICK_START.md** | 3-step quick guide | Want to get running fast |
| **README_FILE_SEARCH.md** | Complete API docs | Need detailed reference |
| **IMPLEMENTATION_SUMMARY.md** | What was built | Understand the implementation |
| **examples/fileSearchExamples.ts** | Code examples | Want to see code |

## ⚡ Performance Tips

1. **Use metadata filters** - Faster and more accurate
2. **Batch uploads** - Upload all files at once
3. **Cache results** - Store common query answers
4. **Monitor tokens** - Filtering reduces token usage
5. **Optimize chunks** - Larger chunks for better context

## 🎮 Ready to Start?

```bash
# 1. Install
npm install

# 2. Set API key in .env.local
# VITE_GEMINI_API_KEY=your_key_here

# 3. Upload files
npm run upload:rag

# 4. Test
npx tsx test.ts

# 5. Integrate into your app!
```

## 💬 Need Help?

- Read [QUICK_START.md](QUICK_START.md) for common use cases
- Check [README_FILE_SEARCH.md](README_FILE_SEARCH.md) for API details
- Review [examples/fileSearchExamples.ts](examples/fileSearchExamples.ts) for code samples
- See [Official Gemini Docs](https://ai.google.dev/gemini-api/docs/file-search)

---

**You're all set! Your Valorant coaching AI is ready to help players improve.** 🚀
