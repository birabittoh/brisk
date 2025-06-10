import { GameState, ChatMessage } from './types';
import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';

export class Database {
  private keyv: Keyv;

  constructor(dbPath: string = './brisk.db') {
    this.keyv = new Keyv(new KeyvSqlite('sqlite://' + dbPath));
  }

  async saveGame(gameState: GameState): Promise<void> {
    await this.keyv.set(`game:${gameState.lobbyCode}`, gameState);
  }

  async loadGame(lobbyCode: string): Promise<GameState | null> {
    const gameState = await this.keyv.get(`game:${lobbyCode}`);
    if (!gameState) {
      return null;
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
    await this.keyv.set(chatKey, chat);
  }

  async deleteGame(gameId: string, lobbyCode?: string): Promise<void> {
    // Remove game and chat data
    if (lobbyCode) {
      await this.keyv.delete(`game:${lobbyCode}`);
    }
    await this.keyv.delete(`chat:${gameId}`);
  }
}
