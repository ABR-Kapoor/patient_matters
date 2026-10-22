import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft, Search, Filter } from 'lucide-react-native';
import { View } from 'react-native';
import { useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuthToken } from '@/hooks/stubs';
import { syncDoseNotifications, type DoseRecord } from '@/lib/doseNotifications';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { VoiceSearchProvider } from '@/lib/VoiceSearchContext';

import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export { ErrorBoundary };

import { useAuth } from '@clerk/expo';

export default function DashboardLayout() {
  const router = useRouter();
  const token = useAuthToken();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Reminders are scheduled on-device, so they only exist once this app has
  // been opened since the prescription was sent. Resync at launch to pick up
  // any doses the doctor sent while the app was closed.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchWithAuth('/api/patient/adherence', token);
        const data = await response.json();
        if (cancelled || !data?.success) return;
        const records: DoseRecord[] = Array.isArray(data.adherence?.all) ? data.adherence.all : [];
        void syncDoseNotifications(records);
      } catch (err) {
        console.warn('Dose reminder sync failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <VoiceSearchProvider>
      <>
      <StatusBar style="dark" />
      <Stack
        initialRouteName="index"
        screenOptions={{
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontSize: 20,
          fontFamily: 'DMSans_700Bold',
          color: '#111827',
        },
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerLeft: (props) => (
          props.canGoBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
              }}
            >
              <ChevronLeft size={20} color="#374151" />
            </TouchableOpacity>
          ) : null
        ),
      }}
      >
        <Stack.Screen name="index" options={{ title: 'Dashboard', headerShown: false }} />
      <Stack.Screen name="appointments" options={{ title: 'Appointments', headerShown: true }} />
      {/* AURASUTRA-REVIEWS:rate_doctor_route */}
      <Stack.Screen name="rate-doctor" options={{ title: 'Rate Doctor', headerShown: true }} />
      <Stack.Screen name="book-appointment" options={{ title: 'Book Appointment', headerShown: true }} />
      <Stack.Screen name="doctors" options={{ 
        title: 'Find Your Doctor', 
        headerShown: true,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 8, marginRight: 4 }}>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Search size={18} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Filter size={18} color="#374151" />
            </TouchableOpacity>
          </View>
        )
      }} />
      <Stack.Screen name="find-doctors" options={{ title: 'Find Doctors', headerShown: true }} />
      <Stack.Screen name="medications" options={{ title: 'Medications', headerShown: true }} />
      <Stack.Screen name="prescriptions" options={{ title: 'Prescriptions', headerShown: true }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', headerShown: true }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications', headerShown: true }} />
      <Stack.Screen name="chat/[aid]" options={{ title: 'Chat with Doctor', headerShown: false }} />
      <Stack.Screen name="video-call/[aid]" options={{ title: 'Video Call', headerShown: false }} />
      </Stack>
      <BottomNav />
      </>
    </VoiceSearchProvider>
  );
}
