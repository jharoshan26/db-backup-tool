import { spawn } from 'child_process';
import { Readable } from 'stream';
import mysql from 'mysql2/promise';
import { config } from '@/config';
import { logger } from '@/lib/logger';
import type {
  ConnectionInfo,
  DbAdapter,
  DumpOptions,
  RestoreOptions,
  ExportOptions,
  ColumnInfo,
} from './types';

/** Adapter for MySQL and MariaDB (wire-compatible; same client + dump tools). */
export class MysqlAdapter implements DbAdapter {
  private pool: mysql.Pool | null = null;

  constructor(private conn: ConnectionInfo) {}

  private getPool(database?: string): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: this.conn.host,
        port: this.conn.port,
        user: this.conn.username,
        password: this.conn.password,
        database: database ?? this.conn.database,
        ssl: this.conn.sslMode === 'disable' ? undefined : { rejectUnauthorized: this.conn.sslMode === 'verify_full' },
        connectionLimit: 5,
        waitForConnections: true,
        multipleStatements: false,
      });
    }
    return this.pool;
  }

  async testConnection(): Promise<void> {
    const c = await mysql.createConnection({
      host: this.conn.host,
      port: this.conn.port,
      user: this.conn.username,
      password: this.conn.password,
      ssl: this.conn.sslMode === 'disable' ? undefined : { rejectUnauthorized: this.conn.sslMode === 'verify_full' },
    });
    try {
      await c.query('SELECT 1');
    } finally {
      await c.end();
    }
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>('SHOW DATABASES');
    const system = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);
    return rows.map((r) => Object.values(r)[0] as string).filter((d) => !system.has(d));
  }

  async listTables(database: string): Promise<string[]> {
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? AND table_type = ?',
      [database, 'BASE TABLE'],
    );
    return rows.map((r) => r.name as string);
  }

  // Build the common mysql client flags. Password is passed via env (MYSQL_PWD), never argv.
  private clientArgs(extra: string[], database?: string): { args: string[]; env: NodeJS.ProcessEnv } {
    const args = [
      `-h${this.conn.host}`,
      `-P${this.conn.port}`,
      `-u${this.conn.username}`,
      ...(this.conn.sslMode !== 'disable' ? ['--ssl-mode=REQUIRED'] : []),
      ...extra,
    ];
    if (database) args.push(database);
    return { args, env: { ...process.env, MYSQL_PWD: this.conn.password } };
  }

  async dump(opts: DumpOptions): Promise<{ stream: Readable; done: Promise<void> }> {
    const extra = [
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      '--events',
      '--default-character-set=utf8mb4',
      ...(opts.schemaOnly ? ['--no-data'] : []),
      opts.database,
      ...(opts.tables ?? []),
    ];
    const { args, env } = this.clientArgs(extra);
    const child = spawn(config.bin.mysqldump, args, { env });
    const done = collectExit(child, 'mysqldump');
    captureStderr(child, 'mysqldump');
    return { stream: child.stdout!, done };
  }

  async ensureDatabase(database: string): Promise<void> {
    // Identifier is validated upstream; quote with backticks defensively.
    const safe = database.replace(/`/g, '');
    await this.getPool().query(`CREATE DATABASE IF NOT EXISTS \`${safe}\` CHARACTER SET utf8mb4`);
  }

  async restore(input: Readable, opts: RestoreOptions): Promise<void> {
    if (opts.createDatabase) await this.ensureDatabase(opts.database);
    const { args, env } = this.clientArgs([], opts.database);
    const child = spawn(config.bin.mysql, args, { env });
    captureStderr(child, 'mysql');
    const done = collectExit(child, 'mysql');
    input.pipe(child.stdin!);
    await done;
  }

  async readTable(opts: ExportOptions): Promise<{ columns: ColumnInfo[]; rows: AsyncIterable<Record<string, unknown>> }> {
    const pool = this.getPool(opts.database);
    const [colRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
      [opts.database, opts.table],
    );
    const columns: ColumnInfo[] = colRows.map((r) => ({ name: r.name as string, type: r.type as string }));
    const safe = opts.table.replace(/`/g, '');
    const conn = await pool.getConnection();
    async function* gen(): AsyncIterable<Record<string, unknown>> {
      try {
        // Use the underlying (callback-style) connection to obtain a streaming query.
        const raw = conn.connection as unknown as {
          query: (sql: string) => { stream: () => NodeJS.ReadableStream };
        };
        const stream = raw.query(`SELECT * FROM \`${safe}\``).stream();
        for await (const row of stream) {
          yield row as unknown as Record<string, unknown>;
        }
      } finally {
        conn.release();
      }
    }
    return { columns, rows: gen() };
  }

  async insertRows(database: string, table: string, columns: string[], rows: unknown[][]): Promise<number> {
    if (rows.length === 0) return 0;
    const pool = this.getPool(database);
    const safeTable = table.replace(/`/g, '');
    const safeCols = columns.map((c) => `\`${c.replace(/`/g, '')}\``).join(', ');
    const sql = `INSERT INTO \`${safeTable}\` (${safeCols}) VALUES ?`;
    const [res] = await pool.query<mysql.ResultSetHeader>(sql, [rows]);
    return res.affectedRows;
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
    this.pool = null;
  }
}

function captureStderr(child: ReturnType<typeof spawn>, name: string): void {
  let buf = '';
  child.stderr?.on('data', (d) => {
    buf += d.toString();
    if (buf.length > 8192) buf = buf.slice(-8192);
  });
  child.on('close', (code) => {
    if (code !== 0 && buf.trim()) logger.warn({ tool: name, code, stderr: buf.trim().slice(0, 1000) }, 'dump/restore tool stderr');
  });
}

function collectExit(child: ReturnType<typeof spawn>, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
  });
}
