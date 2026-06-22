import pino from 'pino';
import { config } from '@/config';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.isProd ? 'info' : 'debug'),
  // Never log secrets. Redact common sensitive paths defensively.
  redact: {
    paths: [
      'password',
      'passwordHash',
      '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
      'credential',
      'ciphertext',
    ],
    remove: true,
  },
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
});

export type Logger = typeof logger;
