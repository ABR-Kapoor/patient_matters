'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Sparkles, Heart, ShieldCheck, Cpu, Brain, Eye, Activity,
  Microscope, Network, Bot, Building2, Stethoscope, ArrowRight,
  CheckCircle2, Users, Lock, Lightbulb, Accessibility,
  Database, Cloud, Radio, FileSearch, Search,
  Fingerprint, Layers, Globe, Quote, ArrowUpRight,
  TrendingUp, X
} from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
});

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.06 } },
  viewport: { once: true, margin: '-50px' },
};

const cardFade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 14 } },
  viewport: { once: true, margin: '-50px' },
};

const completedFeatures = [
  'Patient Platform', 'Doctor Platform', 'Appointment Management', 'Telehealth',
  'Video Consultation', 'Digital Prescription', 'Secure Authentication', 'Clinical Workflow', 'Cloud Infrastructure',
];

const roadmap = [
  { year: '2026', title: 'Digital Healthcare Foundation', desc: 'Core platform with appointments, telehealth, prescriptions & clinical workflows', done: true },
  { year: '2027', title: 'Clinical Intelligence', desc: 'AI-assisted diagnosis support, predictive analytics, unified health records', done: false },
  { year: '2028', title: 'Medical Imaging AI + AuraNode', desc: 'Computer vision for diagnostics, edge hardware for offline clinics', done: false },
  { year: '2029', title: 'Human Digital Twin + Research Platform', desc: 'Longitudinal health models, privacy-preserving research infrastructure', done: false },
  { year: '2030', title: "India's Health Intelligence Infrastructure", desc: 'Nation-scale connected healthcare intelligence network', done: false },
];

const principles = [
  { icon: Heart, title: 'Human First', desc: 'Every technology decision starts with the question — does this help people live healthier?' },
  { icon: ShieldCheck, title: 'Trust', desc: 'Built on verifiable credentials, transparent practices, and clinical-grade reliability.' },
  { icon: Lock, title: 'Privacy', desc: 'Privacy by design. Federated learning. Patient-owned health data with granular consent.' },
  { icon: Lightbulb, title: 'Innovation', desc: 'Continuous research and development pushing the boundaries of what healthcare technology can achieve.' },
  { icon: Accessibility, title: 'Accessibility', desc: 'Designed for every Indian — urban clinics, rural health centres, and home-based care.' },
  { icon: Microscope, title: 'Research', desc: 'Academic partnerships and clinical studies to validate every intelligence layer we build.' },
];

const impacts = [
  { icon: Globe, title: 'Better Access', desc: 'Connecting patients to the right healthcare professionals regardless of geography.' },
  { icon: Activity, title: 'Continuous Care', desc: 'Health monitoring that never stops — between appointments, across life stages.' },
  { icon: Brain, title: 'Clinical Intelligence', desc: 'Empowering doctors with AI-assisted insights for faster, more accurate decisions.' },
  { icon: Microscope, title: 'Research Innovation', desc: 'Privacy-preserving population health intelligence to advance medical science.' },
  { icon: Users, title: 'Population Health', desc: 'Real-time disease surveillance and public health intelligence at state and national levels.' },
  { icon: Building2, title: 'Future Ready Healthcare', desc: 'Infrastructure designed to evolve with India\'s healthcare needs through 2030 and beyond.' },
];

const techStack = [
  { icon: Brain, label: 'Artificial Intelligence' },
  { icon: Eye, label: 'Medical Imaging' },
  { icon: Cpu, label: 'Computer Vision' },
  { icon: Layers, label: 'Foundation Models' },
  { icon: Network, label: 'Knowledge Graph' },
  { icon: Cloud, label: 'Cloud Infrastructure' },
  { icon: Radio, label: 'Edge AI' },
  { icon: FileSearch, label: 'FHIR / HL7' },
  { icon: Search, label: 'DICOM' },
  { icon: Building2, label: 'ABDM Ready' },
  { icon: Fingerprint, label: 'Explainable AI' },
  { icon: Bot, label: 'Federated Learning' },
];

function SectionHeading({ badge, title, desc }: { badge: string; title: string; desc?: string }) {
  return (
    <motion.div className="text-center mb-16" {...fadeUp(0)}>
      <span className="pill-badge mb-4 inline-block">{badge}</span>
      <h2 className="headline-lg text-foreground mb-4">{title}</h2>
      {desc && <p className="body-md text-muted-foreground max-w-2xl mx-auto">{desc}</p>}
    </motion.div>
  );
}

export default function VisionContent() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [contactModal, setContactModal] = useState<{ open: boolean; type: 'partner' | 'contact' }>({ open: false, type: 'partner' });
  const [contactForm, setContactForm] = useState({ name: '', email: '', organisation: '', role: '', message: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const roadmapRef = useRef<HTMLDivElement>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus('loading');
    try {
      const res = await fetch('/api/vision-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: contactModal.type, ...contactForm }),
      });
      if (!res.ok) throw new Error('failed');
      setContactStatus('success');
      setContactForm({ name: '', email: '', organisation: '', role: '', message: '' });
      setTimeout(() => {
        setContactModal({ open: false, type: 'partner' });
        setContactStatus('idle');
      }, 2500);
    } catch {
      setContactStatus('error');
    }
  };
  const { scrollYProgress: roadmapProgress } = useScroll({
    target: roadmapRef,
    offset: ['start center', 'end center'],
  });
  const lineHeight = useTransform(roadmapProgress, [0, 1], ['0%', '100%']);

  return (
    <div className="overflow-hidden">
      {/* ─── Section 1: Hero ─── */}
      <section id="vision-hero" className="relative min-h-[100dvh] flex items-center pt-24 pb-16 overflow-hidden bg-gradient-to-b from-background via-surface to-background">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-[160px]" />
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/20"
              style={{
                left: `${5 + (i * 47) % 90}%`,
                top: `${10 + (i * 31) % 80}%`,
              }}
              animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.5, 1] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div {...fadeUp(0.1)} className="flex items-center justify-center gap-2 mb-6">
              <span className="pill-badge flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Powered by FrequnSync
              </span>
              <span className="pill-badge">Udyam MSME Registered</span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.2)}
              className="display-md text-foreground mb-6 leading-[1.08]"
            >
              Building India's{' '}
              <span className="text-primary">Health Intelligence</span>{' '}
              Infrastructure
            </motion.h1>

            <motion.p
              {...fadeUp(0.3)}
              className="body-lg text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              Connecting every health event into one continuous intelligent healthcare journey
              through artificial intelligence, connected devices and clinical innovation.
            </motion.p>

            <motion.div {...fadeUp(0.4)} className="flex flex-wrap items-center justify-center gap-4">
              <button className="btn-primary inline-flex items-center gap-2 text-sm">
                Explore Platform <ArrowRight className="w-4 h-4" />
              </button>
              <button className="btn-secondary inline-flex items-center gap-2 text-sm">
                Our Roadmap <ArrowUpRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Section 2: Healthcare Today vs AuraSutra ─── */}
      <section id="vision-shift" className="py-28 bg-surface relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeading badge="THE SHIFT" title="Healthcare Then vs Now" desc="The way healthcare works today is fragmented. We are building something fundamentally different." />
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div
              {...fadeUp(0.1)}
              className="rounded-3xl p-8 md:p-10 border bg-white/50 border-border/50"
            >
              <div className="w-14 h-14 rounded-2xl bg-status-error/10 flex items-center justify-center text-status-error mb-6">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-6">Today's Healthcare</h3>
              <ul className="space-y-4">
                {['Disconnected Reports', 'Different Hospitals', 'Scattered Records', 'Repeated Diagnosis', 'Fragmented Care'].map((item, i) => (
                  <motion.li key={item} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center gap-3 text-muted-foreground font-medium"
                  >
                    <span className="w-6 h-6 rounded-full bg-status-error/10 flex items-center justify-center shrink-0">
                      <span className="w-2 h-2 rounded-full bg-status-error" />
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...fadeUp(0.2)}
              className="rounded-3xl p-8 md:p-10 border bg-primary/5 border-primary/20 relative overflow-hidden group"
            >
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 smooth-transition" />
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary mb-6">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-6">AuraSutra</h3>
              <ul className="space-y-4">
                {['Connected Healthcare', 'Continuous Intelligence', 'Unified Health Timeline', 'AI Assisted Care', 'Smarter Decisions', 'Better Outcomes'].map((item, i) => (
                  <motion.li key={item} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-center gap-3 text-foreground font-semibold"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Who We Are ─── */}
      <section id="vision-who" className="py-28 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.span className="pill-badge mb-4 inline-block" {...fadeUp(0)}>WHO WE ARE</motion.span>
          <motion.p className="body-lg text-muted-foreground leading-relaxed mb-8" {...fadeUp(0.1)}>
            AuraSutra is a healthcare technology initiative by{' '}
            <strong className="text-foreground">FrequnSync</strong> established in{' '}
            <strong className="text-foreground">2026</strong> and registered under{' '}
            <strong className="text-foreground">Udyam MSME</strong> Government of India.
          </motion.p>
          <motion.div className="space-y-6 max-w-3xl mx-auto" {...fadeUp(0.15)}>
            {[
              'We believe healthcare should not begin when illness appears. Healthcare should continuously understand, learn and assist throughout every stage of life.',
              'AuraSutra connects patients, healthcare professionals and intelligent technologies into one continuously evolving healthcare ecosystem.',
              'Our vision is to build India\'s Health Intelligence Infrastructure that transforms fragmented medical information into meaningful clinical intelligence.',
            ].map((text, i) => (
              <motion.p
                key={i}
                className="text-lg text-foreground/80 leading-relaxed font-medium"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.12 }}
              >
                {text}
              </motion.p>
            ))}
          </motion.div>
          <motion.div className="flex items-center justify-center gap-3 mt-10" {...fadeUp(0.3)}>
            <span className="pill-badge flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Udyam MSME Registered</span>
            <span className="pill-badge flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Established 2026</span>
          </motion.div>
        </div>
      </section>

      {/* ─── Section 4: Where We Are Today ─── */}
      <section id="vision-built" className="py-28 bg-surface relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeading badge="ALREADY BUILT" title="Where We Are Today" desc="A production-ready digital healthcare platform. Built. Tested. Deployed." />

          <motion.div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 max-w-5xl mx-auto" variants={stagger} initial="initial" whileInView="whileInView">
            {completedFeatures.map((feature, i) => (
              <motion.div
                key={feature}
                variants={cardFade}
                className="relative rounded-2xl p-5 bg-white border border-border/60 hover:border-primary/30 hover:shadow-md smooth-transition group"
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 smooth-transition">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Completed</span>
                </div>
                <p className="text-sm font-bold text-foreground">{feature}</p>
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-primary/40 rounded-full"
                  initial={{ width: '0%' }}
                  animate={hoveredCard === i ? { width: '100%' } : { width: '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Section 5: Roadmap ─── */}
      <section id="vision-roadmap" className="py-28 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, var(--sage-50) 0%, #fff 50%, var(--sage-50) 100%)' }}>
        {/* Ambient background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,133,74,0.06) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,133,74,0.04) 0%, transparent 70%)' }}
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <SectionHeading badge="OUR ROADMAP" title="The Journey Ahead" desc="From digital foundation to national health intelligence infrastructure." />

          <div ref={roadmapRef} className="relative mt-8">
            {/* Simple elegant spine line */}
            <div className="absolute left-6 md:left-[10%] top-4 bottom-4 w-[2px] bg-sage-200/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-x-0 top-0 rounded-full bg-primary"
                style={{ height: lineHeight }}
              />
            </div>

            <div className="space-y-16">
              {roadmap.map((item, i) => {
                const dotColors: Record<string, string> = {
                  '2026': 'bg-primary border-primary shadow-primary/20',
                  '2027': 'bg-blue-600 border-blue-600 shadow-blue-500/20',
                  '2028': 'bg-violet-600 border-violet-600 shadow-violet-500/20',
                  '2029': 'bg-amber-500 border-amber-500 shadow-amber-500/20',
                  '2030': 'bg-rose-500 border-rose-500 shadow-rose-500/20',
                };
                const bgColors: Record<string, string> = {
                  '2026': 'bg-primary/[0.03] border-primary/20',
                  '2027': 'bg-blue-50/50 border-blue-200/50',
                  '2028': 'bg-violet-50/50 border-violet-200/50',
                  '2029': 'bg-amber-50/50 border-amber-200/50',
                  '2030': 'bg-rose-50/50 border-rose-200/50',
                };
                const dotClass = dotColors[item.year] || dotColors['2026'];
                const cardClass = bgColors[item.year] || bgColors['2026'];

                return (
                  <motion.div
                    key={item.year}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
                    className="relative flex items-start gap-8 md:gap-12 pl-6 md:pl-[10%]"
                  >
                    {/* Minimal Node */}
                    <div className="absolute left-6 md:left-[10%] -translate-x-[calc(50%-1px)] z-10 flex h-full justify-center">
                      <div className="mt-1">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 bg-white transition-all duration-300 ${item.done ? dotClass : 'border-sage-300'}`}>
                          {item.done && (
                            <div className="w-full h-full rounded-full bg-inherit" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Card */}
                    <div className={`flex-1 rounded-3xl p-6 md:p-8 border transition-all duration-300 ${
                      item.done 
                        ? `${cardClass} shadow-sm hover:shadow-md hover:-translate-y-1`
                        : 'bg-white border-border/60 hover:border-primary/30 hover:shadow-sm hover:-translate-y-1'
                    }`}>
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-widest ${
                          item.done ? 'bg-white shadow-sm text-foreground' : 'bg-sage-50 text-muted-foreground'
                        }`}>
                          {item.year}
                        </span>
                        {item.done && (
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest">
                            <span className="w-3.5 h-3.5 rounded-full bg-primary/10 flex items-center justify-center">✓</span>
                            Completed
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 font-display">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                        {item.desc}
                      </p>

                      {!item.done && (
                        <div className="mt-6 h-[3px] rounded-full bg-sage-100 max-w-xs overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-sage-300"
                            initial={{ width: '0%' }}
                            whileInView={{ width: '40%' }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 6: Intelligence Layer ─── */}
      <section id="vision-intelligence" className="py-28 bg-gradient-to-b from-surface to-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/[0.04] rounded-full blur-[140px]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <SectionHeading badge="INTELLIGENCE LAYER" title="Aura Intelligence Core" desc="The central nervous system of India's future healthcare infrastructure." />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Brain, label: 'Clinical AI' },
              { icon: Eye, label: 'Medical Imaging AI' },
              { icon: Network, label: 'Knowledge Graph' },
              { icon: Cpu, label: 'Computer Vision' },
              { icon: Layers, label: 'Foundation Models' },
              { icon: Activity, label: 'Human Digital Twin' },
              { icon: Search, label: 'Predictive Analytics' },
              { icon: Radio, label: 'Edge AI' },
              { icon: Globe, label: 'Connected Devices' },
              { icon: Database, label: 'Population Health' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white border border-border/60 hover:border-primary/30 hover:shadow-md smooth-transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/15 smooth-transition">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-foreground text-center leading-tight">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 7: Core Principles ─── */}
      <section id="vision-principles" className="py-28 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeading badge="OUR PRINCIPLES" title="What Guides Everything We Build" />

          <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto" variants={stagger} initial="initial" whileInView="whileInView">
            {principles.map((principle) => (
              <motion.div
                key={principle.title}
                variants={cardFade}
                className="group rounded-2xl p-7 bg-white border border-border/60 hover:border-primary/20 hover:shadow-lg smooth-transition"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:bg-primary/15 smooth-transition">
                  <principle.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{principle.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{principle.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Section 8: Impact ─── */}
      <section id="vision-impact" className="py-28 bg-surface relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-[450px] h-[450px] bg-primary/[0.03] rounded-full blur-[110px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeading badge="OUR IMPACT" title="What We Are Building Towards" />

          <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto" variants={stagger} initial="initial" whileInView="whileInView">
            {impacts.map((impact) => (
              <motion.div
                key={impact.title}
                variants={cardFade}
                className="rounded-2xl p-7 bg-white border border-border/60 hover:border-primary/20 hover:shadow-md smooth-transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 smooth-transition">
                  <impact.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{impact.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{impact.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Section 9: Technology Foundation ─── */}
      <section className="py-28 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeading badge="TECHNOLOGY FOUNDATION" title="The Stack Behind The Vision" desc="Built on open standards, medical-grade protocols and modern AI infrastructure." />

          <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto" variants={stagger} initial="initial" whileInView="whileInView">
            {techStack.map((tech) => (
              <motion.div
                key={tech.label}
                variants={cardFade}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-surface border border-border/60 hover:border-primary/30 hover:shadow-md hover:bg-white smooth-transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/15 smooth-transition">
                  <tech.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-foreground text-center leading-tight">{tech.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Section 10: Closing Vision + CTA ─── */}
      <section id="vision-closing" className="relative py-32 overflow-hidden bg-gradient-to-b from-white to-sage-50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[130px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div {...fadeUp(0)}>
            <Quote className="w-10 h-10 text-primary/30 mx-auto mb-8" />
            <blockquote className="text-2xl md:text-3xl font-display text-foreground leading-relaxed mb-8">
              "We are not building another healthcare application.
              <br />
              <span className="text-primary">We are building the intelligence layer that will power the future of healthcare.</span>"
            </blockquote>
          </motion.div>

          <motion.div className="mb-16" {...fadeUp(0.15)}>
            <span className="text-xs font-black tracking-[0.2em] text-primary/70 uppercase">Vision 2030</span>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mt-3">
              India's AI Powered Human Health Intelligence Infrastructure.
            </h3>
          </motion.div>

          {/* Interactive role cards */}
          <motion.div {...fadeUp(0.2)} className="mb-12">
            <p className="text-sm font-semibold text-muted-foreground mb-6">
              Select your role to see how you fit in this journey →
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { role: 'Healthcare Professional', icon: Stethoscope, detail: 'Join a network of verified practitioners. Manage your practice, consult patients via video, issue digital prescriptions, and track outcomes with AI-assisted insights.' },
                { role: 'Technology Partner', icon: Cpu, detail: 'Integrate with our open platform. Build on our API, contribute to our intelligence layer, and help shape the future of healthcare technology in India.' },
                { role: 'Researcher', icon: Microscope, detail: 'Access privacy-preserving population health data. Collaborate on clinical studies, validate AI models, and publish breakthrough research.' },
                { role: 'Investor', icon: TrendingUp, detail: 'Back India\'s next health-tech frontier. We are building the infrastructure that will power healthcare for a billion people.' },
              ].map((card) => {
                const Icon = card.icon;
                const isActive = activeRole === card.role;
                return (
                  <motion.button
                    key={card.role}
                    onClick={() => setActiveRole(activeRole === card.role ? null : card.role)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className={`relative rounded-2xl p-5 text-left transition-all duration-300 border ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10'
                        : 'bg-white border-border/60 hover:border-primary/30 hover:shadow-md hover:shadow-black/5'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 ${
                      isActive ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-primary/10 text-primary'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className={`text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}>{card.role}</p>
                    <motion.div
                      initial={false}
                      animate={{ height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{card.detail}</p>
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* CTA Card */}
          <motion.div {...fadeUp(0.3)} className="relative bg-white rounded-3xl p-10 md:p-14 border border-sage-200 max-w-2xl mx-auto shadow-sm overflow-hidden">
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xl md:text-2xl font-display font-bold text-foreground mb-4">
              Join us in shaping the future of healthcare.
            </h3>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
              Whether you are a healthcare professional, technology partner, researcher or investor — there is a role for you in this journey.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                onClick={() => setContactModal({ open: true, type: 'partner' })}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-[0_4px_20px_rgba(34,133,74,0.35)] hover:shadow-[0_6px_28px_rgba(34,133,74,0.45)] transition-shadow"
              >
                Partner With Us <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                onClick={() => setContactModal({ open: true, type: 'contact' })}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-sage-100 text-forest-800 font-bold text-sm hover:bg-sage-200 transition-colors border border-sage-200"
              >
                Contact Team <ArrowUpRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>

          <motion.div className="mt-12 flex flex-wrap items-center justify-center gap-3" {...fadeUp(0.35)}>
            <span className="pill-badge flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> AuraSutra by FrequnSync</span>
            <span className="pill-badge">Est. 2026</span>
            <span className="pill-badge">Udyam MSME</span>
          </motion.div>
        </div>
      </section>

      {/* ─── Contact / Partner Modal ─── */}
      <AnimatePresence>
        {contactModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setContactModal({ open: false, type: 'partner' }); }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-forest-950/20 backdrop-blur-md" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="relative w-full max-w-[500px] bg-white rounded-3xl shadow-[0_24px_64px_rgba(20,40,30,0.12)] overflow-hidden z-10 border border-sage-200/50"
            >
              <button
                onClick={() => setContactModal({ open: false, type: 'partner' })}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-sage-50 text-forest-500 flex items-center justify-center hover:bg-sage-100 hover:text-forest-800 transition-colors z-20"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="px-8 pt-8 pb-5">
                <div className="w-12 h-12 rounded-2xl bg-sage-50 flex items-center justify-center mb-4 border border-sage-100">
                  {contactModal.type === 'partner' ? (
                    <TrendingUp className="w-5 h-5 text-primary" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-primary" />
                  )}
                </div>
                <h2 className="text-2xl font-display font-bold text-forest-900 leading-tight">
                  {contactModal.type === 'partner' ? 'Partner With Us' : 'Contact Our Team'}
                </h2>
                <p className="text-forest-600/80 text-sm mt-1">We typically reply within 24 hours.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleContactSubmit} className="px-8 pb-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-forest-500 mb-1.5 block">Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Doe"
                      value={contactForm.name}
                      onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-3 text-sm rounded-2xl border border-sage-200 bg-white hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-forest-900 placeholder:text-forest-300"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-forest-500 mb-1.5 block">Email</label>
                    <input
                      required
                      type="email"
                      placeholder="jane@example.com"
                      value={contactForm.email}
                      onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-4 py-3 text-sm rounded-2xl border border-sage-200 bg-white hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-forest-900 placeholder:text-forest-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-forest-500 mb-1.5 block">Organisation <span className="font-medium normal-case tracking-normal text-forest-400">(Optional)</span></label>
                  <input
                    type="text"
                    placeholder="Company or Institution"
                    value={contactForm.organisation}
                    onChange={e => setContactForm(f => ({ ...f, organisation: e.target.value }))}
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-sage-200 bg-white hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-forest-900 placeholder:text-forest-300"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-forest-500 mb-1.5 block">Your Role</label>
                  <select
                    value={contactForm.role}
                    onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-sage-200 bg-white hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-forest-900 appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23a1a1aa\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
                  >
                    <option value="" disabled className="text-forest-400">Select your role...</option>
                    <option>Healthcare Professional</option>
                    <option>Technology Partner</option>
                    <option>Researcher</option>
                    <option>Investor</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-forest-500 mb-1.5 block">Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder={contactModal.type === 'partner'
                      ? "Tell us how you'd like to collaborate..."
                      : "How can our team help you?"}
                    value={contactForm.message}
                    onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-sage-200 bg-white hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-forest-900 placeholder:text-forest-300 resize-none"
                  />
                </div>

                {contactStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl px-4 py-3 text-sm font-semibold"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    Message sent successfully!
                  </motion.div>
                )}
                {contactStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-800 rounded-2xl px-4 py-3 text-sm font-semibold"
                  >
                    Something went wrong. Please email support@aurasutra.org.
                  </motion.div>
                )}

                <div className="pt-4">
                  <motion.button
                    type="submit"
                    disabled={contactStatus === 'loading'}
                    whileHover={{ scale: contactStatus === 'loading' ? 1 : 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-forest-900 text-white font-bold text-sm shadow-[0_8px_20px_rgba(20,40,30,0.12)] hover:bg-forest-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {contactStatus === 'loading' ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        {contactModal.type === 'partner' ? 'Submit Partnership Request' : 'Send Message'}
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
