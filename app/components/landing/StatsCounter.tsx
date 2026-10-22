'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { STATS } from '@/app/components/landing/constants';

export default function StatsCounter() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 relative overflow-hidden bg-sage-50/50 border-t border-sage-100">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-sage-200/40 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm border border-sage-200/60 mb-4 text-forest-600 group-hover:scale-110 smooth-transition">
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="text-4xl md:text-5xl font-display text-forest-900 font-bold mb-1 tracking-tight flex items-center justify-center">
                <CounterTrigger value={stat.value} trigger={isInView} />
                <span className="text-forest-500 ml-0.5">{stat.suffix}</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-forest-600/70">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CounterTrigger({ value, trigger }: { value: number; trigger: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const end = value;
    if (start === end) return;

    // Fast counters vs slow counters
    const duration = 1.5; // seconds
    const totalFrames = 60 * duration;
    let frame = 0;

    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      // Ease out quad
      const current = Math.floor(end * (1 - (1 - progress) * (1 - progress)));
      
      if (frame >= totalFrames) {
        setCount(end);
        clearInterval(counter);
      } else {
        setCount(current);
      }
    }, 1000 / 60);

    return () => clearInterval(counter);
  }, [value, trigger]);

  // Handle float values like 4.9 rating
  if (value % 1 !== 0) {
    return <span>{trigger ? value.toFixed(1) : '0.0'}</span>;
  }

  return <span>{count.toLocaleString()}</span>;
}
