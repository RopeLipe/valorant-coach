/**
 * Gemini Video Service
 * Handles video upload and AI-powered gameplay analysis.
 */

import { GoogleGenAI } from "@google/genai";
import { RAG_CONFIG } from "../config/ragConfig";

let ai: GoogleGenAI | null = null;

// ============ TYPES ============

export interface KeyMoment {
    timestamp: string           // e.g. "0:32"
    type: 'mistake' | 'good_play' | 'improvement'
    description: string
}

export interface VODAnalysisResult {
    roundNumber: number | null
    agent: string
    outcome: 'win' | 'loss' | 'unknown'

    // Tactical scores (1-10)
    positioningScore: number
    crosshairScore: number
    abilityUsageScore: number

    // Key moments with timestamps
    keyMoments: KeyMoment[]

    // Top 3 actionable improvements
    improvements: string[]

    // Overall summary
    summary: string
}

// ============ INITIALIZATION ============

export function initializeVideoService(apiKey?: string) {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) throw new Error("API Key required");
    ai = new GoogleGenAI({ apiKey: key });
}

// ============ VIDEO UPLOAD ============

export async function uploadVideoForAnalysis(file: File): Promise<string> {
    if (!ai) initializeVideoService();
    if (!ai) throw new Error("AI Service not initialized");

    try {
        const response = await ai.files.upload({
            file: file,
            config: {
                displayName: file.name,
                mimeType: file.type
            }
        });

        // Wait for processing (Video takes time)
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

// ============ STRUCTURED ANALYSIS ============

const ANALYSIS_SCHEMA = {
    type: "object",
    properties: {
        roundNumber: { type: ["number", "null"], description: "Round number if identifiable" },
        agent: { type: "string", description: "Agent played in this clip" },
        outcome: { type: "string", enum: ["win", "loss", "unknown"] },
        positioningScore: { type: "number", minimum: 1, maximum: 10 },
        crosshairScore: { type: "number", minimum: 1, maximum: 10 },
        abilityUsageScore: { type: "number", minimum: 1, maximum: 10 },
        keyMoments: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    timestamp: { type: "string" },
                    type: { type: "string", enum: ["mistake", "good_play", "improvement"] },
                    description: { type: "string" }
                },
                required: ["timestamp", "type", "description"]
            }
        },
        improvements: {
            type: "array",
            items: { type: "string" },
            maxItems: 3
        },
        summary: { type: "string" }
    },
    required: ["agent", "outcome", "positioningScore", "crosshairScore", "abilityUsageScore", "keyMoments", "improvements", "summary"]
};

const STRUCTURED_PROMPT = `You are an expert Valorant coach analyzing gameplay footage.

Analyze this clip and provide structured tactical feedback:

1. **Identify** the agent played and round outcome
2. **Score** (1-10) these categories:
   - Positioning: Cover usage, angle selection, site presence
   - Crosshair Placement: Head-level, pre-aim, clearing angles
   - Ability Usage: Timing, value, economy efficiency
3. **Timestamp** 2-4 key moments (mistakes, good plays, or improvement opportunities)
4. **List** exactly 3 specific, actionable improvements
5. **Summarize** overall performance in 1-2 sentences

Be direct and tactical. Reference VCT pro examples when relevant.
Timestamps should be in MM:SS format.`;

/**
 * Analyze video and return structured JSON result
 */
export async function analyzeVideoStructured(
    fileUri: string,
    context?: { agent?: string; map?: string; rank?: string }
): Promise<VODAnalysisResult> {
    if (!ai) initializeVideoService();
    if (!ai) throw new Error("AI Service not initialized");

    // Build context-aware prompt
    let prompt = STRUCTURED_PROMPT;
    if (context?.agent) prompt += `\n\nPlayer agent: ${context.agent}`;
    if (context?.map) prompt += `\nMap: ${context.map}`;
    if (context?.rank) prompt += `\nRank: ${context.rank}`;

    try {
        const response = await ai.models.generateContent({
            model: RAG_CONFIG.defaultModel,
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
                temperature: 0.3,
                maxOutputTokens: 800,
                responseMimeType: 'application/json',
                responseSchema: ANALYSIS_SCHEMA as any
            }
        });

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        // Validate and normalize
        return normalizeAnalysisResult(parsed);
    } catch (e) {
        console.error("Structured video analysis failed:", e);
        throw e;
    }
}

/**
 * Normalize and validate analysis result
 */
function normalizeAnalysisResult(raw: any): VODAnalysisResult {
    return {
        roundNumber: typeof raw.roundNumber === 'number' ? raw.roundNumber : null,
        agent: raw.agent || 'Unknown',
        outcome: ['win', 'loss', 'unknown'].includes(raw.outcome) ? raw.outcome : 'unknown',
        positioningScore: clampScore(raw.positioningScore),
        crosshairScore: clampScore(raw.crosshairScore),
        abilityUsageScore: clampScore(raw.abilityUsageScore),
        keyMoments: Array.isArray(raw.keyMoments)
            ? raw.keyMoments.slice(0, 5).map(normalizeKeyMoment)
            : [],
        improvements: Array.isArray(raw.improvements)
            ? raw.improvements.slice(0, 3)
            : [],
        summary: raw.summary || 'Analysis complete.'
    };
}

function clampScore(val: any): number {
    const num = Number(val) || 5;
    return Math.max(1, Math.min(10, Math.round(num)));
}

function normalizeKeyMoment(m: any): KeyMoment {
    return {
        timestamp: String(m.timestamp || '0:00'),
        type: ['mistake', 'good_play', 'improvement'].includes(m.type) ? m.type : 'improvement',
        description: String(m.description || '')
    };
}

// ============ LEGACY API (for backwards compatibility) ============

/**
 * Analyze video with custom prompt (legacy API)
 */
export async function analyzeVideo(fileUri: string, prompt: string): Promise<string> {
    if (!ai) initializeVideoService();
    if (!ai) throw new Error("AI Service not initialized");

    try {
        const response = await ai.models.generateContent({
            model: RAG_CONFIG.defaultModel,
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
                maxOutputTokens: 500,
            }
        });

        return response.text || "No analysis generated.";
    } catch (e) {
        console.error("Video analysis failed:", e);
        throw e;
    }
}

