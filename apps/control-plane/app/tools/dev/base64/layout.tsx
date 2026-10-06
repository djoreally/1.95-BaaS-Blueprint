import type { Metadata } from 'next';

const title = 'Base64 Encode Decode Online — Unicode Safe | InvisibleDB';
const description =
  'Free Base64 encoder and decoder that handles Unicode, emoji, and non-Latin text correctly. 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/base64' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/base64',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function Base64Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
