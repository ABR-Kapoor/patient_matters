import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// GET - Fetch adherence records for patient
export async function GET(request: NextRequest) {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const pid = auth.data.pid;
        const prescription_id = request.nextUrl.searchParams.get('prescription_id');

        let finalData: any[];

        if (prescription_id) {
            finalData = await sql`
                SELECT ma.adherence_id, ma.prescription_id, ma.pid, ma.medicine_name,
                  ma.scheduled_date::text as scheduled_date,
                  ma.scheduled_time,
                  ma.is_taken, ma.is_skipped, ma.skip_reason,
                  ma.taken_at, ma.skipped_at,
                  ma.reminder_snoozed_until, ma.snooze_until, ma.snooze_count,
                  CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                  p.did, p.medicines as prescription_medicines, u.name as doctor_name
                FROM medication_adherence ma
                JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                LEFT JOIN doctors d ON p.did = d.did
                LEFT JOIN users u ON d.uid = u.uid
                WHERE ma.pid = ${pid} AND ma.prescription_id = ${prescription_id}
                ORDER BY ma.scheduled_date ASC, ma.scheduled_time ASC
            `;
        } else {
            finalData = await sql`
                SELECT ma.adherence_id, ma.prescription_id, ma.pid, ma.medicine_name,
                  ma.scheduled_date::text as scheduled_date,
                  ma.scheduled_time,
                  ma.is_taken, ma.is_skipped, ma.skip_reason,
                  ma.taken_at, ma.skipped_at,
                  ma.reminder_snoozed_until, ma.snooze_until, ma.snooze_count,
                  CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                  p.did, p.medicines as prescription_medicines, u.name as doctor_name
                FROM medication_adherence ma
                JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                LEFT JOIN doctors d ON p.did = d.did
                LEFT JOIN users u ON d.uid = u.uid
                WHERE ma.pid = ${pid}
                ORDER BY ma.scheduled_date ASC, ma.scheduled_time ASC
            `;
        }

        // Transform data to include flat details
        finalData = finalData.map((record: any) => {
            const doctorName = record.doctor_name || 'Unknown Doctor';

            let medicineDetails: any = {};
            if (record.prescription_medicines) {
                const meds = Array.isArray(record.prescription_medicines) ? record.prescription_medicines : [];
                const medInfo = meds.find((m: any) => m.name === record.medicine_name);
                if (medInfo) {
                    medicineDetails = {
                        dosage: medInfo.dosage,
                        frequency: medInfo.frequency,
                        notes: medInfo.notes
                    };
                }
            }

            const { prescription_medicines: _unused, ...rest } = record;
            return {
                ...rest,
                doctorName,
                ...medicineDetails
            };
        });

        // Frequency -> time slots (mirrors DB trigger + doctor_view send route)
        const parseFrequencyTimes = (frequency: string): string[] => {
            const f = (frequency || '').toLowerCase().trim();
            if (f.includes('twice') || f.includes('2 times') || f.includes('two times') ||
                (f.includes('morning') && f.includes('night')) || (f.includes('morning') && f.includes('evening'))) {
                return ['09:00:00', '21:00:00'];
            }
            if (f.includes('thrice') || f.includes('3 times') || f.includes('three times') ||
                (f.includes('morning') && f.includes('afternoon') && f.includes('night')) ||
                (f.includes('morning') && f.includes('afternoon') && f.includes('evening'))) {
                return ['09:00:00', '14:00:00', '21:00:00'];
            }
            if (f.includes('4 times') || f.includes('four times')) return ['08:00:00', '12:00:00', '16:00:00', '20:00:00'];
            if (f.includes('bedtime') || (f.includes('night') && !f.includes('morning'))) return ['22:00:00'];
            if (f.includes('afternoon') || f.includes('lunch')) return ['14:00:00'];
            if (f.includes('morning') || f.includes('breakfast')) return ['08:00:00'];
            return ['09:00:00'];
        };

        const parseDurationDays = (duration: string): number => {
            const d = (duration || '').toLowerCase().trim();
            const num = parseInt(d) || 0;
            if (d.includes('month')) return (num || 1) * 30;
            if (d.includes('week')) return (num || 1) * 7;
            if (d.includes('day')) return num || 7;
            return num > 0 ? num : 7;
        };

        // SELF-HEALING: Per-prescription check — generate records for any sent prescription missing them
        if (pid) {
            const prescriptions = await sql`
                SELECT * FROM prescriptions
                WHERE pid = ${pid} AND sent_to_patient = true
            `;

            const existingKeys = new Set(
                finalData.map((r: any) => `${r.prescription_id}::${r.medicine_name}`)
            );

            const now2 = new Date();
            const healingRows: Array<{
                pid: string;
                prescription_id: string;
                medicine_name: string;
                scheduled_date: string;
                scheduled_time: string;
            }> = [];

            for (const p of prescriptions) {
                if (!p.medicines) continue;
                const rxId = p.prescription_id;
                if (!rxId) continue;
                
                let list: any[] = [];
                try {
                    list = Array.isArray(p.medicines) ? p.medicines : JSON.parse(p.medicines as any);
                } catch { continue; }

                for (const med of list) {
                    if (!med.name) continue;
                    const key = `${rxId}::${med.name}`;
                    if (existingKeys.has(key)) continue;

                    const times = parseFrequencyTimes(med.frequency || '');
                    const days = parseDurationDays(med.duration || '');

                    for (let i = 0; i < days; i++) {
                        const d = new Date(now2);
                        d.setDate(d.getDate() + i);
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                        for (const time of times) {
                            healingRows.push({
                                pid: pid as string,
                                prescription_id: rxId,
                                medicine_name: med.name,
                                scheduled_date: dateStr,
                                scheduled_time: time,
                            });
                        }
                    }
                }
            }

            const healingDone = healingRows.length > 0;
            if (healingDone) {
                await sql`
                    INSERT INTO medication_adherence (pid, prescription_id, medicine_name, scheduled_date, scheduled_time)
                    VALUES ${sql(healingRows, 'pid', 'prescription_id', 'medicine_name', 'scheduled_date', 'scheduled_time')}
                    ON CONFLICT (prescription_id, medicine_name, scheduled_date, scheduled_time) DO NOTHING
                `;

                finalData = await sql`
                    SELECT ma.adherence_id, ma.prescription_id, ma.pid, ma.medicine_name,
                      ma.scheduled_date::text as scheduled_date,
                      ma.scheduled_time,
                      ma.is_taken, ma.is_skipped, ma.skip_reason,
                      ma.taken_at, ma.skipped_at,
                      ma.reminder_snoozed_until, ma.snooze_until, ma.snooze_count,
                      CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                      p.did, p.medicines as prescription_medicines, u.name as doctor_name
                    FROM medication_adherence ma
                    JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                    LEFT JOIN doctors d ON p.did = d.did
                    LEFT JOIN users u ON d.uid = u.uid
                    WHERE ma.pid = ${pid}
                    ORDER BY ma.scheduled_date ASC, ma.scheduled_time ASC
                `;

                finalData = finalData.map((record: any) => {
                    const meds = Array.isArray(record.prescription_medicines) ? record.prescription_medicines : [];
                    const medInfo = meds.find((m: any) => m.name === record.medicine_name);
                    const { prescription_medicines: _unused, ...rest } = record;
                    return {
                        ...rest,
                        doctorName: record.doctor_name || 'Unknown Doctor',
                        ...(medInfo ? { dosage: medInfo.dosage, frequency: medInfo.frequency, notes: medInfo.notes } : {})
                    };
                });
            }
        }

        const now = new Date();
        const clientDate = request.nextUrl.searchParams.get('client_date');
        const clientTime = request.nextUrl.searchParams.get('client_time');

        // Use client local wall-clock date if provided, otherwise derive from current time
        const todayKey = clientDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentTime = clientTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const oneHourFromNowTime = `${oneHourFromNow.getHours().toString().padStart(2, '0')}:${oneHourFromNow.getMinutes().toString().padStart(2, '0')}:00`;

        const getDateStr = (val: any): string => {
            if (!val) return '';
            if (val instanceof Date) {
                return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
            }
            return String(val).split('T')[0];
        };

        const isPending = (d: any) => !d.is_taken && !d.is_skipped;

        // A dose is actively snoozed if a snooze timestamp exists and is in the future
        const isSnoozed = (d: any): boolean => {
            if (!isPending(d)) return false;
            const snoozedUntil = d.reminder_snoozed_until || d.snooze_until;
            if (!snoozedUntil) return false;
            const snoozeMs = new Date(snoozedUntil).getTime();
            return !isNaN(snoozeMs) && snoozeMs > now.getTime();
        };

        // Annotate each record with snooze flag
        finalData = finalData.map((d: any) => {
            const snoozed = isSnoozed(d);
            const snoozedUntil = d.reminder_snoozed_until || d.snooze_until;
            return {
                ...d,
                is_snoozed: snoozed,
                snoozed_until: snoozed ? snoozedUntil : null
            };
        });

        // Actively snoozed doses
        const snoozed = finalData.filter((d: any) => d.is_snoozed);

        // Pending: today's doses up to 1 hr from now, NOT completed and NOT actively snoozed
        const pending = finalData.filter((d: any) => {
            if (!isPending(d) || d.is_snoozed) return false;
            return getDateStr(d.scheduled_date) === todayKey && d.scheduled_time <= oneHourFromNowTime;
        });

        // Due now: doses due in the current window (now to now + 1 hour)
        const dueNow = finalData.filter((d: any) => {
            if (!isPending(d) || d.is_snoozed) return false;
            if (getDateStr(d.scheduled_date) !== todayKey) return false;
            return d.scheduled_time <= oneHourFromNowTime && d.scheduled_time >= currentTime;
        });

        // Overdue: scheduled date/time has passed, NOT completed, NOT actively snoozed
        const overdue = finalData.filter((d: any) => {
            if (!isPending(d) || d.is_snoozed) return false;
            const ds = getDateStr(d.scheduled_date);
            if (ds < todayKey) return true;
            if (ds === todayKey && d.scheduled_time < currentTime) return true;
            return false;
        });

        const taken = finalData.filter((d: any) => d.is_taken);
        const skipped = finalData.filter((d: any) => d.is_skipped);

        // Doses completed today (taken or skipped today)
        const completedToday = finalData.filter((d: any) => {
            if (d.is_taken) {
                const dateTaken = d.taken_at ? getDateStr(d.taken_at) : getDateStr(d.scheduled_date);
                return dateTaken === todayKey;
            }
            if (d.is_skipped) {
                const dateSkipped = d.skipped_at ? getDateStr(d.skipped_at) : getDateStr(d.scheduled_date);
                return dateSkipped === todayKey;
            }
            return false;
        });

        const upcoming = finalData.filter((d: any) => {
            if (!isPending(d) || d.is_snoozed) return false;
            const ds = getDateStr(d.scheduled_date);
            if (ds > todayKey) return true;
            if (ds === todayKey && d.scheduled_time > oneHourFromNowTime) return true;
            return false;
        });

        const elapsed = finalData.filter((d: any) => 
            !isPending(d) || 
            getDateStr(d.scheduled_date) < todayKey || 
            (getDateStr(d.scheduled_date) === todayKey && d.scheduled_time <= currentTime)
        );

        const todayDoses = finalData.filter((d: any) => getDateStr(d.scheduled_date) === todayKey);
        const todayTaken = completedToday.filter((d: any) => d.is_taken).length;
        const todaySkipped = completedToday.filter((d: any) => d.is_skipped).length;
        const todayScheduled = Math.max(todayDoses.length, todayTaken + todaySkipped);

        return NextResponse.json({
            success: true,
            adherence: {
                all: finalData,
                pending,
                dueNow,
                overdue,
                snoozed,
                taken,
                skipped,
                completedToday,
                upcoming,
                stats: {
                    total: finalData.length,
                    elapsedTotal: elapsed.length,
                    taken: taken.length,
                    skipped: skipped.length,
                    pending: pending.length,
                    overdue: overdue.length,
                    snoozed: snoozed.length,
                    todayScheduled,
                    todayTaken,
                    todaySkipped,
                    todayRemaining: Math.max(0, todayScheduled - todayTaken - todaySkipped),
                    adherenceRate: elapsed.length ? ((taken.length / elapsed.length) * 100).toFixed(1) : "0.0"
                },
                currentTime: currentTime,
                todayDate: todayKey
            }
        });
    } catch (error: any) {
        console.error('[API] Adherence fetch error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH - Update adherence record (mark taken/skipped/pending)
export async function PATCH(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const pid = auth.data.pid;

    try {
        const body = await request.json();
        const { adherenceId, status, notes } = body;
        const adherence_id = adherenceId || body.adherence_id;

        if (!adherence_id) {
            return NextResponse.json(
                { success: false, error: 'Adherence ID required' },
                { status: 400 }
            );
        }

        if (!['taken', 'skipped', 'pending'].includes(status)) {
            return NextResponse.json(
                { success: false, error: 'Invalid adherence status' },
                { status: 400 }
            );
        }

        // Ownership check
        const [owned] = await sql`
            SELECT adherence_id FROM medication_adherence
            WHERE adherence_id = ${adherence_id} AND pid = ${pid}
            LIMIT 1
        `;

        if (!owned) {
            return NextResponse.json(
                { success: false, error: 'Adherence record not found' },
                { status: 404 }
            );
        }

        let data;

        if (status === 'taken') {
            [data] = await sql`
                UPDATE medication_adherence
                SET is_taken = true, 
                    is_skipped = false,
                    status = 'taken',
                    taken_at = CURRENT_TIMESTAMP, 
                    reminder_snoozed_until = NULL,
                    snooze_until = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING adherence_id, pid, medicine_name, scheduled_date::text as scheduled_date, scheduled_time,
                          is_taken, is_skipped, status, taken_at, skipped_at, reminder_snoozed_until, updated_at
            `;
        } else if (status === 'skipped') {
            [data] = await sql`
                UPDATE medication_adherence
                SET is_taken = false, 
                    is_skipped = true,
                    status = 'skipped',
                    skip_reason = ${notes || null}, 
                    skipped_at = CURRENT_TIMESTAMP, 
                    reminder_snoozed_until = NULL,
                    snooze_until = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING adherence_id, pid, medicine_name, scheduled_date::text as scheduled_date, scheduled_time,
                          is_taken, is_skipped, status, taken_at, skipped_at, skip_reason, reminder_snoozed_until, updated_at
            `;
        } else if (status === 'pending') {
            [data] = await sql`
                UPDATE medication_adherence
                SET is_taken = false, 
                    is_skipped = false,
                    status = 'pending',
                    taken_at = NULL, 
                    skipped_at = NULL, 
                    skip_reason = NULL,
                    reminder_snoozed_until = NULL,
                    snooze_until = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING adherence_id, pid, medicine_name, scheduled_date::text as scheduled_date, scheduled_time,
                          is_taken, is_skipped, status, taken_at, skipped_at, reminder_snoozed_until, updated_at
            `;
        }

        // Refresh materialized view so stats API returns fresh data
        try {
            await sql`REFRESH MATERIALIZED VIEW adherence_progress_summary`;
            console.log('[API] Refreshed adherence_progress_summary');
        } catch (err) {
            console.error('[API] Failed to refresh materialized view:', err);
        }

        console.log(`[API] Adherence ${adherence_id} marked as ${status}`);

        return NextResponse.json({
            success: true,
            adherence: data,
            message: `Adherence updated to ${status} successfully`
        });
    } catch (error: any) {
        console.error('[API] Adherence update error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
