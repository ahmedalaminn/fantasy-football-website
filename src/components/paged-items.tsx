"use client";
import { useState, type ReactNode } from "react";
export function PagedItems({
  items,
  pageSize = 6,
  label,
  className,
}: {
  items: ReactNode[];
  pageSize?: number;
  label: string;
  className?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(items.length / pageSize);
  const current = Math.min(page, Math.max(0, pages - 1));
  return (
    <div>
      {pages > 1 && (
        <nav className="list-pagination" aria-label={`${label} pages`}>
          <button
            className="button"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            ← Previous
          </button>
          <span aria-live="polite">
            {current * pageSize + 1}–
            {Math.min((current + 1) * pageSize, items.length)} of {items.length}
          </span>
          <button
            className="button"
            disabled={current + 1 === pages}
            onClick={() => setPage(current + 1)}
          >
            Next →
          </button>
        </nav>
      )}
      <div className={className}>
        {items.slice(current * pageSize, (current + 1) * pageSize)}
      </div>
    </div>
  );
}
