// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('SigFlow'),
  APP_BASE_URL: z.string().url().default('https://sigflow.local'),
  BRAND_NAME: z.string().default('Example Company'),
  BRAND_WEBSITE_URL: z.string().url().default('https://www.example.com'),
  LEGAL_PRIVACY_URL: z.string().url().default('https://www.example.com/privacy'),
  LEGAL_IMPRINT_URL: z.string().url().default('https://www.example.com/imprint'),

  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  OTP_REQUEST_RATE_LIMIT_COUNT: z.coerce.number().int().min(1).max(100).default(5),
  OTP_VERIFY_RATE_LIMIT_COUNT: z.coerce.number().int().min(1).max(200).default(20),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(7200),

  REDIS_URL: z.string().url().optional(),
  REDIS_PREFIX: z.string().default('sigflow'),
  ALLOW_INMEMORY_FALLBACK: booleanFromString,

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanFromString,
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
  SMTP_REPLY_TO: z.string().email().optional(),
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

export type RuntimeConfig = z.infer<typeof envSchema>;

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}
