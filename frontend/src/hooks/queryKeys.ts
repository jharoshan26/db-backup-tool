/** Centralised TanStack Query keys. */
export const qk = {
  me: ['me'] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  serverDatabases: (id: string) => ['servers', id, 'databases'] as const,
  backups: ['backups'] as const,
  backup: (id: string) => ['backups', id] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['jobs', id] as const,
  schedules: ['schedules'] as const,
  audit: (params?: unknown) => ['audit', params] as const,
  users: ['users'] as const,
  roles: ['roles'] as const,
  notifications: ['notifications'] as const,
};
