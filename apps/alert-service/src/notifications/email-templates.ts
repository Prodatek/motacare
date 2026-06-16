import { env } from '../config/env';

// ============================================================
// EMAIL TEMPLATES
// All emails are plain HTML — no external template engine
// needed at this stage. Each function returns { subject, html, text }.
// ============================================================

interface AlertEmailData {
  recipientName: string;
  role: 'fixer' | 'owner';
  alertType: '24h' | '1h' | 'overdue';
  fixJobId: string;
  vehicleDescription: string; // e.g. "2019 Toyota Camry – LAG-001-AA"
  jobDescription: string;
  estimatedCompletionAt: Date;
}

export function buildAlertEmail(data: AlertEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { recipientName, role, alertType, fixJobId, vehicleDescription, estimatedCompletionAt } = data;
  const jobUrl = `${env.APP_URL}/dashboard/fix-jobs/${fixJobId}`;
  const formattedDate = estimatedCompletionAt.toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const subjects: Record<string, Record<string, string>> = {
    '24h':     { fixer: `⏰ Reminder: Fix job due tomorrow`, owner: `📋 Your car service is due tomorrow` },
    '1h':      { fixer: `🚨 Fix job due in 1 hour`, owner: `🔧 Your car service is almost done` },
    'overdue': { fixer: `⚠️ Fix job is overdue`, owner: `⚠️ Service update needed for your vehicle` },
  };

  const subject = subjects[alertType]?.[role] ?? 'Motacare Update';

  const heading: Record<string, Record<string, string>> = {
    '24h':     { fixer: 'Job due tomorrow', owner: 'Service reminder' },
    '1h':      { fixer: 'Job due in 1 hour', owner: 'Almost ready' },
    'overdue': { fixer: 'This job is overdue', owner: 'Service update needed' },
  };

  const bodyText: Record<string, Record<string, string>> = {
    '24h': {
      fixer: `This is a reminder that the fix job for <strong>${vehicleDescription}</strong> is due tomorrow — ${formattedDate}.`,
      owner: `Your vehicle <strong>${vehicleDescription}</strong> is scheduled for service completion tomorrow — ${formattedDate}.`,
    },
    '1h': {
      fixer: `The fix job for <strong>${vehicleDescription}</strong> is due in approximately 1 hour — ${formattedDate}.`,
      owner: `Your vehicle <strong>${vehicleDescription}</strong> service is expected to complete within the hour.`,
    },
    'overdue': {
      fixer: `The fix job for <strong>${vehicleDescription}</strong> was due at ${formattedDate} and has not been marked complete. Please update the status.`,
      owner: `Your vehicle <strong>${vehicleDescription}</strong> service was due at ${formattedDate}. We are following up with your workshop.`,
    },
  };

  const body = bodyText[alertType]?.[role] ?? '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">🔧 Motacare</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${heading[alertType]?.[role]}</h2>
            <p style="margin:0 0 16px;color:#374151;line-height:1.6;">Hi ${recipientName},</p>
            <p style="margin:0 0 24px;color:#374151;line-height:1.6;">${body}</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#2563eb;border-radius:8px;padding:12px 24px;">
                  <a href="${jobUrl}" style="color:#ffffff;font-weight:600;text-decoration:none;font-size:14px;">
                    View Fix Job →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Motacare by Prodatek. You're receiving this because you have an active fix job.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${heading[alertType]?.[role]}\n\nHi ${recipientName},\n\n${body.replace(/<[^>]+>/g, '')}\n\nView Fix Job: ${jobUrl}\n\nMotacare by Prodatek`;

  return { subject, html, text };
}