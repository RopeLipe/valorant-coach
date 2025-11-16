# Quick Start: Gemini File Search for Valorant Coach

## 🎯 Goal
Upload your Valorant coaching guides and use AI-powered search to answer player questions.

## 📋 Prerequisites

1. **Gemini API Key**: Get one from [Google AI Studio](https://ai.google.dev/)
2. **Environment Setup**: Add your key to `.env.local`:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

## 🚀 Quick Setup (3 Steps)

### Step 1: Upload Your Files

**Option A: Use the CLI script**
```bash
npx tsx scripts/uploadRAGFiles.ts
```

This will:
- ✅ Create a RAG store called "Valorant Coach Knowledge Base"
- ✅ Upload all 18 files from `Valorant AI RAG` folder
- ✅ Auto-extract metadata (map, type, category) from filenames
- ✅ Configure optimal chunking (400 tokens per chunk)
- ✅ Show progress with detailed logging

**Option B: Upload from code**
```typescript
import { uploadValorantRAGFiles } from './utils/bulkUploadRAG';

await uploadValorantRAGFiles(
    'c:\\Users\\Z1n3x\\Downloads\\Valorant AI RAG'
);
```

### Step 2: Search Your Knowledge Base

```typescript
import { initialize, fileSearch } from './services/geminiFileSearch';

// Initialize
initialize();

// Basic search
const result = await fileSearch(
    'valorant-coach-shared-store',
    "What are the best attacking strategies for Haven?"
);

console.log(result.text);
```

### Step 3: Use Advanced Features

**Filter by map:**
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "What positions should I hold on A site?",
    { metadataFilter: 'map="Haven"' }
);
```

**Filter by type:**
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "Best defensive setups?",
    { metadataFilter: 'type="defense"' }
);
```

**Filter by agent:**
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "How should I use Astra's abilities?",
    { metadataFilter: 'agent="Astra"' }
);
```

**Complex filtering:**
```typescript
const result = await fileSearch(
    'valorant-coach-shared-store',
    "Best attacking strategies for Pearl?",
    {
        metadataFilter: 'map="Pearl" AND type="attack"',
        systemInstruction: 'Provide detailed tactical analysis'
    }
);
```

## 📊 Your Files & Metadata

The upload script auto-extracts metadata from your filenames:

| File | Map | Type | Category |
|------|-----|------|----------|
| Haven_Attack.txt | Haven | attack | - |
| Haven_defense.txt | Haven | defense | - |
| HOWTOPLAY_ASTRA.txt | - | - | Astra (agent) |
| valorant_abyss_guide.txt | Abyss | guide | - |
| valorant_abyss_pro_tips.txt | Abyss | tips | pro |
| valorant_bind_attack_defaults.txt | Bind | attack | - |
| valorant_bind_attack_strategies.txt | Bind | attack | - |
| valorant_corrode_attack_guide.txt | - | attack | guide |
| valorant_corrode_defense_guide.txt | - | defense | guide |
| valorant_game_sense_guide.txt | - | guide | game_sense |
| valorant_igl_guide.txt | - | guide | igl |
| valorant_pearl_fundamentals.txt | Pearl | - | fundamentals |
| valorant_pearl_guide.txt | Pearl | guide | - |
| valorant_ranked_guide.txt | - | guide | ranked |
| valorant_split_fundamentals.txt | Split | - | fundamentals |
| valorant_split_guide.txt | Split | guide | - |
| valorant_sunset_guide.txt | Sunset | guide | - |
| valorant_sunset_ranked_tips.txt | Sunset | tips | ranked |

## 🎨 Example Queries

### Map-Specific Questions
```typescript
// Haven-specific advice
fileSearch(store, "Best util for Haven C site?",
    { metadataFilter: 'map="Haven"' });

// Pearl fundamentals
fileSearch(store, "What are the key positions on Pearl?",
    { metadataFilter: 'map="Pearl" AND category="fundamentals"' });
```

### Role-Specific Questions
```typescript
// IGL guidance
fileSearch(store, "How should I call strategies as IGL?",
    { metadataFilter: 'category="igl"' });

// Game sense improvement
fileSearch(store, "How can I improve my game sense?",
    { metadataFilter: 'category="game_sense"' });
```

### Attack/Defense Specific
```typescript
// Attacking strategies
fileSearch(store, "Best attacking defaults for Bind?",
    { metadataFilter: 'map="Bind" AND type="attack"' });

// Defensive setups
fileSearch(store, "How should I hold B site on Haven?",
    { metadataFilter: 'map="Haven" AND type="defense"' });
```

### Skill Development
```typescript
// Ranked climbing
fileSearch(store, "What should I focus on to climb ranks?",
    { metadataFilter: 'category="ranked"' });

// Pro-level tips
fileSearch(store, "What do pro players do differently?",
    { metadataFilter: 'category="pro"' });
```

## 🔍 View Grounding Sources

Always check which documents informed the answer:

```typescript
const result = await fileSearch(store, "Your question");

console.log('Answer:', result.text);
console.log('\nSources:');
result.groundingChunks?.forEach((chunk, i) => {
    console.log(`${i + 1}. ${chunk.document?.displayName}`);
    console.log(`   "${chunk.chunk?.text?.substring(0, 100)}..."`);
});
```

## 📁 File Management

### List all documents
```typescript
import { listDocuments } from './services/geminiFileSearch';

const docs = await listDocuments('valorant-coach-shared-store');
docs.forEach(doc => {
    console.log(`${doc.displayName} - ${doc.customMetadata}`);
});
```

### Delete a document
```typescript
import { deleteDocument } from './services/geminiFileSearch';

await deleteDocument('fileSearchStores/store-id/documents/doc-id');
```

### List all stores
```typescript
import { listRagStores } from './services/geminiFileSearch';

const stores = await listRagStores();
stores.forEach(store => {
    console.log(`${store.displayName} (${store.name})`);
});
```

## 🎯 Integration with Your App

### In Chat Interface
```typescript
// When user asks a question
const userQuestion = "How should I attack A site on Haven?";

// Search the knowledge base
const result = await fileSearch(
    'valorant-coach-shared-store',
    userQuestion,
    { metadataFilter: 'map="Haven" AND type="attack"' }
);

// Display answer with sources
displayAnswer(result.text);
displaySources(result.groundingChunks);
```

### Smart Query Router
```typescript
function extractMetadataFilter(question: string): string {
    const filters = [];

    // Detect map mentions
    const maps = ['haven', 'bind', 'split', 'pearl', 'sunset', 'abyss'];
    for (const map of maps) {
        if (question.toLowerCase().includes(map)) {
            filters.push(`map="${map.charAt(0).toUpperCase() + map.slice(1)}"`);
        }
    }

    // Detect attack/defense
    if (question.toLowerCase().includes('attack')) {
        filters.push('type="attack"');
    } else if (question.toLowerCase().includes('defense') || question.toLowerCase().includes('hold')) {
        filters.push('type="defense"');
    }

    return filters.join(' AND ');
}

// Use it
const filter = extractMetadataFilter("Best attacking strats for Haven");
// Result: 'map="Haven" AND type="attack"'
```

## 🐛 Common Issues

### "Store not found"
- Make sure you've run the upload script first
- Check the store name matches exactly

### "No results"
- Documents may still be indexing (wait a minute)
- Try broader search query
- Remove or adjust metadata filters

### "API key error"
- Verify `.env.local` has the correct key
- Ensure key has API access enabled

## 📚 Next Steps

1. **Run the upload script**: `npx tsx scripts/uploadRAGFiles.ts`
2. **Try example queries**: See [examples/fileSearchExamples.ts](examples/fileSearchExamples.ts)
3. **Read full docs**: See [README_FILE_SEARCH.md](README_FILE_SEARCH.md)
4. **Integrate into your app**: Add search to your chat interface

## 💡 Pro Tips

1. **Combine filters** for precise answers: `'map="Haven" AND type="attack" AND category="pro"'`
2. **Adjust chunking** based on document type (see README_FILE_SEARCH.md)
3. **Use grounding metadata** to build trust with users by showing sources
4. **Cache common queries** to save API calls
5. **Monitor token usage** to optimize costs

---

Happy coaching! 🎮
