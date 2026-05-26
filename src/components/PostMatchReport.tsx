import React, { useMemo } from 'react'
import * as prediction from '../../services/predictionEngine'
import { runAdvancedAnalysis } from '../../services/advancedPatternDetection'

interface FeedbackEntry {
    t: number
    r: 'up' | 'down'
    text: string
    obj: string
    map: string
    agent: string
}

function loadFeedback(matchStart: number): FeedbackEntry[] {
    try {
        const raw = localStorage.getItem('coach_ratings')
        if (!raw) return []
        const list = JSON.parse(raw) as FeedbackEntry[]
        return Array.isArray(list) ? list.filter(e => e.t >= matchStart) : []
    } catch { return [] }
}

export const PostMatchReport: React.FC = () => {
    const match = prediction.getCurrentMatch()
    const analysis = useMemo(() => runAdvancedAnalysis(match), [match])
    const feedback = useMemo(() => loadFeedback(match?.startTime ?? 0), [match?.matchId, match?.startTime])

    if (!match || match.rounds.length === 0) {
        return (
            <div className="p-8 text-white/60">
                <h2 className="text-2xl font-bold text-white mb-2">Match Report</h2>
                <p className="text-sm">No match data yet. Play a round and come back once the coach has recorded some history.</p>
            </div>
        )
    }

    const wins = match.rounds.filter(r => r.outcome === 'win').length
    const losses = match.rounds.filter(r => r.outcome === 'loss').length
    const aggressionRate = match.rounds.filter(r => r.aggressivePlay).length / Math.max(1, match.rounds.length)
    const thumbsUp = feedback.filter(e => e.r === 'up').length
    const thumbsDown = feedback.filter(e => e.r === 'down').length

    return (
        <div className="h-full overflow-y-auto p-8 text-white">
            <header className="flex items-end justify-between mb-6 border-b border-white/10 pb-4">
                <div>
                    <h2 className="text-3xl font-bold">Match Report</h2>
                    <p className="text-sm text-white/50 mt-1">
                        {match.map.toUpperCase()} · {match.rounds.length} rounds recorded
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-mono font-bold">
                        <span className="text-emerald-400">{wins}</span>
                        <span className="text-white/30 mx-2">-</span>
                        <span className="text-red-400">{losses}</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Win / Loss</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatCard label="Confidence" value={`${Math.round(analysis.confidenceScore * 100)}%`} hint="Pattern reliability" />
                <StatCard label="Enemy Pace" value={analysis.timingPattern.tendency.toUpperCase()} hint={`${Math.round(analysis.timingPattern.avgExecuteTimeSeconds)}s avg execute`} />
                <StatCard
                    label="Your Aggression"
                    value={`${Math.round(aggressionRate * 100)}%`}
                    hint={aggressionRate > 0.6 ? 'High — consider more lurks' : aggressionRate < 0.25 ? 'Low — try earlier picks' : 'Balanced'}
                />
            </div>

            <section className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">Enemy Patterns</h3>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
                    <Row label="Dominant site" value={analysis.mapSitePattern.dominantSite ? `${analysis.mapSitePattern.dominantSite}-site` : 'balanced'} />
                    <Row label="Predicted buy next round" value={analysis.economyPrediction.likelyBuyType.toUpperCase()} />
                    <Row label="Round type" value={analysis.roundType} />
                    {analysis.lossStreakBehavior.behaviorShift !== 'normal' && (
                        <Row label="On loss streaks" value={analysis.lossStreakBehavior.behaviorShift} />
                    )}
                </div>
            </section>

            <section className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">Round Log</h3>
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-black/30 text-[10px] uppercase tracking-wider text-white/40">
                            <tr>
                                <th className="text-left px-3 py-2">#</th>
                                <th className="text-left px-3 py-2">Outcome</th>
                                <th className="text-left px-3 py-2">Site</th>
                                <th className="text-left px-3 py-2">First Blood (enemy)</th>
                                <th className="text-left px-3 py-2">Ults</th>
                            </tr>
                        </thead>
                        <tbody>
                            {match.rounds.map(r => (
                                <tr key={r.round} className="border-t border-white/5">
                                    <td className="px-3 py-2 font-mono text-white/60">{r.round}</td>
                                    <td className={`px-3 py-2 font-semibold ${r.outcome === 'win' ? 'text-emerald-400' : r.outcome === 'loss' ? 'text-red-400' : 'text-white/40'}`}>
                                        {r.outcome}
                                    </td>
                                    <td className="px-3 py-2 text-white/70">{r.plantedSite || r.site || '—'}</td>
                                    <td className="px-3 py-2 text-white/70">{r.enemyFirstKill || '—'}</td>
                                    <td className="px-3 py-2 text-white/70">{r.ultsUsed.length > 0 ? r.ultsUsed.join(', ') : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">Coach Feedback</h3>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-6 text-sm">
                    <div><span className="text-emerald-400 font-bold text-lg">{thumbsUp}</span> <span className="text-white/50">helpful</span></div>
                    <div><span className="text-red-400 font-bold text-lg">{thumbsDown}</span> <span className="text-white/50">unhelpful</span></div>
                    {feedback.length === 0 && <p className="text-white/40 italic">No ratings yet. Use the thumbs buttons on overlay responses to tune future advice.</p>}
                </div>
            </section>

            <div className="flex justify-end">
                <button
                    onClick={() => { if (confirm('Clear current match history?')) { prediction.clearMatch(); window.location.reload() } }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition"
                >
                    Clear Match Data
                </button>
            </div>
        </div>
    )
}

const StatCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {hint && <p className="text-xs text-white/50 mt-1">{hint}</p>}
    </div>
)

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between"><span className="text-white/50">{label}</span><span className="font-semibold">{value}</span></div>
)

export default PostMatchReport
