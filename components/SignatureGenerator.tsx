'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, t } from '@/lib/i18n';
import type { Locale, TemplateConfig, TemplateValue } from '@/types/template';

interface VerifyResponse {
  token: string;
  templateId: string;
  locale: Locale;
  prefill: Record<string, TemplateValue>;
}

interface PublicConfigResponse {
  brandName: string;
  brandWebsiteUrl: string;
  legalPrivacyUrl: string;
  legalImprintUrl: string;
}

export function SignatureGenerator() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [token, setToken] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateConfig | null>(null);
  const [values, setValues] = useState<Record<string, TemplateValue>>({});
  const [includeValues, setIncludeValues] = useState<Record<string, boolean>>({});

  const [htmlOutput, setHtmlOutput] = useState('');
  const [plainOutput, setPlainOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [copiedRich, setCopiedRich] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const [brandName, setBrandName] = useState('Example Company');
  const [brandWebsite, setBrandWebsite] = useState('https://www.example.com');
  const [legalPrivacyUrl, setLegalPrivacyUrl] = useState('https://www.example.com/privacy');
  const [legalImprintUrl, setLegalImprintUrl] = useState('https://www.example.com/imprint');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const browserLanguage = navigator.language.toLowerCase();
    setLocale(browserLanguage.startsWith('de') ? 'de' : 'en');

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');

    fetch('/api/public-config')
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as PublicConfigResponse;
        if (payload.brandName) {
          setBrandName(payload.brandName);
        }
        if (payload.brandWebsiteUrl) {
          setBrandWebsite(payload.brandWebsiteUrl);
        }
        if (payload.legalPrivacyUrl) {
          setLegalPrivacyUrl(payload.legalPrivacyUrl);
        }
        if (payload.legalImprintUrl) {
          setLegalImprintUrl(payload.legalImprintUrl);
        }
      })
      .catch(() => {
        // Keep safe defaults if public config cannot be loaded.
      });
  }, []);

  const labels = useMemo(
    () => ({
      appTitle: t(locale, 'appTitle'),
      appSubtitle: t(locale, 'appSubtitle'),
      emailLabel: t(locale, 'emailLabel'),
      emailPlaceholder: t(locale, 'emailPlaceholder'),
      sendOtp: t(locale, 'sendOtp'),
      otpLabel: t(locale, 'otpLabel'),
      otpPlaceholder: t(locale, 'otpPlaceholder'),
      verifyOtp: t(locale, 'verifyOtp'),
      signatureForm: t(locale, 'signatureForm'),
      template: t(locale, 'template'),
      livePreview: t(locale, 'livePreview'),
      htmlOutput: t(locale, 'htmlOutput'),
      textOutput: t(locale, 'textOutput'),
      copyRich: t(locale, 'copyRich'),
      copyText: t(locale, 'copyText'),
      downloadHtml: t(locale, 'downloadHtml'),
      downloadTxt: t(locale, 'downloadTxt'),
      copied: t(locale, 'copied'),
      reset: t(locale, 'reset'),
      themeDark: t(locale, 'themeDark'),
      themeLight: t(locale, 'themeLight'),
      language: t(locale, 'language'),
      privacy: t(locale, 'privacy'),
      imprint: t(locale, 'imprint'),
      unauthorizedDomain: t(locale, 'unauthorizedDomain'),
      invalidOtp: t(locale, 'invalidOtp'),
      unexpectedError: t(locale, 'unexpectedError'),
      requestOtpSuccess: t(locale, 'requestOtpSuccess'),
      verifySuccess: t(locale, 'verifySuccess'),
      generating: t(locale, 'generating'),
      includeField: t(locale, 'includeField'),
      requiredFieldHint: t(locale, 'requiredFieldHint'),
    }),
    [locale],
  );

  function isFieldIncluded(fieldKey: string): boolean {
    if (!template) {
      return true;
    }

    const field = template.fields.find((item) => item.key === fieldKey);
    if (!field || field.type === 'checkbox') {
      return true;
    }

    if (field.includeMode === 'never') {
      return false;
    }

    if (field.includeMode === 'always') {
      return true;
    }

    return includeValues[fieldKey] ?? field.includeDefault ?? true;
  }

  function isFieldInvalid(fieldKey: string): boolean {
    if (!template) {
      return false;
    }

    const field = template.fields.find((item) => item.key === fieldKey);
    if (!field || !field.required) {
      return false;
    }

    if (field.type !== 'checkbox' && !isFieldIncluded(fieldKey)) {
      return false;
    }

    const value = values[fieldKey];
    if (field.type === 'checkbox') {
      return value !== true;
    }

    return !(typeof value === 'string' && value.trim().length > 0);
  }

  function hasValidationErrors(): boolean {
    if (!template) {
      return false;
    }

    return template.fields.some((field) => isFieldInvalid(field.key));
  }

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setStatus(labels.unauthorizedDomain);
        } else if (response.status === 429) {
          setStatus(payload.error ?? 'Too many requests. Please retry later.');
        } else {
          setStatus(payload.error ?? labels.unexpectedError);
        }
        return;
      }

      setStatus(labels.requestOtpSuccess);
    } catch {
      setStatus(labels.unexpectedError);
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');

    try {
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const verifyPayload = (await verifyResponse.json()) as VerifyResponse & { error?: string };

      if (!verifyResponse.ok) {
        setStatus(
          verifyResponse.status === 401 ?
            labels.invalidOtp
          : (verifyPayload.error ?? labels.unexpectedError),
        );
        return;
      }

      setLocale(verifyPayload.locale ?? locale);
      setToken(verifyPayload.token);
      setStatus(labels.verifySuccess);

      const templateResponse = await fetch('/api/templates', {
        headers: {
          authorization: `Bearer ${verifyPayload.token}`,
        },
      });

      const templatePayload = (await templateResponse.json()) as {
        template?: TemplateConfig;
        error?: string;
      };

      if (!templateResponse.ok || !templatePayload.template) {
        setStatus(templatePayload.error ?? labels.unexpectedError);
        return;
      }

      setTemplate(templatePayload.template);

      const seededValues: Record<string, TemplateValue> = {};
      const seededInclude: Record<string, boolean> = {};
      for (const field of templatePayload.template.fields) {
        if (field.type === 'checkbox') {
          const prefilled = verifyPayload.prefill[field.key];
          seededValues[field.key] = prefilled === true;
        } else {
          const prefilled = verifyPayload.prefill[field.key];
          seededValues[field.key] = typeof prefilled === 'string' ? prefilled : '';

          if (field.includeMode === 'optional') {
            seededInclude[field.key] = field.includeDefault ?? true;
          }
        }
      }
      setValues(seededValues);
      setIncludeValues(seededInclude);
    } catch {
      setStatus(labels.unexpectedError);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!template || !token) {
      return;
    }

    if (hasValidationErrors()) {
      setStatus('');
      setHtmlOutput('');
      setPlainOutput('');
      return;
    }

    const timeout = window.setTimeout(async () => {
      setStatus(labels.generating);
      try {
        const response = await fetch('/api/signature', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateId: template.id,
            values,
            include: includeValues,
          }),
        });

        const payload = (await response.json()) as {
          html?: string;
          plainText?: string;
          error?: string;
          errorCode?: string;
          fieldKey?: string;
        };

        if (!response.ok || !payload.html || !payload.plainText) {
          if (payload.errorCode === 'MISSING_REQUIRED_FIELD') {
            setStatus('');
            return;
          }
          setStatus(payload.error ?? labels.unexpectedError);
          return;
        }

        setHtmlOutput(payload.html);
        setPlainOutput(payload.plainText);
        setStatus('');
      } catch {
        setStatus(labels.unexpectedError);
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [template, values, includeValues, token, labels.generating, labels.unexpectedError]);

  async function copyRichSignature() {
    if (!htmlOutput || !plainOutput || typeof window === 'undefined') {
      return;
    }

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      setStatus('Clipboard API is not available in this browser.');
      return;
    }

    const item = new ClipboardItem({
      'text/html': new Blob([htmlOutput], { type: 'text/html' }),
      'text/plain': new Blob([plainOutput], { type: 'text/plain' }),
    });

    await navigator.clipboard.write([item]);
    setCopiedRich(true);
    window.setTimeout(() => setCopiedRich(false), 1100);
  }

  async function copyPlainSignature() {
    if (!plainOutput) {
      return;
    }
    await navigator.clipboard.writeText(plainOutput);
    setCopiedText(true);
    window.setTimeout(() => setCopiedText(false), 1100);
  }

  function downloadSignature(content: string, filename: string, mimeType: string) {
    if (!content) {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  function resetAll() {
    setToken(null);
    setTemplate(null);
    setValues({});
    setIncludeValues({});
    setHtmlOutput('');
    setPlainOutput('');
    setOtp('');
    setStatus('');
  }

  return (
    <main className="page-shell">
      <section className="orb orb-a" aria-hidden="true" />
      <section className="orb orb-b" aria-hidden="true" />

      <div className="container">
        <header className="topbar">
          <div>
            <h1>{labels.appTitle}</h1>
            <p>{labels.appSubtitle}</p>
          </div>

          <div className="controls">
            <label>
              {labels.language}
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                {LOCALES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? labels.themeLight : labels.themeDark}
            </button>
          </div>
        </header>

        {!token && (
          <section className="card">
            <form onSubmit={requestOtp} className="stack">
              <label>
                {labels.emailLabel}
                <input
                  type="email"
                  required
                  value={email}
                  placeholder={labels.emailPlaceholder}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={busy}>
                  {labels.sendOtp}
                </button>
              </div>
            </form>

            <form onSubmit={verifyAndLoad} className="stack verify-form">
              <label>
                {labels.otpLabel}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4,10}"
                  minLength={4}
                  maxLength={10}
                  required
                  value={otp}
                  placeholder={labels.otpPlaceholder}
                  onChange={(event) => setOtp(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={busy || !email}>
                  {labels.verifyOtp}
                </button>
              </div>
            </form>
          </section>
        )}

        {token && template && (
          <section className="layout-grid">
            <article className="card">
              <div className="section-head">
                <h2>{labels.signatureForm}</h2>
                <p>
                  {labels.template}: {template.name}
                </p>
              </div>

              <form className="stack">
                {template.fields.map((field) => {
                  const currentValue = values[field.key];
                  const textValue = typeof currentValue === 'string' ? currentValue : '';
                  const included = isFieldIncluded(field.key);
                  const invalid = isFieldInvalid(field.key);
                  const hasValue =
                    field.type === 'checkbox' ? currentValue === true : textValue.trim().length > 0;
                  const stateClass =
                    invalid ? 'field-invalid'
                    : hasValue ? 'field-valid'
                    : '';

                  return (
                    <label key={field.key} className={`field-wrap ${stateClass}`}>
                      <div className="field-meta">
                        <span>
                          {field.label[locale]}
                          {field.required ? ` · ${labels.requiredFieldHint}` : ''}
                        </span>

                        {field.type !== 'checkbox' && field.includeMode === 'optional' && (
                          <span className="inline-toggle">
                            <span>{labels.includeField}</span>
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={(event) =>
                                setIncludeValues((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.checked,
                                }))
                              }
                            />
                          </span>
                        )}
                      </div>

                      {field.type === 'checkbox' ?
                        <input
                          type="checkbox"
                          required={field.required}
                          disabled={field.editable === false}
                          checked={currentValue === true}
                          onChange={(event) =>
                            setValues((prev) => ({
                              ...prev,
                              [field.key]: event.target.checked,
                            }))
                          }
                        />
                      : <input
                          type={field.type}
                          required={field.required}
                          disabled={field.editable === false || !included}
                          value={textValue}
                          placeholder={field.placeholder?.[locale] ?? ''}
                          onChange={(event) =>
                            setValues((prev) => ({
                              ...prev,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      }
                    </label>
                  );
                })}
              </form>

              <div className="form-actions">
                <button type="button" onClick={resetAll} className="secondary">
                  {labels.reset}
                </button>
              </div>
            </article>

            <article className="card preview-card">
              <h2>{labels.livePreview}</h2>
              <iframe title="Signature preview" srcDoc={htmlOutput} className="preview-frame" />

              <div className="copy-actions">
                <button
                  type="button"
                  onClick={copyRichSignature}
                  disabled={!htmlOutput || !plainOutput}
                >
                  {copiedRich ? labels.copied : labels.copyRich}
                </button>
                <button
                  type="button"
                  onClick={copyPlainSignature}
                  className="secondary"
                  disabled={!plainOutput}
                >
                  {copiedText ? labels.copied : labels.copyText}
                </button>
                <button
                  type="button"
                  onClick={() => downloadSignature(htmlOutput, 'signature.html', 'text/html')}
                  className="secondary"
                  disabled={!htmlOutput}
                >
                  {labels.downloadHtml}
                </button>
                <button
                  type="button"
                  onClick={() => downloadSignature(plainOutput, 'signature.txt', 'text/plain')}
                  className="secondary"
                  disabled={!plainOutput}
                >
                  {labels.downloadTxt}
                </button>
              </div>

              <h3>{labels.htmlOutput}</h3>
              <textarea readOnly value={htmlOutput} rows={8} />

              <h3>{labels.textOutput}</h3>
              <textarea readOnly value={plainOutput} rows={6} />
            </article>
          </section>
        )}

        {status && <p className="status">{status}</p>}

        <footer className="app-footer">
          <a href={brandWebsite} target="_blank" rel="noreferrer">
            {brandName}
          </a>
          <a href={legalPrivacyUrl} target="_blank" rel="noreferrer">
            {labels.privacy}
          </a>
          <a href={legalImprintUrl} target="_blank" rel="noreferrer">
            {labels.imprint}
          </a>
        </footer>
      </div>
    </main>
  );
}
