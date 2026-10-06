import type { Metadata } from 'next';

const title = 'SHA-256 Hash Generator Online — SHA-384 & SHA-512 | InvisibleDB';
const description =
  'Compute SHA-256, SHA-384, and SHA-512 hashes of any text instantly. Uses the Web Crypto API, 100% in your browser — nothing uploaded.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/hash-generator' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/hash-generator',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function HashGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
