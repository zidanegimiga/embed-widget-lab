import { pino } from 'pino';
import { config } from '../config/env.ts';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});
