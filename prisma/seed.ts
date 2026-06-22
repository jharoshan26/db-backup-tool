import { prisma } from '../src/lib/prisma';
import { ensurePermissions, registerTenant } from '../src/modules/tenancy/bootstrap';
import { logger } from '../src/lib/logger';

/**
 * Seed a demo tenant + owner for local development.
 *   email: admin@example.com   password: ChangeMe123!
 */
async function main(): Promise<void> {
  await ensurePermissions();

  const existing = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });
  if (existing) {
    logger.info('Seed: demo admin already exists, skipping');
    return;
  }

  const { tenant, user } = await registerTenant({
    tenantName: 'Demo Org',
    email: 'admin@example.com',
    password: 'ChangeMe123!',
    name: 'Demo Admin',
  });
  logger.info({ tenantId: tenant.id, userId: user.id }, 'Seed: created demo tenant + owner (admin@example.com / ChangeMe123!)');
}

main()
  .catch((err) => {
    logger.error({ err }, 'seed failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
