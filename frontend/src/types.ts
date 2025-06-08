export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  isAI: boolean;
  score: number;
  lastRoll?: number;
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
  pointsToWin: number;
  chat: ChatMessage[];
  winner?: Player;
  currentRound: number;
}

export interface SocketEvents {
    "next-round": () => void;
  // Client to Server
  'join-lobby': (data: { lobbyCode: string; playerName: string }) => void;
  'create-lobby': (data: { playerName: string }) => void;
  'start-game': () => void;
  'roll-dice': () => void;
  'kick-player': (playerId: string) => void;
  'leave-lobby': () => void;
  'send-message': (message: string) => void;
  
  // Server to Client
  'lobby-joined': (gameState: GameState) => void;
  'lobby-created': (gameState: GameState) => void;
  'game-updated': (gameState: GameState) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'game-started': (gameState: GameState) => void;
  'dice-rolled': (data: { playerId: string; roll: number }) => void;
  'game-ended': (gameState: GameState) => void;
  'player-kicked': (playerId: string) => void;
  'message-received': (message: ChatMessage) => void;
  'error': (message: string) => void;
}
