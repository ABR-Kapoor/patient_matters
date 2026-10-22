import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface MedicineNameProps {
  name: string;
  currentLocale?: string;
}

export const MedicineName: React.FC<MedicineNameProps> = ({ name }) => {
  return <Text style={styles.text}>{name}</Text>;
};

const styles = StyleSheet.create({
  text: {
    fontWeight: 'bold',
  }
});
