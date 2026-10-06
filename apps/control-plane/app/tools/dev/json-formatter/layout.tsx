import type { Metadata } from 'next';

const title = 'JSON Formatter Online — Format, Minify & Validate | InvisibleDB';
const description =
  'Free JSON formatter, minifier, and validator with precise error locations. 100% in your browser — your data never leaves the page.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/dev/json-formatter' },
  openGraph: {
    type: 'website',
    url: '/tools/dev/json-formatter',
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function JsonFormatterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
