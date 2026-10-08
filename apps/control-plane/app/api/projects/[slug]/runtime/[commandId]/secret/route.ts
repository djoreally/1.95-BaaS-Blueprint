import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../../../lib/auth';
import { decryptSecret } from '../../../../../../../lib/crypto';
import { prisma } from '../../../../../../../lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; commandId: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { slug, commandId } = await params;
  const command = await prisma.runtimeCommand.findFirst({
    where: { id: commandId, userId: user.id, slug, status: 'done' },
  });
  if (!command?.secretResultEncrypted) {
    return NextResponse.json({ error: 'secret unavailable or already viewed' }, { status: 404 });
  }

  const secret = decryptSecret(command.secretResultEncrypted);
  await prisma.runtimeCommand.update({
    where: { id: command.id },
    data: { secretResultEncrypted: null },
  });

  return NextResponse.json({ secret, oneTime: true });
}
