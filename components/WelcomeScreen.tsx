/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import DiagnosticsChecklist from './DiagnosticsChecklist';
import type { DiagnosticResult } from '../services/diagnostics';

interface WelcomeScreenProps {
    onStartChat: () => Promise<void>;
    isApiKeySelected: boolean;
    diagnostics: DiagnosticResult[];
    diagnosticsRunning: boolean;
    onRunDiagnostics: () => Promise<void> | void;
    canStart: boolean;
    blockingIssues: DiagnosticResult[];
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    onStartChat,
    isApiKeySelected,
    diagnostics,
    diagnosticsRunning,
    onRunDiagnostics,
    canStart,
    blockingIssues
}) => {

    const handleStartClick = async () => {
        try {
            await onStartChat();
        } catch (error) {
            // Error is handled by the parent component, but we catch it here
            // to prevent an "uncaught promise rejection" warning in the console.
            console.error("Start chat process failed:", error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-10">
            <div className="w-full max-w-5xl">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
                    <div className="text-center lg:text-left">
                        <p className="text-sm uppercase tracking-[0.4em] text-gem-mist/80">Valorant Coach</p>
                        <h1 className="text-4xl sm:text-5xl font-bold mt-3 mb-4">Your personal coach, primed before every match.</h1>
                        <p className="text-gem-offwhite/80 text-lg leading-relaxed mb-8">
                            Run the quick-start diagnostics, bind your hotkeys, and ensure the overlay plus microphone are ready. Once every check is green, hop into Valorant and get real-time guidance.
                        </p>

                        {!isApiKeySelected && (
                            <div className="w-full bg-gem-slate border border-gem-mist/50 rounded-lg py-3 px-5 text-center text-red-400 font-semibold mb-6">
                                Please set your Gemini API Key in the .env.local file.
                            </div>
                        )}

                        <div className="space-y-2">
                            <button 
                                onClick={handleStartClick}
                                disabled={!isApiKeySelected || !canStart}
                                className="w-full px-6 py-3 rounded-xl bg-gem-red/90 hover:bg-gem-red text-white font-bold transition-colors disabled:bg-gem-mist/40 disabled:cursor-not-allowed"
                                title={!isApiKeySelected ? "Set your Gemini API key before starting." : canStart ? "Start your coaching session" : "Complete the highlighted tests"}
                            >
                                Launch Desktop Coach
                            </button>
                            {!canStart && (
                                <p className="text-xs text-red-300">
                                    Complete the highlighted tests ({blockingIssues.length}) before launching the chat experience.
                                </p>
                            )}
                        </div>
                    </div>

                    <DiagnosticsChecklist
                        title="First-run Checklist"
                        description="These automated tests verify Overwolf, microphone, voice hotkey, and Gemini data access."
                        items={diagnostics}
                        running={diagnosticsRunning}
                        onRun={onRunDiagnostics}
                        variant="card"
                    />
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;