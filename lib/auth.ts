// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { headers } from 'next/headers';
import { verifySessionToken } from '@/lib/otp';

export async function requireSession() {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return null;
  }

  return await verifySessionToken(token);
}
