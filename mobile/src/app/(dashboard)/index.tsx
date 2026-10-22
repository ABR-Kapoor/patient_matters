import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ImageBackground, TextInput, Modal, RefreshControl } from 'react-native';
import { Bell, Search, Star, Heart, Activity, Stethoscope, ChevronRight, Microscope, User, Mic, MicOff, Calendar, Pill, X, ArrowRight, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { DoctorProfileModal } from '../../components/DoctorProfileModal';
import { DoctorResultCard } from '../../components/DoctorResultCard';
import { useVoiceSearchContext } from '../../lib/VoiceSearchContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { normalizeDoctorList, cleanDoctorList, MIN_SYMPTOM_LENGTH } from '../../lib/doctorList';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { useFocusEffect } from 'expo-router';

const COLORS = {
  primary: '#048256',     // Deep emerald green
  primaryLight: '#ECFDF5', 
  text: '#030315',        // Dark text
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  star: '#FBBF24',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export default function Dashboard() {
  const searchInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const { voiceTranscript, clearTranscript, requestVoiceModal } = useVoiceSearchContext();
  const token = useAuthToken();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);
  const uid = identity?.uid;

  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');

  // Search state is deliberately kept apart from `doctors` above: that list is the dashboard's
  // "top specialists" strip and must not be replaced by search output or by an empty result.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resultsVisible, setResultsVisible] = useState(false);
  const currentSearchQuery = voiceTranscript ?? searchQuery;


  const uidRef = useRef(uid);
  uidRef.current = uid;
  const isIdentityLoadingRef = useRef(isIdentityLoading);
  isIdentityLoadingRef.current = isIdentityLoading;
  const isFetchingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isPullToRefresh = false) => {
    if (isFetchingRef.current) return;
    const resolvedToken = typeof token === 'function' ? await token() : token;

    isFetchingRef.current = true;
    if (isPullToRefresh) {
      setRefreshing(true);
    }
    try {
      if (resolvedToken) {
        const [profileRes, statRes, docRes] = await Promise.all([
          fetchWithAuth('/api/patient/profile', resolvedToken).catch(() => null),
          fetchWithAuth('/api/patient/dashboard', resolvedToken).catch(() => null),
          fetchWithAuth('/api/doctors/find-all', resolvedToken).catch(() => null),
        ]);

        if (profileRes) {
          const profileData = await profileRes.json().catch(() => null);
          if (profileData?.success && profileData?.user) {
            if (profileData.user.name) setProfileName(profileData.user.name);
            if (profileData.user.profileImageUrl) setProfileImage(profileData.user.profileImageUrl);
            else if (profileData.user.profile_image_url) setProfileImage(profileData.user.profile_image_url);
          }
        }

        if (statRes) {
          const statData = await statRes.json().catch(() => null);
          if (statData?.success) {
            setStats(statData);
          }
        }

        if (docRes) {
          const docData = await docRes.json().catch(() => null);
          if (docData?.success && docData?.doctors) {
            setDoctors(docData.doctors.slice(0, 3));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const onRefresh = useCallback(() => {
    void fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (!isIdentityLoading) {
      void fetchData(false);
    }
  }, [isIdentityLoading, uid, fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (!isIdentityLoadingRef.current) {
        void fetchData(false);
      }
    }, [fetchData])
  );

  // Search runs against the AI matcher rather than the directory, so the user describes what is
  // wrong instead of having to remember a specialisation name. Speech and typing share this one
  // handler, which is why a dictated phrase is indistinguishable from a typed one by the time it
  // reaches the API.
  const runSearch = useCallback(async (rawQuery: string) => {
    const symptoms = rawQuery.trim();

    if (!symptoms) {
      setSearchError('Describe your symptoms to find the right doctor.');
      setResultsVisible(true);
      return;
    }

    // The endpoint rejects anything shorter; checking here saves a round trip and lets the
    // user fix the problem before the request leaves the device.
    if (symptoms.length < MIN_SYMPTOM_LENGTH) {
      setSearchError(`Please add a little more detail (at least ${MIN_SYMPTOM_LENGTH} characters).`);
      setResultsVisible(true);
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      const response = await fetchWithAuth('/api/ai-doctor-search', token, {
        method: 'POST',
        body: JSON.stringify({ symptoms }),
      });

      const data = await response.json();
      const list = normalizeDoctorList(data);

      if (!list) {
        console.warn('[dashboard] Unexpected /api/ai-doctor-search shape:', JSON.stringify(data)?.slice(0, 400));
        setSearchError(data?.error || 'Could not read the AI matches from the server.');
        return;
      }

      const matches = cleanDoctorList(list);

      if (matches.length === 0) {
        setSearchError('No matches for those symptoms. Try describing them differently.');
        return;
      }

      setSearchResults(matches);
    } catch (err) {
      console.error('[dashboard] ai-doctor-search failed:', err);
      setSearchError('Network error. Please try again later.');
    } finally {
      setIsSearching(false);
      // The sheet opens even on failure so the message is somewhere the user can actually see,
      // rather than being replaced by the placeholder text.
      setResultsVisible(true);
    }
  }, [token]);

  const { isListening, interimTranscript, start, stop, cancel } = useVoiceSearch({
    onFinalTranscript: (transcript) => {
      clearTranscript();
      setSearchQuery(transcript);
      runSearch(transcript);
    },
  });

  const closeResults = useCallback(() => {
    setResultsVisible(false);
    // A session may still be running if the sheet was dismissed mid-utterance.
    cancel();
  }, [cancel]);

  if (isIdentityLoading && loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]} 
            tintColor={COLORS.primary} 
          />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <View style={styles.greetingRow}>
              <Text style={styles.emoji}>{"\uD83D\uDC4B"}</Text>
              <Text style={styles.greeting}>Hello, <Text style={styles.name}>{(profileName || identity?.name || 'Guest').split(' ')[0]}</Text></Text>
            </View>
            <Text style={styles.subtitle}>How are you feeling today?</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
              accessibilityLabel={`Notifications, ${stats?.unreadNotifications || 0} unread`}
            >
              <Bell size={24} color={COLORS.text} />
              {(stats?.unreadNotifications > 0) && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {stats.unreadNotifications > 99 ? '99+' : stats.unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { marginLeft: 8, padding: (profileImage || identity?.profileImageUrl) ? 4 : 10 }]} onPress={() => router.push('/profile')}>
              {(profileImage || identity?.profileImageUrl) ? (
                <Image source={{ uri: (profileImage || identity?.profileImageUrl) }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              ) : (
                <User size={24} color={COLORS.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search doctors, symptoms, ..."
            placeholderTextColor={COLORS.gray}
            value={currentSearchQuery}
            onChangeText={(text) => {
              clearTranscript();
              setSearchQuery(text);
              if (searchError) setSearchError('');
            }}
            onSubmitEditing={() => runSearch(currentSearchQuery)}
            returnKeyType="search"
            submitBehavior="submit"
            editable={!isSearching}
          />
          <TouchableOpacity
            onPress={requestVoiceModal}
            disabled={isSearching}
            style={styles.micButton}
            accessibilityLabel="Search by voice"
          >
            <Mic size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {isListening ? (
          <View style={styles.listeningRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.listeningText} numberOfLines={1}>
              {interimTranscript ? `Listening: ${interimTranscript}` : 'Listening... describe your symptoms'}
            </Text>
          </View>
        ) : null}


        
        {/* Banner */}
        <TouchableOpacity 
          style={styles.bannerCard} 
          onPress={() => router.push('/doctors')}
          activeOpacity={0.9}
        >
          <View style={styles.bannerLeftCol}>
            <View style={styles.careBadge}>
              <Text style={styles.careBadgeText}>24/7 Care</Text>
            </View>
            <Text style={styles.bannerHeadline}>Consult a Doctor{'\n'}Online</Text>
            <Text style={styles.bannerSubtext}>
              Get expert medical advice{'\n'}from the comfort of home.
            </Text>
            <View style={styles.bannerCta}>
              <Text style={styles.bannerCtaText}>Book Now</Text>
              <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          </View>

          <View style={styles.bannerRightCol}>
            <View style={styles.bannerDoctorCircleBg} />
            <Image 
              source={require('../../../assets/images/indian_doctor_banner.png')}
              style={styles.bannerDoctorPhoto}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {/* Quick Links */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Links</Text>
          </View>
          
          <View style={styles.quickLinksGrid}>
            <TouchableOpacity style={[styles.quickLinkBox, { backgroundColor: '#E0F2FE' }]} onPress={() => router.push('/medications')}>
              <Activity size={24} color={COLORS.text} style={styles.qlIcon} />
              <Text style={styles.qlTitle}>Medication{'\n'}Schedule</Text>
              <View style={styles.qlCountBadge}>
                <Text style={styles.qlCount}>{stats?.todayScheduled != null ? `${stats.todayTaken ?? 0}/${stats.todayScheduled}` : 'View'}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.quickLinkBox, { backgroundColor: '#DCFCE7' }]} onPress={() => router.push('/appointments')}>
              <Calendar size={24} color={COLORS.text} style={styles.qlIcon} />
              <Text style={styles.qlTitle}>Upcoming{'\n'}Appointments</Text>
              <View style={styles.qlCountBadge}>
                <Text style={styles.qlCount}>{stats?.upcomingAppointments || 0}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.quickLinkBox, { backgroundColor: '#FEF3C7' }]} onPress={() => router.push('/prescriptions')}>
              <Pill size={24} color={COLORS.text} style={styles.qlIcon} />
              <Text style={styles.qlTitle}>Active{'\n'}Prescriptions</Text>
              <View style={styles.qlCountBadge}>
                <Text style={styles.qlCount}>{stats?.activePrescriptions || 0}</Text>
              </View>
            </TouchableOpacity>
            
            <View style={[styles.quickLinkBox, { backgroundColor: '#F3E8FF' }]}>
              <Stethoscope size={24} color={COLORS.text} style={styles.qlIcon} />
              <Text style={styles.qlTitle}>Pharmacy</Text>
              <Text style={styles.qlSubtitle}>Coming soon</Text>
            </View>
          </View>
        </View>
        
        {/* Popular Doctors */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Doctors</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/doctors')}>
               <Text style={styles.seeAllText}>See All</Text>
               <ChevronRight size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          
          {doctors.map((doctor, index) => (
              <DoctorResultCard
                key={doctor?.did || index}
                doctor={doctor}
                onPress={(d) => {
                  setSelectedDoctor(d);
                  setModalVisible(true);
                }}
              />
            ))}

          {doctors.length === 0 && (
            <Text style={{textAlign: 'center', color: COLORS.gray, marginTop: 20}}>No doctors found. Ensure backend is running.</Text>
          )}

        </View>
        
        {/* Footer Banner */}
        <View style={styles.footerBannerContainer}>
          <Image 
            source={require('../../../assets/images/goHealth_footer_banner.png')} 
            style={styles.footerBannerImage} resizeMode="cover"
          />
        </View>
        
      </ScrollView>

      {/* Search results are a sheet over the dashboard rather than a navigation away, so the
          user can compare a match against the specialists strip without losing their place. */}
      <Modal
        visible={resultsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeResults}
      >
        <SafeAreaView style={styles.resultsSheet} edges={['top', 'bottom']}>
          <View style={styles.resultsHeader}>
            <View style={styles.resultsHeaderText}>
              <Text style={styles.resultsTitle}>Suggested doctors</Text>
              <Text style={styles.resultsSubtitle} numberOfLines={1}>
                {isSearching ? 'Matching your symptoms...' : `For "${currentSearchQuery}"`}
              </Text>
            </View>
            <TouchableOpacity onPress={closeResults} style={styles.resultsClose} accessibilityLabel="Close results">
              <X size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {isSearching ? (
            <View style={styles.resultsCenter}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : searchError ? (
            <View style={styles.resultsCenter}>
              <Text style={styles.resultsError}>{searchError}</Text>
              <TouchableOpacity style={styles.resultsRetry} onPress={() => runSearch(currentSearchQuery)}>
                <Text style={styles.resultsRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.resultsList} showsVerticalScrollIndicator={false}>
              {searchResults.map((doctor, index) => (
                <DoctorResultCard
                  key={doctor?.did || doctor?.id || index}
                  doctor={doctor}
                  onPress={(selected) => {
                    setSelectedDoctor(selected);
                    setModalVisible(true);
                  }}
                />
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <DoctorProfileModal
        visible={modalVisible}
        doctor={selectedDoctor}
        onClose={() => setModalVisible(false)}
        onBook={() => {
          setModalVisible(false);
          setResultsVisible(false);
          router.push(`/book-appointment?did=${selectedDoctor?.did}`);
        }}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  scrollContent: { paddingTop: 16, paddingBottom: 140 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingHorizontal: 16 },
  headerTextContainer: { flex: 1 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  emoji: { fontSize: 20, marginRight: 8 },
  greeting: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text, lineHeight: 24 },
  name: { fontFamily: FONTS.bold },
  subtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, lineHeight: 18, marginTop: 2 },
  iconButton: { backgroundColor: COLORS.white, position: 'relative', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, backgroundColor: COLORS.primary, borderRadius: 12, borderWidth: 1, borderColor: COLORS.white },
  notificationBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    minWidth: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#EF4444', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 4,
    borderWidth: 2, 
    borderColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  notificationBadgeText: { 
    color: '#FFFFFF', 
    fontSize: 10, 
    fontFamily: FONTS.bold, 
    textAlign: 'center',
    lineHeight: 12,
  },
  
  searchContainer: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, height: 56, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: COLORS.lightGray },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.text, paddingVertical: 0, height: 48, textAlignVertical: 'center' },
  // The mic is a real toggle now, so it needs a hit area and a visible pressed/listening state
  // rather than sitting as a bare icon in the row.
  micButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginRight: -8 },
  micButtonActive: { backgroundColor: '#ef4444' , },
  listeningRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -12, marginBottom: 20, paddingHorizontal: 8 },
  listeningText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray },

  resultsSheet: { flex: 1, backgroundColor: COLORS.white },
  resultsHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  resultsHeaderText: { flex: 1 },
  resultsTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  resultsSubtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, marginTop: 2 },
  resultsClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  resultsCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  resultsError: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray, textAlign: 'center' },
  resultsRetry: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  resultsRetryText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 14 },
  resultsList: { paddingHorizontal: 16, paddingBottom: 24 },


  
  bannerCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerLeftCol: {
    flex: 1,
    paddingRight: 10,
    zIndex: 2,
  },
  careBadge: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  careBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: '#030315',
  },
  bannerHeadline: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#030315',
    lineHeight: 25,
    marginBottom: 6,
  },
  bannerSubtext: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 14,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#048256',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#048256',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerCtaText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  bannerRightCol: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 155,
    height: 175,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bannerDoctorCircleBg: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#BBF7D0',
    opacity: 0.9,
    top: 5,
    right: 5,
  },
  bannerDoctorPhoto: {
    width: 155,
    height: 175,
    zIndex: 2,
  },
  
  section: { marginBottom: 32, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.gray, marginRight: 2 },
  
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickLinkBox: { width: '48%', backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.lightGray, position: 'relative', minHeight: 115 },
  qlIcon: { marginBottom: 12 },
  qlTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text, lineHeight: 20 },
  qlSubtitle: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray, marginTop: 4 },
  qlCountBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.background, minWidth: 28, height: 28, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  qlCount: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.text },
  
  doctorCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  doctorLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  doctorAvatar: { width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.lightGray, marginRight: 12 },
  doctorAvatarPlaceholder: { width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  doctorSpec: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.text, marginLeft: 4 },
  reviewsText: { color: COLORS.gray, fontFamily: FONTS.regular },
  
  doctorRight: { alignItems: 'flex-end', marginLeft: 8 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  feeLabel: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, marginRight: 4 },
  feeValue: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
  bookButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookButtonText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 13, lineHeight: 18 },
  
  footerBannerContainer: { marginTop: 10, marginBottom: 0, width: '100%', aspectRatio: 0.95, overflow: 'hidden' },
  footerBannerImage: { width: '100%', height: '100%' },
});







