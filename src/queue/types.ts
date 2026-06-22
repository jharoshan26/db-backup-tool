export const QUEUE_NAMES = {
  backup: 'backup',
  restore: 'restore',
  export: 'export',
  import: 'import',
  clone: 'clone',
  notify: 'notify',
  schedule: 'schedule',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Each job carries the metadata `jobId` (our DB Job row) so workers can update state.
export interface BackupJobData {
  jobId: string;
  tenantId: string;
  serverId: string;
  database: string;
  format: 'sql';
}

export interface RestoreJobData {
  jobId: string;
  tenantId: string;
  backupId: string;
  targetServerId: string;
  targetDatabase: string;
  createDatabase: boolean;
}

export interface ExportJobData {
  jobId: string;
  tenantId: string;
  serverId: string;
  database: string;
  table: string;
  format: 'csv' | 'xlsx' | 'sql';
}

export interface ImportJobData {
  jobId: string;
  tenantId: string;
  serverId: string;
  database: string;
  table: string;
  format: 'csv' | 'xlsx';
  fileKey: string; // storage key of the uploaded file
  options?: { hasHeader?: boolean; truncate?: boolean };
}

export interface CloneJobData {
  jobId: string;
  tenantId: string;
  sourceServerId: string;
  targetServerId: string;
  database: string;
  targetDatabase: string;
  mode: 'schema' | 'full';
}

export interface NotifyJobData {
  userId: string;
  channel: 'email' | 'webhook' | 'inapp';
  subject: string;
  body: string;
}

export type AnyJobData =
  | BackupJobData
  | RestoreJobData
  | ExportJobData
  | ImportJobData
  | CloneJobData
  | NotifyJobData;
