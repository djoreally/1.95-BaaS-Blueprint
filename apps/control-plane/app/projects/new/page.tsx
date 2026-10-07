export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUser } from '../../../lib/auth';
import { getByohConnection, getPlatformConnection, hostedBaseDomain, normalizeHostingMode } from '../../../lib/hosting';
import NewProjectForm from '../../../components/NewProjectForm';

export default async function NewProjectPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const jar = await cookies();
  const hostingMode = normalizeHostingMode(jar.get('baas_hosting_mode')?.value);
  const conn = hostingMode === 'HOSTED' ? await getPlatformConnection() : await getByohConnection(user.id);

  if (!conn) {
    if (hostingMode === 'HOSTED') {
      throw new Error('Managed hosting is not configured yet. The platform owner must connect the hosting account first.');
    }
    redirect('/connect');
  }

  const baseDomain = hostingMode === 'HOSTED' ? hostedBaseDomain(conn) : conn.mainDomain;
  if (!baseDomain) throw new Error('No base domain is configured for project provisioning.');

  return (
    <>
      <h1>{hostingMode === 'HOSTED' ? 'Create your hosted project' : 'New project'}</h1>
      <p style={{ color: 'var(--muted)' }}>
        {hostingMode === 'HOSTED'
          ? 'Your backend is provisioned on our managed hosting automatically. Hosted storage allowance: 0.5 GB per project.'
          : 'One backend per project: its own subdomain, its own MySQL database, its own PocketBase.'}
      </p>
      <NewProjectForm
        domains={hostingMode === 'HOSTED' ? [baseDomain] : conn.domains}
        defaultDomain={baseDomain}
        hostingMode={hostingMode}
      />
    </>
  );
}
