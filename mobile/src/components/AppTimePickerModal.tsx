import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

interface AppTimePickerModalProps {
  visible: boolean;
  value?: string; // e.g. "10:00 AM" or "14:30"
  title?: string;
  onClose: () => void;
  onSelect: (timeStr: string) => void;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ['00', '15', '30', '45'];

export function AppTimePickerModal({
  visible,
  value,
  title = 'Select Time',
  onClose,
  onSelect,
}: AppTimePickerModalProps) {
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  React.useEffect(() => {
    if (visible && value) {
      const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const p = match[3] ? match[3].toUpperCase() : h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        setSelectedHour(h);
        setSelectedMinute(MINUTES.includes(m) ? m : '00');
        setSelectedPeriod(p as 'AM' | 'PM');
      }
    }
  }, [visible, value]);

  const handleConfirm = () => {
    onSelect(`${selectedHour}:${selectedMinute} ${selectedPeriod}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Time Preview Box */}
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              {selectedHour}:{selectedMinute} <Text style={styles.previewPeriod}>{selectedPeriod}</Text>
            </Text>
          </View>

          {/* AM / PM Toggle */}
          <View style={styles.periodRow}>
            <TouchableOpacity
              style={[styles.periodBtn, selectedPeriod === 'AM' && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod('AM')}
            >
              <Text style={[styles.periodText, selectedPeriod === 'AM' && styles.periodTextActive]}>
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodBtn, selectedPeriod === 'PM' && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod('PM')}
            >
              <Text style={[styles.periodText, selectedPeriod === 'PM' && styles.periodTextActive]}>
                PM
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hours Picker */}
          <Text style={styles.sectionLabel}>Hour</Text>
          <View style={styles.grid}>
            {HOURS.map((hr) => {
              const active = hr === selectedHour;
              return (
                <TouchableOpacity
                  key={`hr-${hr}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedHour(hr)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{hr}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Minutes Picker */}
          <Text style={styles.sectionLabel}>Minute</Text>
          <View style={styles.grid}>
            {MINUTES.map((mn) => {
              const active = mn === selectedMinute;
              return (
                <TouchableOpacity
                  key={`mn-${mn}`}
                  style={[styles.chipMinute, active && styles.chipActive]}
                  onPress={() => setSelectedMinute(mn)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{mn}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Select</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  previewPeriod: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.gray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    width: '22%',
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMinute: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.gray,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});
