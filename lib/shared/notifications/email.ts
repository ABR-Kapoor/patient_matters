/**
 * Email notification service using Resend
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!RESEND_API_KEY || !resend) {
    console.warn('RESEND_API_KEY is not configured. Skipping email send.');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  if (!to || !subject || !html) {
    return { success: false, error: 'Invalid email payload: to, subject, and html are required' };
  }

  try {
    let from = process.env.SENDER_EMAIL || 'noreply@sends.kapoorabeer.me';
    
    // Format with professional display name
    if (!from.includes('<')) {
      from = `AuraSutra <${from}>`;
    }

    if (!process.env.SENDER_EMAIL) {
      console.warn('SENDER_EMAIL not configured. Using noreply@sends.kapoorabeer.me as sender fallback.');
    }

    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: replyTo || from,
    });

    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send email',
    };
  }
}

export async function sendBulkEmail(
  emails: { to: string; subject: string; html: string }[]
): Promise<{ success: boolean; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendEmail(email);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { success: failed === 0, sent, failed };
}
