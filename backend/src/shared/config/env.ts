import { z } from 'zod';

/**
 * Configuración tipada. Se valida al arrancar: si falta un secreto o tiene un
 * formato inválido el proceso termina con un mensaje claro en lugar de fallar
 * más tarde en tiempo de ejecución.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_MIN: z.coerce.number().int().positive().default(480),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOADS_DIR: z.string().default('./uploads'),
  APP_TIMEZONE: z.string().default('America/Guayaquil'),
  HORAS_EXPIRACION_RESET: z.coerce.number().positive().default(1),
  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(10),
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresMin: number;
  corsOrigins: string[];
  uploadsDir: string;
  timezone: string;
  horasExpiracionReset: number;
  loginRateMax: number;
  seedDemo: boolean;
  adminEmail?: string;
  adminPassword?: string;
  logLevel: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresMin: env.JWT_EXPIRES_MIN,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    uploadsDir: env.UPLOADS_DIR,
    timezone: env.APP_TIMEZONE,
    horasExpiracionReset: env.HORAS_EXPIRACION_RESET,
    loginRateMax: env.LOGIN_RATE_MAX,
    seedDemo: env.SEED_DEMO === 'true',
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    logLevel: env.LOG_LEVEL,
  };
}
