// AURASUTRA-REVIEWS:remove_fake_ratings_find_doctors
// Reconstructed 2026-10-04: the previous revision of this file was destroyed by
// a bad batch edit, so the screen was rewritten from its sibling doctors.tsx
// (same data source, search, voice and AI-search behaviour) plus the
// specialization/city filters from the web find-doctors page. Ratings shown
// here are real aggregates only (`avg_rating`/`total_reviews` via
// DoctorResultCard); unrated doctors render a "NEW" pill, never a
// synthesised score.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator , RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Mic, MicOff, Sparkles, SlidersHorizontal, Filter } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { normalizeDoctorList, cleanDoctorList, MIN_SYMPTOM_LENGTH } from '../../lib/doctorList';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { useAuthToken } from '../../hooks/stubs';
import { useRouter, Stack } from 'expo-router';
import { FONTS } from '../../constants/theme';
import { DoctorProfileModal } from '../../components/DoctorProfileModal';
import { DoctorResultCard } from '../../components/DoctorResultCard';
import { useVoiceSearchContext } from '../../lib/VoiceSearchContext';

type SortMode = 'recommended' | 'top_rated' | 'fee_low';

function getSpecs(doctor: any): string[] {
  if (Array.isArray(doctor?.specialization)) return doctor.specialization.map(String);
  if (typeof doctor?.specialization === 'string' && doctor.specialization) return [doctor.specialization];
  return [];
}

function getAvgRating(doctor: any): number | null {
  const raw = doctor?.avg_rating ?? doctor?.avgRating ?? doctor?.averageRating ?? null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getFee(doctor: any): number {
  const raw = doctor?.consultation_fee ?? doctor?.consultationFee ?? doctor?.fee ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function FindDoctorsPage() {
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

  const [selectedSpec, setSelectedSpec] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [showFilters, setShowFilters] = useState(false);

  const [listSource, setListSource] = useState<'all' | 'ai'>('all');
  const [aiCount, setAiCount] = useState(0);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

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
        console.warn('Unexpected API response structure:', data);
        setError('Could not read the doctor list from the server.');
      }
    } catch {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors();
  }, [fetchDoctors]);

  const retryFetch = useCallback(() => {
    setLoading(true);
    setError('');
    fetchDoctors();
  }, [fetchDoctors]);

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
        console.warn('Unexpected /api/ai-doctor-search structure:', JSON.stringify(data)?.slice(0, 400));
        setSearchError(data?.error || 'Could not read the AI matches from the server.');
        return;
      }

      const matches = cleanDoctorList(list);

      if (matches.length === 0) {
        setSearchError('No AI matches for those symptoms. Showing all doctors below.');
        setListSource('all');
        return;
      }

      setDoctors(matches);
      setAiCount(matches.length);
      setListSource('ai');
    } catch (err) {
      console.error('ai-doctor-search failed:', err);
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

  const allSpecs = useMemo(
    () => Array.from(new Set(doctors.flatMap(getSpecs))).sort(),
    [doctors],
  );
  const allCities = useMemo(
    () => Array.from(new Set(doctors.map((d) => String(d?.city || '')).filter(Boolean))).sort(),
    [doctors],
  );

  const filteredDoctors = useMemo(() => {
    // AI results are already the result set; only the directory gets filtered.
    const base = listSource === 'ai' ? [...doctors] : doctors.filter((doctor) => {
      if (selectedSpec !== 'all' && !getSpecs(doctor).includes(selectedSpec)) return false;
      if (selectedCity !== 'all' && String(doctor?.city || '') !== selectedCity) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = String(doctor.user?.name || doctor.name || '').toLowerCase().includes(query);
        const specMatch = getSpecs(doctor).some((s) => s.toLowerCase().includes(query));
        const cityMatch = String(doctor?.city || '').toLowerCase().includes(query);
        if (!nameMatch && !specMatch && !cityMatch) return false;
      }
      return true;
    });

    if (sortMode === 'top_rated') {
      base.sort((a, b) => {
        const ra = getAvgRating(a);
        const rb = getAvgRating(b);
        // Unrated doctors sink below rated ones instead of borrowing a score.
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        if (rb !== ra) return rb - ra;
        const tb = Number(b?.total_reviews ?? b?.totalReviews ?? 0) || 0;
        const ta = Number(a?.total_reviews ?? a?.totalReviews ?? 0) || 0;
        return tb - ta;
      });
    } else if (sortMode === 'fee_low') {
      base.sort((a, b) => getFee(a) - getFee(b));
    }
    return base;
  }, [doctors, listSource, searchQuery, selectedSpec, selectedCity, sortMode]);

  const showAllDoctors = useCallback(() => {
    setListSource('all');
    setSearchError('');
  }, []);

  const activeFilterCount =
    (selectedSpec !== 'all' ? 1 : 0) + (selectedCity !== 'all' ? 1 : 0) + (sortMode !== 'recommended' ? 1 : 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Find Doctors',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowFilters((v) => !v)}
              activeOpacity={0.7}
              style={[
                styles.headerFilterButton,
                showFilters && styles.headerFilterButtonActive,
              ]}
              accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
            >
              <Filter
                size={18}
                color={showFilters || activeFilterCount > 0 ? '#048256' : '#374151'}
              />
              {activeFilterCount > 0 && (
                <View style={styles.headerFilterBadge}>
                  <Text style={styles.headerFilterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ),
        }}
      />
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
        <View style={styles.searchBar}>
          <View style={styles.searchInputRow}>
            <Search size={20} color="#6b7280" style={styles.searchInputIcon} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search name, speciality or city..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (searchError) setSearchError('');
                if (listSource === 'ai') setListSource('all');
              }}
              onSubmitEditing={() => {
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

          {showFilters ? (
            <View style={styles.filtersBox}>
              <Text style={styles.filterLabel}>Speciality</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {['all', ...allSpecs].map((spec) => (
                  <TouchableOpacity
                    key={spec}
                    style={[styles.chip, selectedSpec === spec && styles.chipActive]}
                    onPress={() => setSelectedSpec(spec)}
                  >
                    <Text style={[styles.chipText, selectedSpec === spec && styles.chipTextActive]}>
                      {spec === 'all' ? 'All' : spec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {allCities.length > 0 ? (
                <>
                  <Text style={styles.filterLabel}>City</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {['all', ...allCities].map((city) => (
                      <TouchableOpacity
                        key={city}
                        style={[styles.chip, selectedCity === city && styles.chipActive]}
                        onPress={() => setSelectedCity(city)}
                      >
                        <Text style={[styles.chipText, selectedCity === city && styles.chipTextActive]}>
                          {city === 'all' ? 'All' : city}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Text style={styles.filterLabel}>Sort by</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['recommended', 'Recommended'],
                    ['top_rated', 'Top rated'],
                    ['fee_low', 'Fee: low to high'],
                  ] as [SortMode, string][]
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.chip, sortMode === mode && styles.chipActive]}
                    onPress={() => setSortMode(mode)}
                  >
                    <Text style={[styles.chipText, sortMode === mode && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
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
            <Text style={styles.resultsCount}>
              {filteredDoctors.length} result{filteredDoctors.length === 1 ? '' : 's'}
            </Text>
            {filteredDoctors.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No doctors match these filters</Text>
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  loadingContainer: { flex: 1, minHeight: 400, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', textAlign: 'center' },
  errorContainer: { padding: 20, alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12 },
  errorText: { color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  retryButton: { backgroundColor: '#ef4444', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48 },
  retryButtonText: { color: '#fff', fontFamily: FONTS.bold },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 14, fontFamily: FONTS.regular },
  headerFilterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: '#fff',
    position: 'relative',
  },
  headerFilterButtonActive: {
    borderColor: '#048256',
    backgroundColor: '#ECFDF5',
  },
  headerFilterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#048256',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerFilterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: FONTS.bold,
  },
  searchBar: { marginBottom: 20 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, height: 52 },
  searchInputIcon: { marginRight: 10 },
  searchTextInput: { flex: 1, fontSize: 15, color: '#030315', paddingVertical: 12 },
  micButton: { width: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  micButtonActive: { backgroundColor: '#ef4444' },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 8 },
  listeningText: { flex: 1, fontSize: 12, color: '#6b7280' },
  inlineError: { color: '#ef4444', fontSize: 12, marginTop: 10, marginLeft: 4 },
  filtersBox: { marginTop: 8, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 },
  filterLabel: { fontSize: 12, fontFamily: FONTS.bold, color: '#6b7280', marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: '#030315', borderColor: '#030315' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff', fontFamily: FONTS.semiBold },
  aiLoading: { paddingVertical: 12, alignItems: 'center' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, backgroundColor: '#048256', borderWidth: 1, borderColor: '#048256', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16 },
  aiBannerText: { flex: 1, fontSize: 12, color: '#030315', fontFamily: FONTS.semiBold },
  showAllButton: { backgroundColor: '#030315', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48 },
  showAllButtonText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bold },
  resultsSection: { backgroundColor: '#fff' },
  resultsCount: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
});
