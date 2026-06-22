import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * Renders children only when the current user holds every listed permission.
 * Use `any` to require at least one of the listed permissions instead.
 */
export function PermissionGate({
  permission,
  any,
  fallback = null,
  children,
}: {
  permission?: string | string[];
  any?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!permission) return <>{children}</>;

  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed = any ? perms.some(hasPermission) : perms.every(hasPermission);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
