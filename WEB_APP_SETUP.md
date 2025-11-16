# 🌐 Web App File Search Integration

Your web app is now configured to use the persistent file search store!

## ✅ What Changed

### 1. Updated [App.tsx](App.tsx)

**Before:**
```typescript
import * as geminiService from './services/geminiService';
const SHARED_RAG_STORE_NAME = 'valorant-coach-shared-store';
```

**After:**
```typescript
import * as geminiService from './services/geminiFileSearch';
import { RAG_CONFIG } from './config/ragConfig';
const SHARED_RAG_STORE_NAME = RAG_CONFIG.defaultStoreId;
```

Now the web app automatically uses your persistent store:
`fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl`

## 🚀 How to Use

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Open Your Browser

Navigate to `http://localhost:5173` (or the port shown in the terminal)

### 3. Start Chatting

1. Click "Start Chat" on the welcome screen
2. The app will connect to your persistent file search store
3. Ask questions about Valorant strategies!

## 🎯 Features Available

### Persistent Store Integration
- ✅ Uses `fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl` automatically
- ✅ No need to create/delete stores - it's persistent!
- ✅ All 18 coaching files are ready to query
- ✅ Metadata filtering works (map, type, category, agent)

### Chat Interface
- ✅ Natural language questions
- ✅ AI-powered responses from your documents
- ✅ Source citations (click to view)
- ✅ Example questions generated from your content
- ✅ Rotating question suggestions

### Advanced Features
The enhanced `geminiFileSearch` service provides:
- ✅ Metadata filtering (filter by map, type, agent, etc.)
- ✅ Enhanced grounding metadata
- ✅ Better error handling
- ✅ Automatic store name normalization

## 📝 Example Queries

Try asking:

### Map-Specific
- "What are the best attacking strategies for Haven?"
- "How should I defend B site on Pearl?"
- "What are the key callouts on Split?"

### Agent-Specific
- "How should I use Astra's abilities?"
- "Best agents for Pearl?"

### General Coaching
- "What should I focus on to improve my rank?"
- "How can I improve my game sense?"
- "What do pro players do differently?"

### Role-Specific
- "How should I call strategies as IGL?"
- "Best attacking defaults for Bind?"

## 🔧 Configuration

### Environment Variables

The web app reads from `.env.local`:

```bash
# API Key
VITE_GEMINI_API_KEY=AIzaSyC...

# Default RAG Store (your persistent store)
VITE_RAG_STORE_ID=fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
```

### Config File

[config/ragConfig.ts](config/ragConfig.ts) provides the default store:

```typescript
import { RAG_CONFIG } from './config/ragConfig';

// Access default store
const storeId = RAG_CONFIG.defaultStoreId;
// Returns: fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
```

## 🎨 UI Features

### Welcome Screen
- Check if API key is configured
- Start chat session with your persistent store

### Chat Interface
- **Message History:** Keeps conversation context
- **Source Citations:** Click "Source 1", "Source 2", etc. to view original text
- **Example Questions:** Rotating suggestions every 5 seconds
- **Markdown Support:** Bold, italic, lists, code formatting
- **New Chat:** Reset conversation without losing the store

### Admin Panel

Access the admin panel at `http://localhost:5173/admin.html` (if available) to:
- List all stores
- View documents in each store
- Manage uploads

## 🐛 Troubleshooting

### "API key not valid"
- Check `.env.local` has `VITE_GEMINI_API_KEY=your_key`
- Restart dev server after changing `.env.local`

### "Store not found"
- Verify `.env.local` has correct store ID
- Run `npm run stores:list` to see all stores
- Make sure files are uploaded: `npm run upload:rag`

### "No sources" in responses
- Documents may still be indexing (wait a minute)
- Check documents exist: `npm run stores:info "fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl"`

### Dev server won't start
- Run `npm install` to ensure all dependencies
- Check no other process is using port 5173

## 🔄 Updating Content

### Add More Files

```bash
# Upload additional files to your store
npm run upload:rag
```

The web app will automatically have access to new files!

### Change Default Store

Edit `.env.local`:
```bash
VITE_RAG_STORE_ID=fileSearchStores/your-new-store-id
```

Then restart the dev server.

## 📊 How It Works

```
User Question
    ↓
ChatInterface.tsx
    ↓
App.tsx (handleSendMessage)
    ↓
geminiFileSearch.ts (fileSearch)
    ↓
Gemini API (with file search tool)
    ↓
Persistent Store: fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
    ↓
Response with Sources
    ↓
ChatInterface.tsx (display)
```

## 🎯 Advanced Usage

### Custom System Instructions

You can modify the system instruction in [App.tsx](App.tsx):

```typescript
const result = await geminiService.fileSearch(
    activeRagStoreName,
    message,
    {
        systemInstruction: 'You are a professional Valorant coach...',
        metadataFilter: 'map="Haven"'  // Optional filtering
    }
);
```

### Metadata Filtering

To filter responses by specific criteria, update the `fileSearch` call:

```typescript
// Only search Haven attack strategies
const result = await geminiService.fileSearch(
    activeRagStoreName,
    message,
    { metadataFilter: 'map="Haven" AND type="attack"' }
);
```

### Multiple Stores

To support multiple stores, modify [App.tsx](App.tsx) to allow store selection:

```typescript
const [stores, setStores] = useState<RagStore[]>([]);
const [selectedStore, setSelectedStore] = useState<string>(RAG_CONFIG.defaultStoreId);

// Load stores
useEffect(() => {
    const loadStores = async () => {
        const storeList = await geminiService.listRagStores();
        setStores(storeList);
    };
    loadStores();
}, []);
```

## 📱 Production Deployment

When deploying to production:

1. **Set Environment Variables:**
   ```bash
   VITE_GEMINI_API_KEY=your_production_key
   VITE_RAG_STORE_ID=fileSearchStores/valorant-coach-knowledge-ba-lh2oz2rm4ccl
   ```

2. **Build the App:**
   ```bash
   npm run build
   ```

3. **Deploy `dist/` folder** to your hosting service

4. **Your store persists!** No need to re-upload files

## ✨ Next Steps

1. **Start the dev server:** `npm run dev`
2. **Open http://localhost:5173** in your browser
3. **Click "Start Chat"** to connect to your store
4. **Ask questions** and get coaching advice!

Your web app now has full access to your persistent file search store! 🎮
