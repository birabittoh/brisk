import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, ChatMessage, Card, speedMap, Suit } from './types';
import { EventEmitter } from 'events';
import { computeChosenCard } from './ai';

const ITALIAN_SOCCER_PLAYERS = [
  'Rossi', 'Buffon', 'Totti', 'Baggio', 'Maldini', 'Pirlo', 'Del Piero',
  'Cannavaro', 'Gattuso', 'Insigne', 'Immobile', 'Verratti', 'Donnarumma',
  'Chiesa', 'Barella', 'Zaniolo', 'Pellegrini', 'Spinazzola', 'Chiellini',
  'Bonucci', 'Bernardeschi', 'Belotti', 'Locatelli', 'Scamacca'
];

const KICK_TIMEOUT_MS = 30000;
const ROUND_RESOLUTION_BUFFER_MS = 3000;
const MAX_CHAT_MESSAGES = 100;
const CARDS_PER_HAND = 3;

export function getCardValue(card: Card): number {
    const values: Record<number, number> = {
      1: 11, 3: 10, 8: 2, 9: 3, 10: 4
    };
    return values[card.number] || 0;
  }

export class GameManager extends EventEmitter {
  private games: Map<string, GameState> = new Map();
  private playerSockets: Map<string, string> = new Map();
  private socketPlayers: Map<string, string> = new Map();
  private kickedPlayers: Map<string, Map<string, number>> = new Map();
  private turnTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Utility methods
  private getTurnTimeoutMS(gameState: GameState): number {
    return speedMap[gameState.speed] || speedMap.normal;
  }

  private cleanPlayerName(playerName: string): string {
    let cleanName = playerName;
    if (cleanName.trim().toLowerCase().endsWith('bot')) {
      cleanName = cleanName.replace(/bot$/i, '').trim();
    }
    return cleanName;
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

  // Socket management
  private mapPlayerSocket(playerId: string, socketId: string): void {
    this.playerSockets.set(playerId, socketId);
    this.socketPlayers.set(socketId, playerId);
  }

  private unmapPlayerSocket(playerId: string, socketId: string): void {
    this.playerSockets.delete(playerId);
    this.socketPlayers.delete(socketId);
  }

  getPlayerBySocket(socketId: string): string | undefined {
    return this.socketPlayers.get(socketId);
  }

  getSocketByPlayer(playerId: string): string | undefined {
    return this.playerSockets.get(playerId);
  }

  // Turn timeout management
  private setTurnTimeout(lobbyCode: string): void {
    this.clearTurnTimeout(lobbyCode);
    
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer?.hand?.length) return;

    if (currentPlayer.isAI) {
      this.processAITurn(lobbyCode);
      return;
    }

    const timeout = setTimeout(async () => {
      await this.handleTurnTimeout(lobbyCode);
    }, this.getTurnTimeoutMS(gameState));

    this.turnTimeouts.set(lobbyCode, timeout);
  }

  private clearTurnTimeout(lobbyCode: string): void {
    const timeout = this.turnTimeouts.get(lobbyCode);
    if (timeout) {
      clearTimeout(timeout);
      this.turnTimeouts.delete(lobbyCode);
    }
  }

  private async handleTurnTimeout(lobbyCode: string): Promise<void> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') return;
    
    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player?.hand?.length) return;

    try {
      const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
      await this.playCard(lobbyCode, player.id, randomCard);
      this.emit('game-updated', gameState);
    } catch (err) {
      console.error('Auto-play error:', err);
    }
  }

  // Kick management
  private cleanupExpiredKicks(lobbyCode: string): void {
    const kicked = this.kickedPlayers.get(lobbyCode);
    if (!kicked) return;
    
    const now = Date.now();
    for (const [pid, expiry] of kicked.entries()) {
      if (expiry < now) kicked.delete(pid);
    }
  }

  private isPlayerKicked(lobbyCode: string, playerName: string): { isKicked: boolean; remainingMs: number } {
    const kicked = this.kickedPlayers.get(lobbyCode);
    if (!kicked) return { isKicked: false, remainingMs: 0 };
    
    const expiry = kicked.get(playerName);
    if (!expiry) return { isKicked: false, remainingMs: 0 };
    
    const remainingMs = Math.max(0, expiry - Date.now());
    return { isKicked: remainingMs > 0, remainingMs };
  }

  private addKickedPlayer(lobbyCode: string, playerName: string): void {
    if (!this.kickedPlayers.has(lobbyCode)) {
      this.kickedPlayers.set(lobbyCode, new Map());
    }
    this.kickedPlayers.get(lobbyCode)!.set(playerName, Date.now() + KICK_TIMEOUT_MS);
  }

  // Game state validation
  private validateGameExists(lobbyCode: string): GameState {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) throw new Error('Game not found');
    return gameState;
  }

  private validatePlayer(gameState: GameState, playerId: string): Player {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    return player;
  }

  private validateHost(gameState: GameState, playerId: string): Player {
    const player = this.validatePlayer(gameState, playerId);
    if (!player.isHost) throw new Error('Only the host can perform this action');
    return player;
  }

  // Game creation and joining
  async createLobby(playerName: string, socketId: string): Promise<GameState> {
    // Remove "bot" suffix from human player names
    const cleanName = this.cleanPlayerName(playerName);

    const gameId = uuidv4();
    const lobbyCode = this.generateLobbyCode();
    const playerId = uuidv4();

    const gameState: GameState = {
      id: gameId,
      lobbyCode,
      players: [{
        id: playerId,
        name: cleanName,
        isHost: true,
        isAI: false,
        score: 0
      }],
      currentPlayerIndex: 0,
      gamePhase: 'lobby',
      maxPlayers: 5,
      speed: 'normal',
      chat: [],
      currentRound: 1
    };

    this.games.set(lobbyCode, gameState);
    this.mapPlayerSocket(playerId, socketId);
    
    return gameState;
  }

  async joinLobby(lobbyCode: string, playerName: string, socketId: string): Promise<GameState> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState) throw new Error('Lobby not found');

    const cleanName = this.cleanPlayerName(playerName);

    const existingAI = this.validateJoinConditions(gameState, lobbyCode, cleanName);
    if (existingAI) {
      return this.reconnectAIPlayer(existingAI, socketId, gameState, lobbyCode);
    }

    return this.addNewPlayer(gameState, cleanName, socketId, lobbyCode);
  }

  private validateJoinConditions(gameState: GameState, lobbyCode: string, playerName: string): Player | undefined {
    this.cleanupExpiredKicks(lobbyCode);
    
    const kickStatus = this.isPlayerKicked(lobbyCode, playerName);
    if (kickStatus.isKicked) {
      const error: any = new Error('You have been kicked. Please wait before rejoining.');
      error.code = 'KICK_TIMEOUT';
      error.remainingMs = kickStatus.remainingMs;
      throw error;
    }

    if (gameState.players.length >= gameState.maxPlayers) {
      throw new Error('Lobby is full');
    }

    if (gameState.players.some(p => p.name === playerName)) {
      throw new Error('This player has already joined the lobby');
    }

    const reconnectableAI = this.findReconnectableAI(gameState, playerName);
    if (gameState.gamePhase === 'playing' && !reconnectableAI) {
      throw new Error('Game already started, cannot join now');
    }

    return reconnectableAI;
  }

  private findReconnectableAI(gameState: GameState, playerName: string): Player | undefined {
    return gameState.players.find(p => p.name === playerName + 'bot' && p.isAI);
  }

  private async reconnectAIPlayer(aiPlayer: Player, socketId: string, gameState: GameState, lobbyCode: string): Promise<GameState> {
    aiPlayer.isAI = false;
    aiPlayer.name = this.cleanPlayerName(aiPlayer.name);
    this.mapPlayerSocket(aiPlayer.id, socketId);
    
    this.games.set(lobbyCode, gameState);
    return gameState;
  }

  private async addNewPlayer(gameState: GameState, playerName: string, socketId: string, lobbyCode: string): Promise<GameState> {
    const playerId = uuidv4();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isHost: false,
      isAI: false,
      score: 0
    };

    gameState.players.push(newPlayer);
    this.mapPlayerSocket(playerId, socketId);
    this.games.set(lobbyCode, gameState);
    
    return gameState;
  }

  // Game logic
  private createAndShuffleDeck(numPlayers: number): Card[] {
    const suits: Suit[] = ['a', 'b', 'c', 'd'];
    let deck: Card[] = [];
    
    for (const suit of suits) {
      for (let number = 1; number <= 10; number++) {
        deck.push({ number, suit });
      }
    }
    
    this.handleSpecialDeckCases(deck, numPlayers);
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  private handleSpecialDeckCases(deck: Card[], numPlayers: number): void {
    if (numPlayers === 3) {
      const idx = deck.findIndex(card => card.number === 2);
      if (idx !== -1) deck.splice(idx, 1);
    }
  }

  private initializeGameState(gameState: GameState): void {
    gameState.gamePhase = 'playing';
    gameState.currentPlayerIndex = 0;
    gameState.currentRound = 1;
    
    const timeoutMS = this.getTurnTimeoutMS(gameState);
    this.setNextTurn(gameState, timeoutMS);
    
    // Reset player states
    gameState.players.forEach(p => {
      p.score = 0;
      p.hand = [];
      p.wonCards = [];
    });
  }

  private dealCards(gameState: GameState): void {
    const deck = gameState.deck!;
    for (const player of gameState.players) {
      player.hand = [];
      for (let i = 0; i < CARDS_PER_HAND && deck.length > 0; i++) {
        player.hand.push(deck.pop()!);
      }
    }
  }

  async startGame(lobbyCode: string, playerId: string): Promise<GameState> {
    const gameState = this.validateGameExists(lobbyCode);
    this.validateHost(gameState, playerId);
    
    if (gameState.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    if (gameState.players.length > 5) {
      throw new Error('Too many players, maximum is 5');
    }

    this.initializeGameState(gameState);
    
    const deck = this.createAndShuffleDeck(gameState.players.length);
    gameState.deck = deck;
    gameState.lastCard = deck.length > 0 ? deck[0] : undefined;
    gameState.playedCards = [];
    
    this.dealCards(gameState);
    this.setTurnTimeout(lobbyCode);
    
    this.games.set(lobbyCode, gameState);
    
    return gameState;
  }

  async playCard(lobbyCode: string, playerId: string, card: Card): Promise<GameState> {
    const gameState = this.validateGameExists(lobbyCode);
    if (gameState.gamePhase !== 'playing') {
      throw new Error('Game not in progress');
    }

    const player = this.validatePlayer(gameState, playerId);
    if (!player.hand) throw new Error('Player has no hand');

    const cardIndex = player.hand.findIndex(c => c.number === card.number && c.suit === card.suit);
    if (cardIndex === -1) throw new Error('Card not in hand');

    return this.executeCardPlay(gameState, lobbyCode, player, cardIndex);
  }

  private async executeCardPlay(gameState: GameState, lobbyCode: string, player: Player, cardIndex: number): Promise<GameState> {
    const playedCard = player.hand!.splice(cardIndex, 1)[0];
    if (!gameState.playedCards) gameState.playedCards = [];
    gameState.playedCards.push({ playerId: player.id, card: playedCard });

    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    this.clearTurnTimeout(lobbyCode);

    const ttMS = this.getTurnTimeoutMS(gameState);

    if (gameState.playedCards.length === gameState.players.length) {
      await this.resolveRound(gameState, lobbyCode, ttMS);
    } else {
      this.setNextTurn(gameState, ttMS);
      this.setTurnTimeout(lobbyCode);
    }

    this.games.set(lobbyCode, gameState);
    return gameState;
  }

  private setNextTurn(gameState: GameState, timeoutMS: number, offsetMS: number = 0): void {
    gameState.turnStartTimestamp = Date.now();
    gameState.turnEndTimestamp = gameState.turnStartTimestamp + timeoutMS + offsetMS;
  }

  private async resolveRound(gameState: GameState, lobbyCode: string, timeoutMS: number): Promise<void> {
    const winner = this.determineRoundWinner(gameState);
    this.distributeCards(gameState, winner);
    this.refillHands(gameState);
    this.prepareNextRound(gameState, winner, timeoutMS);
    
    if (this.isGameEnded(gameState)) {
      this.endGame(gameState);
    } else {
      this.setTurnTimeout(lobbyCode);
    }
  }

  private determineRoundWinner(gameState: GameState): { playerId: string; card: Card } | undefined {
    const briscolaSuit = gameState.lastCard?.suit;
    const playedCards = gameState.playedCards!;
    
    // Determine dominant suit
    const briscolaCards = playedCards.filter(pc => pc.card.suit === briscolaSuit);
    const dominantSuit = briscolaCards.length > 0 ? briscolaSuit : playedCards[0]?.card.suit;
    
    // Find highest value card of dominant suit
    let winner: { playerId: string; card: Card } | undefined;
    let maxValue = -1;
    let maxNumber = -1;
    
    for (const pc of playedCards) {
      if (pc.card.suit === dominantSuit) {
        const value = getCardValue(pc.card);
        if (value > maxValue || (value === maxValue && value === 0 && pc.card.number > maxNumber)) {
          winner = pc;
          maxValue = value;
          maxNumber = pc.card.number;
        }
      }
    }
    
    return winner;
  }

  private distributeCards(gameState: GameState, winner: { playerId: string; card: Card } | undefined): void {
    gameState.lastRoundWinner = winner?.playerId;
    gameState.lastPlayedCards = [...gameState.playedCards!];
    
    if (winner) {
      const winPlayer = gameState.players.find(p => p.id === winner.playerId);
      if (winPlayer) {
        if (!winPlayer.wonCards) winPlayer.wonCards = [];
        
        for (const pc of gameState.playedCards!) {
          winPlayer.wonCards.push(pc.card);
        }
        
        winPlayer.score = winPlayer.wonCards.reduce((sum, card) => sum + getCardValue(card), 0);
      }
    }
  }

  private refillHands(gameState: GameState): void {
    if (!gameState.deck?.length) return;
    
    for (const player of gameState.players) {
      while (player.hand!.length < CARDS_PER_HAND && gameState.deck.length > 0) {
        player.hand!.push(gameState.deck.pop()!);
      }
    }
  }

  private prepareNextRound(gameState: GameState, winner: { playerId: string; card: Card } | undefined, timeoutMS: number): void {
    gameState.playedCards = [];
    gameState.currentRound += 1;
    
    if (gameState.lastRoundWinner) {
      const winnerIndex = gameState.players.findIndex(p => p.id === gameState.lastRoundWinner);
      gameState.currentPlayerIndex = winnerIndex !== -1 ? winnerIndex : 0;
    } else {
      gameState.currentPlayerIndex = 0;
    }

    this.setNextTurn(gameState, timeoutMS, ROUND_RESOLUTION_BUFFER_MS);
  }

  private isGameEnded(gameState: GameState): boolean {
    return gameState.players.some(p => !p.hand || p.hand.length === 0);
  }

  private endGame(gameState: GameState): void {
    gameState.gamePhase = 'ended';
    gameState.winner = gameState.players.reduce(
      (winner, player) => (!winner || player.score > winner.score) ? player : winner,
      undefined as Player | undefined
    );
  }

  async processAITurn(lobbyCode: string): Promise<void> {
    const gameState = this.games.get(lobbyCode);
    if (!gameState || gameState.gamePhase !== 'playing') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isAI || !currentPlayer.hand?.length) return;

    try {
      const chosenCard = computeChosenCard(gameState, currentPlayer);
      await this.playCard(lobbyCode, currentPlayer.id, chosenCard);
    } catch (error) {
      console.error('AI turn error:', error);
    }
  }

  // Add a bot/AI player to the lobby
  async addBotToLobby(lobbyCode: string): Promise<GameState> {
    const gameState = this.validateGameExists(lobbyCode);
    if (gameState.gamePhase !== 'lobby') throw new Error('Can only add bots in lobby');
    if (gameState.players.length >= gameState.maxPlayers) throw new Error('Lobby is full');

    // Generate a unique bot name
    let botName: string;
    let tries = 0;
    do {
      botName = this.generateRandomName() + 'bot';
      tries++;
      if (tries > 20) throw new Error('Could not generate unique bot name');
    } while (gameState.players.some(p => p.name === botName));

    const playerId = uuidv4();
    const newBot: Player = {
      id: playerId,
      name: botName,
      isHost: false,
      isAI: true,
      score: 0
    };

    gameState.players.push(newBot);
    this.games.set(lobbyCode, gameState);
    return gameState;
  }

  // Player management
  private transferHostRole(gameState: GameState, excludePlayerId?: string): boolean {
    const humanPlayers = gameState.players.filter(p => !p.isAI && p.id !== excludePlayerId);
    if (humanPlayers.length === 0) return false;
    
    // Remove host status from all players
    gameState.players.forEach(p => p.isHost = false);
    // Assign to first human player
    humanPlayers[0].isHost = true;
    
    return true;
  }

  async kickPlayer(lobbyCode: string, hostId: string, targetPlayerId: string): Promise<GameState> {
    const gameState = this.validateGameExists(lobbyCode);
    this.validateHost(gameState, hostId);
    
    const targetIndex = gameState.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) throw new Error('Player not found');
    
    const kickedName = gameState.players[targetIndex].name;
    const targetPlayer = gameState.players[targetIndex];
    if (!targetPlayer.isAI) {
      this.addKickedPlayer(lobbyCode, kickedName);
    }
    
    // Remove player and adjust current player index
    gameState.players.splice(targetIndex, 1);
    if (gameState.currentPlayerIndex >= targetIndex && gameState.currentPlayerIndex > 0) {
      gameState.currentPlayerIndex--;
    }
    
    // Clean up socket mappings
    const socketId = this.playerSockets.get(targetPlayerId);
    if (socketId) this.unmapPlayerSocket(targetPlayerId, socketId);
    
    this.games.set(lobbyCode, gameState);
    return gameState;
  }

  async leaveGame(socketId: string): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    const playerId = this.socketPlayers.get(socketId);
    if (!playerId) return { gameState: null, lobbyCode: null };
    
    const gameInfo = this.findPlayerGame(playerId);
    if (!gameInfo) return { gameState: null, lobbyCode: null };
    
    const { gameState, lobbyCode } = gameInfo;
    const player = gameState.players.find(p => p.id === playerId)!;
    
    if (gameState.gamePhase === 'playing' || gameState.gamePhase === 'ended') {
      return this.handleIngameLeave(gameState, lobbyCode, player, playerId, socketId);
    } else {
      return this.handleLobbyLeave(gameState, lobbyCode, player, playerId, socketId);
    }
  }

  private findPlayerGame(playerId: string): { gameState: GameState; lobbyCode: string } | null {
    for (const [code, game] of this.games.entries()) {
      if (game.players.some(p => p.id === playerId)) {
        return { gameState: game, lobbyCode: code };
      }
    }
    return null;
  }

  private async handleIngameLeave(
    gameState: GameState, 
    lobbyCode: string, 
    player: Player, 
    playerId: string, 
    socketId: string
  ): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    const wasHost = player.isHost;
    const wasCurrentPlayer = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
    
    // Convert to AI
    player.isAI = true;
    if (!player.name.endsWith('bot')) {
      player.name += 'bot';
    }
    
    if (wasHost && !this.transferHostRole(gameState, playerId)) {
      return this.deleteGame(gameState, lobbyCode, playerId, socketId);
    }
    
    if (gameState.gamePhase === 'playing' && wasCurrentPlayer) {
      this.clearTurnTimeout(lobbyCode);
      await this.processAITurn(lobbyCode);
    }
    
    return this.finalizePlayerLeave(gameState, lobbyCode, playerId, socketId);
  }

  private async handleLobbyLeave(
    gameState: GameState, 
    lobbyCode: string, 
    player: Player, 
    playerId: string, 
    socketId: string
  ): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    gameState.players.splice(playerIndex, 1);
    
    if (player.isHost && !this.transferHostRole(gameState)) {
      return this.deleteGame(gameState, lobbyCode, playerId, socketId);
    }
    
    return this.finalizePlayerLeave(gameState, lobbyCode, playerId, socketId);
  }

  private async deleteGame(
    gameState: GameState, 
    lobbyCode: string, 
    playerId: string, 
    socketId: string
  ): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    this.games.delete(lobbyCode);
    this.unmapPlayerSocket(playerId, socketId);
    return { gameState: null, lobbyCode };
  }

  private async finalizePlayerLeave(
    gameState: GameState, 
    lobbyCode: string, 
    playerId: string, 
    socketId: string
  ): Promise<{ gameState: GameState | null; lobbyCode: string | null }> {
    this.unmapPlayerSocket(playerId, socketId);
    
    const hasHuman = gameState.players.some(p => !p.isAI);
    if (!hasHuman) {
      return this.deleteGame(gameState, lobbyCode, playerId, socketId);
    }
    
    this.games.set(lobbyCode, gameState);
    return { gameState, lobbyCode };
  }

  // Chat and utility
  async sendMessage(lobbyCode: string, playerId: string, message: string, isSystem: boolean = false): Promise<ChatMessage> {
    const gameState = this.validateGameExists(lobbyCode);
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!isSystem && !player) throw new Error('Player not found');
    
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName: player?.name || 'System',
      message: message.trim(),
      timestamp: Date.now()
    };
    
    gameState.chat.push(chatMessage);
    
    if (gameState.chat.length > MAX_CHAT_MESSAGES) {
      gameState.chat = gameState.chat.slice(-MAX_CHAT_MESSAGES);
    }
    
    this.games.set(lobbyCode, gameState);
    
    return chatMessage;
  }

  async returnToLobby(lobbyCode: string): Promise<GameState> {
    const gameState = this.validateGameExists(lobbyCode);
    
    gameState.gamePhase = 'lobby';
    gameState.currentPlayerIndex = 0;
    gameState.winner = undefined;
    gameState.currentRound = 1;
    
    gameState.players.forEach(p => p.hand = []);
    
    this.games.set(lobbyCode, gameState);
    return gameState;
  }

  getGame(lobbyCode: string): GameState | undefined {
    return this.games.get(lobbyCode);
  }
}
