import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/** Canonical serialization for hashing — stable key order. */
function canonical(entry: AuditEntry, prevHash: string, createdAt: string): string {
  return JSON.stringify({
    tenantId: entry.tenantId,
    actorId: entry.actorId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    meta: entry.meta ?? {},
    createdAt,
    prevHash,
  });
}

/**
 * Append a tamper-evident audit record. Each entry chains to the previous entry's hash
 * for the tenant: hash = SHA256(prevHash || canonical(entry)).
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const prev = await prisma.auditLog.findFirst({
      where: { tenantId: entry.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    const prevHash = prev?.hash ?? 'GENESIS';
    const createdAt = new Date().toISOString();
    const hash = sha256(prevHash + canonical(entry, prevHash, createdAt));
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        target: entry.target ?? null,
        meta: (entry.meta ?? {}) as object,
        ip: entry.ip ?? null,
        prevHash,
        hash,
      },
    });
  } catch (err) {
    // Auditing must never crash the request path, but failures must be visible.
    logger.error({ err, action: entry.action }, 'failed to write audit log');
  }
}

/** Verify the integrity of a tenant's audit chain. Returns the first broken record id, if any. */
export async function verifyAuditChain(tenantId: string): Promise<{ ok: boolean; brokenAt?: string }> {
  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
  let prevHash = 'GENESIS';
  for (const log of logs) {
    const expected = sha256(
      prevHash +
        canonical(
          {
            tenantId: log.tenantId,
            actorId: log.actorId,
            action: log.action,
            target: log.target,
            meta: log.meta as Record<string, unknown>,
          },
          prevHash,
          log.createdAt.toISOString(),
        ),
    );
    if (expected !== log.hash || log.prevHash !== prevHash) {
      return { ok: false, brokenAt: log.id };
    }
    prevHash = log.hash;
  }
  return { ok: true };
}
