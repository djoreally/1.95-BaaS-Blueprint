export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getConnection } from '../../../lib/connection';
import NewProjectForm from '../../../components/NewProjectForm';

/** New-project wizard (step 1 of provisioning). */
export default async function NewProjectPage() {
  const conn = await getConnection();
  if (!conn) redirect('/connect');
  return (
    <>
      <h1>New project</h1>
      <p style={{ color: 'var(--muted)' }}>
        One backend per project: its own subdomain, its own MySQL database, its own PocketBase.
      </p>
      <NewProjectForm domains={conn.domains} defaultDomain={conn.mainDomain} />
    </>
  );
}
