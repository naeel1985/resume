"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

import { OPEN_CHAT_EVENT } from "@/components/chat/open-chat-button";

/**
 * The panel pulls in react-markdown, remark-gfm and the streaming client —
 * none of which the landing page needs. Loading it on demand keeps that off
 * the critical path entirely; nothing is fetched until someone opens the chat.
 */
const ChatPanel = dynamic(() => import("@/components/chat/chat-panel"), {
  ssr: false,
});

export function ChatDock() {
  const [open, setOpen] = useState(false);
  const [prefetched, setPrefetched] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  // Warm the chunk on first hover so the panel appears instantly on click.
  const prefetch = () => {
    if (prefetched) return;
    setPrefetched(true);
    void import("@/components/chat/chat-panel");
  };

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          aria-label="Open chat"
          className="group fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-sm bg-copper-500 px-4 py-3 shadow-lg shadow-ink-900/40 transition-colors hover:bg-copper-400"
        >
          <MessageSquare className="size-4 text-ink-900" />
          <span className="hidden font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink-900 sm:inline">
            Ask
          </span>
        </button>
      ) : null}

      {open ? <ChatPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}
