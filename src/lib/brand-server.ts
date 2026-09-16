import fs from 'fs';
import path from 'path';
import { DEFAULT_LOGO_PATH } from './brand';

// The Sprout Media wordmark, bundled at public/brand/logo.png so the app
// works branded out of the box. Settings.logoDataUrl (set from the
// Settings page) always overrides this when present — this is only the
// fallback. Server-only (reads from disk): PDF generation needs actual
// image bytes as a data URL since react-pdf has no DOM/browser to resolve
// a relative path like DEFAULT_LOGO_PATH against.
let cached: string | null = null;

export function getDefaultLogoDataUrl(): string {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), 'public', DEFAULT_LOGO_PATH.replace(/^\//, ''));
  const buf = fs.readFileSync(filePath);
  cached = `data:image/png;base64,${buf.toString('base64')}`;
  return cached;
}

export function withDefaultLogo<T extends { logoDataUrl?: string | null }>(settings: T): T {
  return { ...settings, logoDataUrl: settings.logoDataUrl || getDefaultLogoDataUrl() };
}
