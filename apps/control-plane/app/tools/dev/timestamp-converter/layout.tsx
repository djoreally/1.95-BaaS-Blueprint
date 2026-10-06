import type { Metadata } from 'next';

const title = 'Unix Timestamp Converter — Epoch to ISO & Human Time | InvisibleDB';
const description =
  'Free timestamp converter: Unix seconds and milliseconds to ISO 8601, UTC, local, and relative time — and back. 100% in your browser.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/timestamp-converter' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/timestamp-converter',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function TimestampConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
