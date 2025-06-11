import React, { useState, useEffect } from 'react';
import { renderCardBack, renderCardImage } from '../common';
import { useSocket } from '../context/SocketContext';
import { Card, Player, Positions } from '../types';
import Chat from './Chat';
import GradientButton from './GradientButton';
import { PreferencesModal } from './PreferencesModal';
import PlayerSpot from './PlayerSpot';

interface GamePageProps {
  onPageChange: (page: 'landing' | 'lobby' | 'game') => void;
}

const GamePage: React.FC<GamePageProps> = ({ onPageChange }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid } = useSocket();
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [cardStyle, setCardStyle] = useState<string>("napoli");
  const [backStyle, setBackStyle] = useState<number>(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(30);
  const [glowingPlayerId, setGlowingPlayerId] = useState<string | null>(null);

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

  const isCurrentPlayerTurn = gameState?.players?.[gameState?.currentPlayerIndex]?.id === currentPlayerUuid;
  const lastPlayedCards = gameState?.lastPlayedCards ?? [];

  useEffect(() => {
    const update = () => {
      if (!gameState?.turnEndTimestamp) {
        setTurnTimeLeft(0);
        return;
      }
      const now = Date.now();
      setTurnTimeLeft(Math.max(0, Math.ceil((gameState.turnEndTimestamp - now) / 1000)));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [gameState?.turnEndTimestamp, gameState?.currentPlayerIndex]);

  // Glow effect for round winner
  useEffect(() => {
    if (!gameState) return;
    if (gameState.lastRoundWinner && lastPlayedCards.length > 0) {
      setGlowingPlayerId(gameState.lastRoundWinner);
      setTimeout(() => {
        setGlowingPlayerId(null);
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

  // Get player positions based on number of players
  const getPlayerPositions = () => {;
    const positions: Positions = { A: null, B: null, C: null, D: null, E: null, F: null };
    if (!gameState || !currentPlayerUuid) return positions;
    
    // Current player is always at position A
    positions.A = gameState.players.find(p => p.id === currentPlayerUuid) ?? null;
    
    // Get other players (excluding current player)
    const otherPlayers = gameState.players.filter(p => p.id !== currentPlayerUuid);
    
    switch (gameState.players.length) {
      case 2:
        positions.B = otherPlayers[0];
        break;
      case 3:
        positions.C = otherPlayers[0];
        positions.D = otherPlayers[1];
        break;
      case 4:
        positions.F = otherPlayers[0];
        positions.B = otherPlayers[1];
        positions.E = otherPlayers[2];
        break;
      case 5:
        positions.F = otherPlayers[0];
        positions.D = otherPlayers[1];
        positions.C = otherPlayers[2];
        positions.E = otherPlayers[3];
        break;
    }
    
    return positions;
  };

  const positions = getPlayerPositions();

  // Get team colors for 4-player mode
  const getTeamInfo = (playerId: string) => {
    if (gameState?.players.length !== 4) return { color: 'blue', teamScore: null };
    
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === currentPlayerUuid);
    
    // Teams: (A, B), (F, E) which translates to (current, opposite), (side1, side2)
    const isTeamA = playerIndex === currentPlayerIndex || 
                    (positions.B && gameState.players.findIndex(p => p.id === positions.B?.id) === playerIndex);
    
    if (isTeamA) {
      const teamScore = (positions.A?.score || 0) + (positions.B?.score || 0);
      return { color: 'blue', teamScore };
    } else {
      const teamScore = (positions.F?.score || 0) + (positions.E?.score || 0);
      return { color: 'red', teamScore };
    }
  };

  return (
    <div className="min-h-full h-full w-full bg-gradient-to-br from-blue-900 to-purple-900 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto min-h-full h-full flex flex-col">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-3 mb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🃏 BRISK</h1>
              <p className="text-sm text-gray-600">Round {gameState?.currentRound} • {gameState?.deck?.length} cards left</p>
            </div>
            
            {/* Last card, turn info, and points */}
            <div className="flex items-center space-x-4">
              {gameState?.lastCard && (
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Briscola</div>
                  <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg px-3 py-2 text-2xl font-bold">
                    {renderCardImage(gameState.lastCard, cardStyle, "w-10 h-14 sm:w-16 sm:h-24 object-contain")}
                  </div>
                </div>
              )}

              {/* Points display */}
              {gameState?.players.length === 4 ? (
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Teams</div>
                  <div className="bg-gradient-to-r from-blue-100 to-red-100 border-2 border-gray-300 rounded-lg overflow-hidden">
                    <div className="flex">
                      <div className="bg-blue-100 px-4 py-2 border-r border-gray-300">
                        <div className="font-bold text-blue-800">
                          {(positions.A?.score || 0) + (positions.B?.score || 0)}
                        </div>
                        <div className="text-xs text-blue-600">Blue</div>
                      </div>
                      <div className="bg-red-100 px-4 py-2">
                        <div className="font-bold text-red-800">
                          {(positions.F?.score || 0) + (positions.E?.score || 0)}
                        </div>
                        <div className="text-xs text-red-600">Red</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Leaderboard</div>
                  {gameState?.players?.length ?? 0 > 3 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(() => {
                        const sorted = [...(gameState?.players ?? [])].sort((a, b) => b.score - a.score);
                        const mid = Math.ceil(sorted.length / 2);
                        const col1 = sorted.slice(0, mid);
                        const col2 = sorted.slice(mid);
                        return (
                          <>
                            <div className="flex flex-col items-center space-y-1">
                              {col1.map((p, idx) => (
                                <div
                                  key={p.id}
                                  className={`bg-blue-100 border-2 border-blue-400 rounded-lg px-3 py-2 w-36 flex justify-between items-center ${
                                    idx === 0 ? 'font-bold bg-blue-200 border-blue-600' : ''
                                  }`}
                                >
                                  <span className="text-blue-800">{p.name}</span>
                                  <span className="text-gray-700">{p.score}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-col items-center space-y-1">
                              {col2.map((p, idx) => (
                                <div
                                  key={p.id}
                                  className="bg-blue-100 border-2 border-blue-400 rounded-lg px-3 py-2 w-36 flex justify-between items-center"
                                >
                                  <span className="text-blue-800">{p.name}</span>
                                  <span className="text-gray-700">{p.score}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1">
                      {[...(gameState?.players ?? [])]
                        .sort((a, b) => b.score - a.score)
                        .map((p, idx) => (
                          <div
                            key={p.id}
                            className={`bg-blue-100 border-2 border-blue-400 rounded-lg px-3 py-2 w-36 flex justify-between items-center ${
                              idx === 0 ? 'font-bold bg-blue-200 border-blue-600' : ''
                            }`}
                          >
                            <span className="text-blue-800">{p.name}</span>
                            <span className="text-gray-700">{p.score}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Turn</div>
                <div className="bg-blue-100 border-2 border-blue-400 rounded-lg px-3 py-2">
                  <div className="font-bold text-blue-800">{Math.round(turnTimeLeft)}s</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Table */}
        <div className="flex-1 relative">
          {/* Table surface */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-green-800 rounded-3xl shadow-2xl border-8 border-amber-700">
            <div className="absolute inset-4 border-2 border-amber-600 rounded-2xl opacity-30"></div>
          </div>

          {/* Players positioned around the table */}
          <div className="relative p-4 sm:p-8">
            <div
              className={`grid ${gameState?.players.length === 2 || gameState?.players.length === 3 ? "grid-rows-2" : "grid-rows-3"} gap-2 sm:gap-4`}
            >
              
              {/* Top row: C, B, D */}
              <div className="flex justify-center items-start">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 w-full max-w-2xl">
                  <div className="flex justify-center">
                    <PlayerSpot
                      player={positions.C}
                      playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.C?.id)?.card}
                      isCurrentPlayer={false}
                      glow={positions.C?.id === glowingPlayerId}
                      isCurrentPlayerTurn={isCurrentPlayerTurn}
                      currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                      cardStyle={cardStyle}
                      backStyle={backStyle}
                      getTeamInfo={getTeamInfo}
                      handlePlayCard={handlePlayCard}
                    />
                  </div>
                  <div className="flex justify-center">
                    <PlayerSpot
                      player={positions.B}
                      playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.B?.id)?.card}
                      isCurrentPlayer={false}
                      glow={positions.B?.id === glowingPlayerId}
                      isCurrentPlayerTurn={isCurrentPlayerTurn}
                      currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                      cardStyle={cardStyle}
                      backStyle={backStyle}
                      getTeamInfo={getTeamInfo}
                      handlePlayCard={handlePlayCard}
                    />
                  </div>
                  <div className="flex justify-center">
                    <PlayerSpot
                      player={positions.D}
                      playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.D?.id)?.card}
                      isCurrentPlayer={false}
                      glow={positions.D?.id === glowingPlayerId}
                      isCurrentPlayerTurn={isCurrentPlayerTurn}
                      currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                      cardStyle={cardStyle}
                      backStyle={backStyle}
                      getTeamInfo={getTeamInfo}
                      handlePlayCard={handlePlayCard}
                    />
                  </div>
                </div>
              </div>

              {/* Middle row: E and F */}
              {(gameState?.players.length !== 2 && gameState?.players.length !== 3) && (
                <div className="flex justify-between items-center px-4 sm:px-12">
                  <div className="flex justify-center">
                    <PlayerSpot
                      player={positions.E}
                      playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.E?.id)?.card}
                      isCurrentPlayer={false}
                      glow={positions.E?.id === glowingPlayerId}
                      isCurrentPlayerTurn={isCurrentPlayerTurn}
                      currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                      cardStyle={cardStyle}
                      backStyle={backStyle}
                      getTeamInfo={getTeamInfo}
                      handlePlayCard={handlePlayCard}
                    />
                  </div>
                  <div className="flex justify-center">
                    <PlayerSpot
                      player={positions.F}
                      playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.F?.id)?.card}
                      isCurrentPlayer={false}
                      glow={positions.F?.id === glowingPlayerId}
                      isCurrentPlayerTurn={isCurrentPlayerTurn}
                      currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                      cardStyle={cardStyle}
                      backStyle={backStyle}
                      getTeamInfo={getTeamInfo}
                      handlePlayCard={handlePlayCard}
                    />
                  </div>
                </div>
              )}

              {/* Bottom row: A (current player) */}
              <div className="flex justify-center items-end">
                <PlayerSpot
                  player={positions.A}
                  playedCard={gameState?.playedCards?.find(pc => pc.playerId === positions.A?.id)?.card}
                  isCurrentPlayer={true}
                  glow={positions.A?.id === glowingPlayerId}
                  isCurrentPlayerTurn={isCurrentPlayerTurn}
                  currentPlayerTurn={gameState?.players[gameState?.currentPlayerIndex]}
                  cardStyle={cardStyle}
                  backStyle={backStyle}
                  getTeamInfo={getTeamInfo}
                  handlePlayCard={handlePlayCard}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Final leaderboard overlay */}
        {gameState?.gamePhase === 'ended' && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 sm:w-[32rem] sm:p-16 sm:text-xl flex flex-col items-center">
              <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-yellow-700">🏁 Game Over</h2>
              {gameState?.players?.length > 3 ? (
                <div className="grid grid-cols-2 gap-4 w-full">
                  {(() => {
                    const sorted = [...(gameState?.players ?? [])].sort((a, b) => b.score - a.score);
                    const mid = Math.ceil(sorted.length / 2);
                    const col1 = sorted.slice(0, mid);
                    const col2 = sorted.slice(mid);
                    return (
                      <>
                        <div className="flex flex-col items-center space-y-2">
                          {col1.map((p, idx) => (
                            <div
                              key={p.id}
                              className={`bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-3 w-44 flex flex-row gap-x-6 items-center text-lg sm:text-2xl ${
                                idx === 0 ? 'font-bold bg-yellow-200 border-yellow-600' : ''
                              }`}
                            >
                              <span className="text-blue-800 flex-1 truncate text-left">{p.name}</span>
                              <span className="text-gray-700 flex-shrink-0 text-right">{p.score}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-center space-y-2">
                          {col2.map((p) => (
                            <div
                              key={p.id}
                              className="bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-3 w-44 flex flex-row gap-x-6 items-center text-lg sm:text-2xl"
                            >
                              <span className="text-blue-800 flex-1 truncate text-left">{p.name}</span>
                              <span className="text-gray-700 flex-shrink-0 text-right">{p.score}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 w-full">
                  {[...(gameState?.players ?? [])]
                    .sort((a, b) => b.score - a.score)
                    .map((p, idx) => (
                      <div
                        key={p.id}
                        className={`bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-3 w-44 sm:w-[28rem] flex flex-row gap-x-6 items-center text-lg sm:text-2xl ${
                          idx === 0 ? 'font-bold bg-yellow-200 border-yellow-600' : ''
                        }`}
                      >
                        <span className="text-blue-800 flex-1 truncate text-left">{p.name}</span>
                        <span className="text-gray-700 flex-shrink-0 text-right">{p.score}</span>
                      </div>
                    ))}
                </div>
              )}
              <GradientButton
                className="mt-6 px-6 py-2 sm:px-10 sm:py-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full shadow-lg text-lg sm:text-2xl"
                onClick={handleReturnToLobby}
              >
                Return to lobby
              </GradientButton>
            </div>
          </div>
        )}

        {/* Game status */}
        {isCurrentPlayerTurn && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-4 text-center shadow-xl mt-6">
            <h2 className="text-xl font-bold text-white">🎯 Your turn!</h2>
            <p className="text-white opacity-90">Choose a card to play</p>
          </div>
        )}

        {/* Game Chat - sidebar/floating, handled by Chat component CSS */}
        <Chat isMinimized={isChatMinimized} onToggleMinimize={() => setIsChatMinimized((v) => !v)} />

        {/* Preferences and Leave Game Buttons */}
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
          onBackStyleChange={setBackStyle}
        />
      </div>
    </div>
  );
};

export default GamePage;
