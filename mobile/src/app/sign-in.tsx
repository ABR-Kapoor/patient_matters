import { COLORS, FONTS } from '../constants/theme';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ImageBackground, Image, useColorScheme } from 'react-native';
import { useAuth, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { useNotification } from '../lib/NotificationContext';

type SignInResource = NonNullable<ReturnType<typeof useClerk>['client']['signIn']>;

const describeError = (err: unknown): string => {
  if (!err) return 'Something went wrong. Please try again.';
  const e = err as { errors?: { message?: string }[]; longMessage?: string; message?: string };
  return e.errors?.[0]?.message || e.longMessage || e.message || String(err);
};

export default function SignInScreen() {
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useNotification();
  const [errorMessage, setErrorMessage] = useState('');
  const [trustCode, setTrustCode] = useState('');
  const [needsTrustCode, setNeedsTrustCode] = useState(false);
  const [isSecondFactor, setIsSecondFactor] = useState(false);

  const signInResource = clerk.client.signIn;

  const activateSession = async (signIn: SignInResource) => {
    if (signIn.status !== 'complete' || !signIn.createdSessionId) {
      throw new Error(`Verification did not complete. Status: ${signIn.status}`);
    }
    await clerk.setActive({ session: signIn.createdSessionId });

    // Both apps share one Clerk instance, so the credential says nothing about the
    // account's role. Confirm with the server before letting anyone into the patient
    // portal, and drop the session again if it is a doctor account.
    //
    // The session is already active by the time this runs, and _layout.tsx mounts
    // this screen behind `Stack.Protected guard={!isSignedIn}` — so the instant
    // isSignedIn flips, this screen is unmounted. Every path therefore has to reach
    // router.replace. If the role check throws (backend unreachable, wrong LAN IP in
    // .env) and the error propagates, the user is left staring at a screen that no
    // longer exists instead of the dashboard. Only a definite 403 ejects them.
    try {
      const token = await clerk.session?.getToken();
      const res = await fetchWithAuth('/api/dev-sync-user', token, { method: 'POST' });
      if (res.status === 403) {
        await clerk.signOut();
        showAlert('Doctor Account Detected', 'This account is registered as a doctor. Please open the Doctor App to sign in.');
        return;
      }
    } catch (err) {
      console.warn('[sign-in] role check could not reach the backend, continuing to the dashboard.', err);
    }

    router.replace('/(dashboard)');
  };

  const onVerifyTrustPress = async () => {
    const signIn = clerk.client.signIn;
    if (!isLoaded || !signIn) return;

    const code = trustCode.trim();
    if (!code) {
      setErrorMessage('Enter the verification code sent to your email.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const verified = isSecondFactor
        ? await signIn.attemptSecondFactor({ strategy: 'email_code', code })
        : await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      await activateSession(verified ?? signIn);
    } catch (err: unknown) {
      const msg = describeError(err);
      console.error('[sign-in] verification failed:', msg, err);
      setErrorMessage(msg);
      showAlert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const onBackToSignIn = () => {
    setNeedsTrustCode(false);
    setIsSecondFactor(false);
    setTrustCode('');
    setErrorMessage('');
  };

  const onSignInPress = async () => {
    const signIn = clerk.client.signIn;
    if (!isLoaded || !signIn) return;

    setLoading(true);
    setErrorMessage('');
    setNeedsTrustCode(false);
    setIsSecondFactor(false);
    setTrustCode('');

    try {
      const attempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });

      if (attempt.status === 'complete') {
        await activateSession(attempt);
        return;
      }

      // Device trust is always satisfied by a SECOND factor email code. `supportedSecondFactors`
      // can be empty here, so `signIn.status` is the only reliable signal.
      if (attempt.status === 'needs_client_trust' || attempt.status === 'needs_second_factor') {
        const factor = attempt.supportedSecondFactors?.find((f) => f.strategy === 'email_code');
        await attempt.prepareSecondFactor({
          strategy: 'email_code',
          emailAddressId: factor && 'emailAddressId' in factor ? factor.emailAddressId : undefined,
        });
        setIsSecondFactor(true);
        setNeedsTrustCode(true);
        return;
      }

      if (attempt.status === 'needs_first_factor') {
        const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
        if (!factor || !('emailAddressId' in factor)) {
          throw new Error('Email code sign-in is not enabled for this account.');
        }
        await attempt.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
        setIsSecondFactor(false);
        setNeedsTrustCode(true);
        return;
      }

      throw new Error(`Sign in could not be completed. Status: ${attempt.status}`);
    } catch (err: unknown) {
      const msg = describeError(err);
      console.error('[sign-in] sign in failed:', msg, err);
      setErrorMessage(msg);
      showAlert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (needsTrustCode) {
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
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>A verification code has been sent to your email address. Please enter it below to continue.</Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.inputContainer}>
            <TextInput
              value={trustCode}
              placeholder="Enter verification code..."
              onChangeText={setTrustCode}
              style={styles.input}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={onVerifyTrustPress} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkButton} onPress={onBackToSignIn}>
            <Text style={styles.linkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      
      </SafeAreaView>
    </ImageBackground>
    );
  }

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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to securely access your dashboard.</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.inputContainer}>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email..."
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            value={password}
            placeholder="Password..."
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <TouchableOpacity 
          style={{ alignSelf: 'flex-end', marginBottom: 16 }}
          onPress={() => router.push('/forgot-password')}
        >
          <Text style={{ color: '#64748b', fontFamily: FONTS.medium, fontSize: 14 }}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, (!isLoaded || !signInResource || loading) && { opacity: 0.7 }]} 
          onPress={onSignInPress} 
          disabled={!isLoaded || !signInResource || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{(isLoaded && signInResource) ? "Sign In" : "Loading Clerk..."}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.linkButton} 
          onPress={() => router.push('/sign-up')} 
        >
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text></Text>
        </TouchableOpacity>
        
        {/* Required for sign-in flows on Expo web. Clerk skips the browser CAPTCHA on iOS and Android */}
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
    alignItems: 'center', },
  buttonText: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bold , },
  linkButton: { marginTop: 32, alignItems: 'center' , },
  linkText: { color: COLORS.gray, fontSize: 14, fontFamily: FONTS.medium },
  linkTextBold: { color: COLORS.text, fontFamily: FONTS.bold },
});



