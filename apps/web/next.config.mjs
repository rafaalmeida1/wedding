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
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    const { protocol, hostname } = new URL(appUrl);
    if (hostname) {
      remotePatterns.push({
        protocol: protocol === 'http:' ? 'http' : 'https',
        hostname,
      });
    }
  }
} catch {
  // APP_URL opcional durante CI
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/shared', '@repo/db'],
  webpack: (config) => {
    // @repo/shared uses NodeNext-style `.js` specifiers on `.ts` sources; map them for webpack.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  images: {
    remotePatterns,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
