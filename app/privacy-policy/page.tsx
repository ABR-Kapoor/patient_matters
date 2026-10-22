import Link from 'next/link';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'Privacy Policy — AuraSutra',
  description: 'Read the Privacy Policy for AuraSutra services.',
};

const sections = [
  {
    heading: 'Information We Collect & Lawful Basis',
    content: 'We collect your name, email, phone number, date of birth, and health-related data required for consultations. Under the Digital Personal Data Protection (DPDP) Act 2023, our lawful basis for processing this data is your explicit consent. You may withdraw consent at any time, though this may prevent us from providing certain Services.',
  },
  {
    heading: 'How We Use Your Information',
    content: 'Your information is used to match you with practitioners, facilitate consultations, process payments, and send reminders. We may also use anonymized, aggregated data for research.',
  },
  {
    heading: 'Data Sharing & Cross-Border Transfers',
    content: 'We share your information only with the practitioners you consult and our secure payment partners (e.g., Razorpay). We do not sell your personal data. All your data is stored securely on servers located within India. We do not transfer your health data outside of India.',
  },
  {
    heading: 'Data Retention',
    content: 'As per the Telemedicine Practice Guidelines (2020), consultation records and prescriptions are retained for a minimum of 3 years. Payment data is retained for up to 1 year or as required by financial regulations.',
  },
  {
    heading: "Children's Data",
    content: 'Our Services are not intended for use by individuals under the age of 18 without verifiable parental or guardian consent. If we discover we have collected data from a minor without consent, we will delete it promptly.',
  },
  {
    heading: 'Your Rights (DPDP Act 2023)',
    content: 'You have the right to access your personal data, request correction of inaccuracies, and request the erasure of your data (Right to be Forgotten) subject to legal retention obligations. To exercise these rights or to nominate a representative in the event of death or incapacity, contact our Data Protection Officer at support@aurasutra.org.',
  },
  {
    heading: 'Data Breach Notification',
    content: 'We implement industry-standard security measures. In the unlikely event of a data breach affecting your personal data, we will notify you and the Data Protection Board of India within the legally mandated timeframes.',
  },
  {
    heading: 'Changes to This Policy',
    content: 'We may update this Privacy Policy from time to time. Continued use of our Services after changes constitutes your acceptance of the updated policy.',
  },
  {
    heading: 'Grievance Officer',
    content: 'In compliance with the Telemedicine Practice Guidelines 2020 and the Information Technology Act, 2000, any grievances or complaints regarding the platform may be addressed to the Grievance Officer: Abeer Kapoor, Email: grievance@aurasutra.org. We will acknowledge receipt of your complaint within 48 hours and resolve it within 30 days.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {/* Hero — light green */}
      <div style={{ background: 'var(--sage-100)', borderBottom: '1px solid var(--sage-200)' }} className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl" style={{ color: 'var(--forest-900)' }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--forest-500)' }} className="mt-3 text-sm">Last updated on 10-04-2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm border" style={{ borderColor: 'var(--sage-200)' }}>

          <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
            At AuraSutra, we are committed to protecting your privacy. This Privacy Policy explains how we collect,
            use, and safeguard your personal information when you use our website and Services.
          </p>

          <div className="space-y-6 sm:space-y-8">
            {sections.map((section) => (
              <section key={section.heading}>
                <h1 className="text-base sm:text-lg font-bold mb-2 sm:mb-3" style={{ color: 'var(--forest-700)' }}>{section.heading}</h1>
                <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed text-sm sm:text-base">{section.content}</p>
              </section>
            ))}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
