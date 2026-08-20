"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icon";

const primaryNav: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/matchups", label: "Matchups", icon: "matchups" },
  { href: "/activity", label: "Activity", icon: "activity" },
  { href: "/standings", label: "Standings", icon: "standings" },
  { href: "/teams", label: "Teams", icon: "teams" },
];
const archiveNav: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/history", label: "History", icon: "history" },
  { href: "/league", label: "League", icon: "league" },
];

function NavLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: IconName;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === href : (pathname ?? "").startsWith(href);
  return (
    <Link
      href={href}
      className={`nav-link ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="UD Fantasy Football home">
          <span className="brand-orbit">
            <span>UD</span>
          </span>
          <span className="brand-copy">
            <strong>UD Fantasy</strong>
            <small>League HQ</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <div className="nav-group">
            <span className="nav-label">Season</span>
            {primaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
          <div className="nav-group">
            <span className="nav-label">League</span>
            {archiveNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
        <a
          className="sleeper-link"
          href="https://sleeper.com/"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            <small>Open league in</small>
            <strong>Sleeper</strong>
          </span>
          <Icon name="external" />
        </a>
      </aside>
      <div className="mobile-header">
        <Link href="/" className="mobile-brand">
          <span>UD</span>
          <strong>Fantasy Football</strong>
        </Link>
        <span className="live-pill">
          <i /> League HQ
        </span>
      </div>
      <main className="page-content">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {primaryNav
          .filter((item) =>
            ["/", "/matchups", "/standings", "/teams"].includes(item.href),
          )
          .map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        <button
          className={moreOpen ? "active" : ""}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <Icon name="more" />
          <span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="more-backdrop" onClick={() => setMoreOpen(false)}>
          <section
            className="more-sheet"
            onClick={(event) => event.stopPropagation()}
            aria-label="More navigation"
          >
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <span className="eyebrow">Explore</span>
                <h2>More from the league</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="sheet-links">
              {[primaryNav[2], ...archiveNav].map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
