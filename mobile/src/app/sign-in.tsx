import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Image,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS, FONTS } from '../constants/theme';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { useNotification } from '../lib/NotificationContext';
import { AuthBadge } from '../components/AuthBadge';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OtpInput } from '../components/OtpInput';

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
  const { showAlert } = useNotification();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [trustCode, setTrustCode] = useState('');
  const [needsTrustCode, setNeedsTrustCode] = useState(false);
  const [isSecondFactor, setIsSecondFactor] = useState(false);

  const signInResource = clerk.client?.signIn;

  const activateSession = async (signIn: SignInResource) => {
    if (signIn.status !== 'complete' || !signIn.createdSessionId) {
      throw new Error(`Verification did not complete. Status: ${signIn.status}`);
    }
    await clerk.setActive({ session: signIn.createdSessionId });

    try {
      const token = await clerk.session?.getToken();
      const res = await fetchWithAuth('/api/dev-sync-user', token, { method: 'POST' });
      if (res.status === 403) {
        await clerk.signOut();
        showAlert(
          'Doctor Account Detected',
          'This account is registered as a doctor. Please open the Doctor App to sign in.'
        );
        return;
      }
    } catch (err) {
      console.warn('[sign-in] role check could not reach backend, continuing to dashboard.', err);
    }

    router.replace('/(dashboard)');
  };

  const onVerifyTrustPress = async () => {
    const signIn = clerk.client?.signIn;
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
    const signIn = clerk.client?.signIn;
    if (!isLoaded || !signIn) return;

    if (!emailAddress.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

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

  const handleGoogleSuccess = async (sessionId: string) => {
    try {
      const token = await clerk.session?.getToken();
      const res = await fetchWithAuth('/api/dev-sync-user', token, { method: 'POST' });
      if (res.status === 403) {
        await clerk.signOut();
        showAlert(
          'Doctor Account Detected',
          'This account is registered as a doctor. Please open the Doctor App to sign in.'
        );
        return;
      }
    } catch (err) {
      console.warn('[google-signin] role check error:', err);
    }
    router.replace('/(dashboard)');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/auth_bg.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {needsTrustCode ? (
              <>
                {/* 3D Key Icon Badge for device trust OTP */}
                <AuthBadge type="key" theme="patient" size={100} />

                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>
                  Enter the verification code sent to your email to verify this device.
                </Text>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <OtpInput
                  length={6}
                  value={trustCode}
                  onChange={setTrustCode}
                  theme="patient"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={onVerifyTrustPress}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 24, alignItems: 'center' }}
                  onPress={onBackToSignIn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomLinkText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* 3D Login Icon Badge */}
                <AuthBadge type="login" theme="patient" size={100} />

                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to securely access your health dashboard</Text>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={emailAddress}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setEmailAddress}
                    style={styles.input}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    value={password}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    onChangeText={setPassword}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#9CA3AF" />
                    ) : (
                      <Eye size={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', marginBottom: 16 }}
                  onPress={() => router.push('/forgot-password')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                {/* Sign In CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!isLoaded || !signInResource || loading) && { opacity: 0.7 },
                  ]}
                  onPress={onSignInPress}
                  disabled={!isLoaded || !signInResource || loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isLoaded && signInResource ? 'Sign in' : 'Loading...'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign In Button */}
                <GoogleSignInButton
                  label="Continue with Google"
                  scheme="aurasutrapatient"
                  onSuccess={handleGoogleSuccess}
                  onError={(err) => {
                    const msg = err?.errors?.[0]?.message || 'Google sign in was cancelled or failed';
                    setErrorMessage(msg);
                  }}
                />

                {/* Bottom Sign Up Link */}
                <TouchableOpacity
                  style={styles.bottomLink}
                  onPress={() => router.push('/sign-up')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomLinkText}>
                    Don't have an account?{' '}
                    <Text style={styles.bottomLinkHighlight}>Sign up</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View nativeID="clerk-captcha" />
          </ScrollView>

          {/* Footer Brand pinned to bottom */}
          <View style={styles.bottomFooterContainer}>
            <Text style={styles.footerBrandText}>
              An <Text style={styles.frequnSyncText}>FrequnSync</Text> Product
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: FONTS.bold,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#111827',
  },
  eyeIcon: {
    paddingLeft: 10,
  },
  forgotText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  primaryButton: {
    backgroundColor: '#048256',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#048256',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#9CA3AF',
  },
  bottomLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  bottomLinkText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#6B7280',
  },
  bottomLinkHighlight: {
    fontFamily: FONTS.bold,
    color: '#048256',
  },
  bottomFooterContainer: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrandText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  frequnSyncText: {
    fontFamily: FONTS.bold,
    fontWeight: '800',
    fontSize: 13.5,
    color: '#048256',
  },
});
