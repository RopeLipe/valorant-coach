import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@ui/button';
import { motion } from 'framer-motion';

const AudioWaveformVisualizer: React.FC<{ active: boolean }> = ({ active }) => {
    const bars = [6, 16, 12, 22, 10, 18, 8, 14, 4];
    return (
        <div className="flex items-center gap-[3px] h-6 px-1">
            {bars.map((maxHeight, idx) => (
                <motion.div
                    key={idx}
                    animate={active ? {
                        height: [4, maxHeight, 4],
                    } : {
                        height: 4
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.6 + idx * 0.08,
                        ease: "easeInOut"
                    }}
                    className="w-[3px] bg-white rounded-full"
                    style={{ height: 4 }}
                />
            ))}
        </div>
    );
};

interface AICoachViewProps {
    history: ChatMessage[];
    isQueryLoading: boolean;
    onSendMessage: (message: string) => void;
    onNewChat: () => void;
    exampleQuestions: string[];
}

const AICoachView: React.FC<AICoachViewProps> = ({
    history,
    isQueryLoading,
    onSendMessage,
    onNewChat,
    exampleQuestions
}) => {
    const [query, setQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const scroll = () => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTo({
                        top: scrollRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            };
            // Small timeout to ensure content is rendered
            setTimeout(scroll, 100);
        }
    }, [history, isQueryLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSendMessage(query);
            setQuery('');
        }
    };

    const renderMarkdown = (text: string) => {
        const html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-white/20 px-1 rounded font-mono text-sm">$1</code>')
            .replace(/\n/g, '<br/>');
        return { __html: html };
    };

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-wide uppercase">OWNED AI</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span className="text-xs text-white/50">Online</span>
                        </div>
                    </div>
                </div>
                {history.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onNewChat}
                        className="text-xs text-white/60 hover:text-white hover:bg-white/10 h-8"
                    >
                        New Session
                    </Button>
                )}
            </div>

            {/* Chat Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar scroll-smooth"
            >
                {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-0 animate-in fade-in duration-700 slide-in-from-bottom-4">
                        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 relative">
                            <div className="absolute inset-0 rounded-full bg-white/5 animate-ping" />
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                        <div className="max-w-md space-y-2">
                            <h3 className="text-2xl font-bold text-white">Ready to Improve?</h3>
                            <p className="text-white/50">Ask me anything about agent strategies, map control, or specific round analysis.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                            {exampleQuestions.map((q: string, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => onSendMessage(q)}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] transition-all duration-200 text-left group"
                                >
                                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">{q}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {history.map((msg: ChatMessage, idx: number) => (
                            <div
                                key={idx}
                                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                                    ? 'bg-white text-black'
                                    : 'bg-black/60 border border-white/10'
                                    }`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                                </div>

                                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-md ${msg.role === 'user'
                                        ? 'bg-white text-black font-medium rounded-tr-sm'
                                        : 'bg-black/60 border border-white/10 text-white/90 rounded-tl-sm'
                                        }`}>
                                        <div dangerouslySetInnerHTML={renderMarkdown(msg.parts[0].text)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isQueryLoading && (
                            <div className="flex gap-4 animate-in fade-in">
                                <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="px-5 py-3 rounded-2xl rounded-tl-sm bg-black/60 border border-white/10 flex items-center gap-3">
                                    <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Analyzing Context</span>
                                    <AudioWaveformVisualizer active={true} />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/60 border-t border-white/10">
                <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                        placeholder="Ask about strategies, agents, or maps..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                        disabled={isQueryLoading}
                    />
                    <button
                        type="submit"
                        disabled={!query.trim() || isQueryLoading}
                        className="absolute right-2 p-2 rounded-lg bg-white/10 text-white/60 hover:bg-white hover:text-black disabled:opacity-30 disabled:hover:bg-white/10 disabled:hover:text-white/60 transition-all duration-200"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AICoachView;
