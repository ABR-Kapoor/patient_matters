'use client';

import { useState, useEffect, useRef } from 'react';

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export function useVoiceToText() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        // Check if browser supports Web Speech API
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            setIsSupported(!!SpeechRecognition);
            
            if (!SpeechRecognition) {
                console.warn('Speech Recognition API is not supported in this browser');
            }
        }
    }, []);

    const hasMicrophone = async (): Promise<{ available: boolean; error?: string }> => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return { available: false, error: 'This browser cannot access microphone devices.' };
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            return { available: true };
        } catch (error: any) {
            console.error('Microphone access check failed:', error);
            if (error && error.name === 'NotAllowedError') {
                return { available: false, error: 'Microphone permission is denied by system/browser settings. Please enable microphone access.' };
            }
            if (error && error.name === 'NotFoundError') {
                return { available: false, error: 'No microphone device found. Please connect a microphone.' };
            }
            return { available: false, error: 'Unable to access microphone. Please check device and permissions.' };
        }
    };

    const startRecording = async () => {
        if (!isSupported) {
            alert('Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        const micState = await hasMicrophone();
        if (!micState.available) {
            alert(micState.error || 'No microphone found. Please check your microphone connection and permission.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';

            // Only use final results for voice search
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + finalTranscript);
            }
        };

        recognition.onerror = async (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error, event.message);
            
            let errorMessage = 'Voice recognition error occurred.';
            switch (event.error) {
                case 'not-allowed':
                case 'service-not-allowed':
                    errorMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
                    break;
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try again.';
                    break;
                case 'audio-capture': {
                    const micAvailable = await hasMicrophone();
                    if (!micAvailable) {
                        errorMessage = 'No microphone found. Please check your microphone connection, permissions, and system settings.';
                    } else {
                        errorMessage = 'Microphone device could not be accessed. Please try again or reload the page.';
                    }
                    break;
                }
                case 'network':
                    errorMessage = 'Network error. Please check your internet connection.';
                    break;
                case 'aborted':
                    // User stopped recording, no error message needed
                    break;
                default:
                    errorMessage = `Voice recognition error: ${event.error}`;
            }
            
            if (event.error !== 'aborted') {
                alert(errorMessage);
            }
            
            setIsRecording(false);
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            setIsRecording(false);
        };

        try {
            recognition.start();
            console.log('Speech recognition started');
            recognitionRef.current = recognition;
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recognition:', error);
            alert('Failed to start voice recognition. Please try again.');
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            // Let the onend event handler accurately manage setIsRecording(false)
            // so we don't miss the final asynchronous onresult payload.
        }
    };

    const resetTranscript = () => {
        setTranscript('');
    };

    return {
        isRecording,
        transcript,
        isSupported,
        startRecording,
        stopRecording,
        resetTranscript,
    };
}
