import Link from 'next/link';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'Medical Disclaimer — AuraSutra',
  description: 'Read the Medical Disclaimer for using AuraSutra services.',
};

const sections = [
  {
    heading: 'Not a Healthcare Provider',
    content: 'AuraSutra is a practitioner directory and technology facilitator. We are NOT a hospital, clinic, or healthcare provider. The practitioners listed on our platform are independent professionals. AuraSutra does not provide any medical advice, diagnosis, or treatment.',
  },
  {
    heading: 'No Doctor-Patient Relationship',
    content: 'Your use of the platform does not create a doctor-patient relationship between you and AuraSutra. The doctor-patient relationship exists solely between you and the practitioner you choose to consult.',
  },
  {
    heading: 'Emergency Disclaimer',
    content: 'This platform is NOT for medical emergencies. If you are experiencing a medical emergency (e.g., chest pain, difficulty breathing, severe bleeding, unconsciousness), please CALL 112 immediately or go to the nearest hospital emergency department.',
  },
  {
    heading: 'Limitations of Teleconsultation',
    content: 'Teleconsultation has inherent limitations including but not limited to: inability to perform a complete physical examination, potential audio/video quality issues, and possible technical failures. Teleconsultation is NOT a substitute for in-person medical examination when such examination is necessary.',
  },
  {
    heading: 'Accuracy of Information',
    content: 'While we strive to ensure the accuracy of practitioner profiles, qualifications, and availability, we make no representations or warranties regarding the accuracy, completeness, or reliability of any information provided on the platform.',
  },
  {
    heading: 'Third-Party Links & Services',
    content: 'Our platform may contain links to third-party websites or services (e.g., payment processing by Razorpay). We are not responsible for the privacy practices or content of such third parties.',
  },
  {
    heading: 'User Responsibility',
    content: 'You are responsible for providing accurate health information to your chosen practitioner. You should exercise your own judgment before making any health decisions based on information obtained through the platform.',
  },
  {
    heading: 'Contact Us',
    content: 'If you have any questions about this disclaimer, please contact us at support@aurasutra.org.',
  },
];

export default function DisclaimerPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ background: 'var(--sage-100)', borderBottom: '1px solid var(--sage-200)' }} className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl" style={{ color: 'var(--forest-900)' }}>
            Medical Disclaimer
          </h1>
          <p style={{ color: 'var(--forest-500)' }} className="mt-3 text-sm">Last updated on 10-04-2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm border" style={{ borderColor: 'var(--sage-200)' }}>
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
