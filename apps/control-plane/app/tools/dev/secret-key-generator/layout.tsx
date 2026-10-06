import type { Metadata } from 'next';

const title = 'Secret Key Generator — Secure Random API Keys | InvisibleDB';
const description =
  'Generate cryptographically secure secret keys, API keys, and tokens — hex, Base64, Base64URL, alphanumeric, or UUID. Uses the Web Crypto API, 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/secret-key-generator' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/secret-key-generator',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function SecretKeyGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
