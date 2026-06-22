import { Job } from 'bullmq';
import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { getAdapter } from '@/modules/servers/serverService';
import { HashingStream } from '@/lib/hashStream';
import { markRunning, updateProgress, markDone, markFailed } from '@/modules/jobs/jobService';
import { notifyJobOutcome } from '@/modules/notifications/notificationService';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';
import type { ExportJobData } from '@/queue/types';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportProcessor(job: Job<ExportJobData>): Promise<void> {
  const { jobId, tenantId, serverId, database, table, format } = job.data;
  const adapter = await getAdapter(serverId, tenantId, database);
  try {
    await markRunning(jobId);
    await updateProgress(jobId, 10, `Exporting ${database}.${table} as ${format}`);

    const ext = format;
    const key = `tenants/${tenantId}/exports/${jobId}/${table}.${ext}`;
    const hasher = new HashingStream();
    let storagePromise: Promise<{ uri: string; size: number }>;

    if (format === 'sql') {
      const { stream, done } = await adapter.dump({ database, tables: [table] });
      stream.pipe(hasher);
      storagePromise = getStorage().put(key, hasher);
      await done;
    } else {
      const { columns, rows } = await adapter.readTable({ database, table });
      const passthrough = new PassThrough();
      passthrough.pipe(hasher);
      storagePromise = getStorage().put(key, hasher);

      if (format === 'csv') {
        passthrough.write(columns.map((c) => csvCell(c.name)).join(',') + '\n');
        let n = 0;
        for await (const row of rows) {
          passthrough.write(columns.map((c) => csvCell(row[c.name])).join(',') + '\n');
          if (++n % 5000 === 0) await updateProgress(jobId, 50, `Exported ${n} rows`);
        }
        passthrough.end();
      } else {
        // xlsx streaming
        const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passthrough });
        const ws = wb.addWorksheet(table);
        ws.addRow(columns.map((c) => c.name)).commit();
        let n = 0;
        for await (const row of rows) {
          ws.addRow(columns.map((c) => row[c.name] ?? null)).commit();
          if (++n % 5000 === 0) await updateProgress(jobId, 50, `Exported ${n} rows`);
        }
        await ws.commit();
        await wb.commit();
      }
    }

    const put = await storagePromise;
    const checksum = hasher.digest();
    const size = BigInt(hasher.bytes || put.size);

    const artifact = await prisma.backup.create({
      data: {
        tenantId,
        serverId,
        jobId,
        database,
        format: format === 'sql' ? 'sql' : format === 'csv' ? 'csv' : 'xlsx',
        status: 'available',
        size,
        storageUri: put.uri,
        checksum,
      },
    });

    await markDone(jobId, { artifactId: artifact.id, storageUri: put.uri, size: Number(size) });
    await audit({ tenantId, action: 'export.completed', target: `server:${serverId}`, meta: { database, table, format, artifactId: artifact.id } });
    await notifyJobOutcome(jobId, true, `Export of ${database}.${table} completed.`);
  } catch (err) {
    logger.error({ err, jobId }, 'export failed');
    await markFailed(jobId, (err as Error).message);
    await audit({ tenantId, action: 'export.failed', target: `server:${serverId}`, meta: { database, table, error: (err as Error).message } });
    await notifyJobOutcome(jobId, false, `Export failed: ${(err as Error).message}`);
    throw err;
  } finally {
    await adapter.close();
  }
}
