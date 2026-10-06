import type { Metadata } from 'next';

const title = 'Firebase vs Supabase vs PocketHost Costs | InvisibleDB';
const description =
  "Firebase vs Supabase vs PocketHost vs InvisibleDB: enter your usage once and compare honest prices on one table. 'Varies' where a price can't be verified.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/cost-comparator' },
  openGraph: {
    type: 'website',
    url: '/tools/cost-comparator',
    title,
    description,
  images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function CostComparatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
