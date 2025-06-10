import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, ChatMessage, Card, speedMap } from './types';
import { Database } from './database';
import { EventEmitter } from 'events';

const ITALIAN_SOCCER_PLAYERS = [
  'Rossi', 'Buffon', 'Totti', 'Baggio', 'Maldini', 'Pirlo', 'Del Piero',
  'Cannavaro', 'Gattuso', 'Insigne', 'Immobile', 'Verratti', 'Donnarumma',
  'Chiesa', 'Barella', 'Zaniolo', 'Pellegrini', 'Spinazzola', 'Chiellini',
  'Bonucci', 'Bernardeschi', 'Belotti', 'Locatelli', 'Scamacca'
];

export class GameManager extends EventEmitter {
  private games: Map<string, GameState> = new Map();
  private playerSockets: Map<string, string> = new Map(); // playerId -> socketId
  private socketPlayers: Map<string, string> = new Map(); // socketId -> playerId
  private kickedPlayers: Map<string, Map<string, number>> = new Map(); // lobbyCode -> (playerId -> expiry timestamp)
  private db: Database;
  private turnTimeouts: Map<string, NodeJS.Timeout> = new Map(); // lobbyCode -> timeout

  constructor(db: Database) {
    super();
    this.db = db;
    this.loadGamesFromDB();
  }

  private getTurnTimeoutMS(gameState: GameState): number {
    return speedMap[gameState.speed] || speedMap.normal;
  }

  private setTurnTimeout(lobbyCode: string) {
    // Clear any existing timeout
    if (this.turnTimeouts.has(lobbyCode)) {
      clearTimeout(this.turnTimeouts.get(lobbyCode)!);
    }
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.hand || currentPlayer.hand.length === 0) return;

    if (currentPlayer.isAI) {
      // Instantly play for AI
      this.processAITurn(lobbyCode);
      return;
    }

    this.turnTimeouts.set(
      lobbyCode,
      setTimeout(async () => {
        // Pick a random card for the player if they haven't played
        const gs = this.games.get(lobbyCode);
        if (!gs || gs.gamePhase !== 'playing') return;
        const player = gs.players[gs.currentPlayerIndex];
        if (!player || !player.hand || player.hand.length === 0) return;
        // Pick random card
        const randomIdx = Math.floor(Math.random() * player.hand.length);
        const card = player.hand[randomIdx];
        try {
          await this.playCard(lobbyCode, player.id, card);
          this.emit('game-updated', gs);
        } catch (err) {
          console.error('Auto-play error:', err);
        }
      }, this.getTurnTimeoutMS(gameState))
    );
  }

  private clearTurnTimeout(lobbyCode: string) {
    if (this.turnTimeouts.has(lobbyCode)) {
      clearTimeout(this.turnTimeouts.get(lobbyCode)!);
      this.turnTimeouts.delete(lobbyCode);
    }
  }

  private async loadGamesFromDB(): Promise<void> {
    // This would load existing games from database on server restart
    // For now, we'll start fresh each time
  }

  randomRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  generateRandomName(): string {
    return ITALIAN_SOCCER_PLAYERS[Math.floor(Math.random() * ITALIAN_SOCCER_PLAYERS.length)];
  }

  generateLobbyCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async createLobby(playerName: string, socketId: string): Promise<GameState> {
    const gameId = uuidv4();
    const lobbyCode = this.generateLobbyCode();
    const playerId = uuidv4();

    const host: Player = {
      id: playerId,
      name: playerName,
      isHost: true,
      isAI: false,
      score: 0
    };

    const gameState: GameState = {
      id: gameId,
      lobbyCode,
      players: [host],
      currentPlayerIndex: 0,
      gamePhase: 'lobby',
      maxPlayers: 5,
      speed: 'normal',
      chat: [],
      currentRound: 1
    };

    this.games.set(lobbyCode, gameState);
    this.playerSockets.set(playerId, socketId);
    this.socketPlayers.set(socketId, playerId);

    await this.db.saveGame(gameState);
    return gameState;
  }

  async joinLobby(lobbyCode: string, playerName: string, socketId: string): Promise<GameState> {
    const gameState = this.games.get(lobbyCode) || await this.db.loadGame(lobbyCode);
    
    if (!gameState) {
      throw new Error('Lobby not found');
    }

    // Prevent recently kicked players from rejoining
    const kicked = this.kickedPlayers.get(lobbyCode);
    if (kicked) {
      // Clean up expired entries
      const now = Date.now();
      for (const [pid, expiry] of kicked.entries()) {
        if (expiry < now) kicked.delete(pid);
      }
      for (const [pid, expiry] of kicked.entries()) {
        if (playerName === '' || expiry < now) continue;
        // Block by player name (since new uuid is generated on join)
        if (pid === playerName) {
          const remainingMs = expiry - now;
          const err: any = new Error('You have been kicked. Please wait before rejoining.');
          err.code = 'KICK_TIMEOUT';
          err.remainingMs = remainingMs > 0 ? remainingMs : 0;
          throw err;
        }
      }
    }

    if (gameState.players.length >= gameState.maxPlayers) {
      throw new Error('Lobby is full');
    }

    // Prevent duplicate player names
    if (gameState.players.some(p => p.name === playerName)) {
      throw new Error('This player has already joined the lobby');
    }

    const AIplayer = gameState.players.find(p => p.name === playerName + 'bot' && p.isAI);
    if (AIplayer) {
      // Reconnect existing AI player
      AIplayer.isAI = false;
      AIplayer.name = AIplayer.name.replace('bot', '');
      this.playerSockets.set(AIplayer.id, socketId);
      this.socketPlayers.set(socketId, AIplayer.id);
      this.games.set(lobbyCode, gameState);
      await this.db.saveGame(gameState);
      return gameState;
    }

    if (gameState.gamePhase === 'playing') {
      throw new Error('Game already started, cannot join now');
    }

    const playerId = uuidv4();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isHost: false,
      isAI: false,
      score: 0
    };

    gameState.players.push(newPlayer);
    this.games.set(lobbyCode, gameState);
    this.playerSockets.set(playerId, socketId);
    this.socketPlayers.set(socketId, playerId);

    await this.db.saveGame(gameState);
    return gameState;
  }

  private handleSpecialDeckCases(deck: Card[], numPlayers: number): void {
    // Add special cases here
    if (numPlayers === 3) {
      // Remove the first card with number = 2
      const idx = deck.findIndex(card => card.number === 2);
      if (idx !== -1) {
        deck.splice(idx, 1);
      }
    }
    // Future: add more cases for other player counts
  }

  async startGame(lobbyCode: string, playerId: string): Promise<GameState> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) {
      throw new Error('Lobby not found');
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.isHost) {
      throw new Error('Only the host can start the game');
    }

    if (gameState.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    if (gameState.players.length > 5) {
      throw new Error('Too many players, maximum is 5');
    }

    gameState.gamePhase = 'playing';
    gameState.currentPlayerIndex = 0;
    gameState.currentRound = 1;
    gameState.turnStartTimestamp = Date.now();
    gameState.turnEndTimestamp = gameState.turnStartTimestamp + this.getTurnTimeoutMS(gameState);
    this.setTurnTimeout(lobbyCode);

    // Reset scores, hands, and wonCards
    gameState.players.forEach(p => {
      p.score = 0;
      p.hand = [];
      p.wonCards = [];
    });

    // Create and shuffle deck
    const suits: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    let deck: Card[] = [];
    for (const suit of suits) {
      for (let number = 1; number <= 10; number++) {
        deck.push({ number, suit });
      }
    }
    // Handle special cases before shuffling
    this.handleSpecialDeckCases(deck, gameState.players.length);
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    gameState.deck = deck;

    // Reveal last card (but do not remove it from the deck)
    if (deck.length > 0) {
      gameState.lastCard = deck[0];
    }

    // Deal 3 cards to each player
    for (const player of gameState.players) {
      player.hand = [];
      for (let i = 0; i < 3; i++) {
        if (gameState.deck && gameState.deck.length > 0) {
          player.hand.push(gameState.deck.pop()!);
        }
      }
    }

    gameState.playedCards = [];

    this.games.set(lobbyCode, gameState);
    await this.db.saveGame(gameState);
    return gameState;
  }

  // Card play logic will be implemented here.

  async playCard(lobbyCode: string, playerId: string, card: Card): Promise<GameState> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') {
      throw new Error('Game not found or not in progress');
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.hand) {
      throw new Error('Player not found');
    }

    // Validate card is in hand
    const cardIndex = player.hand.findIndex(
      c => c.number === card.number && c.suit === card.suit
    );
    if (cardIndex === -1) {
      throw new Error('Card not in hand');
    }

    // Remove card from hand and add to playedCards
    const playedCard = player.hand.splice(cardIndex, 1)[0];
    if (!gameState.playedCards) gameState.playedCards = [];
    gameState.playedCards.push({ playerId, card: playedCard });

    // Move to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Clear previous turn timeout
    this.clearTurnTimeout(lobbyCode);

    const ttMS = this.getTurnTimeoutMS(gameState);

    // If all players have played, resolve round
    if (gameState.playedCards.length === gameState.players.length) {
      // --- BRISCOLA/DOMINANT SUIT LOGIC ---
      let winner: { playerId: string; card: Card } | undefined = undefined;
      let dominantSuit: string | undefined = undefined;
      const briscolaSuit = gameState.lastCard?.suit;

      // Check if any briscola cards were played
      const briscolaCards = gameState.playedCards.filter(pc => pc.card.suit === briscolaSuit);
      if (briscolaCards.length > 0) {
        dominantSuit = briscolaSuit;
      } else {
        dominantSuit = gameState.playedCards[0]?.card.suit;
      }

      // Card value function
      function getCardValue(card: Card) {
        if (card.number === 3) return 10;
        if (card.number === 1) return 11;
        if (card.number === 8) return 2;
        if (card.number === 9) return 3;
        if (card.number === 10) return 4;
        return 0;
      }

      // Find the highest value card of the dominant suit, first in play order wins ties
      let maxValue = -1;
      let maxNumber = -1;
      for (const pc of gameState.playedCards) {
        if (pc.card.suit === dominantSuit) {
          const value = getCardValue(pc.card);
          if (
            value > maxValue ||
            (value === maxValue && value === 0 && pc.card.number > maxNumber)
          ) {
            winner = pc;
            maxValue = value;
            maxNumber = pc.card.number;
          }
        }
      }

      // Store winner for frontend display (always one winner)
      gameState.lastRoundWinner = winner?.playerId;

      // Store played cards for frontend display
      gameState.lastPlayedCards = [...gameState.playedCards];

      // Give all played cards to the winner's wonCards and update their score immediately
      if (winner) {
        const winPlayer = gameState.players.find(p => p.id === winner.playerId);
        if (winPlayer) {
          if (!winPlayer.wonCards) winPlayer.wonCards = [];
          for (const pc of gameState.playedCards) {
            winPlayer.wonCards.push(pc.card);
          }
          // Update score immediately after collecting cards
          winPlayer.score = (winPlayer.wonCards ?? []).reduce((sum, card) => sum + getCardValue(card), 0);
        }
      }

      // Deal cards so each player has up to 3 cards, if enough in deck
      if (gameState.deck && gameState.deck.length > 0) {
        for (const player of gameState.players) {
          while (player.hand!.length < 3 && gameState.deck.length > 0) {
            player.hand!.push(gameState.deck.pop()!);
          }
        }
      }

      // Prepare for next round
      gameState.playedCards = [];
      gameState.currentRound += 1;
      // Set next starting player to last round winner
      if (gameState.lastRoundWinner) {
        const winnerIndex = gameState.players.findIndex(p => p.id === gameState.lastRoundWinner);
        gameState.currentPlayerIndex = winnerIndex !== -1 ? winnerIndex : 0;
      } else {
        gameState.currentPlayerIndex = 0;
      }

      // Set new turn start timestamp for next round
      gameState.turnStartTimestamp = Date.now();
      gameState.turnEndTimestamp = gameState.turnStartTimestamp + ttMS + 3000; // Add 3 seconds for round resolution

      // Check if some players have empty hands (game end)
      const allEmpty = gameState.players.some(p => !p.hand || p.hand.length === 0);
      if (allEmpty) {
        gameState.gamePhase = 'ended';
        
        // Find player with highest score as the winner
        gameState.winner = gameState.players.reduce(
          (winner, player) => (!winner || player.score > winner.score) ? player : winner, undefined as Player | undefined
        );
      } else {
        // Set timeout for next turn if not game end
        this.setTurnTimeout(lobbyCode);
      }
    } else {
      // Set new turn start timestamp for next player
      gameState.turnStartTimestamp = Date.now();
      gameState.turnEndTimestamp = gameState.turnStartTimestamp + ttMS;
      this.setTurnTimeout(lobbyCode);
    }

    this.games.set(lobbyCode, gameState);
    await this.db.saveGame(gameState);
    return gameState;
  }

  async processAITurn(lobbyCode: string): Promise<void> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') {
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isAI && currentPlayer.hand && currentPlayer.hand.length > 0) {
      try {
        // Pick a random card from AI's hand
        const randomIdx = Math.floor(Math.random() * currentPlayer.hand!.length);
        const card = currentPlayer.hand![randomIdx];
        await this.playCard(lobbyCode, currentPlayer.id, card);
      } catch (error) {
        console.error('AI turn error:', error);
      }
      /*
      setTimeout(async () => {
        
      }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds */
    }
  }

  async kickPlayer(lobbyCode: string, hostId: string, targetPlayerId: string): Promise<GameState> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) {
      throw new Error('Game not found');
    }

    const host = gameState.players.find(p => p.id === hostId);
    if (!host || !host.isHost) {
      throw new Error('Only the host can kick players');
    }

    const targetIndex = gameState.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) {
      throw new Error('Player not found');
    }

    // Add to kicked list by player name for 30 seconds
    const kickedName = gameState.players[targetIndex].name;
    if (!this.kickedPlayers.has(lobbyCode)) {
      this.kickedPlayers.set(lobbyCode, new Map());
    }
    this.kickedPlayers.get(lobbyCode)!.set(kickedName, Date.now() + 30000);

    // Remove player
    gameState.players.splice(targetIndex, 1);

    // Adjust current player index if necessary
    if (gameState.currentPlayerIndex >= targetIndex && gameState.currentPlayerIndex > 0) {
      gameState.currentPlayerIndex--;
    }

    // Clean up socket mappings
    const socketId = this.playerSockets.get(targetPlayerId);
    if (socketId) {
      this.playerSockets.delete(targetPlayerId);
      this.socketPlayers.delete(socketId);
    }

    this.games.set(lobbyCode, gameState);
    await this.db.saveGame(gameState);
    return gameState;
  }

  async leaveGame(socketId: string): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    const playerId = this.socketPlayers.get(socketId);
    if (!playerId) {
      return { gameState: null, lobbyCode: null };
    }

    // Find the game this player is in
    let foundGame: GameState | null = null;
    let lobbyCode: string | null = null;

    for (const [code, game] of this.games.entries()) {
      if (game.players.some(p => p.id === playerId)) {
        foundGame = game;
        lobbyCode = code;
        break;
      }
    }

    if (!foundGame || !lobbyCode) {
      return { gameState: null, lobbyCode: null };
    }

    const player = foundGame.players.find(p => p.id === playerId);
    if (!player) {
      return { gameState: null, lobbyCode: null };
    }

    if (foundGame.gamePhase === 'playing') {
      // Replace with AI during game
      const wasHost = player.isHost;
      player.isAI = true;
      player.name = player.name + 'bot';

      // Assign new host if the leaving player was host
      if (wasHost) {
        const humanPlayers = foundGame.players.filter(p => !p.isAI && p.id !== playerId);
        if (humanPlayers.length > 0) {
          const newHost = humanPlayers[0];
          newHost.isHost = true;
          for (const p of foundGame.players) {
            if (p.id !== newHost.id) {
              p.isHost = false;
            }
          }
        }
      }
    } else {
      // Remove player from lobby
      const playerIndex = foundGame.players.findIndex(p => p.id === playerId);
      foundGame.players.splice(playerIndex, 1);

      if (player.isHost) {
        const humanPlayers = foundGame.players.filter(p => !p.isAI);
        if (humanPlayers.length > 0) {
          const newHost = humanPlayers[0];
          newHost.isHost = true;
          for (const p of foundGame.players) {
            if (p.id !== newHost.id) {
              p.isHost = false;
            }
          }
        }
      }
      
    }

    // Clean up socket mappings
    this.playerSockets.delete(playerId);
    this.socketPlayers.delete(socketId);

    // Delete game if no real players left (either empty or only AI players)
    if (foundGame.players.length === 0 || foundGame.players.every(p => p.isAI)) {
      this.games.delete(lobbyCode);
      await this.db.deleteGame(foundGame.id, lobbyCode);
      return { gameState: null, lobbyCode };
    }

    this.games.set(lobbyCode, foundGame);
    await this.db.saveGame(foundGame);
    return { gameState: foundGame, lobbyCode };
  }

  async sendMessage(lobbyCode: string, playerId: string, message: string, isSystem: boolean = false): Promise<ChatMessage> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) {
      throw new Error('Game not found');
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!isSystem && !player) {
      throw new Error('Player not found');
    }

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName: player?.name || 'System',
      message: message.trim(),
      timestamp: Date.now()
    };

    gameState.chat.push(chatMessage);
    
    // Keep only last 100 messages
    if (gameState.chat.length > 100) {
      gameState.chat = gameState.chat.slice(-100);
    }

    await this.db.saveChatMessage(chatMessage, gameState.id);
    this.games.set(lobbyCode, gameState);
    
    return chatMessage;
  }

  async returnToLobby(lobbyCode: string): Promise<GameState> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) {
      throw new Error('Game not found');
    }

    gameState.gamePhase = 'lobby';
    gameState.currentPlayerIndex = 0;
    gameState.winner = undefined;
    gameState.currentRound = 1;

    // Reset player states but keep scores for reference
    gameState.players.forEach(p => {
      p.hand = [];
    });

    this.games.set(lobbyCode, gameState);
    await this.db.saveGame(gameState);
    return gameState;
  }

  getPlayerBySocket(socketId: string): string | undefined {
    return this.socketPlayers.get(socketId);
  }

  getSocketByPlayer(playerId: string): string | undefined {
    return this.playerSockets.get(playerId);
  }

  getGame(lobbyCode: string): GameState | undefined {
    return this.games.get(lobbyCode);
  }
}
