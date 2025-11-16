export type STTResult = { text: string };

function getRecognition(): any | null {
  const w: any = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export async function startListening(): Promise<STTResult> {
  return new Promise((resolve, reject) => {
    const Rec = getRecognition();
    if (!Rec) {
      reject(new Error('SpeechRecognition unavailable'));
      return;
    }
    const rec = new Rec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      resolve({ text: t });
    };
    rec.onerror = (e: any) => reject(new Error(e.error || 'stt_error'));
    rec.onend = () => {};
    rec.start();
  });
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = typeof opts?.rate === 'number' ? opts.rate : 1;
    u.pitch = typeof opts?.pitch === 'number' ? opts.pitch : 1;
    u.volume = typeof opts?.volume === 'number' ? opts.volume : 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
