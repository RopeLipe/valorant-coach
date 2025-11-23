import React from 'react';
import { AgentAsset } from '@/utils/agentAssets';

interface AgentCardProps {
    agent: AgentAsset;
    onClick: (agent: AgentAsset) => void;
    selected?: boolean;
    className?: string;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, selected, className = '' }) => {
    return (
        <div
            className={`
                relative group cursor-pointer transition-all duration-200
                ${selected ? 'ring-2 ring-white scale-105' : 'hover:scale-105 hover:ring-1 hover:ring-white/50'}
                rounded-lg overflow-hidden bg-gradient-to-b from-white/5 to-white/10
                ${className}
            `}
            onClick={() => onClick(agent)}
        >
            {/* Background Gradient based on agent colors */}
            <div
                className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity"
                style={{
                    background: agent.backgroundGradientColors && agent.backgroundGradientColors.length > 0
                        ? `linear-gradient(to bottom right, #${agent.backgroundGradientColors[0]}, #${agent.backgroundGradientColors[1]})`
                        : 'linear-gradient(to bottom right, #333, #000)'
                }}
            />

            {/* Agent Image */}
            <div className="relative z-10 aspect-square flex items-center justify-center p-2">
                <img
                    src={agent.displayIcon}
                    alt={agent.displayName}
                    className="w-full h-full object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110"
                />
            </div>

            {/* Name Label */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent z-20">
                <p className="text-white text-center font-bold text-sm tracking-wider uppercase drop-shadow-md">
                    {agent.displayName}
                </p>
            </div>
        </div>
    );
};
