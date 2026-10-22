'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { COMPARISON } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function ComparisonTable() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-1/2 right-0 w-[350px] h-[350px] bg-sage-50 rounded-full blur-[80px] pointer-events-none translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
            <TranslatedText>COMPETITIVE PARITY</TranslatedText>
          </span>
          <TranslatedText
            as="h1"
            className="headline-lg text-forest-900 mb-4 max-w-xl mx-auto"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Parity Analysis vs. Industry Leaders
          </TranslatedText>
          <p className="body-md text-forest-600/70 max-w-lg mx-auto">
            <TranslatedText>We analyzed existing scheduling and patient-tracking platforms to offer a superior, integrated healing framework.</TranslatedText>
          </p>
        </div>

        {/* Table Container */}
        <div className="max-w-4xl mx-auto overflow-hidden rounded-2xl border border-sage-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage-50/50 border-b border-sage-200/80">
                  <th className="p-5 text-sm font-bold text-forest-900 uppercase tracking-wider">Features</th>
                  <th className="p-5 text-sm font-black text-forest-700 uppercase tracking-widest text-center bg-sage-100/30">AuraSutra</th>
                  <th className="p-5 text-sm font-bold text-forest-600/70 uppercase tracking-wider text-center">Practo</th>
                  <th className="p-5 text-sm font-bold text-forest-600/70 uppercase tracking-wider text-center">Zocdoc</th>
                  <th className="p-5 text-sm font-bold text-forest-600/70 uppercase tracking-wider text-center">noqueue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="hover:bg-sage-50/20 smooth-transition">
                    <td className="p-5 text-sm font-bold text-forest-900">
                      <TranslatedText>{row.feature}</TranslatedText>
                    </td>
                    <td className="p-5 text-center bg-sage-100/10">
                      <div className="flex justify-center">
                        <Check className="w-5 h-5 text-forest-500 font-extrabold" />
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {row.practo ? (
                          <Check className="w-4 h-4 text-forest-600/60" />
                        ) : (
                          <X className="w-4 h-4 text-forest-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {row.zocdoc ? (
                          <Check className="w-4 h-4 text-forest-600/60" />
                        ) : (
                          <X className="w-4 h-4 text-forest-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {row.noqueue ? (
                          <Check className="w-4 h-4 text-forest-600/60" />
                        ) : (
                          <X className="w-4 h-4 text-forest-300" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
