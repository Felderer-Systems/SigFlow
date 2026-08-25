// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
export type Locale = 'en' | 'de';

export type TemplateFieldType = 'text' | 'email' | 'tel' | 'url' | 'checkbox';

export type IncludeMode = 'optional' | 'always' | 'never';

export type TemplateValue = string | boolean;

export interface TemplateField {
  key: string;
  type: TemplateFieldType;
  required: boolean;
  editable?: boolean;
  includeMode?: IncludeMode;
  includeDefault?: boolean;
  label: Record<Locale, string>;
  placeholder?: Partial<Record<Locale, string>>;
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: Record<Locale, string>;
  previewImage: string;
  fields: TemplateField[];
}

export interface LoadedTemplate {
  id: string;
  directoryPath: string;
  html: string;
  config: TemplateConfig;
}

export interface DomainMapping {
  templateId: string;
  company: string;
  logoUrl?: string;
  bannerUrl?: string;
  locale?: Locale;
  defaults?: Record<string, TemplateValue>;
  fixed?: Record<string, TemplateValue>;
  fieldOverrides?: Record<
    string,
    {
      required?: boolean;
      editable?: boolean;
      hidden?: boolean;
      includeMode?: IncludeMode;
      includeDefault?: boolean;
    }
  >;
}

export interface DomainMapFile {
  domains: Record<string, DomainMapping>;
}
