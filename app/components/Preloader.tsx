'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/app/hooks/useTranslation';

const panels = [0, 1, 2, 3, 4];

const panelTransition = {
  duration: 0.9,
  ease: [0.65, 0, 0.35, 1], // Premium brand-style cubic-bezier
};

export default function Preloader() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const { text: portalLabel } = useTranslation('Patient Portal');

  useEffect(() => {
    setMounted(true);
    // Artificial 1s delay for cinematic reveal (snappier feel)
    const timer = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="preloader-container"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {/* Vertical Sliding Panels */}
          {panels.map((i) => (
            <motion.div
              key={i}
              initial={{ y: 0 }}
              exit={{ y: i % 2 === 0 ? '-100%' : '100%' }}
              transition={{ ...panelTransition, delay: 0.2 + i * 0.1 }}
              style={{
                flex: 1,
                background: i % 2 === 0 ? '#fff' : '#f8fafc', // Subtle alternating whites
                height: '100vh',
                borderRight: '1px solid rgba(0,0,0,0.03)',
                pointerEvents: 'auto',
              }}
            />
          ))}

          {/* Central Logo & Brand Reveal */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.8 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '32px',
                zIndex: 1,
              }}
            >
              {/* spinning Logo Ring */}
              <div style={{ position: 'relative' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 120, height: 120,
                    border: '1px solid rgba(76, 175, 80, 0.1)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                  }}
                />
                <motion.img
                  src="/favicon.ico"
                  alt="AuraSutra"
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%) translateX(4px)',
                    width: 64, height: 64,
                    objectFit: 'contain',
                  }}
                />
              </div>

              {/* Official Brand Text Logo */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: -10,
                }}
              >
                <img
                  src="/AuraSutra-BlackTextOnly-Transparent.png"
                  alt="AuraSutra Text"
                  style={{
                    height: 32,
                    width: 'auto',
                    objectFit: 'contain',
                    transform: 'translateX(2px)', // Visual centering adjustment
                  }}
                />
                
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--outline)', 
                  letterSpacing: '5px', 
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  opacity: 0.7
                }}>
                  {portalLabel}
                </div>
              </motion.div>

            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
