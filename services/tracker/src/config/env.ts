import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TCP_PORT: z.coerce.number().int().positive().default(5001),
  DATABASE_URL: z.string().url(),
  INTERNAL_API_URL: z.string().url().default('http://localhost:3000/internal/v1/telemetry/location'),
  INTERNAL_TRACKER_SECRET: z.string().min(32),
  TRACKER_SOCKET_TIMEOUT_MS: z.coerce.number().positive().default(300000),
  MOVEMENT_THRESHOLD_KPH: z.coerce.number().nonnegative().default(5),
}).parse(process.env);

