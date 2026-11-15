import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  theme?: 'patient' | 'doctor';
  autoFocus?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  theme = 'patient',
  autoFocus = true,
}: OtpInputProps) {
  const activeBorderColor = theme === 'patient' ? '#048256' : '#5C85D9';
  const activeBgColor = theme === 'patient' ? '#F0FDF4' : '#EFF6FF';

  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array(length).fill('');
    for (let i = 0; i < Math.min(value.length, length); i++) {
      arr[i] = value[i];
    }
    return arr;
  });

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const arr = Array(length).fill('');
    for (let i = 0; i < Math.min(value.length, length); i++) {
      arr[i] = value[i];
    }
    setDigits(arr);
  }, [value, length]);

  const handleChangeText = (text: string, index: number) => {
    // Handle paste of whole code
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < clean.length && index + i < length; i++) {
        newDigits[index + i] = clean[i];
      }
      setDigits(newDigits);
      onChange(newDigits.join(''));
      const nextFocus = Math.min(index + clean.length, length - 1);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const char = clean.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    onChange(newDigits.join(''));

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
      }
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => {
        const isFocused = focusedIndex === index;
        const hasValue = Boolean(digits[index]);

        return (
          <View
            key={index}
            style={[
              styles.box,
              isFocused && { borderColor: activeBorderColor, borderWidth: 2, backgroundColor: activeBgColor },
              !isFocused && hasValue && { borderColor: '#9CA3AF' },
            ]}
          >
            <TextInput
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.input}
              value={digits[index]}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              keyboardType="number-pad"
              maxLength={index === 0 ? length : 1}
              selectTextOnFocus
              autoFocus={autoFocus && index === 0}
              textAlign="center"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 20,
  },
  box: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    width: '100%',
    height: '100%',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
  },
});

