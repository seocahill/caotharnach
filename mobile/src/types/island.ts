export interface Sentence {
  id: string;
  irish: string;
  english: string;
  audioUrl?: string;
  audioBase64?: string;
}

export interface VocabWord {
  irish: string;
  english: string;
  example: string; // Example usage from the sentences
}

export interface Island {
  id: string;
  title: string;
  titleIrish?: string;
  description: string; // The original English description
  sentences: Sentence[];
  vocabulary?: VocabWord[]; // Generated vocabulary list
  createdAt: string;
  updatedAt: string;
  voice: 'ga_UL_anb_piper' | 'ga_MU_nnc_piper'; // Ulster or Munster
}

export interface BearlaghasItem {
  said: string;        // the phrase used (direct translation / calque)
  suggestion: string;  // idiomatic Irish alternative
  explanation: string; // why it sounds unnatural
}

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanation: string; // e.g. "genitive case required after 'ag'"
}

export interface SpeechFeedback {
  well_done: string;
  bearlaghas: BearlaghasItem[];
  grammar_corrections: GrammarCorrection[];
  missing_vocabulary: VocabWord[];
  encouragement: string;
}

export interface AbairtSpeaker {
  id: number;
  name: string;
  dialect: string;
}

export interface AbairtVoiceRecording {
  id: number;
  title: string;
  external_id: string;
}

export interface AbairtEntry {
  id: number;
  word_or_phrase: string;
  translation: string;
  region_id: number;
  region_start: number;
  region_end: number;
  updated_at: string;
  audio_url: string;
  speaker: AbairtSpeaker;
  voice_recording: AbairtVoiceRecording;
}

export interface CreateIslandRequest {
  audioBlob: string; // base64 encoded audio of English description
  voice?: string;
}

export interface CreateIslandResponse {
  island: Island;
}
