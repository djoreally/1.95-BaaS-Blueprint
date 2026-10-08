import { redirect } from 'next/navigation';

// Legacy cPanel-era page (unsafe null assertions on obsolete job data).
// The VPS model shows databases on /projects. Redirect there.
export default function ProjectDetailPage() {
  redirect('/projects');
}
