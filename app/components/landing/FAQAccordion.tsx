'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { FAQS } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-sage-50/20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sage-200/25 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
            <TranslatedText>COMMON INQUIRIES</TranslatedText>
          </span>
          <TranslatedText
            as="h1"
            className="headline-lg text-forest-900 mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Frequently Answered Questions
          </TranslatedText>
          <p className="body-md text-forest-600/70">
            <TranslatedText>Have questions about bookings, platform fees, or AI matching? Find quick answers here.</TranslatedText>
          </p>
        </div>

        {/* Accordion Stack */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className="bg-white rounded-2xl border border-sage-100/80 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-sage-50/20 smooth-transition"
                >
                  <span className="text-base font-bold text-forest-900 leading-snug pr-4">
                    <TranslatedText>{faq.q}</TranslatedText>
                  </span>
                  <div className="w-8 h-8 rounded-full bg-sage-50 flex items-center justify-center text-forest-600 shrink-0">
                    {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-3 pt-1 border-t border-sage-50 text-sm text-forest-600/70 leading-relaxed font-semibold">
                        <TranslatedText>{faq.a}</TranslatedText>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
