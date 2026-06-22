import { JobType, JobStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publishProgress } from '@/queue';

export async function createJob(params: {
  tenantId: string;
  type: JobType;
  actorId?: string | null;
  scheduleId?: string | null;
  params: Record<string, unknown>;
}) {
  return prisma.job.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      actorId: params.actorId ?? null,
      scheduleId: params.scheduleId ?? null,
      params: params.params as Prisma.InputJsonValue,
      status: 'queued',
    },
  });
}

export async function markRunning(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), progress: 0 },
  });
  await emit(jobId, 'running', 0, 'Job started');
}

export async function updateProgress(jobId: string, progress: number, message?: string): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await prisma.job.update({ where: { id: jobId }, data: { progress: clamped } });
  await emit(jobId, 'running', clamped, message);
}

export async function markDone(jobId: string, result?: Record<string, unknown>): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'done', progress: 100, finishedAt: new Date(), result: (result ?? {}) as Prisma.InputJsonValue },
  });
  await emit(jobId, 'done', 100, 'Completed', result);
}

export async function markFailed(jobId: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'failed', finishedAt: new Date(), error: error.slice(0, 2000) },
  });
  await emit(jobId, 'failed', undefined, error);
}

async function emit(
  jobId: string,
  status: JobStatus | string,
  progress?: number,
  message?: string,
  result?: unknown,
): Promise<void> {
  await prisma.jobEvent.create({
    data: { jobId, level: status === 'failed' ? 'error' : 'info', message: message ?? status, progress: progress ?? null },
  });
  await publishProgress({
    jobId,
    status: String(status),
    progress: progress ?? 0,
    message,
    result,
    error: status === 'failed' ? message : undefined,
  });
}
