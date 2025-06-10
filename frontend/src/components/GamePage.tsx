import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Player, Card, GameState } from '../types';
import Chat from './Chat';
import { renderCardImage } from '../common';
import { PreferencesModal } from './PreferencesModal';
import GradientButton from './GradientButton';

interface GamePageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const GamePage: React.FC<GamePageProps> = ({ onPageChange }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid } = useSocket();
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [cardStyle, setCardStyle] = useState<string>("napoli");

  // Highlight round results after all players have played
  const [showRoundResults, setShowRoundResults] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleGameEnded = (): void => {
      setTimeout(() => {
        onPageChange('lobby');
      }, 10000);
    };

    socket.on('game-ended', handleGameEnded);

    return () => {
      socket.off('game-ended', handleGameEnded);
    };
  }, [socket, onPageChange]);

  useEffect(() => {
    if (currentPlayerUuid) {
      const saved = localStorage.getItem('cardStyle');
      if (saved) setCardStyle(saved);
    }
  }, [currentPlayerUuid, isPreferencesOpen]);

  if (!socket) {
    return <div>Socket unavailable.</div>;
  }

  const currentPlayer = gameState?.players?.find(p => p.id === currentPlayerUuid);
  const isCurrentPlayerTurn = gameState?.players?.[gameState?.currentPlayerIndex]?.id === currentPlayerUuid;
  const currentTurnPlayer = gameState?.players?.[gameState?.currentPlayerIndex];

  // Turn timeout logic
  const [turnTimeLeft, setTurnTimeLeft] = React.useState<number>(0);

  React.useEffect(() => {
    const update = () => {
      if (!gameState?.turnEndTimestamp) {
        setTurnTimeLeft(0);
        return;
      }
      const now = Date.now();
      setTurnTimeLeft(Math.max(0, gameState.turnEndTimestamp - now));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [gameState?.turnEndTimestamp, gameState?.currentPlayerIndex]);

  // Played cards for this round
  const playedCards = gameState?.playedCards ?? [];
  const lastPlayedCards = gameState?.lastPlayedCards ?? [];

  // Show round results when lastRoundWinner changes (i.e., after backend resolves round)
  useEffect(() => {
    if (!gameState) return;
    // When lastRoundWinner is set and lastPlayedCards is updated, show results
    if (gameState.lastRoundWinner && lastPlayedCards.length > 0) {
      setShowRoundResults(true);
      setTimeout(() => {
        setShowRoundResults(false);
      }, 3000);
    }
  }, [gameState?.lastRoundWinner, gameState?.currentRound]);

  const handlePlayCard = (card: Card): void => {
    socket.emit('play-card', { card });
  };

  // Leave game and go to landing page
  const handleLeaveGame = (): void => {
    if (socket) {
      socket.emit('leave-lobby');
    }
    localStorage.removeItem('lobbyCode');
    onPageChange('landing');
  };

  // Leave game and return to lobby
  const handleReturnToLobby = (): void => {
    onPageChange('lobby');
  };

  const getPlayerStatusEmoji = (player: Player): string => {
    if (player.isAI) return '🤖';
    return '🟢';
  };


  if (gameState?.gamePhase === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">🎉 Game Over!</h1>
            {gameState?.winner && (
              <div className="bg-yellow-100 border-2 border-yellow-300 rounded-xl p-4">
                <div className="text-6xl mb-2">👑</div>
                <h2 className="text-2xl font-bold text-yellow-800">
                  {gameState.winner.name} Wins!
                </h2>
                <p className="text-yellow-700">
                  Final score: {gameState.winner.score} points
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Final scores:</h3>
            <div className="space-y-2">
              {gameState?.players
                ?.sort((a, b) => b.score - a.score)
                ?.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                      </span>
                      <span className="font-medium">{player.name}</span>
                      {player.isAI && <span className="text-xs">🤖</span>}
                    </div>
                    <span className="font-bold text-lg">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>

          <GradientButton
            onClick={handleReturnToLobby}
            color="blue"
            fullWidth
          >
            🏠 Return to lobby
          </GradientButton>

          <p className="text-sm text-gray-500 mt-4">
            Returning to lobby automatically in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">🃏 BRISK</h1>
                <div className="bg-blue-100 rounded-xl p-3">
                  <p className="text-lg font-medium text-blue-800">
                    Round {gameState?.currentRound ?? '-'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Deck:</span> {gameState?.deck ? gameState.deck.length : 0} cards left
                  </p>
                </div>
                {/* Last Card Reveal */}
                {((gameState?.deck?.length ?? 0) > 0) && gameState?.lastCard && (
                  <div className="mt-4 flex flex-col items-center">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Last Card</div>
                    <div className="inline-block bg-yellow-100 border-2 border-yellow-400 rounded-xl px-6 py-3 shadow text-3xl font-bold text-yellow-800">
                      {renderCardImage(gameState.lastCard, cardStyle)}
                    </div>
                  </div>
                )}
              </div>

              {/* Current Turn or Results */}
              <div className="mb-6">
                {/* Always show played cards for this round */}
                <div className="flex flex-wrap justify-center gap-4 mb-4 mt-2">
                  {(showRoundResults ? lastPlayedCards : playedCards).map((pc, idx) => {
                    const player = gameState?.players?.find(p => p.id === pc.playerId);
                    return (
                      <div
                        key={pc.playerId}
                        className={`p-4 rounded-xl bg-white shadow-md min-w-[120px] ${
                          (showRoundResults && gameState?.lastRoundWinner === pc.playerId)
                            ? 'border-4 border-yellow-400 scale-105'
                            : 'border-2 border-gray-200'
                        }`}
                      >
                        <div className="text-lg font-semibold text-gray-800 flex items-center justify-center gap-2">
                          {player?.name}
                          {player?.id === currentPlayerUuid && (
                            <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">YOU</span>
                          )}
                        </div>
                        <div className="flex justify-center items-center text-4xl mt-2">{renderCardImage(pc.card, cardStyle)}</div>
                      </div>
                    );
                  })}
                </div>
                {showRoundResults && (
                  <div className="bg-gradient-to-r from-green-400 to-blue-400 rounded-xl p-6 text-center shadow-lg mb-4">
                    {gameState?.lastRoundWinner ? (
                      <div className="text-xl font-bold text-yellow-200">
                        🏆 {gameState?.players?.find(p => p.id === gameState.lastRoundWinner)?.name} wins the round!
                      </div>
                    ) : null}
                  </div>
                )}
                <div className={`bg-gradient-to-r ${
                  (isCurrentPlayerTurn && !showRoundResults)
                    ? 'from-yellow-400 to-orange-400' 
                    : 'from-blue-400 to-indigo-400'
                } rounded-xl p-4 text-center mb-4`}>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {isCurrentPlayerTurn ? "🎯 Your turn!" : `🎯 ${currentTurnPlayer?.name}'s turn`}
                  </h2>
                  <div className="text-white text-lg font-mono mb-2">
                    {Math.round(turnTimeLeft / 1000)}s
                  </div>
                  {!currentPlayer?.isAI && (
                    <div className="flex justify-center gap-4 mt-4">
                      {currentPlayer?.hand?.map((card, idx) => (
                        <button
                          key={idx}
                          onClick={() => handlePlayCard(card)}
                          disabled={!isCurrentPlayerTurn || showRoundResults}
                          className={`bg-white text-orange-600 p-1 rounded-xl font-bold border-2 border-orange-400 flex items-center justify-center
                            ${(!isCurrentPlayerTurn || showRoundResults)
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-100 transition-all transform hover:scale-105'
                            }`}
                          style={{ minWidth: 0, minHeight: 0 }}
                        >
                          {renderCardImage(card, cardStyle)}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentTurnPlayer?.isAI && (
                    <div className="text-white font-medium">
                      🤖 AI is thinking...
                    </div>
                  )}
                </div>
              </div>

              {/* Players Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState?.players?.map((player: Player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      player.id === currentPlayerUuid
                        ? 'bg-blue-50 border-blue-300'
                        : gameState?.players?.[gameState?.currentPlayerIndex]?.id === player.id
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{getPlayerStatusEmoji(player)}</span>
                        <div>
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-gray-800">
                              {player.name}
                            </span>
                            {player.id === currentPlayerUuid && (
                              <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
                                YOU
                              </span>
                            )}
                            {player.isAI && (
                              <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs">
                                AI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {player.score}
                        </div>
                        <div className="text-xs text-gray-500">points</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="text-4xl mb-1">🃏</div>
                        <div className="text-sm">Playing cards</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Chat
              isMinimized={isChatMinimized}
              onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
            />
          </div>
        </div>

        {/* Game Controls */}
        <div className="mt-6 text-center flex justify-center">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 w-full justify-center">
            <GradientButton
              onClick={() => setIsPreferencesOpen(true)}
              color="gray"
            >
              ⚙️ Preferences
            </GradientButton>
            <GradientButton
              onClick={handleLeaveGame}
              color="red"
            >
              🚪 Leave game
            </GradientButton>
          </div>
        </div>
        <PreferencesModal
          playerId={currentPlayerUuid ?? ""}
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          onCardStyleChange={setCardStyle}
        />
      </div>
    </div>
  );
};

export default GamePage;
