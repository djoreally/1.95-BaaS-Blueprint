import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vector search playground — InvisibleDB',
  description:
    'An interactive illustration of how semantic search works: toy embeddings, cosine similarity, ranked results — all in your browser.',
};

export default function VectorPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
