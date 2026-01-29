import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAudioPlayer, AudioSource } from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../../App';
import { Sentence } from '../types/island';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'StudyIsland'>;

export function StudyIslandScreen({ route }: Props) {
  const { island } = route.params;
  const [expandedSentences, setExpandedSentences] = useState<Set<string>>(new Set());
  const [playingSentence, setPlayingSentence] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer();

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

        {/* Play all button */}
        <TouchableOpacity style={styles.playAllButton} onPress={playAll}>
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.playAllText}>Seinn gach ceann</Text>
        </TouchableOpacity>

        {/* Sentences */}
        <View style={styles.sentencesContainer}>
          {island.sentences.map((sentence, index) => renderSentence(sentence, index))}
        </View>
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
