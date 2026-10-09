import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../../../lib/api-auth';
import { decryptSecret } from '../../../../../lib/crypto';
import { prisma } from '../../../../../lib/db';

const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const credential = await prisma.instanceCredential.findUnique({ where: { userId_slug: { userId: user.id, slug } } });
  if (!credential) return NextResponse.json({ error: 'management credential is still synchronizing' }, { status: 503 });
  const apiKey = decryptSecret(credential.apiKeyEncrypted);
  const baseUrl = `https://${slug}.${BASE_DOMAIN}`;
  return NextResponse.json({
    instanceId: slug,
    baseUrl,
    adminUrl: `${baseUrl}/_/`,
    apiKey,
    dartSnippet: `final db = PocketBase('${baseUrl}');`,
    restSnippet: `curl -H 'Authorization: Bearer ${apiKey}' '${baseUrl}/api/collections'`,
  });
}
