import type { Metadata } from 'next';

const title = 'Free SQLite Database Size Estimator | InvisibleDB';
const description =
  'How big is your database, really? Estimate your SQLite file size from rows and payloads — your entire backend fits in one portable file you own.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/sqlite-estimator' },
  openGraph: {
    type: 'website',
    url: '/tools/sqlite-estimator',
    title,
    description,
  images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function SqliteEstimatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
