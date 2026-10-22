import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, ImageBackground, Image , RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Mic, MicOff, Sparkles, ArrowRight, Plus } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { normalizeDoctorList, cleanDoctorList, MIN_SYMPTOM_LENGTH } from '../../lib/doctorList';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { useAuthToken } from '../../hooks/stubs';
import { useRouter } from 'expo-router';
import { FONTS } from '../../constants/theme';
import { DoctorProfileModal } from '../../components/DoctorProfileModal';
import { DoctorResultCard } from '../../components/DoctorResultCard';
import { useVoiceSearchContext } from '../../lib/VoiceSearchContext';

export default function DoctorsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const { requestVoiceModal } = useVoiceSearchContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Whether the list on screen is the full directory or a narrowed AI result set. Without this
  // the directory would be silently replaced by an empty list that reads as "no doctors exist".
  const [listSource, setListSource] = useState<'all' | 'ai'>('all');
  const [aiCount, setAiCount] = useState(0);
  const [isAiSearching, setIsAiSearching] = useState(false);
  // `error` replaces the whole list and is reserved for a failed directory load. Search problems
  // are recoverable and belong inline, or the user loses the list they were already reading.
  const [searchError, setSearchError] = useState('');

  // `loading` is only cleared once the request settles, so the spinner cannot flicker off early.
  // The effect body stays free of setState; the flag flips inside the async work.
  const fetchDoctors = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/doctors/find-all', token);
      const data = await response.json();
      
      const list = normalizeDoctorList(data);

      if (list) {
        setDoctors(cleanDoctorList(list));
        setListSource('all');
      } else if (data?.error) {
        setError(data.error);
      } else {
        // Fallback if data is unexpectedly structured
        console.warn("Unexpected API response structure:", data);
        setError('Could not read the doctor list from the server.');
      }
    } catch {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Mount-time fetch. The setState calls live after an `await`, so this is not the synchronous
    // cascade the rule guards against; it just cannot see through the useCallback boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors();
  }, [fetchDoctors]);

  const retryFetch = useCallback(() => {
    setLoading(true);
    setError('');
    fetchDoctors();
  }, [fetchDoctors]);

  /**
   * A dictated phrase is a description of symptoms ("my back is stiff in the mornings"), which the
   * name/specialisation filter below can never match. So the AI matcher gets its own path and its
   * own result set, and the directory filter is left alone for when the user does type a name.
   */
  const runAiSearch = useCallback(async (rawQuery: string) => {
    const symptoms = rawQuery.trim();

    if (symptoms.length < MIN_SYMPTOM_LENGTH) {
      setSearchError(`Please provide more detailed symptoms (at least ${MIN_SYMPTOM_LENGTH} characters)`);
      return;
    }

    setIsAiSearching(true);
    setSearchError('');

    try {
      const response = await fetchWithAuth('/api/ai-doctor-search', token, {
        method: 'POST',
        body: JSON.stringify({ symptoms }),
      });

      const data = await response.json();
      const list = normalizeDoctorList(data);

      if (!list) {
        console.warn("Unexpected /api/ai-doctor-search structure:", JSON.stringify(data)?.slice(0, 400));
        setSearchError(data?.error || 'Could not read the AI matches from the server.');
        return;
      }

      const matches = cleanDoctorList(list);

      if (matches.length === 0) {
        // Keep the full directory on screen rather than replacing it with nothing.
        setSearchError('No AI matches for those symptoms. Showing all doctors below.');
        setListSource('all');
        return;
      }

      setDoctors(matches);
      setAiCount(matches.length);
      setListSource('ai');
    } catch (err) {
      console.error("ai-doctor-search failed:", err);
      setSearchError('Network error. Please try again later.');
    } finally {
      setIsAiSearching(false);
    }
  }, [token]);

  const { isListening, interimTranscript, start, stop } = useVoiceSearch({
    onFinalTranscript: (transcript) => {
      setSearchQuery(transcript);
      runAiSearch(transcript);
    },
  });

  // Only filters the directory listing. When AI results are on screen the list is already the
  // result set, so filtering it again by a symptom phrase would empty it.
  const filteredDoctors = listSource === 'ai' ? doctors : doctors.filter(doctor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = String(doctor.user?.name || doctor.name || '').toLowerCase().includes(query);
    
    let specMatch = false;
    if (Array.isArray(doctor.specialization)) {
      specMatch = doctor.specialization.some((s: string) => String(s).toLowerCase().includes(query));
    } else if (typeof doctor.specialization === 'string') {
      specMatch = doctor.specialization.toLowerCase().includes(query);
    }
    
    return nameMatch || specMatch;
  });

  const showAllDoctors = useCallback(() => {
    setListSource('all');
    setSearchError('');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await fetchDoctors();
              } finally {
                setRefreshing(false);
              }
            }} 
            colors={['#048256']} 
            tintColor={'#048256'} 
          />
        }>
        {/* Banner at the top */}
        {!loading && !error && (
          <View style={styles.bannerCard}>
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
          </View>
        )}


        {/* Search bar. `searchQuery` and `filteredDoctors` existed here for a while with no input
            ever rendered, so typing did nothing at all. */}
        <View style={styles.searchBar}>
          <View style={styles.searchInputRow}>
            <Search size={20} color="#6b7280" style={styles.searchInputIcon} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search by name or describe symptoms..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (searchError) setSearchError('');
                // Typing again should drop back out of a previous AI result set.
                if (listSource === 'ai') setListSource('all');
              }}
              onSubmitEditing={() => {
                // Long enough to read as a symptom description? Let the AI matcher have it.
                if (searchQuery.trim().length >= MIN_SYMPTOM_LENGTH) {
                  runAiSearch(searchQuery);
                }
              }}
              returnKeyType="search"
              submitBehavior="submit"
              editable={!isAiSearching}
            />
            <TouchableOpacity
              onPress={requestVoiceModal}
              disabled={isAiSearching}
              style={styles.micButton}
              accessibilityLabel="Search by voice"
            >
              <Mic size={20} color="#030315" />
            </TouchableOpacity>
          </View>

          {isListening ? (
            <View style={styles.listeningRow}>
              <ActivityIndicator size="small" color="#2da866" />
              <Text style={styles.listeningText} numberOfLines={1}>
                {interimTranscript ? `Listening: ${interimTranscript}` : 'Listening... describe your symptoms'}
              </Text>
            </View>
          ) : null}

          {searchError ? <Text style={styles.inlineError}>{searchError}</Text> : null}
        </View>

        {isAiSearching ? (
          <View style={styles.aiLoading}>
            <ActivityIndicator size="large" color="#2da866" />
            <Text style={styles.loadingText}>Finding the right specialists...</Text>
          </View>
        ) : null}

        {listSource === 'ai' && !loading && !isAiSearching ? (
          <View style={styles.aiBanner}>
            <Sparkles size={16} color="#030315" />
            <Text style={styles.aiBannerText}>
              Showing {aiCount} AI match{aiCount === 1 ? '' : 'es'} for your symptoms
            </Text>
            <TouchableOpacity onPress={showAllDoctors} style={styles.showAllButton}>
              <Text style={styles.showAllButtonText}>Show all doctors</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2da866" />
            <Text style={styles.loadingText}>Loading doctors...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultsSection}>
            {filteredDoctors.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No doctors found matching &quot;{searchQuery}&quot;</Text>
              </View>
            ) : (
              filteredDoctors.map((doctor, index) => (
                <DoctorResultCard
                  key={doctor?.did || doctor?.id || index}
                  doctor={doctor}
                  onPress={(selected) => {
                    setSelectedDoctor(selected);
                    setModalVisible(true);
                  }}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <DoctorProfileModal
        visible={modalVisible}
        doctor={selectedDoctor}
        onClose={() => setModalVisible(false)}
        onBook={() => {
          setModalVisible(false);
          router.push(`/book-appointment?did=${selectedDoctor?.did}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, minHeight: 400, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', textAlign: 'center' },
  errorContainer: { padding: 20, alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12 },
  errorText: { color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  retryButton: { backgroundColor: '#ef4444', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48 },
  retryButtonText: { color: '#fff', fontFamily: FONTS.bold , },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280' },
  searchBar: { marginBottom: 20 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, height: 52 },
  searchInputIcon: { marginRight: 10 },
  searchTextInput: { flex: 1, fontSize: 15, color: '#030315', paddingVertical: 12 },
  micButton: { width: 36,   alignItems: 'center', justifyContent: 'center', marginLeft: 6 , },
  micButtonActive: { backgroundColor: '#ef4444' , },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 8 },
  listeningText: { flex: 1, fontSize: 12, color: '#6b7280' },
  inlineError: { color: '#ef4444', fontSize: 12, marginTop: 10, marginLeft: 4 },
  aiLoading: { paddingVertical: 12, alignItems: 'center' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, backgroundColor: '#048256', borderWidth: 1, borderColor: '#048256', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16 },
  aiBannerText: { flex: 1, fontSize: 12, color: '#030315', fontFamily: FONTS.semiBold },
  showAllButton: { backgroundColor: '#030315', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48 },
  showAllButtonText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bold , },
  resultsSection: { backgroundColor: '#fff' },
  bannerCard: {
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    marginBottom: 24,
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
});




