import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/auth';
import { InstanceManagementUnavailable, instanceMultipartRequest } from '../../../../../lib/instance-api';
import { prisma } from '../../../../../lib/db';

const IDENT = /^[A-Za-z0-9_-]+$/;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function owns(userId: string, slug: string) {
  return prisma.provisionRequest.findFirst({
    where: { userId, slug, kind: 'provision', status: 'done' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });

  const incoming = await req.formData();
  const collection = String(incoming.get('collection') || '');
  const recordId = String(incoming.get('recordId') || '');
  const field = String(incoming.get('field') || '');
  const file = incoming.get('file');

  if (!IDENT.test(collection) || !IDENT.test(recordId) || !IDENT.test(field)) {
    return NextResponse.json({ error: 'valid collection, recordId and field are required' }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'file must be between 1 byte and 25 MB' }, { status: 400 });
  }

  const form = new FormData();
  form.append(field, file, file.name);

  try {
    const result = await instanceMultipartRequest(
      user.id,
      slug,
      'PATCH',
      `/api/collections/${collection}/records/${recordId}`,
      form,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InstanceManagementUnavailable) {
      return NextResponse.json({ error: error.message, syncing: true }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'upload failed' }, { status: 502 });
  }
}
