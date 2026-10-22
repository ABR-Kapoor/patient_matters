import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { formatDate } from '@/lib/formatDate';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const pid = auth.data.pid;

        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Get upcoming appointments
        const appointments = await sql`
            SELECT * FROM appointments
            WHERE pid = ${pid}
              AND status IN ('scheduled', 'confirmed')
              AND scheduled_date >= ${today}
            ORDER BY scheduled_date ASC
        `;

        // Get active prescriptions.
        // Must mirror the filter in /api/patient/prescriptions exactly. A
        // prescription the doctor has not explicitly sent is a draft and is
        // deliberately invisible to the patient, so counting it here made the
        // "Active Prescriptions" badge disagree with the list it links to.
        const prescriptions = await sql`
            SELECT * FROM prescriptions
            WHERE pid = ${pid} AND is_active = true AND sent_to_patient = true
        `;

        // Get medication adherence data (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const adherenceRecords = await sql`
            SELECT *, CASE WHEN is_taken THEN 'taken' WHEN is_skipped THEN 'skipped' ELSE 'pending' END as status
            FROM medication_adherence
            WHERE pid = ${pid}
              AND scheduled_date >= ${sevenDaysAgo.toISOString().split('T')[0]}
            ORDER BY scheduled_date ASC, scheduled_time ASC
        `;

        // Process adherence data for charts
        const adherenceByDay: { [key: string]: { taken: number; skipped: number } } = {};
        const adherenceByMedicine: Record<string, { taken: number; total: number }> = {};
        
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        adherenceRecords.forEach(record => {
            const date = formatDate(record.scheduled_date);
            if (!adherenceByDay[date]) {
                adherenceByDay[date] = { taken: 0, skipped: 0 };
            }

            if (record.is_taken) {
                adherenceByDay[date].taken++;
            } else if (record.is_skipped) {
                adherenceByDay[date].skipped++;
            }

            // Only count elapsed records for medicine breakdown
            const ds = typeof record.scheduled_date === 'string' 
                ? record.scheduled_date.split('T')[0] 
                : new Date(record.scheduled_date).toISOString().split('T')[0];
            const ts = record.scheduled_time;
            
            if (ds < todayStr || (ds === todayStr && ts <= timeStr) || record.is_taken || record.is_skipped) {
                const medicineName = record.medicine_name || 'Unknown';
                if (!adherenceByMedicine[medicineName]) {
                    adherenceByMedicine[medicineName] = { taken: 0, total: 0 };
                }
                adherenceByMedicine[medicineName].total++;
                if (record.is_taken) {
                    adherenceByMedicine[medicineName].taken++;
                }
            }
        });

        const adherenceData = Object.entries(adherenceByDay).map(([date, data]) => ({
            date,
            taken: data.taken,
            skipped: data.skipped,
        }));

        const medicineData = Object.entries(adherenceByMedicine)
            .map(([name, data]) => ({
                name,
                value: data.total > 0 ? Math.round((data.taken / data.total) * 100) : 0,
            }));

        const totalDoses = adherenceRecords.length;
        const takenDoses = adherenceRecords.filter((r) => r.is_taken).length;
        const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

        // Daily adherence rate
        const todayRecords = adherenceRecords.filter(r => {
            let dateStr = r.scheduled_date;
            if (typeof r.scheduled_date === 'object') dateStr = r.scheduled_date.toISOString().split('T')[0];
            else if (typeof r.scheduled_date === 'string') dateStr = r.scheduled_date.split('T')[0];
            return dateStr === todayStr;
        });
        const todayScheduled = todayRecords.length;
        const todayTaken = todayRecords.filter(r => r.is_taken).length;
        const dailyAdherenceRate = todayScheduled > 0 ? Math.round((todayTaken / todayScheduled) * 100) : 0;

        // Compute clinic-wide average adherence (all patients, absolute total)
        const [clinicStats] = await sql`
            SELECT
                COUNT(*) FILTER (WHERE is_taken = true) AS taken,
                COUNT(*) AS total
            FROM medication_adherence
        `;
        const clinicAverage = clinicStats && Number(clinicStats.total) > 0
            ? Math.round((Number(clinicStats.taken) / Number(clinicStats.total)) * 100)
            : 75;

        // Total appointments count
        const allAppointments = await sql`
            SELECT COUNT(*) AS cnt FROM appointments WHERE pid = ${pid}
        `;
        const totalAppointments = Number(allAppointments[0]?.cnt || 0);

        // Unread notifications count
        const [unreadNotificationsRow] = await sql`
            SELECT COUNT(*) AS cnt FROM notifications 
            WHERE uid = ${auth.data.uid} AND is_read = false
        `;
        const unreadNotifications = Number(unreadNotificationsRow?.cnt || 0);

        return NextResponse.json({
            success: true,
            pid,
            upcomingAppointments: appointments?.length || 0,
            activePrescriptions: prescriptions?.length || 0,
            totalAppointments,
            unreadNotifications,
            adherenceRate,
            dailyAdherenceRate,
            takenDoses,
            totalDoses,
            clinicAverage,
            adherenceTrend: adherenceData,
            medicineData,
        });
    } catch (error) {
        console.error('Dashboard API error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
