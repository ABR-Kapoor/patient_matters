import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export type AuthBadgeType = 'lock' | 'key' | 'shield' | 'user' | 'login';

interface AuthBadgeProps {
  type: AuthBadgeType;
  theme?: 'patient' | 'doctor';
  size?: number;
}

export function AuthBadge({ type, theme = 'patient', size = 100 }: AuthBadgeProps) {
  const isPatient = theme === 'patient';

  let imageSource;
  if (type === 'lock') {
    imageSource = isPatient
      ? require('../../assets/images/3d_lock_green.png')
      : require('../../assets/images/3d_lock_blue.png');
  } else if (type === 'key') {
    imageSource = isPatient
      ? require('../../assets/images/3d_key_green.png')
      : require('../../assets/images/3d_key_blue.png');
  } else if (type === 'shield') {
    imageSource = isPatient
      ? require('../../assets/images/3d_shield_green.png')
      : require('../../assets/images/3d_shield_blue.png');
  } else {
    // user or login
    imageSource = isPatient
      ? require('../../assets/images/3d_user_green.png')
      : require('../../assets/images/3d_user_blue.png');
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={imageSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
});
