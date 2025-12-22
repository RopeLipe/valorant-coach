
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

// Re-use the existing initialization or allow passing a key
export function initializeVideoService(apiKey?: string) {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) throw new Error("API Key required");
    ai = new GoogleGenAI({ apiKey: key });
}

export async function uploadVideoForAnalysis(file: File): Promise<string> {
    if (!ai) initializeVideoService();
    if (!ai) throw new Error("AI Service not initialized");

    try {
        // 1. Upload the file
        // The new SDK simplifies this. We can pass the File object directly if supported,
        // or we might need to convert to base64 if running in browser without full File API support in SDK.
        // However, standard File objects usually work with the `files.upload` method in the new SDK.
        
        // Note: In a browser environment, direct file uploads to Gemini API might require 
        // specific handling or might be blocked by CORS if not using the correct endpoint/method.
        // But assuming standard usage:
        
        const response = await ai.files.upload({
            file: file,
            config: { 
                displayName: file.name,
                mimeType: file.type 
            }
        });

        // 2. Wait for processing (Video takes time)
        let fileInfo = response;
        while (fileInfo.state === "PROCESSING") {
            await new Promise(r => setTimeout(r, 2000));
            fileInfo = await ai.files.get({ name: fileInfo.name });
        }

        if (fileInfo.state === "FAILED") {
            throw new Error("Video processing failed");
        }

        return fileInfo.name; // This is the URI (files/...)
    } catch (e) {
        console.error("Video upload failed:", e);
        throw e;
    }
}

export async function analyzeVideo(fileUri: string, prompt: string): Promise<string> {
    if (!ai) initializeVideoService();
    if (!ai) throw new Error("AI Service not initialized");

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Using a strong multimodal model (or 1.5-flash)
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { fileData: { fileUri: fileUri, mimeType: 'video/mp4' } }
                    ]
                }
            ],
            config: {
                temperature: 0.4,
                maxOutputTokens: 500, // Efficient output
            }
        });

        return response.text || "No analysis generated.";
    } catch (e) {
        console.error("Video analysis failed:", e);
        throw e;
    }
}
