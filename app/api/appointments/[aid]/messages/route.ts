import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireSessionUser } from '@/lib/authz';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ aid: string }> }
) {
  const { aid } = await params;
  if (!aid) {
    return NextResponse.json({ success: false, error: 'Appointment ID required' }, { status: 400 });
  }

  const auth = await requireSessionUser();
  if (!auth.ok) return auth.response;
  const user = auth.data;

  try {
    // Verify appointment access (either the doctor or the patient on this appointment)
    const [appointment] = await sql`
      SELECT 
        a.aid, a.status, a.mode, a.scheduled_date, a.scheduled_time,
        (((a.scheduled_date + a.scheduled_time) AT TIME ZONE 'Asia/Kolkata') - interval '10 minutes') AS call_opens_at,
        (
          a.mode = 'online'
          AND a.status IN ('confirmed', 'in_progress')
          AND NOW() >= (((a.scheduled_date + a.scheduled_time) AT TIME ZONE 'Asia/Kolkata') - interval '10 minutes')
        ) AS call_available,
        NOW() AS server_time,
        p.pid, pu.uid as patient_uid, pu.name as patient_name, pu.profile_image_url as patient_image,
        d.did, du.uid as doctor_uid, du.name as doctor_name, du.profile_image_url as doctor_image
      FROM appointments a
      JOIN patients p ON a.pid = p.pid
      JOIN users pu ON p.uid = pu.uid
      JOIN doctors d ON a.did = d.did
      JOIN users du ON d.uid = du.uid
      WHERE a.aid = ${aid}
      LIMIT 1
    `;

    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    const isPatient = user.uid === appointment.patient_uid;
    const isDoctor = user.uid === appointment.doctor_uid;

    if (!isPatient && !isDoctor) {
      return NextResponse.json({ success: false, error: 'Unauthorized to view messages for this appointment' }, { status: 403 });
    }

    // Only allow chat once appointment is confirmed or in progress (or completed)
    const canChat = ['confirmed', 'in_progress', 'completed'].includes(appointment.status);

    // Mark counterpart unread messages as read
    if (isDoctor) {
      await sql`
        UPDATE appointment_messages
        SET read_at = NOW()
        WHERE aid = ${aid}
          AND sender_role = 'patient'
          AND read_at IS NULL
      `;
    } else if (isPatient) {
      await sql`
        UPDATE appointment_messages
        SET read_at = NOW()
        WHERE aid = ${aid}
          AND sender_role = 'doctor'
          AND read_at IS NULL
      `;
    }

    const messages = await sql`
      SELECT 
        m.message_id,
        m.aid,
        m.sender_uid,
        m.sender_role,
        m.content,
        m.media_url,
        m.created_at,
        m.read_at,
        u.name as sender_name
      FROM appointment_messages m
      JOIN users u ON m.sender_uid = u.uid
      WHERE m.aid = ${aid}
      ORDER BY m.created_at ASC
    `;

    return NextResponse.json({
      success: true,
      canChat,
      appointmentStatus: appointment.status,
      appointment: {
        aid: appointment.aid,
        did: appointment.did,
        pid: appointment.pid,
        status: appointment.status,
        patientName: appointment.patient_name,
        patient_name: appointment.patient_name,
        patientImage: appointment.patient_image,
        patient_image: appointment.patient_image,
        doctorName: appointment.doctor_name,
        doctor_name: appointment.doctor_name,
        doctorImage: appointment.doctor_image,
        doctor_image: appointment.doctor_image,
        doctorAvatarUrl: appointment.doctor_image,
        mode: appointment.mode,
        scheduledDate: appointment.scheduled_date,
        scheduledTime: appointment.scheduled_time,
        callAvailable: Boolean(appointment.call_available),
        callOpensAt: appointment.call_opens_at,
        serverTime: appointment.server_time,
      },
      messages,
    });
  } catch (err: any) {
    console.error('Error fetching appointment messages:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ aid: string }> }
) {
  const { aid } = await params;
  if (!aid) {
    return NextResponse.json({ success: false, error: 'Appointment ID required' }, { status: 400 });
  }

  const auth = await requireSessionUser();
  if (!auth.ok) return auth.response;
  const user = auth.data;

  try {
    const body = await req.json();
    const content = String(body.content || '').trim();
    const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : null;

    if (!content && !mediaUrl) {
      return NextResponse.json({ success: false, error: 'Message content cannot be empty' }, { status: 400 });
    }

    // Verify appointment access
    const [appointment] = await sql`
      SELECT 
        a.aid, a.status,
        p.pid, pu.uid as patient_uid,
        d.did, du.uid as doctor_uid
      FROM appointments a
      JOIN patients p ON a.pid = p.pid
      JOIN users pu ON p.uid = pu.uid
      JOIN doctors d ON a.did = d.did
      JOIN users du ON d.uid = du.uid
      WHERE a.aid = ${aid}
      LIMIT 1
    `;

    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    const isPatient = user.uid === appointment.patient_uid;
    const isDoctor = user.uid === appointment.doctor_uid;

    if (!isPatient && !isDoctor) {
      return NextResponse.json({ success: false, error: 'Unauthorized to send message' }, { status: 403 });
    }

    // Can only message if appointment is confirmed or in_progress
    if (!['confirmed', 'in_progress'].includes(appointment.status)) {
      return NextResponse.json({
        success: false,
        error: `Messaging is active only after the doctor confirms the appointment (current status: ${appointment.status}).`
      }, { status: 400 });
    }

    const senderRole = isPatient ? 'patient' : 'doctor';

    const [newMessage] = await sql`
      INSERT INTO appointment_messages (
        aid, sender_uid, sender_role, content, media_url
      ) VALUES (
        ${aid}, ${user.uid}, ${senderRole}, ${content}, ${mediaUrl}
      )
      RETURNING message_id, aid, sender_uid, sender_role, content, media_url, created_at, read_at
    `;

    return NextResponse.json({
      success: true,
      message: {
        ...newMessage,
        sender_name: user.name,
      },
    });
  } catch (err: any) {
    console.error('Error sending appointment message:', err);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}
