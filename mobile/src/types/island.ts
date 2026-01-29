export interface Sentence {
  id: string;
  irish: string;
  english: string;
  audioUrl?: string;
  audioBase64?: string;
}

export interface Island {
  id: string;
  title: string;
  titleIrish?: string;
  description: string; // The original English description
  sentences: Sentence[];
  createdAt: string;
  updatedAt: string;
  voice: 'ga_UL_anb_piper' | 'ga_MU_nnc_piper'; // Ulster or Munster
}

export interface CreateIslandRequest {
  audioBlob: string; // base64 encoded audio of English description
  voice?: string;
}

export interface CreateIslandResponse {
  island: Island;
}
