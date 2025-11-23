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
    return data.text.trim();
  } catch (err) {
    console.error("Transcription failed", err);
    throw err;
  }
}
