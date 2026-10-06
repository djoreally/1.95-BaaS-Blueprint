import type { Metadata } from 'next';

const title = 'JWT Decoder Online — Inspect Header, Claims & Expiry | InvisibleDB';
const description =
  'Free JWT decoder: paste a token to see its header, payload claims, and expiry. Warns on unsigned (alg: none) tokens. 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/jwt-decoder' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/jwt-decoder',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function JwtDecoderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
