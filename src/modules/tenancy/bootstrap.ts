import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/auth/password';
import { PERMISSIONS, SYSTEM_ROLES } from '@/auth/permissions';
import { Conflict } from '@/lib/errors';
import { audit } from '@/audit/audit';

/** Idempotently ensure all permission rows exist. Run at startup. */
export async function ensurePermissions(): Promise<void> {
  await prisma.$transaction(
    Object.entries(PERMISSIONS).map(([key, description]) =>
      prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } }),
    ),
  );
}

/** Create the default system roles for a tenant with their permission bundles. */
export async function createSystemRoles(tenantId: string): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};
  for (const [roleName, perms] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: roleName,
        isSystem: true,
        permissions: { create: perms.map((p) => ({ permissionKey: p })) },
      },
    });
    roleIds[roleName] = role.id;
  }
  return roleIds;
}

export interface RegisterInput {
  tenantName: string;
  email: string;
  password: string;
  name?: string;
}

/** Bootstrap a new tenant with its owner user. Transactional. */
export async function registerTenant(input: RegisterInput) {
  await ensurePermissions();

  const existing = await prisma.user.findFirst({ where: { email: input.email } });
  if (existing) throw Conflict('A user with this email already exists');

  const slug = input.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `t-${Date.now()}`;
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: input.tenantName, slug: `${slug}-${Date.now().toString(36)}` } });

    const ownerRole = await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Owner',
        isSystem: true,
        permissions: { create: SYSTEM_ROLES.Owner.map((p) => ({ permissionKey: p })) },
      },
    });
    for (const [roleName, perms] of Object.entries(SYSTEM_ROLES)) {
      if (roleName === 'Owner') continue;
      await tx.role.create({
        data: { tenantId: tenant.id, name: roleName, isSystem: true, permissions: { create: perms.map((p) => ({ permissionKey: p })) } },
      });
    }

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        name: input.name,
        passwordHash,
        roles: { create: { roleId: ownerRole.id } },
      },
    });

    return { tenant, user };
  });

  await audit({
    tenantId: result.tenant.id,
    actorId: result.user.id,
    actorEmail: result.user.email,
    action: 'tenant.registered',
    target: `tenant:${result.tenant.id}`,
    meta: { tenantName: input.tenantName },
  });

  return result;
}
