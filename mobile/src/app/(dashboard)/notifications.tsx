import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, Circle, Clock, Info, User, CheckCheck } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { useAuthToken } from '../../hooks/stubs';
import { useRouter, Stack, useFocusEffect } from 'expo-router';

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
  const token = useAuthToken();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    try {
      const response = await fetchWithAuth('/api/patient/notifications', token);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [token])
  );

  const markAsRead = async (notification_id: string | null = null, markAll: boolean = false) => {
    try {
      if (markAll) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } else {
        setNotifications(prev => prev.map(n => n.notification_id === notification_id ? { ...n, is_read: true } : n));
      }

      await fetchWithAuth('/api/patient/notifications/read', token, {
        method: 'PATCH',
        body: JSON.stringify({ notification_id, markAll })
      });
    } catch (err) {
      console.error(err);
      fetchNotifications();
    }
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
          headerTitle: () => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text }}>Notifications</Text>
              <Text style={{ fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray, marginTop: 1 }}>All notification</Text>
            </View>
          ),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: COLORS.background }, 
          headerShadowVisible: false, 
          headerTintColor: COLORS.text,
          headerRight: () => (
            notifications.length > 0 ? (
              <TouchableOpacity 
                onPress={() => markAsRead(null, true)} 
                disabled={unreadCount === 0}
                style={[styles.headerMarkAll, unreadCount === 0 && { opacity: 0.5 }]}
                activeOpacity={0.7}
              >
                <CheckCheck size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.headerMarkAllText}>Mark all as read</Text>
              </TouchableOpacity>
            ) : null
          )
        }} 
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} colors={[COLORS.primary]} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={32} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>You have no new notifications.</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity 
              key={notification.notification_id} 
              style={[styles.notificationCard, !notification.is_read && styles.unreadCard]}
              onPress={() => !notification.is_read && markAsRead(notification.notification_id)}
            >
              <View style={styles.avatarContainer}>
                {notification.image_url ? (
                  <Image source={{ uri: notification.image_url }} style={styles.avatar} />
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
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerMarkAll: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  headerMarkAllText: { color: COLORS.primary, fontSize: 13, fontFamily: FONTS.bold },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
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
  
  notificationCard: { flexDirection: 'row', backgroundColor: COLORS.white, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, alignItems: 'center' },
  unreadCard: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  
  avatarContainer: { marginRight: 16 },
  avatar: { width: 56, height: 56, borderRadius: 12 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  
  notificationContent: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  notificationTitle: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text, marginBottom: 4 },
  unreadText: { fontFamily: FONTS.bold },
  notificationMessage: { fontSize: 14, color: COLORS.gray, fontFamily: FONTS.regular, lineHeight: 20 },
  
  rightSide: { alignItems: 'flex-end', justifyContent: 'space-between', height: 56 },
  notificationTime: { fontSize: 12, color: COLORS.gray, fontFamily: FONTS.regular },
  statusIcon: { marginTop: 'auto', marginBottom: 2 },
});




