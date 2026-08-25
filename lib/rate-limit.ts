// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import crypto from 'node:crypto';
import { getStore, prefixedKey } from '@/lib/store';

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function hashIdentifier(identifier: string): string {
  return crypto.createHash('sha256').update(identifier).digest('hex');
}

export async function checkRateLimit(
  scope: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const key = prefixedKey(`rl:${scope}:${hashIdentifier(normalized)}`);
  const count = await getStore().incr(key, windowSeconds);

  return {
    limited: count > maxRequests,
    retryAfterSeconds: windowSeconds,
  };
}
