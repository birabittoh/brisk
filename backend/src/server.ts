import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { Database } from './database';
import { GameManager } from './gameManager';
import { GameState, SocketEvents, speedOptions } from './types';

const app = express();
const server = createServer(app);
const io = new Server<SocketEvents>(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Initialize database and game manager
const db = new Database();
const gameManager = new GameManager(db);

// Listen for game-updated events from GameManager and notify clients
gameManager.on('game-updated', (gameState) => {
  if (gameState && gameState.lobbyCode) {
    io.to(gameState.lobbyCode).emit('game-updated', gameState);
  }
});


const sendSystemMessage = async (lobbyCode: string, message: string): Promise<boolean> => {
  const chatMessage = await gameManager.sendMessage(lobbyCode, "", message, true);
  return io.to(lobbyCode).emit('message-received', chatMessage);
}

const findPlayerAndGame = (
    socket: Socket
): { playerId: string; lobbyCode: string; foundGame: GameState } => {
    const playerId = gameManager.getPlayerBySocket(socket.id);
    if (!playerId) {
        socket.emit("error", "Player not found");
        throw new Error("Player not found");
    }

    let foundGame: GameState | undefined;
    // Find lobby code for this player
    let lobbyCode: string | undefined;
    const rooms = Array.from(socket.rooms);
    for (const room of rooms) {
        if (room !== socket.id) {
            const game = gameManager.getGame(room);
            if (game && game.players.some((p) => p.id === playerId)) {
                foundGame = game;
                lobbyCode = room;
                break;
            }
        }
    }

    if (!lobbyCode) {
        socket.emit("error", "Lobby not found");
        throw new Error("Lobby not found");
    }
    if (!foundGame) {
        socket.emit("error", "Game not found");
        throw new Error("Game not found");
    }

    return { playerId, lobbyCode, foundGame };
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.on('create-lobby', async (data) => {
    try {
      const gameState = await gameManager.createLobby(data.playerName, socket.id);
      socket.join(gameState.lobbyCode);
      // Get the playerId just created
      const playerId = gameManager.getPlayerBySocket(socket.id);
      socket.emit('lobby-created', { gameState, playerUuid: playerId ?? '' });
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to create lobby');
    }
  });

  socket.on('join-lobby', async (data) => {
    try {
      const gameState = await gameManager.joinLobby(data.lobbyCode, data.playerName, socket.id);
      socket.join(data.lobbyCode);
      // Get the playerId just joined
      const playerId = gameManager.getPlayerBySocket(socket.id);
      socket.emit('lobby-joined', { gameState, playerUuid: playerId ?? '' });
      io.to(data.lobbyCode).emit('game-updated', gameState);
      
      const newPlayer = gameState.players[gameState.players.length - 1];
      socket.to(data.lobbyCode).emit('player-joined', newPlayer);

      if (gameState.players.length > 0) {
        await sendSystemMessage(data.lobbyCode, `${newPlayer.name} has joined the lobby.`);
      }
    } catch (error) {
      if (typeof error === 'object' && error && (error as any).code === 'KICK_TIMEOUT') {
        socket.emit('player-kicked', '');
        socket.emit('error', {
          type: 'kick-timeout',
          message: (error as any).message,
          remainingMs: (error as any).remainingMs
        });
      } else {
        socket.emit('error', error instanceof Error ? error.message : 'Failed to join lobby');
      }
    }
  });

  socket.on('start-game', async () => {
    try {
      const playerId = gameManager.getPlayerBySocket(socket.id);
      if (!playerId) {
        socket.emit('error', 'Player not found');
        return;
      }

      // Find lobby code for this player
      let lobbyCode: string | undefined;
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          const game = gameManager.getGame(room);
          if (game && game.players.some(p => p.id === playerId)) {
            lobbyCode = room;
            break;
          }
        }
      }

      if (!lobbyCode) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const gameState = await gameManager.startGame(lobbyCode, playerId);
      io.to(lobbyCode).emit('game-started', gameState);
      
      // Process AI turn if first player is AI
      // await gameManager.processAITurn(lobbyCode);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to start game');
    }
  });

  socket.on('play-card', async (data) => {
    try {
      const playerId = gameManager.getPlayerBySocket(socket.id);
      if (!playerId) {
        socket.emit('error', 'Player not found');
        return;
      }

      // Find lobby code for this player
      let lobbyCode: string | undefined;
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          const game = gameManager.getGame(room);
          if (game && game.players.some(p => p.id === playerId)) {
            lobbyCode = room;
            break;
          }
        }
      }

      if (!lobbyCode) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const gameState = await gameManager.playCard(lobbyCode, playerId, data.card);

      if (gameState.gamePhase === 'ended') {
        io.to(lobbyCode).emit('game-ended', gameState);
        // Return to lobby after 5 seconds
        setTimeout(async () => {
          const updatedState = await gameManager.returnToLobby(lobbyCode!);
          io.to(lobbyCode!).emit('game-updated', updatedState);
        }, 5000);
      } else {
        io.to(lobbyCode).emit('game-updated', gameState);
        // Process AI turn for next player if AI
        const nextPlayer = gameState.players[gameState.currentPlayerIndex];
        if (
          gameState.gamePhase === 'playing' &&
          nextPlayer?.isAI
        ) {
          await gameManager.processAITurn(lobbyCode);
        }
      }
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to play card');
    }
  });

  socket.on('kick-player', async (targetPlayerId) => {
    try {
      const playerId = gameManager.getPlayerBySocket(socket.id);
      if (!playerId) {
        socket.emit('error', 'Player not found');
        return;
      }

      // Find lobby code for this player
      let lobbyCode: string | undefined;
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          const game = gameManager.getGame(room);
          if (game && game.players.some(p => p.id === playerId)) {
            lobbyCode = room;
            break;
          }
        }
      }

      if (!lobbyCode) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      // Disconnect the kicked player BEFORE removing mappings
      const targetSocketId = gameManager.getSocketByPlayer(targetPlayerId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(lobbyCode);
          targetSocket.emit('player-kicked', '');
        }
      }

      const gameState = await gameManager.kickPlayer(lobbyCode, playerId, targetPlayerId);

      io.to(lobbyCode).emit('game-updated', gameState);
      io.to(lobbyCode).emit('player-left', targetPlayerId);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to kick player');
    }
  });

  socket.on('leave-lobby', async () => {
    // Get player name before leaving
    const playerId = gameManager.getPlayerBySocket(socket.id);
    let playerName = "";
    let lobbyCode = "";
    if (playerId) {
      for (const [code, game] of gameManager['games'].entries()) {
        if (game.players.some(p => p.id === playerId)) {
          lobbyCode = code;
          const player = game.players.find(p => p.id === playerId);
          if (player) playerName = player.name;
          break;
        }
      }
    }

    const result = await gameManager.leaveGame(socket.id);
    
    if (result.lobbyCode) {
      socket.leave(result.lobbyCode);
      
      if (result.gameState) {
        socket.to(result.lobbyCode).emit('game-updated', result.gameState);
        
        if (playerId) {
          socket.to(result.lobbyCode).emit('player-left', playerId);

          if (result.gameState.players.length > 0 && playerName) {
            await sendSystemMessage(result.lobbyCode, `${playerName} has left the lobby.`);
          }
        }
      }
    }
  });

  socket.on('send-message', async (message) => {
    try {
      const playerId = gameManager.getPlayerBySocket(socket.id);
      if (!playerId) {
        socket.emit('error', 'Player not found');
        return;
      }

      // Find lobby code for this player
      let lobbyCode: string | undefined;
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          const game = gameManager.getGame(room);
          if (game && game.players.some(p => p.id === playerId)) {
            lobbyCode = room;
            break;
          }
        }
      }

      if (!lobbyCode) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const chatMessage = await gameManager.sendMessage(lobbyCode, playerId, message);
      io.to(lobbyCode).emit('message-received', chatMessage);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to send message');
    }
  });

  socket.on('change-max-players', async (maxPlayers) => {
    try {
      const { playerId, lobbyCode, foundGame } = findPlayerAndGame(socket);
      const player = foundGame.players.find(p => p.id === playerId);

      if (!player?.isHost) {
        socket.emit('error', 'Only the host can change max players');
        return;
      }
      if (foundGame.gamePhase !== 'lobby') {
        socket.emit('error', 'Cannot change max players during game');
        return;
      }
      if (maxPlayers < foundGame.players.length) {
        socket.emit('error', 'Cannot set max players less than current player count');
        return;
      }

      foundGame.maxPlayers = maxPlayers;
      await db.saveGame(foundGame);
      io.to(lobbyCode).emit('game-updated', foundGame);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to update max players');
    }
  });

  socket.on('change-speed', async (speed) => {
    try {
      const { playerId, lobbyCode, foundGame } = findPlayerAndGame(socket);
      const player = foundGame.players.find(p => p.id === playerId);

      if (!player?.isHost) {
        socket.emit('error', 'Only the host can change game speed');
        return;
      }
      if (foundGame.gamePhase !== 'lobby') {
        socket.emit('error', 'Cannot change game speed during game');
        return;
      }

      if (!speedOptions.includes(speed)) {
        socket.emit('error', 'Bad speed value');
        return;
      }

      foundGame.speed = speed;
      await db.saveGame(foundGame);
      io.to(lobbyCode).emit('game-updated', foundGame);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to update max players');
    }
  });

  socket.on('disconnect', async () => {
    // Get player name before leaving
    const playerId = gameManager.getPlayerBySocket(socket.id);
    let playerName = "";
    let lobbyCode = "";
    if (playerId) {
      for (const [code, game] of gameManager['games'].entries()) {
        if (game.players.some(p => p.id === playerId)) {
          lobbyCode = code;
          const player = game.players.find(p => p.id === playerId);
          if (player) playerName = player.name;
          break;
        }
      }
    }

    const result = await gameManager.leaveGame(socket.id);
    
    if (result.lobbyCode && result.gameState) {
      socket.to(result.lobbyCode).emit('game-updated', result.gameState);
      
      if (playerId) {
        socket.to(result.lobbyCode).emit('player-left', playerId);

        if (result.gameState.players.length > 0 && playerName) {
          await sendSystemMessage(result.lobbyCode, `${playerName} has left the lobby.`);
        }
      }

      // If it's now an AI's turn, process the AI turn
      const game = gameManager.getGame(result.lobbyCode);
      if (
        game &&
        game.gamePhase === 'playing' &&
        game.players[game.currentPlayerIndex]?.isAI
      ) {
        await gameManager.processAITurn(result.lobbyCode);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🃏 Brisk server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
