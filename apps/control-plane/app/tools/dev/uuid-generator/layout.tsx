import type { Metadata } from 'next';

const title = 'UUID Generator — Bulk UUID v4 Online | InvisibleDB';
const description =
  'Generate up to 100 UUID v4 at once with crypto.randomUUID. Free bulk UUID generator, 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/uuid-generator' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/uuid-generator',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function UuidGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
