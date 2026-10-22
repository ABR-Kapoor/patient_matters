import { NextRequest, NextResponse } from 'next/server';
import { verifyClerkUser } from '@/lib/clerk-verify';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyClerkUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's UID from database
    const [userData] = await sql`
      SELECT uid, role FROM users WHERE auth_id = ${user.id}
    `;

    if (!userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    function parseTimeToMinutes(timeStr: string): number {
      if (!timeStr) return 0;
      const clean = timeStr.trim().toUpperCase();
      const isPM = clean.includes('PM');
      const isAM = clean.includes('AM');
      const timePart = clean.replace(/[AP]M/, '').trim();
      const [hourStr, minuteStr] = timePart.split(':');
      let hour = parseInt(hourStr, 10) || 0;
      let minute = parseInt(minuteStr, 10) || 0;
      if (isPM && hour < 12) {
        hour += 12;
      } else if (isAM && hour === 12) {
        hour = 0;
      }
      return hour * 60 + minute;
    }

    let appointments: any[] = [];
    if (userData.role === 'patient') {
      const [patient] = await sql`SELECT pid FROM patients WHERE uid = ${userData.uid}`;
      if (patient) {
        appointments = await sql`
          SELECT aid, scheduled_date, scheduled_time, status, did, pid
          FROM appointments
          WHERE pid = ${patient.pid}
            AND (
              (scheduled_date = ${currentDate} AND status IN ('scheduled', 'in_progress', 'confirmed'))
              OR (status = 'in_progress')
            )
        `;
      }
    } else if (userData.role === 'doctor') {
      const [doctor] = await sql`SELECT did FROM doctors WHERE uid = ${userData.uid}`;
      if (doctor) {
        appointments = await sql`
          SELECT aid, scheduled_date, scheduled_time, status, did, pid
          FROM appointments
          WHERE did = ${doctor.did}
            AND (
              (scheduled_date = ${currentDate} AND status IN ('scheduled', 'in_progress', 'confirmed'))
              OR (status = 'in_progress')
            )
        `;
      }
    } else {
      appointments = await sql`
        SELECT aid, scheduled_date, scheduled_time, status, did, pid
        FROM appointments
        WHERE (scheduled_date = ${currentDate} AND status IN ('scheduled', 'in_progress', 'confirmed'))
           OR status = 'in_progress'
      `;
    }

    // Filter appointments that are happening now (only if they are actively in_progress)
    const activeCalls = appointments?.filter(apt => {
      const status = apt.status || apt.Status;
      return status === 'in_progress';
    }) || [];

    return NextResponse.json({
      active: activeCalls.length > 0,
      calls: activeCalls,
      count: activeCalls.length
    });

  } catch (error) {
    console.error('Error in check-active API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
