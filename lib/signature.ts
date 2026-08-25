// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import Handlebars from 'handlebars';
import type { TemplateValue } from '@/types/template';

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

function compileTemplate(templateId: string, htmlTemplate: string): Handlebars.TemplateDelegate {
  const existing = templateCache.get(templateId);
  if (existing) {
    return existing;
  }

  const compiled = Handlebars.compile(htmlTemplate, { noEscape: false, strict: false });
  templateCache.set(templateId, compiled);
  return compiled;
}

export function renderSignatureHtml(
  templateId: string,
  htmlTemplate: string,
  values: Record<string, TemplateValue>,
): string {
  const compiled = compileTemplate(templateId, htmlTemplate);
  return compiled(values);
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
