/**
 * Email templates for notifications
 */

export interface DoctorBankDetails {
  accountName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  upiId?: string | null;
}

const COMMON_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f3f4f6; margin: 0; padding: 0; }
  .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
  .main { background: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 20px; }
  .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
  .header p { color: #d1fae5; margin: 5px 0 0 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  .content { padding: 30px 40px; }
  .greeting { font-size: 18px; font-weight: 600; color: #111827; margin-top: 0; margin-bottom: 15px; }
  .text { font-size: 15px; color: #4b5563; margin-bottom: 20px; line-height: 1.6; }
  .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
  .card-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin: 0 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
  .row { display: table; width: 100%; margin-bottom: 12px; }
  .row:last-child { margin-bottom: 0; }
  .label { display: table-cell; width: 40%; font-size: 14px; color: #64748b; font-weight: 500; vertical-align: top; }
  .value { display: table-cell; width: 60%; font-size: 14px; color: #1e293b; font-weight: 600; vertical-align: top; text-align: right; }
  .button-container { text-align: center; margin: 30px 0; }
  .button { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3); }
  .admin-alert { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .admin-alert h4 { color: #b45309; margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
  .admin-alert p { color: #92400e; margin: 0; font-size: 14px; }
  .bank-details { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-top: 20px; }
  .bank-details .card-title { color: #166534; border-bottom-color: #bbf7d0; }
  .bank-details .label { color: #166534; }
  .bank-details .value { color: #14532d; font-family: monospace; font-size: 15px; }
  .footer { text-align: center; padding: 30px 20px; color: #6b7280; font-size: 12px; }
  .footer p { margin: 5px 0; }
  .logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -1px; margin-bottom: 10px; }
  .logo-leaf { color: #a7f3d0; }
  @media screen and (max-width: 600px) {
    .main { margin-top: 0; border-radius: 0; }
    .content { padding: 20px 20px; }
    .label, .value { display: block; width: 100%; text-align: left; }
    .value { margin-top: 2px; margin-bottom: 12px; }
    .row:last-child .value { margin-bottom: 0; }
  }
`;

function getLogoHtml() {
  return '<div class="logo">Aura<span class="logo-leaf">Sutra</span></div>';
}

function getBankDetailsHtml(details?: DoctorBankDetails) {
  if (!details) return '';
  
  const hasBank = details.accountNumber || details.ifscCode;
  const hasUpi = details.upiId;
  
  if (!hasBank && !hasUpi) {
    return `
      <div class="bank-details" style="background-color: #fef2f2; border-color: #fecaca;">
        <h4 class="card-title" style="color: #991b1b; border-bottom-color: #fecaca;">Action Required</h4>
        <p style="color: #991b1b; font-size: 14px; margin: 0;">Doctor has not provided any bank or UPI details for settlement.</p>
      </div>
    `;
  }

  return `
    <div class="bank-details">
      <h4 class="card-title">Settlement Details</h4>
      ${hasUpi ? `
        <div class="row">
          <span class="label">UPI ID</span>
          <span class="value">${details.upiId}</span>
        </div>
      ` : ''}
      ${hasBank ? `
        ${details.accountName ? `
          <div class="row">
            <span class="label">Account Name</span>
            <span class="value">${details.accountName}</span>
          </div>
        ` : ''}
        <div class="row">
          <span class="label">Bank Name</span>
          <span class="value">${details.bankName || 'Not specified'}</span>
        </div>
        <div class="row">
          <span class="label">Account Number</span>
          <span class="value">${details.accountNumber || 'Not specified'}</span>
        </div>
        <div class="row">
          <span class="label">IFSC Code</span>
          <span class="value">${details.ifscCode || 'Not specified'}</span>
        </div>
      ` : ''}
    </div>
  `;
}

export function generateAppointmentCreatedEmail({
  recipientName,
  recipientType,
  patientName,
  doctorName,
  appointmentDate,
  appointmentTime,
  mode,
  meetingLink,
  tokenNumber,
  chiefComplaint,
  doctorBankDetails
}: {
  recipientName: string;
  recipientType: 'patient' | 'doctor' | 'admin';
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  mode: string;
  meetingLink?: string;
  tokenNumber?: string;
  chiefComplaint?: string;
  doctorBankDetails?: DoctorBankDetails;
}): string {
  const isAdmin = recipientType === 'admin';
  const isPatient = recipientType === 'patient';
  
  const headerTitle = isAdmin ? 'Admin Alert' : 'Appointment Confirmed';
  const headerSubtitle = isAdmin ? 'New Booking & Settlement' : (isPatient ? 'Your booking is confirmed' : 'New appointment scheduled');
  
  const introText = isAdmin 
    ? `A new appointment has been booked between <strong>${patientName}</strong> and <strong>${doctorName}</strong>.`
    : (isPatient 
      ? `Your appointment with <strong>${doctorName}</strong> has been successfully booked.` 
      : `An appointment has been scheduled with <strong>${patientName}</strong>.`);

  const modeDisplay = mode === 'online' || mode === 'video' ? 'Online Video Consultation' : 'In-Clinic Visit';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${COMMON_STYLES}</style>
    </head>
    <body>
      <table class="wrapper">
        <tr>
          <td align="center">
            <table class="main">
              <tr>
                <td class="header">
                  ${getLogoHtml()}
                  <h1>${headerTitle}</h1>
                  <p>${headerSubtitle}</p>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <h2 class="greeting">Hello ${recipientName},</h2>
                  <p class="text">${introText}</p>
                  
                  ${isAdmin ? `
                    <div class="admin-alert">
                      <h4>Finance Action Required</h4>
                      <p>Patient payment is collected. Please verify the completed appointment and arrange doctor settlement manually.</p>
                    </div>
                  ` : ''}

                  <div class="card">
                    <h4 class="card-title">Appointment Details</h4>
                    <div class="row">
                      <span class="label">Date</span>
                      <span class="value">${appointmentDate}</span>
                    </div>
                    <div class="row">
                      <span class="label">Time</span>
                      <span class="value">${appointmentTime}</span>
                    </div>
                    <div class="row">
                      <span class="label">Mode</span>
                      <span class="value">${modeDisplay}</span>
                    </div>
                    ${tokenNumber ? `
                      <div class="row">
                        <span class="label">Token No</span>
                        <span class="value">#${tokenNumber}</span>
                      </div>
                    ` : ''}
                    ${chiefComplaint ? `
                      <div class="row" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                        <span class="label">Chief Complaint</span>
                        <span class="value" style="font-weight: 400;">${chiefComplaint}</span>
                      </div>
                    ` : ''}
                  </div>

                  ${isAdmin ? getBankDetailsHtml(doctorBankDetails) : ''}

                  ${!isAdmin ? `
                    <div class="button-container">
                      ${(mode === 'online' || mode === 'video') && meetingLink
                        ? `<a href="${meetingLink}" class="button">Join Video Call</a>`
                        : `<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://aurasutra.com'}/dashboard/appointments" class="button">View Appointment</a>`
                      }
                    </div>
                  ` : ''}
                  
                  <p class="text" style="font-size: 13px; color: #94a3b8; margin-top: 30px;">
                    ${isAdmin 
                      ? 'Keep the finance ledger updated after the doctor settlement is completed.' 
                      : (mode === 'online' || mode === 'video' ? 'Please ensure you have a stable internet connection.' : 'Please arrive 10 minutes early for your appointment.')}
                  </p>
                </td>
              </tr>
            </table>
            <div class="footer">
              <p>AuraSutra Healthcare Platform</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generateRefundRequestForPatientEmail({
  recipientName,
  patientName,
  doctorName,
  amount,
  reason,
}: {
  recipientName: string;
  patientName: string;
  doctorName: string;
  amount: number;
  reason: string;
}): string {
  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<style>' + COMMON_STYLES + '</style>' +
'</head>' +
'<body>' +
'<table class="wrapper"><tr><td align="center"><table class="main">' +
'<tr><td class="header">' + getLogoHtml() + '<h1>Refund Request Received</h1><p>We have received your request</p></td></tr>' +
'<tr><td class="content">' +
'<h2 class="greeting">Hello ' + recipientName + ',</h2>' +
'<p class="text">Your refund request for the consultation with <strong>' + doctorName + '</strong> has been recorded and is under review. We will notify you once it is processed.</p>' +
'<div class="card">' +
'<h4 class="card-title">Refund Details</h4>' +
(patientName ? '<div class="row"><span class="label">Patient</span><span class="value">' + patientName + '</span></div>' : '') +
'<div class="row"><span class="label">Doctor</span><span class="value">' + doctorName + '</span></div>' +
'<div class="row"><span class="label">Amount</span><span class="value" style="font-size:20px;font-weight:800;color:#dc2626;">&#x20B9;' + amount.toFixed(2) + '</span></div>' +
(reason ? '<div class="row" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e2e8f0;"><span class="label">Reason</span><span class="value" style="font-weight:400;font-style:italic;">' + reason + '</span></div>' : '') +
'</div>' +
'<p class="text" style="font-size:13px;color:#94a3b8;margin-top:30px;">Refunds typically take 5-7 business days to reflect in your account.</p>' +
'</td></tr></table>' +
'<div class="footer"><p>AuraSutra &#x2014; Practitioner Directory</p><p>This is an automated message, please do not reply.</p><p style="margin-top:8px;">-by Team AuraSutra</p></div>' +
'</td></tr></table>' +
'</body></html>';
}

export function generateRefundRequestForDoctorEmail({
  recipientName,
  patientName,
  amount,
  reason,
}: {
  recipientName: string;
  patientName: string;
  amount: number;
  reason: string;
}): string {
  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<style>' + COMMON_STYLES + '</style>' +
'</head>' +
'<body>' +
'<table class="wrapper"><tr><td align="center"><table class="main">' +
'<tr><td class="header">' + getLogoHtml() + '<h1>Refund Requested for Your Patient</h1><p>Action may be required</p></td></tr>' +
'<tr><td class="content">' +
'<h2 class="greeting">Hello Dr. ' + recipientName + ',</h2>' +
'<p class="text">Your patient <strong>' + patientName + '</strong> has requested a refund for a consultation. Please review the details below.</p>' +
'<div class="card">' +
'<h4 class="card-title">Refund Details</h4>' +
'<div class="row"><span class="label">Patient</span><span class="value">' + patientName + '</span></div>' +
'<div class="row"><span class="label">Amount</span><span class="value" style="font-size:20px;font-weight:800;color:#dc2626;">&#x20B9;' + amount.toFixed(2) + '</span></div>' +
(reason ? '<div class="row" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e2e8f0;"><span class="label">Reason</span><span class="value" style="font-weight:400;font-style:italic;">' + reason + '</span></div>' : '') +
'</div>' +
'<p class="text" style="font-size:13px;color:#94a3b8;margin-top:30px;">The admin team will review and process this request. You will be notified of the outcome.</p>' +
'</td></tr></table>' +
'<div class="footer"><p>AuraSutra &#x2014; Practitioner Directory</p><p>This is an automated message, please do not reply.</p><p style="margin-top:8px;">-by Team AuraSutra</p></div>' +
'</td></tr></table>' +
'</body></html>';
}

export function generateRefundRequestForAdminEmail({
  recipientName,
  patientName,
  patientEmail,
  doctorName,
  amount,
  refundId,
  reason,
  status,
}: {
  recipientName: string;
  patientName: string;
  patientEmail?: string;
  doctorName: string;
  amount: number;
  refundId: string;
  reason: string;
  status: string;
}): string {
  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
    processed: '#3b82f6',
  };

  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<style>' + COMMON_STYLES + '</style>' +
'</head>' +
'<body>' +
'<table class="wrapper"><tr><td align="center"><table class="main">' +
'<tr><td class="header">' + getLogoHtml() + '<h1>Refund Action Required</h1><p>Manual review needed</p></td></tr>' +
'<tr><td class="content">' +
'<h2 class="greeting">Hello ' + recipientName + ',</h2>' +
'<div class="admin-alert"><h4>Action Required</h4><p>A refund request requires your attention. Please review the details below and process the refund manually via the Razorpay dashboard.</p></div>' +
'<div class="card">' +
'<h4 class="card-title">Refund Details</h4>' +
'<div class="row"><span class="label">Patient</span><span class="value">' + patientName + '</span></div>' +
(patientEmail ? '<div class="row"><span class="label">Patient Email</span><span class="value">' + patientEmail + '</span></div>' : '') +
'<div class="row"><span class="label">Doctor</span><span class="value">' + doctorName + '</span></div>' +
'<div class="row"><span class="label">Amount</span><span class="value" style="font-size:20px;font-weight:800;color:#dc2626;">&#x20B9;' + amount.toFixed(2) + '</span></div>' +
'<div class="row"><span class="label">Refund ID</span><span class="value" style="font-family:monospace;">' + refundId + '</span></div>' +
'<div class="row"><span class="label">Status</span><span class="value" style="color:' + (statusColors[status] || '#6b7280') + ';font-weight:700;text-transform:uppercase;">' + status + '</span></div>' +
(reason ? '<div class="row" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e2e8f0;"><span class="label">Reason</span><span class="value" style="font-weight:400;font-style:italic;">' + reason + '</span></div>' : '') +
'</div>' +
'<div class="bank-details" style="background-color:#fef2f2;border-color:#fecaca;"><h4 class="card-title" style="color:#991b1b;border-bottom-color:#fecaca;">Manual Action Needed</h4><p style="color:#991b1b;font-size:14px;margin:0;">Go to <strong>Razorpay Dashboard &#x2192; Payments &#x2192; Refund</strong> to process this refund manually. Once processed, update the refund status in the admin panel.</p></div>' +
'<p class="text" style="font-size:13px;color:#94a3b8;margin-top:30px;">Please process this within 2-3 business days.</p>' +
'</td></tr></table>' +
'<div class="footer"><p>AuraSutra &#x2014; Practitioner Directory</p><p>This is an automated message, please do not reply.</p><p style="margin-top:8px;">-by Team AuraSutra</p></div>' +
'</td></tr></table>' +
'</body></html>';
}

export function generateRefundRequestEmail({
  recipientName,
  recipientType,
  patientName,
  patientEmail,
  doctorName,
  amount,
  refundId,
  reason,
  status,
}: {
  recipientName: string;
  recipientType: 'patient' | 'admin';
  patientName: string;
  patientEmail?: string;
  doctorName: string;
  amount: number;
  refundId: string;
  reason: string;
  status: string;
}): string {
  const isAdmin = recipientType === 'admin';

  const headerTitle = isAdmin ? 'Refund Action Required' : 'Refund Request Received';
  const headerSubtitle = isAdmin ? 'Manual review needed' : 'We have received your request';

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
    processed: '#3b82f6',
  };

  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<style>' + COMMON_STYLES + '</style>' +
'</head>' +
'<body>' +
'<table class="wrapper"><tr><td align="center"><table class="main">' +
'<tr><td class="header">' + getLogoHtml() + '<h1>' + headerTitle + '</h1><p>' + headerSubtitle + '</p></td></tr>' +
'<tr><td class="content">' +
'<h2 class="greeting">Hello ' + recipientName + ',</h2>' +
(isAdmin
  ? '<div class="admin-alert"><h4>Action Required</h4><p>A refund request requires your attention. Please review the details below and process the refund manually via the Razorpay dashboard.</p></div>'
  : '<p class="text">Your refund request has been recorded and is under review. We will notify you once it is processed.</p>') +
'<div class="card">' +
'<h4 class="card-title">Refund Details</h4>' +
'<div class="row"><span class="label">Patient</span><span class="value">' + patientName + '</span></div>' +
(patientEmail ? '<div class="row"><span class="label">Patient Email</span><span class="value">' + patientEmail + '</span></div>' : '') +
'<div class="row"><span class="label">Doctor</span><span class="value">' + doctorName + '</span></div>' +
'<div class="row"><span class="label">Amount</span><span class="value" style="font-size:20px;font-weight:800;color:#dc2626;">&#x20B9;' + amount.toFixed(2) + '</span></div>' +
'<div class="row"><span class="label">Refund ID</span><span class="value" style="font-family:monospace;">' + refundId + '</span></div>' +
'<div class="row"><span class="label">Status</span><span class="value" style="color:' + (statusColors[status] || '#6b7280') + ';font-weight:700;text-transform:uppercase;">' + status + '</span></div>' +
(reason ? '<div class="row" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e2e8f0;"><span class="label">Reason</span><span class="value" style="font-weight:400;font-style:italic;">' + reason + '</span></div>' : '') +
'</div>' +
(isAdmin
  ? '<div class="bank-details" style="background-color:#fef2f2;border-color:#fecaca;"><h4 class="card-title" style="color:#991b1b;border-bottom-color:#fecaca;">Manual Action Needed</h4><p style="color:#991b1b;font-size:14px;margin:0;">Go to <strong>Razorpay Dashboard &#x2192; Payments &#x2192; Refund</strong> to process this refund manually. Once processed, update the refund status in the admin panel.</p></div>'
  : '') +
'<p class="text" style="font-size:13px;color:#94a3b8;margin-top:30px;">' +
(isAdmin ? 'Please process this within 2-3 business days.' : 'Refunds typically take 5-7 business days to reflect in your account.') +
'</p>' +
'</td></tr></table>' +
'<div class="footer"><p>AuraSutra &#x2014; Practitioner Directory</p><p>This is an automated message, please do not reply.</p><p style="margin-top:8px;">-by Team AuraSutra</p></div>' +
'</td></tr></table>' +
'</body></html>';
}

export function generatePrescriptionCreatedEmail({
  recipientName,
  recipientType,
  patientName,
  doctorName,
  diagnosis,
  medicines,
  instructions,
  dashboardLink,
}: {
  recipientName: string;
  recipientType: 'patient' | 'doctor';
  patientName: string;
  doctorName: string;
  diagnosis?: string;
  medicines: Array<{ name: string; dosage: string; frequency?: string; duration: string }>;
  instructions?: string;
  dashboardLink: string;
}): string {
  const isPatient = recipientType === 'patient';
  
  const medicineCards = medicines.map(med => `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; margin-bottom: 10px;">
      <h5 style="margin: 0 0 8px 0; color: #10b981; font-size: 15px;">💊 ${med.name}</h5>
      <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 13px; color: #4b5563;">
        <div><strong>Dosage:</strong> ${med.dosage}</div>
        ${med.frequency ? `<div><strong>Frequency:</strong> ${med.frequency}</div>` : ''}
        <div><strong>Duration:</strong> ${med.duration}</div>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${COMMON_STYLES}</style>
    </head>
    <body>
      <table class="wrapper">
        <tr>
          <td align="center">
            <table class="main">
              <tr>
                <td class="header">
                  ${getLogoHtml()}
                  <h1>New Prescription</h1>
                  <p>From ${doctorName}</p>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <h2 class="greeting">Hello ${recipientName},</h2>
                  <p class="text">
                    ${isPatient 
                      ? `You have received a new prescription from <strong>${doctorName}</strong>. Please follow the instructions carefully.` 
                      : `A prescription has been created successfully for <strong>${patientName}</strong>.`}
                  </p>
                  
                  ${diagnosis ? `
                    <div class="card" style="background-color: #fff; border-left: 4px solid #10b981;">
                      <h4 class="card-title">Diagnosis</h4>
                      <p style="margin: 0; color: #1e293b; font-weight: 500;">${diagnosis}</p>
                    </div>
                  ` : ''}
                  
                  <div class="card" style="background-color: #f8fafc; padding: 15px;">
                    <h4 class="card-title" style="margin-bottom: 12px; border: none; padding: 0;">Prescribed Medicines</h4>
                    ${medicineCards}
                  </div>
                  
                  ${instructions ? `
                    <div class="card">
                      <h4 class="card-title">Special Instructions</h4>
                      <p style="margin: 0; color: #4b5563; font-size: 14px;">${instructions}</p>
                    </div>
                  ` : ''}
                  
                  <div class="button-container">
                    <a href="${dashboardLink}" class="button">View Full Prescription</a>
                  </div>
                  
                  ${isPatient ? `
                    <div class="admin-alert" style="border-left-color: #10b981; background-color: #f0fdf4;">
                      <h4 style="color: #047857;">Medical Advice</h4>
                      <p style="color: #065f46;">Please follow the prescription as advised by your doctor. Do not stop medication without consulting.</p>
                    </div>
                  ` : ''}
                </td>
              </tr>
            </table>
            <div class="footer">
              <p>AuraSutra Healthcare Platform</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generatePaymentReceiptEmail({
  recipientName,
  recipientType,
  patientName,
  doctorName,
  amount,
  transactionId,
  paymentMethod,
  appointmentDate,
  appointmentTime,
  mode,
  paymentDate,
  doctorBankDetails,
  platformFeeAmount
}: {
  recipientName: string;
  recipientType: 'patient' | 'doctor' | 'admin';
  patientName: string;
  doctorName: string;
  amount: number;
  transactionId: string;
  paymentMethod: string;
  appointmentDate: string;
  appointmentTime: string;
  mode: string;
  paymentDate: string;
  doctorBankDetails?: DoctorBankDetails;
  platformFeeAmount?: number;
}): string {
  const isAdmin = recipientType === 'admin';
  const isPatient = recipientType === 'patient';
  
  const headerTitle = isAdmin ? 'Payment Alert' : 'Payment Receipt ✓';
  const headerSubtitle = isAdmin ? 'Funds Captured' : 'Your payment is successful';
  
  const introText = isAdmin 
    ? `A payment of <strong>₹${amount.toFixed(2)}</strong> has been collected for an appointment with <strong>${doctorName}</strong>.`
    : (isPatient 
      ? 'Thank you for your payment. Here is your transaction receipt:' 
      : `Payment received from <strong>${patientName}</strong>. Here is the transaction receipt:`);

  const modeDisplay = mode === 'online' || mode === 'video' ? 'Online Video Consultation' : 'In-Clinic Visit';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${COMMON_STYLES}</style>
    </head>
    <body>
      <table class="wrapper">
        <tr>
          <td align="center">
            <table class="main">
              <tr>
                <td class="header">
                  ${getLogoHtml()}
                  <h1>${headerTitle}</h1>
                  <p>${headerSubtitle}</p>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <h2 class="greeting">Hello ${recipientName},</h2>
                  <p class="text">${introText}</p>
                  
                  ${isAdmin ? `
                    <div class="admin-alert">
                      <h4>Settlement Action Required</h4>
                      <p>Please verify the appointment completion and settle the doctor manually through their verified bank or UPI details.</p>
                    </div>
                  ` : ''}

                  <div class="card" style="border-top: 4px solid #10b981; padding-top: 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <span style="font-size: 42px; font-weight: 800; color: #10b981; letter-spacing: -1px;">₹${amount.toFixed(2)}</span>
                      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-top: 5px;">Amount Paid</div>
                    </div>

                    ${isAdmin && platformFeeAmount !== undefined ? `
                      <div class="row">
                        <span class="label">Patient Paid (Total)</span>
                        <span class="value">₹${amount.toFixed(2)}</span>
                      </div>
                      <div class="row">
                        <span class="label">Platform Fee (Retained)</span>
                        <span class="value" style="color: #64748b;">₹${platformFeeAmount.toFixed(2)}</span>
                      </div>
                      <div class="row">
                        <span class="label" style="color: #047857; font-weight: 700;">Doctor Settlement</span>
                        <span class="value" style="color: #047857; font-weight: 800;">₹${(amount - platformFeeAmount).toFixed(2)}</span>
                      </div>
                    ` : ''}

                    <div class="row" style="${isAdmin && platformFeeAmount !== undefined ? 'margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;' : ''}">
                      <span class="label">Transaction ID</span>
                      <span class="value" style="font-family: monospace;">${transactionId}</span>
                    </div>
                    <div class="row">
                      <span class="label">Payment Method</span>
                      <span class="value" style="text-transform: capitalize;">${paymentMethod}</span>
                    </div>
                    <div class="row">
                      <span class="label">Date & Time</span>
                      <span class="value">${paymentDate}</span>
                    </div>
                    <div class="row" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                      <span class="label">Consultation</span>
                      <span class="value">${modeDisplay} on ${appointmentDate}</span>
                    </div>
                  </div>

                  ${isAdmin ? getBankDetailsHtml(doctorBankDetails) : ''}

                  <p class="text" style="font-size: 13px; color: #94a3b8; margin-top: 30px; text-align: center;">
                    ${isAdmin 
                      ? 'Keep this record for finance settlement tracking.' 
                      : 'A copy of this receipt has been saved to your account.'}
                  </p>
                </td>
              </tr>
            </table>
            <div class="footer">
              <p>AuraSutra Healthcare Platform</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generateAppointmentCancelledForDoctorEmail({
  recipientName,
  patientName,
  amount,
  reason,
}: {
  recipientName: string;
  patientName: string;
  amount: number;
  reason?: string;
}): string {
  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<style>' + COMMON_STYLES + '</style>' +
'</head>' +
'<body>' +
'<table class="wrapper"><tr><td align="center"><table class="main">' +
'<tr><td class="header">' + getLogoHtml() + '<h1>Appointment Cancelled</h1><p>Payment was made — doctor will not be paid</p></td></tr>' +
'<tr><td class="content">' +
'<h2 class="greeting">Hello Dr. ' + recipientName + ',</h2>' +
'<p class="text">Your appointment with patient <strong>' + patientName + '</strong> has been cancelled. Since the appointment was not completed, you will <strong>not</strong> receive the consultation fee for this session.</p>' +
'<div class="card">' +
'<h4 class="card-title">Appointment Summary</h4>' +
'<div class="row"><span class="label">Patient</span><span class="value">' + patientName + '</span></div>' +
'<div class="row"><span class="label">Consultation Fee</span><span class="value" style="font-size:20px;font-weight:800;color:#dc2626;">&#x20B9;' + amount.toFixed(2) + '</span></div>' +
(reason ? '<div class="row" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e2e8f0;"><span class="label">Cancellation Reason</span><span class="value" style="font-weight:400;font-style:italic;">' + reason + '</span></div>' : '') +
'</div>' +
'<div class="admin-alert" style="background-color:#fef2f2;border-color:#fecaca;border:1px solid;border-radius:8px;padding:16px;margin-bottom:20px;"><h4 style="color:#991b1b;margin:0 0 8px 0;">No Payout</h4><p style="color:#991b1b;font-size:14px;margin:0;">The consultation fee was paid by the patient but since the appointment was cancelled before completion, this amount will not be transferred to you. If applicable, the patient will receive a refund.</p></div>' +
'<p class="text" style="font-size:13px;color:#94a3b8;margin-top:30px;">If you have any questions, please contact the admin team.</p>' +
'</td></tr></table>' +
'<div class="footer"><p>AuraSutra Healthcare Platform</p><p>This is an automated message, please do not reply.</p><p style="margin-top:8px;">-by Team AuraSutra</p></div>' +
'</td></tr></table>' +
'</body></html>';
}
