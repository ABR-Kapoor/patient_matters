// ─────────────────────────────────────────────────────────
//  AURASUTRA LANDING — Shared constants & data
//  Real doctors from Raipur, Bhilai, and Durg (CG)
// ─────────────────────────────────────────────────────────

import {
  Leaf, Wind, Brain, Stethoscope, Moon, Flame, Eye, Bone,
  Users, CalendarCheck, Globe, Video,
  ShieldCheck, FileText, Clock, Star,
} from 'lucide-react';

export const PLATFORM_FEE = 20;

export const SPECIALTIES = [
  { icon: Leaf,        label: 'Ayurveda',          color: '#22854a', bg: '#e4f5ec', count: '24+', desc: 'Ancient science of life', image: '/ayurveda_specialty.png' },
  { icon: Wind,        label: 'Panchakarma',       color: '#0891b2', bg: '#e0f2fe', count: '12+', desc: 'Five-fold purification', image: '/panchakarma_specialty.png' },
  { icon: Brain,       label: 'Homeopathy',        color: '#7c3aed', bg: '#ede9fe', count: '18+', desc: 'Gentle healing system', image: '/homeopathy_specialty.png' },
  { icon: Stethoscope, label: 'Allopathic',        color: '#dc2626', bg: '#fee2e2', count: '32+', desc: 'Modern evidence-based', image: '/allopathic_specialty.png' },
  { icon: Moon,        label: 'Yoga & Naturopathy',color: '#d97706', bg: '#fef3c7', count: '8+',  desc: 'Natural lifestyle healing', image: '/naturopathy_specialty.png' },
  { icon: Flame,       label: 'Unani',             color: '#c2410c', bg: '#ffedd5', count: '6+',  desc: 'Greco-Arabic medicine', image: '/unani_specialty.png' },
  { icon: Eye,         label: 'Ophthalmology',     color: '#0e7490', bg: '#cffafe', count: '10+', desc: 'Complete eye care', image: '/ophthalmology_specialty.png' },
  { icon: Bone,        label: 'Orthopedics',       color: '#7c3aed', bg: '#f3e8ff', count: '14+', desc: 'Bone & joint care', image: '/orthopedics_specialty.png' },
];

export const HOW_IT_WORKS = [
  { step: '01', icon: Brain, color: '#22854a', title: 'Describe Your Symptoms', desc: 'Type or speak in Hindi or English. Our AI understands nuance — from "pet mein dard" to complex clinical descriptions.' },
  { step: '02', icon: Users, color: '#0891b2', title: 'AI Matches Instantly', desc: 'Our engine scans verified Ayurvedic, Allopathic & Homeopathic doctors across Chhattisgarh for your ideal match.' },
  { step: '03', icon: CalendarCheck, color: '#7c3aed', title: 'Book & Consult', desc: 'Book clinic or video appointments in seconds. Get digital prescriptions and follow-up care — all in one place.' },
];

export const STATS = [
  { value: 68,   suffix: '+', label: 'Verified Doctors', icon: Stethoscope },
  { value: 2400, suffix: '+', label: 'Patients Served',  icon: Users },
  { value: 4,    suffix: '',  label: 'Cities Covered',   icon: Globe },
  { value: 4.9,  suffix: '★', label: 'Patient Rating',   icon: Star },
];

export const FEATURES = [
  { badge: 'AI MATCHING',     title: 'Smart Symptom Analysis',       body: 'Our AI understands nuanced symptoms to find the exact specialist you need — in seconds, not hours.', icon: Brain },
  { badge: 'VERIFIED',        title: 'Verified Local Experts',   body: 'Every practitioner is vetted for academic credentials, experience, and real patient satisfaction scores.', icon: ShieldCheck },
  { badge: 'SEAMLESS',        title: 'End-to-End Care',              body: 'Book appointments, join video consultations, track prescriptions, get reminders — all in one trusted platform.', icon: CalendarCheck },
  { badge: 'LIVE QUEUE',      title: 'Real-Time Queue Tracking',     body: "Know your exact position in the OPD queue. No more waiting rooms. Get notified when it's your turn.", icon: Clock },
  { badge: 'MULTILINGUAL',    title: 'Hindi & English Support',      body: "Fully bilingual — describe symptoms, read prescriptions, and consult in the language you're most comfortable with.", icon: Globe },
  { badge: 'DIGITAL RECORDS', title: 'Lifetime Health Records',      body: 'All prescriptions, diagnoses, and reports in one secure digital vault — accessible from anywhere, anytime.', icon: FileText },
];

export const COMPARISON = [
  { feature: 'AI Symptom Matching',        us: true, practo: false, zocdoc: false, noqueue: false },
  { feature: 'Hindi / Bilingual',          us: true, practo: false, zocdoc: false, noqueue: false },
  { feature: 'Local Clinic Directory',     us: true, practo: false, zocdoc: false, noqueue: false },
  { feature: 'Live OPD Queue',             us: true, practo: false, zocdoc: false, noqueue: true  },
  { feature: 'Digital Prescriptions',      us: true, practo: true,  zocdoc: false, noqueue: false },
  { feature: 'Medicine Adherence',         us: true, practo: false, zocdoc: false, noqueue: false },
  { feature: 'Video Consultations',        us: true, practo: true,  zocdoc: true,  noqueue: false },
  { feature: 'Voice Input (Hindi+EN)',     us: true, practo: false, zocdoc: false, noqueue: false },
];

export const TESTIMONIALS = [
  { name: 'Priya Sharma', role: 'Ayurveda Patient · Raipur', rating: 5, text: 'I described my chronic joint pain and within seconds AuraSutra matched me with an Ayurvedic specialist near Shankar Nagar. Three sessions and I felt like a new person.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face' },
  { name: 'Rahul Verma', role: 'Homeopathy Patient · Bhilai', rating: 5, text: "Finding a trusted homeopathic doctor in Nehru Nagar used to be a nightmare. AuraSutra's platform is clean, the doctors are verified, and booking takes 30 seconds.", img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face' },
  { name: 'Anita Patel', role: 'Wellness Member · Durg', rating: 5, text: 'The multilingual support is what sets AuraSutra apart. I described my symptoms in Hindi and got matched with a Panchakarma expert at Vedamm Ayurved the same day.', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=face' },
];

export const FEATURED_DOCTORS = [
  { name: 'Dr. Dinesh Khemnani',     spec: 'Ayurveda',    exp: 40, fee: 300, rating: 4.9, city: 'Raipur',  size: 'Micro',  patients: 8200, clinic: 'Khemnani Ayurved Clinic',                img: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=800', bio: 'Expert in Nadi Pariksha and chronic disease management through holistic Ayurvedic principles.' },
  { name: 'Dr. Kavita Dwivedi',      spec: 'Homeopathy',  exp: 15, fee: 350, rating: 4.8, city: 'Raipur',  size: 'Micro',  patients: 2100, clinic: 'Holistic Homoeopathy Clinic',            img: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=800', bio: 'Specializing in constitutional homeopathy for respiratory and skin ailments.' },
  { name: 'Dr. Tanuja Chandrakar',   spec: 'Panchakarma', exp: 12, fee: 400, rating: 4.7, city: 'Bhilai',  size: 'Small',  patients: 1400, clinic: 'Ayurvedam Panchkarm, Nehru Nagar',      img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=800', bio: 'Panchakarma specialist focusing on detoxification, rejuvenation therapies, and stress management.' },
  { name: 'Dr. Yugendra Chandrakar', spec: 'Ayurveda',    exp: 30, fee: 500, rating: 4.9, city: 'Raipur',  size: 'Small',  patients: 5600, clinic: 'Chandrakar Ayurvedic Clinic',           img: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=800', bio: 'Renowned Ayurvedic physician dedicated to treating joint pain, arthritis, and lifestyle disorders.' },
  { name: 'Dr. Madhu Rani Verma',    spec: 'Panchakarma', exp: 18, fee: 600, rating: 4.8, city: 'Raipur',  size: 'Medium', patients: 3200, clinic: 'Vedamm Ayurved & Neurocare',            img: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&q=80&w=800', bio: 'Advanced Panchakarma expert specializing in neurological disorders and post-stroke rehabilitation.' },
  { name: 'Dr. K.B. Srinivas Rao',   spec: 'Ayurveda',    exp: 25, fee: 700, rating: 4.9, city: 'Raipur',  size: 'Medium', patients: 4800, clinic: 'Raj Rajeshwari Ayurvedic Wellness',     img: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=800', bio: 'Holistic wellness guide combining traditional Ayurveda with modern diagnostic techniques.' },
  { name: 'Dr. Anil Patel',          spec: 'Allopathic',  exp: 16, fee: 450, rating: 4.7, city: 'Bhilai',  size: 'Medium', patients: 3500, clinic: 'Piles Clinic & Laser Center',           img: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=800', bio: 'Proctologist using advanced laser treatments for fast, painless recovery from anorectal diseases.' },
  { name: 'Dr. Mitesh Sharma',       spec: 'Panchakarma', exp: 11, fee: 500, rating: 4.8, city: 'Raipur',  size: 'Small',  patients: 1800, clinic: 'Jiva Ayurveda, Kutchery Chowk',         img: 'https://images.unsplash.com/photo-1622902046580-2b47f47f5471?auto=format&fit=crop&q=80&w=800', bio: 'Expert in classical Panchakarma therapies tailored for metabolic disorders and weight management.' },
  { name: 'Dr. Satyen Gyani',        spec: 'Allopathic',  exp: 20, fee: 400, rating: 4.6, city: 'Bhilai',  size: 'Small',  patients: 2800, clinic: 'Well Baby Clinic',                     img: 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&q=80&w=800', bio: 'Compassionate pediatrician committed to providing comprehensive healthcare for infants and children.' },
];

export const QUICK_SYMPTOMS = [
  'I have had a severe migraine since yesterday',
  'मुझे दो दिन से तेज बुखार है',
  'My lower back hurts when I sit',
  'मुझे पिछले हफ्ते से खांसी और जुकाम है',
  'Constant stress and anxiety at work',
  'मुझे पेट में दर्द और एसिडिटी है'
];

export const MARQUEE_ITEMS = [
  'Ayurveda', 'Panchakarma', 'Homeopathy', 'Allopathic', 'Verified Profiles',
  'Yoga & Naturopathy', 'Verified Doctors', 'Raipur', 'Bhilai',
  'Book Instantly', '24/7 Support', 'Hindi Supported', 'Live Queue Tracking',
  'Digital Prescriptions', 'Video Consultations',
];

export const DOCTOR_AVATARS = [
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=80&h=80&fit=crop&crop=face',
];

export const FAQS = [
  { q: 'Is the AI doctor search free to use?', a: 'Yes — searching for doctors is completely free. You only pay when you book an appointment (doctor fee + ₹20 platform fee).' },
  { q: 'Are the doctors on AuraSutra verified?', a: 'Every doctor is manually vetted for credentials, years of experience, and patient satisfaction scores before going live.' },
  { q: 'Can I consult online or only in-person?', a: "Both! You can book video consultations or in-clinic appointments depending on the doctor's availability and your preference." },
  { q: 'Is the platform available in Hindi?', a: 'Yes — AuraSutra is fully bilingual. Describe symptoms, read prescriptions, and navigate the platform entirely in Hindi.' },
  { q: 'Which cities are currently covered?', a: 'We cover Raipur, Bhilai, Durg, and surrounding areas of Chhattisgarh — with more cities coming soon.' },
  { q: 'How does live queue tracking work?', a: 'After booking an in-clinic appointment, you receive a live token number. You can track your queue position in real-time and get push notifications when your turn approaches.' },
];
