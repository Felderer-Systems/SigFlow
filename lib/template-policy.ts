// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import type {
  DomainMapping,
  IncludeMode,
  TemplateConfig,
  TemplateField,
  TemplateValue,
} from '@/types/template';

export function applyDomainFieldPolicy(
  template: TemplateConfig,
  mapping: DomainMapping,
): TemplateConfig {
  const overrides = mapping.fieldOverrides ?? {};

  const fields = template.fields
    .map((field): TemplateField | null => {
      const override = overrides[field.key];
      if (override?.hidden) {
        return null;
      }

      return {
        ...field,
        required: override?.required ?? field.required,
        editable: override?.editable ?? field.editable ?? true,
        includeMode:
          field.type === 'checkbox' ?
            'always'
          : (override?.includeMode ?? field.includeMode ?? 'always'),
        includeDefault: override?.includeDefault ?? field.includeDefault,
      };
    })
    .filter((field): field is TemplateField => field !== null);

  return {
    ...template,
    fields,
  };
}

function includedByMode(
  mode: IncludeMode,
  submittedValue: boolean | undefined,
  includeDefault: boolean | undefined,
): boolean {
  if (mode === 'always') {
    return true;
  }

  if (mode === 'never') {
    return false;
  }

  if (typeof submittedValue === 'boolean') {
    return submittedValue;
  }

  return includeDefault ?? true;
}

export function resolveIncludedFields(
  template: TemplateConfig,
  include: Record<string, boolean>,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const field of template.fields) {
    if (field.type === 'checkbox') {
      continue;
    }

    const mode = field.includeMode ?? 'always';
    result[field.key] = includedByMode(mode, include[field.key], field.includeDefault);
  }

  return result;
}

export function mergeTemplateValues(
  mapping: DomainMapping,
  submittedValues: Record<string, TemplateValue>,
  includedFields: Record<string, boolean>,
): Record<string, TemplateValue> {
  const merged: Record<string, TemplateValue> = {
    ...(mapping.defaults ?? {}),
    ...submittedValues,
    ...(mapping.fixed ?? {}),
  };

  for (const [fieldKey, included] of Object.entries(includedFields)) {
    merged[`__include_${fieldKey}`] = included;
    if (!included && typeof merged[fieldKey] === 'string') {
      merged[fieldKey] = '';
    }
  }

  return merged;
}

export function validateRequiredFields(
  template: TemplateConfig,
  values: Record<string, TemplateValue>,
  includedFields: Record<string, boolean>,
): string | null {
  for (const field of template.fields) {
    if (!field.required) {
      continue;
    }

    if (field.type !== 'checkbox' && includedFields[field.key] === false) {
      continue;
    }

    const value = values[field.key];

    if (field.type === 'checkbox') {
      if (value !== true) {
        return field.key;
      }
      continue;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      return field.key;
    }
  }

  return null;
}
