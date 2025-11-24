/// <reference types="vite/client" />

export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!blob || !blob.size) throw new Error("No audio captured");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY is missing in .env.local");
  }

  const formData = new FormData();
  // Groq expects a file with a name/extension for audio
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-large-v3-turbo");
  // Optional: prompt, temperature, language, etc.

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        // Do NOT set Content-Type header manually when using FormData; 
        // the browser sets it with the boundary.
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return correctTranscript(data.text.trim());
  } catch (err) {
    console.error("Transcription failed", err);
    throw err;
  }
}

export function correctTranscript(text: string): string {
  // Common mishearings for Valorant terms
  const corrections: Record<string, string> = {
    "vito": "Veto",
    "Vito": "Veto",
    "kayo": "KAY/O",
    "kay o": "KAY/O",
    "k o": "KAY/O",
  };

  let corrected = text;
  for (const [wrong, right] of Object.entries(corrections)) {
    // Use word boundary to avoid replacing parts of other words
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    corrected = corrected.replace(regex, right);
  }
  return corrected;
}
