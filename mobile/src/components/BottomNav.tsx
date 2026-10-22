import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Calendar, FileText } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { useVoiceSearchContext } from '@/lib/VoiceSearchContext';
import { ElevenLabsVoiceOrb } from '@/components/ElevenLabsVoiceOrb';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [isVoiceModalOpen, setVoiceModalOpen] = useState(false);
  const { publishTranscript, isVoiceModalRequested, consumeVoiceModalRequest } = useVoiceSearchContext();

  const { isListening, interimTranscript, start, stop, cancel } = useVoiceSearch({
    onFinalTranscript: (transcript) => {
      setVoiceModalOpen(false);
      if (transcript.trim()) {
        publishTranscript(transcript);
        if (pathname !== '/') {
          router.replace('/');
        }
      }
    },
  });

  const handleOpenVoice = () => {
    setVoiceModalOpen(true);
    start();
  };

  React.useEffect(() => {
    if (isVoiceModalRequested) {
      consumeVoiceModalRequest();
      handleOpenVoice();
    }
  }, [isVoiceModalRequested, consumeVoiceModalRequest]);

  const handleCloseVoice = () => {
    cancel();
    setVoiceModalOpen(false);
  };

  // Hide on certain screens
  if (pathname.includes('video-call') || pathname.includes('book-appointment') || pathname.includes('chat')) {
    return null;
  }

  const navigateTo = (path: string) => {
    if (pathname !== path) {
      router.push(path as any);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('/')}>
          <Home size={24} color={pathname === '/' ? COLORS.primary : COLORS.gray} />
          <Text style={[styles.navText, pathname === '/' && styles.activeText]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('/find-doctors')}>
          <Search size={24} color={pathname === '/find-doctors' ? COLORS.primary : COLORS.gray} />
          <Text style={[styles.navText, pathname === '/find-doctors' && styles.activeText]}>Doctors</Text>
        </TouchableOpacity>

        <View style={styles.centerSpace} pointerEvents="none" />

        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('/appointments')}>
          <Calendar size={24} color={pathname === '/appointments' ? COLORS.primary : COLORS.gray} />
          <Text style={[styles.navText, pathname === '/appointments' && styles.activeText]}>Visits</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('/prescriptions')}>
          <FileText size={24} color={pathname === '/prescriptions' ? COLORS.primary : COLORS.gray} />
          <Text style={[styles.navText, pathname === '/prescriptions' && styles.activeText]}>Records</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.centerButtonOuter}>
        <TouchableOpacity 
          style={[
            styles.centerButton,
            isVoiceModalOpen && { backgroundColor: COLORS.text, shadowColor: COLORS.text }
          ]} 
          onPress={handleOpenVoice}
          activeOpacity={0.85}
        >
          <ElevenLabsVoiceOrb size={56} isListening={isListening || isVoiceModalOpen} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isVoiceModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseVoice}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={handleCloseVoice} 
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <TouchableOpacity 
              style={styles.voiceOrbContainer}
              onPress={() => isListening ? stop() : start()}
              activeOpacity={0.8}
            >
              <ElevenLabsVoiceOrb size={170} isListening={isListening} showModalCircleRings={true} />
            </TouchableOpacity>
            <View style={styles.voicePrompt}>
              <Text style={styles.voiceText}>
                {interimTranscript === 'Processing...' ? 'Processing...' : 'Listening...'}
              </Text>
              {isListening && (
                <TouchableOpacity onPress={stop} accessibilityRole="button">
                  <Text style={styles.stopListeningText}>Tap to stop</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  navBar: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navText: {
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.gray,
    marginTop: 2,
  },
  activeText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  centerSpace: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  centerButtonOuter: {
    position: 'absolute',
    top: -24, // Pop it up nicely
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F2F1F0', // Mask to create the cutout effect
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#F9FAFB', // Off-white theme color
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: '55%',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB', // lighter handle for off-white bg
    marginBottom: 40,
  },
  voiceOrbContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  voiceText: {
    color: '#111827', // Dark text for contrast on off-white
    fontSize: 22,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
    lineHeight: 32,
    paddingHorizontal: 16,
  },
  voicePrompt: {
    alignItems: 'center',
  },
  stopListeningText: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    marginTop: 36,
  },
});
