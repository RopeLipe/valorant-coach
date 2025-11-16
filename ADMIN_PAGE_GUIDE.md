# Admin Page Access Guide

## ✅ Admin Page Status: WORKING

Your admin page is **fully functional** and ready to use!

## 🌐 How to Access the Admin Page

The admin page is separate from the main app. Here's how to access it:

### Development Mode

**URL:** `http://localhost:3002/admin.html`

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to:
   - Main app: `http://localhost:3002/` or `http://localhost:3002/index.html`
   - **Admin panel: `http://localhost:3002/admin.html`** ⬅️ This is what you need!

3. The admin page will load and initialize with your API key from `.env.local`

### Production Mode

After building:
```bash
npm run build
```

The admin page will be available at:
- `dist/admin.html` (open this file directly)
- Or deploy and access via: `https://yourdomain.com/admin.html`

## 🎯 Admin Page Features

The admin page allows you to:

### 1. **Manage RAG Stores**
- ✅ Create new RAG stores
- ✅ View all existing stores
- ✅ Delete stores (with confirmation)
- ✅ Refresh the store list

### 2. **Manage Documents**
- ✅ Select a store to view its documents
- ✅ Upload documents (single or multiple files)
- ✅ Delete documents
- ✅ View document names

## 🔑 API Key Configuration

The admin page uses the API key from `.env.local`:

```
VITE_GEMINI_API_KEY=AIzaSyCqdCUmh3bV7vTTylB7HRTz1Xdlsx6HrIQ
```

✅ **Your API key is already configured!**

## 📝 Setting Up the Shared Store

For the main app to work, you need to create a specific RAG store:

1. **Access admin page:** `http://localhost:3002/admin.html`
2. **Click the "+" button** to create a new store
3. **Name it:** `valorant-coach-shared-store` (exactly this name!)
4. **Upload your documents** (gameplay data, VOD reviews, etc.)
5. **Done!** The main app will now be able to access this store

## 🎨 Admin Page Layout

```
┌─────────────────────────────────────────────────┐
│         RAG Store Management                    │
├─────────────────┬───────────────────────────────┤
│ RAG Stores      │  Documents                    │
│ [Refresh] [+]   │  [Upload]                     │
│                 │                               │
│ ┌─────────────┐ │  Select a store               │
│ │ Store 1     │ │  to view documents            │
│ ├─────────────┤ │                               │
│ │ Store 2     │ │                               │
│ └─────────────┘ │                               │
└─────────────────┴───────────────────────────────┘
```

## 🐛 Troubleshooting

### Admin page shows "Please set your Gemini API Key"

**Solution:** Check that `.env.local` exists and contains:
```
VITE_GEMINI_API_KEY=your-api-key-here
```

Then restart the dev server:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Can't see any stores

**Possible causes:**
1. ✅ No stores created yet - Click "+" to create one
2. ✅ API key is invalid - Check your key in `.env.local`
3. ✅ Permission issue - Verify your API key has access to the Gemini File Search API

### Upload fails

**Check:**
- File size limits (varies by Gemini API tier)
- Supported file formats (PDF, TXT, DOC, DOCX, etc.)
- API quota hasn't been exceeded

### Delete operations show errors

**Fixed!** The error handling has been improved. You should now see clear messages like:
- "Document not found. It may have already been deleted..."
- "Permission denied or invalid resource..."
- "Invalid API key. Please check your VITE_GEMINI_API_KEY..."

## 🔧 Technical Details

### File Structure
```
valorant-coach/
├── index.html              # Main app entry point
├── admin.html             # Admin panel entry point ⬅️
├── index.tsx              # Main app root
├── admin/
│   ├── index.tsx          # Admin app root
│   └── AdminApp.tsx       # Admin UI logic
├── components/
│   ├── RagStoreList.tsx   # Store management UI
│   └── DocumentList.tsx   # Document management UI
└── services/
    └── geminiService.ts   # API integration
```

### Enhanced Error Handling

All functions now have comprehensive error handling:
- ✅ `listRagStores()` - API key validation, permission checks
- ✅ `createRagStore()` - Duplicate detection, validation
- ✅ `listDocuments()` - Store existence check, permission errors
- ✅ `uploadToRagStore()` - File validation, size/type checks, timeout protection
- ✅ `deleteDocument()` - Format validation, already-deleted detection
- ✅ `deleteRagStore()` - Permission checks, not found handling

## 📊 Build Status

✅ All components compiled successfully
✅ No TypeScript errors
✅ Production build ready: `npm run build`

## 🚀 Quick Start Checklist

- [x] Dev server running (`npm run dev`)
- [x] API key configured in `.env.local`
- [x] Admin page accessible at `http://localhost:3002/admin.html`
- [ ] Create `valorant-coach-shared-store` (do this now!)
- [ ] Upload your Valorant coaching documents
- [ ] Test the main app with the shared store

## 📚 Related Documentation

- [FILE_SEARCH_FIX_SUMMARY.md](FILE_SEARCH_FIX_SUMMARY.md) - Error handling improvements
- Main App: Access at `http://localhost:3002/`
- Admin Panel: Access at `http://localhost:3002/admin.html`

---

**Status:** ✅ Admin page is fully functional and ready to use!

**Next Step:** Open `http://localhost:3002/admin.html` in your browser and create your first RAG store!
