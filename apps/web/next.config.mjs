import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');
// Next só lê `.env*` em `apps/web/`. Mesma ordem de precedência que o Next usa
// para a raiz: arquivos finais sobrescrevem os anteriores.
const dev = process.env.NODE_ENV !== 'production';
const rootEnvFiles = dev
  ? ['.env', '.env.development', '.env.local', '.env.development.local']
  : ['.env', '.env.production', '.env.local', '.env.production.local'];
for (const name of rootEnvFiles) {
  const p = path.join(monorepoRoot, name);
  if (!existsSync(p)) continue;
  dotenv.config({ path: p, override: true });
}

const remotePatterns = [
  { protocol: 'https', hostname: '*.r2.dev' },
  { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
  { protocol: 'https', hostname: 'images.unsplash.com' },
];

try {
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) {
    const { protocol, hostname } = new URL(api);
    if (hostname) {
      remotePatterns.push({
        protocol: protocol === 'http:' ? 'http' : 'https',
        hostname,
      });
    }
  }
} catch {
  // NEXT_PUBLIC_API_URL opcional durante CI
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/shared'],
  images: {
    remotePatterns,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
