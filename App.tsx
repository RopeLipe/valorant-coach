/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { AppStatus, ChatMessage } from './types';
import * as geminiService from './services/geminiFileSearch';
import { RAG_CONFIG } from './config/ragConfig';
import Spinner from './components/Spinner';
import WelcomeScreen from './components/WelcomeScreen';
import ChatInterface from './components/ChatInterface';
import OverlayHUD from './overlay/OverlayHUD';
import DesktopSettingsPanel from './components/DesktopSettingsPanel';
import * as voice from './services/voice';

// Use the persistent file search store from config
// This is configured in .env.local as VITE_RAG_STORE_ID
const SHARED_RAG_STORE_NAME = RAG_CONFIG.defaultStoreId;

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [error, setError] = useState<string | null>(null);
    const [activeRagStoreName, setActiveRagStoreName] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
    const [documentName, setDocumentName] = useState<string>('');
    const [gameContext, setGameContext] = useState<any>({});
    const [overlayInfo, setOverlayInfo] = useState<any>({});
    const [overlayScale, setOverlayScale] = useState<number>(1);
    const [overlayTheme, setOverlayTheme] = useState<'dark' | 'light'>('dark');
    const [overlayAiQueue, setOverlayAiQueue] = useState<string[]>([]);
    useEffect(() => {
        try {
            const storedCorner = localStorage.getItem('overlay_corner');
            const storedOpacity = localStorage.getItem('overlay_opacity');
            if (!storedCorner) localStorage.setItem('overlay_corner', 'right');
            if (!storedOpacity) localStorage.setItem('overlay_opacity', '0.9');
        } catch {}
    }, []);
    
    const isApiKeySelected = !!import.meta.env.VITE_GEMINI_API_KEY;

    const handleError = (message: string, err: any) => {
        console.error(message, err);
        setError(`${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`);
        setStatus(AppStatus.Error);
    };

    const clearError = () => {
        setError(null);
        setStatus(AppStatus.Welcome);
    }

    useEffect(() => {
        setStatus(AppStatus.Welcome);
    }, []);

    const handleStartChat = async () => {
        if (!isApiKeySelected) {
            // This should not happen if the button is disabled, but as a safeguard.
            alert("Please set your Gemini API Key in the .env.local file.");
            return;
        }
        
        try {
            geminiService.initialize();
        } catch (err) {
            handleError("Initialization failed. Please check your API Key.", err);
            return;
        }
        
        setStatus(AppStatus.PreparingChat);

        try {
            // We use the predefined shared store name now
            const ragStoreName = SHARED_RAG_STORE_NAME;

            const questions = await geminiService.generateExampleQuestions(ragStoreName);
            setExampleQuestions(questions);

            setDocumentName('Valorant Knowledge Base');

            setActiveRagStoreName(ragStoreName);
            setChatHistory([]);
        setStatus(AppStatus.Chatting);
    } catch (err) {
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                handleError("The API key is invalid or lacks permissions for the shared store.", err);
            } else {
                handleError("Failed to start chat session. The shared document store might not exist or may be inaccessible.", err);
            }
        }
    };

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const data: any = event.data;
            if (!data || data.source !== 'valorant') return;
            const payload = data.payload;
            if (payload && payload.type === 'info_update') {
                const info = payload.data?.info;
                const mi = info?.match_info;
                const me = info?.me;
                setGameContext((prev: any) => ({
                    ...prev,
                    round_phase: mi?.round_phase ?? prev.round_phase,
                    round_number: mi?.round_number ?? prev.round_number,
                    map: mi?.map ?? prev.map,
                    team: mi?.team ?? prev.team,
                    agent: me?.agent ?? prev.agent,
                    player_name: me?.player_name ?? prev.player_name
                }));
                setOverlayInfo(info || {});
                if (status === AppStatus.Chatting) {
                    const phase = mi?.round_phase;
                    if (phase === 'shopping') {
                        const prompt = `Provide buy recommendations for the upcoming round in Valorant. Map: ${mi?.map || gameContext.map || 'unknown'}. Team: ${mi?.team || gameContext.team || 'unknown'}. Agent: ${me?.agent || gameContext.agent || 'unknown'}.`;
                        handleSendMessage(prompt);
                    }
                }
            }
            if (payload && payload.type === 'new_events') {
                const events = payload.data?.events || [];
                for (const ev of events) {
                    if (status === AppStatus.Chatting && ev.name === 'kill') {
                        const prompt = `Suggest mid-round tips after a kill in Valorant. Map: ${gameContext.map || 'unknown'}. Agent: ${gameContext.agent || 'unknown'}.`;
                        handleSendMessage(prompt);
                    }
                }
            }
        };
        window.addEventListener('message', onMessage);
        const sampler = setInterval(() => {
            setOverlayInfo((prev: any) => prev);
        }, 16);
        return () => {
            window.removeEventListener('message', onMessage);
            clearInterval(sampler);
        };
    }, [status, gameContext, activeRagStoreName]);

    useEffect(() => {
        try {
            const ow: any = (window as any).overwolf;
            if (ow && ow.settings && ow.settings.hotkeys) {
                
            }
        } catch {}
    }, []);

    const buildCompositePrompt = (userText: string) => {
        const info = overlayInfo || {};
        const mi = info.match_info || {};
        const rosterKeys = Object.keys(mi).filter((k: string) => k.startsWith('roster_'));
        const roster = rosterKeys.map((k: string) => {
            try { const raw = mi[k]; return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
        }).filter(Boolean) as any[];
        const allies = roster.filter(r => r.teammate).map(r => r.character).join(', ');
        const enemies = roster.filter(r => !r.teammate).map(r => r.character).join(', ');
        const agent = (info.me || {}).agent || 'unknown';
        const map = mi.map || 'unknown';
        return `User: ${userText}
Agent: ${agent}
Allies: ${allies || 'unknown'}
Enemies: ${enemies || 'unknown'}
Map: ${map}`;
    };

    const handleEndChat = () => {
        // No longer deletes the persistent store
        setActiveRagStoreName(null);
        setChatHistory([]);
        setExampleQuestions([]);
        setDocumentName('');
        setStatus(AppStatus.Welcome);
    };

    const handleSendMessage = async (message: string) => {
        if (!activeRagStoreName) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsQueryLoading(true);

        try {
            const result = await geminiService.fileSearch(activeRagStoreName, message);
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.text }],
                groundingChunks: result.groundingChunks
            };
            setChatHistory(prev => [...prev, modelMessage]);
            try { voice.speak(result.text); } catch {}
            try {
                const text = result.text || '';
                const first = text.split('\n').find(Boolean) || text;
                setOverlayAiQueue([first]);
            } catch {}
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            handleError("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };
    
    const renderContent = () => {
        switch(status) {
            case AppStatus.Initializing:
                return (
                    <div className="flex items-center justify-center h-screen">
                        <Spinner /> <span className="ml-4 text-xl">Initializing...</span>
                    </div>
                );
            case AppStatus.Welcome:
                 return <WelcomeScreen onStartChat={handleStartChat} isApiKeySelected={isApiKeySelected} />;
            case AppStatus.PreparingChat:
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <Spinner />
                        <h2 className="text-2xl font-bold mt-4">Preparing your coaching session...</h2>
                    </div>
                );
            case AppStatus.Chatting:
                // In-game: show only compact overlay; Out-of-game: show chat interface.
                if ((overlayInfo && (overlayInfo.match_info || overlayInfo.me))) {
                    return <OverlayHUD info={overlayInfo} scale={overlayScale} theme={overlayTheme} onPrompt={(t) => handleSendMessage(buildCompositePrompt(t))} aiSuggestions={overlayAiQueue} />
                }
                return (
                    <ChatInterface 
                        documentName={documentName}
                        history={chatHistory}
                        isQueryLoading={isQueryLoading}
                        onSendMessage={handleSendMessage}
                        onNewChat={handleEndChat}
                        exampleQuestions={exampleQuestions}
                    />
                );
            case AppStatus.Error:
                 return (
                    <div className="flex flex-col items-center justify-center h-screen bg-red-900/20 text-red-300">
                        <h1 className="text-3xl font-bold mb-4">Application Error</h1>
                        <p className="max-w-md text-center mb-4">{error}</p>
                        <button onClick={clearError} className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 transition-colors" title="Return to the welcome screen">
                           Try Again
                        </button>
                    </div>
                );
            default:
                 return <WelcomeScreen onStartChat={handleStartChat} isApiKeySelected={isApiKeySelected} />;
        }
    }

    return (
        <main className="h-screen bg-gem-onyx text-gem-offwhite">
            <div className="flex h-full">
                <div className="flex-1 overflow-auto">{renderContent()}</div>
                <DesktopSettingsPanel />
            </div>
        </main>
    );
};

export default App;
