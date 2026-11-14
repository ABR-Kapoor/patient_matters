'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Receipt,
  Wallet,
} from 'lucide-react';

interface Transaction {
  id: string;
  direction: 'credit' | 'debit';
  category: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  appointmentId: string | null;
  createdAt: string;
  doctor: { did: string; name: string | null } | null;
}

interface Summary {
  walletBalance: number;
  lifetimeCredited: number;
  lifetimeDebited: number;
  lastTransactionAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const categoryLabels: Record<string, string> = {
  consultation: 'Consultation',
  refund: 'Refund',
  payout: 'Payout',
  payout_fee: 'Payout fee',
  adjustment: 'Adjustment',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TransactionsPage() {
  const [summary, setSummary] = useState<Summary>({
    walletBalance: 0,
    lifetimeCredited: 0,
    lifetimeDebited: 0,
    lastTransactionAt: null,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [direction, setDirection] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (direction) params.set('direction', direction);
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(page));
    params.set('limit', '25');
    return params.toString();
  }, [direction, category, status, from, to, page]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/patient/transactions?${queryString}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load transactions');
        }
        setSummary(data.summary);
        setTransactions(data.transactions || []);
        setPagination(data.pagination);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [queryString]);

  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-forest-900">Transactions</h1>
        <p className="text-sm text-forest-500 mt-1">
          Consultation payments and refunds credited to your wallet.
        </p>
      </div>

      <div className="rounded-2xl border border-sage-200 bg-white p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forest-400">
              Wallet balance
            </p>
            <p className="mt-1 text-3xl font-bold text-forest-900">
              {currencyFormatter.format(summary.walletBalance)}
            </p>
            <p className="mt-1 text-xs text-forest-500">
              Refund credits available on your account.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-forest-400">
                Credited
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-600">
                +{currencyFormatter.format(summary.lifetimeCredited)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-forest-400">
                Paid
              </p>
              <p className="mt-1 text-sm font-semibold text-forest-700">
                {currencyFormatter.format(summary.lifetimeDebited)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sage-200 bg-white p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-forest-600">
            Type
            <select
              value={direction}
              onChange={(event) => resetPage(setDirection)(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-forest-800"
            >
              <option value="">All</option>
              <option value="credit">Credits</option>
              <option value="debit">Debits</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-forest-600">
            Category
            <select
              value={category}
              onChange={(event) => resetPage(setCategory)(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-forest-800"
            >
              <option value="">All</option>
              <option value="consultation">Consultations</option>
              <option value="refund">Refunds</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-forest-600">
            Status
            <select
              value={status}
              onChange={(event) => resetPage(setStatus)(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-forest-800"
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-forest-600">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => resetPage(setFrom)(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-forest-800"
            />
          </label>
          <label className="text-xs font-semibold text-forest-600">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => resetPage(setTo)(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm text-forest-800"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDirection('');
                setCategory('');
                setStatus('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className="w-full rounded-xl border border-sage-200 px-3 py-2 text-sm font-semibold text-forest-700 hover:bg-sage-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading && transactions.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 rounded-2xl bg-sage-100/70 animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl border border-sage-200 bg-white p-10 text-center">
          <Receipt className="w-8 h-8 mx-auto text-forest-400" />
          <p className="mt-3 text-sm font-semibold text-forest-800">No transactions yet</p>
          <p className="mt-1 text-xs text-forest-500">
            Consultation payments and refunds will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => {
            const isCredit = transaction.direction === 'credit';
            return (
              <div
                key={transaction.id}
                className="rounded-2xl border border-sage-200 bg-white p-4 flex items-start gap-3"
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-sage-100 text-forest-600'
                  }`}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-forest-900 flex-1 truncate">
                      {transaction.description || categoryLabels[transaction.category] || 'Transaction'}
                    </p>
                    <p
                      className={`text-sm font-bold shrink-0 ${
                        isCredit ? 'text-emerald-600' : 'text-forest-800'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {currencyFormatter.format(transaction.amount)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-forest-500">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      {categoryLabels[transaction.category] || transaction.category}
                    </span>
                    {transaction.doctor?.name && (
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Dr. {transaction.doctor.name}
                      </span>
                    )}
                    <span>{formatDate(transaction.createdAt)}</span>
                    {transaction.status !== 'completed' && (
                      <span className="uppercase tracking-wide text-[10px] font-semibold text-amber-600">
                        {transaction.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-forest-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1.5 text-xs font-semibold text-forest-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={!pagination.hasMore}
                onClick={() => setPage((value) => value + 1)}
                className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1.5 text-xs font-semibold text-forest-700 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
