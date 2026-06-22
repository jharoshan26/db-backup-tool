// Shared domain types mirroring the backend API contract (/api/v1).

export type Engine = 'mysql' | 'mariadb' | 'postgres';
export type BackupFormat = 'sql' | 'dump' | 'custom';
export type ExportFormat = 'csv' | 'xlsx' | 'sql';
export type ImportFormat = 'csv' | 'xlsx';
export type CloneMode = 'schema' | 'full';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export type ScheduleType = 'backup';

export interface User {
  id: string;
  email: string;
  name?: string;
  roles?: Role[];
  permissions: string[];
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface Server {
  id: string;
  name: string;
  engine: Engine;
  host: string;
  port: number;
  sslMode: string;
  createdAt: string;
}

export interface ServerCreateInput {
  name: string;
  engine: Engine;
  host: string;
  port: number;
  sslMode: string;
  username: string;
  password: string;
  database?: string;
}

export type ServerUpdateInput = Partial<ServerCreateInput>;

export interface TestConnectionResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

export interface Backup {
  id: string;
  serverId: string;
  database: string;
  format: BackupFormat;
  size: number;
  status: JobStatus | 'available';
  storageUri: string;
  checksum: string;
  createdAt: string;
}

export interface RunBackupInput {
  database: string;
  format: BackupFormat;
}

export interface RestoreInput {
  targetServerId: string;
  targetDatabase: string;
  createDatabase: boolean;
}

export interface ExportInput {
  database: string;
  table: string;
  format: ExportFormat;
}

export interface ImportInput {
  serverId: string;
  database: string;
  table: string;
  format: ImportFormat;
  fileBase64: string;
  options?: Record<string, unknown>;
}

export interface CloneInput {
  sourceServerId: string;
  targetServerId: string;
  database: string;
  targetDatabase: string;
  mode: CloneMode;
}

export interface Schedule {
  id: string;
  serverId: string;
  database: string;
  type: ScheduleType;
  cron: string;
  enabled: boolean;
  retention: number;
  createdAt: string;
}

export interface ScheduleInput {
  serverId: string;
  database: string;
  type: ScheduleType;
  cron: string;
  enabled: boolean;
  retention: number;
}

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  params: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string;
}

export interface JobProgressEvent {
  progress: number;
  status: JobStatus;
}

export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  title?: string;
  message: string;
  level?: 'info' | 'warning' | 'error' | 'success';
  read?: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
