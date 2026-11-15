import type { Sql, TransactionSql } from 'postgres';
import sql from '@/lib/db';

type WalletDb = Sql | TransactionSql;

export type WalletDirection = 'credit' | 'debit';
export type WalletCategory = 'consultation' | 'refund' | 'payout' | 'payout_fee' | 'adjustment';
export type WalletStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface WalletEntryInput {
    did?: string | null;
    pid?: string | null;
    aid?: string | null;
    direction: WalletDirection;
    category: WalletCategory;
    status?: WalletStatus;
    amount: number;
    currency?: string;
    description?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    financeTransactionId?: string | null;
    payoutRequestId?: string | null;
    metadata?: Record<string, unknown>;
}

export interface WalletTransactionRow {
    wallet_transaction_id: string;
    did: string | null;
    pid: string | null;
    aid: string | null;
    direction: WalletDirection;
    category: WalletCategory;
    status: WalletStatus;
    amount: string;
    currency: string;
    description: string | null;
    reference_type: string | null;
    reference_id: string | null;
    created_at: string;
}

/**
 * Appends one immutable ledger row. The unique index on
 * (reference_type, reference_id, category, direction) makes this safe to retry,
 * so payment callbacks and refund triggers cannot double-credit a wallet.
 */
export async function recordWalletTransaction(
    db: WalletDb,
    entry: WalletEntryInput,
): Promise<WalletTransactionRow | null> {
    if (!entry.did && !entry.pid) return null;

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const query = db as Sql;
    const [row] = await query`
        INSERT INTO wallet_transactions (
            did, pid, aid, direction, category, status, amount, currency,
            description, reference_type, reference_id,
            finance_transaction_id, payout_request_id, metadata
        )
        VALUES (
            ${entry.did ?? null}, ${entry.pid ?? null}, ${entry.aid ?? null},
            ${entry.direction}, ${entry.category}, ${entry.status ?? 'completed'},
            ${amount}, ${entry.currency ?? 'INR'}, ${entry.description ?? null},
            ${entry.referenceType ?? null}, ${entry.referenceId ?? null},
            ${entry.financeTransactionId ?? null}, ${entry.payoutRequestId ?? null},
            ${JSON.stringify(entry.metadata ?? {})}
        )
        ON CONFLICT DO NOTHING
        RETURNING *
    `;

    return (row as WalletTransactionRow | undefined) ?? null;
}

/** Records both sides of a paid consultation: doctor earns, patient pays. */
export async function recordConsultationWalletEntries(
    db: WalletDb,
    input: {
        aid: string;
        did: string;
        pid: string;
        transactionId: string;
        doctorNetAmount: number;
        totalPayable: number;
        currency?: string;
    },
): Promise<void> {
    await recordWalletTransaction(db, {
        did: input.did,
        pid: input.pid,
        aid: input.aid,
        direction: 'credit',
        category: 'consultation',
        amount: input.doctorNetAmount,
        currency: input.currency,
        description: 'Consultation earnings',
        referenceType: 'finance_transaction',
        referenceId: input.transactionId,
        financeTransactionId: input.transactionId,
    });

    await recordWalletTransaction(db, {
        did: input.did,
        pid: input.pid,
        aid: input.aid,
        direction: 'debit',
        category: 'consultation',
        amount: input.totalPayable,
        currency: input.currency,
        description: 'Consultation payment',
        referenceType: 'finance_transaction',
        referenceId: input.transactionId,
        financeTransactionId: input.transactionId,
    });
}

export interface PatientWalletSummary {
    walletBalance: number;
    lifetimeCredited: number;
    lifetimeDebited: number;
    lastTransactionAt: string | null;
}

export async function getPatientWalletSummary(pid: string): Promise<PatientWalletSummary> {
    const [row] = await sql`
        SELECT wallet_balance, lifetime_credited, lifetime_debited, last_transaction_at
        FROM v_patient_wallet_summary
        WHERE pid = ${pid}
        LIMIT 1
    `;

    return {
        walletBalance: Number(row?.wallet_balance ?? 0),
        lifetimeCredited: Number(row?.lifetime_credited ?? 0),
        lifetimeDebited: Number(row?.lifetime_debited ?? 0),
        lastTransactionAt: row?.last_transaction_at ?? null,
    };
}
