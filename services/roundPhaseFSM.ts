/**
 * Round Phase FSM
 *
 * Pure, side-effect-free mapping from a phase transition (prev → next) to a
 * list of actions the overlay should take. Keeps the phase-handling logic
 * testable and easy to extend without bloating OverlayApp.
 *
 * Consumers apply the returned actions themselves (calling into Gemini,
 * predictionEngine, UI state setters, etc.) so this module has zero
 * framework or network dependencies.
 */

export type Phase = 'shopping' | 'combat' | 'end' | 'unknown'

export type PhaseAction =
    | { type: 'CLEAR_ROUND_END_PROMPT' }
    | { type: 'SHOW_ROUND_END_PROMPT' }
    | { type: 'AUTO_BUY_ADVICE'; round: number }
    | { type: 'RECORD_ROUND_FOR_PREDICTION' }
    | { type: 'FLUSH_PENDING_HINT' }

export interface TransitionInput {
    prevPhase: Phase
    nextPhase: Phase
    round: number
    // Latest round number we already auto-prompted for (caller-maintained
    // so we don't double-fire if the phase jitters).
    lastBuyRound: number
    // Latest round we've recorded for prediction (idempotency guard).
    lastRecordedRound: number
    // User preference: auto buy advice enabled?
    autoBuyAdviceEnabled: boolean
    // A hint is queued waiting for a safe window.
    hasPendingSafeHint: boolean
    // Result of tracker.getPhaseGate().safeToSpeak
    safeToSpeak: boolean
}

/**
 * Resolve the set of actions the overlay should apply for a phase
 * transition. Consumers apply them in order.
 */
export function resolvePhaseActions(input: TransitionInput): PhaseAction[] {
    const actions: PhaseAction[] = []
    const { prevPhase, nextPhase, round } = input
    if (prevPhase === nextPhase) return actions

    if (nextPhase === 'shopping') {
        actions.push({ type: 'CLEAR_ROUND_END_PROMPT' })
        if (
            input.autoBuyAdviceEnabled &&
            round >= 1 &&
            round !== input.lastBuyRound
        ) {
            actions.push({ type: 'AUTO_BUY_ADVICE', round })
        }
    } else if (nextPhase === 'end') {
        // Only show the round-end prompt on a REAL combat→end transition. The
        // unknown→end case fires on overlay reload when the tracker restored a
        // stale 'end' phase from localStorage — showing the prompt there means
        // it would appear every time the overlay reopens, with no way to clear
        // it until the next round actually starts.
        if (prevPhase === 'combat') {
            actions.push({ type: 'SHOW_ROUND_END_PROMPT' })
        }
        if (prevPhase === 'combat' && round >= 1 && round !== input.lastRecordedRound) {
            actions.push({ type: 'RECORD_ROUND_FOR_PREDICTION' })
        }
    } else if (nextPhase === 'combat') {
        actions.push({ type: 'CLEAR_ROUND_END_PROMPT' })
    } else if (nextPhase === 'unknown') {
        // Match ended / GEP dropped — don't leave the UI stuck on "Round Ended".
        actions.push({ type: 'CLEAR_ROUND_END_PROMPT' })
    }

    if (input.safeToSpeak && input.hasPendingSafeHint) {
        actions.push({ type: 'FLUSH_PENDING_HINT' })
    }

    return actions
}
