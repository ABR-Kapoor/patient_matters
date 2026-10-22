import Footer from '@/app/components/Footer';
import VisionContent from '@/app/components/vision/VisionContent';
import VisionNavbar from '@/app/components/vision/VisionNavbar';

export const metadata = {
  title: 'Our Vision — AuraSutra',
  description: 'Building India\'s Health Intelligence Infrastructure — connecting every health event into one continuous intelligent healthcare journey.',
};

export default function VisionPage() {
  return (
    <div style={{ background: 'var(--sage-50)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <VisionNavbar />
      <VisionContent />
      <Footer />
    </div>
  );
}
