export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import DatabaseSectionClient from '../../../components/DatabaseSectionClient';
import StorageManager from '../../../components/StorageManager';
import VectorManager from '../../../components/VectorManager';
import { currentUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';
const SECTIONS = new Set(['overview','connect','auth','database','storage','vector','realtime','backups','logs','settings']);

export default async function DatabaseSection({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { slug, section } = await params;
  if (!SECTIONS.has(section)) notFound();

  const request = await prisma.provisionRequest.findFirst({
    where: { userId: user.id, kind: 'provision', slug },
    orderBy: { createdAt: 'desc' },
  });
  if (!request) notFound();

  const endpoint = `https://${slug}.${BASE_DOMAIN}`;
  const ready = request.status === 'done';

  let content = <DatabaseSectionClient slug={slug} section={section} endpoint={endpoint} />;
  if (section === 'storage') content = <StorageManager slug={slug} />;
  if (section === 'vector') content = <VectorManager slug={slug} />;

  return (
    <div>
      <a href="/projects" style={{ color: '#8f8f8f', textDecoration: 'none', fontSize: 14 }}>← Databases</a>
      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem,7vw,3.2rem)' }}>{slug}</h1>
          <span className={`badge ${ready ? 'up' : ''}`}>{ready ? 'READY' : request.status.toUpperCase()}</span>
        </div>
        <p style={{ color: '#7f7f7f', margin: '8px 0 0' }}>InvisibleDB Cloud database · {section}</p>
      </div>
      {content}
    </div>
  );
}
