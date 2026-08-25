// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DomainMapFile, DomainMapping } from '@/types/template';

let cachedDomainMap: DomainMapFile | null = null;

export async function loadDomainMap(): Promise<DomainMapFile> {
  if (cachedDomainMap) {
    return cachedDomainMap;
  }

  const mapPath = path.join(process.cwd(), 'config', 'domain-map.json');
  const raw = await readFile(mapPath, 'utf8');
  const parsed = JSON.parse(raw) as DomainMapFile;

  const normalizedEntries = Object.entries(parsed.domains).map(([domain, value]) => [
    domain.toLowerCase(),
    value,
  ]);

  cachedDomainMap = { domains: Object.fromEntries(normalizedEntries) };
  return cachedDomainMap;
}

export function extractDomain(email: string): string {
  const [, domain] = email.toLowerCase().split('@');
  return domain ?? '';
}

export function parseNameFromEmail(email: string): string {
  const [local] = email.split('@');
  if (!local) {
    return '';
  }

  return local
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export async function findDomainMapping(email: string): Promise<DomainMapping | null> {
  const map = await loadDomainMap();
  const domain = extractDomain(email);
  return map.domains[domain] ?? null;
}
