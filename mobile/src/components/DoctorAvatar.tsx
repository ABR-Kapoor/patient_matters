import React, { useState } from 'react';
import { View, Text, Image, ImageStyle, StyleProp, StyleSheet } from 'react-native';

interface DoctorAvatarProps {
  // Real profile image from database or cloud storage
  uri?: string | null;
  seed?: string | null;
  style?: StyleProp<ImageStyle>;
}

function getInitials(seed?: string | null): string {
  if (!seed) return 'Dr';
  const clean = seed.replace(/^Dr\.?\s+/i, '').trim();
  if (!clean) return 'Dr';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function DoctorAvatar({ uri, seed, style }: DoctorAvatarProps) {
  const [failed, setFailed] = useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showFallback = !uri || failed;

  if (!showFallback && uri) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={style}
        resizeMode="cover"
        accessibilityLabel="Doctor profile photo"
      />
    );
  }

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const width = (flattenedStyle.width as number) || 48;
  const height = (flattenedStyle.height as number) || 48;
  const borderRadius = (flattenedStyle.borderRadius as number) || width / 2;
  const fontSize = Math.max(12, Math.round(width * 0.38));
  const initials = getInitials(seed);

  return (
    <View
      style={[
        style,
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E6F4EA',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#A7F3D0',
        },
      ]}
      accessibilityLabel="Doctor avatar"
    >
      <Text
        style={{
          color: '#048256',
          fontFamily: 'DMSans_700Bold',
          fontSize,
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}