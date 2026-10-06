import type { Metadata } from 'next';

const title = 'Vector Search Without Pinecone — Interactive Demo | InvisibleDB';
const description =
  'Vector search without Pinecone: an interactive demo of semantic search built into InvisibleDB — embeddings, cosine similarity, ranked results.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/tools/vector-playground' },
  openGraph: {
    type: 'website',
    url: '/tools/vector-playground',
    title,
    description,
  images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function VectorPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
