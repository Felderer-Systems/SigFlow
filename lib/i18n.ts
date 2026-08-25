// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import type { Locale } from '@/types/template';

export const LOCALES: Locale[] = ['en', 'de'];

export const DEFAULT_LOCALE: Locale = 'en';

export const dictionary = {
  en: {
    appTitle: 'SigFlow',
    appSubtitle: 'Secure, domain-driven email signature generation',
    emailLabel: 'Corporate email',
    emailPlaceholder: 'name@company.com',
    sendOtp: 'Send OTP',
    otpLabel: 'One-time password',
    otpPlaceholder: '6-digit code',
    verifyOtp: 'Verify and continue',
    template: 'Template',
    signatureForm: 'Signature details',
    livePreview: 'Live preview',
    htmlOutput: 'HTML output',
    textOutput: 'Plain text',
    copyRich: 'Copy rich signature',
    copyText: 'Copy plain text',
    downloadHtml: 'Download HTML',
    downloadTxt: 'Download TXT',
    copied: 'Copied',
    reset: 'Start over',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    privacy: 'Privacy',
    imprint: 'Imprint',
    unauthorizedDomain: 'This email domain is not allowed.',
    invalidOtp: 'Invalid or expired OTP.',
    unexpectedError: 'Unexpected error. Please try again.',
    requestOtpSuccess: 'OTP sent successfully.',
    verifySuccess: 'Email verified.',
    generating: 'Generating preview...',
    includeField: 'Show',
    requiredFieldHint: 'required',
  },
  de: {
    appTitle: 'SigFlow',
    appSubtitle: 'Sichere, domain-gesteuerte E-Mail-Signatur-Erstellung',
    emailLabel: 'Firmen-E-Mail',
    emailPlaceholder: 'name@firma.at',
    sendOtp: 'OTP senden',
    otpLabel: 'Einmalpasswort',
    otpPlaceholder: '6-stelliger Code',
    verifyOtp: 'Verifizieren und fortfahren',
    template: 'Vorlage',
    signatureForm: 'Signaturdaten',
    livePreview: 'Live-Vorschau',
    htmlOutput: 'HTML-Ausgabe',
    textOutput: 'Klartext',
    copyRich: 'Rich-Text-Signatur kopieren',
    copyText: 'Klartext kopieren',
    downloadHtml: 'HTML herunterladen',
    downloadTxt: 'TXT herunterladen',
    copied: 'Kopiert',
    reset: 'Zurücksetzen',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    language: 'Sprache',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    unauthorizedDomain: 'Diese E-Mail-Domain ist nicht erlaubt.',
    invalidOtp: 'OTP ungültig oder abgelaufen.',
    unexpectedError: 'Unerwarteter Fehler. Bitte erneut versuchen.',
    requestOtpSuccess: 'OTP wurde erfolgreich gesendet.',
    verifySuccess: 'E-Mail wurde verifiziert.',
    generating: 'Vorschau wird erstellt...',
    includeField: 'Anzeigen',
    requiredFieldHint: 'Pflicht',
  },
} as const;

export function t(locale: Locale, key: keyof (typeof dictionary)['en']): string {
  const selected = dictionary[locale] ?? dictionary[DEFAULT_LOCALE];
  return selected[key] ?? dictionary[DEFAULT_LOCALE][key];
}
