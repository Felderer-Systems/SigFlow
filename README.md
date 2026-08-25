# SigFlow

SigFlow is a production-ready, self-hosted email signature generator built with Next.js App Router and pnpm.

It provides domain-restricted onboarding, real SMTP-based OTP verification, Redis-backed OTP/session state, runtime-loaded signature templates, live HTML preview, and plain-text output.

Created by Felderer Systems.

## Features

- Domain-gated onboarding via corporate email + OTP flow
- Real OTP delivery through your SMTP server (no simulated OTP in production flow)
- Redis-backed OTP/session storage for multi-instance deployments
- Runtime template discovery from a file-based /templates directory
- Automatic local logo discovery from template folders (logo.svg/png/jpg/jpeg/webp)
- Automatic local campaign banner discovery from template folders (banner.svg/png/jpg/jpeg/webp)
- Automatic domain-to-template mapping
- Automatic name prefill from email local-part (for example max.mustermann -> Max Mustermann)
- Dynamic question-and-answer form based on template config.json fields
- Domain-managed field policy controls (per domain):
  - fixed values enforced server-side
  - non-editable fields in UI
  - per-field required overrides
  - hidden fields
- Optional field visibility toggles (for example address/slogan/logo/banner/disclaimer)
- Optional campaign banner and privacy disclaimer blocks per template
- Real-time generation of:
  - HTML signature
  - Plain-text signature
- Export options after generation:
  - Download HTML file
  - Download TXT file
- Rich clipboard support using ClipboardItem API (text/html + text/plain)
- Built-in localization (English and German)
- Dark and light theme support using CSS variables
- Docker-ready production image (Next.js standalone)
- GitHub Actions workflow for GHCR publishing

## Technology Stack

- Next.js (App Router, latest)
- React
- TypeScript
- pnpm
- Handlebars (template interpolation)
- Nodemailer (OTP email delivery)
- Redis / ioredis (OTP + session state)
- Zod (runtime validation)

## Project Structure

```text
SigFlow/
	app/
		api/
			auth/request-otp/route.ts
			auth/verify-otp/route.ts
			signature/route.ts
			templates/route.ts
		globals.css
		layout.tsx
		page.tsx
	components/
		SignatureGenerator.tsx
	config/
		domain-map.json
	lib/
		auth.ts
		domain.ts
		i18n.ts
    mailer.ts
		otp.ts
    runtime-config.ts
		signature.ts
    store.ts
		templates.ts
	public/
		previews/
	templates/
		austro-corporate/
			config.json
			template.html
      logo.svg
		alpine-minimal/
			config.json
			template.html
      logo.svg
	types/
		template.ts
  .github/workflows/
		docker-publish.yml
	Dockerfile
	LICENSE
	README.md
```

## Template System

Templates are loaded dynamically at runtime from a simple top-level folder per template:

```text
/templates/<template-id>/
	template.html
	config.json
	logo.svg
  banner.svg
```

### template.html

- Recommended table-based structure for broad email client compatibility
- Uses placeholders such as:
  - {{name}}
  - {{title}}
  - {{company}}
  - {{phone}}
  - {{email}}
  - {{website}}
  - {{logoUrl}}
  - {{bannerUrl}}
  - {{disclaimer}}

If `logoUrl` is not defined in the domain mapping, SigFlow auto-detects a logo file in the template folder and injects an absolute URL:

`<APP_BASE_URL>/api/template-assets/<template-id>/<logo-file>`

If no local logo file is found, SigFlow still exposes an editable `logoUrl` field in the form so users can provide an external URL manually.

If `bannerUrl` is used in template.html and no `bannerUrl` is set in mapping defaults/fixed values, SigFlow auto-detects a local banner file from the same template folder using the fixed file names:

- banner.svg
- banner.png
- banner.jpg
- banner.jpeg
- banner.webp

Resulting URL pattern:

`<APP_BASE_URL>/api/template-assets/<template-id>/<banner-file>`

This keeps campaign banners centrally maintainable by replacing one file in the template folder.

### Campaign Banner Quickstart

1. Place one of the supported files in your template directory:

- `templates/<template-id>/banner.svg` (preferred)
- `templates/<template-id>/banner.png`

2. Ensure your template HTML includes `{{bannerUrl}}` in a conditional block.
3. In `config/domain-map.json`, set:

- `fieldOverrides.bannerUrl.includeMode` to `optional` or `always`
- `fieldOverrides.bannerUrl.includeDefault` to `true` if banner should be on by default

4. Update or replace the banner file to roll out campaign changes remotely.

### config.json

Defines metadata and field schema used to render the form dynamically.

Example:

```json
{
  "id": "austro-corporate",
  "name": "Austro Corporate",
  "description": {
    "en": "Structured corporate signature for modern email clients.",
    "de": "Structured corporate signature for modern email clients."
  },
  "previewImage": "/previews/austro-corporate.svg",
  "fields": [
    {
      "key": "name",
      "type": "text",
      "required": true,
      "label": {
        "en": "Full name",
        "de": "Full name"
      }
    }
  ]
}
```

## Domain Mapping

Use [config/domain-map.json](config/domain-map.json) to map email domains to templates and defaults.

You can also configure field behavior per domain with `fixed` and `fieldOverrides`.

Example:

```json
{
  "domains": {
    "example.com": {
      "templateId": "austro-corporate",
      "company": "Example Company",
      "locale": "de",
      "defaults": {
        "website": "https://www.example.com",
        "phone": "+1 555 0100",
        "address": "Main Street 1, 10001 City, Country",
        "slogan": "Clarity in every interaction.",
        "disclaimer": "If you received this message in error, please delete it immediately for privacy reasons."
      },
      "fixed": {
        "company": "Example Company",
        "website": "https://www.example.com"
      },
      "fieldOverrides": {
        "company": {
          "editable": false,
          "required": true
        },
        "website": {
          "editable": false,
          "required": true,
          "includeMode": "always"
        },
        "address": {
          "required": false,
          "includeMode": "optional",
          "includeDefault": false
        },
        "slogan": {
          "required": false,
          "includeMode": "optional",
          "includeDefault": true
        },
        "logoUrl": {
          "editable": false,
          "required": false,
          "includeMode": "optional",
          "includeDefault": true
        },
        "bannerUrl": {
          "editable": false,
          "required": false,
          "includeMode": "optional",
          "includeDefault": true
        },
        "disclaimer": {
          "editable": true,
          "required": false,
          "includeMode": "optional",
          "includeDefault": false
        }
      }
    }
  }
}
```

## OTP + Access Flow

1. User enters corporate email.
2. API validates domain against [config/domain-map.json](config/domain-map.json).
3. API generates OTP and sends it via SMTP.
4. User submits OTP.
5. API verifies OTP, issues session token, and returns:
   - mapped templateId
   - locale
   - prefilled values (name, email, company, defaults)
6. Generator loads template fields and renders live output.

By default, SigFlow expects Redis and SMTP to be configured for production-grade behavior.

## Localization

Languages included:

- en
- de

Translations are defined in [lib/i18n.ts](lib/i18n.ts).

## Local Development

### 1) Install dependencies

```bash
pnpm install
```

### 2) Run development server

```bash
pnpm dev
```

### 3) Build for production

```bash
pnpm build
pnpm start
```

## Environment Variables

See [.env.example](.env.example) for:

- App and branding settings
- Legal links (privacy / imprint)
- OTP/session controls
- Redis configuration
- SMTP configuration

## Docker (Self-Hosting)

### Application image

### Build image

```bash
docker build -t sigflow:latest .
```

### Run container

```bash
docker run --rm -p 3000:3000 --env-file .env sigflow:latest
```

Open:

```text
http://localhost:3000
```

### Note on Example Files

All `.example` files intentionally use generic placeholder data. Replace them with your internal production values before deployment.

Internal infra-specific settings (for example reverse proxy, TLS resolver, network topology) should be maintained in your private deployment repository/folder.

## GitHub Actions: GHCR Publish

Workflow file:

- [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml)

Triggers:

- push to main
- tag push matching v\*
- release published

The image is pushed to:

```text
ghcr.io/<owner>/sigflow
```

## Security Notes

- Domain allowlist is enforced before OTP verification can continue.
- OTP is salted, hashed, expiration-bound, and attempt-limited.
- Session access is bearer-token based and expiration-bound.
- Template access is constrained to the authenticated domain mapping.

Recommended next hardening steps:

- Add API rate limiting / WAF controls
- Add audit logging and SIEM integration
- Add SSO/SAML integration if required

## License

This project is licensed under MIT.

Copyright (c) 2026 Felderer Systems
