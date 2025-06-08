import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, SocketEvents } from '../types';

interface SocketContextType {
  socket: Socket<SocketEvents> | null;
  gameState: GameState | null;
  currentPlayerId: string | null;
  currentPlayerUuid: string | null;
  error: string | null;
  isConnected: boolean;
  setError?: (err: string | null) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  gameState: null,
  currentPlayerId: null,
  currentPlayerUuid: null,
  error: null,
  isConnected: false,
});

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket<SocketEvents> | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [currentPlayerUuid, setCurrentPlayerUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setCurrentPlayerId(newSocket.id ?? null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('lobby-joined', (data) => {
      setGameState(data.gameState);
      setCurrentPlayerUuid(data.playerUuid);
      setError(null);
    });

    newSocket.on('lobby-created', (data) => {
      setGameState(data.gameState);
      setCurrentPlayerUuid(data.playerUuid);
      setError(null);
    });

    newSocket.on('game-updated', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('game-started', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('game-ended', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('message-received', (chatMessage) => {
      setGameState(prev =>
        prev
          ? { ...prev, chat: [...(prev.chat || []), chatMessage] }
          : prev
      );
    });

    newSocket.on('error', (message: any) => {
      if (typeof message === 'string') {
        setError(message);
      } else if (message && typeof message.message === 'string') {
        setError(message.message);
      } else {
        setError('An unknown error occurred.');
      }
    });

    newSocket.on('player-kicked', () => {
      setGameState(null);
      setCurrentPlayerUuid(null);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        gameState,
        currentPlayerId,
        currentPlayerUuid,
        error,
        isConnected,
        setError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
