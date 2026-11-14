import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Receipt, Wallet } from 'lucide-react-native';
import { fetchWithAuth } from '../../lib/fetchWithAuth';
import { useAuthToken } from '../../hooks/stubs';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
  success: '#059669',
  successLight: '#ECFDF5',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

interface Transaction {
  id: string;
  direction: 'credit' | 'debit';
  category: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  doctor: { did: string; name: string | null } | null;
}

interface Summary {
  walletBalance: number;
  lifetimeCredited: number;
  lifetimeDebited: number;
}

interface Pagination {
  page: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  refund: 'Refund',
  payout: 'Payout',
  payout_fee: 'Payout fee',
  adjustment: 'Adjustment',
};

function formatCurrency(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TransactionsScreen() {
  const token = useAuthToken();
  const isFetchingRef = useRef(false);

  const [summary, setSummary] = useState<Summary>({
    walletBalance: 0,
    lifetimeCredited: 0,
    lifetimeDebited: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [direction, setDirection] = useState<'all' | 'credit' | 'debit'>('all');
  const [category, setCategory] = useState<'all' | 'consultation' | 'refund'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageToLoad = 1, replace = true, silent = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (!silent) {
        if (replace) setLoading(true);
        else setLoadingMore(true);
      }
      setError(null);

      try {
        const resolvedToken = typeof token === 'function' ? await token() : token;
        if (!resolvedToken) return;

        const params = new URLSearchParams();
        if (direction !== 'all') params.set('direction', direction);
        if (category !== 'all') params.set('category', category);
        params.set('page', String(pageToLoad));
        params.set('limit', '25');

        const response = await fetchWithAuth(
          `/api/patient/transactions?${params.toString()}`,
          resolvedToken,
        );
        let data: any = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          if (response.status === 404) {
            // Backend endpoint not deployed yet; render empty transactions safely
            data = {
              summary: { walletBalance: 0, lifetimeCredited: 0, lifetimeDebited: 0 },
              transactions: [],
              pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
            };
          } else {
            throw new Error(data?.error || 'Failed to load transactions');
          }
        }

        setSummary({
          walletBalance: Number(data.summary?.walletBalance ?? 0),
          lifetimeCredited: Number(data.summary?.lifetimeCredited ?? 0),
          lifetimeDebited: Number(data.summary?.lifetimeDebited ?? 0),
        });
        setTransactions((previous) =>
          replace ? data.transactions || [] : [...previous, ...(data.transactions || [])]
        );
        setPagination(data.pagination);
      } catch (err) {
        if (!silent) setError((err as Error).message || 'Failed to load transactions');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token, direction, category]
  );

  useFocusEffect(
    useCallback(() => {
      void load(1, true, true);
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load(1, true, true);
  };

  const changeDirection = (value: 'all' | 'credit' | 'debit') => {
    setDirection(value);
    setLoading(true);
  };

  const changeCategory = (value: 'all' | 'consultation' | 'refund') => {
    setCategory(value);
    setLoading(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Transactions',
          headerTitle: 'Transactions',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: FONTS.bold,
            color: COLORS.text,
          },
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <Wallet size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.summaryLabel}>Wallet balance</Text>
          </View>
          <Text style={styles.summaryAmount}>{formatCurrency(summary.walletBalance)}</Text>
          <Text style={styles.summaryHint}>Refund credits available on your account.</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={styles.metricLabel}>Credited</Text>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>
                +{formatCurrency(summary.lifetimeCredited)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}>
              <Text style={styles.metricLabel}>Paid</Text>
              <Text style={styles.metricValue}>{formatCurrency(summary.lifetimeDebited)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.chipRow}>
            {(['all', 'credit', 'debit'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => changeDirection(value)}
                style={[styles.chip, direction === value && styles.chipActive]}
              >
                <Text style={[styles.chipText, direction === value && styles.chipTextActive]}>
                  {value === 'all' ? 'All' : value === 'credit' ? 'Credits' : 'Debits'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Category</Text>
          <View style={styles.chipRow}>
            {(['all', 'consultation', 'refund'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => changeCategory(value)}
                style={[styles.chip, category === value && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === value && styles.chipTextActive]}>
                  {value === 'all' ? 'All' : value === 'consultation' ? 'Consultations' : 'Refunds'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load(1, true)}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt size={30} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              Consultation payments and refunds will appear here.
            </Text>
          </View>
        ) : (
          <>
            {transactions.map((transaction) => {
              const isCredit = transaction.direction === 'credit';
              return (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View
                    style={[
                      styles.transactionIcon,
                      { backgroundColor: isCredit ? COLORS.successLight : COLORS.primaryLight },
                    ]}
                  >
                    {isCredit ? (
                      <ArrowDownLeft size={18} color={COLORS.success} />
                    ) : (
                      <ArrowUpRight size={18} color={COLORS.primary} />
                    )}
                  </View>

                  <View style={styles.transactionBody}>
                    <View style={styles.transactionTop}>
                      <Text style={styles.transactionTitle} numberOfLines={1}>
                        {transaction.description ||
                          CATEGORY_LABELS[transaction.category] ||
                          'Transaction'}
                      </Text>
                      <Text
                        style={[
                          styles.transactionAmount,
                          { color: isCredit ? COLORS.success : COLORS.text },
                        ]}
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </View>
                    <View style={styles.transactionMeta}>
                      <Text style={styles.transactionMetaText}>
                        {CATEGORY_LABELS[transaction.category] || transaction.category}
                      </Text>
                      {transaction.doctor?.name ? (
                        <Text style={styles.transactionMetaText}>
                          Dr. {transaction.doctor.name}
                        </Text>
                      ) : null}
                      <Text style={styles.transactionMetaText}>
                        {formatDate(transaction.createdAt)}
                      </Text>
                      {transaction.status !== 'completed' ? (
                        <Text style={styles.transactionStatus}>{transaction.status}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} transactions
              </Text>
              {pagination.hasMore ? (
                <TouchableOpacity
                  style={styles.loadMore}
                  disabled={loadingMore}
                  onPress={() => load(pagination.page + 1, false)}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryAmount: {
    marginTop: 10,
    fontSize: 30,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  summaryRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetric: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 12,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  filterGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.white,
    fontFamily: FONTS.semiBold,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.danger,
  },
  retryText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  transactionCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: 14,
    marginBottom: 10,
  },
  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionBody: {
    flex: 1,
    minWidth: 0,
  },
  transactionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  transactionTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  transactionAmount: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  transactionMeta: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transactionMetaText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  transactionStatus: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: '#B45309',
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  loadMore: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  loadMoreText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
});
