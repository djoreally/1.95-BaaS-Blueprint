import { permanentRedirect } from 'next/navigation';

// BYOH cPanel flow removed — InvisibleDB is now VPS-only.
// Permanent redirect to the databases dashboard.
export default function ConnectPage() {
  permanentRedirect('/projects');
}
