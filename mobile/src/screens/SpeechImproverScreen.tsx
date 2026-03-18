import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { SpeechFeedback } from '../types/island';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SpeechImprover'>;
};

type Dialect = 'ulster' | 'connacht' | 'munster';

interface Attempt {
  id: number;
  transcription: string;
  feedback: SpeechFeedback;
}

const DIALECT_LABELS: Record<Dialect, string> = {
  ulster: 'Ultach',
  connacht: 'Connachtach',
  munster: 'Muimhneach',
};

export function SpeechImproverScreen({ navigation }: Props) {
  const [topic, setTopic] = useState('');
  const [dialect, setDialect] = useState<Dialect>('connacht');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [topicLocked, setTopicLocked] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const startRecording = async () => {
    if (!topic.trim()) {
      Alert.alert('Ábhar ag teastáil', 'Clóscríobh ábhar cainte ar dtús.');
      return;
    }

    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Cead ag teastáil', 'Tá cead micreafón ag teastáil chun fuaim a thaifeadadh.');
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setTopicLocked(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir taifeadadh a thosú');
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);
    setProcessingStage('Ag aithint cainte...');

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No recording URI');
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Transcribe with Abair
      console.log('[SpeechImprover] Transcribing with Abair...');
      const asrResult = await api.transcribeIrishAbair(audioBase64);
      const transcription = asrResult.transcription;

      console.log('[SpeechImprover] Transcription:', transcription);

      if (!transcription || transcription.trim().length === 0) {
        Alert.alert(
          'Gan aithint',
          'Níorbh fhéidir do chuid cainte a aithint. Bain triail eile as — labhair go soiléir agus ní róthapa.'
        );
        setIsProcessing(false);
        setProcessingStage('');
        return;
      }

      // Get GPT feedback
      setProcessingStage('Ag ullmhú aiseolais...');
      console.log('[SpeechImprover] Getting feedback...');
      const feedback = await api.improveSpeech(transcription, topic, dialect);

      const newAttempt: Attempt = {
        id: Date.now(),
        transcription,
        feedback,
      };

      setAttempts(prev => [...prev, newAttempt]);

      // Scroll to bottom after state update
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[SpeechImprover] Error:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an taifeadadh a phróiseáil. Bain triail eile as.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const resetTopic = () => {
    setTopicLocked(false);
    setAttempts([]);
    setTopic('');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Topic & dialect selector */}
        <View style={styles.setupSection}>
          <Text style={styles.label}>Ábhar cainte</Text>
          <View style={styles.topicRow}>
            <TextInput
              style={[styles.topicInput, topicLocked && styles.topicInputLocked]}
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g. an aeráid, mo phost, spórt..."
              placeholderTextColor="#aaa"
              editable={!topicLocked}
              returnKeyType="done"
            />
            {topicLocked && (
              <TouchableOpacity style={styles.resetTopicButton} onPress={resetTopic}>
                <Ionicons name="refresh-outline" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Canúint</Text>
          <View style={styles.dialectRow}>
            {(['ulster', 'connacht', 'munster'] as Dialect[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dialectButton, dialect === d && styles.dialectButtonActive]}
                onPress={() => setDialect(d)}
                disabled={topicLocked}
              >
                <Text style={[styles.dialectButtonText, dialect === d && styles.dialectButtonTextActive]}>
                  {DIALECT_LABELS[d]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Attempts */}
        {attempts.map((attempt, index) => (
          <View key={attempt.id} style={styles.attemptCard}>
            <Text style={styles.attemptHeader}>Iarracht {index + 1}</Text>

            {/* Transcription */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="mic-outline" size={16} color="#555" />
                <Text style={styles.sectionTitle}>A dúirt tú</Text>
              </View>
              <Text style={styles.transcriptionText}>{attempt.transcription}</Text>
            </View>

            {/* Corrected version (only show if different) */}
            {attempt.feedback.corrected_text &&
              attempt.feedback.corrected_text.trim() !== attempt.transcription.trim() && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#1a5f2a" />
                  <Text style={styles.sectionTitle}>Leagan ceartaithe</Text>
                </View>
                <Text style={styles.correctedText}>{attempt.feedback.corrected_text}</Text>
              </View>
            )}

            {/* Well done */}
            {attempt.feedback.well_done && (
              <View style={styles.wellDoneBox}>
                <Text style={styles.wellDoneText}>👍 {attempt.feedback.well_done}</Text>
              </View>
            )}

            {/* Corrections */}
            {attempt.feedback.corrections && attempt.feedback.corrections.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="build-outline" size={16} color="#555" />
                  <Text style={styles.sectionTitle}>Moltaí feabhsúcháin</Text>
                </View>
                {attempt.feedback.corrections.map((correction, i) => (
                  <View key={i} style={styles.correctionItem}>
                    <Text style={styles.correctionOriginal}>"{correction.original}"</Text>
                    <Text style={styles.correctionArrow}>→ <Text style={styles.correctionFixed}>{correction.corrected}</Text></Text>
                    <Text style={styles.correctionExplanation}>{correction.explanation}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Vocabulary */}
            {attempt.feedback.vocabulary_for_topic && attempt.feedback.vocabulary_for_topic.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="book-outline" size={16} color="#555" />
                  <Text style={styles.sectionTitle}>Focail úsáideacha</Text>
                </View>
                {attempt.feedback.vocabulary_for_topic.map((word, i) => (
                  <View key={i} style={styles.vocabItem}>
                    <Text style={styles.vocabIrish}>{word.irish}</Text>
                    <Text style={styles.vocabEnglish}> – {word.english}</Text>
                    {word.example ? (
                      <Text style={styles.vocabExample}>{word.example}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Encouragement */}
            {attempt.feedback.encouragement && (
              <View style={styles.encouragementBox}>
                <Text style={styles.encouragementText}>{attempt.feedback.encouragement}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Processing state */}
        {isProcessing && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#1a5f2a" />
            <Text style={styles.processingText}>{processingStage}</Text>
          </View>
        )}

        {/* Spacing at bottom for controls */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Record controls */}
      <View style={styles.controls}>
        {attempts.length > 0 && !isProcessing && (
          <Text style={styles.tryAgainHint}>
            Bain triail eile as — labhair arís faoin ábhar céanna
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            isProcessing && styles.recordButtonDisabled,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={40}
              color="#fff"
            />
          )}
        </TouchableOpacity>
        <Text style={styles.statusText}>
          {isProcessing
            ? processingStage
            : isRecording
            ? 'Brúigh chun stopadh'
            : attempts.length === 0
            ? 'Brúigh chun tosú'
            : 'Arís?'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  setupSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  topicInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  topicInputLocked: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  resetTopicButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  dialectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dialectButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  dialectButtonActive: {
    backgroundColor: '#1a5f2a',
    borderColor: '#1a5f2a',
  },
  dialectButtonText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  dialectButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  attemptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  attemptHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a5f2a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  correctedText: {
    fontSize: 16,
    color: '#1a5f2a',
    lineHeight: 24,
    fontWeight: '500',
  },
  wellDoneBox: {
    backgroundColor: '#f0f7f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#1a5f2a',
  },
  wellDoneText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  correctionItem: {
    backgroundColor: '#fef9f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e6a817',
  },
  correctionOriginal: {
    fontSize: 14,
    color: '#c0392b',
    marginBottom: 2,
  },
  correctionArrow: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  correctionFixed: {
    color: '#1a5f2a',
    fontWeight: '600',
  },
  correctionExplanation: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  vocabItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vocabIrish: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a5f2a',
  },
  vocabEnglish: {
    fontSize: 14,
    color: '#555',
  },
  vocabExample: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
  encouragementBox: {
    backgroundColor: '#1a5f2a',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  encouragementText: {
    fontSize: 15,
    color: '#fff',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  processingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  processingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
  },
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
  tryAgainHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
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
  recordButtonActive: {
    backgroundColor: '#c62828',
  },
  recordButtonDisabled: {
    backgroundColor: '#999',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});
