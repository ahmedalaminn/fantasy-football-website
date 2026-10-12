"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function InfoPopover({
  title,
  sections,
  footer,
}: {
  title: string;
  sections: { title: string; items: string[] }[];
  footer?: React.ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const keepOpen = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const show = () => {
    keepOpen();
    const rect = trigger.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(
          12,
          Math.min(
            rect.left,
            window.innerWidth - Math.min(320, window.innerWidth - 24) - 12,
          ),
        ),
        top: Math.min(rect.bottom + 8, window.innerHeight - 160),
      });
  };
  const hide = () => {
    timer.current = setTimeout(() => setPosition(null), 150);
  };
  return (
    <span className="info-popover-trigger">
      <button
        ref={trigger}
        type="button"
        aria-label={title}
        aria-expanded={!!position}
        aria-controls={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPosition(null);
        }}
      >
        ⓘ
      </button>
      {position &&
        createPortal(
          <aside
            id={id}
            role="dialog"
            aria-label={title}
            className="info-popover"
            style={{
              ...position,
              maxHeight: `calc(100dvh - ${position.top + 12}px)`,
            }}
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
            onFocus={keepOpen}
            onBlur={hide}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                trigger.current?.focus();
                setPosition(null);
              }
            }}
          >
            <header>
              <strong>{title}</strong>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={() => setPosition(null)}
              >
                ×
              </button>
            </header>
            {sections.map((section) => (
              <section key={section.title}>
                <h4>{section.title}</h4>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
            {footer && <footer>{footer}</footer>}
          </aside>,
          document.body,
        )}
    </span>
  );
}
