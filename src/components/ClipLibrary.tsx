import React from 'react'
import { ClipMetadata } from '@/services/videoRecorder'

interface ClipLibraryProps {
    clips: ClipMetadata[]
    onSelectClip: (clip: ClipMetadata) => void
    selectedClipId?: string
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({ clips, onSelectClip, selectedClipId }) => {

    // Group clips by match or date could be added here
    const sortedClips = [...clips].sort((a, b) => b.timestamp - a.timestamp)

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
            <div className="p-4 border-b border-slate-800">
                <h2 className="font-bold text-white text-lg">Clip Library</h2>
                <p className="text-xs text-slate-400">{clips.length} recordings</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sortedClips.length === 0 ? (
                    <div className="text-center p-4 text-slate-500 text-sm">
                        No clips recorded yet.
                        <br />
                        Play a match to auto-record!
                    </div>
                ) : (
                    sortedClips.map(clip => (
                        <div
                            key={clip.id}
                            onClick={() => onSelectClip(clip)}
                            className={`
                                p-3 rounded cursor-pointer transition-colors border border-transparent
                                ${selectedClipId === clip.id
                                    ? 'bg-indigo-900/50 border-indigo-500/50'
                                    : 'bg-slate-800 hover:bg-slate-700 hover:border-slate-600'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-sm text-white">Round {clip.roundNumber}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${clip.outcome === 'win' ? 'bg-green-900 text-green-300' :
                                        clip.outcome === 'loss' ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-slate-300'
                                    }`}>
                                    {clip.outcome?.toUpperCase() || '???'}
                                </span>
                            </div>

                            <div className="text-xs text-slate-400 flex justify-between">
                                <span>{clip.map} • {clip.agent}</span>
                                <span>{new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            {clip.analyzed && (
                                <div className="mt-2 text-xs text-indigo-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                    AI Analyzed
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
