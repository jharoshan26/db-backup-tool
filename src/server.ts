import { createApp } from '@/api/server';
import { config } from '@/config';
import { logger } from '@/lib/logger';
import { disconnectPrisma } from '@/lib/prisma';
import { ensurePermissions } from '@/modules/tenancy/bootstrap';

async function main(): Promise<void> {
  // Ensure the permission catalog exists before serving traffic.
  await ensurePermissions().catch((err) => logger.warn({ err }, 'ensurePermissions failed (continuing)'));

  const app = createApp();
  const server = app.listen(config.api.port, () => {
    logger.info({ port: config.api.port, env: config.env }, 'API server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down API');
    server.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'API failed to start');
  process.exit(1);
});
