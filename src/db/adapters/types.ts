import { Readable } from 'stream';

export type Engine = 'mysql' | 'mariadb' | 'postgres';

export interface ConnectionInfo {
  engine: Engine;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  sslMode: 'disable' | 'require' | 'verify_full';
}

export interface DumpOptions {
  database: string;
  /** schema only (no data) */
  schemaOnly?: boolean;
  /** specific tables (default: all) */
  tables?: string[];
}

export interface RestoreOptions {
  database: string;
  /** create the database if it does not exist */
  createDatabase?: boolean;
}

export interface ExportOptions {
  database: string;
  table: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

/**
 * A database adapter abstracts engine-specific operations behind a uniform interface.
 * Implementations must NEVER interpolate untrusted values into shell strings — always
 * pass arguments as arrays and secrets via env, not argv.
 */
export interface DbAdapter {
  /** Verify connectivity and auth. Throws on failure. */
  testConnection(): Promise<void>;

  /** List database names on the server. */
  listDatabases(): Promise<string[]>;

  /** List tables in a database. */
  listTables(database: string): Promise<string[]>;

  /**
   * Produce a logical dump as a readable stream (SQL text).
   * The caller pipes this to storage. Returns the stream and a completion promise.
   */
  dump(opts: DumpOptions): Promise<{ stream: Readable; done: Promise<void> }>;

  /** Restore a SQL dump stream into a database. */
  restore(input: Readable, opts: RestoreOptions): Promise<void>;

  /** Ensure a database exists (create if missing). */
  ensureDatabase(database: string): Promise<void>;

  /** Read rows of a table as an async iterator of plain objects (for CSV/Excel export). */
  readTable(opts: ExportOptions): Promise<{ columns: ColumnInfo[]; rows: AsyncIterable<Record<string, unknown>> }>;

  /** Bulk insert rows into a table (for CSV/Excel import). Returns rows inserted. */
  insertRows(database: string, table: string, columns: string[], rows: unknown[][]): Promise<number>;

  /** Close any pooled connections. */
  close(): Promise<void>;
}
