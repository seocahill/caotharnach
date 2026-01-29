import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { Sentence } from '../types/island';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'StudyIsland'>;

export function StudyIslandScreen({ route }: Props) {
  const { island } = route.params;
  const [expandedSentences, setExpandedSentences] = useState<Set<string>>(new Set());
  const [playingSentence, setPlayingSentence] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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

  const playSentence = async (sentence: Sentence) => {
    try {
      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setLoadingAudio(sentence.id);
      setPlayingSentence(null);

      // Get audio from API (or use cached)
      let audioBase64 = sentence.audioBase64;
      if (!audioBase64) {
        audioBase64 = await api.getSentenceAudio(sentence.irish, island.voice);
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Create and play the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${audioBase64}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setLoadingAudio(null);
      setPlayingSentence(sentence.id);

      // Handle playback completion
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingSentence(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      setLoadingAudio(null);
      setPlayingSentence(null);
    }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlayingSentence(null);
    }
  };

  const playAll = async () => {
    for (const sentence of island.sentences) {
      if (playingSentence !== null) {
        // Wait for current to finish
        await new Promise(resolve => {
          const interval = setInterval(() => {
            if (playingSentence === null) {
              clearInterval(interval);
              resolve(true);
            }
          }, 100);
        });
      }
      await playSentence(sentence);
      // Wait for this sentence to finish
      await new Promise(resolve => {
        const interval = setInterval(() => {
          if (playingSentence === null) {
            clearInterval(interval);
            resolve(true);
          }
        }, 100);
      });
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
