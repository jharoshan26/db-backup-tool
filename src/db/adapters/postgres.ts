import { spawn } from 'child_process';
import { Readable } from 'stream';
import { Pool, Client } from 'pg';
import QueryStream from 'pg-query-stream';
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

/** Adapter for PostgreSQL. Uses pg_dump/psql for logical dump/restore, pg driver for queries. */
export class PostgresAdapter implements DbAdapter {
  private pools = new Map<string, Pool>();

  constructor(private conn: ConnectionInfo) {}

  private ssl() {
    if (this.conn.sslMode === 'disable') return undefined;
    return { rejectUnauthorized: this.conn.sslMode === 'verify_full' };
  }

  private getPool(database?: string): Pool {
    const db = database ?? this.conn.database ?? 'postgres';
    let pool = this.pools.get(db);
    if (!pool) {
      pool = new Pool({
        host: this.conn.host,
        port: this.conn.port,
        user: this.conn.username,
        password: this.conn.password,
        database: db,
        ssl: this.ssl(),
        max: 5,
      });
      this.pools.set(db, pool);
    }
    return pool;
  }

  async testConnection(): Promise<void> {
    const client = new Client({
      host: this.conn.host,
      port: this.conn.port,
      user: this.conn.username,
      password: this.conn.password,
      database: this.conn.database ?? 'postgres',
      ssl: this.ssl(),
    });
    await client.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      await client.end();
    }
  }

  async listDatabases(): Promise<string[]> {
    const res = await this.getPool('postgres').query(
      'SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ($1) ORDER BY datname',
      ['postgres'],
    );
    return res.rows.map((r) => r.datname as string);
  }

  async listTables(database: string): Promise<string[]> {
    const res = await this.getPool(database).query(
      "SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename",
    );
    return res.rows.map((r) => r.tablename as string);
  }

  // Common env for pg client tools. Password via PGPASSWORD env, never argv.
  private clientEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PGPASSWORD: this.conn.password,
      PGSSLMODE: this.conn.sslMode === 'disable' ? 'disable' : this.conn.sslMode === 'verify_full' ? 'verify-full' : 'require',
    };
  }

  private baseArgs(database: string): string[] {
    return [`-h`, this.conn.host, `-p`, String(this.conn.port), `-U`, this.conn.username, `-d`, database];
  }

  async dump(opts: DumpOptions): Promise<{ stream: Readable; done: Promise<void> }> {
    const args = [
      ...this.baseArgs(opts.database),
      '--no-owner',
      '--no-privileges',
      ...(opts.schemaOnly ? ['--schema-only'] : []),
      ...(opts.tables ?? []).flatMap((t) => ['-t', t]),
    ];
    const child = spawn(config.bin.pgDump, args, { env: this.clientEnv() });
    captureStderr(child, 'pg_dump');
    const done = collectExit(child, 'pg_dump');
    return { stream: child.stdout!, done };
  }

  async ensureDatabase(database: string): Promise<void> {
    const pool = this.getPool('postgres');
    const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (exists.rowCount === 0) {
      const safe = database.replace(/"/g, '');
      await pool.query(`CREATE DATABASE "${safe}"`);
    }
  }

  async restore(input: Readable, opts: RestoreOptions): Promise<void> {
    if (opts.createDatabase) await this.ensureDatabase(opts.database);
    const args = [...this.baseArgs(opts.database), '-v', 'ON_ERROR_STOP=1'];
    const child = spawn(config.bin.psql, args, { env: this.clientEnv() });
    captureStderr(child, 'psql');
    const done = collectExit(child, 'psql');
    input.pipe(child.stdin!);
    await done;
  }

  async readTable(opts: ExportOptions): Promise<{ columns: ColumnInfo[]; rows: AsyncIterable<Record<string, unknown>> }> {
    const pool = this.getPool(opts.database);
    const colRes = await pool.query(
      'SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [opts.table],
    );
    const columns: ColumnInfo[] = colRes.rows.map((r) => ({ name: r.name as string, type: r.type as string }));
    const safe = opts.table.replace(/"/g, '');
    const client = await pool.connect();
    async function* gen(): AsyncIterable<Record<string, unknown>> {
      try {
        const qs = new QueryStream(`SELECT * FROM "${safe}"`);
        const stream = client.query(qs);
        for await (const row of stream) {
          yield row as Record<string, unknown>;
        }
      } finally {
        client.release();
      }
    }
    return { columns, rows: gen() };
  }

  async insertRows(database: string, table: string, columns: string[], rows: unknown[][]): Promise<number> {
    if (rows.length === 0) return 0;
    const pool = this.getPool(database);
    const safeTable = table.replace(/"/g, '');
    const safeCols = columns.map((c) => `"${c.replace(/"/g, '')}"`).join(', ');
    const client = await pool.connect();
    try {
      let inserted = 0;
      // batched multi-row insert with parameterized placeholders
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: unknown[] = [];
        const tuples = batch.map((row, ri) => {
          const ph = row.map((_, ci) => `$${ri * columns.length + ci + 1}`);
          values.push(...row);
          return `(${ph.join(', ')})`;
        });
        const sql = `INSERT INTO "${safeTable}" (${safeCols}) VALUES ${tuples.join(', ')}`;
        const res = await client.query(sql, values);
        inserted += res.rowCount ?? 0;
      }
      return inserted;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    for (const pool of this.pools.values()) await pool.end();
    this.pools.clear();
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
