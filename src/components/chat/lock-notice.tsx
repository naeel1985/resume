"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { profile } from "@/lib/content";

function remainingLabel(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (totalMinutes > 1) return `${totalMinutes} minutes`;
  return "less than a minute";
}

/**
 * Shown once the visitor has used their allowance. The countdown ticks live so
 * the panel does not need reopening to see the assistant come back.
 */
export function LockNotice({
  lockedUntil,
  scope,
}: {
  lockedUntil: number;
  scope: "visitor" | "ip" | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const left = lockedUntil - now;
  const availableAt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(lockedUntil));

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center">
      <span className="flex size-9 items-center justify-center border border-[color:var(--rule-strong)] text-copper-500">
        <Lock className="size-4" />
      </span>

      <p className="mt-5 text-lg leading-snug text-mist-100">
        {scope === "ip"
          ? "This network has used up its questions for now."
          : "You've used all your questions for now."}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-mist-500">
        The assistant will be available again in{" "}
        <span className="text-copper-400">{remainingLabel(left)}</span>, at{" "}
        <span className="font-mono text-mist-300">{availableAt}</span>.
      </p>

      <div className="mt-7 border border-[color:var(--rule)] p-5">
        <p className="label text-copper-500">In the meantime</p>
        <p className="mt-3 text-sm leading-relaxed text-mist-300">
          Your conversation has been sent to {profile.name.split(" ")[0]}. If you
          left an email address he&apos;ll reply directly — or reach him now:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a
              href={`mailto:${profile.email}`}
              className="text-copper-400 underline underline-offset-4 hover:text-copper-500"
            >
              {profile.email}
            </a>
          </li>
          <li>
            <a
              href={`tel:${profile.phoneHref}`}
              className="text-copper-400 underline underline-offset-4 hover:text-copper-500"
            >
              {profile.phone}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
