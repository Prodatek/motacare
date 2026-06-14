import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import {
  redisConnection, emailQueue,
  QUEUE_NAMES,
  type FixJobAlertJobData, type EmailJobData,
} from '../queues';
import { env } from '../config/env';
import { buildAlertEmail } from '../notifications/email-templates';

// ============================================================
// EMAIL TRANSPORTER
// ============================================================

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// ============================================================
// HELPER — resolve user email from auth-service
// ============================================================

async function resolveUserEmail(userId: string): Promise<{
  email: string;
  firstName: string;
} | null> {
  try {
    const res = await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { email: string; firstName: string } };
    return data.data;
  } catch {
    return null;
  }
}

// ============================================================
// ALERT WORKER
// Processes delayed fix-job-alerts jobs.
// For each alert: resolves fixer + owner emails, enqueues
// email jobs for both, marks the alert flag on the fix job.
// ============================================================

export const alertWorker = new Worker<FixJobAlertJobData>(
  QUEUE_NAMES.FIX_JOB_ALERTS,
  async (job) => {
    const { fixJobId, alertType, fixerId, ownerId, vehicleHash, description, estimatedCompletionAt } = job.data;

    console.log(`[alert-worker] Processing ${alertType} alert for fix job ${fixJobId}`);

    // Resolve user details
    const [fixer, owner] = await Promise.all([
      resolveUserEmail(fixerId),
      resolveUserEmail(ownerId),
    ]);

    const vehicleDescription = vehicleHash.slice(0, 8) + '…'; // Best effort — Phase 3 resolves full name

    // Queue emails for both fixer and owner
    const emailJobs = [];

    if (fixer) {
      const { subject, html, text } = buildAlertEmail({
        recipientName: fixer.firstName,
        role: 'fixer',
        alertType,
        fixJobId,
        vehicleDescription,
        jobDescription: description,
        estimatedCompletionAt: new Date(estimatedCompletionAt),
      });
      emailJobs.push(emailQueue.add(`fixer-${fixJobId}-${alertType}`, {
        to: fixer.email, subject, html, text,
      }));
    }

    if (owner) {
      const { subject, html, text } = buildAlertEmail({
        recipientName: owner.firstName,
        role: 'owner',
        alertType,
        fixJobId,
        vehicleDescription,
        jobDescription: description,
        estimatedCompletionAt: new Date(estimatedCompletionAt),
      });
      emailJobs.push(emailQueue.add(`owner-${fixJobId}-${alertType}`, {
        to: owner.email, subject, html, text,
      }));
    }

    await Promise.all(emailJobs);

    // Mark alert as sent on the fix job (fire-and-forget to fix-jobs service)
    const flagField = alertType === '24h' ? 'alertSent24h' :
                      alertType === '1h'  ? 'alertSent1h'  : 'alertSentOverdue';

    fetch(`${env.FIX_JOBS_SERVICE_URL}/fix-jobs/${fixJobId}/internal/mark-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: flagField }),
    }).catch((err) => console.warn('[alert-worker] Failed to mark alert flag:', err));

    console.log(`[alert-worker] ✅ ${alertType} alert sent for job ${fixJobId}`);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

// ============================================================
// EMAIL WORKER
// Processes the email-send queue — sends via Nodemailer.
// Decoupled from alert logic so email failures don't affect
// alert scheduling or the alert flag tracking.
// ============================================================

export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL_SEND,
  async (job) => {
    const { to, subject, html, text } = job.data;

    await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[email-worker] ✅ Sent "${subject}" to ${to}`);
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

// Worker error handlers
alertWorker.on('failed', (job, err) => {
  console.error(`[alert-worker] Job ${job?.id} failed:`, err.message);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
});