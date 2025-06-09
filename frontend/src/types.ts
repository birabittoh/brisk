export type Suit = 'a' | 'b' | 'c' | 'd';

export interface Style {
  name: string;
  width: number;
  height: number;
}

export interface Card {
  number: number;
  suit: Suit;
}

export interface CardImage {
  src: string;
  card: Card;
  style: Style;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  score: number;
  hand?: Card[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface GameState {
  turnStartTimestamp?: number;
  turnEndTimestamp?: number;
  id: string;
  lobbyCode: string;
  players: Player[];
  currentPlayerIndex: number;
  gamePhase: 'lobby' | 'playing' | 'ended';
  maxPlayers: number;
  pointsToWin: number;
  chat: ChatMessage[];
  winner?: Player;
  currentRound: number;
  deck?: Card[];
  playedCards?: { playerId: string; card: Card }[];
  lastPlayedCards?: { playerId: string; card: Card }[];
  lastCard?: Card;
  lastRoundWinner?: string;
}

export interface LobbyCreatedPayload {
  gameState: GameState;
  playerUuid: string;
}

export interface SocketEvents {
  // Client to Server
  'join-lobby': (data: { lobbyCode: string; playerName: string }) => void;
  'create-lobby': (data: { playerName: string }) => void;
  'start-game': () => void;
  'play-card': (data: { card: Card }) => void;
  'kick-player': (playerId: string) => void;
  'leave-lobby': () => void;
  'send-message': (message: string) => void;
  
  // Server to Client
  'lobby-joined': (payload: LobbyCreatedPayload) => void;
  'lobby-created': (payload: LobbyCreatedPayload) => void;
  'game-updated': (gameState: GameState) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'game-started': (gameState: GameState) => void;
  'game-ended': (gameState: GameState) => void;
  'player-kicked': (playerId: string) => void;
  'message-received': (message: ChatMessage) => void;
  'error': (message: string) => void;
}
