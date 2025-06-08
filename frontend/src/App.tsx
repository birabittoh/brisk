import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import LandingPage from './components/LandingPage';
import LobbyPage from './components/LobbyPage';
import GamePage from './components/GamePage';

type PageType = 'landing' | 'lobby' | 'game';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const { socket } = useSocket();

  // Auto-rejoin lobby if info is in localStorage
  useEffect(() => {
    const playerName = localStorage.getItem('playerName');
    const lobbyCode = localStorage.getItem('lobbyCode');
    if (
      socket &&
      playerName &&
      lobbyCode &&
      currentPage === 'landing'
    ) {
      socket.emit('join-lobby', {
        lobbyCode,
        playerName,
      });
      setCurrentPage('lobby');
    }
    // Only run on mount and when socket is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
  const { gameState, isConnected } = useSocket();

  useEffect(() => {
    if (!gameState) {
      localStorage.removeItem('lobbyCode');
      setCurrentPage('landing');
      return;
    }

    switch (gameState.gamePhase) {
      case 'lobby':
        setCurrentPage('lobby');
        break;
      case 'playing':
        setCurrentPage('game');
        break;
      case 'ended':
        setCurrentPage('game');
        break;
      default:
        setCurrentPage('landing');
    }
  }, [gameState]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Connecting...</h2>
          <p className="text-gray-600">Please wait while we connect you to the game server.</p>
        </div>
      </div>
    );
  }

  const renderPage = (): JSX.Element => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onPageChange={setCurrentPage} />;
      case 'lobby':
        return <LobbyPage onPageChange={setCurrentPage} />;
      case 'game':
        return <GamePage onPageChange={setCurrentPage} />;
      default:
        return <LandingPage onPageChange={setCurrentPage} />;
    }
  };

  return renderPage();
};

const App: React.FC = () => {
  return (
    <SocketProvider>
      <div className="App">
        <AppContent />
      </div>
    </SocketProvider>
  );
};

export default App;
