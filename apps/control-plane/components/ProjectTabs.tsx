'use client';

import { useState } from 'react';

export default function ProjectTabs({ tabs }: { tabs: Array<{ id: string; label: string; content: React.ReactNode }> }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active);
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={t.id === active ? 'active' : ''}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={active}>{current?.content}</div>
    </div>
  );
}
