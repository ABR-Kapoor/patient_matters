import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { Slot, useRouter, useSegments, type Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  configureDoseNotifications,
  ensureNotificationPermission,
  subscribeToDoseNotificationTaps,
} from '../lib/doseNotifications';
import { LanguageProvider } from '../lib/LanguageContext';
import { NotificationProvider } from '../lib/NotificationContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export { ErrorBoundary };


import { Platform } from 'react-native';
const tokenCache = {
  async getToken(key: string) {
    try {
      if (Platform.OS === 'web') return null;
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (Platform.OS === 'web') return;
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
  async clearToken(key: string) {
    try {
      if (Platform.OS === 'web') return;
      return await SecureStore.deleteItemAsync(key);
    } catch (err) {
      return;
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function RootLayoutNav() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inDashboard = segments[0] === '(dashboard)';
    const inAuthOrOnboarding = segments[0] === 'sign-in' || segments[0] === 'onboarding' || segments.length === 0;
    if (isSignedIn && !inDashboard) {
      router.replace('/(dashboard)');
    } else if (!isSignedIn && inDashboard) {
      router.replace('/sign-in');
    }
  }, [isSignedIn, isLoaded, segments]);

  // Initialize notifications asynchronously without blocking startup
  useEffect(() => {
    configureDoseNotifications().catch(() => {});
    ensureNotificationPermission().catch(() => {});
  }, []);

  // A tapped dose reminder opens the Medications tab so the dose can be logged.
  useEffect(() => {
    if (!isLoaded) return;
    return subscribeToDoseNotificationTaps((url) => router.push(url as Href));
  }, [isLoaded, router]);


  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (fontError) {
    console.error("Font load error:", fontError);
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#048256" />
      </View>
    );
  }

  if (!publishableKey) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <LanguageProvider>
            <NotificationProvider>
              <Slot />
            </NotificationProvider>
          </LanguageProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkLoaded>
            <LanguageProvider>
              <NotificationProvider>
                <RootLayoutNav />
              </NotificationProvider>
            </LanguageProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
