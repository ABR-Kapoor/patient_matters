import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, email, organisation, role, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return NextResponse.json({ error: 'No admin emails configured' }, { status: 500 });
    }

    const subject =
      type === 'partner'
        ? `🤝 New Partnership Inquiry — ${name}`
        : `📩 New Contact Message — ${name}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8faf9; padding: 32px; border-radius: 16px;">
        <div style="background: linear-gradient(135deg, #22854A, #16623a); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <img src="https://www.aurasutra.org/AuraSutra-Full_BlackText-Transparent.png" alt="AuraSutra" style="height: 36px; filter: brightness(0) invert(1); margin-bottom: 12px;" />
          <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 800;">
            ${type === 'partner' ? '🤝 Partnership Inquiry' : '📩 Contact Message'}
          </h1>
          <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">From the AuraSutra Vision Page</p>
        </div>

        <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2f0e8;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600; width: 120px;">Name</td><td style="padding: 8px 0; color: #111827; font-weight: 700;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Email</td><td style="padding: 8px 0; color: #22854A; font-weight: 700;"><a href="mailto:${email}" style="color: #22854A;">${email}</a></td></tr>
            ${organisation ? `<tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Organisation</td><td style="padding: 8px 0; color: #111827; font-weight: 700;">${organisation}</td></tr>` : ''}
            ${role ? `<tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Role</td><td style="padding: 8px 0;"><span style="background: #e8f5ee; color: #22854A; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">${role}</span></td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600; vertical-align: top;">Message</td><td style="padding: 8px 0; color: #111827; line-height: 1.6;">${message.replace(/\n/g, '<br/>')}</td></tr>
          </table>
        </div>

        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">
          AuraSutra by FrequnSync · Udyam MSME · Est. 2026
        </p>
      </div>
    `;

    await resend.emails.send({
      from: 'AuraSutra Vision <noreply@aurasutra.org>',
      to: adminEmails,
      replyTo: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[vision-contact] Error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
