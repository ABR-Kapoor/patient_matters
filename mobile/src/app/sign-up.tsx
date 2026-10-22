import { COLORS, FONTS } from '../constants/theme';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground, Image, useColorScheme } from 'react-native';
import { useSignUp, useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { useNotification } from '../lib/NotificationContext';

export default function SignUpScreen() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signUp } = useSignUp();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showAlert } = useNotification();

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError('');

    try {
      // `useSignUp()` returns a SignUpFutureResource, which exposes the
      // factor-specific methods. The legacy top-level
      // `prepareEmailAddressVerification` / `attemptEmailAddressVerification`
      // do not exist on it, so the previous code only worked by catching a
      // TypeError at runtime.
      const { error: createErr } = await signUp.create({ emailAddress });
      if (createErr) throw createErr;

      const { error: pwdErr } = await signUp.password({ password });
      if (pwdErr) throw pwdErr;

      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) throw sendErr;

      setIsVerifying(true);
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message
        || err?.errors?.[0]?.longMessage
        || err?.message
        || String(err);
      setError(msg);
      showAlert('Sign Up Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError('');

    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyErr) throw verifyErr;

      // finalize() promotes the new session to active on this resource — there
      // is no createdSessionId, so clerk.setActive() is neither needed nor
      // callable without a session param.
      const { error: finalizeErr } = await signUp.finalize();
      if (finalizeErr) throw finalizeErr;

      // The mobile client resolves its patient identity through this endpoint on
      // every dashboard load, so it is a production identity path rather than a
      // dev helper. It reads the verified Clerk session only, and it has to run
      // after finalize() because there is no token to send before the session
      // exists. A failure here is logged, not fatal: the sign-up itself worked.
      try {
        const res = await fetchWithAuth('/api/dev-sync-user', getToken, { method: 'POST' });
        if (res.status === 403) {
          console.error('Patient sync refused: this account is not a patient.');
        } else if (!res.ok) {
          console.error('Patient sync failed:', res.status, await res.text());
        }
      } catch (syncErr) {
        console.error('Local sync failed, but sign up succeeded', syncErr);
      }

      router.replace('/(dashboard)');
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message
        || err?.errors?.[0]?.longMessage
        || err?.message
        || String(err);
      setError(msg);
      showAlert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/images/auth_bg.jpg')} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={colorScheme === 'dark' ? require('../../assets/images/AuraSutra-Full-WhiteText-Transparent.png') : require('../../assets/images/AuraSutra-Full_BlackText-Transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Create an account to manage your health.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!isVerifying && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                autoCapitalize="none"
                value={emailAddress}
                placeholder="Email..."
                onChangeText={setEmailAddress}
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                value={password}
                placeholder="Password..."
                placeholderTextColor="#9ca3af"
                secureTextEntry={true}
                onChangeText={setPassword}
                style={styles.input}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
              <View style={styles.buttonTextContainer}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkButton} 
              onPress={() => router.back()} 
            >
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Sign In</Text></Text>
            </TouchableOpacity>
          </>
        )}

        {isVerifying && (
          <>
            <Text style={styles.verifyText}>Enter the verification code sent to {emailAddress}.</Text>
            <View style={styles.inputContainer}>
              <TextInput
                value={code}
                placeholder="Verification Code..."
                placeholderTextColor="#9ca3af"
                onChangeText={setCode}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
              <View style={styles.buttonTextContainer}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Email</Text>}
              </View>
            </TouchableOpacity>
          </>
        )}
        
        {/* Required for sign-up flows on Expo web. Clerk skips the browser CAPTCHA on iOS and Android */}
        <View nativeID="clerk-captcha" />
      </View>
    
      </SafeAreaView>
    </ImageBackground>
  );
}



const styles = StyleSheet.create({
  logoContainer: { alignItems: 'center', marginBottom: 24, marginTop: -20 },
  logo: { width: 290, height: 78 },
  container: { flex: 1 },
  content: { flex: 1, padding: 32, justifyContent: 'center' },
  title: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 0, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray, marginBottom: 40, textAlign: 'center', lineHeight: 22 },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center', fontFamily: FONTS.medium },
  verifyText: { color: COLORS.text, marginBottom: 24, textAlign: 'center', lineHeight: 22, fontFamily: FONTS.regular },
  inputContainer: { 
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text },
  button: {
    backgroundColor: '#047b50',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center', 
    marginTop: 16, 
    justifyContent: 'center', paddingHorizontal: 16, minHeight: 48 },
  buttonTextContainer: {
    alignItems: 'center' },
  buttonText: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bold },
  linkButton: { marginTop: 32, alignItems: 'center' },
  linkText: { color: COLORS.gray, fontSize: 14, fontFamily: FONTS.medium },
  linkTextBold: { color: COLORS.text, fontFamily: FONTS.bold },
});



