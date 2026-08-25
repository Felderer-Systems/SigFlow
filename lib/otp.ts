// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import crypto from 'node:crypto';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { getStore, prefixedKey } from '@/lib/store';

interface OtpRecord {
  email: string;
  otpHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
}

export interface SessionRecord {
  email: string;
  domain: string;
  expiresAt: number;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function randomDigits(length: number): string {
  const min = Number(`1${'0'.repeat(length - 1)}`);
  const max = Number('9'.repeat(length));
  return crypto.randomInt(min, max).toString();
}

function otpKey(email: string): string {
  return prefixedKey(`otp:${email.toLowerCase()}`);
}

function sessionKey(token: string): string {
  return prefixedKey(`session:${token}`);
}

export async function generateOtp(email: string): Promise<{ otp: string; expiresAt: number }> {
  const config = getRuntimeConfig();
  const otp = randomDigits(config.OTP_LENGTH);
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = sha256(`${email}:${otp}:${salt}`);
  const expiresAt = Date.now() + config.OTP_TTL_SECONDS * 1000;

  const record: OtpRecord = {
    email: email.toLowerCase(),
    otpHash,
    salt,
    expiresAt,
    attempts: 0,
  };

  await getStore().setEx(otpKey(email), config.OTP_TTL_SECONDS, JSON.stringify(record));

  return { otp, expiresAt };
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const config = getRuntimeConfig();
  const key = email.toLowerCase();
  const store = getStore();
  const cacheKey = otpKey(key);
  const raw = await store.get(cacheKey);
  const entry = raw ? (JSON.parse(raw) as OtpRecord) : null;

  if (!entry || Date.now() > entry.expiresAt || entry.attempts >= config.OTP_MAX_ATTEMPTS) {
    await store.del(cacheKey);
    return false;
  }

  entry.attempts += 1;

  const submittedHash = sha256(`${key}:${otp}:${entry.salt}`);
  const valid = timingSafeEqualHex(submittedHash, entry.otpHash);

  if (valid) {
    await store.del(cacheKey);
    return true;
  }

  if (entry.attempts >= config.OTP_MAX_ATTEMPTS) {
    await store.del(cacheKey);
  } else {
    const ttlSeconds = Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000));
    await store.setEx(cacheKey, ttlSeconds, JSON.stringify(entry));
  }

  return false;
}

export async function createSessionToken(
  email: string,
  domain: string,
): Promise<{ token: string; expiresAt: number }> {
  const config = getRuntimeConfig();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + config.SESSION_TTL_SECONDS * 1000;

  const session: SessionRecord = {
    email: email.toLowerCase(),
    domain: domain.toLowerCase(),
    expiresAt,
  };

  await getStore().setEx(sessionKey(token), config.SESSION_TTL_SECONDS, JSON.stringify(session));

  return { token, expiresAt };
}

export async function verifySessionToken(token: string): Promise<SessionRecord | null> {
  const store = getStore();
  const raw = await store.get(sessionKey(token));
  const entry = raw ? (JSON.parse(raw) as SessionRecord) : null;

  if (!entry || Date.now() > entry.expiresAt) {
    await store.del(sessionKey(token));
    return null;
  }

  return entry;
}
