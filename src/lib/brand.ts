// Client-safe brand constants — no Node built-ins here (see brand-server.ts
// for the fs-based default-logo-as-data-URL helper used by PDF generation),
// so this file can be imported from both server and client components.
export const DEFAULT_LOGO_PATH = '/brand/logo.png';
