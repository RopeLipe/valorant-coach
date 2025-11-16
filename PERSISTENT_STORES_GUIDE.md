# 📦 Persistent File Search Stores Guide

## 🎯 Key Concept: Stores Are Persistent By Default!

**Good news:** File search stores in Gemini are **automatically persistent**. Once you upload files, they stay in the cloud until you explicitly delete them.

## 🚀 Upload Files to Persistent Store

### Method 1: Quick Upload (Recommended)

```bash
# Install dependencies
npm install

# Upload all files - creates a persistent store automatically
npm run upload:rag
```

**What happens:**
1. ✅ Creates a new persistent store named "Valorant Coach Knowledge Base"
2. ✅ Uploads all 18 files from `Valorant AI RAG` folder
3. ✅ Extracts and saves metadata for each file
4. ✅ Configures optimal chunking (400 tokens/chunk)
5. ✅ Files remain accessible indefinitely

### Method 2: Upload to Existing Store

```bash
# First, list your existing stores
npm run stores:list

# Then upload to specific store
npx tsx scripts/uploadRAGFiles.ts --store-name="fileSearchStores/your-store-id"
```

### Method 3: Create Store First, Then Upload

```bash
# Create a new persistent store
npm run stores:create "My Custom Store Name"

# Upload files to it
npx tsx scripts/uploadRAGFiles.ts --store-name="fileSearchStores/store-id"
```

## 🗂️ Managing Persistent Stores

### List All Your Stores

```bash
npm run stores:list
```

**Output:**
```
📚 Persistent File Search Stores:

1. 📦 Valorant Coach Knowledge Base
   ID: fileSearchStores/abc123xyz
   Documents: 18

2. 📦 My Other Store
   ID: fileSearchStores/def456uvw
   Documents: 5
```

### View Store Details

```bash
npm run stores:info "fileSearchStores/abc123xyz"
```

**Output:**
```
📦 Store Information: fileSearchStores/abc123xyz

Total Documents: 18

Documents:

1. 📄 Haven Attack
   ID: fileSearchStores/abc123xyz/documents/doc1
   Metadata:
     - map: Haven
     - type: attack

2. 📄 Haven Defense
   ID: fileSearchStores/abc123xyz/documents/doc2
   Metadata:
     - map: Haven
     - type: defense

...
```

### Create New Store

```bash
npm run stores:create "My New Knowledge Base"
```

### Delete a Store

```bash
# ⚠️ Warning: This is permanent!
npm run stores:delete "fileSearchStores/abc123xyz"
```

## 📊 Storage Limits & Persistence

### Free Tier
- **Storage:** 1 GB total
- **Persistence:** Unlimited (until you delete)
- **Files:** Unlimited (within 1 GB limit)
- **Max file size:** 100 MB per file

### Paid Tiers
- **Tier 1:** 10 GB storage
- **Tier 2:** 100 GB storage
- **Tier 3:** 1 TB storage
- **All tiers:** Files persist indefinitely

### Your Valorant Files
- **Total size:** ~300 KB (18 files)
- **Percentage of free tier:** 0.03%
- **Room for more:** Yes! You have 99.97% remaining

## 🔍 Checking If Your Files Are Persisted

### Quick Check

```bash
# List all stores (shows document count)
npm run stores:list
```

### Detailed Check

```bash
# View specific store
npm run stores:info "fileSearchStores/your-store-id"
```

### From Code

```typescript
import { initialize, listRagStores, listDocuments } from './services/geminiFileSearch';

initialize();

// List all stores
const stores = await listRagStores();
console.log('Total stores:', stores.length);

// Check documents in specific store
const docs = await listDocuments('fileSearchStores/your-store-id');
console.log('Total documents:', docs.length);
docs.forEach(doc => {
    console.log(`- ${doc.displayName}`);
});
```

## 🎯 Complete Workflow Example

### Step 1: Upload Files

```bash
npm install
npm run upload:rag
```

**Output:**
```
🚀 Starting bulk upload...
📁 Source folder: C:\Users\Z1n3x\Downloads\Valorant AI RAG
📚 Found 18 files to upload

⏳ [5%] Uploading: Haven_Attack.txt
✅ [5%] Completed: Haven_Attack.txt
⏳ [11%] Uploading: Haven_defense.txt
✅ [11%] Completed: Haven_defense.txt
...
✅ [100%] Completed: valorant_sunset_ranked_tips.txt

📊 Upload Summary:
✅ Success: 18
❌ Failed: 0

✨ Bulk upload complete!
```

### Step 2: Verify Persistence

```bash
npm run stores:list
```

**Output:**
```
📚 Persistent File Search Stores:

1. 📦 Valorant Coach Knowledge Base
   ID: fileSearchStores/abc123xyz
   Documents: 18
   Files:
     1. Haven Attack
     2. Haven Defense
     ...
     18. Sunset Ranked Tips
```

### Step 3: Use Your Persistent Store

```typescript
import { initialize, fileSearch } from './services/geminiFileSearch';

initialize();

// Your files are still there!
const result = await fileSearch(
    'fileSearchStores/abc123xyz',  // Your persistent store ID
    "What are the best strategies for Haven?",
    { metadataFilter: 'map="Haven"' }
);

console.log(result.text);
```

### Step 4: Come Back Weeks Later

```bash
# Check if files are still there (they will be!)
npm run stores:list
```

Your files will still be in the persistent store. **Nothing expires!**

## 🔐 Persistence Guarantees

### What Persists:
- ✅ All uploaded files
- ✅ Document chunks and embeddings
- ✅ Custom metadata
- ✅ Store configuration
- ✅ Everything until you delete it

### What Doesn't Expire:
- ✅ Files don't expire
- ✅ Stores don't expire
- ✅ Metadata doesn't expire
- ✅ Embeddings don't expire

### Only Deleted If:
- ❌ You explicitly delete a document
- ❌ You explicitly delete a store
- ❌ Your account is closed

## 📱 Real-World Usage Pattern

```typescript
// First time - Upload once
await uploadValorantRAGFiles('path/to/files');
// Creates: fileSearchStores/abc123xyz

// Every subsequent query - Just search!
const result1 = await fileSearch('fileSearchStores/abc123xyz', 'Query 1');
const result2 = await fileSearch('fileSearchStores/abc123xyz', 'Query 2');
const result3 = await fileSearch('fileSearchStores/abc123xyz', 'Query 3');
// No need to re-upload! Files are persistent.

// Days/weeks/months later - Still works!
const result = await fileSearch('fileSearchStores/abc123xyz', 'New query');
```

## 💡 Best Practices

### 1. Store Your Store ID
```typescript
// In your .env.local
VITE_RAG_STORE_ID=fileSearchStores/abc123xyz
```

### 2. Check Before Uploading
```bash
# Avoid duplicate uploads
npm run stores:list

# Upload only if needed
if [ ! store exists ]; then
    npm run upload:rag
fi
```

### 3. Update Instead of Re-Upload
```typescript
// Don't: Delete and re-upload everything
// Do: Delete specific file, upload new version

await deleteDocument('fileSearchStores/store-id/documents/old-doc-id');
await uploadToRagStore('fileSearchStores/store-id', newFile);
```

### 4. Organize by Store
```
Store 1: Valorant Maps (Haven, Bind, Split...)
Store 2: Valorant Agents (Astra, Jett, Sage...)
Store 3: Valorant Strategies (Attack, Defense...)
```

## 🔄 Migration & Backup

### Export Store Info

```typescript
import { listDocuments } from './services/geminiFileSearch';

const docs = await listDocuments('fileSearchStores/abc123xyz');
const backup = {
    storeName: 'Valorant Coach KB',
    storeId: 'fileSearchStores/abc123xyz',
    documentCount: docs.length,
    documents: docs.map(d => ({
        name: d.displayName,
        id: d.name,
        metadata: d.customMetadata
    }))
};

// Save to file
fs.writeFileSync('store-backup.json', JSON.stringify(backup, null, 2));
```

### Restore to New Store

```typescript
// Create new store
const newStoreId = await createRagStore('Valorant Coach KB (Backup)');

// Re-upload files
await uploadValorantRAGFiles('path/to/files', newStoreId);
```

## 🎓 Quick Reference

| Task | Command |
|------|---------|
| **Upload files** | `npm run upload:rag` |
| **List stores** | `npm run stores:list` |
| **View store details** | `npm run stores:info "store-id"` |
| **Create new store** | `npm run stores:create "name"` |
| **Delete store** | `npm run stores:delete "store-id"` |
| **Check list from upload** | `npx tsx scripts/uploadRAGFiles.ts --list-stores` |

## ❓ FAQ

**Q: Do I need to re-upload files every time I restart my app?**
A: No! Files persist in the cloud. Upload once, query forever.

**Q: Will my files be deleted if I don't use them for a while?**
A: No! Stores and files persist indefinitely until you delete them.

**Q: Can I upload the same files to multiple stores?**
A: Yes! Each store is independent.

**Q: How do I know which store to use in my queries?**
A: Save the store ID after upload, or list stores to find it.

**Q: What happens if I upload the same file twice?**
A: It creates a new document in the store. You should delete the old one first.

**Q: Can I update a file without deleting the store?**
A: Yes! Delete the specific document, then upload the new version.

---

**Summary:** Upload once with `npm run upload:rag` and your files persist forever! 🎮
