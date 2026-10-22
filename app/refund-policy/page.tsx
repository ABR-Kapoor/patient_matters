import Link from 'next/link';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'Refund & Cancellation Policy — AuraSutra',
  description: 'Read the Cancellation and Refund Policy for AuraSutra services.',
};

const policies = [
  'Consultation Not Started: If you cancel the appointment before the consultation begins, you are eligible for a full refund. The refund request must be made within 7 days of cancellation.',
  'Call Dropped or Technical Failure: If the consultation could not be completed due to technical issues or a dropped call on the platform, you are eligible for a full refund or a free reschedule.',
  'Consultation Completed: Once the teleconsultation is completed and the service is delivered, no refunds will be provided.',
  'Doctor No-Show: If the doctor does not join the call within 10 minutes of the scheduled time, an automatic full refund will be triggered.',
  'Patient Cancellation > 2 Hours Before: If you cancel the appointment more than 2 hours before the scheduled time, a full refund will be provided.',
  'Patient Cancellation < 2 Hours Before: If you cancel the appointment less than 2 hours before the scheduled time, a 50% refund will be provided, as the doctor\'s time was blocked.',
  'Refund Processing Timeline: Approved refunds will take 5-7 business days to be processed and credited back to the original payment method.',
];

export default function RefundPolicyPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {/* Hero — light green */}
      <div style={{ background: 'var(--sage-100)', borderBottom: '1px solid var(--sage-200)' }} className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl" style={{ color: 'var(--forest-900)' }}>
            Refund &amp; Cancellation Policy
          </h1>
          <p style={{ color: 'var(--forest-500)' }} className="mt-3 text-sm">Last updated on 10-04-2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm border" style={{ borderColor: 'var(--sage-200)' }}>

          <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
            AuraSutra believes in helping its customers as far as possible, and has therefore a liberal cancellation policy.
            Under this policy:
          </p>

          <ul className="space-y-4 sm:space-y-5">
            {policies.map((policy, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--forest-500)' }} />
                <p style={{ color: 'var(--forest-900)', opacity: 0.8 }} className="leading-relaxed text-sm sm:text-base">{policy}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t" style={{ borderColor: 'var(--sage-200)' }}>
            <p style={{ color: 'var(--forest-900)', opacity: 0.7 }} className="text-sm">
              For any refund or cancellation queries, please{' '}
              <Link href="/contact" style={{ color: 'var(--forest-500)' }} className="hover:underline">contact us</Link>.
            </p>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
