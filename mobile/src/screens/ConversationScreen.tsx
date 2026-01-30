import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../../App';
import { CONFIG } from '../config';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Conversation'>;
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function ConversationScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const audioPlayer = useAudioPlayer();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

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
    setIsProcessing(true);

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

      // Clean up recording
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Send to backend for processing
      console.log('[ConversationScreen] Sending audio to backend...');
      const response = await fetch(`${CONFIG.API_BASE}/forward_audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_blob: audioBase64,
        }),
      });

      console.log('[ConversationScreen] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ConversationScreen] Backend error:', errorText);
        throw new Error(`Failed to process audio: ${response.status} ${errorText}`);
      }

      const responseText = await response.text();
      console.log('[ConversationScreen] Response text:', responseText.substring(0, 200));

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Received empty response from backend');
      }

      const data = JSON.parse(responseText);

      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: data.tusa, // Transcribed Irish text
      };
      setMessages(prev => [...prev, userMessage]);

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.sise, // GPT response in Irish
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Play assistant response
      await playAudio(data.audioContent);

    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an taifeadadh a phróiseáil');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = async (audioBase64: string) => {
    try {
      setIsPlaying(true);

      // Write base64 to temp file
      const tempUri = `${FileSystem.cacheDirectory}conversation_audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Play audio
      audioPlayer.replace({ uri: tempUri });
      audioPlayer.play();

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        const checkPlayback = setInterval(async () => {
          if (!audioPlayer.playing) {
            clearInterval(checkPlayback);
            await FileSystem.deleteAsync(tempUri, { idempotent: true });
            resolve();
          }
        }, 100);
      });

      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
    }
  };

  const clearConversation = async () => {
    try {
      // Clear session on backend
      await fetch(`${CONFIG.API_BASE}/reset`, {
        method: 'GET',
      });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear conversation:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Tosaigh comhrá!</Text>
            <Text style={styles.emptySubtext}>
              Brúigh an cnaipe chun labhairt i nGaeilge
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {messages.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearConversation}
            disabled={isRecording || isProcessing}
          >
            <Ionicons name="trash-outline" size={24} color="#666" />
          </TouchableOpacity>
        )}

        <View style={styles.recordButtonContainer}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              (isProcessing || isPlaying) && styles.recordButtonDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing || isPlaying}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : isPlaying ? (
              <Ionicons name="volume-high" size={40} color="#fff" />
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
              ? 'Ag próiseáil...'
              : isPlaying
              ? 'Ag seinm...'
              : isRecording
              ? 'Ag éisteacht...'
              : 'Brúigh chun labhairt'}
          </Text>
        </View>

        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a5f2a',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  clearButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonContainer: {
    alignItems: 'center',
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
  spacer: {
    width: 48,
  },
});
