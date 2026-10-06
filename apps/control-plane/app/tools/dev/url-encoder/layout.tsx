import type { Metadata } from 'next';

const title = 'URL Encoder Decoder Online — Percent Encoding | InvisibleDB';
const description =
  'Free URL encoder and decoder: percent-encode full URLs or individual components, decode them back. 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/url-encoder' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/url-encoder',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function UrlEncoderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
