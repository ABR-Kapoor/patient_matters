import Link from 'next/link';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'Contact Us — AuraSutra',
  description: 'Get in touch with the AuraSutra team.',
};

export default function ContactPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {/* Hero — light green */}
      <div style={{ background: 'var(--sage-100)', borderBottom: '1px solid var(--sage-200)' }} className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl" style={{ color: 'var(--forest-900)' }}>
            Contact Us
          </h1>
          <p style={{ color: 'var(--forest-600)' }} className="mt-3 text-sm sm:text-base max-w-2xl">
            We are here to help. Reach out to our team anytime.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm border" style={{ borderColor: 'var(--sage-200)' }}>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Email */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--forest-500)' }}>Email</p>
              <a href="mailto:support@aurasutra.org" className="text-sm sm:text-base font-medium hover:underline" style={{ color: 'var(--forest-800)' }}>
                support@aurasutra.org
              </a>
            </div>

            {/* Address */}
            <div className="rounded-xl p-4 sm:p-5" style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--forest-500)' }}>Address</p>
              <p className="text-sm sm:text-base font-medium" style={{ color: 'var(--forest-800)' }}>
                Bhilai, Chhattisgarh, India
              </p>
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="mb-6 sm:mb-8">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--forest-500)' }}>Phone</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl p-4 sm:p-5 col-span-1 sm:col-span-2" style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200)' }}>
                <p className="text-xs sm:text-sm mb-1" style={{ color: 'var(--forest-600)' }}>Support Hotline</p>
                <a href="tel:+9197700XXXXX" className="text-sm sm:text-base font-medium hover:underline" style={{ color: 'var(--forest-800)' }}>
                  +91 97700 XXXXX
                </a>
              </div>
            </div>
          </div>

          {/* Hours */}
          <div className="rounded-xl p-4 sm:p-5" style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--forest-500)' }}>Support Hours</p>
            <p className="text-sm sm:text-base font-medium" style={{ color: 'var(--forest-800)' }}>Monday – Saturday, 9:00 AM – 6:00 PM IST</p>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
