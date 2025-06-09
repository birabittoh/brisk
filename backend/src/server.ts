import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { Database } from './database';
import { GameManager } from './gameManager';
import { SocketEvents } from './types';

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

// Listen for dice rolls (human or AI) and broadcast to all players
gameManager.on('diceRolled', ({ lobbyCode, playerId, roll, gameState }) => {
  io.to(lobbyCode).emit('dice-rolled', { playerId, roll });
  io.to(lobbyCode).emit('game-updated', gameState);
});

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
      await gameManager.processAITurn(lobbyCode);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to start game');
    }
  });

  socket.on('roll-dice', async () => {
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

      const result = await gameManager.rollDice(lobbyCode, playerId);

      if (result.gameState.gamePhase === 'ended') {
        io.to(lobbyCode).emit('game-ended', result.gameState);
        // Return to lobby after 5 seconds
        setTimeout(async () => {
          const updatedState = await gameManager.returnToLobby(lobbyCode!);
          io.to(lobbyCode!).emit('game-updated', updatedState);
        }, 5000);
      } else {
        // Process AI turn for next player
        await gameManager.processAITurn(lobbyCode);
      }
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to roll dice');
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
    const result = await gameManager.leaveGame(socket.id);
    
    if (result.lobbyCode) {
      socket.leave(result.lobbyCode);
      
      if (result.gameState) {
        socket.to(result.lobbyCode).emit('game-updated', result.gameState);
        
        const playerId = gameManager.getPlayerBySocket(socket.id);
        if (playerId) {
          socket.to(result.lobbyCode).emit('player-left', playerId);
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

  socket.on('disconnect', async () => {
    const result = await gameManager.leaveGame(socket.id);
    
    if (result.lobbyCode && result.gameState) {
      socket.to(result.lobbyCode).emit('game-updated', result.gameState);
      
      const playerId = gameManager.getPlayerBySocket(socket.id);
      if (playerId) {
        socket.to(result.lobbyCode).emit('player-left', playerId);
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

// Cleanup routine
setInterval(async () => {
  await gameManager.cleanup();
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🎲 Brisk server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
