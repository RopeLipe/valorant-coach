# ✅ Default Store Configuration

Your persistent file search store is now configured as the default!

## 🎯 Your Default Store

**Store ID:** `fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl`

This store is now set as the default in:
- ✅ [.env.local](.env.local) - For all scripts and the app
- ✅ [config/ragConfig.ts](config/ragConfig.ts) - For TypeScript imports

## 🚀 Usage

### Uploading Files to Default Store

```bash
# Automatically uses your default store
npm run upload:rag
```

No need to specify `--store-name` anymore! Files will automatically upload to `fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl`.

### Searching the Default Store

#### In TypeScript/JavaScript

```typescript
import { initialize, fileSearch } from './services/geminiFileSearch';
import { getDefaultStoreId } from './config/ragConfig';

// Initialize
initialize();

// Get default store
const storeId = getDefaultStoreId();

// Search
const result = await fileSearch(
    storeId,
    "What are the best strategies for Haven?"
);
```

#### Direct Store ID

```typescript
// Or use directly
const result = await fileSearch(
    'fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl',
    "Your question here"
);
```

### Environment Variables

Your `.env.local` now contains:

```bash
# API Key
VITE_GEMINI_API_KEY=AIzaSyC...

# Default RAG Store (set to your persistent store)
VITE_RAG_STORE_ID=fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
RAG_STORE_ID=fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
```

## 📝 Configuration Priority

When uploading or searching, the system checks in this order:

1. **Explicit `--store-name` argument** (highest priority)
   ```bash
   npm run upload:rag -- --store-name="fileSearchStores/other-store"
   ```

2. **Environment variable** (from `.env.local`)
   ```bash
   RAG_STORE_ID=fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
   ```

3. **Hardcoded fallback** (in `config/ragConfig.ts`)
   ```typescript
   return 'fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl';
   ```

## 🎮 Example: Search with Default Store

Created [examples/searchWithDefaultStore.ts](examples/searchWithDefaultStore.ts):

```bash
npx tsx examples/searchWithDefaultStore.ts
```

This demonstrates:
- ✅ Loading default store from config
- ✅ Basic search queries
- ✅ Filtered searches (by map, type, agent)
- ✅ Viewing grounding sources

## 🔧 Manage Your Default Store

### View Store Contents

```bash
npm run stores:info "fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl"
```

### Add More Files

```bash
# Upload additional files to your default store
npm run upload:rag
```

### List All Stores

```bash
npm run stores:list
```

### Change Default Store

Edit `.env.local`:

```bash
# Change to a different store
VITE_RAG_STORE_ID=fileSearchStores/your-new-store-id
RAG_STORE_ID=fileSearchStores/your-new-store-id
```

## 📊 Integration with Your App

### In React Components

```typescript
import { initialize, fileSearch } from './services/geminiFileSearch';
import { RAG_CONFIG } from './config/ragConfig';

function ChatComponent() {
    const handleSearch = async (query: string) => {
        initialize();

        const result = await fileSearch(
            RAG_CONFIG.defaultStoreId,  // Uses your default store
            query
        );

        return result.text;
    };

    // ... rest of component
}
```

### In Services

```typescript
import { RAG_CONFIG } from './config/ragConfig';

// Access default store anywhere
const storeId = RAG_CONFIG.defaultStoreId;
const chunkingConfig = RAG_CONFIG.chunkingConfig;
```

## ✨ Benefits

1. **No repetitive typing** - Don't specify store ID every time
2. **Consistent usage** - All scripts use the same store
3. **Easy updates** - Change store ID in one place
4. **Version control** - `.env.local` is gitignored, but `.env.example` documents the pattern
5. **Type-safe** - TypeScript config provides intellisense

## 🎯 Quick Commands

```bash
# Upload to default store
npm run upload:rag

# View default store contents
npm run stores:info "fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl"

# Search default store (run example)
npx tsx examples/searchWithDefaultStore.ts

# List all stores
npm run stores:list
```

## 🔄 Your Workflow Now

1. **Upload once** - Files persist in your default store
   ```bash
   npm run upload:rag
   ```

2. **Search anytime** - No need to remember store ID
   ```typescript
   const result = await fileSearch(
       getDefaultStoreId(),
       "Your question"
   );
   ```

3. **Add files later** - They go to the same store
   ```bash
   npm run upload:rag  # Adds to existing default store
   ```

Perfect! Your default store is configured and ready to use. 🚀
