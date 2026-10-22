// AURASUTRA-REVIEWS:remove_fake_ratings_card
// Reconstructed 2026-10-04: the previous revision of this file was destroyed by
// a bad batch edit, so the card was rewritten from its call sites
// (doctors.tsx passes `doctor` + `onPress`). Ratings are real aggregates only:
// `avg_rating`/`total_reviews` from the API, or a "NEW" pill when unrated.
// No synthesised scores, no placeholder review counts.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, MapPin, Briefcase } from 'lucide-react-native';
import { FONTS } from '../constants/theme';
import { DoctorAvatar } from './DoctorAvatar';

interface DoctorResultCardProps {
  doctor: any;
  onPress: (doctor: any) => void;
}

export function DoctorResultCard({ doctor, onPress }: DoctorResultCardProps) {
  const rawName = String(doctor?.user?.name || doctor?.name || 'Doctor');
  const docName = rawName.toLowerCase().startsWith('dr.') || rawName.toLowerCase().startsWith('dr ')
    ? rawName
    : `Dr. ${rawName}`;
  const spec = Array.isArray(doctor?.specialization)
    ? doctor.specialization.join(', ')
    : String(doctor?.specialization || 'General');
  const exp = String(doctor?.years_of_experience ?? doctor?.yearsOfExperience ?? doctor?.experience ?? '0');
  const loc = doctor?.city && doctor?.state
    ? `${doctor.city}, ${doctor.state}`
    : String(doctor?.city || doctor?.location || '');
  const fee = String(doctor?.consultation_fee ?? doctor?.consultationFee ?? doctor?.fee ?? '0');
  const pic = doctor?.user?.profileImageUrl || doctor?.profile_image_url || doctor?.profileImageUrl || null;
  const avatarKey = doctor?.did ?? doctor?.id ?? docName;

  const avgRatingRaw = doctor?.avg_rating ?? doctor?.avgRating ?? doctor?.averageRating ?? doctor?.rating ?? null;
  const avgRating = avgRatingRaw != null && Number.isFinite(Number(avgRatingRaw)) ? Number(avgRatingRaw) : null;
  const totalReviewsRaw = doctor?.total_reviews ?? doctor?.reviewCount ?? doctor?.totalReviews ?? 0;
  const totalReviews = Number(totalReviewsRaw) || 0;
  const hasRating = avgRating != null && totalReviews > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(doctor)} activeOpacity={0.85}>
      <View style={{position: 'absolute', top: 14, right: 14, zIndex: 1}}>
        {hasRating ? (
          <View style={styles.ratingBadge} accessibilityLabel={`Rated ${avgRating!.toFixed(1)} out of 5 from ${totalReviews} reviews`}>
            <Star size={11} color="#048256" fill="#048256" />
            <Text style={styles.ratingText}>
              {avgRating!.toFixed(1)} ({totalReviews})
            </Text>
          </View>
        ) : (
          <View style={styles.newBadge} accessibilityLabel="New doctor, no reviews yet">
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <DoctorAvatar key={avatarKey} uri={pic} seed={avatarKey} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{docName}</Text>
          <Text style={styles.spec} numberOfLines={1}>{spec}</Text>
          <View style={styles.metaRow}>
            <Briefcase size={13} color="#6b7280" />
            <Text style={styles.metaText}>{exp} yrs exp</Text>
            {loc ? (
              <>
                <MapPin size={13} color="#6b7280" style={styles.metaIcon} />
                <Text style={styles.metaText} numberOfLines={1}>{loc}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <View>
          <Text style={styles.fee}>{"\u20B9"}{fee}</Text>
        </View>
        <TouchableOpacity 
          style={styles.bookBtn}
          onPress={() => onPress(doctor)}
        >
          <Text style={styles.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  info: { flex: 1, marginLeft: 12, marginRight: 60 },
  name: { fontSize: 16, fontFamily: FONTS.bold, color: '#030315' },
  spec: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  metaIcon: { marginLeft: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  fee: { fontSize: 16, fontFamily: FONTS.bold, color: '#030315' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: { fontSize: 11, fontFamily: FONTS.bold, color: '#048256', marginLeft: 3 },
  newBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: { fontSize: 10, fontFamily: FONTS.bold, color: '#6b7280', letterSpacing: 0.5 },
  bookBtn: {
    backgroundColor: '#048256',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookBtnText: { color: '#ffffff', fontFamily: FONTS.bold, fontSize: 13 }
});
