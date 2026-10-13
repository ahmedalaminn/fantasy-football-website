"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "./ui";
export function RivalryPicker({
  people,
  one,
  two,
}: {
  people: { id: string; name: string; avatar: string | null }[];
  one: string;
  two: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<"one" | "two" | null>(null);
  const [pending, startTransition] = useTransition();
  function choose(side: "one" | "two", id: string) {
    const a = side === "one" ? id : one;
    const b = side === "two" ? id : two;
    setExpanded(null);
    startTransition(() =>
      router.replace(
        `/rivalries?p1=${encodeURIComponent(a)}&p2=${encodeURIComponent(b)}`,
        { scroll: false },
      ),
    );
  }
  return (
    <div className="rival-picker" aria-busy={pending}>
      {(["one", "two"] as const).map((side) => (
        <fieldset key={side} data-expanded={expanded === side}>
          <legend>
            {side === "one" ? "Choose a manager" : "Choose an opponent"}
          </legend>
          <button
            className="rival-current"
            type="button"
            aria-expanded={expanded === side}
            onClick={() => setExpanded(expanded === side ? null : side)}
          >
            <Avatar
              src={
                people.find((p) => p.id === (side === "one" ? one : two))
                  ?.avatar
              }
              name={
                people.find((p) => p.id === (side === "one" ? one : two))
                  ?.name || "Manager"
              }
              size="sm"
            />
            <strong>
              {people.find((p) => p.id === (side === "one" ? one : two))?.name}
            </strong>
            <span>Change ›</span>
          </button>
          <div className="rival-options">
            {people.map((person) => (
              <button
                type="button"
                key={person.id}
                disabled={pending || person.id === (side === "one" ? two : one)}
                aria-pressed={person.id === (side === "one" ? one : two)}
                onClick={() => choose(side, person.id)}
              >
                <Avatar src={person.avatar} name={person.name} size="xs" />
                <span>{person.name}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <p role="status">
        {pending
          ? "Updating comparison…"
          : "Choose either manager to compare instantly."}
      </p>
    </div>
  );
}
