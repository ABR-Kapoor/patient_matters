import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const pid = auth.data.pid;
        const prescription_id = request.nextUrl.searchParams.get('prescription_id');
        const clientDate = request.nextUrl.searchParams.get('client_date');
        const clientTime = request.nextUrl.searchParams.get('client_time');

        const adherenceRecords = prescription_id
            ? await sql`
                SELECT adherence_id, prescription_id, pid, medicine_name,
                       scheduled_date::text as scheduled_date, scheduled_time,
                       is_taken, is_skipped, taken_at, skipped_at, reminder_snoozed_until, snooze_until,
                       CASE WHEN is_taken THEN 'taken' WHEN is_skipped THEN 'skipped' ELSE 'pending' END as status
                FROM medication_adherence
                WHERE pid = ${pid} AND prescription_id = ${prescription_id}
                ORDER BY scheduled_date ASC, scheduled_time ASC
            `
            : await sql`
                SELECT adherence_id, prescription_id, pid, medicine_name,
                       scheduled_date::text as scheduled_date, scheduled_time,
                       is_taken, is_skipped, taken_at, skipped_at, reminder_snoozed_until, snooze_until,
                       CASE WHEN is_taken THEN 'taken' WHEN is_skipped THEN 'skipped' ELSE 'pending' END as status
                FROM medication_adherence
                WHERE pid = ${pid}
                ORDER BY scheduled_date ASC, scheduled_time ASC
            `;

        if (!adherenceRecords || adherenceRecords.length === 0) {
            return NextResponse.json({
                success: true,
                stats: { overallPercentage: 0, totalDoses: 0, takenDoses: 0, skippedDoses: 0, pendingDoses: 0, breakdown: [] }
            });
        }

        const now = new Date();
        const todayStr = clientDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = clientTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

        const getDateStr = (val: any): string => {
            if (!val) return '';
            if (val instanceof Date) {
                return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
            }
            return String(val).split('T')[0];
        };

        const isPending = (r: any) => !r.is_taken && !r.is_skipped;
        
        const totalDoses = adherenceRecords.length;
        const totalTaken = adherenceRecords.filter(r => r.is_taken).length;
        const totalSkipped = adherenceRecords.filter(r => r.is_skipped).length;
        
        const totalNotTaken = adherenceRecords.filter(r => {
            if (!isPending(r)) return false;
            const dateStr = getDateStr(r.scheduled_date);
            return dateStr < todayStr || (dateStr === todayStr && r.scheduled_time <= timeStr);
        }).length;

        const overallPercentage = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

        // Doses scheduled for today
        const todayScheduledDoses = adherenceRecords.filter(r => getDateStr(r.scheduled_date) === todayStr);

        // Doses taken today: either scheduled for today, or acted upon today
        const todayTaken = adherenceRecords.filter(r => {
            if (!r.is_taken) return false;
            const actionDate = r.taken_at ? getDateStr(r.taken_at) : getDateStr(r.scheduled_date);
            return actionDate === todayStr;
        }).length;

        // Doses skipped today: either scheduled for today, or acted upon today
        const todaySkipped = adherenceRecords.filter(r => {
            if (!r.is_skipped) return false;
            const actionDate = r.skipped_at ? getDateStr(r.skipped_at) : getDateStr(r.scheduled_date);
            return actionDate === todayStr;
        }).length;

        const todayNotTaken = todayScheduledDoses.filter(r => isPending(r) && r.scheduled_time <= timeStr).length;
        const todayScheduled = Math.max(todayScheduledDoses.length, todayTaken + todaySkipped);
        const dailyPercentage = todayScheduled > 0 ? Math.round((todayTaken / todayScheduled) * 100) : 0;

        const medicineMap = new Map();
        const dailyMap = new Map();
        
        adherenceRecords.forEach(record => {
            const name = record.medicine_name;
            if (!medicineMap.has(name)) medicineMap.set(name, { medicineName: name, total: 0, taken: 0, skipped: 0, notTaken: 0 });
            const med = medicineMap.get(name);
            med.total++;
            if (record.is_taken) med.taken++;
            else if (record.is_skipped) med.skipped++;
            
            const dateStr = getDateStr(record.scheduled_date);

            if (isPending(record) && (dateStr < todayStr || (dateStr === todayStr && record.scheduled_time <= timeStr))) {
                med.notTaken++;
            }
            
            const date = dateStr;
            if (!dailyMap.has(date)) dailyMap.set(date, { date, taken: 0, skipped: 0, pending: 0, notTaken: 0 });
            const day = dailyMap.get(date);
            if (record.is_taken) day.taken++;
            else if (record.is_skipped) day.skipped++;
            else if (isPending(record) && (dateStr < todayStr || (dateStr === todayStr && record.scheduled_time <= timeStr))) {
                day.notTaken++;
            } else day.pending++;
        });

        const medicineBreakdown = Array.from(medicineMap.values()).map(m => ({
            ...m,
            percentage: m.total > 0 ? ((m.taken / m.total) * 100).toFixed(1) : "0.0"
        }));
        
        const recentActivity = adherenceRecords
            .filter(r => r.is_taken || r.is_skipped)
            .sort((a, b) => new Date(b.taken_at || b.updated_at || 0).getTime() - new Date(a.taken_at || a.updated_at || 0).getTime())
            .slice(0, 5);
            
        const upcomingActivity = adherenceRecords
            .filter(r => isPending(r) && (getDateStr(r.scheduled_date) > todayStr || (getDateStr(r.scheduled_date) === todayStr && r.scheduled_time > timeStr)))
            .sort((a, b) => {
                const dateA = getDateStr(a.scheduled_date);
                const dateB = getDateStr(b.scheduled_date);
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return String(a.scheduled_time).localeCompare(String(b.scheduled_time));
            })
            .slice(0, 5);

        return NextResponse.json({
            success: true,
            stats: {
                overallPercentage,
                dailyPercentage,
                totalDoses,
                totalTaken,
                totalSkipped,
                totalNotTaken,
                todayScheduled,
                todayTaken,
                todaySkipped,
                todayNotTaken,
                breakdown: medicineBreakdown,
                dailyBreakdown: Array.from(dailyMap.values()),
                recentActivity,
                upcomingActivity
            }
        });

    } catch (error) {
        console.error('Error in adherence stats API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
