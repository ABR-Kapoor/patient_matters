import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, CheckCheck } from 'lucide-react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useNotificationFeed } from '../../components/NotificationFeedProvider';
import { toMobileNotificationHref } from '../../lib/notificationRoute';

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

const formatTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, loading, refresh, markAsRead } = useNotificationFeed();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerTitle: 'Notifications',
          headerRight: () => null,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: FONTS.bold,
            color: COLORS.text,
          },
        }}
      />

      {/* Sub-header below navbar: "All notification" on left, "Mark all as read" on right */}
      <View style={styles.subHeaderBar}>
        <Text style={styles.subHeaderTitle}>All notification</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            onPress={() => markAsRead(null, true)}
            disabled={unreadCount === 0}
            style={[styles.markAllButton, unreadCount === 0 && { opacity: 0.4 }]}
            activeOpacity={0.7}
          >
            <CheckCheck size={16} color={COLORS.primary} style={{ marginRight: 5 }} />
            <Text style={styles.markAllButtonText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={32} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>You have no new notifications.</Text>
          </View>
        ) : (
          notifications.map(notification => {
            let meta = notification.metadata;
            if (typeof meta === 'string') {
              try { meta = JSON.parse(meta); } catch {}
            }
            if (typeof meta === 'string') {
              try { meta = JSON.parse(meta); } catch {}
            }
            const isApt = notification.type === 'appointment' || Boolean(meta?.did) || String(notification.title || '').toLowerCase().includes('appointment');
            const doctorPic = notification.image_url || meta?.image_url || meta?.avatar_url || null;
            const doctorSeed = notification.doctor_name || meta?.doctor_name || meta?.did || 'Doctor';

            return (
              <TouchableOpacity
                key={notification.notification_id}
                style={[styles.notificationCard, !notification.is_read && styles.unreadCard]}
                onPress={() => {
                  if (!notification.is_read) {
                    void markAsRead(notification.notification_id);
                  }
                  const href = toMobileNotificationHref(notification.action_url);
                  if (href) router.push(href);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.avatarContainer}>
                  {isApt ? (
                    <DoctorAvatar
                      key={notification.notification_id + (doctorPic || '')}
                      uri={doctorPic}
                      seed={doctorSeed}
                      style={styles.avatar}
                    />
                  ) : notification.image_url || meta?.image_url ? (
                    <Image source={{ uri: notification.image_url || meta?.image_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{(notification.title || 'N').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.notificationContent}>
                  <Text style={[styles.notificationTitle, !notification.is_read && styles.unreadText]} numberOfLines={1}>
                    {notification.title || 'Notification'}
                  </Text>
                  <Text style={styles.notificationMessage} numberOfLines={2}>
                    {notification.body || notification.message || 'No details provided'}
                  </Text>
                </View>

                <View style={styles.rightSide}>
                  <Text style={styles.notificationTime}>
                    {formatTime(notification.created_at)}
                  </Text>
                  <View style={styles.statusIcon}>
                    {notification.is_read ? (
                      <CheckCircle2 size={18} color="#059669" fill="#059669" stroke="#FFF" />
                    ) : (
                      <CheckCircle2 size={18} color="#A7F3D0" fill="#A7F3D0" stroke="#FFF" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  subHeaderTitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  markAllButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, textAlign: 'center' },

  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center'
  },
  unreadCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },

  avatarContainer: { marginRight: 14 },
  avatar: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.lightGray },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.primary },

  notificationContent: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  notificationTitle: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text, marginBottom: 4 },
  unreadText: { fontFamily: FONTS.bold },
  notificationMessage: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, lineHeight: 20 },

  rightSide: { alignItems: 'flex-end', justifyContent: 'space-between', height: 56 },
  notificationTime: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.regular },
  statusIcon: { marginTop: 'auto', marginBottom: 2 },
});




