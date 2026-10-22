import React from 'react';
import { StyleSheet, TextProps } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, SIZES } from '../constants/theme';

interface MarkdownTextProps extends Omit<TextProps, 'children'> {
  children: string;
}

export function MarkdownText({ children, style, ...props }: MarkdownTextProps) {
  return (
    <Markdown
      style={{
        body: StyleSheet.flatten([styles.body, style]),
        strong: styles.strong,
        em: styles.em,
        heading1: styles.heading,
        heading2: styles.heading,
        heading3: styles.heading,
        heading4: styles.heading,
        heading5: styles.heading,
        heading6: styles.heading,
        paragraph: styles.paragraph,
        // Letting the package handle lists out of the box so numbers appear correctly
      }}
    >
      {children}
    </Markdown>
  );
}

const styles = StyleSheet.create({
  body: {
    color: COLORS.text,
    fontFamily: FONTS.regular,
    fontSize: SIZES.font,
    lineHeight: 22,
  },
  strong: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  heading: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 0,
  },
});
