import { useState, useRef, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import { globalShowAlert, globalShowToast } from '../lib/NotificationContext';

// Fallback dynamic imports for expo-audio
let AudioModule: any = null;
let hasAudioModule = false;
try {
  const expoAudio = require('expo-audio');
  AudioModule = expoAudio.AudioModule;
  hasAudioModule = true;
} catch (e) {
  console.warn('expo-audio native module not found');
}

export interface UseVoiceSearchOptions {
  onFinalTranscript?: (transcript: string) => void;
  toast?: boolean;
}

const MIC_PERMISSION_MESSAGE =
  'We need microphone access to listen to you and transcribe your voice into search text.';

export function useVoiceSearch(options: UseVoiceSearchOptions = {}) {
  const { onFinalTranscript, toast = true } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const recorderRef = useRef<any>(null);
  const finalCallbackRef = useRef(onFinalTranscript);

  useEffect(() => {
    finalCallbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const report = useCallback(
    (message: string) => {
      if (toast) {
        if (globalShowToast) { globalShowToast('Voice Search', message, 'info'); } else if (globalShowAlert) { globalShowAlert('Voice Search', message); }
      }
    },
    [toast]
  );

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    try {
      const current = await AudioModule.getRecordingPermissionsAsync();
      if (current?.granted) return true;

      if (current?.canAskAgain) {
        const result = await AudioModule.requestRecordingPermissionsAsync();
        if (result?.granted) return true;

        report('Microphone access is needed to search by voice. Enable it in your device settings.');
        return false;
      }

      if (globalShowAlert) {
      globalShowAlert(
        'Microphone Permission Required',
        'Microphone access is needed for voice search. Please enable it in Settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ],
        'warning'
      );
    }
      return false;
    } catch (err) {
      console.error('Failed to check microphone permission', err);
      report('Could not check microphone permission. Please try again.');
      return false;
    }
  }, [report]);

  const start = useCallback(async () => {
    if (!hasAudioModule || !AudioModule) {
      report('Voice search needs a build that includes the audio module. Rebuild the app and try again.');
      setIsAvailable(false);
      return;
    }
    
    if (isListening) return;

    if (!(await ensurePermission())) return;

    try {
      // Create a new AudioRecorder
      const recorder = new AudioModule.AudioRecorder({
        extension: '.m4a',
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
      });
      recorderRef.current = recorder;
      
      await recorder.prepareToRecordAsync();

      recorder.record();
      setIsListening(true);
      setInterimTranscript('Listening... (tap to stop)');
    } catch (err) {
      console.error('Failed to start recording', err);
      report('The microphone could not be started. Please type your symptoms instead.');
      setIsListening(false);
    }
  }, [isListening, ensurePermission, report]);

  const stop = useCallback(async () => {
    if (!recorderRef.current || !isListening) {
      setIsListening(false);
      setInterimTranscript('');
      return;
    }
    
    setIsListening(false);
    setInterimTranscript('Processing...');

    try {
      await recorderRef.current.stop();
      const uri = recorderRef.current.uri;

      if (uri) {
        // Upload the audio file to ElevenLabs REST API
        const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
        if (!apiKey) {
          throw new Error('Missing EXPO_PUBLIC_ELEVENLABS_API_KEY');
        }

        // Convert the local file URI to a Blob for modern React Native FormData
        const fileResponse = await fetch(uri);
        const blob = await fileResponse.blob();

        const formData = new FormData();
        formData.append('model_id', 'scribe_v2');
        formData.append('file', blob, 'recording.m4a');

        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
          },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('ElevenLabs Error:', data);
          report(`ElevenLabs Error: ${data.detail?.message || data.error || 'Failed to transcribe'}`);
          setInterimTranscript('');
          return;
        }

        if (data.text) {
          finalCallbackRef.current?.(data.text);
        }
      }
    } catch (err) {
      console.error('Failed to stop/upload recording', err);
      report('Failed to transcribe audio. Please try again.');
    } finally {
      setInterimTranscript('');
      recorderRef.current = null;
    }
  }, [isListening, report]);

  const cancel = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop().catch(() => {});
      recorderRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    isListening,
    isAvailable,
    interimTranscript,
    start,
    stop,
    cancel,
  };
}