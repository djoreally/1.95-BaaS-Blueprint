import { redirect } from 'next/navigation';

// BYOH cPanel flow removed — InvisibleDB is now VPS-only.
// Redirect to the databases dashboard.
export default function ConnectPage() {
  redirect('/projects');
}
