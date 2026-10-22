import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator , RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pill, FileText, Download, Calendar} from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { syncDoseNotifications, cancelDoseNotification } from '../../lib/doseNotifications';
import { useAuthToken } from '../../hooks/stubs';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { MarkdownText } from '../../components/MarkdownText';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { downloadPrescriptionPdf } from '../../lib/pdfGenerator';

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
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export default function PrescriptionsPage() {
  const router = useRouter();
  const token = useAuthToken();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);


  // Clerk's getToken reference changes across renders. Keeping it in a ref lets
  // the fetch callbacks below hold a stable identity, which is what stops
  // useFocusEffect from re-running (and re-setting state) on every render.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Every sent prescription already has per-dose adherence rows (the API
  // self-heals missing ones on this call), so the Take/Skip controls and the
  // reminder schedule both come from this single fetch.



  // `pid` is no longer passed as a query param: the API derives the patient from
  // the Clerk session, and sending one only invited the caller/server to disagree
  // about whose prescriptions are being read.
  const fetchPrescriptions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetchWithAuth('/api/patient/prescriptions', tokenRef.current);
      const data = await response.json();

      if (!response.ok || !data.success) {
        const apiError = data && data.error;
        throw new Error(apiError || `Request failed (${response.status})`);
      }

      // The API returns { sent, drafts, all }. `all` is the same set as `sent`
      // (the query already filters sent_to_patient = true), so fall back across
      // the shapes rather than rendering an empty list if that changes.
      const pres = data.prescriptions || {};
      const list = pres.all || pres.sent || [];
      let resolved: any[] = [];
      if (Array.isArray(list)) resolved = list;
      setPrescriptions(resolved);
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        setPrescriptions([]);
        setError((err && err.message) || 'Failed to fetch prescriptions');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Refetch on focus: the doctor has to explicitly press "Send" before a
  // prescription becomes visible here, so a stale empty list is the normal case
  // when the patient returns to this screen.
  useFocusEffect(
    useCallback(() => {
      void fetchPrescriptions(true);
    }, [fetchPrescriptions])
  );

  const localDateKey = (value: any) => String(value || '').split('T')[0];

  const todayKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  // prescription_id::medicine_name -> that medicine's dose records






  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Prescriptions', headerStyle: { backgroundColor: COLORS.background }, headerShadowVisible: false, headerTintColor: COLORS.text, headerTitleStyle: { fontFamily: FONTS.bold } }} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await fetchPrescriptions(true);
              } finally {
                setRefreshing(false);
              }
            }} 
            colors={[COLORS.primary]} 
            tintColor={COLORS.primary} 
          />
        }>
        {prescriptions.length === 0 && (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>{(error && 'Could not load') || 'No Prescriptions'}</Text>
            <Text style={styles.emptySubtitle}>
              {error || 'Prescriptions appear here once your doctor has sent them to you.'}
            </Text>
            {!!error && (
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchPrescriptions()}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {prescriptions.length !== 0 && prescriptions.map((prescription, index) => {
          const doc = prescription.doctor || prescription.doctors || {};
          const docUser = doc.user || doc.users || {};
          const rawName = String(docUser.name || doc.name || 'Doctor');
          const docName = rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`;
          const docSpecialization = doc.specialization;
          const pic = docUser.profile_image_url || docUser.profileImageUrl || doc.profile_image_url || doc.profileImageUrl || null;
          const avatarKey = doc.did || doc.id || docName;

          return (
            <View key={prescription.prescription_id || index} style={styles.prescriptionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.doctorHeaderLeft}>
                  <DoctorAvatar
                    key={avatarKey}
                    uri={pic}
                    seed={avatarKey}
                    style={styles.doctorAvatar}
                  />
                  <View style={styles.doctorInfoCol}>
                    <Text style={styles.doctorName}>{docName}</Text>
                    {!!docSpecialization && (
                      <Text style={styles.doctorSpecialization}>{docSpecialization}</Text>
                    )}
                    <View style={styles.dateRow}>
                      <Calendar size={13} color={COLORS.gray} style={{ marginRight: 4 }} />
                      <Text style={styles.dateText}>
                        {new Date(prescription.created_at).toLocaleDateString(undefined, { 
                          year: 'numeric', month: 'short', day: 'numeric' 
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={() => downloadPrescriptionPdf(prescription)}
                  activeOpacity={0.7}
                  accessibilityLabel="Download prescription"
                >
                  <Download size={18} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.diagnosisSection}>
                <Text style={styles.sectionTitle}>Diagnosis</Text>
                <MarkdownText style={styles.diagnosisText}>{prescription.diagnosis || 'No diagnosis recorded'}</MarkdownText>
              </View>

              <View style={styles.medicinesSection}>
                <Text style={styles.sectionTitle}>Medicines ({(prescription.medicines && prescription.medicines.length) || 0})</Text>
                {(prescription.medicines || []).map((med: any, i: number) => (
                  <View key={i} style={styles.medicineItem}>
                    <Pill size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <View style={styles.medicineDetails}>
                      <Text style={styles.medicineName}>{med.name}</Text>
                      <Text style={styles.medicineInstructions}>
                        {med.dosage} � {med.frequency} � {med.duration}
                      </Text>
                      {!!med.notes && <Text style={styles.medicineNotes}>Note: {med.notes}</Text>}
                    </View>
                  </View>
                ))}
              </View>

              {prescription.instructions && (
                <View style={styles.instructionsSection}>
                  <Text style={styles.sectionTitle}>General Instructions</Text>
                  <MarkdownText style={styles.instructionsText}>{prescription.instructions}</MarkdownText>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 120 },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lightGray, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, textAlign: 'center' },
  retryButton: { marginTop: 20, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  retryButtonText: { fontSize: 13, fontFamily: FONTS.bold, color: '#FFFFFF' , },
  prescriptionCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  doctorHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  doctorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.lightGray },
  doctorInfoCol: { marginLeft: 12, flex: 1 },
  doctorName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  doctorSpecialization: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, marginBottom: 3 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium },
  downloadButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  diagnosisSection: { marginBottom: 16 },
  diagnosisText: { fontSize: 15, color: COLORS.text, fontFamily: FONTS.medium },
  medicinesSection: { marginBottom: 16 },
  medicineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, backgroundColor: COLORS.background, padding: 10, borderRadius: 10 },
  medicineDetails: { marginLeft: 10, flex: 1 },
  medicineName: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  medicineInstructions: { fontSize: 12, color: '#059669', fontFamily: FONTS.semiBold, lineHeight: 16 },
  medicineNotes: { fontSize: 11, color: COLORS.gray, fontFamily: FONTS.regular, marginTop: 2, fontStyle: 'italic' },
  instructionsSection: { padding: 12, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  instructionsText: { fontSize: 14, color: '#92400e', fontFamily: FONTS.medium, lineHeight: 20 },
});
