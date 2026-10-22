import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, Video, MapPin, Clock, History, Hourglass, Ban, AlertCircle, RefreshCw, Navigation, Star, MessageSquare } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { TranslatedText } from '../../components/TranslatedText';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useNotification } from '../../lib/NotificationContext';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  // AURASUTRA-REVIEWS:reviews_star_color
  star: '#F59E0B',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

function formatTime(timeStr: any): string {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export default function AppointmentsPage() {
  const router = useRouter();
  // Guard against double-tap: once pushed, block further pushes until the screen blurs.
  const isNavigatingRef = useRef(false);
  const token = useAuthToken();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);
  const uid = identity?.uid;
  const { showToast, showAlert, showConfirm } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundInput, setShowRefundInput] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // AURASUTRA-REVIEWS:appointments_review_actions
  // Completed appointments carry the caller's own review inline (myReview), so
  // the button can say "Rate doctor" or "Edit review" without another request.
  // The rating itself is never precomputed here — it comes from the review row.
  const goRate = (aid: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push(`/rate-doctor?aid=${aid}`);
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // The call only opens once the doctor has confirmed, so a scheduled appointment is
  // never joinable. The 5-minute lead time still applies to confirmed appointments.
  const canJoinCall = (apt: any, currentTime: number) => {
    if (apt.status !== 'confirmed' && apt.status !== 'in_progress') return false;
    const dateStr = String(apt.scheduledDate || '').slice(0, 10);
    const timeStr = String(apt.scheduledTime || '').slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return false;
    const start = new Date(`${dateStr}T${timeStr}:00`).getTime();
    const fiveMinBefore = start - 5 * 60 * 1000;
    return currentTime >= fiveMinBefore;
  };

  // `silent` is used by the background poll: a failed refresh every 15s must not
  // spam the user with an alert, it should just leave the last good list on screen.
  const fetchAppointments = async (silent = false) => {
    if (!uid) return;
    // Resolve the Clerk JWT before firing the request. getToken() returns null
    // while Clerk is hydrating — without this guard the request fires with no
    // Authorization header and the server returns 401.
    const resolvedToken = typeof token === 'function' ? await token() : token;
    if (!resolvedToken) {
      console.warn('[appointments] token is null – skipping fetch');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const response = await fetchWithAuth('/api/patient/appointments', resolvedToken);
      const data = await response.json();
      
      if (data.success) {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error(err);
      if (!silent) showAlert('Fetch Failed', 'Could not load your appointments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Reset the navigation guard so the button works again when the user returns
      // from the video call screen.
      isNavigatingRef.current = false;
      if (uid) fetchAppointments(appointments.length > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid])
  );

  const handleCancel = async (aid: string) => {
    showConfirm(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      async () => {
        setRefreshing(true);
        try {
          const res = await fetchWithAuth(`/api/patient/appointments/${aid}/cancel`, token, { method: 'PATCH' });
          const data = await res.json();
          if (data.success) {
            showToast('Appointment Cancelled', 'Your appointment has been cancelled successfully.');
            fetchAppointments();
          } else {
            showAlert('Cancellation Failed', data.error || 'Failed to cancel appointment');
            setRefreshing(false);
          }
        } catch (err) {
          showAlert('Network Error', 'Please check your connection and try again.');
          setRefreshing(false);
        }
      },
      'Yes, Cancel',
      'Keep Appointment',
      true
    );
  };

  const handleRequestRefund = async (aid: string) => {
    if (!refundReason.trim()) {
      showAlert('Reason Required', 'Please provide a reason for the refund request.');
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetchWithAuth(`/api/patient/appointments/${aid}/refund`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Refund Requested', 'Your refund request has been submitted successfully.');
        setShowRefundInput(null);
        setRefundReason('');
        fetchAppointments();
      } else {
        showAlert('Refund Error', data.error || 'Failed to request refund');
      }
    } catch (err) {
      showAlert('Network Error', 'Please check your internet connection.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    if (activeTab === 'upcoming') return apt.status === 'scheduled' || apt.status === 'confirmed' || apt.status === 'in_progress';
    if (activeTab === 'completed') return apt.status === 'completed';
    return apt.status === 'cancelled';
  });

  /**
   * Opens the native maps app for turn-by-turn directions to the clinic.
   * Prefers a `geo:` intent and falls back to the Google Maps web URL, so this
   * works on devices without a geo handler and needs no native module.
   */
  const openDirections = useCallback(async (location: { latitude: number; longitude: number; label?: string }) => {
    const { latitude, longitude, label } = location;
    const coords = `${latitude},${longitude}`;
    const geoUrl = `geo:${coords}?q=${coords}${label ? `(${encodeURIComponent(label)})` : ''}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}`;

    try {
      const canOpen = await Linking.canOpenURL(geoUrl);
      if (canOpen) {
        await Linking.openURL(geoUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        showAlert('Maps Unavailable', 'Could not open maps on this device.');
      }
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderAppointmentCard = (apt: any) => {
const isUpcoming = activeTab === 'upcoming';
    const isCancelled = activeTab === 'cancelled';
    const canRefund = isCancelled && (apt.paymentStatus === 'paid' || apt.paymentStatus === 'completed') && !apt.refundRequested;

    // AURASUTRA-REVIEWS:appointments_my_review
    // Only completed consultations are reviewable, matching the server rule in
    // POST /api/patient/reviews.
    const isCompleted = apt.status === 'completed';
    const myReview = apt.myReview || null;
    const myRating = myReview ? Number(myReview.rating) : null;

    const rawName = String(apt.doctor?.user?.name || apt.doctor?.name || 'Unknown Doctor');
    const docName = rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`;
    const spec = Array.isArray(apt.doctor?.specialization) ? apt.doctor.specialization.join(', ') : String(apt.doctor?.specialization || 'Specialist');
    const pic = apt.doctor?.user?.profileImageUrl || apt.doctor?.profile_image_url || apt.doctor?.profileImageUrl;

    // In-clinic appointments get a directions link when the doctor pinned a location.
    const clinicLocation = apt.mode === 'online' ? null : (apt.doctor?.clinicLocation ?? null);
    const clinicAddress = String(apt.doctor?.clinicAddress || '');

    return (
      <View key={apt.aid} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateText}>{new Date(apt.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.timeText}>{formatTime(apt.scheduledTime)}</Text>
          </View>
          <View style={[styles.statusBadge, isUpcoming ? styles.statusUpcoming : isCancelled ? styles.statusCancelled : styles.statusCompleted]}>
            <Text style={[styles.statusText, isUpcoming ? styles.statusTextUpcoming : isCancelled ? styles.statusTextCancelled : styles.statusTextCompleted]}>
              {apt.status ? String(apt.status).replace(/_/g, ' ').toUpperCase() : ''}
            </Text>
          </View>
        </View>

        <View style={styles.doctorInfo}>
          <DoctorAvatar
            key={apt.doctor?.did ?? apt.doctor?.id ?? docName}
            uri={pic}
            seed={apt.doctor?.did ?? apt.doctor?.id ?? docName}
            style={styles.doctorImage}
          />
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>{docName}</Text>
            <Text style={styles.doctorSpecialization}>{spec}</Text>
            {apt.doctor?.avg_rating != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 4 }}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={{ fontSize: 12, color: COLORS.gray, marginLeft: 4, fontFamily: FONTS.medium }}>
                  {Number(apt.doctor.avg_rating).toFixed(1)}
                </Text>
              </View>
            )}
            <View style={styles.modeRow}>
              {apt.mode === 'online' ? <Video size={14} color={COLORS.gray} /> : <MapPin size={14} color={COLORS.gray} />}
              <Text style={styles.modeText}>{apt.mode === 'online' ? 'Video Consultation' : 'In-Clinic'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {clinicAddress ? (
          <View style={styles.clinicRow}>
            <MapPin size={14} color={COLORS.gray} style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.clinicAddress} numberOfLines={2}>{clinicAddress}</Text>
          </View>
        ) : null}

        {clinicLocation && isUpcoming ? (
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => { void openDirections(clinicLocation); }}
            activeOpacity={0.8}
          >
            <Navigation size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <TranslatedText style={styles.directionsButtonText}>Get Directions</TranslatedText>
          </TouchableOpacity>
        ) : null}

        {/* AURASUTRA-REVIEWS:appointments_review_card
            Real feedback only: an empty state when there is no review yet, and
            the patient's own rating/comment when there is. Nothing is derived
            from the doctor or synthesised as a placeholder score. */}
        {isCompleted ? (
          <View style={styles.reviewBox}>
            {myReview ? (
              <>
                <View style={styles.reviewHeader}>
                  <Star size={16} color={COLORS.star} fill={COLORS.star} />
                  <Text style={styles.reviewScore}>
                    {myRating != null ? `${myRating}/5` : 'Rated'}
                  </Text>
                  <Text style={styles.reviewLabel}>Your review</Text>
                </View>
                {myReview.comment ? (
                  <Text style={styles.reviewComment}>{myReview.comment}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.reviewPrompt}>
                Share how your consultation went. Your review helps other patients.
              </Text>
            )}
            {!myReview && (
              <TouchableOpacity style={styles.rateButton} onPress={() => goRate(apt.aid)}>
              <Star size={15} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.rateButtonText}>Rate Doctor</Text>
            </TouchableOpacity>
            )}
          </View>
        ) : null}

        {showRefundInput === apt.aid ? (
          <View style={styles.refundContainer}>
            <TextInput
              style={styles.refundInput}
              placeholder="Reason for refund..."
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
            />
            <View style={styles.refundActions}>
              <TouchableOpacity onPress={() => setShowRefundInput(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRequestRefund(apt.aid)} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {isUpcoming && (
              <>
                <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancel(apt.aid)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                {(apt.status === 'confirmed' || apt.status === 'in_progress') && (
                  <TouchableOpacity 
                    style={styles.chatButton} 
                    onPress={() => router.push(`/chat/${apt.aid}`)}
                    activeOpacity={0.8}
                  >
                    <MessageSquare size={16} color="#048256" style={{ marginRight: 6 }} />
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </TouchableOpacity>
                )}

                {apt.mode === 'online' && (apt.status === 'confirmed' || canJoinCall(apt, now)) && (
                  <TouchableOpacity style={styles.joinButton} onPress={() => { if (isNavigatingRef.current) return; isNavigatingRef.current = true; router.push(`/video-call/${apt.aid}`); }}>
                    <Video size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.joinButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            
            {canRefund && (
              <TouchableOpacity style={styles.refundButton} onPress={() => setShowRefundInput(apt.aid)}>
                <RefreshCw size={14} color="#b45309" style={{ marginRight: 6 }} />
                <Text style={styles.refundButtonText}>Request Refund</Text>
              </TouchableOpacity>
            )}

            {apt.refundRequested && (
              <View style={styles.refundStatusBadge}>
                <AlertCircle size={14} color="#0369a1" style={{ marginRight: 4 }} />
                <Text style={styles.refundStatusText}>Refund {apt.refundStatus}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          headerTitle: () => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text }}>Appointments</Text>
              <Text style={{ fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray, marginTop: 1 }}>Consultation schedule</Text>
            </View>
          ),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: COLORS.background }, 
          headerShadowVisible: false, 
          headerTintColor: COLORS.text,
        }} 
      />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              void fetchAppointments(false);
            }} 
            colors={[COLORS.primary]} 
            tintColor={COLORS.primary} 
          />
        }
      >

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}>
            <Hourglass size={14} color={activeTab === 'upcoming' ? '#030315' : '#9ca3af'} />
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}>
            <History size={14} color={activeTab === 'completed' ? '#030315' : '#9ca3af'} />
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>Past</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
            onPress={() => setActiveTab('cancelled')}>
            <Ban size={14} color={activeTab === 'cancelled' ? '#030315' : '#9ca3af'} />
            <Text style={[styles.tabText, activeTab === 'cancelled' && styles.activeTabText]}>Cancelled</Text>
          </TouchableOpacity>
        </View>

        {refreshing && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />}

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarIcon size={32} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No appointments</Text>
            <Text style={styles.emptySubtitle}>You have no appointments in this category.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredAppointments.map(renderAppointmentCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 120 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
  pillBadgeText: { fontSize: 10, fontFamily: FONTS.bold, marginLeft: 6, color: COLORS.gray, letterSpacing: 1 },
  title: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  titleItalic: { fontStyle: 'italic', color: '#9EBF7E' },
  subtitle: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, lineHeight: 20 },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  activeTab: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontFamily: FONTS.bold, marginLeft: 6, color: COLORS.gray },
  activeTabText: { color: COLORS.text },
  
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lightGray, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, textAlign: 'center' },
  
  list: { gap: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
  timeText: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, backgroundColor: COLORS.background, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusUpcoming: { backgroundColor: COLORS.primaryLight },
  statusCompleted: { backgroundColor: COLORS.lightGray },
  statusCancelled: { backgroundColor: COLORS.dangerLight },
  statusText: { fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 0.5 },
  statusTextUpcoming: { color: '#059669' },
  statusTextCompleted: { color: COLORS.gray },
  statusTextCancelled: { color: COLORS.danger },
  
  doctorInfo: { flexDirection: 'row', alignItems: 'center' },
  doctorImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.lightGray },
  doctorImagePlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  doctorDetails: { marginLeft: 12, flex: 1 },
  doctorName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  doctorSpecialization: { fontSize: 13, color: COLORS.gray, fontFamily: FONTS.medium, marginBottom: 4 },
  
  modeRow: { flexDirection: 'row', alignItems: 'center' },
  modeText: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, marginLeft: 6 },
  divider: { height: 1, backgroundColor: COLORS.background, marginVertical: 16 },

  clinicRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -6, marginBottom: 10 },
  clinicAddress: { flex: 1, fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, lineHeight: 16 },
  directionsButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.primary, paddingHorizontal: 12, marginBottom: 4, justifyContent: 'center', borderRadius: 8, height: 36 },
  directionsButtonText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#FFFFFF' },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  cancelButton: { paddingHorizontal: 14, backgroundColor: COLORS.dangerLight, alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 36 },
  cancelButtonText: { color: COLORS.danger, fontSize: 13, fontFamily: FONTS.bold },
  chatButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: '#A7F3D0', justifyContent: 'center', borderRadius: 8, height: 36 },
  chatButtonText: { color: COLORS.primary, fontSize: 13, fontFamily: FONTS.bold },
  joinButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: COLORS.primary, justifyContent: 'center', borderRadius: 8, height: 36 },
  joinButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.bold },
  
  refundButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, height: 36 },
  refundButtonText: { color: '#b45309', fontSize: 13, fontFamily: FONTS.bold },
  refundStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 8, height: 36, backgroundColor: '#f0f9ff' },
  refundStatusText: { color: '#0369a1', fontSize: 12, fontFamily: FONTS.bold, textTransform: 'capitalize' },

  // AURASUTRA-REVIEWS:reviews_styles
  reviewBox: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewScore: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.text },
  reviewLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray },
  reviewComment: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text, lineHeight: 19 },
  reviewPrompt: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, lineHeight: 19 },
  rateButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.primary, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, height: 36 },
  rateButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.bold },
  
  refundContainer: { backgroundColor: COLORS.background, padding: 12, borderRadius: 12 },
  refundInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, padding: 12, height: 80, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text, textAlignVertical: 'top', marginBottom: 12 },
  refundActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { paddingHorizontal: 14, justifyContent: 'center', height: 36 },
  cancelBtnText: { color: COLORS.gray, fontFamily: FONTS.semiBold },
  submitBtn: { backgroundColor: COLORS.text, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', height: 36 },
  submitBtnText: { color: COLORS.white, fontFamily: FONTS.bold },
});




