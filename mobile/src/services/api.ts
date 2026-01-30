import { Island, Sentence, VocabWord } from '../types/island';
import { CONFIG } from '../config';

// Use CONFIG.API_BASE - edit src/config.ts to change URLs
const API_BASE = CONFIG.API_BASE;

export const api = {
  // Create a new island from English audio description
  async createIsland(audioBase64: string, voice: string = 'ga_UL_anb_piper'): Promise<Island> {
    const response = await fetch(`${API_BASE}/api/islands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_blob: audioBase64,
        voice: voice,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create island: ${error}`);
    }

    return response.json();
  },

  // Get TTS audio for a sentence
  async getSentenceAudio(text: string, voice: string = 'ga_UL_anb_piper'): Promise<string> {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice: voice,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get audio');
    }

    const data = await response.json();
    return data.audioContent; // base64 encoded audio
  },

  // Transcribe Irish audio (for future practice mode)
  async transcribeIrish(audioBase64: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/asr/irish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_blob: audioBase64,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to transcribe');
    }

    const data = await response.json();
    return data.transcription;
  },

  // Transcribe English audio (for expansion refinements)
  async transcribeEnglish(audioBase64: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/asr/english`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_blob: audioBase64,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to transcribe English');
    }

    const data = await response.json();
    return data.transcription;
  },

  // Expand an existing island with more sentences
  async expandIsland(island: Island, refinement: string): Promise<Sentence[]> {
    const response = await fetch(`${API_BASE}/api/islands/${island.id}/expand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        island: island,
        refinement: refinement,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to expand island: ${error}`);
    }

    const data = await response.json();
    return data.sentences;
  },

  // Generate vocabulary for an island
  async generateVocabulary(island: Island): Promise<VocabWord[]> {
    const response = await fetch(`${API_BASE}/api/islands/${island.id}/vocabulary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        island: island,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate vocabulary: ${error}`);
    }

    const data = await response.json();
    return data.vocabulary;
  },
};

export const setApiBase = (url: string) => {
  // For dynamic configuration if needed
  console.log('API Base would be set to:', url);
};
