"use client";

import { cn } from "@/lib/utils";

export const OPEN_CHAT_EVENT = "naeel:open-chat";

export function openChat() {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
}

/**
 * Lets server-rendered sections trigger the chat without pulling the whole
 * panel into their bundle — this dispatches an event that `ChatDock` listens
 * for, so the heavy chat code stays lazily loaded until it is actually needed.
 */
export function OpenChatButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" onClick={openChat} className={className}>
      {children}
    </button>
  );
}

export const primaryButton = cn(
  "group inline-flex items-center gap-2.5 rounded-sm bg-copper-500 px-6 py-3",
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink-900",
  "transition-colors duration-200 hover:bg-copper-400",
);

export const secondaryButton = cn(
  "group inline-flex items-center gap-2.5 rounded-sm border border-[color:var(--rule-strong)] px-6 py-3",
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-mist-100",
  "transition-colors duration-200 hover:border-copper-500 hover:text-copper-400",
);
