// AURASUTRA-REVIEWS:rate_doctor_screen
// Post-consultation feedback screen. The patient must explicitly pick 1-5 stars
// (no default); the heading updates to the contextual prompt for that rating.
// An optional comment is trimmed client-side, capped at 500 chars with a live
// counter, and re-validated by POST /api/patient/reviews. The same endpoint
// upserts on (aid), so this screen doubles as the edit flow when the Past tab
// passes the existing review back in.
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { useAuthToken } from '../../hooks/stubs';
import { FONTS } from '../../constants/theme';
import { useNotification } from '../../lib/NotificationContext';

const STAR_LABELS = ['Very Poor', 'Needs Improvement', 'Average', 'Good', 'Excellent'];

const HEADINGS = [
  "We're sorry your experience wasn't good. What went wrong?",
  'What could have been better?',
  'How can we improve your next consultation?',
  'What did you like about your consultation?',
  'What made your consultation excellent?',
];

const MAX_COMMENT = 500;

export default function RateDoctorScreen() {
  const router = useRouter();
  const token = useAuthToken();
  const params = useLocalSearchParams<{ aid?: string | string[] }>();
  const aid = Array.isArray(params.aid) ? params.aid[0] : params.aid;

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useNotification();
  const [error, setError] = useState('');

  const submit = async () => {
    if (rating == null) {
      setError('Please select a star rating first.');
      return;
    }
    if (!aid) {
      setError('Missing appointment reference. Go back and try again.');
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length > MAX_COMMENT) {
      setError(`Please keep your feedback under ${MAX_COMMENT} characters.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const resolvedToken = typeof token === 'function' ? await token() : token;
      const response = await fetchWithAuth('/api/patient/reviews', resolvedToken, {
        method: 'POST',
        body: JSON.stringify({ aid, rating, comment: trimmed.length > 0 ? trimmed : null }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast('Thank You!', 'Your feedback helps us improve the quality of care.');
        router.back();
      } else {
        setError(data?.error || 'Could not submit your feedback. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>How was your consultation?</Text>
        <Text style={styles.subtitle}>
          Your feedback helps us improve the quality of care and your consultation experience.
        </Text>

        <View style={styles.starsRow} accessibilityLabel="Star rating, 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => {
            const selected = rating != null && value <= rating;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => {
                  setRating(value);
                  if (error) setError('');
                }}
                style={styles.starHit}
                accessibilityLabel={`${value} star${value === 1 ? '' : 's'}: ${STAR_LABELS[value - 1]}`}
                accessibilityState={{ selected: rating === value }}
              >
                <Star
                  size={40}
                  color={selected ? '#F59E0B' : '#D1D5DB'}
                  fill={selected ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.ratingLabel}>
          {rating == null ? 'Tap a star to rate' : `${rating}/5 — ${STAR_LABELS[rating - 1]}`}
        </Text>

        {rating != null ? <Text style={styles.contextHeading}>{HEADINGS[rating - 1]}</Text> : null}

        <Text style={styles.commentLabel}>Tell us more about your experience (optional)</Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Tell us more about your experience (optional)..."
          placeholderTextColor="#9ca3af"
          value={comment}
          onChangeText={(text) => setComment(text.slice(0, MAX_COMMENT))}
          multiline
          numberOfLines={4}
          maxLength={MAX_COMMENT}
          textAlignVertical="top"
          editable={!submitting}
          accessibilityLabel="Written feedback, optional"
        />
        <Text style={styles.counter}>
          {comment.trim().length}/{MAX_COMMENT}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitButton, (rating == null || submitting) && styles.submitButtonDisabled]}
          onPress={submit}
          disabled={rating == null || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#030315" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: '#030315', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  starHit: { padding: 6, minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { textAlign: 'center', marginTop: 8, fontSize: 15, fontFamily: FONTS.semiBold, color: '#030315' },
  contextHeading: {
    marginTop: 16,
    backgroundColor: '#EDF7E3',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#030315',
    textAlign: 'center',
    lineHeight: 20,
  },
  commentLabel: { marginTop: 20, fontSize: 14, fontFamily: FONTS.semiBold, color: '#030315' },
  commentInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#030315',
    minHeight: 110,
  },
  counter: { textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 4 },
  error: { color: '#ef4444', fontSize: 13, marginTop: 12, textAlign: 'center' },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#048256',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: '#030315' },
});
