import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Image, ImageBackground, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useClerk } from '@clerk/expo';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../constants/theme';

export default function ForgotPasswordScreen() {
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Request a password reset code by email
  const onRequestReset = async () => {
    if (!isLoaded || !clerk.client) return;
    if (!emailAddress) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await (clerk.client.signIn as any).create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress,
      });
      setSuccessfulCreation(true);
    } catch (err: any) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset the password with the code and the new password
  const onReset = async () => {
    if (!isLoaded || !clerk.client) return;
    if (!code || !password) {
      setError('Please enter both the reset code and a new password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await (clerk.client.signIn as any).attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result.status === 'complete') {
        // Set the active session
        await clerk.setActive({ session: result.createdSessionId });
        router.replace('/(dashboard)');
      } else {
        console.log(result);
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/images/auth_bg.jpg')} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={colorScheme === 'dark' ? require('../../assets/images/AuraSutra-Full-WhiteText-Transparent.png') : require('../../assets/images/AuraSutra-Full_BlackText-Transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {!successfulCreation 
            ? "Enter your email address and we'll send you a verification code to reset your password."
            : "Enter the verification code sent to your email along with your new password."}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!successfulCreation ? (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                autoCapitalize="none"
                value={emailAddress}
                placeholder="Email Address"
                placeholderTextColor="#9ca3af"
                onChangeText={setEmailAddress}
                style={styles.input}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && { opacity: 0.7 }]} 
              onPress={onRequestReset}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                value={code}
                placeholder="Verification Code"
                placeholderTextColor="#9ca3af"
                onChangeText={setCode}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                value={password}
                placeholder="New Password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                onChangeText={setPassword}
                style={styles.input}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, loading && { opacity: 0.7 }]} 
              onPress={onReset}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, /* backgroundColor: '#f9fafb' */ },
  header: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  content: { flex: 1, padding: 32, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 24, marginTop: -20 },
  logo: { width: 290, height: 78 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 16, fontWeight: '500' },
  inputContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  button: {
    backgroundColor: '#047b50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
