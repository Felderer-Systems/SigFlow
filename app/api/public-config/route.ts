// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { NextResponse } from 'next/server';
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

export async function GET() {
  const config = getRuntimeConfig();

  return NextResponse.json(
    {
      brandName: config.BRAND_NAME,
      brandWebsiteUrl: config.BRAND_WEBSITE_URL,
      legalPrivacyUrl: config.LEGAL_PRIVACY_URL,
      legalImprintUrl: config.LEGAL_IMPRINT_URL,
    },
    {
      headers: securityHeaders,
    },
  );
}
