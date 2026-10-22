import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Send,
  Video,
  Phone,
  MessageSquare,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { useAuthToken, usePatientIdentity } from '../../../hooks/stubs';
import { fetchWithAuth } from '../../../lib/fetchWithAuth';
import { DoctorAvatar } from '../../../components/DoctorAvatar';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F9FAFB',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  bubblePatient: '#048256',
  bubbleDoctor: '#FFFFFF',
  danger: '#EF4444',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

const QUICK_TAGS = [
  'Hello Doctor 👋',
  'I am ready for the consultation',
  'Running 5 mins late',
  'I have uploaded my symptoms/reports',
];

interface ChatMessage {
  message_id: string;
  aid: string;
  sender_uid: string;
  sender_role: 'patient' | 'doctor';
  sender_name?: string;
  content: string;
  media_url?: string | null;
  created_at: string;
  read_at?: string | null;
}

export default function AppointmentChatScreen() {
  const insets = useSafeAreaInsets();
  const { aid } = useLocalSearchParams();
  const router = useRouter();
  const token = useAuthToken();
  const { data: identity } = usePatientIdentity(token);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [appointmentInfo, setAppointmentInfo] = useState<any>(null);
  const [canChat, setCanChat] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!aid || !token) return;
    try {
      const res = await fetchWithAuth(`/api/appointments/${aid}/messages`, token);
      const data = await res.json();
      if (data?.success) {
        setMessages(data.messages || []);
        setAppointmentInfo(data.appointment || null);
        setCanChat(!!data.canChat);
        if (!data.canChat) {
          setStatusMessage(
            `Chat will be unlocked as soon as the doctor confirms the appointment (Status: ${data.appointmentStatus}).`
          );
        }
      }
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [aid, token]);

  // Initial fetch and real-time polling (simulating WebSocket fallback across devices)
  useEffect(() => {
    void fetchMessages(true);
    pollTimerRef.current = setInterval(() => {
      void fetchMessages(false);
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchMessages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputContent).trim();
    if (!text || sending || !aid || !token) return;

    setSending(true);
    setInputContent('');

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      message_id: tempId,
      aid: String(aid),
      sender_uid: identity?.uid || 'me',
      sender_role: 'patient',
      sender_name: identity?.name || 'You',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetchWithAuth(`/api/appointments/${aid}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data?.success && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.message_id === tempId ? data.message : m))
        );
      } else {
        // Rollback on failure
        setMessages((prev) => prev.filter((m) => m.message_id !== tempId));
        alert(data?.error || 'Failed to send message');
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.message_id !== tempId));
      alert('Could not send message. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleStartCall = () => {
    if (!aid) return;
    router.push(`/video-call/${aid}`);
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isPatient = item.sender_role === 'patient';
    const formattedTime = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View
        style={[
          styles.messageRow,
          isPatient ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        {!isPatient && (
          <View style={styles.senderAvatar}>
            <DoctorAvatar
              uri={null}
              seed={appointmentInfo?.doctorName || 'Dr'}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isPatient ? styles.bubblePatient : styles.bubbleDoctor,
          ]}
        >
          {!isPatient && (
            <Text style={styles.doctorSenderTitle}>
              {appointmentInfo?.doctorName || 'Doctor'}
            </Text>
          )}
          <Text
            style={[
              styles.bubbleText,
              isPatient ? styles.bubbleTextPatient : styles.bubbleTextDoctor,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text
              style={[
                styles.bubbleTime,
                isPatient ? styles.bubbleTimePatient : styles.bubbleTimeDoctor,
              ]}
            >
              {formattedTime}
            </Text>
            {isPatient && (
              <CheckCheck
                size={14}
                color={item.read_at ? '#93C5FD' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Rapido-Style Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>

        {/* Doctor Profile Image */}
        <View style={styles.avatarContainer}>
          <DoctorAvatar
            uri={appointmentInfo?.doctorAvatarUrl || appointmentInfo?.doctorImage || null}
            seed={appointmentInfo?.doctorId || appointmentInfo?.doctorName || 'doctor'}
            style={styles.headerAvatar}
          />
          <View
            style={[
              styles.avatarStatusBadge,
              { backgroundColor: canChat ? '#10B981' : '#F59E0B' },
            ]}
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {appointmentInfo?.doctorName || 'Your Doctor'}
          </Text>
          <View style={styles.statusIndicatorRow}>
            <Text style={styles.headerSubtitle}>
              {appointmentInfo?.appointmentStatus === 'in_progress' || appointmentInfo?.status === 'in_progress'
                ? 'In Progress'
                : canChat
                ? 'Consultation Confirmed'
                : 'Waiting Confirmation'}
            </Text>
          </View>
        </View>

        {canChat && (
          <TouchableOpacity
            style={styles.callActionButton}
            onPress={handleStartCall}
            activeOpacity={0.8}
          >
            <Video size={18} color="#FFFFFF" />
            <Text style={styles.callActionText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : !canChat ? (
          <View style={styles.lockedContainer}>
            <View style={styles.lockIconCircle}>
              <Clock size={36} color="#F59E0B" />
            </View>
            <Text style={styles.lockedTitle}>Appointment Pending Confirmation</Text>
            <Text style={styles.lockedSubtitle}>
              {statusMessage ||
                'Real-time chat and calling will be activated as soon as the doctor confirms your appointment slot.'}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <MessageSquare size={28} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>Chat directly with your doctor</Text>
                  <Text style={styles.emptySubtitle}>
                    Send messages, symptom details, or questions ahead of the call.
                  </Text>
                </View>
              }
            />

            {/* Quick Action Presets */}
            <View style={styles.quickTagsContainer}>
              <FlatList
                horizontal
                data={QUICK_TAGS}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.quickTag}
                    onPress={() => handleSend(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickTagText}>{item}</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              />
            </View>

            {/* Bottom Input Row */}
            <View
              style={[
                styles.inputBar,
                {
                  paddingBottom: isKeyboardVisible
                    ? 8
                    : insets.bottom > 0
                    ? insets.bottom + 4
                    : 10,
                },
              ]}
            >
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.gray}
                value={inputContent}
                onChangeText={setInputContent}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !inputContent.trim() && styles.sendButtonDisabled,
                ]}
                onPress={() => handleSend()}
                disabled={!inputContent.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  callActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginLeft: 8,
  },
  callActionText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 13,
    marginLeft: 6,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  senderAvatar: {
    marginRight: 8,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubblePatient: {
    backgroundColor: COLORS.bubblePatient,
    borderBottomRightRadius: 4,
  },
  bubbleDoctor: {
    backgroundColor: COLORS.bubbleDoctor,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  doctorSenderTitle: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  bubbleTextPatient: {
    color: '#FFFFFF',
  },
  bubbleTextDoctor: {
    color: COLORS.text,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: FONTS.regular,
  },
  bubbleTimePatient: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  bubbleTimeDoctor: {
    color: COLORS.gray,
  },
  quickTagsContainer: {
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  quickTag: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickTagText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginRight: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});
