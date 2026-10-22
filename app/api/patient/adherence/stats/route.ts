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

        const adherenceRecords = prescription_id
            ? await sql`
                SELECT *, CASE WHEN is_taken THEN 'taken' WHEN is_skipped THEN 'skipped' ELSE 'pending' END as status
                FROM medication_adherence
                WHERE pid = ${pid} AND prescription_id = ${prescription_id}
                ORDER BY scheduled_date ASC
            `
            : await sql`
                SELECT *, CASE WHEN is_taken THEN 'taken' WHEN is_skipped THEN 'skipped' ELSE 'pending' END as status
                FROM medication_adherence
                WHERE pid = ${pid}
                ORDER BY scheduled_date ASC
            `;

        if (!adherenceRecords || adherenceRecords.length === 0) {
            return NextResponse.json({
                success: true,
                stats: { overallPercentage: 0, totalDoses: 0, takenDoses: 0, skippedDoses: 0, pendingDoses: 0, breakdown: [] }
            });
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = now.toTimeString().split(' ')[0];

        const isPending = (r: any) => !r.is_taken && !r.is_skipped;
        
        const totalDoses = adherenceRecords.length;
        const totalTaken = adherenceRecords.filter(r => r.is_taken).length;
        const totalSkipped = adherenceRecords.filter(r => r.is_skipped).length;
        
        const totalNotTaken = adherenceRecords.filter(r => {
            if (!isPending(r)) return false;
            let dateStr = r.scheduled_date;
            if (typeof r.scheduled_date === 'object') dateStr = r.scheduled_date.toISOString().split('T')[0];
            else if (typeof r.scheduled_date === 'string') dateStr = r.scheduled_date.split('T')[0];
            return dateStr < todayStr || (dateStr === todayStr && r.scheduled_time <= timeStr);
        }).length;

        const overallPercentage = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

        const todayRecords = adherenceRecords.filter(r => {
            let dateStr = r.scheduled_date;
            if (typeof r.scheduled_date === 'object') dateStr = r.scheduled_date.toISOString().split('T')[0];
            else if (typeof r.scheduled_date === 'string') dateStr = r.scheduled_date.split('T')[0];
            return dateStr === todayStr;
        });
        
        const todayScheduled = todayRecords.length;
        const todayTaken = todayRecords.filter(r => r.is_taken).length;
        const todaySkipped = todayRecords.filter(r => r.is_skipped).length;
        const todayNotTaken = todayRecords.filter(r => isPending(r) && r.scheduled_time <= timeStr).length;
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
            
            let dateStr = record.scheduled_date;
            if (typeof record.scheduled_date === 'object') dateStr = record.scheduled_date.toISOString().split('T')[0];
            else if (typeof record.scheduled_date === 'string') dateStr = record.scheduled_date.split('T')[0];

            if (isPending(record) && (dateStr < todayStr || (dateStr === todayStr && record.scheduled_time <= timeStr))) {
                med.notTaken++;
            }
            
            const date = record.scheduled_date;
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
            .slice(0, 3);
            
        const upcomingActivity = adherenceRecords
            .filter(r => isPending(r) && (new Date(r.scheduled_date).toISOString().split('T')[0] > todayStr || (new Date(r.scheduled_date).toISOString().split('T')[0] === todayStr && r.scheduled_time > timeStr)))
            .sort((a, b) => {
                const dateA = new Date(a.scheduled_date).toISOString().split('T')[0];
                const dateB = new Date(b.scheduled_date).toISOString().split('T')[0];
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return a.scheduled_time.localeCompare(b.scheduled_time);
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
