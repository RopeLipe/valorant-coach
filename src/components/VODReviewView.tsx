import React, { useState, useRef, useEffect } from 'react'
import { ClipMetadata } from '@/services/videoRecorder'
import { analyzeVideoStructured, VODAnalysisResult, uploadVideoForAnalysis } from '@/services/geminiVideoService'

interface VODReviewViewProps {
    clip: ClipMetadata | null
    onAnalysisComplete: (clipId: string, result: VODAnalysisResult) => void
}

export const VODReviewView: React.FC<VODReviewViewProps> = ({ clip, onAnalysisComplete }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<VODAnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Reset state when clip changes
    useEffect(() => {
        setAnalysis(null)
        setError(null)
        setIsAnalyzing(false)
    }, [clip?.id])

    const handleAnalyze = async () => {
        if (!clip) return

        setIsAnalyzing(true)
        setError(null)

        try {
            // Convert local file path to Overwolf-accessible URI if needed
            // For now assuming filePath is accessible or we use a file picker/blob
            // Note: In Overwolf, we might need to use overwolf.io.readFile or similar to get a blob
            // But geminiVideoService expects a file URI (gs:// or similar) or we upload a File object.
            // Since we can't easily get a File object from a path in web without user input, 
            // we might need to prompt user to select the file, OR use Overwolf's media API.

            // For this implementation, we'll assume we can get the file via a fetch or it's already a URI
            // In a real Overwolf app, we'd likely use `overwolf.media.videos.getVideos` to get a valid URL

            // SIMULATION for now: We need a File object for uploadVideoForAnalysis
            // We'll show a file picker as a fallback if we can't auto-load
            document.getElementById('hidden-file-input')?.click()

        } catch (e: any) {
            setError(e.message || "Analysis failed")
            setIsAnalyzing(false)
        }
    }

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !clip) return

        setIsAnalyzing(true)
        try {
            const file = e.target.files[0]
            // Upload first
            const fileUri = await uploadVideoForAnalysis(file)

            // Analyze
            const result = await analyzeVideoStructured(fileUri, {
                agent: clip.agent,
                map: clip.map
            })

            setAnalysis(result)
            onAnalysisComplete(clip.id, result)
        } catch (e: any) {
            setError(e.message || "Analysis failed")
        } finally {
            setIsAnalyzing(false)
        }
    }

    const seekTo = (timestampStr: string) => {
        if (!videoRef.current) return
        const [min, sec] = timestampStr.split(':').map(Number)
        if (!isNaN(min) && !isNaN(sec)) {
            videoRef.current.currentTime = min * 60 + sec
            videoRef.current.play()
        }
    }

    if (!clip) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
                Select a clip to review
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <div>
                    <h2 className="text-xl font-bold text-white">Round {clip.roundNumber} Review</h2>
                    <p className="text-slate-400 text-sm">{clip.map} • {clip.agent} • {clip.outcome.toUpperCase()}</p>
                </div>

                {!analysis && !isAnalyzing && (
                    <button
                        onClick={handleAnalyze}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Analyze with Gemini
                    </button>
                )}

                {isAnalyzing && (
                    <div className="text-indigo-400 flex items-center gap-2 animate-pulse">
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                        Analyzing Gameplay...
                    </div>
                )}

                {/* Hidden file input for simulation */}
                <input
                    type="file"
                    id="hidden-file-input"
                    className="hidden"
                    accept="video/*"
                    onChange={onFileSelected}
                />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Video Player Area */}
                <div className="flex-1 bg-black relative flex items-center justify-center">
                    <video
                        ref={videoRef}
                        src={clip.url || clip.filePath} // Note: filePath might need 'file://' prefix or overwolf scheme
                        controls
                        className="max-h-full max-w-full"
                    />

                    {!clip.url && !clip.filePath && (
                        <div className="text-slate-500">Video file not found</div>
                    )}
                </div>

                {/* Analysis Sidebar */}
                {analysis && (
                    <div className="w-96 bg-slate-900 border-l border-slate-800 overflow-y-auto p-4 space-y-6">

                        {/* Scores */}
                        <div className="grid grid-cols-3 gap-2">
                            <ScoreCard label="Positioning" score={analysis.positioningScore} />
                            <ScoreCard label="Crosshair" score={analysis.crosshairScore} />
                            <ScoreCard label="Utility" score={analysis.abilityUsageScore} />
                        </div>

                        {/* Summary */}
                        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Coach Summary</h3>
                            <p className="text-sm text-slate-200 leading-relaxed">{analysis.summary}</p>
                        </div>

                        {/* Key Moments */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Key Moments</h3>
                            <div className="space-y-2">
                                {analysis.keyMoments.map((moment, i) => (
                                    <div
                                        key={i}
                                        onClick={() => seekTo(moment.timestamp)}
                                        className="bg-slate-800 p-2 rounded hover:bg-slate-700 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-slate-950 text-indigo-400 text-xs px-1.5 py-0.5 rounded font-mono group-hover:text-white transition-colors">
                                                {moment.timestamp}
                                            </span>
                                            <span className={`text-xs font-bold uppercase ${moment.type === 'mistake' ? 'text-red-400' :
                                                moment.type === 'good_play' ? 'text-green-400' : 'text-blue-400'
                                                }`}>
                                                {moment.type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300">{moment.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Improvements */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Focus Areas</h3>
                            <ul className="space-y-2">
                                {analysis.improvements.map((imp, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                                        <span className="text-indigo-500 font-bold">•</span>
                                        {imp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="absolute bottom-4 right-4 bg-red-900/90 text-white px-4 py-2 rounded shadow-lg border border-red-700">
                    Error: {error}
                </div>
            )}
        </div>
    )
}

const ScoreCard = ({ label, score }: { label: string, score: number }) => {
    const color = score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'
    return (
        <div className="bg-slate-800 p-2 rounded text-center">
            <div className={`text-2xl font-bold ${color}`}>{score}</div>
            <div className="text-xs text-slate-500 uppercase">{label}</div>
        </div>
    )
}
