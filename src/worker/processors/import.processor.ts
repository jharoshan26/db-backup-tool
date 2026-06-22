import { Job } from 'bullmq';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';
import { getStorage } from '@/lib/storage';
import { getAdapter } from '@/modules/servers/serverService';
import { markRunning, updateProgress, markDone, markFailed } from '@/modules/jobs/jobService';
import { notifyJobOutcome } from '@/modules/notifications/notificationService';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';
import type { ImportJobData } from '@/queue/types';

const BATCH = 500;

export async function importProcessor(job: Job<ImportJobData>): Promise<void> {
  const { jobId, tenantId, serverId, database, table, format, fileKey, options } = job.data;
  const adapter = await getAdapter(serverId, tenantId, database);
  try {
    await markRunning(jobId);
    await updateProgress(jobId, 10, `Importing into ${database}.${table}`);

    const file = await getStorage().get(fileKey);
    let total = 0;

    if (format === 'csv') {
      total = await importCsv(file, adapter, database, table, jobId);
    } else {
      total = await importXlsx(file, adapter, database, table, jobId);
    }

    await markDone(jobId, { rowsImported: total });
    await audit({ tenantId, action: 'import.completed', target: `server:${serverId}`, meta: { database, table, rows: total } });
    await notifyJobOutcome(jobId, true, `Imported ${total} rows into ${database}.${table}.`);
  } catch (err) {
    logger.error({ err, jobId }, 'import failed');
    await markFailed(jobId, (err as Error).message);
    await audit({ tenantId, action: 'import.failed', target: `server:${serverId}`, meta: { database, table, error: (err as Error).message } });
    await notifyJobOutcome(jobId, false, `Import failed: ${(err as Error).message}`);
    throw err;
  } finally {
    await adapter.close();
  }
  void options;
}

async function importCsv(
  file: Readable,
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  database: string,
  table: string,
  jobId: string,
): Promise<number> {
  const parser = file.pipe(parse({ columns: false, skip_empty_lines: true, trim: true }));
  let header: string[] | null = null;
  let batch: unknown[][] = [];
  let total = 0;

  for await (const record of parser as AsyncIterable<string[]>) {
    if (!header) {
      header = record;
      continue;
    }
    batch.push(record);
    if (batch.length >= BATCH) {
      total += await adapter.insertRows(database, table, header, batch);
      batch = [];
      await updateProgress(jobId, 50, `Imported ${total} rows`);
    }
  }
  if (header && batch.length) total += await adapter.insertRows(database, table, header, batch);
  return total;
}

async function importXlsx(
  file: Readable,
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  database: string,
  table: string,
  jobId: string,
): Promise<number> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {});
  let header: string[] | null = null;
  let batch: unknown[][] = [];
  let total = 0;

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      const values = (row.values as unknown[]).slice(1); // exceljs is 1-indexed
      if (!header) {
        header = values.map((v) => String(v));
        continue;
      }
      batch.push(values);
      if (batch.length >= BATCH) {
        total += await adapter.insertRows(database, table, header, batch);
        batch = [];
        await updateProgress(jobId, 50, `Imported ${total} rows`);
      }
    }
    break; // first worksheet only
  }
  if (header && batch.length) total += await adapter.insertRows(database, table, header, batch);
  return total;
}
