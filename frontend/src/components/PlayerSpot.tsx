// PlayerSpot.tsx

import React from 'react';
import { Player, Card } from '../types';
import { renderCardBack, renderCardImage } from '../common';

interface PlayerSpotProps {
  player: Player | null;
  playedCard?: Card;
  isCurrentPlayer?: boolean;
  glow?: boolean;
  isCurrentPlayerTurn: boolean;
  currentPlayerTurn: Player | undefined;
  cardStyle: string;
  backStyle: number;
  getTeamInfo: (playerId: string) => { color: string; teamScore: number | null };
  handlePlayCard: (card: Card) => void;
}

function getCardClassName(isCurrentPlayer: boolean): string {
  return isCurrentPlayer ? 'w-[18vw] h-[27vw] sm:w-[8vw] sm:h-[12vw] text-xl' : 'w-[12vw] h-[18vw] sm:w-[6vw] sm:h-[9vw] text-lg'
}

const PlayerSpot: React.FC<PlayerSpotProps> = ({
  player,
  playedCard,
  isCurrentPlayer = false,
  glow = false,
  isCurrentPlayerTurn,
  currentPlayerTurn,
  cardStyle,
  backStyle,
  getTeamInfo,
  handlePlayCard,
}) => {
  if (!player) return null;

  const teamInfo = getTeamInfo(player.id);
  const is4Players = player.hand && player.hand.length === 4;

  return (
    <div className={`relative`}>
      {/* Played card area */}
      <div className={`flex justify-center mb-2`}>
        <div className={`
          ${getCardClassName(isCurrentPlayer)}
          border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center
          ${playedCard ? 'bg-white border-solid border-yellow-400' : ''}
        `}>
          {playedCard ? (
            <div className={`font-bold text-3xl`}>
              {renderCardImage(playedCard, cardStyle, "w-full h-full object-contain")}
            </div>
          ) : (
            <div className="text-gray-400 text-xs"></div>
          )}
        </div>
      </div>

      {/* Player info */}
      <div className={`
        rounded-lg shadow-lg p-2 ${isCurrentPlayer ? 'p-4' : 'p-3'} mb-2
        ${is4Players 
          ? (teamInfo.color === 'blue' ? 'bg-blue-100 border-2 border-blue-300' : 'bg-red-100 border-2 border-red-300')
          : 'bg-white'
        }
        ${glow ? 'glow-winner' : ''}
        ${currentPlayerTurn?.id === player.id ? 'glow-blue' : ''}

      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{player.isAI ? '🤖' : '🟢'}</span>
            <div>
              <div className={`font-medium text-gray-800 text-lg`}>
                {player.name}
                {isCurrentPlayer && (
                  <span className={`px-2 py-1 rounded-full text-xs ml-1 text-white ${
                    is4Players && teamInfo.color === 'red' ? 'bg-red-600' : 'bg-blue-500'
                  }`}>
                    YOU
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right"></div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex justify-center space-x-1">
        {player.hand?.map((card, idx) => (
          <button
            key={idx}
            onClick={() => isCurrentPlayer && isCurrentPlayerTurn ? handlePlayCard(card) : null}
            disabled={!isCurrentPlayer || !isCurrentPlayerTurn}
            className={`
              ${getCardClassName(isCurrentPlayer)}
              bg-white border-2 rounded-lg shadow-md flex items-center justify-center font-bold
              ${isCurrentPlayer && isCurrentPlayerTurn 
                ? 'border-blue-400 hover:bg-blue-50 cursor-pointer' 
                : isCurrentPlayer 
                  ? 'border-gray-300 opacity-75' 
                  : 'border-red-400 bg-red-100'
              }
              transition-all duration-200
            `}
            style={{
              minWidth: isCurrentPlayer ? '60px' : '40px',
              minHeight: isCurrentPlayer ? '90px' : '60px',
              maxWidth: isCurrentPlayer ? '120px' : '80px',
              maxHeight: isCurrentPlayer ? '180px' : '120px'
            }}
          >
            {isCurrentPlayer ? renderCardImage(card, cardStyle, "w-full h-full object-contain") : renderCardBack(backStyle, "w-full h-full object-contain")}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlayerSpot;
