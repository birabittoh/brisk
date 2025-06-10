import { GameState, ChatMessage } from './types';
import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 1 day

export class Database {
  private keyv: Keyv;

  constructor(dbPath: string = './brisk.db') {
    this.keyv = new Keyv(new KeyvSqlite('sqlite://' + dbPath));
  }

  async saveGame(gameState: GameState): Promise<void> {
    await this.keyv.set(`game:${gameState.lobbyCode}`, gameState, DEFAULT_TTL_MS);
  }

  async loadGame(lobbyCode: string): Promise<GameState | undefined> {
    const gameState = await this.keyv.get(`game:${lobbyCode}`);
    if (!gameState) {
      return undefined;
    }
    // Load chat messages for this game
    const chat: ChatMessage[] = (await this.keyv.get(`chat:${gameState.id}`)) || [];
    return {
      ...gameState,
      chat,
    };
  }

  async saveChatMessage(message: ChatMessage, gameId: string): Promise<void> {
    const chatKey = `chat:${gameId}`;
    const chat: ChatMessage[] = (await this.keyv.get(chatKey)) || [];
    chat.push(message);
    await this.keyv.set(chatKey, chat, DEFAULT_TTL_MS);
  }

  async deleteGame(gameId: string, lobbyCode?: string): Promise<void> {
    // Remove game and chat data
    if (lobbyCode) {
      await this.keyv.delete(`game:${lobbyCode}`);
    }
    await this.keyv.delete(`chat:${gameId}`);
  }

  async loadAllGames(): Promise<GameState[]> {
    const games: GameState[] = [];
    const iterator = typeof this.keyv.iterator === 'function' ? this.keyv.iterator(undefined) : [];
    for await (const [key, value] of iterator) {
      if (key.startsWith('game:')) {
        const gameState = value as GameState;
        // Load chat messages for each game
        const chat: ChatMessage[] = (await this.keyv.get(`chat:${gameState.id}`)) || [];
        games.push({
          ...gameState,
          chat,
        });
      }
    }
    return games;
  }
}
