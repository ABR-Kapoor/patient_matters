import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { X, Award, MapPin, Sparkles, Languages, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { useAuthToken } from '../hooks/stubs';
import { DoctorAvatar } from './DoctorAvatar';

const { width, height } = Dimensions.get('window');

interface DoctorProfileModalProps {
  visible: boolean;
  doctor: any | null;
  onClose: () => void;
  onBook: () => void;
}

// AURASUTRA-REVIEWS:doctor_profile_reviews
// Rating summary + recent reviews load lazily when the modal opens, so the
// directory list stays fast. Patient names arrive pre-masked from
// GET /api/doctors/[did]/reviews; nothing identifiable is rendered.
interface RatingSummary {
  avgRating: number | null;
  totalReviews: number;
}

interface ReviewItem {
  reviewId: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  patientName: string | null;
}

export function DoctorProfileModal({ visible, doctor, onClose, onBook }: DoctorProfileModalProps) {
  const token = useAuthToken();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const did = doctor?.did ?? null;

  useEffect(() => {
    if (!visible || !did) return;
    let cancelled = false;
    setSummary(null);
    setReviews([]);
    setReviewsLoading(true);
    (async () => {
      try {
        const resolvedToken = typeof token === 'function' ? await token() : token;
        const [sumRes, listRes] = await Promise.all([
          fetchWithAuth(`/api/doctors/${did}/rating-summary`, resolvedToken),
          fetchWithAuth(`/api/doctors/${did}/reviews?limit=5`, resolvedToken),
        ]);
        const sumData = sumRes.ok ? await sumRes.json() : null;
        const listData = listRes.ok ? await listRes.json() : null;
        if (cancelled) return;
        if (sumData?.success) {
          setSummary({
            avgRating: sumData.avgRating != null ? Number(sumData.avgRating) : null,
            totalReviews: Number(sumData.totalReviews ?? 0) || 0,
          });
        }
        if (Array.isArray(listData?.items)) setReviews(listData.items);
      } catch {
        // Reviews are supplementary; the modal stays usable without them.
        if (!cancelled) {
          setSummary(null);
          setReviews([]);
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, did]);

  if (!doctor) return null;

  const rawName = String(doctor?.user?.name || doctor?.name || 'Doctor');
  const docName = rawName.toLowerCase().startsWith('dr.') || rawName.toLowerCase().startsWith('dr ') ? rawName : `Dr. ${rawName}`;
  const spec = Array.isArray(doctor?.specialization) ? doctor.specialization.join(', ') : String(doctor?.specialization || 'Not specified');
  const exp = String(doctor?.years_of_experience || doctor?.yearsOfExperience || doctor?.experience || '0');
  const loc = doctor?.city && doctor?.state ? `${doctor.city}, ${doctor.state}` : String(doctor?.location || 'Location unavailable');
  const fee = String(doctor?.consultation_fee || doctor?.consultationFee || doctor?.fee || '0');
  const pic = doctor?.user?.profileImageUrl || doctor?.profile_image_url || doctor?.profileImageUrl;
  const reason = doctor?.reason ? String(doctor.reason) : null;
  const matchScore = doctor?.matchScore ? String(doctor.matchScore) : null;
  const languages = Array.isArray(doctor?.languages) && doctor.languages.length > 0 
    ? doctor.languages.join(', ') 
    : (doctor?.languages ? String(doctor.languages) : 'Not specified');
  const bio = doctor?.bio || doctor?.user?.bio || 'No biography provided by this doctor.';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      hardwareAccelerated={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close button fixed at top right */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#030315" />
          </TouchableOpacity>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Cover & Avatar Header */}
            <View style={styles.headerArea}>
              <View style={[styles.coverPhoto, { backgroundColor: '#DCFCE7' }]} />
              <View style={styles.avatarWrapper}>
                <DoctorAvatar
                  key={doctor?.did ?? doctor?.id ?? docName}
                  uri={pic}
                  seed={doctor?.did ?? doctor?.id ?? docName}
                  style={styles.avatar}
                />
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.nameSection}>
                <Text style={styles.doctorName}>{docName}</Text>
                <Text style={styles.doctorSpecialization}>{spec}</Text>
              </View>

              {/* Badges */}
              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Award size={16} color="#030315" />
                  <Text style={styles.badgeText}>{exp} Yrs Exp</Text>
                </View>
                <View style={styles.badge}>
                  <MapPin size={16} color="#030315" />
                  <Text style={styles.badgeText}>{loc}</Text>
                </View>
                <View style={styles.badge}>
                  <Languages size={16} color="#030315" />
                  <Text style={styles.badgeText}>{languages}</Text>
                </View>
              </View>

              {/* AI Match Reason (if applicable) */}
              {matchScore && reason && (
                <View style={styles.aiMatchBox}>
                  <View style={styles.aiMatchHeader}>
                    <Sparkles size={16} color="#fff" />
                    <Text style={styles.aiMatchTitle}>{matchScore}% AI Match</Text>
                  </View>
                  <Text style={styles.aiMatchText}>{reason}</Text>
                </View>
              )}

              {/* Rating summary: real aggregate only, or "New" when unrated */}
              <View style={styles.ratingSection}>
                <Text style={styles.sectionTitle}>Patient Reviews</Text>
                {reviewsLoading && !summary ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#2da866" />
                  </View>
                ) : summary && summary.avgRating != null && summary.totalReviews > 0 ? (
                  <View style={styles.ratingSummaryRow}>
                    <Star size={18} color="#030315" fill="#030315" />
                    <Text style={styles.ratingSummaryText}>
                      {summary.avgRating.toFixed(1)} / 5 • {summary.totalReviews} verified review{summary.totalReviews === 1 ? '' : 's'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noReviewsText}>New doctor • no verified reviews yet.</Text>
                )}

                {reviews.map((item) => (
                  <View key={item.reviewId} style={styles.reviewCard}>
                    <View style={styles.reviewCardHeader}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.reviewCardRating}>{item.rating}/5</Text>
                      {item.patientName ? (
                        <Text style={styles.reviewCardName} numberOfLines={1}>• {item.patientName}</Text>
                      ) : null}
                    </View>
                    {item.comment ? (
                      <Text style={styles.reviewCardComment} numberOfLines={4}>{item.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Bio / About */}
              <View style={styles.aboutSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{bio}</Text>
              </View>
              
              {/* Pad the bottom for the fixed action bar */}
              <View style={{ height: 100 }} />
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.feeContainer}>
              <Text style={styles.feeLabel}>Consultation Fee</Text>
              <Text style={styles.feeValue}>{"\u20B9"}{fee}</Text>
            </View>
            <TouchableOpacity style={styles.bookButton} onPress={onBook}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: height * 0.85,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerArea: {
    height: 120,
    position: 'relative',
    marginBottom: 50,
  },
  coverPhoto: {
    height: 120,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -40,
    left: '50%',
    marginLeft: -50,
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#030315',
  },
  detailsContainer: {
    paddingHorizontal: 16,
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#030315',
    marginBottom: 4,
  },
  doctorSpecialization: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '600',
    textAlign: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 6,
    fontWeight: '500',
  },
  aiMatchBox: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  aiMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiMatchTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  aiMatchText: {
    color: '#d1fae5',
    fontSize: 14,
    lineHeight: 20,
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  ratingSummaryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#048256',
    marginLeft: 8,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCardRating: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#030315',
    marginLeft: 6,
  },
  reviewCardName: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
    flex: 1,
  },
  reviewCardComment: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
    lineHeight: 18,
  },
  aboutSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  feeContainer: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  feeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  bookButton: {
    backgroundColor: '#048256',
    paddingVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold', },
});









