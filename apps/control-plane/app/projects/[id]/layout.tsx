import { notFound, redirect } from 'next/navigation';
import { currentUser } from '../../../lib/auth';
import { prisma } from '../../../lib/db';

export default async function ProjectOwnershipLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const owned = await prisma.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!owned) notFound();
  return children;
}
