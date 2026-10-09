import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../../../../lib/api-auth';

const GATES = new Set(['typecheck','unit-tests','integration-tests','security','migration-safety','production-readiness']);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; gate: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug, gate } = await params;
  if (!GATES.has(gate)) return NextResponse.json({ error: 'unknown gate' }, { status: 400 });
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  return NextResponse.json({ instanceId: slug, gate, state: 'UNKNOWN', evidence: [], checkedAt: new Date().toISOString() });
}
