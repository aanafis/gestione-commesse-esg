"use client";

import { useState } from "react";

export function Tabs({
  tabs,
}: {
  tabs: { label: string; count?: number; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-gridline overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              i === active
                ? "border-accent text-ink-primary"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-ink-muted">({tab.count})</span>
            )}
          </button>
        ))}
      </div>
      <div>{tabs[active].content}</div>
    </div>
  );
}
