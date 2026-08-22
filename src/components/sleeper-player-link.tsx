import type { ReactNode } from "react";
import { sleeperPlayerUrl } from "@/lib/sleeper-player";

export function SleeperPlayerLink({
  id,
  name,
  position,
  children,
  className,
}: {
  id: string;
  name: string;
  position?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={["sleeper-player-link", className].filter(Boolean).join(" ")}
      href={sleeperPlayerUrl({ id, name, position })}
      target="_blank"
      rel="noreferrer"
      title={`Open ${name} on Sleeper`}
    >
      {children ?? name}
    </a>
  );
}

