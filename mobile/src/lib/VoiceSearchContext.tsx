import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type VoiceSearchContextValue = {
  voiceTranscript: string | null;
  publishTranscript: (text: string) => void;
  clearTranscript: () => void;
  isVoiceModalRequested: boolean;
  requestVoiceModal: () => void;
  consumeVoiceModalRequest: () => void;
};

const VoiceSearchContext = createContext<VoiceSearchContextValue | null>(null);

export function VoiceSearchProvider({ children }: { children: React.ReactNode }) {
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [isVoiceModalRequested, setIsVoiceModalRequested] = useState<boolean>(false);

  const publishTranscript = useCallback((text: string) => {
    setVoiceTranscript(text);
  }, []);

  const clearTranscript = useCallback(() => {
    setVoiceTranscript(null);
  }, []);

  const requestVoiceModal = useCallback(() => {
    setIsVoiceModalRequested(true);
  }, []);

  const consumeVoiceModalRequest = useCallback(() => {
    setIsVoiceModalRequested(false);
  }, []);

  const value = useMemo(
    () => ({
      voiceTranscript,
      publishTranscript,
      clearTranscript,
      isVoiceModalRequested,
      requestVoiceModal,
      consumeVoiceModalRequest,
    }),
    [
      voiceTranscript,
      publishTranscript,
      clearTranscript,
      isVoiceModalRequested,
      requestVoiceModal,
      consumeVoiceModalRequest,
    ]
  );

  return (
    <VoiceSearchContext.Provider value={value}>
      {children}
    </VoiceSearchContext.Provider>
  );
}

export function useVoiceSearchContext() {
  const context = useContext(VoiceSearchContext);
  if (!context) {
    throw new Error('useVoiceSearchContext must be used within VoiceSearchProvider');
  }
  return context;
}
