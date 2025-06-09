import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Player } from '../types';
import Chat from './Chat';

interface GamePageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const GamePage: React.FC<GamePageProps> = ({ onPageChange }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid } = useSocket();
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(false);
  const [showDiceAnimation, setShowDiceAnimation] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleGameEnded = (): void => {
      setTimeout(() => {
        onPageChange('lobby');
      }, 10000); // Wait 10 seconds before 
    };

    socket.on('game-ended', handleGameEnded);
    socket.on('dice-rolled', () => {
      setShowDiceAnimation(true);
      setTimeout(() => setShowDiceAnimation(false), 1000);
    });

    return () => {
      socket.off('game-ended', handleGameEnded);
      socket.off('dice-rolled');
    };
  }, [socket, onPageChange]);

  if (!socket) {
    return <div>Socket unavailable.</div>;
  }

  const currentPlayer = gameState?.players?.find(p => p.id === currentPlayerUuid);
  const isCurrentPlayerTurn = gameState?.players?.[gameState?.currentPlayerIndex]?.id === currentPlayerUuid;
  const currentTurnPlayer = gameState?.players?.[gameState?.currentPlayerIndex];

  // New: Check if all players have rolled
  const allPlayersRolled = gameState?.players?.every(p => typeof p.lastRoll === 'number') && gameState?.players?.length > 0;

  // New: Find max roll and winners
  const rolls = gameState?.players?.map(p => p.lastRoll ?? 0) ?? [];
  const maxRoll = Math.max(...rolls);
  const winners = gameState?.players?.filter(p => p.lastRoll === maxRoll) ?? [];
  const isDraw = winners.length > 1;

  // New: Next round handler
  const handleNextRound = (): void => {
    socket.emit('next-round');
  };

  const handleRollDice = (): void => {
    socket.emit('roll-dice');
  };

  const handleLeaveGame = (): void => {
    if (socket) {
      socket.emit('leave-lobby');
    }
    localStorage.removeItem('lobbyCode');
    onPageChange('landing');
  };

  const getDiceEmoji = (roll?: number): string => {
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return roll ? diceEmojis[roll] : '🎲';
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

          <button
            onClick={handleLeaveGame}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105"
          >
            🏠 Return to Lobby
          </button>

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
                <h1 className="text-3xl font-bold text-gray-800 mb-2">🎲 BRISK</h1>
                <div className="bg-blue-100 rounded-xl p-3">
                  <p className="text-lg font-medium text-blue-800">
                    Round {gameState?.currentRound ?? '-'}
                  </p>
                  <p className="text-sm text-blue-600">
                    First to {gameState?.pointsToWin ?? '-'} points wins!
                  </p>
                </div>
              </div>

              {/* Current Turn or Results */}
              <div className="mb-6">
                {!allPlayersRolled ? (
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl p-4 text-center">
                    <h2 className="text-xl font-bold text-white mb-2">
                      {isCurrentPlayerTurn ? "🎯 Your Turn!" : `🎯 ${currentTurnPlayer?.name}'s Turn`}
                    </h2>
                    {isCurrentPlayerTurn && !currentPlayer?.isAI && (
                      <button
                        onClick={handleRollDice}
                        className={`bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 ${
                          showDiceAnimation ? 'animate-bounce' : ''
                        }`}
                      >
                        🎲 Roll Dice!
                      </button>
                    )}
                    {currentTurnPlayer?.isAI && (
                      <div className="text-white font-medium">
                        🤖 AI is thinking...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-400 to-blue-400 rounded-xl p-6 text-center shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-4">🎲 Round Results</h2>
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                      {gameState?.players?.map((player) => (
                        <div
                          key={player.id}
                          className={`p-4 rounded-xl bg-white shadow-md min-w-[120px] ${
                            winners.some(w => w.id === player.id)
                              ? 'border-4 border-yellow-400 scale-105'
                              : 'border-2 border-gray-200'
                          }`}
                        >
                          <div className="text-lg font-semibold text-gray-800 flex items-center justify-center gap-2">
                            {player.name}
                            {player.id === currentPlayerUuid && (
                              <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">YOU</span>
                            )}
                          </div>
                          <div className="text-4xl mt-2">{getDiceEmoji(player.lastRoll)}</div>
                          <div className="text-sm text-gray-600 mt-1">Roll: {player.lastRoll ?? '-'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mb-6">
                      {isDraw ? (
                        <div className="text-xl font-bold text-yellow-200">🤝 It's a draw!</div>
                      ) : (
                        <div className="text-xl font-bold text-yellow-200">
                          🏆 {winners[0]?.name} wins the round!
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleNextRound}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-700 text-white py-5 px-8 rounded-2xl font-extrabold text-2xl shadow-xl hover:from-purple-700 hover:to-blue-800 transition-all transform hover:scale-105"
                    >
                      ➡️ Next Round
                    </button>
                  </div>
                )}
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
                      {player.lastRoll ? (
                        <div className="text-center">
                          <div className="text-4xl mb-1">
                            {getDiceEmoji(player.lastRoll)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Last roll: {player.lastRoll}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          <div className="text-4xl mb-1">🎲</div>
                          <div className="text-sm">Ready to roll</div>
                        </div>
                      )}
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
        <div className="mt-6 text-center">
          <button
            onClick={handleLeaveGame}
            className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105"
          >
            🚪 Leave Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
