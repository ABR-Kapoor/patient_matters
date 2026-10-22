import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
  danger: '#EF4444',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface AppDatePickerModalProps {
  visible: boolean;
  value?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

export function AppDatePickerModal({
  visible,
  value,
  minimumDate,
  maximumDate,
  title = 'Select Date',
  onClose,
  onSelect,
}: AppDatePickerModalProps) {
  const initial = value && !isNaN(value.getTime()) ? value : new Date();
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(initial);

  // Sync when reopened or value changes
  React.useEffect(() => {
    if (visible) {
      const v = value && !isNaN(value.getTime()) ? value : new Date();
      setSelectedDate(v);
      setCurrentYear(v.getFullYear());
      setCurrentMonth(v.getMonth());
    }
  }, [visible, value]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const next = new Date(currentYear, currentMonth, day, 12, 0, 0);
    setSelectedDate(next);
  };

  const handleConfirm = () => {
    onSelect(selectedDate);
    onClose();
  };

  // Build grid: prefix empty slots + day cells
  const daySlots: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    daySlots.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daySlots.push(d);
  }

  const isSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getDate() === day
    );
  };

  const isDisabled = (day: number) => {
    const target = new Date(currentYear, currentMonth, day, 23, 59, 59);
    if (minimumDate && target.getTime() < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()).getTime()) {
      return true;
    }
    if (maximumDate && new Date(currentYear, currentMonth, day, 0, 0, 0).getTime() > maximumDate.getTime()) {
      return true;
    }
    return false;
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

          {/* Month & Year Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
              <ChevronLeft size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.monthYearText}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
              <ChevronRight size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekdaysRow}>
            {WEEKDAY_NAMES.map((name, i) => (
              <Text key={i} style={styles.weekdayText}>
                {name}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.grid}>
            {daySlots.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }
              const selected = isSelected(day);
              const disabled = isDisabled(day);

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={styles.dayCell}
                  disabled={disabled}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayCellInner,
                      selected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action buttons */}
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
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  navArrow: {
    padding: 6,
  },
  monthYearText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.gray,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.285%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  dayTextDisabled: {
    color: COLORS.gray,
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
