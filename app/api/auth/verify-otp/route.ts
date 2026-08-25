// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, verifyOtp } from '@/lib/otp';
import { extractDomain, findDomainMapping, parseNameFromEmail } from '@/lib/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { findTemplateBannerAssetFilename, findTemplateLogoAssetFilename } from '@/lib/templates';
import type { TemplateValue } from '@/types/template';

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
  otp: z.string().min(4).max(10),
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const firstForwarded = forwarded.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return firstForwarded || realIp || 'unknown';
}

function withCacheBuster(url: string, version: string): string {
  const delimiter = url.includes('?') ? '&' : '?';
  return `${url}${delimiter}v=${encodeURIComponent(version)}`;
}

function toStringValue(value: TemplateValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export async function POST(request: Request) {
  try {
    const config = getRuntimeConfig();
    const ip = getClientIp(request);
    const ipLimit = await checkRateLimit(
      'otp-verify-ip',
      ip,
      config.OTP_VERIFY_RATE_LIMIT_COUNT,
      config.OTP_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (ipLimit.limited) {
      return json(
        { error: 'Too many verification attempts. Please retry later.' },
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
      return json({ error: 'Invalid verification payload.' }, { status: 400 });
    }

    if (parsed.data.otp.length !== config.OTP_LENGTH) {
      return json({ error: 'Invalid verification payload.' }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const emailLimit = await checkRateLimit(
      'otp-verify-email',
      email,
      config.OTP_VERIFY_RATE_LIMIT_COUNT,
      config.OTP_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (emailLimit.limited) {
      return json(
        { error: 'Too many verification attempts. Please retry later.' },
        {
          status: 429,
          headers: {
            'retry-after': String(emailLimit.retryAfterSeconds),
          },
        },
      );
    }

    const isValid = await verifyOtp(email, parsed.data.otp);

    if (!isValid) {
      return json({ error: 'Invalid or expired OTP.' }, { status: 401 });
    }

    const mapping = await findDomainMapping(email);
    if (!mapping) {
      return json({ error: 'Unauthorized domain.' }, { status: 403 });
    }

    const domain = extractDomain(email);
    const { token, expiresAt } = await createSessionToken(email, domain);
    const assetVersion = String(Date.now());

    const mappedLogoUrl = toStringValue(mapping.logoUrl);
    const fallbackLogoUrl =
      toStringValue(mapping.fixed?.logoUrl) ?? toStringValue(mapping.defaults?.logoUrl);
    const localLogoAsset = await findTemplateLogoAssetFilename(mapping.templateId);
    const localLogoUrl =
      localLogoAsset ?
        withCacheBuster(
          `${config.APP_BASE_URL}/api/template-assets/${mapping.templateId}/${localLogoAsset}`,
          assetVersion,
        )
      : undefined;
    const resolvedLogoUrl =
      mappedLogoUrl ? withCacheBuster(mappedLogoUrl, assetVersion)
      : fallbackLogoUrl ? withCacheBuster(fallbackLogoUrl, assetVersion)
      : localLogoUrl;

    const fallbackBannerUrl =
      toStringValue(mapping.fixed?.bannerUrl) ?? toStringValue(mapping.defaults?.bannerUrl);
    const localBannerAsset = await findTemplateBannerAssetFilename(mapping.templateId);
    const localBannerUrl =
      localBannerAsset ?
        withCacheBuster(
          `${config.APP_BASE_URL}/api/template-assets/${mapping.templateId}/${localBannerAsset}`,
          assetVersion,
        )
      : undefined;
    const resolvedBannerUrl =
      fallbackBannerUrl ? withCacheBuster(fallbackBannerUrl, assetVersion) : localBannerUrl;

    const prefill: Record<string, TemplateValue> = {
      name: parseNameFromEmail(email),
      email,
      company: mapping.company,
      ...(mapping.defaults ?? {}),
      ...(mapping.fixed ?? {}),
      ...(resolvedLogoUrl ? { logoUrl: resolvedLogoUrl } : {}),
      ...(resolvedBannerUrl ? { bannerUrl: resolvedBannerUrl } : {}),
    };

    return json({
      success: true,
      token,
      expiresAt,
      domain,
      templateId: mapping.templateId,
      locale: mapping.locale ?? 'en',
      prefill,
    });
  } catch {
    return json({ error: 'Unable to verify OTP.' }, { status: 500 });
  }
}
