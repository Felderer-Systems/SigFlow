// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { findDomainMapping } from '@/lib/domain';
import { applyDomainFieldPolicy } from '@/lib/template-policy';
import { getTemplateById } from '@/lib/templates';

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

export async function GET() {
  const session = await requireSession();

  if (!session) {
    return json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const mapping = await findDomainMapping(session.email);
  if (!mapping) {
    return json({ error: 'Unauthorized domain.' }, { status: 403 });
  }

  const template = await getTemplateById(mapping.templateId);
  if (!template) {
    return json({ error: 'Template not found.' }, { status: 404 });
  }

  const configuredTemplate = applyDomainFieldPolicy(template.config, mapping);

  return json({
    template: configuredTemplate,
  });
}
