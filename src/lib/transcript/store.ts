import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { sendTranscriptMail } from "./mailer";
import { buildHtml, buildSubject, buildText } from "./render";
import {
  isValidSessionId,
  type FlushReason,
  type SessionRecord,
  type TranscriptMessage,
  type TranscriptMeta,
} from "./types";

/**
 * Conversation capture and delivery.
 *
 * A transcript is emailed when any of three things happen:
 *
 *   1. the visitor closes the chat panel          -> POST /api/session/close
 *   2. the visitor closes or leaves the page      -> sendBeacon to the same route
 *   3. the conversation sits idle past the TTL    -> the sweeper below
 *
 * All three send immediately — there is no debounce, because a closed chat is
 * a lead and it should be in the inbox before the visitor has left the page.
 * `emailedCount` is the duplicate guard: a send only happens when the message
 * count has moved past what was last delivered, so the chat-close and
 * page-close pair that fires when someone closes a tab produces one email.
 *
 * Each email carries only the messages added since the previous one; the
 * `emailedCount` marker is both the dedupe guard and the slice point.
 *
 * Records are mirrored to `.sessions/` so a Passenger restart cannot drop an
 * undelivered transcript.
 */

const SESSION_DIR = path.join(process.cwd(), ".sessions");

/** How often the sweeper looks for idle conversations. */
const SWEEP_INTERVAL_MS = 5 * 60_000;
/** Drop delivered records from memory after this long. */
const RETENTION_MS = 24 * 60 * 60_000;

const MAX_MESSAGES_PER_SESSION = 200;
const MAX_CONTENT_CHARS = 8_000;

const sessions = new Map<string, SessionRecord>();
const inFlight = new Map<string, Promise<boolean>>();

let sweeper: ReturnType<typeof setInterval> | null = null;
let hydrated: Promise<void> | null = null;

// ---------------------------------------------------------------- persistence

async function persist(record: SessionRecord): Promise<void> {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
    const file = path.join(SESSION_DIR, `${record.id}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record), "utf-8");
    await fs.rename(tmp, file);
  } catch (error) {
    // Disk problems must never break a chat response.
    console.error("[transcript] persist failed", error);
  }
}

async function forget(id: string): Promise<void> {
  sessions.delete(id);
  try {
    await fs.rm(path.join(SESSION_DIR, `${id}.json`), { force: true });
  } catch {
    /* already gone */
  }
}

/** Reload transcripts that were still pending when the process last stopped. */
async function hydrate(): Promise<void> {
  try {
    const entries = await fs.readdir(SESSION_DIR).catch(() => [] as string[]);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const id = entry.slice(0, -5);
      if (!isValidSessionId(id) || sessions.has(id)) continue;
      try {
        const raw = await fs.readFile(path.join(SESSION_DIR, entry), "utf-8");
        const record = JSON.parse(raw) as SessionRecord;
        if (record?.id === id && Array.isArray(record.messages)) {
          sessions.set(id, record);
        }
      } catch {
        /* skip unreadable record */
      }
    }
  } catch (error) {
    console.error("[transcript] hydrate failed", error);
  }
}

function ensureStarted(): Promise<void> {
  if (!hydrated) hydrated = hydrate();
  if (!sweeper) {
    sweeper = setInterval(() => {
      void sweep();
    }, SWEEP_INTERVAL_MS);
    // Do not hold the event loop open on shutdown.
    sweeper.unref?.();
  }
  return hydrated;
}

// ------------------------------------------------------------------- mutation

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}\n[...truncated]` : value;
}

export function createSessionId(): string {
  return randomUUID();
}

export async function openSession(
  id: string,
  meta: TranscriptMeta,
): Promise<SessionRecord> {
  await ensureStarted();

  const existing = sessions.get(id);
  if (existing) {
    existing.meta = { ...existing.meta, ...meta };
    return existing;
  }

  const now = Date.now();
  const record: SessionRecord = {
    id,
    createdAt: now,
    lastActivityAt: now,
    messages: [],
    emailedCount: 0,
    meta,
  };
  sessions.set(id, record);
  return record;
}

export async function appendMessage(
  id: string,
  role: TranscriptMessage["role"],
  content: string,
): Promise<void> {
  const record = sessions.get(id);
  if (!record) return;

  const trimmed = content.trim();
  if (!trimmed) return;

  record.messages.push({ role, content: clamp(trimmed, MAX_CONTENT_CHARS), at: Date.now() });

  if (record.messages.length > MAX_MESSAGES_PER_SESSION) {
    const dropped = record.messages.length - MAX_MESSAGES_PER_SESSION;
    record.messages.splice(0, dropped);
    // emailedCount is an index into `messages`, so it has to shift with the
    // trim — otherwise the next incremental email slices from the wrong point.
    record.emailedCount = Math.max(0, record.emailedCount - dropped);
  }

  record.lastActivityAt = Date.now();
  await persist(record);
}

export async function recordContact(
  id: string,
  contact: { name?: string; email?: string; notes?: string },
): Promise<void> {
  const record = sessions.get(id);
  if (!record) return;
  record.meta.contact = { ...record.meta.contact, ...contact };
  await persist(record);
}

export async function recordUnanswered(id: string, question: string): Promise<void> {
  const record = sessions.get(id);
  if (!record) return;
  record.meta.unanswered = [...(record.meta.unanswered ?? []), question].slice(-20);
  await persist(record);
}

// -------------------------------------------------------------------- flushing

/**
 * Entry point for the close endpoint. Awaits hydration first, so a beacon that
 * lands as the very first request after a restart still finds its session
 * instead of being silently discarded.
 *
 * Resolves once the mail has actually been handed to the SMTP server.
 */
export async function closeSession(
  id: string,
  reason: FlushReason,
): Promise<{ known: boolean; sent: boolean }> {
  await ensureStarted();
  if (!sessions.has(id)) return { known: false, sent: false };
  const sent = await flush(id, reason);
  return { known: true, sent };
}

/**
 * Send everything said since the last delivery. Safe to call repeatedly — it
 * returns early when nothing new has been said, which is what makes the
 * chat-close / page-close double-fire produce a single email.
 *
 * Returns true when mail was actually sent.
 */
export async function flush(id: string, reason: FlushReason): Promise<boolean> {
  const existing = inFlight.get(id);
  if (existing) return existing;

  const task = (async () => {
    const record = sessions.get(id);
    if (!record) return false;

    const alreadySent = record.emailedCount;
    if (record.messages.length <= alreadySent) return false;

    const deliveredUpTo = record.messages.length;
    const segment = record.messages.slice(alreadySent);

    try {
      await sendTranscriptMail({
        subject: buildSubject(record, reason, alreadySent),
        text: buildText(record, reason, segment, alreadySent),
        html: buildHtml(record, reason, segment, alreadySent),
        replyTo: record.meta.contact?.email,
      });
      record.emailedCount = deliveredUpTo;
      await persist(record);
      console.info(
        `[transcript] delivered session=${id} new=${segment.length} total=${deliveredUpTo} reason=${reason}`,
      );
      return true;
    } catch (error) {
      // Leave emailedCount alone so the sweeper retries on its next pass.
      console.error(`[transcript] delivery failed session=${id}`, error);
      return false;
    }
  })();

  inFlight.set(id, task);
  try {
    return await task;
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Flush conversations that have gone quiet past the idle window, and evict
 * fully-delivered records once they are older than the retention window.
 */
export async function sweep(): Promise<{ flushed: number; evicted: number }> {
  await ensureStarted();

  const now = Date.now();
  const idleMs = env.transcriptIdleMs;
  let flushed = 0;
  let evicted = 0;

  for (const record of [...sessions.values()]) {
    const idleFor = now - record.lastActivityAt;
    const undelivered = record.messages.length > record.emailedCount;

    if (undelivered && idleFor >= idleMs) {
      if (await flush(record.id, "idle-timeout")) flushed += 1;
    }

    const settled = record.messages.length <= record.emailedCount;
    if (settled && idleFor >= RETENTION_MS) {
      await forget(record.id);
      evicted += 1;
    }
  }

  return { flushed, evicted };
}

export function hasSession(id: string): boolean {
  return sessions.has(id);
}
