import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  AudioModule,
  RecordingPresets,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { SpeechFeedback } from '../types/island';
import { CONFIG } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeechImprover'>;

type Dialect = 'ulster' | 'connacht' | 'mayo' | 'munster';

interface Attempt {
  id: number;
  transcription: string;
  feedback: SpeechFeedback;
  audioUri?: string;
}

const DIALECT_LABELS: Record<Dialect, string> = {
  ulster: 'Ultach',
  connacht: 'Connachtach',
  mayo: 'Maigh Eo',
  munster: 'Muimhneach',
};

export function SpeechImproverScreen({ navigation, route }: Props) {
  const sourceIsland = route.params?.island;

  // Context (English description of what to practise)
  const [contextChunks, setContextChunks] = useState<string[]>(
    () => sourceIsland ? [sourceIsland.description] : []
  );
  const [isRecordingContext, setIsRecordingContext] = useState(false);
  const [isProcessingContext, setIsProcessingContext] = useState(false);

  // Irish practice
  const [dialect, setDialect] = useState<Dialect>('connacht');
  const [isRecordingIrish, setIsRecordingIrish] = useState(false);
  const [isProcessingIrish, setIsProcessingIrish] = useState(false);
  const [processingStage, setProcessingStage] = useState('');

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Both recorders use HIGH_QUALITY (m4a/AAC works fine for both Whisper and Abair)
  const contextRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const contextRecorderState = useAudioRecorderState(contextRecorder);
  const irishRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const irishRecorderState = useAudioRecorderState(irishRecorder);

  const fullContext = contextChunks.join('\n\n');
  const hasContext = contextChunks.length > 0;

  // ── Context recording (English → Whisper) ──────────────────────────────

  const startContextRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Cead ag teastáil', 'Tá cead micreafón ag teastáil.');
        return;
      }
      await contextRecorder.prepareToRecordAsync();
      contextRecorder.record();
      setIsRecordingContext(true);
    } catch (error) {
      console.error('Context recording start failed:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir taifeadadh a thosú.');
    }
  };

  const stopContextRecording = async () => {
    if (!contextRecorderState.isRecording) return;
    setIsRecordingContext(false);
    setIsProcessingContext(true);

    try {
      await contextRecorder.stop();
      const uri = contextRecorder.uri;
      if (!uri) throw new Error('No recording URI');

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Transcribe English with Whisper via existing endpoint
      const response = await fetch(`${CONFIG.API_BASE}/api/asr/english`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': CONFIG.API_KEY },
        body: JSON.stringify({ audio_blob: audioBase64 }),
      });

      if (!response.ok) throw new Error('English transcription failed');
      const data = await response.json();

      if (data.transcription?.trim()) {
        setContextChunks(prev => [...prev, data.transcription.trim()]);
      }
    } catch (error) {
      console.error('Context transcription failed:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an cur síos a thras-scríobh.');
    } finally {
      setIsProcessingContext(false);
    }
  };

  const removeContextChunk = (index: number) => {
    setContextChunks(prev => prev.filter((_, i) => i !== index));
    if (contextChunks.length <= 1) setAttempts([]);
  };

  // ── Irish practice recording (WebM/Opus → Abair) ───────────────────────

  const startIrishRecording = async () => {
    if (!hasContext) {
      Alert.alert('Cur síos ag teastáil', 'Déan cur síos i mBéarla ar dtús ar an ábhar.');
      return;
    }
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Cead ag teastáil', 'Tá cead micreafón ag teastáil.');
        return;
      }
      await irishRecorder.prepareToRecordAsync();
      irishRecorder.record();
      setIsRecordingIrish(true);
    } catch (error) {
      console.error('Irish recording start failed:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir taifeadadh a thosú.');
    }
  };

  const stopIrishRecording = async () => {
    if (!irishRecorderState.isRecording) return;
    setIsRecordingIrish(false);
    setIsProcessingIrish(true);
    setProcessingStage('Ag aithint cainte...');

    try {
      await irishRecorder.stop();
      const uri = irishRecorder.uri;
      if (!uri) throw new Error('No recording URI');

      // Save a copy for playback before reading as base64
      const attemptId = Date.now();
      const savedUri = `${FileSystem.cacheDirectory}speech_attempt_${attemptId}.m4a`;
      await FileSystem.copyAsync({ from: uri, to: savedUri });

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Transcribe Irish with Abair
      const asrResult = await api.transcribeIrishAbair(audioBase64);
      const transcription = asrResult.transcription;

      if (!transcription?.trim()) {
        await FileSystem.deleteAsync(savedUri, { idempotent: true });
        Alert.alert(
          'Gan aithint',
          'Níorbh fhéidir do chuid cainte a aithint. Labhair go soiléir, ní róthapa.'
        );
        return;
      }

      // Get GPT feedback
      setProcessingStage('Ag ullmhú aiseolais...');
      const feedback = await api.improveSpeech(transcription, fullContext, dialect);

      setAttempts(prev => [...prev, { id: attemptId, transcription, feedback, audioUri: savedUri }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('[SpeechImprover] Irish practice failed:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an taifeadadh a phróiseáil.');
    } finally {
      setIsProcessingIrish(false);
      setProcessingStage('');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  const anyActive = isRecordingContext || isProcessingContext || isRecordingIrish || isProcessingIrish;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Island source banner ── */}
        {sourceIsland && (
          <View style={styles.islandSourceCard}>
            <View style={styles.islandSourceHeader}>
              <Ionicons name="leaf-outline" size={16} color="#1a5f2a" />
              <Text style={styles.islandSourceLabel}>Oileán</Text>
            </View>
            <Text style={styles.islandSourceTitle}>{sourceIsland.title}</Text>
            {sourceIsland.titleIrish && (
              <Text style={styles.islandSourceTitleIrish}>{sourceIsland.titleIrish}</Text>
            )}
          </View>
        )}

        {/* ── Context section ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comhthéacs</Text>
          <Text style={styles.cardSubtitle}>
            {sourceIsland
              ? 'Cur síos an oileáin atá in úsáid mar chomhthéacs. Is féidir leat tuilleadh a chur leis.'
              : 'Inis i mBéarla cad é an ábhar, an téama nó an fócas atá agat — chomh mionsonraithe agus is féidir.'}
          </Text>

          {contextChunks.map((chunk, i) => (
            <View key={i} style={styles.contextChunk}>
              <Text style={styles.contextChunkText}>{chunk}</Text>
              <TouchableOpacity onPress={() => removeContextChunk(i)} style={styles.removeChunkButton}>
                <Ionicons name="close-circle-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.contextRecordButton,
              isRecordingContext && styles.contextRecordButtonActive,
              isProcessingContext && styles.contextRecordButtonDisabled,
            ]}
            onPress={isRecordingContext ? stopContextRecording : startContextRecording}
            disabled={isProcessingContext || isRecordingIrish || isProcessingIrish}
          >
            {isProcessingContext ? (
              <ActivityIndicator size="small" color="#1a5f2a" />
            ) : (
              <Ionicons
                name={isRecordingContext ? 'stop-circle-outline' : (hasContext ? 'add-circle-outline' : 'mic-outline')}
                size={20}
                color={isRecordingContext ? '#c62828' : '#1a5f2a'}
              />
            )}
            <Text style={[styles.contextRecordLabel, isRecordingContext && { color: '#c62828' }]}>
              {isProcessingContext
                ? 'Ag traschríobh...'
                : isRecordingContext
                ? 'Stop'
                : hasContext
                ? 'Cuir leis'
                : 'Tosaigh ag caint'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Dialect selector ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Canúint</Text>
          <View style={styles.dialectRow}>
            {(Object.keys(DIALECT_LABELS) as Dialect[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dialectButton, dialect === d && styles.dialectButtonActive]}
                onPress={() => setDialect(d)}
              >
                <Text style={[styles.dialectButtonText, dialect === d && styles.dialectButtonTextActive]}>
                  {DIALECT_LABELS[d]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Attempt cards ── */}
        {attempts.map((attempt, index) => (
          <AttemptCard key={attempt.id} attempt={attempt} index={index} />
        ))}

        {/* ── Processing indicator ── */}
        {isProcessingIrish && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#1a5f2a" />
            <Text style={styles.processingText}>{processingStage}</Text>
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── Irish practice record button ── */}
      <View style={styles.controls}>
        {hasContext && !anyActive && attempts.length > 0 && (
          <Text style={styles.tryAgainHint}>Bain triail eile as nó cuir leis an gcomhthéacs thuas</Text>
        )}
        {!hasContext && (
          <Text style={styles.tryAgainHint}>Déan cur síos ar an ábhar thuas ar dtús</Text>
        )}
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecordingIrish && styles.recordButtonActive,
            (!hasContext || isProcessingIrish || isRecordingContext || isProcessingContext) && styles.recordButtonDisabled,
          ]}
          onPress={isRecordingIrish ? stopIrishRecording : startIrishRecording}
          disabled={!hasContext || isProcessingIrish || isRecordingContext || isProcessingContext}
        >
          {isProcessingIrish ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons name={isRecordingIrish ? 'stop' : 'mic'} size={40} color="#fff" />
          )}
        </TouchableOpacity>
        <Text style={styles.statusText}>
          {isProcessingIrish
            ? processingStage
            : isRecordingIrish
            ? 'Brúigh chun stopadh'
            : 'Labhair as Gaeilge'}
        </Text>
      </View>
    </View>
  );
}

// ── Attempt card component ─────────────────────────────────────────────────

function AttemptCard({ attempt, index }: { attempt: Attempt; index: number }) {
  const { feedback } = attempt;
  const hasBearlaghas = feedback.bearlaghas?.length > 0;
  const hasGrammar = feedback.grammar_corrections?.length > 0;
  const hasMissingVocab = feedback.missing_vocabulary?.length > 0;

  const audioPlayer = useAudioPlayer();
  const [isPlaying, setIsPlaying] = useState(false);

  React.useEffect(() => {
    if (isPlaying && !audioPlayer.playing) {
      setIsPlaying(false);
    }
  }, [audioPlayer.playing, isPlaying]);

  const togglePlayback = () => {
    if (!attempt.audioUri) return;
    if (isPlaying) {
      audioPlayer.pause();
      setIsPlaying(false);
    } else {
      audioPlayer.replace({ uri: attempt.audioUri });
      audioPlayer.play();
      setIsPlaying(true);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.attemptHeader}>Iarracht {index + 1}</Text>

      {/* Transcription */}
      <View style={styles.section}>
        <View style={styles.transcriptionRow}>
          <SectionHeading icon="mic-outline" label="A dúirt tú" />
          {attempt.audioUri && (
            <TouchableOpacity style={styles.playbackButton} onPress={togglePlayback}>
              <Ionicons
                name={isPlaying ? 'stop-circle-outline' : 'play-circle-outline'}
                size={24}
                color={isPlaying ? '#c62828' : '#1a5f2a'}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.transcriptionText}>{attempt.transcription}</Text>
      </View>

      {/* Well done */}
      {feedback.well_done ? (
        <View style={styles.wellDoneBox}>
          <Text style={styles.wellDoneText}>👍  {feedback.well_done}</Text>
        </View>
      ) : null}

      {/* Béarlachas */}
      {hasBearlaghas && (
        <View style={styles.section}>
          <SectionHeading icon="swap-horizontal-outline" label="Béarlachas" />
          {feedback.bearlaghas.map((item, i) => (
            <View key={i} style={[styles.feedbackItem, styles.bearlaghasItem]}>
              <Text style={styles.feedbackOriginal}>"{item.said}"</Text>
              <Text style={styles.feedbackArrow}>
                → <Text style={styles.feedbackSuggestion}>{item.suggestion}</Text>
              </Text>
              {item.explanation ? (
                <Text style={styles.feedbackExplanation}>{item.explanation}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Grammar */}
      {hasGrammar && (
        <View style={styles.section}>
          <SectionHeading icon="build-outline" label="Gramadach" />
          {feedback.grammar_corrections.map((item, i) => (
            <View key={i} style={[styles.feedbackItem, styles.grammarItem]}>
              <Text style={styles.feedbackOriginal}>"{item.original}"</Text>
              <Text style={styles.feedbackArrow}>
                → <Text style={styles.feedbackSuggestion}>{item.corrected}</Text>
              </Text>
              {item.explanation ? (
                <Text style={styles.feedbackExplanation}>{item.explanation}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Missing vocabulary */}
      {hasMissingVocab && (
        <View style={styles.section}>
          <SectionHeading icon="book-outline" label="Focail don ábhar" />
          {feedback.missing_vocabulary.map((word, i) => (
            <View key={i} style={styles.vocabItem}>
              <Text style={styles.vocabIrish}>{word.irish}</Text>
              <Text style={styles.vocabEnglish}> – {word.english}</Text>
              {word.example ? <Text style={styles.vocabExample}>{word.example}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Encouragement */}
      {feedback.encouragement ? (
        <View style={styles.encouragementBox}>
          <Text style={styles.encouragementText}>{feedback.encouragement}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SectionHeading({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon as any} size={15} color="#555" />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
    marginBottom: 12,
  },

  // Island source banner
  islandSourceCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  islandSourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  islandSourceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a5f2a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  islandSourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a5f2a',
  },
  islandSourceTitleIrish: {
    fontSize: 14,
    color: '#2e7d32',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Transcription row (with playback button)
  transcriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playbackButton: {
    padding: 4,
  },

  // Context chunks
  contextChunk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f7f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  contextChunkText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  removeChunkButton: { paddingLeft: 8 },

  contextRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a5f2a',
    marginTop: 4,
  },
  contextRecordButtonActive: { borderColor: '#c62828', backgroundColor: '#fff5f5' },
  contextRecordButtonDisabled: { borderColor: '#ccc' },
  contextRecordLabel: { fontSize: 14, color: '#1a5f2a', fontWeight: '500' },

  // Dialect
  dialectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dialectButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  dialectButtonActive: { backgroundColor: '#1a5f2a', borderColor: '#1a5f2a' },
  dialectButtonText: { fontSize: 13, color: '#555', fontWeight: '500' },
  dialectButtonTextActive: { color: '#fff', fontWeight: '600' },

  // Attempt
  attemptHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a5f2a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  section: { marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#555' },

  transcriptionText: { fontSize: 16, color: '#333', lineHeight: 24, fontStyle: 'italic' },

  wellDoneBox: {
    backgroundColor: '#f0f7f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#1a5f2a',
  },
  wellDoneText: { fontSize: 14, color: '#333', lineHeight: 20 },

  feedbackItem: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  bearlaghasItem: { backgroundColor: '#fef3e2', borderLeftColor: '#e6a817' },
  grammarItem: { backgroundColor: '#fef1f0', borderLeftColor: '#c0392b' },

  feedbackOriginal: { fontSize: 14, color: '#666', marginBottom: 2 },
  feedbackArrow: { fontSize: 14, color: '#555', marginBottom: 2 },
  feedbackSuggestion: { color: '#1a5f2a', fontWeight: '600' },
  feedbackExplanation: { fontSize: 13, color: '#888', lineHeight: 18, marginTop: 2 },

  vocabItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  vocabIrish: { fontSize: 15, fontWeight: '600', color: '#1a5f2a' },
  vocabEnglish: { fontSize: 14, color: '#555' },
  vocabExample: { fontSize: 13, color: '#888', fontStyle: 'italic', marginTop: 2 },

  encouragementBox: {
    backgroundColor: '#1a5f2a',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  encouragementText: { fontSize: 15, color: '#fff', fontStyle: 'italic', textAlign: 'center' },

  processingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  processingText: { marginTop: 12, fontSize: 15, color: '#555' },

  // Bottom controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 20,
    alignItems: 'center',
  },
  tryAgainHint: { fontSize: 13, color: '#888', marginBottom: 10, textAlign: 'center' },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a5f2a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  recordButtonActive: { backgroundColor: '#c62828' },
  recordButtonDisabled: { backgroundColor: '#bbb' },
  statusText: { marginTop: 8, fontSize: 14, color: '#666' },
});
