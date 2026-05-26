import React from 'react'
import { AdvancedPatternAnalysis } from '@/services/advancedPatternDetection'

interface PredictionViewProps {
    analysis: AdvancedPatternAnalysis
    isVisible: boolean
}

export const PredictionView: React.FC<PredictionViewProps> = ({ analysis, isVisible }) => {
    if (!isVisible) return null

    const { economyPrediction, timingPattern, mapSitePattern, roundTypeAdvice, predictedNextPlay } = analysis

    // Color helpers
    const getConfidenceColor = (conf: number) => {
        if (conf > 0.7) return 'text-green-400'
        if (conf > 0.4) return 'text-yellow-400'
        return 'text-gray-400'
    }

    return (
        <div className="fixed top-20 right-4 w-80 bg-slate-900/90 border border-slate-700 rounded-lg p-4 text-white shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                <h3 className="font-bold text-lg text-indigo-400">Tactical Insight</h3>
                <span className={`text-xs font-mono ${getConfidenceColor(analysis.confidenceScore)}`}>
                    CONF: {Math.round(analysis.confidenceScore * 100)}%
                </span>
            </div>

            {/* Main Prediction */}
            <div className="mb-4 bg-slate-800/50 p-3 rounded border-l-4 border-indigo-500">
                <p className="text-sm font-medium leading-relaxed">{predictedNextPlay}</p>
            </div>

            {/* Key Insights Grid */}
            <div className="space-y-3 text-sm">

                {/* Economy */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-400">Economy</span>
                    <span className={`font-bold ${economyPrediction.likelyBuyType === 'eco' ? 'text-green-400' : 'text-red-400'}`}>
                        {economyPrediction.likelyBuyType.toUpperCase()}
                        {economyPrediction.opWarning && <span className="ml-2 text-red-500 text-xs">⚠️ OP</span>}
                    </span>
                </div>

                {/* Timing */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-400">Pace</span>
                    <span className="font-medium text-blue-300">
                        {timingPattern.tendency.toUpperCase()}
                        <span className="text-xs text-slate-500 ml-1">({Math.round(timingPattern.avgExecuteTimeSeconds)}s)</span>
                    </span>
                </div>

                {/* Site Preference */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-400">Site Pref</span>
                    <span className="font-medium text-orange-300">
                        {mapSitePattern.dominantSite ? (
                            <>
                                {mapSitePattern.dominantSite}-SITE
                                <span className="text-xs text-slate-500 ml-1">
                                    ({mapSitePattern.siteExecuteStyle[mapSitePattern.dominantSite] || 'mixed'})
                                </span>
                            </>
                        ) : 'BALANCED'}
                    </span>
                </div>

                {/* Round Advice */}
                {roundTypeAdvice && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <p className="text-xs text-slate-300 italic">"{roundTypeAdvice}"</p>
                    </div>
                )}
            </div>
        </div>
    )
}
