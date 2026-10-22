'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, Clock, Video, MapPin, User, Award, Loader2, CheckCircle2, CreditCard, CalendarPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useTranslation } from '@/app/hooks/useTranslation';
import { formatDate } from '@/lib/formatDate';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { DatePicker } from '@/app/components/DatePicker';
import { TimePicker } from '@/app/components/TimePicker';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import Loading from '@/app/components/Loading';

const inputCls = 'w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-sage-50 border border-sage-200 text-forest-900 text-sm outline-none transition-all duration-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 focus:bg-white';

export default function BookAppointmentPage() {
  const token = useAuthToken();
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const { text: complaintPlaceholder } = useTranslation('Describe your main health concern...');
  const { text: symptomsPlaceholder } = useTranslation('Enter symptoms separated by commas (e.g., headache, fever, fatigue)');
  const searchParams = useSearchParams();
  const router = useRouter();
  const did = searchParams?.get('did');

  const [doctor, setDoctor] = useState<any>(null);
  const [doctorDisplayName, setDoctorDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitBlocked, setSubmitBlocked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [platformFee, setPlatformFee] = useState<number>(20);
  const [promoValid, setPromoValid] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoDetailsText, setPromoDetailsText] = useState('');
  const [customFee, setCustomFee] = useState<number>(0);

  const previewBaseFee = customFee;
  const previewTotal = Math.max(0, previewBaseFee + platformFee - promoDiscount);

  useEffect(() => {
    if (!promoCode.trim()) {
      setPromoValid(false);
      setPromoError('');
      setPromoDiscount(0);
      setPromoDetailsText('');
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setPromoLoading(true);
      setPromoError('');
      try {
        const response = await fetch(`/api/coupons/validate?code=${encodeURIComponent(promoCode)}&doctorFee=${customFee}`);
        const data = await response.json();

        if (data.valid) {
          setPromoValid(true);
          setPromoDiscount(data.promoDiscount);
          const discountDesc = data.discountType === 'percentage'
            ? `${data.discountValue}% off overall fee`
            : `₹${data.discountValue} flat off`;
          setPromoDetailsText(discountDesc);
        } else {
          setPromoValid(false);
          setPromoDiscount(0);
          setPromoError(data.error || 'Invalid coupon code');
          setPromoDetailsText('');
        }
      } catch (err) {
        console.error('Error validating coupon:', err);
        setPromoValid(false);
        setPromoDiscount(0);
        setPromoError('Failed to validate promo code');
        setPromoDetailsText('');
      } finally {
        setPromoLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [promoCode, customFee]);

  useEffect(() => {
    if (did) {
      fetchDoctor();
      fetchPlatformFee();
    } else {
      setLoading(false);
      translate('No doctor selected').then(msg => toast.error(msg));
      router.push('/dashboard/find-doctors');
    }
  }, [did]);

  async function fetchPlatformFee() {
    try {
      const response = await fetch('/api/platform-fee');
      const data = await response.json();
      if (data.success) {
        setPlatformFee(data.platformFee);
      }
    } catch (error) {
      console.error('Error fetching platform fee:', error);
    }
  }

  const loadRazorpayScript = (retries = 2): Promise<boolean> => new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      if (retries > 0) {
        const backoff = (3 - retries) * 1000;
        setTimeout(() => loadRazorpayScript(retries - 1).then(resolve), backoff);
      } else {
        resolve(false);
      }
    };
    document.body.appendChild(script);
  });

  async function fetchDoctor() {
    try {
      const response = await fetchWithAuth(`/api/doctors/${did}`, token);
      const data = await response.json();
      if (data.success) {
        setDoctor(data.doctor);
        setCustomFee(Number(data.doctor.consultationFee || 0));
        // Transliterate doctor name
        if (data.doctor.user?.name) {
          const transliterated = await transliterateName(data.doctor.user.name);
          setDoctorDisplayName(transliterated);
        }
      }
      else { const msg = await translate('Doctor not found'); toast.error(msg); router.push('/dashboard'); }
    } catch { const msg = await translate('Failed to load doctor details'); toast.error(msg); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!did || !selectedDate || !selectedTime || !chiefComplaint.trim()) {
      const msg = await translate('Please choose a doctor, date, time, and add a chief complaint before proceeding.');
      toast.error(msg);
      return;
    }

    if (!consentAgreed) {
      const msg = await translate('Please agree to the Terms, Refund Policy, and Consent to proceed.');
      toast.error(msg);
      return;
    }

    if (submitBlocked) { const msg = await translate('Please wait before trying again.'); toast.error(msg); return; }
    setSubmitting(true);
    setSubmitBlocked(true);
    setTimeout(() => setSubmitBlocked(false), 10000);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) { const msg = await translate('Failed to load payment gateway.'); toast.error(msg); setSubmitting(false); return; }
      const syncResponse = await fetchWithAuth('/api/sync-user', token);
      const syncData = await syncResponse.json();
      const syncUser = syncData.user || syncData;
      const userUid = syncUser?.uid;
      if (!userUid) { const msg = await translate('User session error. Please re-login.'); toast.error(msg); router.push('/'); setSubmitting(false); return; }
      const profileResponse = await fetchWithAuth(`/api/patient/profile?uid=${userUid}`, token);
      const profileData = await profileResponse.json();
      if (!profileData.success || !profileData.patient) { const msg = await translate('Please complete your profile first'); toast.error(msg); router.push('/dashboard/profile'); setSubmitting(false); return; }
      const pid = profileData.patient.pid;
      const orderResponse = await fetchWithAuth('/api/payments/create-order', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did, promo_code: promoCode, currency: 'INR', receipt: `apt_${Date.now()}`, notes: { pid, consultation_type: mode }, amount: customFee }),
      });
      const orderData = await orderResponse.json();
      if (!orderData.success) { const msg = await translate(orderData.error || 'Failed to create payment order'); toast.error(msg); setSubmitting(false); return; }

      const rawKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
      const cleanKey = rawKey.split(' ')[0].trim();
      if (!cleanKey) { const msg = await translate('Payment gateway not configured'); toast.error(msg); setSubmitting(false); return; }

      const options = {
        key: cleanKey,
        amount: orderData.order.amount, currency: orderData.order.currency,
        name: 'AuraSutra', description: `Consultation with ${doctor.user?.name || 'Practitioner'}`, image: '/AuraSutra-LogoOnly-Transparent.png',
        order_id: orderData.order.id,
        handler: async function (response: any) {
          try {
            const verifyResponse = await fetchWithAuth('/api/payments/verify', token, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }),
            });
            const verifyData = await verifyResponse.json();
            if (verifyData.success) {
              const appointment = await bookAppointment(pid, response.razorpay_payment_id);

              if (appointment?.aid) {
                try {
                  await fetchWithAuth('/api/payments/record-transaction', token, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      aid: appointment.aid,
                      did,
                      common_payment_id: orderData.common_payment_id,
                      promo_code: orderData.applied_promo_code || '',
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                      payment_method: 'razorpay',
                      razorpay_response: response,
                      status: 'paid',
                      amount: customFee,
                    }),
                  });
                } catch (txnErr) {
                  console.error('Record transaction failed — appointment created but payment not recorded:', txnErr);
                  const msg = await translate('Booking confirmed, but payment recording had an issue. Our team will follow up.');
                  toast(msg, { icon: '⚠️' });
                }

                try {
                  await fetchWithAuth('/api/notifications/send', token, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'payment_completed', data: { patientId: pid, doctorId: did, amount: previewTotal, platformFee: platformFee, transactionId: response.razorpay_payment_id, paymentMethod: 'Online Payment', appointmentDate: formatDate(new Date(selectedDate)), appointmentTime: selectedTime, mode } }),
                  });
                } catch { }
              } else {
                // Payment succeeded but appointment creation failed — auto-refund
                const msg = await translate('Payment was taken but booking failed. Admin will process your refund shortly.');
                toast.error(msg);
                await fetch('/api/refunds/initiate-auto', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    amount: previewTotal,
                    reason: 'Payment captured but appointment creation failed. Patient notified.',
                  }),
                });
              }
            } else { const msg = await translate('Payment verification failed'); toast.error(msg); setSubmitting(false); }
          } catch { const msg = await translate('Payment verification failed'); toast.error(msg); setSubmitting(false); }
        },
        prefill: { name: profileData.patient.emergencyContactName || syncUser?.name || 'Patient', email: syncUser?.email || '', contact: profileData.patient.emergencyContactPhone || syncUser?.phone || '' },
        theme: { color: '#22854a' },
        modal: { ondismiss: function () { setSubmitting(false); translate('Payment cancelled').then(msg => toast(msg, { icon: '⚠️' })); } },
      };
      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch { const msg = await translate('Failed to initiate payment'); toast.error(msg); setSubmitting(false); }
  }

  async function bookAppointment(pid: string, paymentId?: string) {
    try {
      const response = await fetchWithAuth('/api/appointments/create', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did, scheduled_date: selectedDate, scheduled_time: selectedTime, mode, chief_complaint: chiefComplaint, symptoms: symptoms ? symptoms.split(',').map(s => s.trim()) : [], payment_id: paymentId || null, payment_status: paymentId ? 'completed' : 'pending', consent_given_at: new Date().toISOString(), consent_ip: '' }),
      });
      const data = await response.json();
      if (data.success) {
        // Trigger appointment notification email for patient and doctor
        try {
          await fetchWithAuth('/api/notifications/send', token, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'appointment_created',
              data: {
                patientId: pid,
                doctorId: did,
                appointmentDate: formatDate(new Date(selectedDate)),
                appointmentTime: selectedTime,
                mode,
                chiefComplaint,
                meetingLink: mode === 'online' ? '' : '',
                tokenNumber: '',
              },
            }),
          });
        } catch (notifyError) {
          console.error('Appointment notification failed:', notifyError);
        }

        setShowSuccess(true);
        setTimeout(() => router.push('/dashboard/appointments'), 2000);
        return data.appointment;
      } else {
        const msg = await translate(data.error || 'Failed to book appointment');
        toast.error(msg);
        return null;
      }
    } catch (error) {
      console.error('bookAppointment error:', error);
      const msg = await translate('Failed to complete booking after payment');
      toast.error(msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const minDate = new Date().toISOString().split('T')[0];
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  if (loading) return <Loading />;
  if (!doctor) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 px-1">
      {/* ── HEADER ── */}
      <div>
        <span className="pill-badge mb-3 inline-block">
          <CalendarPlus className="w-3 h-3" />
          <TranslatedText>BOOK CONSULTATION</TranslatedText>
        </span>
        <h1 className="headline-lg mb-1"><TranslatedText>Book Appointment</TranslatedText></h1>
        <p className="body-md text-forest-400"><TranslatedText>Schedule your consultation with the doctor</TranslatedText></p>
      </div>

      {/* ── SUCCESS MODAL ── */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-forest-900/70 backdrop-blur-md">
          <div className="bg-white p-5 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-forest-xl">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-sage-100">
              <CheckCircle2 className="w-10 h-10 text-forest-500" />
            </div>
            <h2 className="headline-lg mb-2"><TranslatedText>Appointment Booked!</TranslatedText></h2>
            <p className="body-md text-forest-400"><TranslatedText>Your appointment has been successfully scheduled. Redirecting you to appointments page...</TranslatedText></p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          <div className="relative group shrink-0">
            {doctor.user.profileImageUrl ? (
              <img src={doctor.user.profileImageUrl} alt={doctorDisplayName || doctor.user.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-sage-50/50 shadow-sm transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-sage-50 to-sage-100 ring-4 ring-sage-50/50 shadow-sm transition-transform duration-500 group-hover:scale-105">
                <User className="w-10 h-10 sm:w-14 sm:h-14 text-forest-400/80" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-sm border border-gray-50">
              <div className="w-6 h-6 rounded-full bg-forest-500 flex items-center justify-center shadow-inner">
                 <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-gray-900 mb-1.5 tracking-tight">
              <span className="devanagari-small">{doctorDisplayName || doctor.user.name}</span>
            </h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-500 mb-6">
              <span className="font-medium text-sm tracking-wide uppercase"><TranslatedText>{doctor.qualification}</TranslatedText></span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
              <span className="text-sm font-medium"><TranslatedText>{doctor.specialization?.[0] || 'General Medicine'}</TranslatedText></span>
              {doctor.specialization?.length > 1 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">+{doctor.specialization.length - 1}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 pt-5 border-t border-gray-100/80">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-forest-500/70" />
                <span className="text-sm font-medium">{[doctor.city, doctor.state].filter(Boolean).join(', ') || '—'}</span>
              </div>
              
              <div className="hidden sm:block w-px h-5 bg-gray-200"></div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <Award className="w-4 h-4 text-forest-500/70" />
                <span className="text-sm font-medium">{doctor.yearsOfExperience} <TranslatedText>Years Exp.</TranslatedText></span>
              </div>

              <div className="hidden sm:block w-px h-5 bg-gray-200"></div>
              
              <div className="flex items-center gap-1.5 bg-forest-50/80 px-3 py-1 rounded-xl border border-forest-100/50">
                <span className="text-xs font-bold text-forest-600/80 uppercase tracking-wider"><TranslatedText>Fee</TranslatedText></span>
                <span className="text-lg font-black font-display text-forest-700">₹{Number(Number(doctor.consultationFee || 0) + platformFee).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── EMERGENCY DISCLAIMER ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
          <strong>AuraSutra is a practitioner directory and technology facilitator, NOT a healthcare provider.</strong>{' '}
          The practitioner you consult is an independent professional solely responsible for their medical advice.{' '}
          If this is a medical emergency, please <a href="tel:112" className="font-bold text-red-600 hover:text-red-800 underline">call 112</a> or visit your nearest hospital immediately.
        </p>
      </div>

      {/* ── BOOKING FORM ── */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-4 sm:p-6 shadow-forest-sm border border-sage-100 space-y-4 sm:space-y-6">
        <h3 className="text-lg font-display font-bold text-forest-900"><TranslatedText>Appointment Details</TranslatedText></h3>

        {/* Mode Selection */}
        <div>
          <label className="block text-xs font-bold tracking-wider text-forest-400 mb-3 uppercase"><TranslatedText>CONSULTATION MODE</TranslatedText></label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {([
              { value: 'online', Icon: Video, title: 'Online', sub: 'Video consultation' },
              { value: 'offline', Icon: MapPin, title: 'In-Clinic', sub: "Visit doctor's clinic" },
            ] as const).map(({ value, Icon, title, sub }) => (
              <button key={value} type="button" onClick={() => setMode(value)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 sm:py-3 rounded-[var(--radius-xl)] border-2 text-sm transition-all duration-200 ${mode === value ? 'border-forest-500 bg-sage-100' : 'border-sage-200 bg-white hover:border-forest-400'}`}>
                <Icon className={`w-5 h-5 shrink-0 ${mode === value ? 'text-forest-500' : 'text-forest-400'}`} />
                <div className="text-left">
                  <div className="font-semibold text-forest-900"><TranslatedText>{title}</TranslatedText></div>
                  <div className="text-xs text-forest-400"><TranslatedText>{sub}</TranslatedText></div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-bold tracking-wider text-forest-400 mb-2 uppercase">
            <Calendar className="w-4 h-4 inline mr-1 text-forest-500" /><TranslatedText>APPOINTMENT DATE</TranslatedText>
          </label>
          <DatePicker value={selectedDate} onChange={setSelectedDate} minDate={minDate} maxDate={maxDateStr} />
        </div>

        {/* Time */}
        <div>
          <label className="block text-xs font-bold tracking-wider text-forest-400 mb-2 uppercase">
            <Clock className="w-4 h-4 inline mr-1 text-forest-500" /><TranslatedText>APPOINTMENT TIME</TranslatedText>
          </label>
          <TimePicker value={selectedTime} onChange={setSelectedTime} />
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-xs font-bold tracking-wider text-forest-400 mb-2 uppercase">
            <TranslatedText>CHIEF COMPLAINT</TranslatedText> <span className="text-[var(--status-error)]">*</span>
          </label>
          <textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder={complaintPlaceholder} required rows={3}
            className={`${inputCls} resize-none`} />
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-xs font-bold tracking-wider text-forest-400 mb-2 uppercase"><TranslatedText>SYMPTOMS (OPTIONAL)</TranslatedText></label>
          <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder={symptomsPlaceholder} className={inputCls} />
        </div>

        {/* Payment Summary */}
        <div className="rounded-2xl p-4 sm:p-6 bg-sage-100 border border-sage-200">
          <h4 className="flex items-center gap-2 text-sm sm:text-base font-display font-bold text-forest-900 mb-3"><CreditCard className="w-5 h-5 text-forest-500" /> <TranslatedText>Payment Summary</TranslatedText></h4>
          <div className="mb-4">
            <label className="block text-xs font-bold tracking-wider text-forest-400 mb-2 uppercase">
              <TranslatedText>PROMO CODE</TranslatedText>
            </label>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="ENTER PROMO CODE"
              className={inputCls}
            />
            {promoLoading && (
              <p className="text-xs mt-2 text-forest-500 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-500" />
                <TranslatedText>Verifying code...</TranslatedText>
              </p>
            )}
            {!promoLoading && promoError && (
              <p className="text-xs mt-2 text-red-600 font-semibold">{promoError}</p>
            )}
            {!promoLoading && promoValid && (
              <p className="text-xs mt-2 text-green-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                <span>Promo Code Applied: {promoDetailsText} (-₹{promoDiscount.toFixed(2)})</span>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-forest-700">
              <span><TranslatedText>Consultation Fee</TranslatedText></span><span className="font-semibold">₹{Number(customFee + platformFee).toFixed(2)}</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-forest-700">
                <span><TranslatedText>Promo Discount</TranslatedText></span><span className="font-semibold text-green-700">- ₹{promoDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-3 mt-2 border-t border-sage-300">
              <div className="flex justify-between font-black font-display text-forest-500 text-lg sm:text-xl">
                <span><TranslatedText>Total Amount</TranslatedText></span><span>₹{previewTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-forest-400">
            <ShieldCheck className="w-4 h-4" />
            <p className="text-xs"><TranslatedText>Secure payment powered by Razorpay</TranslatedText></p>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div className="flex items-start gap-3 p-3 bg-sage-50 border border-sage-200 rounded-xl mt-4 mb-2">
          <input
            type="checkbox"
            id="patient-consent"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 text-forest-600 bg-white border-sage-300 rounded focus:ring-forest-500 focus:ring-2 cursor-pointer shrink-0"
          />
          <label htmlFor="patient-consent" className="text-xs sm:text-sm text-forest-700 leading-relaxed cursor-pointer">
            <TranslatedText as="span">I agree to the </TranslatedText>
            <a href="/terms-and-conditions" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">
              <TranslatedText as="span">Terms of Service</TranslatedText>
            </a>
            <TranslatedText as="span">, </TranslatedText>
            <a href="/refund-policy" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">
              <TranslatedText as="span">Refund Policy</TranslatedText>
            </a>
            <TranslatedText as="span">, and </TranslatedText>
            <a href="/privacy-policy" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">
              <TranslatedText as="span">Telemedicine Consent</TranslatedText>
            </a>
            <TranslatedText as="span">, and the </TranslatedText>
            <a href="/disclaimer" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">
              <TranslatedText as="span">Medical Disclaimer</TranslatedText>
            </a>
            <TranslatedText as="span">. I understand that the platform fee is non-refundable.</TranslatedText>
          </label>
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting || !consentAgreed}
          className="w-full py-3 sm:py-4 gradient-primary text-white rounded-2xl font-bold text-base sm:text-lg hover:-translate-y-0.5 shadow-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? (<><Loader2 className="w-6 h-6 animate-spin" /><TranslatedText as="span">Processing Payment...</TranslatedText></>) : (<><TranslatedText as="span">Confirm Booking & Pay</TranslatedText><CheckCircle2 className="w-5 h-5" /></>)}
        </button>
      </form>
    </div>
  );
}
