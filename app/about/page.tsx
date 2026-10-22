import Link from 'next/link';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'About Us — AuraSutra',
  description: 'Learn about AuraSutra, our mission to bring accessible Ayurvedic healthcare to everyone.',
};

export default function AboutPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {/* Hero — light green */}
      <div style={{ background: 'var(--sage-100)', borderBottom: '1px solid var(--sage-200)' }} className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl" style={{ color: 'var(--forest-900)' }}>
            About AuraSutra
          </h1>
          <p style={{ color: 'var(--forest-600)' }} className="mt-3 text-sm sm:text-base max-w-2xl">
            Bringing the ancient wisdom of Ayurveda to modern healthcare through technology.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm border" style={{ borderColor: 'var(--sage-200)' }}>

          {/* Mission */}
          <section className="mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: 'var(--forest-700)' }}>Our Mission</h2>
            <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed text-sm sm:text-base">
              AuraSutra is an AI-powered telemedicine platform dedicated to making Ayurvedic healthcare accessible to everyone.
              We connect patients with verified, AYUSH-certified Ayurvedic practitioners for online and offline consultations —
              bringing the healing power of traditional Indian medicine to your fingertips.
            </p>
          </section>

          {/* What We Offer */}
          <section className="mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: 'var(--forest-700)' }}>What We Offer</h2>
            <ul className="space-y-3">
              {[
                { title: 'AI Doctor Matching', desc: 'Describe your symptoms and our AI instantly matches you with the most suitable Ayurvedic specialist.' },
                { title: 'Video Consultations', desc: 'Connect with doctors from the comfort of your home through secure HD video calls.' },
                { title: 'Digital Prescriptions', desc: 'Receive, store and track your Ayurvedic prescriptions and treatment plans digitally.' },
                { title: 'Appointment Booking', desc: 'Book in-person or online appointments at your convenience with real-time availability.' },
              ].map(item => (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--forest-500)' }} />
                  <div className="text-sm sm:text-base">
                    <span className="font-semibold" style={{ color: 'var(--forest-800)' }}>{item.title}:</span>{' '}
                    <span style={{ color: 'var(--forest-900)', opacity: 0.75 }}>{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Why Us */}
          <section className="mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: 'var(--forest-700)' }}>Why AuraSutra</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { stat: 'AYUSH Certified', desc: 'All practitioners are verified by the Ministry of AYUSH.' },
                { stat: '4.9★ Rating', desc: 'Consistently rated by thousands of satisfied patients.' },
                { stat: '24/7 Available', desc: 'Access healthcare support anytime, anywhere.' },
              ].map(item => (
                <div key={item.stat} className="rounded-xl p-4" style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200)' }}>
                  <p className="font-bold text-base sm:text-lg" style={{ color: 'var(--forest-600)' }}>{item.stat}</p>
                  <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--forest-900)', opacity: 0.7 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Values */}
          <section className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: 'var(--forest-700)' }}>Our Values</h2>
            <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed text-sm sm:text-base">
              We believe in patient-first care, transparency, and the timeless efficacy of Ayurvedic medicine.
              Every feature we build is guided by our commitment to making authentic, affordable, and accessible
              Ayurvedic healthcare a reality for millions of people across India and beyond.
            </p>
          </section>

          <div className="pt-4 border-t" style={{ borderColor: 'var(--sage-200)' }}>
            <Link href="/contact" className="text-sm font-medium" style={{ color: 'var(--forest-500)' }}>
              Get in touch with us →
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
