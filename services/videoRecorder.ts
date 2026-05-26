/**
 * Video Recorder Service
 * Wrapper for Overwolf Streaming API with round-aware recording and metadata.
 */

const VIDEO_FOLDER = `${overwolf.io.paths.videos}\\ValorantCoach`;

// ============ TYPES ============

export interface RecordingResult {
    success: boolean;
    url?: string;
    path?: string;
    error?: string;
    metadata?: ClipMetadata;
}

export interface ClipMetadata {
    id: string
    roundNumber: number | null
    map: string
    agent: string
    outcome: 'win' | 'loss' | 'unknown'
    timestamp: number
    duration: number         // in seconds
    filePath: string
    analyzed: boolean
}

export interface RecordingContext {
    roundNumber?: number
    map?: string
    agent?: string
}

// ============ STATE ============

let isRecording = false;
let recordingStartTime: number = 0;
let currentContext: RecordingContext = {};
let clipLibrary: ClipMetadata[] = [];

const CLIP_LIBRARY_KEY = 'valorant_coach_clip_library';

// ============ INITIALIZATION ============

/**
 * Load clip library from storage on init
 */
export function initVideoRecorder(): void {
    try {
        const stored = localStorage.getItem(CLIP_LIBRARY_KEY);
        if (stored) {
            clipLibrary = JSON.parse(stored);
            console.log('[VideoRecorder] Loaded', clipLibrary.length, 'clips from storage');
        }
    } catch (e) {
        console.error('[VideoRecorder] Failed to load clip library:', e);
    }
}



// ============ RECORDING CONTROLS ============

/**
 * Start recording with optional context
 */
export async function startRecording(context?: RecordingContext): Promise<RecordingResult> {
    return new Promise((resolve) => {
        if (isRecording) {
            resolve({ success: false, error: "Already recording" });
            return;
        }

        currentContext = context || {};
        recordingStartTime = Date.now();

        const settings = {
            settings: {
                video: {
                    fps: 30,
                    width: 1280,
                    height: 720,
                    use_app_window_capture: false,
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
                console.log('[VideoRecorder] Started recording', currentContext);
                resolve({ success: true });
            } else {
                resolve({ success: false, error: result.error });
            }
        });
    });
}

/**
 * Stop recording and save with metadata
 */
export async function stopRecording(outcome?: 'win' | 'loss' | 'unknown'): Promise<RecordingResult> {
    return new Promise((resolve) => {
        if (!isRecording) {
            resolve({ success: false, error: "Not recording" });
            return;
        }

        const duration = Math.round((Date.now() - recordingStartTime) / 1000);

        overwolf.streaming.stop((result: any) => {
            isRecording = false;

            if (result.status === "success") {
                const metadata: ClipMetadata = {
                    id: generateClipId(),
                    roundNumber: currentContext.roundNumber ?? null,
                    map: currentContext.map || 'Unknown',
                    agent: currentContext.agent || 'Unknown',
                    outcome: outcome || 'unknown',
                    timestamp: recordingStartTime,
                    duration,
                    filePath: result.file_path,
                    analyzed: false
                };

                // Add to library
                addClipToLibrary(metadata);

                console.log('[VideoRecorder] Stopped recording, saved:', metadata.id);

                resolve({
                    success: true,
                    path: result.file_path,
                    url: `file://${result.file_path}`,
                    metadata
                });
            } else {
                resolve({ success: false, error: result.error });
            }
        });
    });
}

/**
 * Check recording state
 */
export function isRecordingState(): boolean {
    return isRecording;
}

/**
 * Get current recording context
 */
export function getRecordingContext(): RecordingContext {
    return { ...currentContext };
}

/**
 * Update context mid-recording (e.g., when round number becomes known)
 */
export function updateRecordingContext(updates: Partial<RecordingContext>): void {
    currentContext = { ...currentContext, ...updates };
}

// ============ CLIP LIBRARY ============

/**
 * Get all clips in library
 */
export function getClipLibrary(): ClipMetadata[] {
    return [...clipLibrary];
}

/**
 * Get clips filtered by criteria
 */
export function getClips(filter?: {
    map?: string;
    agent?: string;
    analyzed?: boolean;
    minRound?: number;
    maxRound?: number;
}): ClipMetadata[] {
    if (!filter) return getClipLibrary();

    return clipLibrary.filter(clip => {
        if (filter.map && clip.map !== filter.map) return false;
        if (filter.agent && clip.agent !== filter.agent) return false;
        if (filter.analyzed !== undefined && clip.analyzed !== filter.analyzed) return false;
        if (filter.minRound && (clip.roundNumber ?? 0) < filter.minRound) return false;
        if (filter.maxRound && (clip.roundNumber ?? 999) > filter.maxRound) return false;
        return true;
    });
}

/**
 * Mark a clip as analyzed
 */
export function markClipAnalyzed(clipId: string): void {
    const clip = clipLibrary.find(c => c.id === clipId);
    if (clip) {
        clip.analyzed = true;
        saveClipLibrary();
    }
}

/**
 * Delete a clip from library
 */
export function deleteClip(clipId: string): boolean {
    const index = clipLibrary.findIndex(c => c.id === clipId);
    if (index >= 0) {
        clipLibrary.splice(index, 1);
        saveClipLibrary();
        return true;
    }
    return false;
}

/**
 * Get clip by ID
 */
export function getClipById(clipId: string): ClipMetadata | undefined {
    return clipLibrary.find(c => c.id === clipId);
}

// ============ ROUND-AWARE RECORDING ============

/**
 * Start recording for a specific round
 */
export async function startRoundRecording(
    roundNumber: number,
    map: string,
    agent: string
): Promise<RecordingResult> {
    return startRecording({
        roundNumber,
        map,
        agent
    });
}

/**
 * Stop recording and tag with round outcome
 */
export async function stopRoundRecording(outcome: 'win' | 'loss'): Promise<RecordingResult> {
    return stopRecording(outcome);
}

// ============ HELPERS ============

function generateClipId(): string {
    return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addClipToLibrary(clip: ClipMetadata): void {
    clipLibrary.unshift(clip);  // Add to front (newest first)

    // Keep max 50 clips in memory
    if (clipLibrary.length > 50) {
        clipLibrary.pop();
    }

    saveClipLibrary();
}

function saveClipLibrary(): void {
    try {
        localStorage.setItem(CLIP_LIBRARY_KEY, JSON.stringify(clipLibrary));
    } catch (e) {
        console.error('[VideoRecorder] Failed to save clip library:', e);
    }
}

// ============ LEGACY API ============

/**
 * List recorded videos (legacy - now returns clip library)
 */
export async function listRecordedVideos(): Promise<ClipMetadata[]> {
    return getClipLibrary();
}

