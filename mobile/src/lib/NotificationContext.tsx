import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react-native';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
}

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface AlertModalState extends AlertOptions {
  visible: boolean;
}

interface NotificationContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
  showAlert: (title: string, message?: string, buttons?: AlertButton[], type?: AlertOptions['type']) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string, isDestructive?: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Global dispatcher ref so modules outside React components (e.g. lib/pdfGenerator.ts) can show alerts
export let globalShowToast: ((title: string, message?: string, type?: ToastType, duration?: number) => void) | null = null;
export let globalShowAlert: ((title: string, message?: string, buttons?: AlertButton[], type?: AlertOptions['type']) => void) | null = null;
export let globalShowConfirm: ((title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string, isDestructive?: boolean) => void) | null = null;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [alertState, setAlertState] = useState<AlertModalState>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    type: 'info',
  });

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[], type: AlertOptions['type'] = 'info') => {
    let inferredType = type;
    const lower = title.toLowerCase();
    if (lower.includes('error') || lower.includes('fail')) inferredType = 'error';
    else if (lower.includes('success') || lower.includes('complete') || lower.includes('downloaded') || lower.includes('thank')) inferredType = 'success';
    else if (lower.includes('warn') || lower.includes('require')) inferredType = 'warning';

    const finalButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' as const }];
    setAlertState({
      visible: true,
      title,
      message,
      buttons: finalButtons,
      type: inferredType,
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      type: isDestructive ? 'error' : 'confirm',
      buttons: [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, style: isDestructive ? 'destructive' : 'default', onPress: onConfirm },
      ],
    });
  }, []);

  // Bind to global exports
  globalShowToast = showToast;
  globalShowAlert = showAlert;
  globalShowConfirm = showConfirm;

  const handleButtonPress = (btn?: AlertButton) => {
    setAlertState((prev) => ({ ...prev, visible: false }));
    if (btn && btn.onPress) {
      setTimeout(() => btn.onPress!(), 50);
    }
  };

  const getAlertIcon = () => {
    switch (alertState.type) {
      case 'success':
        return (
          <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
            <CheckCircle2 size={24} color={COLORS.primary} />
          </View>
        );
      case 'error':
        return (
          <View style={[styles.iconCircle, { backgroundColor: COLORS.dangerLight }]}>
            <XCircle size={24} color={COLORS.danger} />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconCircle, { backgroundColor: COLORS.warningLight }]}>
            <AlertTriangle size={24} color={COLORS.warning} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
            <Info size={24} color={COLORS.primary} />
          </View>
        );
    }
  };

  return (
    <NotificationContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}

      {/* Floating Pill Toasts at Top */}
      <SafeAreaView edges={['top']} style={styles.toastSafeArea} pointerEvents="box-none">
        <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <View key={toast.id} style={styles.toastCard}>
            <View style={styles.toastIconCol}>
              {toast.type === 'success' && <CheckCircle2 size={18} color={COLORS.primary} />}
              {toast.type === 'error' && <XCircle size={18} color={COLORS.danger} />}
              {toast.type === 'warning' && <AlertTriangle size={18} color={COLORS.warning} />}
              {toast.type === 'info' && <Info size={18} color={COLORS.info} />}
            </View>
            <View style={styles.toastContentCol}>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              {toast.message ? <Text style={styles.toastMessage}>{toast.message}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              style={styles.toastCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        ))}
        </View>
      </SafeAreaView>

      {/* Top-Anchored Alert / Confirmation / Error Modal */}
      <Modal
        visible={alertState.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top']} style={styles.topModalSafeArea}>
            <View style={styles.topModalCard}>
              {/* Header row with Icon, Title and Close Button */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerTitleRow}>
                {getAlertIcon()}
                <Text style={styles.sheetTitle} numberOfLines={2}>{alertState.title}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAlertState((prev) => ({ ...prev, visible: false }))}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Message Body */}
            {alertState.message ? (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetMessage}>{alertState.message}</Text>
              </View>
            ) : null}

            {/* Actions Row */}
            <View style={styles.actionsRow}>
              {alertState.buttons?.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.actionButton,
                      isCancel && styles.actionButtonCancel,
                      isDestructive && styles.actionButtonDestructive,
                      !isCancel && !isDestructive && styles.actionButtonPrimary,
                    ]}
                    onPress={() => handleButtonPress(btn)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        isCancel && styles.actionButtonTextCancel,
                        isDestructive && styles.actionButtonTextDestructive,
                        !isCancel && !isDestructive && styles.actionButtonTextPrimary,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  // Toast Styles (Clean pill style matching appointment cards)
  toastSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  toastContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  toastIconCol: {
    marginRight: 10,
  },
  toastContentCol: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  toastMessage: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: 2,
    lineHeight: 16,
  },
  toastCloseBtn: {
    marginLeft: 8,
    padding: 4,
  },

  // Top-Anchored Alert & Confirmation Modal Structure
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-start',
  },
  topModalSafeArea: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  topModalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  sheetMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionButtonCancel: {
    backgroundColor: COLORS.background,
  },
  actionButtonDestructive: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  actionButtonTextCancel: {
    color: COLORS.text,
  },
  actionButtonTextDestructive: {
    color: '#FFFFFF',
  },
});
