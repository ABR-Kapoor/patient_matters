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
import { useSignUp, useAuth, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS, FONTS } from '../constants/theme';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { useNotification } from '../lib/NotificationContext';
import { AuthBadge } from '../components/AuthBadge';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { OtpInput } from '../components/OtpInput';

export default function SignUpScreen() {
  const { isLoaded, getToken } = useAuth();
  const { signUp } = useSignUp();
  const clerk = useClerk();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { showAlert } = useNotification();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;

    if (!emailAddress.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: createErr } = await signUp.create({ emailAddress: emailAddress.trim() });
      if (createErr) throw createErr;

      const { error: pwdErr } = await signUp.password({ password });
      if (pwdErr) throw pwdErr;

      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) throw sendErr;

      setIsVerifying(true);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.message ||
        err?.errors?.[0]?.longMessage ||
        err?.message ||
        String(err);
      setError(msg);
      showAlert('Sign Up Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verifyErr) throw verifyErr;

      const { error: finalizeErr } = await signUp.finalize();
      if (finalizeErr) throw finalizeErr;

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
      const msg =
        err?.errors?.[0]?.message ||
        err?.errors?.[0]?.longMessage ||
        err?.message ||
        String(err);
      setError(msg);
      showAlert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!signUp || resending) return;
    setResending(true);
    setError('');
    try {
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) throw sendErr;
      showAlert('Code Sent', 'A fresh verification code has been sent to your email.');
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Could not resend code';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSuccess = async (sessionId: string) => {
    try {
      const token = await clerk.session?.getToken();
      const res = await fetchWithAuth('/api/dev-sync-user', token, { method: 'POST' });
      if (res.status === 403) {
        await clerk.signOut();
        showAlert('Doctor Account Detected', 'This account is registered as a doctor. Please open the Doctor App to sign in.');
        return;
      }
    } catch (err) {
      console.warn('[google-signup] sync warning:', err);
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
            {!isVerifying ? (
              <>
                {/* 3D User Icon Badge */}
                <AuthBadge type="user" theme="patient" size={100} />

                {/* Header Titles */}
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>Sign up and improve your health today</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

                {/* Confirm Password Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    value={confirmPassword}
                    placeholder="Retype your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#9CA3AF" />
                    ) : (
                      <Eye size={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Primary CTA Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create account</Text>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign Up */}
                <GoogleSignInButton
                  label="Continue with Google"
                  scheme="aurasutrapatient"
                  onSuccess={handleGoogleSuccess}
                  onError={(err) => {
                    const msg = err?.errors?.[0]?.message || 'Google sign up was cancelled or failed';
                    setError(msg);
                  }}
                />

                {/* Bottom Link */}
                <TouchableOpacity
                  style={styles.bottomLink}
                  onPress={() => router.push('/sign-in')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomLinkText}>
                    Already have an account?{' '}
                    <Text style={styles.bottomLinkHighlight}>Log in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* 3D Key Icon Badge for OTP */}
                <AuthBadge type="key" theme="patient" size={100} />

                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>
                  Enter the verification code sent to{'\n'}
                  <Text style={{ fontFamily: FONTS.bold, color: COLORS.text }}>{emailAddress}</Text>
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* 6-box OTP Input */}
                <OtpInput
                  length={6}
                  value={code}
                  onChange={setCode}
                  theme="patient"
                />

                {/* Continue CTA */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={handleVerify}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                {/* Resend Code Link */}
                <TouchableOpacity
                  style={{ marginTop: 24, alignItems: 'center' }}
                  onPress={handleResendCode}
                  disabled={resending}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendText}>
                    Didn't receive any code?{' '}
                    <Text style={styles.resendHighlight}>
                      {resending ? 'Sending...' : 'Resend Code'}
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Back to Edit Email */}
                <TouchableOpacity
                  style={{ marginTop: 16, alignItems: 'center' }}
                  onPress={() => {
                    setIsVerifying(false);
                    setCode('');
                    setError('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bottomLinkText, { color: COLORS.gray }]}>Back to Sign Up</Text>
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
  resendText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#6B7280',
  },
  resendHighlight: {
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
