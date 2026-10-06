import type { MetadataRoute } from 'next';

const SITE = 'https://baas.innovarel.dev';

/**
 * Public marketing routes. App routes (/connect, /projects/*) are excluded —
 * they require authentication and should not be crawled.
 */
const ROUTES = [
  '/',
  '/pricing',
  '/docs',
  '/agents',
  '/tools',
  '/tools/firebase-bill-calculator',
  '/tools/api-playground',
  '/tools/vector-playground',
  '/tools/cost-comparator',
  '/tools/migration-estimator',
  '/tools/sqlite-estimator',
  '/tools/dev',
  '/tools/dev/secret-key-generator',
  '/tools/dev/hash-generator',
  '/tools/dev/uuid-generator',
  '/tools/dev/base64',
  '/tools/dev/url-encoder',
  '/tools/dev/jwt-decoder',
  '/tools/dev/json-formatter',
  '/tools/dev/timestamp-converter',
  '/signup',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '/' ? 1 : 0.8,
  }));
}
