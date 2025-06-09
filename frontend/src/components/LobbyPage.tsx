import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Player } from '../types';
import Chat from './Chat';

interface LobbyPageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const LobbyPage: React.FC<LobbyPageProps> = ({ onPageChange }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid } = useSocket();
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(false);

  React.useEffect(() => {
    if (!socket) return;
    const handleGameStarted = (): void => {
      onPageChange('game');
    };

    socket.on('game-started', handleGameStarted);

    return () => {
      socket.off('game-started', handleGameStarted);
    };
  }, [socket, onPageChange]);

  if (!socket) {
    return <div>Socket unavailable.</div>;
  }

  const currentPlayer = gameState?.players?.find(p => p.id === currentPlayerUuid);
  const isHost = currentPlayer?.isHost || false;

  const handleStartGame = (): void => {
    socket.emit('start-game');
  };

  const handleKickPlayer = (playerId: string): void => {
    socket.emit('kick-player', playerId);
  };

  const handleLeaveLobby = (): void => {
    socket.emit('leave-lobby');
    localStorage.removeItem('lobbyCode');
    onPageChange('landing');
  };

  const copyLobbyCode = (): void => {
    // Store a reference to the button
    const button = document.getElementById('copy-code-btn');
    if (!button) return;
    
    // Store original text if not already saved
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || '';
    }
    
    // Clear any existing timeout stored on the button element
    if (button.dataset.timeoutId) {
      clearTimeout(parseInt(button.dataset.timeoutId));
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(window.location.href);
    
    // Update the button text
    button.textContent = '✅ Copied!';
    
    // Set new timeout and store its ID
    const timeoutId = setTimeout(() => {
      button.textContent = button.dataset.originalText ?? '';
      delete button.dataset.timeoutId;
    }, 1000);
    
    button.dataset.timeoutId = timeoutId.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">🃏 BRISK</h1>
                <div className="bg-gray-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center space-x-4">
                    <span className="text-lg font-medium text-gray-700">Code:</span>
                    <span className="text-2xl font-mono font-bold text-blue-600">{gameState?.lobbyCode ?? '-'}</span>
                    <button
                      id="copy-code-btn"
                      onClick={copyLobbyCode}
                      className="bg-blue-500 px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors text-sm text-white"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  👥 Players ({gameState?.players?.length ?? 0}/{gameState?.maxPlayers ?? '-'})
                </h2>
                <div className="space-y-3">
                  {gameState?.players?.map((player: Player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        player.id === currentPlayerUuid
                          ? 'bg-blue-100 border-2 border-blue-300'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {player.isHost ? '👑' : player.isAI ? '🤖' : '👤'}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-800">
                              {player.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isHost && player.id !== currentPlayerUuid && (
                        <button
                          onClick={() => handleKickPlayer(player.id)}
                          className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
                        >
                          🚫 Kick
                        </button>
                      )}
                      {player.id === currentPlayerUuid && (
                        <button
                          onClick={handleLeaveLobby}
                          className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
                        >
                          🚪 Leave
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {isHost && (
                  <button
                    onClick={handleStartGame}
                    disabled={(gameState?.players?.length ?? 0) < 2}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {(gameState?.players?.length ?? 0) < 2 ? (
                      '⏳ Waiting for more players...'
                    ) : (
                      '🚀 Start game'
                    )}
                  </button>
                )}
              </div>
              <div className="mt-6 text-center text-gray-500 text-sm">
                <p>🎯 Game starts when the host clicks "Start game"</p>
                <p>🃏 Play briscola to win points!</p>
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
      </div>
    </div>
  );
};

export default LobbyPage;
