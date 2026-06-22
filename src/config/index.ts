import dotenv from 'dotenv';

dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',

  api: {
    port: int('API_PORT', 4000),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  },

  database: {
    url: req('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/dbtool?schema=public'),
  },

  redis: {
    url: req('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    accessSecret: req('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: req('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  // Master Key Encryption Key (KEK) for envelope encryption of DB credentials.
  // In production this should come from KMS/Vault; here we accept a base64 32-byte key.
  crypto: {
    masterKeyBase64: req(
      'CREDENTIAL_MASTER_KEY',
      // dev-only default 32-byte key (base64). MUST be overridden in production.
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ),
    keyVersion: process.env.CREDENTIAL_KEY_VERSION ?? 'v1',
  },

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    local: {
      basePath: process.env.STORAGE_LOCAL_PATH ?? './storage',
    },
    s3: {
      bucket: process.env.S3_BUCKET ?? 'db-backups',
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT, // for MinIO
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: bool('S3_FORCE_PATH_STYLE', true),
    },
  },

  worker: {
    concurrency: int('WORKER_CONCURRENCY', 3),
    tmpDir: process.env.WORKER_TMP_DIR ?? '/tmp/dbtool',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: int('SMTP_PORT', 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'no-reply@dbtool.local',
  },

  // Paths to dump/restore binaries (overridable per environment/image).
  bin: {
    mysqldump: process.env.BIN_MYSQLDUMP ?? 'mysqldump',
    mysql: process.env.BIN_MYSQL ?? 'mysql',
    pgDump: process.env.BIN_PG_DUMP ?? 'pg_dump',
    psql: process.env.BIN_PSQL ?? 'psql',
  },
};

export type AppConfig = typeof config;
