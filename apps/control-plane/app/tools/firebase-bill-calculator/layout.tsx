import type { Metadata } from 'next';

const title = 'Firebase Pricing Calculator — Estimate Your Bill | InvisibleDB';
const description =
  "Estimate your real Firebase bill at scale with sourced rates — Firestore, Auth, and Storage side-by-side with InvisibleDB's flat $6.99/mo. Free calculator.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/firebase-bill-calculator' },
  openGraph: {
    type: 'website',
    url: '/tools/firebase-bill-calculator',
    title,
    description,
  images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function FirebaseBillCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
