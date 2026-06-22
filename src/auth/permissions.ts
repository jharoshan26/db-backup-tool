/** Canonical permission catalog. Keys are `<resource>:<action>`. */
export const PERMISSIONS = {
  'server:read': 'View database servers',
  'server:create': 'Create database servers',
  'server:update': 'Update database servers',
  'server:delete': 'Delete database servers',
  'server:manage': 'Manage database servers (UI aggregate)',
  'backup:read': 'View backups',
  'backup:run': 'Run backups',
  'backup:create': 'Create backups (UI alias of backup:run)',
  'backup:delete': 'Delete backups',
  'restore:run': 'Restore backups',
  'export:run': 'Export tables',
  'import:run': 'Import data',
  'clone:run': 'Clone / migrate databases',
  'schedule:manage': 'Manage backup schedules',
  'job:read': 'View jobs',
  'job:cancel': 'Cancel jobs',
  'audit:read': 'Read audit log',
  'user:manage': 'Manage users and roles',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

/** Default system roles and their bundled permissions. */
export const SYSTEM_ROLES: Record<string, PermissionKey[]> = {
  Owner: ALL_PERMISSIONS,
  Admin: ALL_PERMISSIONS,
  Operator: [
    'server:read',
    'backup:read',
    'backup:run',
    'backup:create',
    'restore:run',
    'export:run',
    'import:run',
    'clone:run',
    'schedule:manage',
    'job:read',
    'job:cancel',
  ],
  Viewer: ['server:read', 'backup:read', 'job:read', 'audit:read'],
};
