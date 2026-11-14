import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';
import { getPatientWalletSummary } from '@/lib/wallet';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DIRECTIONS = new Set(['credit', 'debit']);
const CATEGORIES = new Set(['consultation', 'refund', 'payout', 'payout_fee', 'adjustment']);
const STATUSES = new Set(['pending', 'completed', 'failed', 'reversed']);

function parseDate(value: string | null, endOfDay = false): Date | null {
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const { pid } = auth.data;
        const params = request.nextUrl.searchParams;

        const direction = params.get('direction')?.toLowerCase() || null;
        const category = params.get('category')?.toLowerCase() || null;
        const status = params.get('status')?.toLowerCase() || null;
        const from = parseDate(params.get('from'));
        const to = parseDate(params.get('to'), true);

        if (direction && !DIRECTIONS.has(direction)) {
            return NextResponse.json({ error: 'Invalid direction filter' }, { status: 400 });
        }
        if (category && !CATEGORIES.has(category)) {
            return NextResponse.json({ error: 'Invalid category filter' }, { status: 400 });
        }
        if (status && !STATUSES.has(status)) {
            return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
        }

        const page = Math.max(1, Number(params.get('page') || 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.get('limit') || 25) || 25));
        const offset = (page - 1) * limit;

        let where = sql`wt.pid = ${pid} AND wallet_owner_role(wt.category, wt.direction) = 'patient'`;
        if (direction) where = sql`${where} AND wt.direction = ${direction}`;
        if (category) where = sql`${where} AND wt.category = ${category}`;
        if (status) where = sql`${where} AND wt.status = ${status}`;
        if (from) where = sql`${where} AND wt.created_at >= ${from.toISOString()}`;
        if (to) where = sql`${where} AND wt.created_at <= ${to.toISOString()}`;

        const [summary, rows, countRows] = await Promise.all([
            getPatientWalletSummary(pid),
            sql`
                SELECT
                    wt.wallet_transaction_id,
                    wt.direction,
                    wt.category,
                    wt.status,
                    wt.amount,
                    wt.currency,
                    wt.description,
                    wt.aid,
                    wt.reference_type,
                    wt.reference_id,
                    wt.created_at,
                    wt.did,
                    u.name AS doctor_name,
                    a.scheduled_date,
                    a.scheduled_time
                FROM wallet_transactions wt
                LEFT JOIN doctors d ON d.did = wt.did
                LEFT JOIN users u ON u.uid = d.uid
                LEFT JOIN appointments a ON a.aid = wt.aid
                WHERE ${where}
                ORDER BY wt.created_at DESC, wt.wallet_transaction_id DESC
                LIMIT ${limit} OFFSET ${offset}
            `,
            sql`SELECT COUNT(*)::int AS count FROM wallet_transactions wt WHERE ${where}`,
        ]);

        const total = Number(countRows[0]?.count ?? 0);

        return NextResponse.json({
            success: true,
            summary,
            transactions: rows.map((row) => ({
                id: row.wallet_transaction_id,
                direction: row.direction,
                category: row.category,
                status: row.status,
                amount: Number(row.amount),
                currency: row.currency,
                description: row.description,
                appointmentId: row.aid,
                referenceType: row.reference_type,
                referenceId: row.reference_id,
                createdAt: row.created_at,
                doctor: row.did
                    ? {
                        did: row.did,
                        name: row.doctor_name ?? null,
                        specialization: null,
                    }
                    : null,
                appointment: row.aid
                    ? {
                        aid: row.aid,
                        scheduledDate: row.scheduled_date,
                        scheduledTime: row.scheduled_time,
                    }
                    : null,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasMore: offset + rows.length < total,
            },
        });
    } catch (error) {
        console.error('Patient transactions API error:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
