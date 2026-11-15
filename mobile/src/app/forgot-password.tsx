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
import { useRouter } from 'expo-router';
import { useAuth, useClerk } from '@clerk/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { COLORS, FONTS } from '../constants/theme';
import { AuthBadge } from '../components/AuthBadge';
import { OtpInput } from '../components/OtpInput';

export default function ForgotPasswordScreen() {
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Steps: 1 = Enter Email, 2 = Enter OTP, 3 = Reset Password
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Request password reset email code
  const onRequestReset = async () => {
    if (!isLoaded || !clerk.client) return;
    if (!emailAddress.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await (clerk.client.signIn as any).create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress.trim(),
      });
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate OTP entered
  const onOtpContinue = () => {
    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleResendCode = async () => {
    if (!isLoaded || !clerk.client || resending) return;
    setResending(true);
    setError('');
    try {
      await (clerk.client.signIn as any).create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress.trim(),
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  // Step 3: Attempt reset password with code + password
  const onReset = async () => {
    if (!isLoaded || !clerk.client) return;
    if (!code.trim() || !password) {
      setError('Please enter both the reset code and a new password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await (clerk.client.signIn as any).attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });

      if (result.status === 'complete') {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace('/(dashboard)');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
      setError('');
    } else if (step === 2) {
      setStep(1);
      setError('');
    } else {
      router.back();
    }
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
          {/* Top Back Button */}
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.8}>
              <ChevronLeft size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && (
              <>
                {/* 3D Lock Badge */}
                <AuthBadge type="lock" theme="patient" size={100} />

                <Text style={styles.title}>Forget password?</Text>
                <Text style={styles.subtitle}>Forgot Password? Quickly Reset Your Password</Text>

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

                {/* Continue Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={onRequestReset}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                {/* Bottom Link */}
                <TouchableOpacity
                  style={styles.bottomLink}
                  onPress={() => router.push('/sign-in')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomLinkText}>
                    Know your password?{' '}
                    <Text style={styles.bottomLinkHighlight}>Log in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                {/* 3D Key Badge */}
                <AuthBadge type="key" theme="patient" size={100} />

                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>Enter the code sent to your email</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* 6-box OTP Input */}
                <OtpInput
                  length={6}
                  value={code}
                  onChange={setCode}
                  theme="patient"
                />

                {/* Continue Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onOtpContinue}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
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
              </>
            )}

            {step === 3 && (
              <>
                {/* 3D Shield Badge */}
                <AuthBadge type="shield" theme="patient" size={100} />

                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>Create your AuraSutra Account Password</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* New Password Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    value={password}
                    placeholder="New password"
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
                    placeholder="Confirm password"
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

                {/* Reset & Login CTA Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={onReset}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Login</Text>
                  )}
                </TouchableOpacity>

                {/* Bottom Link */}
                <TouchableOpacity
                  style={styles.bottomLink}
                  onPress={() => router.push('/sign-in')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomLinkText}>
                    Know your password?{' '}
                    <Text style={styles.bottomLinkHighlight}>Log in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
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
