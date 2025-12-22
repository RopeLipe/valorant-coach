
import React, { useState, useEffect } from "react";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Video, Play, Square, Loader2, FileVideo, Sparkles } from "lucide-react";
import * as videoRecorder from "../../services/videoRecorder";
import * as geminiVideo from "../../services/geminiVideoService";

export default function VODReviewView() {
    const [recording, setRecording] = useState(false);
    const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);
    const [lastVideoUrl, setLastVideoUrl] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sync initial state
    useEffect(() => {
        setRecording(videoRecorder.isRecordingState());
    }, []);

    const toggleRecording = async () => {
        setError(null);
        if (recording) {
            const result = await videoRecorder.stopRecording();
            if (result.success) {
                setRecording(false);
                setLastVideoPath(result.path || null);
                setLastVideoUrl(result.url || null);
            } else {
                setError("Failed to stop recording: " + result.error);
            }
        } else {
            const result = await videoRecorder.startRecording();
            if (result.success) {
                setRecording(true);
                setAnalysisResult(null);
            } else {
                setError("Failed to start recording: " + result.error);
            }
        }
    };

    const handleAnalyze = async () => {
        if (!lastVideoUrl || !lastVideoPath) return;

        setAnalyzing(true);
        setError(null);
        setAnalysisResult(null);

        try {
            // In a real browser environment, we can't easily get a File object from a local path 
            // without user interaction due to security.
            // However, inside Overwolf, we might have access or we can try to fetch the local blob.
            
            // Try fetching the local file URL
            const response = await fetch(lastVideoUrl);
            const blob = await response.blob();
            const file = new File([blob], "recording.mp4", { type: "video/mp4" });

            const uri = await geminiVideo.uploadVideoForAnalysis(file);
            const analysis = await geminiVideo.analyzeVideo(uri, 
                "Analyze this Valorant gameplay clip. Identify the agent played, the round outcome, and provide 3 specific tactical improvements for the player. Focus on positioning, crosshair placement, and ability usage."
            );

            setAnalysisResult(analysis);

        } catch (err: any) {
            console.error(err);
            setError("Analysis failed: " + (err.message || "Unknown error"));
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="h-full p-8 flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Video className="w-8 h-8 text-white" />
                        VOD Review
                    </h2>
                    <p className="text-white/60 mt-1">Record gameplay clips and get AI tactical analysis.</p>
                </div>
            </div>

            {/* Recorder Controls */}
            <Card className="p-6 bg-white/5 border-white/10">
                <div className="flex items-center gap-6">
                    <Button
                        size="lg"
                        variant={recording ? "destructive" : "default"}
                        className={`h-14 px-8 font-bold text-lg shadow-xl transition-all ${
                            recording ? "animate-pulse" : "bg-white text-black hover:bg-gray-200"
                        }`}
                        onClick={toggleRecording}
                    >
                        {recording ? (
                            <>
                                <Square className="w-6 h-6 mr-3 fill-current" />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <div className="w-4 h-4 rounded-full bg-red-500 mr-3" />
                                Start Recording
                            </>
                        )}
                    </Button>

                    <div className="flex-1">
                        <div className="text-sm font-medium text-white/40 uppercase tracking-widest mb-1">Status</div>
                        <div className="text-xl font-bold text-white">
                            {recording ? "Recording in progress..." : "Ready to record"}
                        </div>
                    </div>
                </div>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}
            </Card>

            {/* Review Section */}
            {(lastVideoUrl || analysisResult) && (
                <div className="grid grid-cols-2 gap-6 h-[500px]">
                    {/* Video Player */}
                    <Card className="p-4 bg-black/40 border-white/10 flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <FileVideo className="w-5 h-5 text-white/60" />
                            <span className="font-bold text-white/80 text-sm">Latest Clip</span>
                        </div>
                        <div className="flex-1 bg-black rounded-lg overflow-hidden relative group">
                            {lastVideoUrl ? (
                                <video 
                                    src={lastVideoUrl} 
                                    controls 
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-white/20">
                                    No video loaded
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button 
                                onClick={handleAnalyze} 
                                disabled={analyzing || !lastVideoUrl}
                                className="bg-white text-black hover:bg-white/90 font-bold"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Analyze Clip
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* Analysis Result */}
                    <Card className="p-6 bg-white/5 border-white/10 flex flex-col overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Brain className="w-24 h-24 text-white" />
                        </div>
                        <div className="flex items-center gap-2 mb-6 relative z-10">
                            <Sparkles className="w-5 h-5 text-white" />
                            <h3 className="font-bold text-white text-lg">AI Analysis</h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 relative z-10">
                            {analyzing ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-white/40">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p className="text-sm font-medium">Processing gameplay footage...</p>
                                    <p className="text-xs">This may take a minute.</p>
                                </div>
                            ) : analysisResult ? (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <div className="whitespace-pre-wrap leading-relaxed text-white/90">
                                        {analysisResult}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-white/20">
                                    <p>Record a clip and click Analyze to get feedback.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
