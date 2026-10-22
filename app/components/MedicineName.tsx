'use client';

import { useState, useEffect } from 'react';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';

const TRANSLITERATE_LOCALES = ['hi', 'mr', 'ne', 'bn', 'te', 'ta', 'gu'];

interface MedicineNameProps {
  name: string;
  currentLocale: string;
}

export function MedicineName({ name, currentLocale }: MedicineNameProps) {
  const { transliterateName } = useNameTransliteration();
  const [transliterated, setTransliterated] = useState('');

  useEffect(() => {
    if (TRANSLITERATE_LOCALES.includes(currentLocale) && name) {
      transliterateName(name).then(setTransliterated);
    } else {
      setTransliterated('');
    }
  }, [name, currentLocale, transliterateName]);

  return (
    <span>
      {name}
      {transliterated && (
        <span className="ml-1 devanagari-small" lang={currentLocale}>({transliterated})</span>
      )}
    </span>
  );
}
