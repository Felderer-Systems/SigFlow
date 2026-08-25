// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractDomain, findDomainMapping } from '@/lib/domain';
import { generateOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRuntimeConfig } from '@/lib/runtime-config';

export const runtime = 'nodejs';

const securityHeaders = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
  expires: '0',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...securityHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

const bodySchema = z.object({
  email: z.string().email(),
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const firstForwarded = forwarded.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return firstForwarded || realIp || 'unknown';
}

export async function POST(request: Request) {
  try {
    const config = getRuntimeConfig();
    const ip = getClientIp(request);
    const ipLimit = await checkRateLimit(
      'otp-request-ip',
      ip,
      config.OTP_REQUEST_RATE_LIMIT_COUNT,
      config.OTP_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (ipLimit.limited) {
      return json(
        { error: 'Too many requests. Please retry later.' },
        {
          status: 429,
          headers: {
            'retry-after': String(ipLimit.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: 'Invalid email.' }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const emailLimit = await checkRateLimit(
      'otp-request-email',
      email,
      config.OTP_REQUEST_RATE_LIMIT_COUNT,
      config.OTP_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (emailLimit.limited) {
      return json(
        { error: 'Too many requests. Please retry later.' },
        {
          status: 429,
          headers: {
            'retry-after': String(emailLimit.retryAfterSeconds),
          },
        },
      );
    }

    const mapping = await findDomainMapping(email);

    if (!mapping) {
      return json({ error: 'Unauthorized domain.' }, { status: 403 });
    }

    const { otp, expiresAt } = await generateOtp(email);
    const expiresInMinutes = Math.max(1, Math.round(config.OTP_TTL_SECONDS / 60));

    await sendOtpEmail({
      to: email,
      otp,
      expiresInMinutes,
      appName: config.APP_NAME,
      companyName: config.BRAND_NAME,
      legalPrivacyUrl: config.LEGAL_PRIVACY_URL,
      legalImprintUrl: config.LEGAL_IMPRINT_URL,
    });

    const domain = extractDomain(email);

    return json({
      success: true,
      domain,
      expiresAt,
    });
  } catch {
    return json({ error: 'Unable to process request.' }, { status: 500 });
  }
}
