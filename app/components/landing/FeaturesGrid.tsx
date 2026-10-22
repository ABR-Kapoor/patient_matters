'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FEATURES } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function FeaturesGrid() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 90, damping: 14 }
    }
  };

  return (
    <section className="py-24 bg-sage-50/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[450px] h-[450px] bg-sage-200/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
            <TranslatedText>ADVANCED CAPABILITIES</TranslatedText>
          </span>
          <TranslatedText
            as="h1"
            className="headline-lg text-forest-900 mb-4 max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Why AuraSutra Stands Out
          </TranslatedText>
          <p className="body-md text-forest-600/70 max-w-lg mx-auto">
            <TranslatedText>We analyzed patient pain points across global and local competitors to build a truly frictionless booking experience.</TranslatedText>
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {FEATURES.map((feat) => (
            <motion.div
              key={feat.title}
              variants={cardVariants}
              whileHover={{ 
                y: -6, 
                boxShadow: 'var(--shadow-lg)',
                borderColor: 'var(--sage-300)'
              }}
              className="bg-white rounded-2xl p-7 border border-sage-100/80 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center mb-6 text-forest-600 group-hover:scale-110 smooth-transition">
                  <feat.icon className="w-6 h-6" />
                </div>

                <p className="text-[10px] font-black tracking-widest text-forest-500 uppercase block mb-2">{feat.badge}</p>
                <h3 className="text-xl font-bold text-forest-900 mb-2 leading-snug group-hover:text-forest-600 smooth-transition">
                  <TranslatedText>{feat.title}</TranslatedText>
                </h3>
                <p className="text-sm text-forest-600/70 leading-relaxed font-medium">
                  <TranslatedText>{feat.body}</TranslatedText>
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-sage-50 flex items-center text-xs font-bold text-forest-500 uppercase tracking-wider">
                <p>Active Feature</p>
                <div className="w-1.5 h-1.5 rounded-full bg-forest-500 animate-pulse ml-2" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
