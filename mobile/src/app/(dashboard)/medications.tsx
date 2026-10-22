import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView , RefreshControl } from 'react-native';
import { CheckCircle2, XCircle, Clock, Pill, Bell, Download } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { syncDoseNotifications, cancelDoseNotification } from '../../lib/doseNotifications';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { downloadMedicationSchedulePdf } from '../../lib/pdfGenerator';
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
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export default function MedicationsPage() {
  const token = useAuthToken();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);
  const pid = identity?.pid;
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [adherence, setAdherence] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast, showAlert } = useNotification();

  const fetchData = async () => {
    try {
      const [statsRes, adherenceRes] = await Promise.all([
        fetchWithAuth(`/api/patient/adherence/stats?pid=${pid}`, token),
        fetchWithAuth(`/api/patient/adherence?pid=${pid}`, token)
      ]);
      
      const statsData = await statsRes.json();
      const adherenceData = await adherenceRes.json();
      
      if (statsData.success) setStats(statsData.stats);
      if (adherenceData.success) {
        setAdherence(adherenceData.adherence);
        void syncDoseNotifications(adherenceData.adherence?.all || []);
      }
    } catch (err) {
      console.error(err);
      showAlert('Fetch Error', 'Failed to fetch medication schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isIdentityLoading) return;
    if (!pid) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [pid, isIdentityLoading]);

  const handleUpdateStatus = async (adherenceId: string, status: 'taken' | 'skipped') => {
    // Optimistic local update
    setAdherence((prev: any) => {
      if (!prev) return prev;
      let targetItem: any = null;
      const filterOut = (list: any[]) => (list || []).filter((item: any) => {
        if (item.adherence_id === adherenceId) {
          targetItem = { ...item, is_taken: status === 'taken', is_skipped: status === 'skipped', status };
          return false;
        }
        return true;
      });

      const nextPending = filterOut(prev.pending);
      const nextDueNow = filterOut(prev.dueNow);
      const nextOverdue = filterOut(prev.overdue);

      if (!targetItem) return prev;

      return {
        ...prev,
        pending: nextPending,
        dueNow: nextDueNow,
        overdue: nextOverdue,
        taken: status === 'taken' ? [targetItem, ...(prev.taken || [])] : (prev.taken || []),
        skipped: status === 'skipped' ? [targetItem, ...(prev.skipped || [])] : (prev.skipped || []),
      };
    });
    try {
      setRefreshing(true);
      const res = await fetchWithAuth('/api/patient/adherence', token, {
        method: 'PATCH',
        body: JSON.stringify({ adherenceId, status })
      });
      const data = await res.json();
      if (data.success) {
        await cancelDoseNotification(adherenceId);
        await fetchData(); // Refresh data
      } else {
        showAlert('Update Failed', data.error || 'Failed to update status');
        setRefreshing(false);
      }
    } catch (err) {
      showAlert('Network Error', 'Please check your connection and try again.');
      setRefreshing(false);
    }
  };

  const handleSnooze = async (adherenceId: string) => {
    try {
      setRefreshing(true);
      const res = await fetchWithAuth('/api/patient/adherence/snooze', token, {
        method: 'POST',
        body: JSON.stringify({ adherenceId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Reminder Snoozed', 'We will remind you again in 15 minutes.');
      } else {
        showAlert('Snooze Failed', data.error || 'Failed to snooze reminder');
      }
    } catch (err) {
      showAlert('Network Error', 'Please check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderMedicationCard = (item: any, type: 'pending' | 'taken' | 'skipped') => (
    <View key={item.adherence_id} style={styles.medCard}>
      <View style={styles.medHeader}>
        <View style={styles.medIconContainer}>
          <Pill size={24} color="#059669" />
        </View>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{item.medicine_name}</Text>
          <Text style={styles.medDosage}>{item.dosage} â€¢ {item.frequency}</Text>
          <View style={styles.timeRow}>
            <Clock size={14} color="#6b7280" />
            <Text style={styles.timeText}>{item.scheduled_time.substring(0, 5)}</Text>
          </View>
        </View>
      </View>
      
      {type === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.snoozeButton]} 
            onPress={() => handleSnooze(item.adherence_id)}
          >
            <Bell size={16} color="#4b5563" style={styles.actionIcon} />
            <Text style={styles.snoozeText}>Snooze</Text>
          </TouchableOpacity>
          <View style={styles.mainActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.skipButton]} 
              onPress={() => handleUpdateStatus(item.adherence_id, 'skipped')}
            >
              <XCircle size={16} color="#ef4444" style={styles.actionIcon} />
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.takeButton]} 
              onPress={() => handleUpdateStatus(item.adherence_id, 'taken')}
            >
              <CheckCircle2 size={16} color="#fff" style={styles.actionIcon} />
              <Text style={styles.takeText}>Take</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {type !== 'pending' && (
        <View style={[styles.statusBadge, type === 'taken' ? styles.statusBadgeTaken : styles.statusBadgeSkipped]}>
          <Text style={[styles.statusText, type === 'taken' ? styles.statusTextTaken : styles.statusTextSkipped]}>
            {type === 'taken' ? 'Taken' : 'Skipped'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Medications', headerStyle: { backgroundColor: COLORS.background }, headerShadowVisible: false, headerTintColor: COLORS.text, headerTitleStyle: { fontFamily: FONTS.bold } }} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await fetchData();
              } finally {
                setRefreshing(false);
              }
            }} 
            colors={[COLORS.primary]} 
            tintColor={COLORS.primary} 
          />
        }>

        {stats && (
          <LinearGradient colors={[COLORS.white, COLORS.primaryLight]} style={styles.statsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.statsTitle, { marginBottom: 0 }]}>Today's Schedule</Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await downloadMedicationSchedulePdf(adherence, stats);
                  } catch (e) {
                    console.error('Download schedule failed:', e);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.white,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 12,
                  shadowColor: COLORS.text,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
                activeOpacity={0.7}
                accessibilityLabel="Download medication schedule"
              >
                <Download size={14} color={COLORS.text} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text }}>Download PDF</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.todayTaken ?? 0} / {stats.todayScheduled ?? 0}</Text>
                <Text style={styles.statLabel}>Doses Taken</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.todaySkipped ?? 0}</Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.max(0, (stats.todayScheduled ?? 0) - (stats.todayTaken ?? 0) - (stats.todaySkipped ?? 0))}</Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {refreshing && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Today</Text>
          {(adherence?.pending?.length > 0 || adherence?.overdue?.length > 0 || adherence?.dueNow?.length > 0) ? (
            (() => {
              const seen = new Set<string>();
              const merged = [
                ...(adherence?.overdue || []),
                ...(adherence?.pending || []),
                ...(adherence?.dueNow || []),
              ].filter((item: any) => {
                if (seen.has(item.adherence_id)) return false;
                seen.add(item.adherence_id);
                return true;
              }).sort((a: any, b: any) => String(a.scheduled_time).localeCompare(String(b.scheduled_time)));
              return merged.map((item: any) => renderMedicationCard(item, 'pending'));
            })()
          ) : (
            <View style={styles.emptyState}>
              <CheckCircle2 size={40} color={COLORS.primary} />
              <Text style={styles.emptyText}>All caught up for now!</Text>
            </View>
          )}
        </View>

        {(adherence?.taken?.length > 0 || adherence?.skipped?.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Today</Text>
            {adherence?.taken?.map((item: any) => renderMedicationCard(item, 'taken'))}
            {adherence?.skipped?.map((item: any) => renderMedicationCard(item, 'skipped'))}
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
  statsCard: { borderRadius: 12, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: COLORS.primaryLight },
  statsTitle: { color: COLORS.text, fontSize: 14, fontFamily: FONTS.semiBold, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.regular },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.gray, opacity: 0.2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 16 },
  medCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  medHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  medIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  medDosage: { fontSize: 13, color: '#059669', fontFamily: FONTS.medium, marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, marginLeft: 6 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.background },
  mainActions: { flexDirection: 'row', gap: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, },
  snoozeButton: { backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, height: 34 },
  skipButton: { backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: COLORS.dangerLight, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, height: 34 },
  takeButton: { backgroundColor: COLORS.text, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, height: 34 },
  actionIcon: { marginRight: 6 },
  snoozeText: { color: COLORS.gray, fontSize: 13, fontFamily: FONTS.semiBold },
  skipText: { color: COLORS.danger, fontSize: 13, fontFamily: FONTS.bold },
  takeText: { color: COLORS.white, fontSize: 13, fontFamily: FONTS.bold },
  statusBadge: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTaken: { backgroundColor: COLORS.primaryLight },
  statusBadgeSkipped: { backgroundColor: COLORS.dangerLight },
  statusText: { fontSize: 12, fontFamily: FONTS.bold },
  statusTextTaken: { color: '#059669' },
  statusTextSkipped: { color: COLORS.danger },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.lightGray },
  emptyText: { marginTop: 12, color: COLORS.text, fontFamily: FONTS.medium },
});






