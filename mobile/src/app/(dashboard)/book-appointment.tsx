import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Star, Plus, Video, MapPin, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';
import { AppDatePickerModal } from '../../components/AppDatePickerModal';
import { AppTimePickerModal } from '../../components/AppTimePickerModal';
import { useAuthToken, usePatientIdentity } from '../../hooks/stubs';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useNotification } from '../../lib/NotificationContext';
import WebView from 'react-native-webview';

const COLORS = {
  primary: '#048256',     // Light Green
  primaryLight: '#EDF7E3',
  text: '#030315',        // Dark Navy/Black
  background: '#F2F1F0',  // Light Gray/Off-white
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export default function BookAppointmentPage() {
  const router = useRouter();
  const { did } = useLocalSearchParams();
  const token = useAuthToken();
  const { data: identity } = usePatientIdentity(token);
  const { showToast, showAlert } = useNotification();

  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date()); // staging state for iOS
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [symptomsText, setSymptomsText] = useState('');
  
  const [mode, setMode] = useState<'online' | 'clinic'>('online');
  const [complaint, setComplaint] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [doctor, setDoctor] = useState<any>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [platformFee, setPlatformFee] = useState(0);

  // The rest of the state/hooks are simplified for the UI mockup purpose
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHtml, setPaymentHtml] = useState('');

  const symptomsList = ['I have a fever', 'I have a headache', 'I have a sore throat', 'I feel dizzy'];
  
  const dates = Array.from({length: 6}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dayStr: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      fullDate: d
    };
  });

  const times = ['8:00 am', '10:00 am', '01:00 pm', '02:30 pm'];

  useEffect(() => {
if (did) {
      const fetchDoctor = async () => {
        try {
          const res = await fetchWithAuth('/api/doctors/find-all', token);
          const data = await res.json();
          let list: any[] = [];
          if (Array.isArray(data)) list = data;
          else if (data.doctors && Array.isArray(data.doctors)) list = data.doctors;
          else if (data.data && Array.isArray(data.data)) list = data.data;

          const found = list.find((d: any) => d.did === did || d.id === did);
          // AURASUTRA-REVIEWS:real_rating_book_appointment
          // `rating` used to be `found?.avg_rating || '5.0'`, so an unrated doctor
          // displayed a perfect 5.0 on the booking screen. Keep the aggregate null
          // and let the badge render "New" instead.
          if (found) {
            const rawName = String(found?.user?.name || found?.name || 'Doctor');
            const docName = rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`;
            setDoctor({
              name: docName,
              specialization: Array.isArray(found?.specialization) ? found.specialization.join(', ') : String(found?.specialization || 'General'),
              avgRating: found?.avg_rating != null ? Number(found.avg_rating) : null,
              totalReviews: Number(found?.total_reviews ?? 0),
              image: found?.user?.profileImageUrl || found?.profile_image_url || found?.profileImageUrl,
              fee: String(found?.consultation_fee || found?.consultationFee || found?.fee || '0')
            });
          } else {
            // Fallback if not found
            setDoctor({
              name: 'Unknown Doctor',
              specialization: 'Specialist',
              avgRating: null,
              totalReviews: 0,
              image: null,
              fee: '0'
            });
          }
        } catch (e) {
          console.error('Failed to fetch doctor for booking:', e);
        } finally {
          setLoadingDoctor(false);
        }
      };

      const fetchPlatformFee = async () => {
        try {
          const res = await fetchWithAuth('/api/platform-fee', token);
          const data = await res.json();
          if (data.success) {
            setPlatformFee(Number(data.platformFee || 0));
          }
        } catch (e) {
          console.error('Failed to fetch platform fee:', e);
        }
      };

      fetchDoctor();
      fetchPlatformFee();
    } else {
      setLoadingDoctor(false);
    }
  }, [did, token]);

  const toggleSymptom = (sym: string) => {
    let current = symptomsText.split(',').map(s => s.trim()).filter(Boolean);
    if (current.includes(sym)) {
      current = current.filter(s => s !== sym);
    } else {
      current.push(sym);
    }
    setSymptomsText(current.join(', '));
  };

  // Pending order kept while the Razorpay WebView checkout is open.
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const buildRazorpayHtml = (order: any) => {
    const key = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_T1oxnYBnlYBotP';
    const options = {
      description: 'Doctor Consultation',
      currency: 'INR',
      key,
      amount: order.amount,
      name: 'aurasutra',
      order_id: order.id,
      prefill: {
        email: (identity as any)?.email || 'patient@example.com',
        contact: (identity as any)?.phone || '9999999999',
        name: (identity as any)?.name || 'Patient',
      },
      theme: { color: COLORS.primary },
    };
    const optionsJson = JSON.stringify(options).replace(/</g, '\\u003c');
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />`
      + `<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body>`
      + `<script>var options=${optionsJson};`
      + `options.handler=function(r){window.ReactNativeWebView.postMessage(JSON.stringify({status:'success',razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}));};`
      + `options.modal={ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:'dismissed'}));}};`
      + `var rzp=new Razorpay(options);`
      + `rzp.on('payment.failed',function(r){window.ReactNativeWebView.postMessage(JSON.stringify({status:'failed',error:r.error&&r.error.description||'Payment failed'}));});`
      + `rzp.open();</script></body></html>`;
  };

  const finalizeBooking = async (order: any, data: any) => {
    try {
      // 3. Create Appointment
      const apptPayload = {
        did: doctor?.did || did,
        scheduled_date: date.toISOString().split('T')[0],
        scheduled_time: selectedTime,
        mode: mode,
        chief_complaint: complaint,
        symptoms: symptomsText.split(',').map(s => s.trim()).filter(Boolean),
        payment_id: data.razorpay_payment_id,
        payment_status: 'paid',
        status: 'pending'
      };

      const apptRes = await fetchWithAuth('/api/appointments/create', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apptPayload)
      });

      const apptData = await apptRes.json();
      if (!apptRes.ok || !apptData.appointment) {
        showAlert('Booking Error', 'Payment succeeded but appointment creation failed. Please contact support.');
        return;
      }

      // 4. Record Transaction
      await fetchWithAuth('/api/payments/record-transaction', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aid: apptData.appointment.aid,
          did: doctor?.did || did,
          common_payment_id: order.common_payment_id,
          promo_code: promoCode,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          status: 'paid',
          amount: order.order.amount
        })
      });

      showAlert('Booking Confirmed!', 'Your appointment has been successfully scheduled.', [{ text: 'Done', onPress: () => router.back() }], 'success');
    } catch (e) {
      console.error(e);
      showAlert('Booking Error', 'An error occurred while finalizing your appointment booking.');
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success') {
        setShowPaymentModal(false);
        setLoading(true);
        await finalizeBooking(pendingOrder, msg);
        setPendingOrder(null);
        setLoading(false);
      } else if (msg.status === 'failed') {
        setShowPaymentModal(false);
        setPendingOrder(null);
        showAlert('Payment Incomplete', msg.error || 'Payment was not completed. Please try again.');
      } else if (msg.status === 'dismissed') {
        setShowPaymentModal(false);
        setPendingOrder(null);
      }
    } catch (e) {
      console.error('WebView message parse failed', e);
    }
  };

  const handleBook = async () => {
    if (!complaint.trim()) {
      showAlert('Complaint Required', 'Please enter your main health concern or symptoms before continuing.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Order
      const orderPayload = {
        did: doctor?.did || did,
        promo_code: promoCode
      };

      const orderRes = await fetchWithAuth('/api/payments/create-order', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.order) {
        showAlert('Order Error', orderData.error || 'Could not initiate payment order.');
        setLoading(false);
        return;
      }

      // 2. Open Razorpay web checkout (react-native-webview, Expo SDK 57
      // compatible) instead of the unmaintained react-native-razorpay native
      // module which breaks EAS Gradle builds (compileSdk 28 default, no
      // namespace, old checkout SDK).
      setPendingOrder(orderData);
      setPaymentHtml(buildRazorpayHtml(orderData.order));
      setShowPaymentModal(true);
      setLoading(false);
      return;
    } catch (error) {
      console.error('Booking failed:', error);
      showAlert('Booking Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showAndroidDatePicker = () => setShowDatePicker(true);
  const showAndroidTimePicker = () => setShowTimePicker(true);

  if (loadingDoctor) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Consultation Mode */}
        <Text style={styles.sectionTitle}>Consultation Mode</Text>
        <View style={styles.modeContainer}>
          <TouchableOpacity 
            style={[styles.modeBox, mode === 'online' && styles.modeBoxSelected]} 
            onPress={() => setMode('online')}>
            <Video size={20} color={mode === 'online' ? COLORS.text : COLORS.gray} style={styles.modeIcon} />
            <View>
              <Text style={[styles.modeTitle, mode === 'online' && styles.modeTitleSelected]}>Online</Text>
              <Text style={styles.modeSubtitle}>Video consultation</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeBox, mode === 'clinic' && styles.modeBoxSelected]} 
            onPress={() => setMode('clinic')}>
            <MapPin size={20} color={mode === 'clinic' ? COLORS.text : COLORS.gray} style={styles.modeIcon} />
            <View>
              <Text style={[styles.modeTitle, mode === 'clinic' && styles.modeTitleSelected]}>In-Clinic</Text>
              <Text style={styles.modeSubtitle}>Visit doctor's clinic</Text>
            </View>
          </TouchableOpacity>
        </View>



        {/* Doctor Card */}
        <View style={styles.doctorCard}>
          <DoctorAvatar
            key={doctor?.did ?? doctor?.id ?? doctor?.name ?? 'doctor'}
            uri={doctor?.image}
            seed={doctor?.did ?? doctor?.id ?? doctor?.name ?? 'doctor'}
            style={styles.doctorImage}
          />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctor?.name || 'Unknown Doctor'}</Text>
            <Text style={styles.doctorSpec}>{doctor?.specialization || 'Specialist'}</Text>
          </View>
{/* AURASUTRA-REVIEWS:real_rating_book_appointment_badge
            Shows the real average plus its review count, or a "New" pill when the
            doctor has not been rated. Never a hardcoded score. */}
          {doctor?.avgRating != null && doctor?.totalReviews > 0 ? (
            <View style={styles.ratingBadge}>
              <Star size={14} color={COLORS.text} fill={COLORS.text} />
              <Text style={styles.ratingText}>
                {Number(doctor.avgRating).toFixed(1)} ({doctor.totalReviews})
              </Text>
            </View>
          ) : (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        {/* Appointment Date */}
        <Text style={styles.sectionTitle}>Appointment Date</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => {
          if (Platform.OS === 'android') { showAndroidDatePicker(); }
          else { setTempDate(date); setShowDatePicker(true); }
        }}>
          <Text style={styles.inputWithIconTextActive}>{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          <Calendar size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Appointment Time */}
        <Text style={styles.sectionTitle}>Appointment Time</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => {
          if (Platform.OS === 'android') { showAndroidTimePicker(); }
          else { setTempDate(date); setShowTimePicker(true); }
        }}>
          <Text style={styles.inputWithIconTextActive}>{selectedTime}</Text>
          <Clock size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Android Date Picker - rendered inline but outside modal */}

        {/* Chief Complaint */}
        <Text style={styles.sectionTitle}>Chief Complaint *</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="Describe your main health concern..."
          placeholderTextColor={COLORS.gray}
          multiline
          value={complaint}
          onChangeText={setComplaint}
        />

        {/* Symptoms */}
        <Text style={styles.sectionTitle}>Symptoms (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter symptoms separated by commas..."
          placeholderTextColor={COLORS.gray}
          value={symptomsText}
          onChangeText={setSymptomsText}
        />

        <View style={styles.symptomsWrapper}>
          {symptomsList.map((sym, i) => {
            const current = symptomsText.split(',').map(s => s.trim()).filter(Boolean);
            const isSelected = current.includes(sym);
            return (
              <TouchableOpacity 
                key={i} 
                style={[styles.symptomTag, isSelected && styles.symptomTagSelected]}
                onPress={() => toggleSymptom(sym)}
              >
                <Text style={[styles.symptomText, isSelected && styles.symptomTextSelected]}>{sym}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentSummary}>
          <View style={styles.paymentHeader}>
            <CreditCard size={20} color={COLORS.text} style={{ marginRight: 8 }} />
            <Text style={styles.paymentTitle}>Payment Summary</Text>
          </View>
          
          <Text style={styles.promoLabel}>PROMO CODE</Text>
          <TextInput
            style={styles.promoInput}
            placeholder="ENTER PROMO CODE"
            placeholderTextColor={COLORS.gray}
            value={promoCode}
            onChangeText={setPromoCode}
          />
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentRowLabel}>Consultation Fee</Text>
            <Text style={styles.paymentRowValue}>{'\u20B9'}{doctor?.fee || '0.00'}</Text>
          </View>

          <View style={[styles.paymentRow, { marginTop: 12 }]}>
            <Text style={styles.paymentRowLabel}>Platform Fee</Text>
            <Text style={styles.paymentRowValue}>{'\u20B9'}{platformFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentTotalLabel}>Total Amount</Text>
            <Text style={styles.paymentTotalValue}>{'\u20B9'}{((parseFloat(doctor?.fee || '0')) + platformFee).toFixed(2)}</Text>
          </View>
        </View>

        {/* Warning Note */}
        <View style={styles.warningBox}>
          <AlertCircle size={20} color="#92400E" style={styles.warningIcon} />
          <Text style={styles.warningText}>
            <Text style={{ fontFamily: FONTS.bold }}>aurasutra is a practitioner directory and technology facilitator, NOT a healthcare provider.</Text> The practitioner you consult is an independent professional solely responsible for their medical advice. If this is a medical emergency, please <Text style={styles.warningLink}>call 112</Text> or visit your nearest hospital immediately.
          </Text>
        </View>

        {/* Terms of Service */}
        <TouchableOpacity style={styles.termsContainer} onPress={() => setAgreeTerms(!agreeTerms)}>
          <View style={[styles.checkbox, agreeTerms && styles.checkboxSelected]}>
            {agreeTerms && <View style={styles.checkboxInner} />}
          </View>
          <Text style={styles.termsText}>
            I agree to the <Text style={styles.termsLink}>Terms of Service</Text>, <Text style={styles.termsLink}>Refund Policy</Text>, and <Text style={styles.termsLink}>Telemedicine Consent</Text>.
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <AppDatePickerModal
        visible={showDatePicker}
        value={date}
        minimumDate={new Date()}
        onClose={() => setShowDatePicker(false)}
        onSelect={(selectedDate) => setDate(selectedDate)}
      />

      <AppTimePickerModal
        visible={showTimePicker}
        value={selectedTime}
        onClose={() => setShowTimePicker(false)}
        onSelect={(selectedTimeVal) => setSelectedTime(selectedTimeVal)}
      />

      {/* Footer Book Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookButton, (!agreeTerms || loading) && { opacity: 0.5 }]}
          onPress={handleBook}
          disabled={!agreeTerms || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.bookButtonText}>Confirm Booking & Pay</Text>
              <CheckCircle2 size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Razorpay web checkout */}
      <Modal visible={showPaymentModal} animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <Text style={{ fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text }}>Complete Payment</Text>
            <TouchableOpacity onPress={() => { setShowPaymentModal(false); setPendingOrder(null); }}>
              <Text style={{ fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.gray }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {paymentHtml ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: paymentHtml, baseUrl: 'https://aurasutra.com' }}
              javaScriptEnabled
              domStorageEnabled
              onMessage={handleWebViewMessage}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dateTextContainer: { marginLeft: 16 },
  dateLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.gray },
  dateValue: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
  
  doctorCard: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: 12, padding: 16, marginBottom: 32 },
  doctorImage: { width: 80, height: 80, borderRadius: 12 },
  doctorInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  doctorName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  doctorSpec: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray, marginBottom: 4 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, position: 'absolute', right: 12, top: 12 },
  ratingText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.text, marginLeft: 3 },
  // AURASUTRA-REVIEWS:real_rating_book_appointment_badge_style
  newBadge: { backgroundColor: COLORS.lightGray, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, position: 'absolute', right: 12, top: 12 },
  newBadgeText: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.gray, letterSpacing: 0.5 },
  
  sectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 16 },
  
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: COLORS.primary, marginBottom: 16 },
  inputWithIconText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray },
  inputWithIconTextActive: { fontSize: 14, color: COLORS.text, fontFamily: FONTS.medium },
  
  pickerModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerModalContent: { backgroundColor: COLORS.white, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  pickerModalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  pickerDoneText: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.primary },
  
  input: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text, marginBottom: 16 },
  symptomsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomTag: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  symptomTagSelected: { backgroundColor: COLORS.primary, borderWidth: 0 },
  symptomText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.text },
  symptomTextSelected: { color: COLORS.text },
  
  footer: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 },
  bookButton: { flexDirection: 'row', backgroundColor: COLORS.primary,   alignItems: 'center', justifyContent: 'center' , borderRadius: 12, paddingHorizontal: 16, minHeight: 48 },
  bookButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold , },
  
  modeContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  modeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  modeBoxSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  modeIcon: { marginRight: 12 },
  modeTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.gray, marginBottom: 2 },
  modeTitleSelected: { color: COLORS.text },
  modeSubtitle: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray },
  
  paymentSummary: { backgroundColor: COLORS.background, borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 24 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  paymentTitle: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  promoLabel: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase' },
  promoInput: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, height: 48, fontFamily: FONTS.regular, fontSize: 13, marginBottom: 20 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  paymentRowLabel: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray },
  paymentRowValue: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
  paymentTotalLabel: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  paymentTotalValue: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  
  termsContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
  checkbox: { width: 20, height: 20, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gray, marginRight: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkboxInner: { width: 10, height: 10, borderRadius: 12, backgroundColor: COLORS.text },
  termsText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray, lineHeight: 18 },
  termsLink: { color: COLORS.text, fontFamily: FONTS.bold, textDecorationLine: 'underline' },
  
  warningBox: { flexDirection: 'row', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 16, marginBottom: 24 },
  warningIcon: { marginRight: 12, marginTop: 2 },
  warningText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, color: '#92400E', lineHeight: 20 },
  warningLink: { fontFamily: FONTS.bold, textDecorationLine: 'underline', color: '#DC2626' },
});



