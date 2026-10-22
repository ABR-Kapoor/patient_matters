'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowRight, ArrowLeft } from 'lucide-react';
import { TESTIMONIALS } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function TestimonialsCarousel() {
  const [index, setIndex] = useState(0);

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const handlePrev = () => {
    setIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const current = TESTIMONIALS[index];

  return (
    <section className="py-24 bg-sage-50/10 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-sage-200/30 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
            <TranslatedText>PATIENT VERDICTS</TranslatedText>
          </span>
          <TranslatedText
            as="h1"
            className="headline-lg text-forest-900 mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Stories of Restored Vitality
          </TranslatedText>
        </div>

        {/* Carousel Card */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-sage-100 shadow-sm relative min-h-[300px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                const swipeThreshold = 55;
                if (info.offset.x < -swipeThreshold) {
                  handleNext();
                } else if (info.offset.x > swipeThreshold) {
                  handlePrev();
                }
              }}
              className="flex flex-col gap-6 cursor-grab active:cursor-grabbing w-full"
            >
              {/* Ratings */}
              <div className="flex gap-1 text-amber-500">
                {Array.from({ length: current.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 shrink-0" />
                ))}
              </div>

              {/* Text */}
              <blockquote className="text-xl md:text-2xl font-medium text-forest-900 leading-relaxed italic" style={{ fontFamily: 'var(--font-display)' }}>
                "<TranslatedText>{current.text}</TranslatedText>"
              </blockquote>

              {/* User Bio */}
              <div className="flex items-center gap-4 mt-4">
                <img 
                  src={current.img} 
                  alt={current.name} 
                  className="w-12 h-12 rounded-full object-cover border border-sage-200/80 shrink-0" 
                />
                <div>
                  <h4 className="text-sm font-bold text-forest-900">{current.name}</h4>
                  <p className="text-xs text-forest-500 font-medium">
                    <TranslatedText>{current.role}</TranslatedText>
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-sage-100">
            {/* Dots */}
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    index === idx ? 'w-6 bg-forest-600' : 'w-2 bg-sage-200 hover:bg-sage-300'
                  }`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-2">
              <button 
                onClick={handlePrev}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-sage-200 text-forest-600 hover:bg-sage-50 smooth-transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNext}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-sage-200 text-forest-600 hover:bg-sage-50 smooth-transition"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
