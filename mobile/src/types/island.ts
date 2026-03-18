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

export interface SpeechCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface SpeechFeedback {
  corrected_text: string;
  well_done: string;
  corrections: SpeechCorrection[];
  vocabulary_for_topic: VocabWord[];
  encouragement: string;
}

export interface CreateIslandRequest {
  audioBlob: string; // base64 encoded audio of English description
  voice?: string;
}

export interface CreateIslandResponse {
  island: Island;
}
