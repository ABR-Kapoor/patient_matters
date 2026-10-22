import React from 'react';
import { TranslatedText } from '@/app/components/TranslatedText';

interface NameTextProps {
  name?: string | null;
  fallback: string;
}

/**
 * Component for displaying proper nouns (names) that should NOT be translated.
 * If the name is missing, displays a translatable fallback text.
 */
export function NameText({ name, fallback }: NameTextProps) {
  if (name && name.trim()) {
    // Display the actual name without translation
    return <>{name}</>;
  }
  
  // Display translatable fallback if name is missing
  return <TranslatedText>{fallback}</TranslatedText>;
}
