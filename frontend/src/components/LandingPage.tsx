import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { GameState } from '../types';

const italianSoccerPlayers = [
  "Baggio", "Maldini", "Baresi", "Del Piero", "Totti", 
  "Pirlo", "Buffon", "Cannavaro", "Nesta", "Gattuso", 
  "Chiellini", "Bonucci", "Zambrotta", "Inzaghi", "Vieri",
  "Verratti", "Donnarumma", "Insigne", "Immobile", "Barzagli",
  "Rivera", "Facchetti", "Zoff", "Rossi", "Tardelli", "Maradona",
  "Scirea", "Riva", "Antognoni", "Gentile", "Marchisio", "Cassano",
  "Balotelli", "Zola", "Panucci", "Cafu", "Bergomi", "Toni",
];

const getRandomPlayerName = (): string => {
  return italianSoccerPlayers[Math.floor(Math.random() * italianSoccerPlayers.length)];
};

interface LandingPageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onPageChange }) => {
  const { socket, error, setError } = useSocket();
  const [playerName, setPlayerName] = useState<string>('');
  const [lobbyCode, setLobbyCode] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [kickTimeoutMs, setKickTimeoutMs] = useState<number>(0);
  const [kickCountdown, setKickCountdown] = useState<number>(0);

  useEffect(() => {
    const storedName = localStorage.getItem('playerName');
    const storedLobby = localStorage.getItem('lobbyCode');
    setPlayerName(storedName || getRandomPlayerName());
    setLobbyCode(storedLobby || '');
  }, []);

  // Pre-fill lobby code from ?c= query string if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('c');
    if (code) {
      setLobbyCode(code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
  }, []);

  const handleCreateLobby = (): void => {
    if (!socket || !playerName.trim()) return;

    localStorage.setItem('playerName', playerName.trim());
    localStorage.removeItem('lobbyCode');

    setIsCreating(true);
    socket.emit('create-lobby', { playerName: playerName.trim() });
  };

  const handleJoinLobby = (): void => {
    if (!socket || !playerName.trim() || !lobbyCode.trim()) return;

    localStorage.setItem('playerName', playerName.trim());
    localStorage.setItem('lobbyCode', lobbyCode.trim().toUpperCase());

    setIsJoining(true);
    socket.emit('join-lobby', {
      lobbyCode: lobbyCode.trim().toUpperCase(),
      playerName: playerName.trim()
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (lobbyCode.trim()) {
        handleJoinLobby();
      } else {
        handleCreateLobby();
      }
    }
  };

  // Helper to update query string with lobby code
  const updateQueryWithLobbyCode = (code: string) => {
    if (code && typeof code === "string" && code.trim()) {
      const params = new URLSearchParams(window.location.search);
      params.set('c', code.trim().toUpperCase());
      window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}`);
      console.log(code);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleLobbyCreated = (payload: { gameState: GameState; playerUuid: string }): void => {
      const { gameState } = payload;
      console.log("handleLobbyCreated: received gameState", gameState);
      setIsCreating(false);
      const createdLobbyCode = gameState?.lobbyCode;
      console.log("handleLobbyCreated: createdLobbyCode", createdLobbyCode);
      if ((!createdLobbyCode || typeof createdLobbyCode !== "string")) {
        console.error("handleLobbyCreated: Invalid lobby code received", createdLobbyCode);
        if (typeof setError === "function") {
          console.log("handleLobbyCreated: setting error");
          setError("Failed to create lobby: Invalid lobby code received.");
        }
        return;
      }
      console.log("handleLobbyCreated: updating query string with", createdLobbyCode);
      setLobbyCode(createdLobbyCode);
      updateQueryWithLobbyCode(createdLobbyCode);
      console.log("handleLobbyCreated: after updateQueryWithLobbyCode");
      onPageChange('lobby');
    };

    socket.on('lobby-created', handleLobbyCreated as any);

    return () => {
      socket.off('lobby-created', handleLobbyCreated as any);
    };
  }, [socket, onPageChange]);

  useEffect(() => {
    if (!socket) return;

    const handleLobbyJoined = (): void => {
      setIsJoining(false);
      updateQueryWithLobbyCode(lobbyCode);
      onPageChange('lobby');
    };

    if (isJoining) {
      socket.on('lobby-joined', handleLobbyJoined);
    }

    return () => {
      socket.off('lobby-joined', handleLobbyJoined);
    };
  }, [isJoining, socket, onPageChange]);

  // Handle kick-timeout error and countdown
  useEffect(() => {
    if (!socket) return;

    const handleError = (err: any) => {
      if (err && typeof err === 'object' && err.type === 'kick-timeout' && typeof err.remainingMs === 'number') {
        setKickTimeoutMs(err.remainingMs);
        setKickCountdown(Math.ceil(err.remainingMs / 1000));
        setIsJoining(false);
      } else if (err) {
        setIsJoining(false);
        setIsCreating(false);
      }
    };

    socket.on('error', handleError);
    return () => {
      socket.off('error', handleError);
    };
  }, [socket]);

  useEffect(() => {
    if (kickTimeoutMs > 0 && kickCountdown > 0) {
      const interval = setInterval(() => {
        setKickCountdown((prev) => {
          if (prev <= 1) {
            setKickTimeoutMs(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [kickTimeoutMs, kickCountdown]);

  // Clear global error after kick timeout ends (avoid setState during render)
  useEffect(() => {
    if (kickTimeoutMs === 0 && kickCountdown === 0 && typeof setError === "function") {
      setError(null);
    }
  }, [kickTimeoutMs, kickCountdown, setError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">🎲 BRISK</h1>
          <p className="text-gray-600">Roll the dice, win the game!</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-2">
              👤 Your name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-lg"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <div>
            <button
              onClick={handleCreateLobby}
              disabled={!playerName.trim() || isCreating || isJoining}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isCreating ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⏳</span>
                  Creating...
                </span>
              ) : (
                '🎮 New Game'
              )}
            </button>
          </div>

          <div>
            <label htmlFor="lobbyCode" className="block text-sm font-medium text-gray-700 mb-2">
              🔑 Lobby code
            </label>
            <input
              id="lobbyCode"
              type="text"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-lg text-center font-mono"
              placeholder="Enter lobby code"
              maxLength={6}
            />
          </div>

          <div>
            <button
              onClick={handleJoinLobby}
              disabled={
                !playerName.trim() ||
                !lobbyCode.trim() ||
                isCreating ||
                isJoining ||
                kickTimeoutMs > 0
              }
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isJoining ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⏳</span>
                  Joining...
                </span>
              ) : kickTimeoutMs > 0 && kickCountdown > 0 ? (
                `⏳ Wait ${kickCountdown}s`
              ) : (
                '🚪 Join Game'
              )}
            </button>
          </div>

          {(error && !(kickTimeoutMs > 0 && kickCountdown > 0)) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
              <span className="font-medium">❌ Error: </span>
              {error}
            </div>
          )}
          {(kickTimeoutMs > 0 && kickCountdown > 0) && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-xl mt-2">
              <span className="font-medium">⏳ You have been kicked. Please wait {kickCountdown} second{kickCountdown !== 1 ? 's' : ''} before joining again.</span>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>🎯 Roll the highest dice to win points!</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
