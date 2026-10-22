import React from 'react';
import { CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';

interface PaymentStatusBadgeProps {
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentId?: string;
}

export default function PaymentStatusBadge({ status, paymentId }: PaymentStatusBadgeProps) {
  const statusConfig = {
    completed: {
      icon: CheckCircle2,
      text: 'Paid',
      className: 'bg-sage-100 text-forest-700 border-sage-300',
      iconColor: 'text-forest-600',
    },
    pending: {
      icon: Clock,
      text: 'Payment Pending',
      className: 'bg-[var(--status-warn)]/10 text-[var(--status-warn)] border-[var(--status-warn)]/30',
      iconColor: 'text-[var(--status-warn)]',
    },
    failed: {
      icon: XCircle,
      text: 'Payment Failed',
      className: 'bg-[var(--error-container)] text-[var(--status-error)] border-[var(--status-error)]/30',
      iconColor: 'text-[var(--status-error)]',
    },
    refunded: {
      icon: RefreshCw,
      text: 'Refunded',
      className: 'bg-sage-100 text-forest-600 border-sage-200',
      iconColor: 'text-forest-500',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border-2 text-sm font-medium ${config.className}`}>
      <Icon className={`w-4 h-4 ${config.iconColor}`} />
      <span><TranslatedText>{config.text}</TranslatedText></span>
      {paymentId && (
        <span className="text-xs opacity-70 ml-1">
          (ID: {paymentId.slice(-8)})
        </span>
      )}
    </div>
  );
}
