import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().url(),
  ACCOUNT_PASSWORD_ENCRYPTION_KEY: z.preprocess(value=>value===''?undefined:value,z.string().regex(/^[0-9a-fA-F]{64}$/).optional()),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  INTERNAL_TRACKER_SECRET: z.string().min(32),
  OFFLINE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),
  NO_SIGNAL_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
  EXPECTED_PACKET_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  MOVEMENT_THRESHOLD_KPH: z.coerce.number().nonnegative().default(5),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEOAPIFY_API_KEY: z.string().trim().default(''),
  ADDRESS_SOURCE: z.enum(['gps','cell']).default('gps'),
  OPENCELLID_API_KEY: z.string().trim().default(''),
  // Only configure after confirming the installed GT06 hardware's radio.
  GT06_CELL_RADIO: z.enum(['','GSM','UMTS','LTE']).default(''),
});

export const env = schema.parse(process.env);
