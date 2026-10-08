import { redirect } from 'next/navigation';

// Legacy cPanel-era page. The VPS model provisions databases automatically
// via the Stripe webhook → provision queue. Redirect to the dashboard.
export default function NewProjectPage() {
  redirect('/projects');
}
