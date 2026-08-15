import "server-only";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Per-visitor question quota.
 *
 * Identity is a signed httpOnly cookie (one per browser), with a looser cap on
 * the raw IP behind it. The pair matters: IP alone would let one person behind
 * an office NAT lock out the whole building, while a cookie alone resets the
 * moment someone clears it or opens a private window.
 *
 * The cycle is hard, not rolling: on the Nth question the visitor is locked out
 * for a full hour from that moment, then the allowance resets to N.
 *
 * State is mirrored to disk because Passenger idles applications out on quiet
 * shared hosting — an in-memory lockout would evaporate on the next restart,
 * which is exactly when someone hammering the API would come back.
 */

export const COOKIE_NAME = "nz_visitor";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Per-browser allowance. */
export const VISITOR_LIMIT = 30;
/** Per-IP ceiling, deliberately higher so shared networks are not collateral. */
export const IP_LIMIT = 120;
/** Lockout duration once an allowance is exhausted. */
export const LOCKOUT_MS = 60 * 60_000;

const STATE_FILE = path.join(process.cwd(), ".sessions", "quota.json");
const PERSIST_DEBOUNCE_MS = 2_000;

type Counter = {
  used: number;
  lockedUntil: number | null;
  /** Last touch, used to evict stale entries. */
  seenAt: number;
};

const counters = new Map<string, Counter>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated: Promise<void> | null = null;

// --------------------------------------------------------------- persistence

async function hydrate(): Promise<void> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, Counter>;
    const now = Date.now();
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value?.used !== "number") continue;
      // Drop anything that is neither locked nor recently active.
      const locked = value.lockedUntil && value.lockedUntil > now;
      const fresh = now - (value.seenAt ?? 0) < LOCKOUT_MS;
      if (locked || fresh) counters.set(key, value);
    }
  } catch {
    /* first boot, or unreadable — start empty */
  }
}

function ensureHydrated(): Promise<void> {
  if (!hydrated) hydrated = hydrate();
  return hydrated;
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DEBOUNCE_MS);
  persistTimer.unref?.();
}

async function persistNow(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    const now = Date.now();
    const snapshot: Record<string, Counter> = {};
    for (const [key, value] of counters) {
      const locked = value.lockedUntil && value.lockedUntil > now;
      const fresh = now - value.seenAt < LOCKOUT_MS;
      if (locked || fresh) snapshot[key] = value;
      else counters.delete(key);
    }
    const tmp = `${STATE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(snapshot), "utf-8");
    await fs.rename(tmp, STATE_FILE);
  } catch (error) {
    console.error("[quota] persist failed", error);
  }
}

// ------------------------------------------------------------ cookie signing

/**
 * HMAC key for the visitor cookie.
 *
 * If QUOTA_COOKIE_SECRET is unset a random key is generated per process. That
 * degrades gracefully rather than failing: cookies simply stop verifying after
 * a restart and those visitors get a fresh allowance. Set it in production so
 * lockouts survive an app restart.
 */
let signingKey: Buffer | null = null;

function key(): Buffer {
  if (signingKey) return signingKey;
  const configured = process.env.QUOTA_COOKIE_SECRET?.trim();
  if (configured) {
    signingKey = Buffer.from(configured, "utf-8");
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[quota] QUOTA_COOKIE_SECRET is not set — visitor lockouts will reset when the app restarts.",
      );
    }
    signingKey = randomBytes(32);
  }
  return signingKey;
}

function sign(id: string): string {
  return createHmac("sha256", key()).update(id).digest("base64url");
}

function verify(value: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const expected = Buffer.from(sign(id));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  return id;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return null;
}

export type VisitorIdentity = {
  id: string;
  /** Set when the cookie was missing or invalid and a new one must be issued. */
  issued: boolean;
};

export function identifyVisitor(headers: Headers): VisitorIdentity {
  const raw = readCookie(headers.get("cookie"), COOKIE_NAME);
  const verified = raw ? verify(raw) : null;
  if (verified) return { id: verified, issued: false };
  return { id: randomUUID(), issued: true };
}

export function visitorCookie(id: string): string {
  const value = `${id}.${sign(id)}`;
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

// ------------------------------------------------------------------- quota

export type QuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Epoch ms when the assistant becomes available again; null when not locked. */
  lockedUntil: number | null;
  retryAfterSeconds: number;
  /** True when this question is the visitor's last before the lockout. */
  isFinalQuestion: boolean;
  /** Which bucket ran out — the browser's own, or the shared IP ceiling. */
  scope: "visitor" | "ip" | null;
};

function evaluate(key_: string, limit: number, now: number, consume: boolean) {
  const counter = counters.get(key_) ?? { used: 0, lockedUntil: null, seenAt: now };

  // A finished lockout resets the allowance in full.
  if (counter.lockedUntil !== null && now >= counter.lockedUntil) {
    counter.used = 0;
    counter.lockedUntil = null;
  }

  if (counter.lockedUntil !== null) {
    counter.seenAt = now;
    counters.set(key_, counter);
    return { counter, locked: true };
  }

  if (consume) {
    counter.used += 1;
    // Exhausting the allowance starts the clock immediately.
    if (counter.used >= limit) counter.lockedUntil = now + LOCKOUT_MS;
  }

  counter.seenAt = now;
  counters.set(key_, counter);
  return { counter, locked: false };
}

/**
 * Read quota state without spending a question.
 */
export async function peekQuota(
  visitorId: string,
  ip: string,
): Promise<QuotaStatus> {
  return check(visitorId, ip, false);
}

/**
 * Spend one question. Returns `allowed: false` when the visitor is locked out,
 * in which case nothing is consumed.
 */
export async function consumeQuota(
  visitorId: string,
  ip: string,
): Promise<QuotaStatus> {
  return check(visitorId, ip, true);
}

async function check(
  visitorId: string,
  ip: string,
  consume: boolean,
): Promise<QuotaStatus> {
  await ensureHydrated();
  const now = Date.now();

  // Evaluate the visitor bucket first; only charge the IP bucket if the
  // visitor is actually permitted, so a locked-out browser cannot keep
  // burning down the shared IP ceiling.
  const visitor = evaluate(`v:${visitorId}`, VISITOR_LIMIT, now, false);
  if (visitor.locked) {
    schedulePersist();
    return locked(visitor.counter, VISITOR_LIMIT, now, "visitor");
  }

  const ipState = evaluate(`i:${ip}`, IP_LIMIT, now, false);
  if (ipState.locked) {
    schedulePersist();
    return locked(ipState.counter, IP_LIMIT, now, "ip");
  }

  if (!consume) {
    schedulePersist();
    return {
      allowed: true,
      used: visitor.counter.used,
      limit: VISITOR_LIMIT,
      remaining: Math.max(0, VISITOR_LIMIT - visitor.counter.used),
      lockedUntil: null,
      retryAfterSeconds: 0,
      isFinalQuestion: visitor.counter.used === VISITOR_LIMIT - 1,
      scope: null,
    };
  }

  const spentVisitor = evaluate(`v:${visitorId}`, VISITOR_LIMIT, now, true);
  const spentIp = evaluate(`i:${ip}`, IP_LIMIT, now, true);

  // Ordinary increments can ride the debounce, but the transition *into* a
  // lockout is written through immediately — the debounce timer is unref'd, so
  // a shutdown in that window would otherwise hand back a fresh allowance.
  if (spentVisitor.counter.lockedUntil !== null || spentIp.counter.lockedUntil !== null) {
    await persistNow();
  } else {
    schedulePersist();
  }

  return {
    allowed: true,
    used: spentVisitor.counter.used,
    limit: VISITOR_LIMIT,
    remaining: Math.max(0, VISITOR_LIMIT - spentVisitor.counter.used),
    lockedUntil: spentVisitor.counter.lockedUntil,
    retryAfterSeconds: 0,
    // True on the question that just exhausted the allowance — the assistant
    // uses this to ask for an email before it goes quiet.
    isFinalQuestion: spentVisitor.counter.used >= VISITOR_LIMIT,
    scope: null,
  };
}

function locked(
  counter: Counter,
  limit: number,
  now: number,
  scope: "visitor" | "ip",
): QuotaStatus {
  const until = counter.lockedUntil ?? now;
  return {
    allowed: false,
    used: counter.used,
    limit,
    remaining: 0,
    lockedUntil: until,
    retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
    isFinalQuestion: false,
    scope,
  };
}

/** Test seam — clears all counters and the persisted file. */
export async function resetAllQuota(): Promise<void> {
  counters.clear();
  hydrated = Promise.resolve();
  await fs.rm(STATE_FILE, { force: true }).catch(() => {});
}
