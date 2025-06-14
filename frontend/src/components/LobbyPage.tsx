import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Player, SpeedOption, speedOptions } from '../types';
import Chat from './Chat';
import { PreferencesModal } from './PreferencesModal';
import GradientButton from './GradientButton';

interface LobbyPageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const LobbyPage: React.FC<LobbyPageProps> = ({ onPageChange }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid, error } = useSocket();
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [cardStyle, setCardStyle] = useState<string>(localStorage.getItem('cardStyle') || 'napoli');

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

  const handleChangePlayers = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newMaxPlayers = parseInt(e.target.value, 10);
    if (newMaxPlayers >= 2 && newMaxPlayers <= 5 && newMaxPlayers >= (gameState?.players?.length || 0)) {
      socket.emit('change-max-players', newMaxPlayers);
    }
  };

  const handleChangeSpeed = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const speed = e.target.value as SpeedOption;
    if (speedOptions.includes(speed)) {
      socket.emit('change-speed', speed);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      {error && (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      )}
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
                        <GradientButton
                          onClick={() => handleKickPlayer(player.id)}
                          color="red"
                          className="px-3 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm"
                        >
                          🚫 Kick
                        </GradientButton>
                      )}
                    </div>
                  ))}
                  {isHost && (gameState?.players?.length ?? 0) < (gameState?.maxPlayers ?? 0) && (
                    <div
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-200 hover:bg-gray-300 cursor-pointer transition"
                      onClick={() => socket.emit('add-bot')}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl text-gray-600">➕</span>
                        <span className="font-medium text-gray-700">Add bot</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {isHost && (
                  <GradientButton
                    onClick={handleStartGame}
                    disabled={(gameState?.players?.length ?? 0) < 2}
                    color="green"
                    fullWidth
                  >
                    {(gameState?.players?.length ?? 0) < 2 ? (
                      '⏳ Waiting for more players...'
                    ) : (
                      '🚀 Start game'
                    )}
                  </GradientButton>
                )}
              </div>
              <div className="mt-6 text-center text-gray-500 text-sm">
                <p>🎯 Game starts when the host clicks "Start game"</p>
                <p>🃏 Play briscola to win points!</p>
              </div>
            </div>
          </div>
          {/* Side Containers: Settings (top) + Chat (bottom) */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Settings Container */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 mb-0">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Settings</h2>
              <div className="flex flex-col gap-4">
                {/* Speed Dropdown */}
                <div className="flex items-center justify-between">
                  <label htmlFor="speed-select" className="font-medium text-gray-700">Speed</label>
                  <select
                    id="speed-select"
                    className="border rounded-lg px-2 py-1"
                    disabled={!isHost}
                    value={gameState?.speed ?? '-'}
                    onChange={handleChangeSpeed}
                  >
                    {speedOptions.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Players Number Input */}
                <div className="flex items-center justify-between">
                  <label htmlFor="players-input" className="font-medium text-gray-700">Max players</label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      className="bg-gray-200 px-2 py-1 rounded-l-lg text-lg font-bold disabled:opacity-50"
                      disabled={!isHost || (gameState?.maxPlayers ?? 2) <= 2 || (gameState?.maxPlayers ?? 2) <= (gameState?.players?.length ?? 0)}
                      onClick={() => {
                        const newMax = (gameState?.maxPlayers ?? 2) - 1;
                        if (isHost && newMax >= 2 && newMax >= (gameState?.players?.length ?? 0)) {
                          socket.emit('change-max-players', newMax);
                        }
                      }}
                      aria-label="Decrease max players"
                    >-</button>
                    <input
                      id="players-input"
                      type="number"
                      min={2}
                      max={5}
                      className="border rounded-none px-2 py-1 w-12 text-center"
                      disabled
                      value={gameState?.maxPlayers ?? 5}
                      style={{ MozAppearance: 'textfield' }}
                      inputMode="numeric"
                      pattern="[2-5]"
                      readOnly
                    />
                    <button
                      type="button"
                      className="bg-gray-200 px-2 py-1 rounded-r-lg text-lg font-bold disabled:opacity-50"
                      disabled={!isHost || (gameState?.maxPlayers ?? 5) >= 5}
                      onClick={() => {
                        const newMax = (gameState?.maxPlayers ?? 5) + 1;
                        if (isHost && newMax <= 5) {
                          socket.emit('change-max-players', newMax);
                        }
                      }}
                      aria-label="Increase max players"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>
            {/* Chat Container */}
            <Chat
              isMinimized={isChatMinimized}
              onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
            />
          </div>
        </div>
        {/* Preferences Button and Modal */}
        <div className="mt-6 text-center flex justify-center">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 w-full justify-center">
            <GradientButton
              onClick={() => setIsPreferencesOpen(true)}
              color="gray"
            >
              ⚙️ Preferences
            </GradientButton>
            <GradientButton
              onClick={handleLeaveLobby}
              color="red"
            >
              🚪 Leave lobby
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

export default LobbyPage;
