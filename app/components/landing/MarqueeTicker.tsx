'use client';

import React from 'react';
import { MARQUEE_ITEMS } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';
import { Sparkles } from 'lucide-react';

export default function MarqueeTicker() {
  return (
    <div className="py-6 bg-sage-100/60 backdrop-blur-sm border-y border-sage-200/70 overflow-hidden relative select-none z-15">
      <div className="flex w-[200%] gap-12 animate-marquee">
        {/* Double it for smooth looping */}
        {MARQUEE_ITEMS.concat(MARQUEE_ITEMS).map((item, idx) => (
          <div 
            key={item + idx} 
            className="flex items-center gap-2 text-forest-700/85 font-extrabold tracking-widest uppercase text-[10px] shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-forest-500/70" />
            <span><TranslatedText>{item}</TranslatedText></span>
          </div>
        ))}
      </div>
    </div>
  );
}
