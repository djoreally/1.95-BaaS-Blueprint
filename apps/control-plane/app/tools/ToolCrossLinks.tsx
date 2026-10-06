/**
 * "More free tools" cross-link strip for tool pages (SEO internal linking).
 * Pass the current tool's href so it is excluded from the list.
 */
import Link from 'next/link';

const TOOLS: { href: string; title: string; pitch: string }[] = [
  {
    href: '/tools/firebase-bill-calculator',
    title: 'Firebase bill calculator',
    pitch: 'estimate your real Firebase costs',
  },
  {
    href: '/tools/cost-comparator',
    title: 'BaaS cost comparator',
    pitch: 'Firebase vs Supabase vs PocketHost vs InvisibleDB',
  },
  {
    href: '/tools/migration-estimator',
    title: 'Migration estimator',
    pitch: 'get an honest plan for leaving your backend',
  },
  {
    href: '/tools/sqlite-estimator',
    title: 'SQLite size estimator',
    pitch: 'see how small your database really is',
  },
  {
    href: '/tools/api-playground',
    title: 'API playground',
    pitch: 'fire live requests at a real backend',
  },
  {
    href: '/tools/vector-playground',
    title: 'Vector search demo',
    pitch: 'semantic search with no Pinecone required',
  },
];

export default function ToolCrossLinks({ current }: { current: string }) {
  const others = TOOLS.filter((t) => t.href !== current);
  return (
    <nav className="tool-crosslinks" aria-label="More free tools">
      <h2>More free tools</h2>
      <ul>
        {others.map((t) => (
          <li key={t.href}>
            <Link href={t.href}>
              <strong>{t.title}</strong> — {t.pitch}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/pricing">
            <strong>InvisibleDB pricing</strong> — one flat $6.99/mo, first month $1
          </Link>
        </li>
        <li>
          <Link href="/docs">
            <strong>Documentation</strong> — ship with the Dart SDK, JS, or REST
          </Link>
        </li>
      </ul>
    </nav>
  );
}
