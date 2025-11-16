/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface WelcomeScreenProps {
    onStartChat: () => Promise<void>;
    isApiKeySelected: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartChat, isApiKeySelected }) => {

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
        <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-3xl text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">Your Personal Valorant Coach</h1>
                <p className="text-gem-offwhite/70 mb-8">
                    Get personalized coaching based on a shared knowledge base of Valorant strategies and data.
                </p>

                <div className="w-full max-w-xl mx-auto mb-8">
                     {!isApiKeySelected && (
                        <div className="w-full bg-gem-slate border border-gem-mist/50 rounded-lg py-3 px-5 text-center text-red-500 font-semibold">
                            Please set your Gemini API Key in the .env.local file.
                        </div>
                    )}
                </div>

                <div className="w-full max-w-xl mx-auto">
                    <button 
                        onClick={handleStartClick}
                        disabled={!isApiKeySelected}
                        className="w-full px-6 py-3 rounded-md bg-gem-red hover:bg-red-600 text-white font-bold transition-colors disabled:bg-gem-mist/50 disabled:cursor-not-allowed"
                        title={!isApiKeySelected ? "Please set your Gemini API Key in the .env.local file" : "Start your coaching session"}
                    >
                        Start Coaching Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;