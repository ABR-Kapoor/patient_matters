import { Platform } from 'react-native';
import { globalShowToast, globalShowAlert } from './NotificationContext';
import * as ExpoFileSystem from 'expo-file-system';
const FileSystem: any = ExpoFileSystem;
import { APP_LOGO_BASE64 } from './logoBase64';

// Lazily load expo-print so that if the native binary was built
// before these packages were added, the JS bundle does not crash at startup.
let Print: typeof import('expo-print') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Print = require('expo-print');
} catch (err) {
  // ExpoPrint native module not linked yet in the current APK/binary
}

let Sharing: typeof import('expo-sharing') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sharing = require('expo-sharing');
} catch (err) {
  // ExpoSharing fallback
}

/**
 * Saves a generated PDF URI directly into the device's storage (e.g. Downloads).
 */
async function savePdfToDevice(sourceUri: string, suggestedFilename: string): Promise<boolean> {
  try {
    // If sharing is available, sharing allows instant save to device, Drive, Files, or download
    if (Sharing && (await Sharing.isAvailableAsync().catch(() => false))) {
      const destUri = FileSystem?.documentDirectory 
        ? `${FileSystem.documentDirectory}${suggestedFilename}` 
        : sourceUri;
      
      if (FileSystem?.copyAsync && destUri !== sourceUri) {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri }).catch(() => {});
      }

      await Sharing.shareAsync(destUri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Save or Share ${suggestedFilename}`,
      });
      if (globalShowToast) { 
        globalShowToast('PDF Ready', `${suggestedFilename} opened for saving.`); 
      }
      return true;
    }

    if (Platform.OS === 'android') {
      const { StorageAccessFramework } = FileSystem || {};
      if (StorageAccessFramework) {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync().catch(() => null);
        if (permissions?.granted) {
          const base64Data = await FileSystem.readAsStringAsync(sourceUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const createdUri = await StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            suggestedFilename,
            'application/pdf'
          );
          await FileSystem.writeAsStringAsync(createdUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (globalShowToast) { 
            globalShowToast('Download Complete', `${suggestedFilename} saved successfully.`); 
          } else if (globalShowAlert) { 
            globalShowAlert('Download Complete', `${suggestedFilename} has been saved.`); 
          }
          return true;
        }
      }
    }

    // Fallback: save to documentDirectory
    if (FileSystem?.documentDirectory) {
      const destUri = `${FileSystem.documentDirectory}${suggestedFilename}`;
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      if (globalShowToast) { 
        globalShowToast('PDF Downloaded', `Saved: ${suggestedFilename}`); 
      } else if (globalShowAlert) { 
        globalShowAlert('Downloaded', `Saved: ${suggestedFilename}`); 
      }
      return true;
    }

    if (globalShowToast) { 
      globalShowToast('PDF Downloaded', `Saved: ${suggestedFilename}`); 
    }
    return true;
  } catch (err: any) {
    console.error('savePdfToDevice error:', err);
    if (err?.message?.includes?.('User cancelled') || err?.message?.includes?.('canceled')) {
      return false;
    }
    if (globalShowAlert) { 
      globalShowAlert('Save Failed', 'Unable to save the file to device storage.'); 
    }
    return false;
  }
}

export async function downloadPrescriptionPdf(prescription: any) {
  try {
    const doctorObj = prescription.doctors || {};
    const doctorUser = doctorObj.users || {};
    const doctorName = doctorUser.name || 'Healthcare Practitioner';
    const doctorSpecialization = doctorObj.specialization || 'Medical Specialist';
    const doctorQualification = doctorObj.qualification ? ` • ${doctorObj.qualification}` : '';
    const doctorExperience = doctorObj.yearsOfExperience ? ` • ${doctorObj.yearsOfExperience} yrs experience` : '';
    const doctorAbout = doctorObj.about || doctorObj.bio || 'Dedicated medical professional delivering high quality, patient-centered care and treatment.';

    const dateStr = new Date(prescription.created_at || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const diagnosis = prescription.diagnosis || 'Clinical evaluation and routine medical checkup.';
    const medicines = prescription.medicines || [];

    const medicinesRows = medicines.length > 0 ? medicines.map((m: any, index: number) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 10px; font-weight: 600; color: #111827;">${index + 1}. ${m.name || 'Medicine'}</td>
        <td style="padding: 12px 10px; color: #374151;">${m.dosage || '-'}</td>
        <td style="padding: 12px 10px; color: #374151;">${m.frequency || '-'}</td>
        <td style="padding: 12px 10px; color: #374151;">${m.duration || '-'}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="4" style="padding: 18px; text-align: center; color: #6b7280;">No medications prescribed.</td>
      </tr>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Prescription - aurasutra</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 36px 40px; 
            color: #111827; 
            background-color: #ffffff;
            margin: 0;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 2px solid #048256; 
            padding-bottom: 18px; 
            margin-bottom: 24px; 
          }
          .brand-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-img {
            width: 58px;
            height: 58px;
            object-fit: contain;
          }
          .logo-title { 
            font-size: 26px; 
            font-weight: 800; 
            color: #15803d; 
            letter-spacing: -0.5px;
            line-height: 1.1;
          }
          .tagline { 
            font-size: 13px; 
            color: #4b5563; 
            margin-top: 3px;
            font-weight: 500;
          }
          .meta-right {
            text-align: right;
            font-size: 13px;
            color: #6b7280;
          }
          .meta-pill {
            display: inline-block;
            background: #ecfdf5;
            color: #047857;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 9999px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          
          /* Doctor Header Banner */
          .doctor-banner {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 5px solid #059669;
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 24px;
          }
          .doctor-name-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .doctor-specs {
            font-size: 13px;
            font-weight: 600;
            color: #059669;
            margin-bottom: 8px;
          }
          .doctor-about {
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
          }

          .section { margin-bottom: 24px; }
          .section-title { 
            font-size: 15px; 
            font-weight: 700; 
            color: #1e293b; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 6px; 
            margin-bottom: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .diagnosis-box { 
            background: #f0fdf4; 
            border: 1px solid #bbf7d0; 
            padding: 14px 18px; 
            border-radius: 8px; 
            font-size: 14px; 
            color: #166534; 
            line-height: 1.5;
          }
          
          table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; }
          th { background: #f1f5f9; padding: 10px 10px; font-weight: 600; color: #334155; }
          
          /* Footer */
          .footer-container { 
            margin-top: 50px; 
            border-top: 2px solid #e2e8f0; 
            padding-top: 18px; 
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .footer-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .footer-logo {
            width: 32px;
            height: 32px;
            object-fit: contain;
          }
          .footer-text {
            font-size: 12.5px;
            color: #475569;
            line-height: 1.4;
          }
          .footer-link {
            color: #059669;
            font-weight: 700;
            text-decoration: none;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="brand-left">
            <img class="logo-img" src="${APP_LOGO_BASE64}" alt="aurasutra Logo" />
            <div>
              <div class="logo-title">aurasutra</div>
              <div class="tagline">Official Digital Healthcare Prescription</div>
            </div>
          </div>
          <div class="meta-right">
            <div><span class="meta-pill">Verified Rx</span></div>
            <div style="font-size: 14px; font-weight: 600; color: #111827;">${dateStr}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Ref: #${String(prescription.prescription_id || '').slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <!-- Doctor Information & About in Header -->
        <div class="doctor-banner">
          <div class="doctor-name-title">Dr. ${doctorName}</div>
          <div class="doctor-specs">${doctorSpecialization}${doctorQualification}${doctorExperience}</div>
          <div class="doctor-about"><strong>About:</strong> ${doctorAbout}</div>
        </div>

        <!-- Clinical Diagnosis -->
        <div class="section">
          <div class="section-title">Clinical Diagnosis & Notes</div>
          <div class="diagnosis-box">${diagnosis}</div>
        </div>

        <!-- Prescribed Medications -->
        <div class="section">
          <div class="section-title">Prescribed Medications</div>
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${medicinesRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer-container">
          <div class="footer-brand">
            <img class="footer-logo" src="${APP_LOGO_BASE64}" alt="aurasutra" />
            <div class="footer-text">
              <strong>aurasutra</strong> is an AI-powered healthcare & telemedicine platform.
              <br/>
              Valid without physical signature. For inquiries, visit <a class="footer-link" href="https://aurasutra.org">aurasutra.org</a>.
            </div>
          </div>
          <div style="text-align: right;">
            <a class="footer-link" href="https://aurasutra.org">aurasutra.org</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const cleanDocName = doctorName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Prescription_Dr_${cleanDocName}_${Date.now()}.pdf`;

    if (Print && Print.printToFileAsync) {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await savePdfToDevice(uri, filename);
    } else {
      // If native ExpoPrint is missing in the current build, inform the user clearly
      if (globalShowAlert) { globalShowAlert('Feature Unavailable', 'PDF printing requires a native build update.'); }
    }
  } catch (error: any) {
    console.error('Failed to generate prescription PDF:', error);
    if (globalShowAlert) { globalShowAlert('Download Error', 'Could not generate prescription. Please try again.'); }
  }
}

export async function downloadMedicationSchedulePdf(adherence: any, stats: any) {
  try {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const pending = adherence?.pending || [];
    const taken = adherence?.taken || [];
    const skipped = adherence?.skipped || [];
    const all = adherence?.all || [...pending, ...taken, ...skipped];

    const allRows = all.length > 0 ? all.map((item: any, idx: number) => {
      const isTaken = item.is_taken || item.status === 'taken';
      const isSkipped = item.is_skipped || item.status === 'skipped';
      const statusText = isTaken ? 'Taken' : isSkipped ? 'Skipped' : 'Pending';
      const statusColor = isTaken ? '#16a34a' : isSkipped ? '#dc2626' : '#d97706';

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; font-weight: 600;">${idx + 1}. ${item.medicine_name || 'Medicine'}</td>
          <td style="padding: 10px 8px; color: #4b5563;">${item.dosage || '-'}</td>
          <td style="padding: 10px 8px; color: #4b5563;">${String(item.scheduled_time || '').substring(0, 5)}</td>
          <td style="padding: 10px 8px; color: #4b5563;">${String(item.scheduled_date || '').split('T')[0]}</td>
          <td style="padding: 10px 8px; font-weight: 600; color: ${statusColor};">${statusText}</td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="5" style="padding: 16px; text-align: center; color: #6b7280;">No medication records found.</td>
      </tr>
    `;

    const adherenceRate = stats?.adherence_rate ?? stats?.dailyPercentage ?? stats?.adherenceRate ?? 100;
    const totalDoses = stats?.total_doses ?? stats?.todayScheduled ?? all.length;
    const takenDoses = stats?.taken_doses ?? stats?.todayTaken ?? taken.length;
    const skippedDoses = stats?.todaySkipped ?? skipped.length;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Medication Adherence Schedule - aurasutra</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 36px 40px; 
            color: #111827; 
            background-color: #ffffff;
            margin: 0;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 2px solid #048256; 
            padding-bottom: 18px; 
            margin-bottom: 24px; 
          }
          .brand-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-img {
            width: 58px;
            height: 58px;
            object-fit: contain;
          }
          .logo-title { 
            font-size: 26px; 
            font-weight: 800; 
            color: #15803d; 
            letter-spacing: -0.5px;
            line-height: 1.1;
          }
          .tagline { 
            font-size: 13px; 
            color: #4b5563; 
            margin-top: 3px;
            font-weight: 500;
          }
          .stats-grid { display: flex; gap: 16px; margin-bottom: 24px; }
          .stat-card { flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; text-align: center; }
          .stat-val { font-size: 24px; font-weight: 700; color: #166534; }
          .stat-label { font-size: 12px; color: #4b5563; margin-top: 4px; }
          .section-title { font-size: 15px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px 8px; font-weight: 600; color: #334155; }
          .footer-container { 
            margin-top: 45px; 
            border-top: 2px solid #e2e8f0; 
            padding-top: 18px; 
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .footer-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .footer-logo {
            width: 32px;
            height: 32px;
            object-fit: contain;
          }
          .footer-text {
            font-size: 12.5px;
            color: #475569;
            line-height: 1.4;
          }
          .footer-link {
            color: #059669;
            font-weight: 700;
            text-decoration: none;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand-left">
            <img class="logo-img" src="${APP_LOGO_BASE64}" alt="aurasutra Logo" />
            <div>
              <div class="logo-title">aurasutra</div>
              <div class="tagline">Medication Adherence & Schedule Report</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 13px; color: #6b7280;">
            <div>Generated: <strong>${today}</strong></div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">${adherenceRate}%</div>
            <div class="stat-label">Adherence Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${takenDoses} / ${totalDoses}</div>
            <div class="stat-label">Doses Taken</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${skippedDoses}</div>
            <div class="stat-label">Skipped Doses</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${pending.length}</div>
            <div class="stat-label">Pending Doses</div>
          </div>
        </div>

        <div class="section-title">Schedule & Dose History</div>
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Time</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${allRows}
          </tbody>
        </table>

        <!-- Footer -->
        <div class="footer-container">
          <div class="footer-brand">
            <img class="footer-logo" src="${APP_LOGO_BASE64}" alt="aurasutra" />
            <div class="footer-text">
              <strong>aurasutra</strong> is an AI-powered healthcare & telemedicine platform.
              <br/>
              Keep this document for your personal health records. Visit <a class="footer-link" href="https://aurasutra.org">aurasutra.org</a>.
            </div>
          </div>
          <div style="text-align: right;">
            <a class="footer-link" href="https://aurasutra.org">aurasutra.org</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const filename = `Medication_Schedule_${Date.now()}.pdf`;
    if (Print && Print.printToFileAsync) {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await savePdfToDevice(uri, filename);
    } else {
      if (globalShowAlert) { globalShowAlert('Feature Unavailable', 'PDF printing requires a native build update.'); }
    }
  } catch (error: any) {
    console.error('Failed to generate medication schedule PDF:', error);
    if (globalShowAlert) { globalShowAlert('Download Error', 'Could not generate medication schedule. Please try again.'); }
  }
}
