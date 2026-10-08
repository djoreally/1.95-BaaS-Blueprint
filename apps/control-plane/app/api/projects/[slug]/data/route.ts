import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/db';
import { InstanceManagementUnavailable, instanceRequest } from '../../../../../lib/instance-api';

const IDENT = /^[A-Za-z0-9_-]+$/;

async function owns(userId: string, slug: string) {
  return prisma.provisionRequest.findFirst({
    where: { userId, slug, kind: 'provision', status: 'done' },
    orderBy: { createdAt: 'desc' },
  });
}

function managementError(error: unknown) {
  if (error instanceof InstanceManagementUnavailable) {
    return NextResponse.json({ error: error.message, syncing: true }, { status: 503 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : 'instance request failed' }, { status: 502 });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });

  const url = new URL(req.url);
  const resource = url.searchParams.get('resource') || 'collections';

  try {
    if (resource === 'collections') {
      const data = await instanceRequest(user.id, slug, 'GET', '/api/collections', undefined, { page: '1', perPage: '200' });
      return NextResponse.json(data);
    }

    if (resource === 'records') {
      const collection = url.searchParams.get('collection') || '';
      if (!IDENT.test(collection)) return NextResponse.json({ error: 'valid collection required' }, { status: 400 });
      const page = String(Math.max(1, Number(url.searchParams.get('page') || 1)));
      const perPage = String(Math.min(100, Math.max(1, Number(url.searchParams.get('perPage') || 50))));
      const query: Record<string, string> = { page, perPage };
      const filter = url.searchParams.get('filter');
      const sort = url.searchParams.get('sort');
      if (filter) query.filter = filter;
      if (sort) query.sort = sort;
      const data = await instanceRequest(user.id, slug, 'GET', `/api/collections/${collection}/records`, undefined, query);
      return NextResponse.json(data);
    }

    if (resource === 'auth') {
      const collections = await instanceRequest<{ items?: Array<Record<string, unknown>> }>(
        user.id,
        slug,
        'GET',
        '/api/collections',
        undefined,
        { page: '1', perPage: '200' },
      );
      const authCollections = (collections.items ?? []).filter((item) => item.type === 'auth');
      const requested = url.searchParams.get('collection') || '';
      if (!requested) return NextResponse.json({ collections: authCollections, records: null });
      if (!IDENT.test(requested) || !authCollections.some((item) => item.name === requested || item.id === requested)) {
        return NextResponse.json({ error: 'auth collection not found' }, { status: 404 });
      }
      const records = await instanceRequest(user.id, slug, 'GET', `/api/collections/${requested}/records`, undefined, { page: '1', perPage: '100' });
      return NextResponse.json({ collections: authCollections, records });
    }

    if (resource === 'health') {
      return NextResponse.json(await instanceRequest(user.id, slug, 'GET', '/api/health'));
    }

    if (resource === 'vector') {
      return NextResponse.json(await instanceRequest(user.id, slug, 'GET', '/api/vector/status'));
    }

    return NextResponse.json({ error: 'unsupported resource' }, { status: 400 });
  } catch (error) {
    return managementError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });

  const body = (await req.json()) as {
    action?: string;
    collection?: string;
    id?: string;
    data?: unknown;
    embedding?: number[];
    limit?: number;
  };
  const collection = body.collection || '';
  const id = body.id || '';

  try {
    switch (body.action) {
      case 'collection.create':
        return NextResponse.json(await instanceRequest(user.id, slug, 'POST', '/api/collections', body.data));
      case 'collection.update':
        if (!IDENT.test(collection)) return NextResponse.json({ error: 'valid collection required' }, { status: 400 });
        return NextResponse.json(await instanceRequest(user.id, slug, 'PATCH', `/api/collections/${collection}`, body.data));
      case 'collection.delete':
        if (!IDENT.test(collection)) return NextResponse.json({ error: 'valid collection required' }, { status: 400 });
        await instanceRequest(user.id, slug, 'DELETE', `/api/collections/${collection}`);
        return NextResponse.json({ ok: true });
      case 'record.create':
      case 'auth.create':
        if (!IDENT.test(collection)) return NextResponse.json({ error: 'valid collection required' }, { status: 400 });
        return NextResponse.json(await instanceRequest(user.id, slug, 'POST', `/api/collections/${collection}/records`, body.data));
      case 'record.update':
      case 'auth.update':
        if (!IDENT.test(collection) || !IDENT.test(id)) return NextResponse.json({ error: 'valid collection and record id required' }, { status: 400 });
        return NextResponse.json(await instanceRequest(user.id, slug, 'PATCH', `/api/collections/${collection}/records/${id}`, body.data));
      case 'record.delete':
      case 'auth.delete':
        if (!IDENT.test(collection) || !IDENT.test(id)) return NextResponse.json({ error: 'valid collection and record id required' }, { status: 400 });
        await instanceRequest(user.id, slug, 'DELETE', `/api/collections/${collection}/records/${id}`);
        return NextResponse.json({ ok: true });
      case 'vector.upsert':
        if (!IDENT.test(collection) || !IDENT.test(id) || !Array.isArray(body.embedding) || !body.embedding.length) {
          return NextResponse.json({ error: 'collection, record id and embedding are required' }, { status: 400 });
        }
        return NextResponse.json(await instanceRequest(user.id, slug, 'POST', '/api/vector/upsert', {
          collection,
          id,
          embedding: body.embedding,
        }));
      case 'vector.delete':
        if (!IDENT.test(collection) || !IDENT.test(id)) {
          return NextResponse.json({ error: 'collection and record id are required' }, { status: 400 });
        }
        return NextResponse.json(await instanceRequest(user.id, slug, 'POST', '/api/vector/delete', { collection, id }));
      case 'vector.query':
        if (!IDENT.test(collection) || !Array.isArray(body.embedding) || !body.embedding.length) {
          return NextResponse.json({ error: 'collection and embedding are required' }, { status: 400 });
        }
        return NextResponse.json(await instanceRequest(user.id, slug, 'POST', '/api/vector/query', {
          collection,
          embedding: body.embedding,
          limit: Math.min(100, Math.max(1, Number(body.limit || 10))),
        }));
      default:
        return NextResponse.json({ error: 'unsupported action' }, { status: 400 });
    }
  } catch (error) {
    return managementError(error);
  }
}
