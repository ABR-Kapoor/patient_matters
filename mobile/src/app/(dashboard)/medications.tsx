import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, RefreshControl } from 'react-native';
import { CheckCircle2, XCircle, Clock, Pill, Bell, Download } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { syncDoseNotifications, cancelDoseNotification } from '../../lib/doseNotifications';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { downloadMedicationSchedulePdf } from '../../lib/pdfGenerator';
import { useNotification } from '../../lib/NotificationContext';
import { MedicineIcon3D } from '../../components/MedicineIcon3D';

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
  amber: '#D97706',
  amberLight: '#FEF3C7',
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

  const getClientTimeParams = () => {
    const now = new Date();
    const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const clientTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
    return { clientDate, clientTime };
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!pid) return;
    try {
      if (!silent) setRefreshing(true);
      const { clientDate, clientTime } = getClientTimeParams();
      const [statsRes, adherenceRes] = await Promise.all([
        fetchWithAuth(`/api/patient/adherence/stats?pid=${pid}&client_date=${clientDate}&client_time=${clientTime}`, token),
        fetchWithAuth(`/api/patient/adherence?pid=${pid}&client_date=${clientDate}&client_time=${clientTime}`, token)
      ]);
      
      const statsData = await statsRes.json();
      const adherenceData = await adherenceRes.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (adherenceData.success && adherenceData.adherence) {
        setAdherence(adherenceData.adherence);
        // Also sync backend stats if available
        if (adherenceData.adherence.stats && (!statsData.success || !statsData.stats)) {
          setStats(adherenceData.adherence.stats);
        }
        void syncDoseNotifications(adherenceData.adherence?.all || []);
      }
    } catch (err) {
      console.error('[Medications] Fetch error:', err);
      if (!silent) {
        showAlert('Fetch Error', 'Failed to fetch medication schedule.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pid, token]);

  useEffect(() => {
    if (isIdentityLoading) return;
    if (!pid) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [pid, isIdentityLoading, fetchData]);

  const handleUpdateStatus = async (adherenceId: string, status: 'taken' | 'skipped') => {
    // 1. Optimistic update for immediate visual feedback
    setAdherence((prev: any) => {
      if (!prev) return prev;
      let targetItem: any = null;
      const filterOut = (list: any[]) => (list || []).filter((item: any) => {
        if (item.adherence_id === adherenceId) {
          targetItem = { 
            ...item, 
            is_taken: status === 'taken', 
            is_skipped: status === 'skipped', 
            is_snoozed: false,
            snoozed_until: null,
            status 
          };
          return false;
        }
        return true;
      });

      const nextPending = filterOut(prev.pending);
      const nextDueNow = filterOut(prev.dueNow);
      const nextOverdue = filterOut(prev.overdue);
      const nextSnoozed = filterOut(prev.snoozed);

      if (!targetItem) return prev;

      return {
        ...prev,
        pending: nextPending,
        dueNow: nextDueNow,
        overdue: nextOverdue,
        snoozed: nextSnoozed,
        taken: status === 'taken' ? [targetItem, ...(prev.taken || [])] : (prev.taken || []),
        skipped: status === 'skipped' ? [targetItem, ...(prev.skipped || [])] : (prev.skipped || []),
        completedToday: [targetItem, ...(prev.completedToday || [])],
      };
    });

    // 2. Optimistically update stats numbers
    setStats((prevStats: any) => {
      if (!prevStats) return prevStats;
      const currentTaken = prevStats.todayTaken ?? 0;
      const currentSkipped = prevStats.todaySkipped ?? 0;
      const currentScheduled = prevStats.todayScheduled ?? 0;
      const nextTaken = status === 'taken' ? currentTaken + 1 : currentTaken;
      const nextSkipped = status === 'skipped' ? currentSkipped + 1 : currentSkipped;
      return {
        ...prevStats,
        todayTaken: nextTaken,
        todaySkipped: nextSkipped,
        todayScheduled: Math.max(currentScheduled, nextTaken + nextSkipped),
        todayRemaining: Math.max(0, currentScheduled - nextTaken - nextSkipped)
      };
    });

    try {
      const res = await fetchWithAuth('/api/patient/adherence', token, {
        method: 'PATCH',
        body: JSON.stringify({ adherenceId, status })
      });
      const data = await res.json();
      if (data.success) {
        await cancelDoseNotification(adherenceId);
        // Refresh silently from backend
        await fetchData(true);
      } else {
        showAlert('Update Failed', data.error || 'Failed to update status');
        await fetchData(true);
      }
    } catch (err) {
      showAlert('Network Error', 'Please check your connection and try again.');
      await fetchData(true);
    }
  };

  const handleSnooze = async (adherenceId: string) => {
    // 1. Optimistic update: move to snoozed
    const snoozeDurationMs = 15 * 60 * 1000;
    const snoozedUntilDate = new Date(Date.now() + snoozeDurationMs);
    const snoozeTimeStr = `${snoozedUntilDate.getHours().toString().padStart(2, '0')}:${snoozedUntilDate.getMinutes().toString().padStart(2, '0')}`;

    setAdherence((prev: any) => {
      if (!prev) return prev;
      let targetItem: any = null;
      const filterOut = (list: any[]) => (list || []).filter((item: any) => {
        if (item.adherence_id === adherenceId) {
          targetItem = { 
            ...item, 
            is_snoozed: true, 
            snoozed_until: snoozedUntilDate.toISOString(),
            reminder_snoozed_until: snoozedUntilDate.toISOString()
          };
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
        snoozed: [targetItem, ...(prev.snoozed || [])]
      };
    });

    showToast('Reminder Snoozed', `We will remind you again at ${snoozeTimeStr} (15 mins).`);

    try {
      const res = await fetchWithAuth('/api/patient/adherence/snooze', token, {
        method: 'POST',
        body: JSON.stringify({ adherenceId, durationMinutes: 15 })
      });
      const data = await res.json();
      if (data.success) {
        await cancelDoseNotification(adherenceId);
        await fetchData(true);
      } else {
        showAlert('Snooze Failed', data.error || 'Failed to snooze reminder');
        await fetchData(true);
      }
    } catch (err) {
      showAlert('Network Error', 'Please check your connection and try again.');
      await fetchData(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const formatSnoozeTime = (timestamp: string | null) => {
    if (!timestamp) return '15 mins';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '15 mins';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMedicationCard = (item: any, type: 'pending' | 'snoozed' | 'taken' | 'skipped') => (
    <View key={item.adherence_id} style={[styles.medCard, type === 'snoozed' && styles.medCardSnoozed]}>
      <View style={styles.medHeader}>
        <View style={[styles.medIconContainer, type === 'snoozed' && styles.medIconContainerSnoozed]}>
          <MedicineIcon3D size={26} />
        </View>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{item.medicine_name}</Text>
          <View style={styles.medDosageRow}>
            <MedicineIcon3D size={14} style={{ marginRight: 4 }} />
            <Text style={styles.medDosage}>{item.dosage} • {item.frequency}</Text>
          </View>
          <View style={styles.timeRow}>
            <Clock size={14} color="#6b7280" />
            <Text style={styles.timeText}>{String(item.scheduled_time || '').substring(0, 5)}</Text>
            {type === 'snoozed' && (
              <View style={styles.snoozedTag}>
                <Bell size={12} color={COLORS.amber} style={{ marginRight: 4 }} />
                <Text style={styles.snoozedTagText}>Snoozed until {formatSnoozeTime(item.snoozed_until || item.reminder_snoozed_until)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {(type === 'pending' || type === 'snoozed') && (
        <View style={styles.actionRow}>
          {type === 'pending' ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.snoozeButton]} 
              onPress={() => handleSnooze(item.adherence_id)}
            >
              <Bell size={16} color="#4b5563" style={styles.actionIcon} />
              <Text style={styles.snoozeText}>Snooze</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.snoozedPill}>
              <Bell size={14} color={COLORS.amber} style={{ marginRight: 4 }} />
              <Text style={styles.snoozedPillText}>Snoozed</Text>
            </View>
          )}
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
      
      {(type === 'taken' || type === 'skipped') && (
        <View style={[styles.statusBadge, type === 'taken' ? styles.statusBadgeTaken : styles.statusBadgeSkipped]}>
          <Text style={[styles.statusText, type === 'taken' ? styles.statusTextTaken : styles.statusTextSkipped]}>
            {type === 'taken' ? 'Taken' : 'Skipped'}
          </Text>
        </View>
      )}
    </View>
  );

  const dueItems = (() => {
    const seen = new Set<string>();
    return [
      ...(adherence?.overdue || []),
      ...(adherence?.pending || []),
      ...(adherence?.dueNow || []),
    ].filter((item: any) => {
      if (!item || item.is_taken || item.is_skipped || item.is_snoozed) return false;
      if (seen.has(item.adherence_id)) return false;
      seen.add(item.adherence_id);
      return true;
    }).sort((a: any, b: any) => String(a.scheduled_time).localeCompare(String(b.scheduled_time)));
  })();

  const snoozedItems = (adherence?.snoozed || []).filter((item: any) => !item.is_taken && !item.is_skipped);

  const completedTodayItems = (() => {
    if (Array.isArray(adherence?.completedToday) && adherence.completedToday.length > 0) {
      return adherence.completedToday;
    }
    const seen = new Set<string>();
    return [
      ...(adherence?.taken || []),
      ...(adherence?.skipped || []),
    ].filter((item: any) => {
      if (!item) return false;
      if (seen.has(item.adherence_id)) return false;
      seen.add(item.adherence_id);
      return true;
    });
  })();

  const scheduledCount = stats?.todayScheduled ?? 0;
  const takenCount = stats?.todayTaken ?? 0;
  const skippedCount = stats?.todaySkipped ?? 0;
  const remainingCount = Math.max(0, scheduledCount - takenCount - skippedCount);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Medications', headerStyle: { backgroundColor: COLORS.background }, headerShadowVisible: false, headerTintColor: COLORS.text, headerTitleStyle: { fontFamily: FONTS.bold } }} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchData(false)} 
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
                  borderWidth: 1,
                  borderColor: COLORS.primaryLight,
                  gap: 6
                }}
              >
                <Download size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary }}>PDF</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{takenCount}</Text>
                <Text style={styles.statLabel}>Taken</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{skippedCount}</Text>
                <Text style={styles.statLabel}>Skipped</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{remainingCount}</Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {refreshing && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />}

        {/* ── DUE TODAY ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Today</Text>
          {dueItems.length > 0 ? (
            dueItems.map((item: any) => renderMedicationCard(item, 'pending'))
          ) : (
            <View style={styles.emptyState}>
              <CheckCircle2 size={40} color={COLORS.primary} />
              <Text style={styles.emptyText}>All caught up for now!</Text>
            </View>
          )}
        </View>

        {/* ── SNOOZED REMINDERS ── */}
        {snoozedItems.length > 0 && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Bell size={18} color={COLORS.amber} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, color: COLORS.amber }]}>Snoozed Reminders</Text>
            </View>
            {snoozedItems.map((item: any) => renderMedicationCard(item, 'snoozed'))}
          </View>
        )}

        {/* ── COMPLETED TODAY ── */}
        {completedTodayItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Today</Text>
            {completedTodayItems.map((item: any) => 
              renderMedicationCard(item, item.is_taken ? 'taken' : 'skipped')
            )}
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
  medCardSnoozed: { borderWidth: 1, borderColor: COLORS.amberLight, backgroundColor: '#FFFDF7' },
  medHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  medIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  medIconContainerSnoozed: { backgroundColor: COLORS.amberLight },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  medDosageRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  medDosage: { fontSize: 13, color: '#059669', fontFamily: FONTS.medium },
  timeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  timeText: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.medium, marginLeft: 2 },
  snoozedTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amberLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  snoozedTagText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.amber },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.background },
  mainActions: { flexDirection: 'row', gap: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  snoozeButton: { backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, height: 34 },
  snoozedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amberLight, borderRadius: 8, paddingHorizontal: 10, height: 34 },
  snoozedPillText: { color: COLORS.amber, fontSize: 12, fontFamily: FONTS.semiBold },
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
