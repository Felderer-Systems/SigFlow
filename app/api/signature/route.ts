// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { findDomainMapping } from '@/lib/domain';
import { htmlToPlainText, renderSignatureHtml } from '@/lib/signature';
import {
  applyDomainFieldPolicy,
  mergeTemplateValues,
  resolveIncludedFields,
  validateRequiredFields,
} from '@/lib/template-policy';
import { getTemplateById } from '@/lib/templates';
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
  templateId: z.string().min(1),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  include: z.record(z.string(), z.boolean()).optional().default({}),
});

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: 'Invalid signature payload.' }, { status: 400 });
    }

    const mapping = await findDomainMapping(session.email);
    if (!mapping || mapping.templateId !== parsed.data.templateId) {
      return json({ error: 'Template not allowed for domain.' }, { status: 403 });
    }

    const template = await getTemplateById(parsed.data.templateId);
    if (!template) {
      return json({ error: 'Template not found.' }, { status: 404 });
    }

    const configuredTemplate = applyDomainFieldPolicy(template.config, mapping);
    const includedFields = resolveIncludedFields(configuredTemplate, parsed.data.include ?? {});
    const mergedValues = mergeTemplateValues(
      mapping,
      parsed.data.values as Record<string, TemplateValue>,
      includedFields,
    );
    const missingRequiredField = validateRequiredFields(
      configuredTemplate,
      mergedValues,
      includedFields,
    );

    if (missingRequiredField) {
      return json(
        {
          error: 'Missing required field.',
          errorCode: 'MISSING_REQUIRED_FIELD',
          fieldKey: missingRequiredField,
        },
        { status: 400 },
      );
    }

    const html = renderSignatureHtml(template.id, template.html, mergedValues);
    const plainText = htmlToPlainText(html);

    return json({ html, plainText });
  } catch {
    return json({ error: 'Unable to generate signature.' }, { status: 500 });
  }
}
