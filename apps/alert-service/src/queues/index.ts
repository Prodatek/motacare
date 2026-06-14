import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

// ============================================================
// REDIS CONNECTION
// Shared across all queues in this service.
// maxRetriesPerRequest: null is required by BullMQ.
// ============================================================

export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('[redis] Connection error:', err.message);
});

// ============================================================
// QUEUE NAMES
// ============================================================

export const QUEUE_NAMES = {
  FIX_JOB_ALERTS: 'fix-job-alerts',
  EMAIL_SEND: 'email-send',
} as const;

// ============================================================
// JOB DATA TYPES
// ============================================================

export interface FixJobAlertJobData {
  fixJobId: string;
  alertType: '24h' | '1h' | 'overdue';
  vehicleHash: string;
  fixerId: string;
  ownerId: string;
  estimatedCompletionAt: string; // ISO string
  description: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ============================================================
// QUEUES
// ============================================================

// Alert scheduler queue — jobs are delayed and fire at the right time
export const fixJobAlertsQueue = new Queue<FixJobAlertJobData>(
  QUEUE_NAMES.FIX_JOB_ALERTS,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  },
);

// Email send queue — decoupled from alert logic so email failures
// don't block the alert system
export const emailQueue = new Queue<EmailJobData>(
  QUEUE_NAMES.EMAIL_SEND,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    },
  },
);

// ============================================================
// ALERT SCHEDULER
// Called when a fix job is created or its estimated completion
// time is updated. Schedules delayed BullMQ jobs.
// ============================================================

export async function scheduleFixJobAlerts(
  fixJobId: string,
  estimatedCompletionAt: Date,
  data: Omit<FixJobAlertJobData, 'alertType'>,
): Promise<void> {
  const now = Date.now();
  const completionTime = estimatedCompletionAt.getTime();

  // Remove any existing scheduled alerts for this job
  await removeFixJobAlerts(fixJobId);

  const schedule = [
    { alertType: '24h' as const, fireAt: completionTime - env.ALERT_THRESHOLD_24H_MS },
    { alertType: '1h'  as const, fireAt: completionTime - env.ALERT_THRESHOLD_1H_MS },
    { alertType: 'overdue' as const, fireAt: completionTime + 30 * 60 * 1000 }, // 30min after due
  ];

  for (const { alertType, fireAt } of schedule) {
    const delay = fireAt - now;
    // Only schedule future alerts
    if (delay > 0) {
      await fixJobAlertsQueue.add(
        `${fixJobId}:${alertType}`,
        { ...data, fixJobId, alertType },
        {
          delay,
          jobId: `alert:${fixJobId}:${alertType}`, // deterministic ID prevents duplicates
        },
      );
      console.log(
        `[alerts] Scheduled ${alertType} alert for job ${fixJobId} ` +
        `in ${Math.round(delay / 1000 / 60)}min`,
      );
    }
  }
}

// Remove all scheduled alerts for a fix job (e.g. when job is completed early)
export async function removeFixJobAlerts(fixJobId: string): Promise<void> {
  const alertTypes: Array<'24h' | '1h' | 'overdue'> = ['24h', '1h', 'overdue'];
  for (const alertType of alertTypes) {
    try {
      const job = await fixJobAlertsQueue.getJob(`alert:${fixJobId}:${alertType}`);
      if (job) await job.remove();
    } catch {
      // Job may not exist — that's fine
    }
  }
}