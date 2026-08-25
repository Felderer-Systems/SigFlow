// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getTemplateById } from '@/lib/templates';

export const runtime = 'nodejs';

const errorHeaders = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
  expires: '0',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string; assetPath: string[] }> },
) {
  const { templateId, assetPath } = await context.params;
  const template = await getTemplateById(templateId);

  if (!template || assetPath.length === 0) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404, headers: errorHeaders });
  }

  // Prevent path traversal attempts.
  if (assetPath.some((segment) => segment.includes('..') || segment.includes('/'))) {
    return NextResponse.json(
      { error: 'Invalid asset path.' },
      { status: 400, headers: errorHeaders },
    );
  }

  const relativeAsset = assetPath.join('/');
  const filePath = path.join(process.cwd(), 'templates', template.directoryPath, relativeAsset);

  try {
    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store, max-age=0',
        pragma: 'no-cache',
        expires: '0',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404, headers: errorHeaders });
  }
}
