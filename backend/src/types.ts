export type Suit = 'a' | 'b' | 'c' | 'd';

export interface Card {
  number: number; // 1-10
  suit: Suit;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  score: number;
  hand?: Card[];
  wonCards?: Card[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface GameState {
  id: string;
  lobbyCode: string;
  players: Player[];
  currentPlayerIndex: number;
  gamePhase: 'lobby' | 'playing' | 'ended';
  maxPlayers: number;
  speed: SpeedOption; // type derived from speedOptions in utils.ts
  chat: ChatMessage[];
  winner?: Player;
  currentRound: number;
  deck?: Card[];
  playedCards?: { playerId: string; card: Card }[];
  lastPlayedCards?: { playerId: string; card: Card }[];
  lastCard?: Card;
  lastRoundWinner?: string; // playerId of last round winner
  turnStartTimestamp?: number; // Unix ms timestamp when the current turn started
  turnEndTimestamp?: number; // Unix ms timestamp when the current turn ends
}

export type SpeedOption = 'slower' | 'slow' | 'normal' | 'fast' | 'extreme';

export const speedMap: Record<string, number> = {
  slower: 60000,
  slow: 40000,
  normal: 30000,
  fast: 15000,
  extreme: 5000,
};

export const speedOptions: SpeedOption[] = Object.keys(speedMap) as SpeedOption[];

export interface SocketEvents {
  // Client to Server
  'join-lobby': (data: { lobbyCode: string; playerName: string }) => void;
  'create-lobby': (data: { playerName: string }) => void;
  'start-game': () => void;
  'play-card': (data: { card: Card }) => void;
  'kick-player': (playerId: string) => void;
  'leave-lobby': () => void;
  'send-message': (message: string) => void;
  'change-max-players': (maxPlayers: number) => void;
  'change-speed': (speed: SpeedOption) => void;
  
  // Server to Client
  'lobby-joined': (data: { gameState: GameState; playerUuid: string }) => void;
  'lobby-created': (data: { gameState: GameState; playerUuid: string }) => void;
  'game-updated': (gameState: GameState) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'game-started': (gameState: GameState) => void;
  'game-ended': (gameState: GameState) => void;
  'player-kicked': (playerId: string) => void;
  'message-received': (message: ChatMessage) => void;
  'error': (message: string | { type: string; message: string; remainingMs?: number }) => void;
}

export interface DBGame {
  id: string;
  lobby_code: string;
  game_state: string;
  created_at: string;
  updated_at: string;
}

export interface DBPlayer {
  id: string;
  game_id: string;
  name: string;
  is_host: boolean;
  is_connected: boolean;
  is_ai: boolean;
  score: number;
  last_roll: number | null;
  join_order: number;
}

export interface DBChatMessage {
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  message: string;
  timestamp: number;
}
