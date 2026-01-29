import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { CONFIG } from '../config';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateIsland'>;
};

type RecordingState = 'idle' | 'recording' | 'processing';

export function CreateIslandScreen({ navigation }: Props) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [selectedVoice, setSelectedVoice] = useState<'ga_UL_anb_piper' | 'ga_MU_nnc_piper'>('ga_UL_anb_piper');
  const [statusText, setStatusText] = useState('Brúigh an cnaipe chun cur síos a dhéanamh i mBéarla');
  const [manualInput, setManualInput] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);
  const recording = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Cead ag teastáil', 'Tá cead micreafón ag teastáil chun fuaim a thaifeadadh.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recording.current = newRecording;
      setRecordingState('recording');
      setStatusText('Ag éisteacht... Déan cur síos i mBéarla ar an rud a bhfuil tú ag iarraidh labhairt faoi.');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir taifeadadh a thosú');
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;

    setRecordingState('processing');
    setStatusText('Ag próiseáil... Fan le do thoil.');

    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;

      if (!uri) {
        throw new Error('No recording URI');
      }

      // Read the audio file and convert to base64
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Clean up the temp file
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Send to backend to create island
      await createIslandFromAudio(audioBase64);
    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an taifeadadh a phróiseáil');
      setRecordingState('idle');
      setStatusText('Brúigh an cnaipe chun cur síos a dhéanamh i mBéarla');
    }
  };

  const createIslandFromAudio = async (audioBase64: string) => {
    try {
      const island = await api.createIsland(audioBase64, selectedVoice);
      await storage.saveIsland(island);

      // Navigate to study the new island
      navigation.replace('StudyIsland', { island });
    } catch (error) {
      console.error('Failed to create island:', error);
      Alert.alert(
        'Earráid',
        'Níorbh fhéidir an t-oileán a chruthú. Bain triail eile as.',
        [{ text: 'OK' }]
      );
      setRecordingState('idle');
      setStatusText('Brúigh an cnaipe chun cur síos a dhéanamh i mBéarla');
    }
  };

  const createIslandFromText = async () => {
    if (!manualInput.trim()) {
      Alert.alert('Téacs ag teastáil', 'Scríobh cur síos i mBéarla');
      return;
    }

    setRecordingState('processing');
    setStatusText('Ag cruthú an oileáin...');

    try {
      // For text input, we'll call a different endpoint
      const response = await fetch(`${CONFIG.API_BASE}/api/islands/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: manualInput,
          voice: selectedVoice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create island');
      }

      const island = await response.json();
      await storage.saveIsland(island);
      navigation.replace('StudyIsland', { island });
    } catch (error) {
      console.error('Failed to create island:', error);
      Alert.alert('Earráid', 'Níorbh fhéidir an t-oileán a chruthú');
      setRecordingState('idle');
      setStatusText('Brúigh an cnaipe chun cur síos a dhéanamh i mBéarla');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.instructions}>
        Déan cur síos i mBéarla ar an rud a bhfuil tú ag iarraidh labhairt faoi.
        {'\n\n'}
        Mar shampla: "I want to talk about the GAA match between Galway and Mayo at the weekend"
      </Text>

      {/* Voice selector */}
      <View style={styles.voiceSelector}>
        <Text style={styles.voiceLabel}>Guth:</Text>
        <TouchableOpacity
          style={[
            styles.voiceOption,
            selectedVoice === 'ga_UL_anb_piper' && styles.voiceOptionSelected,
          ]}
          onPress={() => setSelectedVoice('ga_UL_anb_piper')}
        >
          <Text style={[
            styles.voiceOptionText,
            selectedVoice === 'ga_UL_anb_piper' && styles.voiceOptionTextSelected,
          ]}>
            Tír Chonaill
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.voiceOption,
            selectedVoice === 'ga_MU_nnc_piper' && styles.voiceOptionSelected,
          ]}
          onPress={() => setSelectedVoice('ga_MU_nnc_piper')}
        >
          <Text style={[
            styles.voiceOptionText,
            selectedVoice === 'ga_MU_nnc_piper' && styles.voiceOptionTextSelected,
          ]}>
            Ciarraí
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toggle between voice and text input */}
      <TouchableOpacity
        style={styles.toggleInput}
        onPress={() => setUseManualInput(!useManualInput)}
      >
        <Ionicons
          name={useManualInput ? 'mic' : 'text'}
          size={20}
          color="#1a5f2a"
        />
        <Text style={styles.toggleInputText}>
          {useManualInput ? 'Úsáid guth' : 'Scríobh téacs'}
        </Text>
      </TouchableOpacity>

      {useManualInput ? (
        // Manual text input
        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="Describe in English what you want to talk about..."
            value={manualInput}
            onChangeText={setManualInput}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.createButton, !manualInput.trim() && styles.createButtonDisabled]}
            onPress={createIslandFromText}
            disabled={recordingState === 'processing' || !manualInput.trim()}
          >
            {recordingState === 'processing' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="leaf" size={24} color="#fff" />
                <Text style={styles.createButtonText}>Cruthaigh Oileán</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        // Voice recording
        <>
          <Text style={styles.statusText}>{statusText}</Text>

          <TouchableOpacity
            style={[
              styles.recordButton,
              recordingState === 'recording' && styles.recordButtonRecording,
              recordingState === 'processing' && styles.recordButtonProcessing,
            ]}
            onPress={recordingState === 'recording' ? stopRecording : startRecording}
            disabled={recordingState === 'processing'}
          >
            {recordingState === 'processing' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons
                name={recordingState === 'recording' ? 'stop' : 'mic'}
                size={48}
                color="#fff"
              />
            )}
          </TouchableOpacity>

          <Text style={styles.recordHint}>
            {recordingState === 'idle' && 'Brúigh chun taifeadadh'}
            {recordingState === 'recording' && 'Brúigh chun stopadh'}
            {recordingState === 'processing' && 'Ag cruthú d\'oileán...'}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  voiceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  voiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  voiceOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
  },
  voiceOptionSelected: {
    backgroundColor: '#1a5f2a',
  },
  voiceOptionText: {
    color: '#333',
    fontWeight: '500',
  },
  voiceOptionTextSelected: {
    color: '#fff',
  },
  toggleInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 8,
  },
  toggleInputText: {
    marginLeft: 8,
    color: '#1a5f2a',
    fontWeight: '500',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a5f2a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  recordButtonRecording: {
    backgroundColor: '#c62828',
  },
  recordButtonProcessing: {
    backgroundColor: '#666',
  },
  recordHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  manualInputContainer: {
    width: '100%',
  },
  manualInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#1a5f2a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#999',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
