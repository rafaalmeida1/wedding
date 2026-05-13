import 'server-only';

/**
 * URL base pública do site (sem barra final).
 * Prioridade: APP_URL → https://VERCEL_URL → localhost só em desenvolvimento.
 */
export function getPublicSiteOrigin(): string {
  const app = (process.env.APP_URL ?? '').trim().replace(/\/$/, '');
  if (app) return app;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  throw new Error(
    'Defina APP_URL no ambiente (Vercel → Environment Variables) para links absolutos corretos.',
  );
}
