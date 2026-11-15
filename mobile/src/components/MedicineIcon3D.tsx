import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface MedicineIcon3DProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function MedicineIcon3D({ size = 24, style }: MedicineIcon3DProps) {
  return (
    <Image
      source={require('../../assets/images/3d_pill.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}

export default MedicineIcon3D;

