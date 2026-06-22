import { getQueue, QUEUE_NAMES } from '@/queue';

interface ScheduleLike {
  id: string;
  tenantId: string;
  cron: string;
}

const repeatJobName = 'trigger';

function repeatKey(scheduleId: string): string {
  return `sched-${scheduleId}`;
}

/** Register a repeatable BullMQ job for a schedule's cron expression. */
export async function registerSchedule(schedule: ScheduleLike): Promise<void> {
  const q = getQueue(QUEUE_NAMES.schedule);
  // Remove any stale repeatable first to avoid duplicates on cron change.
  await safeRemove(schedule);
  await q.add(
    repeatJobName,
    { scheduleId: schedule.id, tenantId: schedule.tenantId },
    { repeat: { pattern: schedule.cron }, jobId: repeatKey(schedule.id) },
  );
}

/** Remove the repeatable job for a schedule. */
export async function removeSchedule(schedule: ScheduleLike): Promise<void> {
  await safeRemove(schedule);
}

async function safeRemove(schedule: ScheduleLike): Promise<void> {
  const q = getQueue(QUEUE_NAMES.schedule);
  try {
    await q.removeRepeatable(repeatJobName, { pattern: schedule.cron }, repeatKey(schedule.id));
  } catch {
    /* not present — ignore */
  }
}
