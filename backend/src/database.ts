import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { GameState, Player, ChatMessage, DBGame, DBPlayer, DBChatMessage } from './types';

export class Database {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(dbPath: string = './brisk.db') {
    this.db = new sqlite3.Database(dbPath);
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.initTables();
  }

  private async initTables(): Promise<void> {
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        lobby_code TEXT UNIQUE NOT NULL,
        game_state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_host BOOLEAN DEFAULT FALSE,
        is_connected BOOLEAN DEFAULT TRUE,
        is_ai BOOLEAN DEFAULT FALSE,
        score INTEGER DEFAULT 0,
        last_roll INTEGER,
        join_order INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
      )
    `);

    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await this.dbRun(`CREATE INDEX IF NOT EXISTS idx_players_game_id ON players (game_id)`);
    await this.dbRun(`CREATE INDEX IF NOT EXISTS idx_chat_game_id ON chat_messages (game_id)`);
  }

  async saveGame(gameState: GameState): Promise<void> {
    const gameData = JSON.stringify({
      currentPlayerIndex: gameState.currentPlayerIndex,
      gamePhase: gameState.gamePhase,
      maxPlayers: gameState.maxPlayers,
      pointsToWin: gameState.pointsToWin,
      winner: gameState.winner,
      currentRound: gameState.currentRound
    });

    await this.dbRun(`
      INSERT OR REPLACE INTO games (id, lobby_code, game_state, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [gameState.id, gameState.lobbyCode, gameData]);

    // Clear existing players for this game
    await this.dbRun(`DELETE FROM players WHERE game_id = ?`, [gameState.id]);

    // Insert current players
    for (let i = 0; i < gameState.players.length; i++) {
      const player = gameState.players[i];
      await this.dbRun(`
        INSERT INTO players (id, game_id, name, is_host, is_connected, is_ai, score, last_roll, join_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        player.id,
        gameState.id,
        player.name,
        player.isHost,
        player.isConnected,
        player.isAI,
        player.score,
        player.lastRoll || null,
        i
      ]);
    }
  }

  async loadGame(lobbyCode: string): Promise<GameState | null> {
    const gameRow: DBGame = await this.dbGet(`
      SELECT * FROM games WHERE lobby_code = ?
    `, [lobbyCode]);

    if (!gameRow) {
      return null;
    }

    const playerRows: DBPlayer[] = await this.dbAll(`
      SELECT * FROM players WHERE game_id = ? ORDER BY join_order
    `, [gameRow.id]);

    const chatRows: DBChatMessage[] = await this.dbAll(`
      SELECT * FROM chat_messages WHERE game_id = ? ORDER BY timestamp
    `, [gameRow.id]);

    const gameData = JSON.parse(gameRow.game_state);
    
    const players: Player[] = playerRows.map(row => ({
      id: row.id,
      name: row.name,
      isHost: row.is_host,
      isConnected: row.is_connected,
      isAI: row.is_ai,
      score: row.score,
      lastRoll: row.last_roll || undefined
    }));

    const chat: ChatMessage[] = chatRows.map(row => ({
      id: row.id,
      playerId: row.player_id,
      playerName: row.player_name,
      message: row.message,
      timestamp: row.timestamp
    }));

    return {
      id: gameRow.id,
      lobbyCode: gameRow.lobby_code,
      players,
      chat,
      currentPlayerIndex: gameData.currentPlayerIndex,
      gamePhase: gameData.gamePhase,
      maxPlayers: gameData.maxPlayers,
      pointsToWin: gameData.pointsToWin,
      winner: gameData.winner,
      currentRound: gameData.currentRound
    };
  }

  async saveChatMessage(message: ChatMessage, gameId: string): Promise<void> {
    await this.dbRun(`
      INSERT INTO chat_messages (id, game_id, player_id, player_name, message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [message.id, gameId, message.playerId, message.playerName, message.message, message.timestamp]);
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.dbRun(`DELETE FROM games WHERE id = ?`, [gameId]);
  }

  async cleanup(): Promise<void> {
    // Clean up games older than 24 hours with no connected players
    await this.dbRun(`
      DELETE FROM games 
      WHERE id IN (
        SELECT g.id FROM games g
        LEFT JOIN players p ON g.id = p.game_id AND p.is_connected = 1
        WHERE g.created_at < datetime('now', '-1 day')
        GROUP BY g.id
        HAVING COUNT(p.id) = 0
      )
    `);
  }

  close(): void {
    this.db.close();
  }
}
