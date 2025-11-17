import { getClient, initialize } from "./geminiFileSearch"

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      if (!result) {
        reject(new Error("Empty audio payload"))
        return
      }
      const base64 = result.split(",").pop() || ""
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio blob"))
    reader.readAsDataURL(blob)
  })
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!blob || !blob.size) throw new Error("No audio captured")
  try {
    initialize()
  } catch (err) {
    console.error("Gemini init error", err)
  }
  const client = getClient()
  const base64 = await blobToBase64(blob)
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Transcribe this Valorant coaching question into plain English. Respond with only the recognized text." },
          {
            inlineData: {
              mimeType: blob.type || "audio/webm",
              data: base64
            }
          }
        ]
      }
    ]
  })
  const text = (response.text || "").trim()
  return text
}
