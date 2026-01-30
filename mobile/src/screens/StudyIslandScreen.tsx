import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useAudioPlayer, AudioSource, useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../../App';
import { Sentence, Island, VocabWord } from '../types/island';
import { api } from '../services/api';
import { storage } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'StudyIsland'>;

export function StudyIslandScreen({ route, navigation }: Props) {
  const { island: initialIsland } = route.params;
  const [island, setIsland] = useState<Island>(initialIsland);
  const [expandedSentences, setExpandedSentences] = useState<Set<string>>(new Set());
  const [playingSentence, setPlayingSentence] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const [showExpandInput, setShowExpandInput] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [useVoiceInput, setUseVoiceInput] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [viewMode, setViewMode] = useState<'sentences' | 'vocabulary'>('sentences');
  const [vocabulary, setVocabulary] = useState<VocabWord[]>(island.vocabulary || []);
  const [loadingVocabulary, setLoadingVocabulary] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showIrishFirst, setShowIrishFirst] = useState(true); // Direction toggle for flashcards
  const audioPlayer = useAudioPlayer();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const toggleTranslation = (sentenceId: string) => {
    setExpandedSentences(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sentenceId)) {
        newSet.delete(sentenceId);
      } else {
        newSet.add(sentenceId);
      }
      return newSet;
    });
  };

  const playSentence = async (sentence: Sentence): Promise<void> => {
    try {
      console.log('[StudyIsland] Starting to play sentence:', sentence.id);
      setLoadingAudio(sentence.id);
      setPlayingSentence(null);

      // Get audio from API (or use cached)
      let audioBase64 = sentence.audioBase64;
      if (!audioBase64) {
        console.log('[StudyIsland] Fetching audio from API...');
        audioBase64 = await api.getSentenceAudio(sentence.irish, island.voice);
      }

      // Write base64 to temp file (expo-audio doesn't support data URIs)
      const tempUri = `${FileSystem.cacheDirectory}temp_audio_${sentence.id}.wav`;
      console.log('[StudyIsland] Writing audio to temp file:', tempUri);
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Load and play the audio file
      console.log('[StudyIsland] Loading audio file into player');
      audioPlayer.replace({ uri: tempUri });
      console.log('[StudyIsland] Calling audioPlayer.play()');
      audioPlayer.play();

      setLoadingAudio(null);
      setPlayingSentence(sentence.id);

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        const checkPlayback = setInterval(async () => {
          if (!audioPlayer.playing) {
            setPlayingSentence(null);
            clearInterval(checkPlayback);
            // Clean up temp file
            try {
              await FileSystem.deleteAsync(tempUri, { idempotent: true });
            } catch (e) {
              console.error('Failed to delete temp audio file:', e);
            }
            resolve();
          }
        }, 100);
      });
    } catch (error) {
      console.error('[StudyIsland] Failed to play audio:', error, error.stack);
      setLoadingAudio(null);
      setPlayingSentence(null);
      throw error;
    }
  };

  const stopPlayback = () => {
    audioPlayer.pause();
    setPlayingSentence(null);
  };

  const playAll = async () => {
    for (const sentence of island.sentences) {
      await playSentence(sentence);
    }
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Cead ag teastáil', 'Tá cead micreafón ag teastáil chun fuaim a thaifeadadh.');
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir taifeadadh a thosú');
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;

    setIsRecording(false);
    setIsExpanding(true);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No recording URI');
      }

      // Read and convert to base64
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Clean up temp file
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Transcribe to get refinement text
      const transcription = await api.transcribeEnglish(audioBase64);
      setRefinementText(transcription);

      // Switch to text mode so user can edit if needed
      setUseVoiceInput(false);
      setIsExpanding(false);
    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an taifeadadh a phróiseáil');
      setIsExpanding(false);
    }
  };

  const handleExpandIsland = async () => {
    if (!refinementText.trim()) {
      Alert.alert('Téacs ag teastáil', 'Scríobh cad ba mhaith leat a fhoghlaim');
      return;
    }

    setIsExpanding(true);
    try {
      const newSentences = await api.expandIsland(island, refinementText);

      // Update island with new sentences
      const updatedIsland: Island = {
        ...island,
        sentences: [...island.sentences, ...newSentences],
        updatedAt: new Date().toISOString(),
      };

      // Save to storage
      await storage.saveIsland(updatedIsland);

      // Update local state
      setIsland(updatedIsland);
      setRefinementText('');
      setShowExpandInput(false);
      setUseVoiceInput(true);

      Alert.alert('Déanta!', `${newSentences.length} abairt nua curtha leis`);
    } catch (error) {
      console.error('Failed to expand island:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an t-oileán a leathnú');
    } finally {
      setIsExpanding(false);
    }
  };

  const fetchVocabulary = async (force: boolean = false) => {
    if (vocabulary.length > 0 && !force) {
      // Already have vocabulary and not forcing refresh
      return;
    }

    setLoadingVocabulary(true);
    try {
      const vocabWords = await api.generateVocabulary(island);
      setVocabulary(vocabWords);

      // Update island with vocabulary and save
      const updatedIsland: Island = {
        ...island,
        vocabulary: vocabWords,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveIsland(updatedIsland);
      setIsland(updatedIsland);
    } catch (error) {
      console.error('Failed to fetch vocabulary:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an stór focal a ghiniúint');
    } finally {
      setLoadingVocabulary(false);
    }
  };

  const refreshVocabulary = async () => {
    await fetchVocabulary(true);
  };

  const toggleCard = (index: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const renderSentence = (sentence: Sentence, index: number) => {
    const isExpanded = expandedSentences.has(sentence.id);
    const isPlaying = playingSentence === sentence.id;
    const isLoading = loadingAudio === sentence.id;

    return (
      <View key={sentence.id} style={styles.sentenceCard}>
        <View style={styles.sentenceHeader}>
          <Text style={styles.sentenceNumber}>{index + 1}</Text>
          <TouchableOpacity
            style={[styles.playButton, isPlaying && styles.playButtonActive]}
            onPress={() => isPlaying ? stopPlayback() : playSentence(sentence)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#1a5f2a" />
            ) : (
              <Ionicons
                name={isPlaying ? 'stop' : 'play'}
                size={24}
                color={isPlaying ? '#fff' : '#1a5f2a'}
              />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.irishText}>{sentence.irish}</Text>

        <TouchableOpacity
          style={styles.translationToggle}
          onPress={() => toggleTranslation(sentence.id)}
        >
          <Ionicons
            name={isExpanded ? 'eye-off' : 'eye'}
            size={16}
            color="#666"
          />
          <Text style={styles.translationToggleText}>
            {isExpanded ? 'Folaigh aistriúchán' : 'Taispeáin aistriúchán'}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <Text style={styles.englishText}>{sentence.english}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Island description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionLabel}>Cur síos:</Text>
          <Text style={styles.descriptionText}>{island.description}</Text>
        </View>

        {/* View mode tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'sentences' && styles.tabActive]}
            onPress={() => setViewMode('sentences')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'sentences' ? '#fff' : '#1a5f2a'} />
            <Text style={[styles.tabText, viewMode === 'sentences' && styles.tabTextActive]}>
              Abairtí
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'vocabulary' && styles.tabActive]}
            onPress={() => {
              setViewMode('vocabulary');
              if (vocabulary.length === 0) {
                fetchVocabulary();
              }
            }}
          >
            <Ionicons name="book" size={20} color={viewMode === 'vocabulary' ? '#fff' : '#1a5f2a'} />
            <Text style={[styles.tabText, viewMode === 'vocabulary' && styles.tabTextActive]}>
              Stór Focal
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'sentences' ? (
          <>
            {/* Play all button */}
        <TouchableOpacity style={styles.playAllButton} onPress={playAll}>
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.playAllText}>Seinn gach ceann</Text>
        </TouchableOpacity>

        {/* Expand island button */}
        {!showExpandInput ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setShowExpandInput(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#1a5f2a" />
            <Text style={styles.expandButtonText}>Cuir tuilleadh leis</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.expandInputContainer}>
            {/* Toggle between voice and text */}
            <TouchableOpacity
              style={styles.toggleInput}
              onPress={() => {
                setUseVoiceInput(!useVoiceInput);
                setRefinementText('');
              }}
            >
              <Ionicons
                name={useVoiceInput ? 'text' : 'mic'}
                size={18}
                color="#1a5f2a"
              />
              <Text style={styles.toggleInputText}>
                {useVoiceInput ? 'Úsáid téacs' : 'Úsáid guth'}
              </Text>
            </TouchableOpacity>

            {useVoiceInput ? (
              // Voice recording
              <View style={styles.voiceInputSection}>
                <Text style={styles.voiceHintText}>
                  {isRecording
                    ? 'Ag éisteacht... Déan cur síos i mBéarla'
                    : 'Brúigh an cnaipe chun cur síos a dhéanamh i mBéarla'}
                </Text>
                <TouchableOpacity
                  style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={isExpanding}
                >
                  {isExpanding ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <Ionicons
                      name={isRecording ? 'stop' : 'mic'}
                      size={32}
                      color="#fff"
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowExpandInput(false);
                    setRefinementText('');
                    setUseVoiceInput(true);
                    if (isRecording) {
                      audioRecorder.stop();
                      setIsRecording(false);
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cealaigh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Text input
              <View style={styles.textInputSection}>
                <TextInput
                  style={styles.expandInput}
                  placeholder="E.g., 'I'd like to talk about food' or 'How would I ask about the weather?'"
                  value={refinementText}
                  onChangeText={setRefinementText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.expandButtonsRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowExpandInput(false);
                      setRefinementText('');
                      setUseVoiceInput(true);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cealaigh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, !refinementText.trim() && styles.submitButtonDisabled]}
                    onPress={handleExpandIsland}
                    disabled={isExpanding || !refinementText.trim()}
                  >
                    {isExpanding ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.submitButtonText}>Cuir leis</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

            {/* Sentences */}
            <View style={styles.sentencesContainer}>
              {island.sentences.map((sentence, index) => renderSentence(sentence, index))}
            </View>
          </>
        ) : (
          /* Vocabulary flashcards */
          <View style={styles.vocabularyContainer}>
            {/* Controls row */}
            <View style={styles.vocabularyControls}>
              {/* Direction toggle */}
              <TouchableOpacity
                style={styles.directionToggle}
                onPress={() => setShowIrishFirst(!showIrishFirst)}
              >
                <Ionicons name="swap-horizontal" size={20} color="#1a5f2a" />
                <Text style={styles.directionToggleText}>
                  {showIrishFirst ? 'Gaeilge → English' : 'English → Gaeilge'}
                </Text>
              </TouchableOpacity>

              {/* Refresh button */}
              {vocabulary.length > 0 && (
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={refreshVocabulary}
                  disabled={loadingVocabulary}
                >
                  {loadingVocabulary ? (
                    <ActivityIndicator size="small" color="#1a5f2a" />
                  ) : (
                    <Ionicons name="refresh" size={20} color="#1a5f2a" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {loadingVocabulary ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a5f2a" />
                <Text style={styles.loadingText}>Ag giniúint stór focal...</Text>
              </View>
            ) : vocabulary.length === 0 ? (
              <Text style={styles.emptyText}>Níl aon stór focal anseo fós</Text>
            ) : (
              vocabulary.map((word, index) => {
                const isFlipped = flippedCards.has(index);
                const frontText = showIrishFirst ? word.irish : word.english;
                const backText = showIrishFirst ? word.english : word.irish;
                const hintText = showIrishFirst
                  ? (isFlipped ? 'Tap to show Irish' : 'Tap to show English')
                  : (isFlipped ? 'Tap to show English' : 'Tap to show Irish');

                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.flashcard}
                    onPress={() => toggleCard(index)}
                  >
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardMainText}>
                        {isFlipped ? backText : frontText}
                      </Text>
                      {isFlipped && (
                        <Text style={styles.flashcardExample}>{word.example}</Text>
                      )}
                      <View style={styles.flashcardHint}>
                        <Ionicons name="sync" size={16} color="#999" />
                        <Text style={styles.flashcardHintText}>
                          {hintText}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  descriptionCard: {
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#1a5f2a',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a5f2a',
  },
  tabTextActive: {
    color: '#fff',
  },
  vocabularyContainer: {
    gap: 12,
  },
  vocabularyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  directionToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a5f2a',
  },
  directionToggleText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a5f2a',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a5f2a',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    paddingVertical: 40,
  },
  flashcard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 150,
    justifyContent: 'center',
  },
  flashcardContent: {
    alignItems: 'center',
  },
  flashcardMainText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a5f2a',
    textAlign: 'center',
    marginBottom: 16,
  },
  flashcardExample: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  flashcardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flashcardHintText: {
    fontSize: 12,
    color: '#999',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a5f2a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  playAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#1a5f2a',
  },
  expandButtonText: {
    color: '#1a5f2a',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  expandInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleInput: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    padding: 8,
  },
  toggleInputText: {
    marginLeft: 6,
    color: '#1a5f2a',
    fontSize: 14,
    fontWeight: '500',
  },
  voiceInputSection: {
    alignItems: 'center',
  },
  voiceHintText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a5f2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recordButtonActive: {
    backgroundColor: '#c62828',
  },
  textInputSection: {
    width: '100%',
  },
  expandInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  expandButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a5f2a',
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  sentencesContainer: {
    gap: 12,
  },
  sentenceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  sentenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sentenceNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8f5e9',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a5f2a',
    marginRight: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#1a5f2a',
  },
  irishText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a5f2a',
    lineHeight: 26,
    marginBottom: 12,
  },
  translationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  translationToggleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  englishText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});
