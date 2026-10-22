import { NextRequest, NextResponse } from 'next/server';
import { verifyClerkUser } from '@/lib/clerk-verify';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    console.log('[dev-sync-user] Incoming request authHeader:', authHeader ? `${authHeader.slice(0, 20)}... (length: ${authHeader.length})` : 'NONE');
    const clerkUser = await verifyClerkUser();
    console.log('[dev-sync-user] verifyClerkUser result:', clerkUser?.id ? `id=${clerkUser.id}` : 'null');

    let authId = clerkUser?.id;
    let email = clerkUser?.email || '';
    let fullName = `${clerkUser?.given_name || ''} ${clerkUser?.family_name || ''}`.trim();

    if (!authId && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const part = token.split('.')[1];
      if (part) {
        try {
          const claims = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          if (claims.sub) {
            authId = claims.sub;
            console.log('[dev-sync-user] Recovered authId from Bearer token claims:', authId);
          }
        } catch (e) {
          console.warn('[dev-sync-user] Failed to decode Bearer claims:', e);
        }
      }
    }

    if (!authId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!fullName) fullName = 'Patient';

    const [existingUser] = await sql`
      SELECT uid, role FROM users WHERE auth_id = ${authId} LIMIT 1
    `;

    // A doctor who opens the patient app is authenticated but belongs on the other
    // portal. Refuse instead of silently downgrading or re-provisioning them.
    if (existingUser && existingUser.role !== 'patient') {
      return NextResponse.json(
        {
          error: 'This account is not registered as a patient and cannot use the patient app.',
          code: 'ROLE_MISMATCH',
        },
        { status: 403 }
      );
    }

    let uid = existingUser?.uid;

    if (!existingUser) {
      const [existingEmail] = await sql`
        SELECT uid, role FROM users WHERE email = ${email} AND auth_id IS DISTINCT FROM ${authId} LIMIT 1
      `;

      if (existingEmail) {
        // Claiming by email must respect the stored role too, otherwise a doctor
        // account could be swallowed by a patient session on email match.
        if (existingEmail.role !== 'patient') {
          return NextResponse.json(
            {
              error: 'This account is not registered as a patient and cannot use the patient app.',
              code: 'ROLE_MISMATCH',
            },
            { status: 403 }
          );
        }

        await sql`
          UPDATE users
          SET auth_id = ${authId}, last_login = ${new Date().toISOString()}
          WHERE uid = ${existingEmail.uid}
        `;
        uid = existingEmail.uid;
      } else {
        // Role is pinned here and cannot be influenced by the caller.
        const [inserted] = await sql`
          INSERT INTO users (auth_id, email, name, role, is_verified, last_login)
          VALUES (
            ${authId},
            ${email},
            ${fullName},
            'patient',
            true,
            ${new Date().toISOString()}
          )
          RETURNING uid
        `;
        uid = inserted?.uid;

        if (uid) {
          await sql`INSERT INTO patients (uid) VALUES (${uid}) ON CONFLICT DO NOTHING`;
        }
      }
    } else {
      await sql`
        UPDATE users SET last_login = ${new Date().toISOString()} WHERE uid = ${uid}
      `;
    }

    const [patientRow] = uid ? await sql`SELECT pid FROM patients WHERE uid = ${uid}` : [];
    const pid = patientRow?.pid || null;

    return NextResponse.json({ success: true, uid, pid, role: 'patient' });
  } catch (err: any) {
    console.error('[dev-sync-user] 500:', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint_name ?? err?.constraint,
      table: err?.table_name,
      column: err?.column_name,
    });
    return NextResponse.json({ error: err.message, code: err?.code }, { status: 500 });
  }
}
