"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Quota = {
  remaining: number;
  limit: number;
  /** Epoch ms when the assistant unlocks; null when not locked. */
  lockedUntil: number | null;
  /** "ip" when the shared network ran out rather than this browser. */
  scope: "visitor" | "ip" | null;
};

const STORAGE_KEY = "naeel:chat";
const MAX_HISTORY = 40;

type Persisted = { sessionId: string | null; messages: ChatMessage[] };

function load(): Persisted {
  if (typeof window === "undefined") return { sessionId: null, messages: [] };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessionId: null, messages: [] };
    const parsed = JSON.parse(raw) as Persisted;
    return {
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { sessionId: null, messages: [] };
  }
}

/**
 * Tells the server the conversation is over so the transcript is emailed.
 *
 * During page unload only `sendBeacon` is reliable — `fetch` is cancelled when
 * the document goes away. Everywhere else a normal keepalive fetch is used so
 * failures are at least visible in the console.
 */
function notifyClose(sessionId: string, reason: string, duringUnload: boolean) {
  const body = JSON.stringify({ sessionId, reason });
  const url = "/api/session/close";

  if (duringUnload && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body,
    keepalive: true,
  }).catch(() => {
    /* transcript delivery is best-effort from the client's side */
  });
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  messagesRef.current = messages;

  /* Restore an in-progress conversation when the panel is reopened. */
  useEffect(() => {
    const restored = load();
    sessionIdRef.current = restored.sessionId;
    if (restored.messages.length) setMessages(restored.messages);
  }, []);

  /* Ask the server how many questions are left before the visitor types. */
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/session/quota", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Quota | null) => {
        if (!cancelled && body) setQuota(body);
      })
      .catch(() => {
        /* the chat still works; the counter just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Clear the lock automatically the moment the hour is up. */
  useEffect(() => {
    if (!quota?.lockedUntil) return;
    const remaining = quota.lockedUntil - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setQuota({ remaining: quota.limit, limit: quota.limit, lockedUntil: null, scope: null });
      setError(null);
    }, remaining + 500);
    return () => clearTimeout(timer);
  }, [quota]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: messages.slice(-MAX_HISTORY),
        } satisfies Persisted),
      );
    } catch {
      /* private browsing / quota — not worth surfacing */
    }
  }, [messages]);

  /* Trigger 2: the visitor closes the tab or navigates away. */
  useEffect(() => {
    const flush = () => {
      const id = sessionIdRef.current;
      if (id && messagesRef.current.length) notifyClose(id, "page-closed", true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* Trigger 1: the visitor closes the chat panel. */
  const endSession = useCallback(() => {
    const id = sessionIdRef.current;
    if (id && messagesRef.current.length) notifyClose(id, "chat-closed", false);
  }, []);

  const send = useCallback(async (input: string) => {
    const text = input.trim();
    if (!text) return;

    setError(null);
    setStreaming(true);

    const history = messagesRef.current.slice(-MAX_HISTORY);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    /** Rewrites the trailing assistant bubble as tokens arrive. */
    const writeAnswer = (updater: (previous: string) => string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last]!.role === "assistant") {
          next[last] = { role: "assistant", content: updater(next[last]!.content) };
        }
        return next;
      });
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          sessionId: sessionIdRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response
          .json()
          .then((parsed: { error?: string; quota?: Quota }) => parsed)
          .catch(() => null);
        // A 429 from the quota carries the lock state, so the UI can switch
        // straight to the countdown instead of just showing an error.
        if (body?.quota) setQuota(body.quota);
        throw new Error(body?.error ?? `Request failed (${response.status}).`);
      }

      const headerSession = response.headers.get("x-session-id");
      if (headerSession) sessionIdRef.current = headerSession;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // SSE frames can straddle chunk boundaries, so hold a buffer and only
      // consume up to the last complete blank-line separator.
      let buffer = "";
      let failed: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let separator = buffer.indexOf("\n\n");
          while (separator !== -1) {
            const frame = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            separator = buffer.indexOf("\n\n");

            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;

            try {
              const event = JSON.parse(line.slice(5).trim()) as {
                type: string;
                text?: string;
                sessionId?: string;
                error?: string;
                quota?: Quota;
              };

              if (event.quota) setQuota(event.quota);

              if (event.type === "session" && event.sessionId) {
                sessionIdRef.current = event.sessionId;
              } else if (event.type === "delta" && event.text) {
                writeAnswer((prev) => prev + event.text);
              } else if (event.type === "error") {
                failed = event.error ?? "Something went wrong.";
              }
            } catch {
              /* ignore a malformed frame rather than killing the stream */
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (failed) throw new Error(failed);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      const detail =
        caught instanceof Error ? caught.message : "Something went wrong.";
      setError(detail);
      // Drop the empty assistant bubble so the error is not shown twice.
      setMessages((prev) =>
        prev.length && prev[prev.length - 1]!.role === "assistant" && !prev[prev.length - 1]!.content
          ? prev.slice(0, -1)
          : prev,
      );
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    endSession();
    stop();
    setMessages([]);
    setError(null);
    sessionIdRef.current = null;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [endSession, stop]);

  const locked = Boolean(quota?.lockedUntil && quota.lockedUntil > Date.now());

  return { messages, streaming, error, quota, locked, send, stop, reset, endSession };
}
