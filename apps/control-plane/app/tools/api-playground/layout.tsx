import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API playground — InvisibleDB',
  description:
    'Fire live requests at a real InvisibleDB backend from your browser and watch the responses come back.',
};

export default function ApiPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
