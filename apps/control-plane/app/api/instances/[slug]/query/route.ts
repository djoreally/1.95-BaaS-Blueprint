import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../../../lib/api-auth';
import { instanceRequest } from '../../../../../lib/instance-api';

const IDENT = /^[A-Za-z0-9_-]+$/;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { collection?: string; filter?: string; page?: number; perPage?: number };
  const collection = body.collection || '';
  if (!IDENT.test(collection)) return NextResponse.json({ error: 'valid collection required' }, { status: 400 });
  const page = Math.max(1, Number(body.page || 1));
  const perPage = Math.min(200, Math.max(1, Number(body.perPage || 30)));
  const query: Record<string, string> = { page: String(page), perPage: String(perPage) };
  if (body.filter) query.filter = body.filter;
  const result = await instanceRequest<{ items?: Record<string, unknown>[]; totalItems?: number; page?: number; perPage?: number }>(
    user.id, slug, 'GET', `/api/collections/${collection}/records`, undefined, query,
  );
  return NextResponse.json({ instanceId: slug, collection, items: result.items ?? [], totalItems: result.totalItems ?? 0, page: result.page ?? page, perPage: result.perPage ?? perPage });
}
