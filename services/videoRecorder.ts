// Wrapper for Overwolf Streaming API to capture video
const VIDEO_FOLDER = `${overwolf.io.paths.videos}\ValorantCoach`;

export interface RecordingResult {
    success: boolean;
    url?: string;
    path?: string; // Absolute path
    error?: string;
}

let isRecording = false;

export async function startRecording(): Promise<RecordingResult> {
    return new Promise((resolve) => {
        if (isRecording) {
            resolve({ success: false, error: "Already recording" });
            return;
        }

        // Check/Create folder
        // For simplicity, we assume the folder exists or Overwolf creates it.
        // We use the default capture settings.

        const settings = {
            settings: {
                video: {
                    fps: 30,
                    width: 1280,
                    height: 720,
                    use_app_window_capture: false, // Capture game, not app
                    auto_calc_kbps: true 
                },
                audio: {
                    mic: { volume: 100, enabled: true },
                    game: { volume: 75, enabled: true }
                }
            }
        };

        overwolf.streaming.start(settings, (result: any) => {
            if (result.status === "success") {
                isRecording = true;
                resolve({ success: true });
            } else {
                resolve({ success: false, error: result.error });
            }
        });
    });
}

export async function stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve) => {
        if (!isRecording) {
            resolve({ success: false, error: "Not recording" });
            return;
        }

        overwolf.streaming.stop((result: any) => {
            isRecording = false;
            if (result.status === "success") {
                // result.file_path contains the video path
                // We need to construct a 'file://' URL or return the path
                resolve({ 
                    success: true, 
                    path: result.file_path,
                    url: `file://${result.file_path}` 
                });
            } else {
                resolve({ success: false, error: result.error });
            }
        });
    });
}

export function isRecordingState(): boolean {
    return isRecording;
}

// Helper to list videos (Mock for now, normally requires overwolf.io.dir)
export async function listRecordedVideos(): Promise<any[]> {
    return new Promise((resolve) => {
        // This requires the 'FileSystem' permission which we might not have explicitly requested in manifest
        // but often 'GameInfo' or others cover basic IO in specific folders.
        // Actually, strictly we need 'FileSystem' for arbitrary access, but media folders are usually accessible.
        
        // For this prototype, we'll return an empty list or rely on local state if we don't implement full IO scanning.
        resolve([]); 
    });
}
