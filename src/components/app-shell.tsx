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
const toolsNav: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/rivalries", label: "Rivalries", icon: "teams" },
];
const archiveNav: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/drafts", label: "Drafts", icon: "spark" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/league", label: "League", icon: "league" },
];

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-pressed={theme === "dark"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        {theme === "light" ? (
          <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        )}
      </svg>
      <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}

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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
    const sync = (event: StorageEvent) => {
      if (event.key !== "ud-theme") return;
      const next = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("ud-theme", next);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  };
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
          <div className="nav-group">
            <span className="nav-label">Tools</span>
            {toolsNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <main className="page-content">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[...primaryNav, ...toolsNav]
          .filter((item) =>
            ["/", "/matchups", "/standings"].includes(item.href),
          )
          .sort(
            (a, b) =>
              ["/", "/matchups", "/standings"].indexOf(a.href) -
              ["/", "/matchups", "/standings"].indexOf(b.href),
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
              {[
                ...primaryNav.filter(
                  (item) =>
                    !["/", "/matchups", "/standings"].includes(item.href),
                ),
                ...archiveNav,
                ...toolsNav,
              ].map((item) => (
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
