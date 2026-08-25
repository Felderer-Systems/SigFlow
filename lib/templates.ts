// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { LoadedTemplate, TemplateConfig } from '@/types/template';

const LOGO_CANDIDATE_FILES = ['logo.svg', 'logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'];
const BANNER_CANDIDATE_FILES = [
  'banner.svg',
  'banner.png',
  'banner.jpg',
  'banner.jpeg',
  'banner.webp',
];

const fieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['text', 'email', 'tel', 'url', 'checkbox']),
  required: z.boolean(),
  editable: z.boolean().optional(),
  includeMode: z.enum(['optional', 'always', 'never']).optional(),
  includeDefault: z.boolean().optional(),
  label: z.object({
    en: z.string().min(1),
    de: z.string().min(1),
  }),
  placeholder: z
    .object({
      en: z.string().optional(),
      de: z.string().optional(),
    })
    .optional(),
});

const configSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.object({
    en: z.string().min(1),
    de: z.string().min(1),
  }),
  previewImage: z.string().min(1),
  fields: z.array(fieldSchema).min(1),
});

let cache: LoadedTemplate[] | null = null;

function hasLogoPlaceholder(html: string): boolean {
  return html.includes('{{logoUrl}}');
}

function hasBannerPlaceholder(html: string): boolean {
  return html.includes('{{bannerUrl}}');
}

function hasDisclaimerPlaceholder(html: string): boolean {
  return html.includes('{{disclaimer}}');
}

function ensureLogoField(config: TemplateConfig, html: string): TemplateConfig {
  if (!hasLogoPlaceholder(html)) {
    return config;
  }

  const alreadyHasLogoField = config.fields.some((field) => field.key === 'logoUrl');
  if (alreadyHasLogoField) {
    return config;
  }

  return {
    ...config,
    fields: [
      ...config.fields,
      {
        key: 'logoUrl',
        type: 'url',
        required: false,
        includeMode: 'optional',
        includeDefault: true,
        label: {
          en: 'Logo URL (optional override)',
          de: 'Logo-URL (optional überschreiben)',
        },
        placeholder: {
          en: 'Set only if no local logo file is available',
          de: 'Nur setzen, wenn kein lokales Logo vorhanden ist',
        },
      },
    ],
  };
}

function ensureBannerField(config: TemplateConfig, html: string): TemplateConfig {
  if (!hasBannerPlaceholder(html)) {
    return config;
  }

  const alreadyHasBannerField = config.fields.some((field) => field.key === 'bannerUrl');
  if (alreadyHasBannerField) {
    return config;
  }

  return {
    ...config,
    fields: [
      ...config.fields,
      {
        key: 'bannerUrl',
        type: 'url',
        required: false,
        includeMode: 'optional',
        includeDefault: false,
        label: {
          en: 'Campaign banner URL',
          de: 'Kampagnen-Banner-URL',
        },
        placeholder: {
          en: 'Optional campaign banner URL',
          de: 'Optionale Kampagnen-Banner-URL',
        },
      },
    ],
  };
}

function ensureDisclaimerField(config: TemplateConfig, html: string): TemplateConfig {
  if (!hasDisclaimerPlaceholder(html)) {
    return config;
  }

  const alreadyHasDisclaimerField = config.fields.some((field) => field.key === 'disclaimer');
  if (alreadyHasDisclaimerField) {
    return config;
  }

  return {
    ...config,
    fields: [
      ...config.fields,
      {
        key: 'disclaimer',
        type: 'text',
        required: false,
        includeMode: 'optional',
        includeDefault: false,
        label: {
          en: 'Privacy disclaimer',
          de: 'Datenschutz-Hinweis',
        },
        placeholder: {
          en: 'If received in error, please delete this message',
          de: 'Falls irrtümlich erhalten, bitte löschen',
        },
      },
    ],
  };
}

async function collectTemplateDirs(rootDir: string, relativeDir = ''): Promise<string[]> {
  const currentDir = path.join(rootDir, relativeDir);
  const entries = await readdir(currentDir, { withFileTypes: true });

  const names = new Set(entries.map((entry) => entry.name));
  if (names.has('template.html') && names.has('config.json')) {
    return [relativeDir || '.'];
  }

  const nestedDirs = entries.filter((entry) => entry.isDirectory());
  const collected: string[] = [];

  for (const directoryEntry of nestedDirs) {
    const childRelative =
      relativeDir ? path.join(relativeDir, directoryEntry.name) : directoryEntry.name;
    const childDirs = await collectTemplateDirs(rootDir, childRelative);
    collected.push(...childDirs);
  }

  return collected;
}

export async function loadTemplates(): Promise<LoadedTemplate[]> {
  if (cache) {
    return cache;
  }

  const templatesRoot = path.join(process.cwd(), 'templates');
  const templateDirs = await collectTemplateDirs(templatesRoot);

  const loaded: LoadedTemplate[] = [];

  for (const relativeTemplateDir of templateDirs) {
    const normalizedRelativeDir = relativeTemplateDir === '.' ? '' : relativeTemplateDir;
    const templateDir = path.join(templatesRoot, normalizedRelativeDir);
    const [htmlRaw, configRaw] = await Promise.all([
      readFile(path.join(templateDir, 'template.html'), 'utf8'),
      readFile(path.join(templateDir, 'config.json'), 'utf8'),
    ]);

    const parsed = configSchema.parse(JSON.parse(configRaw));
    const fallbackId = normalizedRelativeDir.replaceAll(path.sep, '-');
    const id = parsed.id ?? fallbackId;

    const baseConfig: TemplateConfig = {
      id,
      name: parsed.name,
      description: parsed.description,
      previewImage: parsed.previewImage,
      fields: parsed.fields,
    };
    const config = ensureDisclaimerField(
      ensureBannerField(ensureLogoField(baseConfig, htmlRaw), htmlRaw),
      htmlRaw,
    );

    loaded.push({ id, directoryPath: normalizedRelativeDir, html: htmlRaw, config });
  }

  loaded.sort((a, b) => a.id.localeCompare(b.id));
  cache = loaded;

  return loaded;
}

export async function getTemplateById(id: string): Promise<LoadedTemplate | null> {
  const templates = await loadTemplates();
  return templates.find((tpl) => tpl.id === id) ?? null;
}

export async function findTemplateLogoAssetFilename(templateId: string): Promise<string | null> {
  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const templateDir = path.join(process.cwd(), 'templates', template.directoryPath);
  const entries = await readdir(templateDir, { withFileTypes: true });

  const files = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name.toLowerCase()),
  );

  for (const candidate of LOGO_CANDIDATE_FILES) {
    if (files.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function findTemplateBannerAssetFilename(templateId: string): Promise<string | null> {
  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const templateDir = path.join(process.cwd(), 'templates', template.directoryPath);
  const entries = await readdir(templateDir, { withFileTypes: true });

  const files = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name.toLowerCase()),
  );

  for (const candidate of BANNER_CANDIDATE_FILES) {
    if (files.has(candidate)) {
      return candidate;
    }
  }

  return null;
}
