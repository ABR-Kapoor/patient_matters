import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.imageContainer}>
        <Image 
          source={require('../../assets/images/onboarding.jpg')} 
          style={styles.image}
          resizeMode="cover"
        />
      </View>
      
      <View style={styles.bottomSheet}>
        <Text style={styles.title}>Care Made Simple</Text>
        <Text style={styles.subtitle}>
          Whether at home, at work, or on the go, find experienced doctors, schedule appointments in seconds.
        </Text>
        
        <TouchableOpacity 
          style={styles.button} 
          activeOpacity={0.8}
          onPress={() => router.push('/sign-in')}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.buttonText}>Get Started</Text>
          </View>
          <View style={styles.iconCircle}>
            <ArrowRight size={20} color="#000" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f3',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: width,
    height: '100%',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: -32,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 999,
    padding: 8,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 32,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d9f99d',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
