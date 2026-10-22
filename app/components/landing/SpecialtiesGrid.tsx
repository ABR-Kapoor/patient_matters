'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { SPECIALTIES } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function SpecialtiesGrid() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section id="specialties" className="py-24 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sage-50 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
            <TranslatedText>OUR SPECIALTIES</TranslatedText>
          </span>
          <TranslatedText
            as="h1"
            className="headline-lg text-forest-900 mb-4 max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Holistic Care Across All Medical Dimensions
          </TranslatedText>
          <p className="body-md text-forest-600/70 max-w-lg mx-auto">
            <TranslatedText>We bridge traditional wisdom with modern medical tracking for complete body-mind sync.</TranslatedText>
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        >
          {SPECIALTIES.map((spec) => (
            <motion.div
              key={spec.label}
              variants={itemVariants}
              whileHover={{ 
                y: -6,
                scale: 1.02,
                boxShadow: '0 20px 40px rgba(10,46,26,0.15)'
              }}
              className="relative rounded-[24px] overflow-hidden border border-sage-200/50 group cursor-pointer flex flex-col justify-between min-h-[280px]"
            >
              {/* Background Image with Parallax Scale */}
              <div className="absolute inset-0 z-0">
                <img 
                  src={spec.image} 
                  alt={spec.label}
                  className="w-full h-full object-cover group-hover:scale-110 smooth-transition duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 pointer-events-none" />
              </div>

              {/* Foreground Content */}
              <div className="relative z-10 p-5 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 transition-transform group-hover:rotate-6 shadow-sm"
                    style={{ color: '#fff' }}
                  >
                    <spec.icon className="w-5 h-5 drop-shadow-md" />
                  </div>
                  <div className="flex items-center gap-1.5 bg-forest-900/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-white tracking-wider">{spec.count} Available</span>
                  </div>
                </div>
                
                <div className="mt-auto pt-6 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <h3 className="text-[18px] font-black text-white mb-1.5 tracking-wide drop-shadow-lg">
                    <TranslatedText>{spec.label}</TranslatedText>
                  </h3>
                  <p className="text-[13px] text-white/95 leading-relaxed font-bold line-clamp-2 drop-shadow-md">
                    <TranslatedText>{spec.desc}</TranslatedText>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
