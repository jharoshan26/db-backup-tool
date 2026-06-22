import { prisma } from '@/lib/prisma';
import type { PermissionKey } from './permissions';

/** Resolve the effective permission set for a user (union across assigned roles). */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });
  const perms = new Set<string>();
  for (const a of assignments) {
    for (const rp of a.role.permissions) perms.add(rp.permissionKey);
  }
  return perms;
}

export function hasPermission(perms: Set<string>, required: PermissionKey): boolean {
  return perms.has(required);
}
