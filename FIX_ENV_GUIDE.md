# 🔧 Environment Setup Fix

## Issue

The upload script failed because it couldn't read the API key from environment variables. Node.js scripts don't have access to `import.meta.env` (Vite-specific).

## ✅ Solution Applied

I've updated the code to support both **browser (Vite)** and **Node.js** environments.

## 📋 Steps to Fix

### 1. Install Dependencies

```bash
cd c:\Users\Z1n3x\Downloads\valorant-coach
npm install
```

This installs `dotenv` for loading `.env` files in Node.js.

### 2. Check Your .env.local File

Make sure you have `.env.local` with your API key:

```bash
# View your .env.local
cat .env.local
```

It should contain:
```
VITE_GEMINI_API_KEY=your_actual_api_key_here
```

### 3. If .env.local is Missing or Empty

Create it:

```bash
# Create .env.local with your API key
echo "VITE_GEMINI_API_KEY=your_actual_api_key_here" > .env.local
```

Replace `your_actual_api_key_here` with your real Gemini API key from [Google AI Studio](https://ai.google.dev/).

### 4. Try Upload Again

```bash
npm run upload:rag
```

## 🔍 What Changed

### Before (Broken for Node.js):
```typescript
export function initialize() {
    ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
}
```

### After (Works Everywhere):
```typescript
function getApiKey(): string {
    // Browser/Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_GEMINI_API_KEY;
    }

    // Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    }

    throw new Error('No API key found.');
}

export function initialize(apiKey?: string) {
    const key = apiKey || getApiKey();
    if (!key) {
        throw new Error('Gemini API key is required. Set VITE_GEMINI_API_KEY in .env.local');
    }
    ai = new GoogleGenAI({ apiKey: key });
}
```

## 📦 Updated Files

1. **package.json** - Added `dotenv` dependency
2. **services/geminiFileSearch.ts** - Updated `initialize()` to support both environments
3. **scripts/uploadRAGFiles.ts** - Added dotenv config loading
4. **scripts/manageStores.ts** - Added dotenv config loading
5. **.env.example** - Created example file

## ✅ Verification

After installing dependencies, verify it works:

```bash
# Check if API key is loaded
npx tsx -e "import { config } from 'dotenv'; import { resolve } from 'path'; config({ path: resolve(process.cwd(), '.env.local') }); console.log('API Key found:', process.env.VITE_GEMINI_API_KEY ? 'Yes' : 'No')"
```

Expected output: `API Key found: Yes`

## 🎯 Quick Fix Commands

```bash
# 1. Install dependencies
npm install

# 2. Verify .env.local exists and has API key
cat .env.local

# 3. If not, create it (replace with your actual key)
echo "VITE_GEMINI_API_KEY=AIza..." > .env.local

# 4. Test upload
npm run upload:rag
```

## 🐛 Troubleshooting

### Error: "API key is required"
- Check `.env.local` exists: `ls .env.local`
- Check it has content: `cat .env.local`
- Ensure no extra spaces or quotes around the key

### Error: "Cannot find module 'dotenv'"
- Run `npm install` to install dependencies
- Check `package.json` has `"dotenv": "^16.4.5"` in devDependencies

### Error: "API key not valid"
- Verify your API key is correct
- Get a new one from [Google AI Studio](https://ai.google.dev/)
- Make sure there are no spaces or newlines in the key

## 📝 Example .env.local

```
VITE_GEMINI_API_KEY=AIzaSyC_your_actual_32_character_api_key_here
```

**Important:**
- No spaces around `=`
- No quotes needed
- Just the key, nothing else
- Keep this file secret (it's in `.gitignore`)

## ✨ Once Fixed

You can use all scripts:

```bash
# Upload files
npm run upload:rag

# List stores
npm run stores:list

# View store details
npm run stores:info "fileSearchStores/store-id"

# Create new store
npm run stores:create "My Store"
```

All scripts now work in both browser and Node.js environments! 🎉
