import React, { useSyncExternalStore } from 'react';
import { Text, type TextProps } from 'react-native';
import { useLanguage } from '../lib/LanguageContext';
import { getVersion, subscribe, t } from '../lib/i18n';

interface TranslatedTextProps extends TextProps {
  children: React.ReactNode;
  as?: any;
}

/**
 * Renders its English source text until a translation for the active locale
 * lands, then swaps to the translated string. Never throws and never renders
 * empty — if lingo.dev is unreachable the English text simply stays put.
 *
 * Children are resolved with React.Children.toArray first: a single string is
 * translated as-is, while interpolated children (`{taken}/{total} taken`) are
 * translated piecewise with non-string parts passed through untouched. The old
 * `String(children)` coerced an array into "taken,total taken" — mangled text
 * rendered even before any translation arrived.
 */
export const TranslatedText: React.FC<TranslatedTextProps> = ({ children, as: _as, ...props }) => {
  const { locale } = useLanguage();
  useSyncExternalStore(subscribe, getVersion, getVersion);

  const parts = React.Children.toArray(children).map((part) =>
    typeof part === 'string' ? t(part, locale) : part
  );

  return <Text {...props}>{parts}</Text>;
};
