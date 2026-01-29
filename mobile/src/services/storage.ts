import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Island } from '../types/island';

const ISLANDS_FILE = `${FileSystem.documentDirectory}islands.json`;

export const storage = {
  async getAllIslands(): Promise<Island[]> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(ISLANDS_FILE);
      if (!fileInfo.exists) {
        return [];
      }
      const content = await FileSystem.readAsStringAsync(ISLANDS_FILE);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading islands:', error);
      return [];
    }
  },

  async saveIsland(island: Island): Promise<void> {
    const islands = await this.getAllIslands();
    const existingIndex = islands.findIndex(i => i.id === island.id);

    if (existingIndex >= 0) {
      islands[existingIndex] = island;
    } else {
      islands.unshift(island); // Add to beginning
    }

    await FileSystem.writeAsStringAsync(ISLANDS_FILE, JSON.stringify(islands, null, 2));
  },

  async deleteIsland(id: string): Promise<void> {
    const islands = await this.getAllIslands();
    const filtered = islands.filter(i => i.id !== id);
    await FileSystem.writeAsStringAsync(ISLANDS_FILE, JSON.stringify(filtered, null, 2));
  },

  async generateId(): Promise<string> {
    const uuid = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Date.now().toString() + Math.random().toString()
    );
    return uuid.slice(0, 12);
  },

  async searchIslands(query: string): Promise<Island[]> {
    const islands = await this.getAllIslands();
    const lowerQuery = query.toLowerCase();

    return islands.filter(island =>
      island.title.toLowerCase().includes(lowerQuery) ||
      island.description.toLowerCase().includes(lowerQuery) ||
      island.sentences.some(s =>
        s.irish.toLowerCase().includes(lowerQuery) ||
        s.english.toLowerCase().includes(lowerQuery)
      )
    );
  },
};
