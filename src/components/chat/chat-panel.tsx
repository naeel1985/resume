"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Square, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { LockNotice } from "@/components/chat/lock-notice";
import { useChat } from "@/components/chat/use-chat";
import { chatSuggestions, profile } from "@/lib/content";
import { cn } from "@/lib/utils";

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const { messages, streaming, error, quota, locked, send, stop, reset, endSession } =
    useChat();
  const [input, setInput] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Closing the panel is what tells the server to email the transcript. */
  const close = () => {
    endSession();
    onClose();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!input.trim() || streaming || locked) return;
    void send(input);
    setInput("");
  };

  /* Only surface the counter once it starts to matter. */
  const showRemaining =
    quota !== null && !locked && quota.remaining <= 10 && quota.remaining > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${profile.name}'s assistant`}
        className="flex h-[92dvh] w-full max-w-3xl flex-col border border-[color:var(--rule-strong)] bg-ink-800 shadow-2xl sm:h-[80vh] sm:rounded-sm"
      >
        {/* ------------------------------------------------------ header */}
        <header className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-mist-100">
              <span aria-hidden className="size-1.5 rounded-full bg-copper-500" />
              Assistant
            </p>
            <p className="label mt-1.5 truncate">
              Answers as {profile.name} · Claude Haiku 4.5
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={reset}
                aria-label="Start a new conversation"
                title="Start a new conversation"
                className="rounded-sm p-2 text-mist-500 transition-colors hover:bg-white/5 hover:text-mist-100"
              >
                <RotateCcw className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="rounded-sm p-2 text-mist-500 transition-colors hover:bg-white/5 hover:text-mist-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* --------------------------------------------------- transcript */}
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-6">
          {locked && messages.length === 0 ? (
            <LockNotice lockedUntil={quota!.lockedUntil!} scope={quota!.scope} />
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <p className="label text-copper-500">Start here</p>
              <p className="mt-4 text-lg leading-snug text-mist-100">
                Ask about a project, a technology, or how {profile.name.split(" ")[0]}{" "}
                would approach a system.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-mist-500">
                Answers come from his actual project history. Anything the
                assistant cannot answer is passed on to him directly.
              </p>

              <ul className="mt-7 space-y-px">
                {chatSuggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="group flex w-full items-center gap-3 border border-[color:var(--rule)] px-4 py-3 text-left text-sm text-mist-300 transition-colors hover:border-copper-600 hover:text-mist-100"
                    >
                      <span
                        aria-hidden
                        className="size-1 shrink-0 rotate-45 bg-copper-600 transition-colors group-hover:bg-copper-400"
                      />
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="space-y-6">
              {messages.map((message, index) => (
                <li
                  key={index}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <span className="label mb-2">
                    {message.role === "user" ? "You" : profile.name.split(" ")[0]}
                  </span>

                  {message.role === "user" ? (
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-sm bg-copper-500 px-4 py-2.5 text-sm leading-relaxed text-ink-900">
                      {message.content}
                    </p>
                  ) : message.content ? (
                    <div className="answer max-w-[92%] border-l-2 border-copper-600 pl-4 text-sm text-mist-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pl-4" aria-label="Thinking">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="blink size-1 rounded-full bg-copper-500"
                          style={{ animationDelay: `${dot * 180}ms` }}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p
              role="alert"
              className="mt-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          {/* Lock reached mid-conversation: the answer above stays readable. */}
          {locked && messages.length > 0 ? (
            <div className="mt-8 border-t border-[color:var(--rule)] pt-8">
              <LockNotice lockedUntil={quota!.lockedUntil!} scope={quota!.scope} />
            </div>
          ) : null}

          <div ref={endRef} />
        </div>

        {/* -------------------------------------------------------- input */}
        <form
          onSubmit={submit}
          className="border-t border-[color:var(--rule)] px-5 py-4"
        >
          <div
            className={cn(
              "flex items-end gap-3 border bg-ink-700 px-3.5 py-2.5 transition-colors",
              locked
                ? "border-[color:var(--rule)] opacity-60"
                : "border-[color:var(--rule-strong)] focus-within:border-copper-600",
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={
                locked
                  ? "The assistant is unavailable right now"
                  : "Ask about a project, technology, or certification…"
              }
              disabled={streaming || locked}
              className="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm leading-relaxed text-mist-100 outline-none placeholder:text-mist-500 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="shrink-0 rounded-sm border border-[color:var(--rule-strong)] p-1.5 text-mist-300 transition-colors hover:text-mist-100"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || locked}
                aria-label="Send message"
                className="shrink-0 rounded-sm bg-copper-500 p-1.5 text-ink-900 transition-colors hover:bg-copper-400 disabled:bg-white/10 disabled:text-mist-500"
              >
                <ArrowUp className="size-3.5" />
              </button>
            )}
          </div>

          <p className="label mt-2.5 flex flex-wrap items-center gap-x-2 text-[0.625rem]">
            {locked ? (
              <span>Transcript sent to {profile.name.split(" ")[0]}</span>
            ) : (
              <>
                <span>Enter to send · Shift + Enter for a new line</span>
                {showRemaining ? (
                  <span className="text-copper-500">
                    · {quota!.remaining} question
                    {quota!.remaining === 1 ? "" : "s"} left this hour
                  </span>
                ) : null}
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
