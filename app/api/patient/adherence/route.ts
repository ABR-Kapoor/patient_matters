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
                SELECT ma.*, 
                  CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                  p.did, p.medicines as prescription_medicines, u.name as doctor_name
                FROM medication_adherence ma
                JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                LEFT JOIN doctors d ON p.did = d.did
                LEFT JOIN users u ON d.uid = u.uid
                WHERE ma.pid = ${pid} AND ma.prescription_id = ${prescription_id}
                ORDER BY ma.scheduled_date ASC
            `;
        } else {
            finalData = await sql`
                SELECT ma.*, 
                  CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                  p.did, p.medicines as prescription_medicines, u.name as doctor_name
                FROM medication_adherence ma
                JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                LEFT JOIN doctors d ON p.did = d.did
                LEFT JOIN users u ON d.uid = u.uid
                WHERE ma.pid = ${pid}
                ORDER BY ma.scheduled_date ASC
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

            return {
                ...record,
                doctorName,
                ...medicineDetails
            };
        });

        // Frequency → time slots (mirrors DB trigger + doctor_view send route)
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

            // Build per-medicine key set: "prescription_id::medicine_name"
            // DB returns snake_case: prescription_id, medicine_name
            const existingKeys = new Set(
                finalData.map((r: any) => `${r.prescription_id}::${r.medicine_name}`)
            );

            const now2 = new Date();
            // Collect every missing dose and insert them in ONE statement. The
            // old per-row awaited INSERTs serialized hundreds of round-trips for
            // a freshly-sent prescription and could blow the client's 15s timeout.
            const healingRows: Array<{
                pid: string;
                prescription_id: string;
                medicine_name: string;
                scheduled_date: string;
                scheduled_time: string;
            }> = [];

            for (const p of prescriptions) {
                if (!p.medicines) continue;
                // DB returns snake_case: p.prescription_id
                const rxId = p.prescription_id;
                if (!rxId) continue;
                
                let list: any[] = [];
                try {
                    list = Array.isArray(p.medicines) ? p.medicines : JSON.parse(p.medicines as any);
                } catch { continue; }

                for (const med of list) {
                    if (!med.name) continue;
                    const key = `${rxId}::${med.name}`;
                    if (existingKeys.has(key)) continue; // already has records

                    console.log(`[API] Self-healing: generating records for ${med.name} in rx ${rxId}`);
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
            }

            if (healingDone) {

                // Reload all records after generation
                finalData = await sql`
                    SELECT ma.*, 
                      CASE WHEN ma.is_taken THEN 'taken' WHEN ma.is_skipped THEN 'skipped' ELSE 'pending' END as status,
                      p.did, p.medicines as prescription_medicines, u.name as doctor_name
                    FROM medication_adherence ma
                    JOIN prescriptions p ON ma.prescription_id = p.prescription_id
                    LEFT JOIN doctors d ON p.did = d.did
                    LEFT JOIN users u ON d.uid = u.uid
                    WHERE ma.pid = ${pid}
                    ORDER BY ma.scheduled_date ASC
                `;
                // Re-transform after reload
                finalData = finalData.map((record: any) => {
                    const meds = Array.isArray(record.prescription_medicines) ? record.prescription_medicines : [];
                    const medInfo = meds.find((m: any) => m.name === record.medicine_name);
                    return {
                        ...record,
                        doctorName: record.doctor_name || 'Unknown Doctor',
                        ...(medInfo ? { dosage: medInfo.dosage, frequency: medInfo.frequency, notes: medInfo.notes } : {})
                    };
                });
            }
        }

        const now = new Date();
        // Use local wall-clock date (not UTC) to avoid timezone-shifted date mismatches
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const oneHourFromNowTime = `${oneHourFromNow.getHours().toString().padStart(2, '0')}:${oneHourFromNow.getMinutes().toString().padStart(2, '0')}:00`;

        // Normalize scheduledDate: postgres DATE columns can arrive as 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ssZ'
        const getDateStr = (val: any): string => {
            if (val instanceof Date) return val.toISOString().split('T')[0];
            return String(val).split('T')[0];
        };

        const pending = finalData.filter((d: any) => {
            if (getDateStr(d.scheduled_date) !== todayKey || d.status !== 'pending') return false;
            return d.scheduled_time <= oneHourFromNowTime;
        });

        const dueNow = finalData.filter((d: any) => {
            if (getDateStr(d.scheduled_date) !== todayKey || d.status !== 'pending') return false;
            const medicineTime = d.scheduled_time;
            return medicineTime <= oneHourFromNowTime && medicineTime >= currentTime;
        });

        const isPending = (d: any) => !d.is_taken && !d.is_skipped;

        const overdue = finalData.filter((d: any) => {
            if (!isPending(d)) return false;
            const ds = getDateStr(d.scheduled_date);
            if (ds < todayKey) return true;
            if (ds === todayKey && d.scheduled_time < currentTime) return true;
            return false;
        });

        const taken = finalData.filter((d: any) => d.is_taken);
        const skipped = finalData.filter((d: any) => d.is_skipped);
        const upcoming = finalData.filter((d: any) => {
            if (!isPending(d)) return false;
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

        return NextResponse.json({
            success: true,
            adherence: {
                all: finalData,
                pending,
                dueNow,
                overdue,
                taken,
                skipped,
                upcoming,
                stats: {
                    total: finalData.length,
                    elapsedTotal: elapsed.length,
                    taken: taken.length,
                    skipped: skipped.length,
                    pending: pending.length,
                    overdue: overdue.length,
                    adherenceRate: elapsed.length ? ((taken.length / elapsed.length) * 100).toFixed(1) : "0.0"
                },
                currentTime: currentTime
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

// PATCH - Update adherence record (mark taken/skipped)
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

        // Ownership check: an adherence_id is addressable by anyone who knows
        // it, so confirm the record belongs to the signed-in patient before
        // any write.
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
                    taken_at = CURRENT_TIMESTAMP, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING *
            `;
        } else if (status === 'skipped') {
            [data] = await sql`
                UPDATE medication_adherence
                SET is_taken = false, 
                    is_skipped = true,
                    skip_reason = ${notes || null}, 
                    skipped_at = CURRENT_TIMESTAMP, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING *
            `;
        } else if (status === 'pending') {
            [data] = await sql`
                UPDATE medication_adherence
                SET is_taken = false, 
                    is_skipped = false,
                    taken_at = NULL, 
                    skipped_at = NULL, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE adherence_id = ${adherence_id}
                RETURNING *
            `;
        }

        // Refresh materialized view so stats API returns fresh data
        try {
            await sql`REFRESH MATERIALIZED VIEW adherence_progress_summary`;
            console.log('[API] Refreshed adherence_progress_summary');
        } catch (err) {
            console.error('[API] Failed to refresh materialized view:', err);
        }

        console.log('[API] Adherence updated:', adherence_id);

        return NextResponse.json({
            success: true,
            adherence: data,
            message: 'Adherence updated successfully'
        });
    } catch (error: any) {
        console.error('[API] Adherence update error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
