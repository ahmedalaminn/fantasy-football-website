import Image from "next/image";
import Link from "next/link";
import type { Team } from "@/lib/types";
import { Icon, type IconName } from "./icon";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header reveal">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}
export function SectionHeader({
  title,
  kicker,
  href,
  action = "View all",
  info,
}: {
  title: string;
  kicker?: string;
  href?: string;
  action?: string;
  info?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h2 className={info ? "section-title-with-info" : undefined}>
          {title}
          {info}
        </h2>
      </div>
      {href && (
        <Link href={href} className="text-link">
          {action}
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
export function Card({
  children,
  className = "",
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "violet" | "aqua";
}) {
  return (
    <section className={`card ${accent ? `card-${accent}` : ""} ${className}`}>
      {children}
    </section>
  );
}
export function Avatar({
  src,
  name,
  size = "md",
  ring = false,
}: {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`avatar avatar-${size} ${ring ? "avatar-ring" : ""}`}>
      {src ? (
        <Image src={src} alt="" fill sizes="96px" />
      ) : (
        <span>{initials || "UD"}</span>
      )}
    </span>
  );
}
export function TeamIdentity({
  team,
  compact = false,
}: {
  team: Team;
  compact?: boolean;
}) {
  return (
    <div className={`team-identity ${compact ? "compact" : ""}`}>
      <Avatar
        src={team.avatarUrl}
        name={team.managerName}
        size={compact ? "sm" : "md"}
      />
      <span>
        <strong>{team.teamName}</strong>
        <small>{team.managerName}</small>
      </span>
    </div>
  );
}
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "aqua" | "violet" | "good";
}) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "aqua" | "violet" | "good" | "danger";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function EmptyState({
  icon = "spark",
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({
  message = "Sleeper data is temporarily unavailable. Try again in a moment.",
}: {
  message?: string;
}) {
  return (
    <div className="error-state">
      <span>Connection timeout</span>
      <h2>We couldn’t load the league</h2>
      <p>{message}</p>
    </div>
  );
}
export function Tabs({
  items,
  active,
  basePath,
  param = "tab",
}: {
  items: Array<{ id: string; label: string }>;
  active: string;
  basePath: string;
  param?: string;
}) {
  return (
    <nav className="tabs" aria-label="Page sections">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`${basePath}?${param}=${item.id}`}
          className={active === item.id ? "active" : ""}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
