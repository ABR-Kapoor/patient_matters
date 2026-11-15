import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7f3' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(dashboard)" />;
  } else {
    return <Redirect href="/onboarding" />;
  }
}
