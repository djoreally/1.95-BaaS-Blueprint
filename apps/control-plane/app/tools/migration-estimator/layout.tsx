import type { Metadata } from 'next';

const title = 'Migrate from Firebase — Free Migration Estimator | InvisibleDB';
const description =
  'Leaving Firebase, Supabase, or PocketHost? Answer five questions for a migration plan: what transfers as-is, what needs rework, and how long it takes.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/migration-estimator' },
  openGraph: {
    type: 'website',
    url: '/tools/migration-estimator',
    title,
    description,
  images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function MigrationEstimatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
