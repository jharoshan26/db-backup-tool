import { prisma } from '@/lib/prisma';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { createAdapter, ConnectionInfo, DbAdapter } from '@/db/adapters';
import { NotFound } from '@/lib/errors';

export interface ServerInput {
  name: string;
  engine: 'mysql' | 'mariadb' | 'postgres';
  host: string;
  port: number;
  sslMode?: 'disable' | 'require' | 'verify_full';
  username: string;
  password: string;
  database?: string;
}

/** Create a server together with its envelope-encrypted credential. */
export async function createServer(tenantId: string, input: ServerInput) {
  const enc = encryptSecret(input.password);
  return prisma.dbServer.create({
    data: {
      tenantId,
      name: input.name,
      engine: input.engine,
      host: input.host,
      port: input.port,
      sslMode: input.sslMode ?? 'disable',
      credential: {
        create: {
          username: input.username,
          ciphertext: enc.ciphertext,
          authTag: enc.authTag,
          iv: enc.iv,
          dekWrapped: enc.dekWrapped,
          keyVersion: enc.keyVersion,
          database: input.database,
        },
      },
    },
  });
}

export async function updateServerCredentialPassword(serverId: string, password: string) {
  const enc = encryptSecret(password);
  await prisma.credential.update({
    where: { serverId },
    data: {
      ciphertext: enc.ciphertext,
      authTag: enc.authTag,
      iv: enc.iv,
      dekWrapped: enc.dekWrapped,
      keyVersion: enc.keyVersion,
    },
  });
}

/**
 * Resolve a server (scoped to tenant) into a ConnectionInfo with the decrypted password.
 * The plaintext exists only in memory for the lifetime of the operation.
 */
export async function getConnectionInfo(
  serverId: string,
  tenantId: string,
  overrideDatabase?: string,
): Promise<ConnectionInfo> {
  const server = await prisma.dbServer.findFirst({
    where: { id: serverId, tenantId },
    include: { credential: true },
  });
  if (!server || !server.credential) throw NotFound('Server not found');
  const password = decryptSecret({
    ciphertext: server.credential.ciphertext,
    authTag: server.credential.authTag,
    iv: server.credential.iv,
    dekWrapped: server.credential.dekWrapped,
    keyVersion: server.credential.keyVersion,
  });
  return {
    engine: server.engine,
    host: server.host,
    port: server.port,
    username: server.credential.username,
    password,
    database: overrideDatabase ?? server.credential.database ?? undefined,
    sslMode: server.sslMode,
  };
}

/** Build a ready-to-use adapter for a server. Caller must call adapter.close(). */
export async function getAdapter(serverId: string, tenantId: string, database?: string): Promise<DbAdapter> {
  const conn = await getConnectionInfo(serverId, tenantId, database);
  return createAdapter(conn);
}
