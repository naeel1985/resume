import { originAllowed } from "@/lib/chat/validate";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { closeSession } from "@/lib/transcript/store";
import { isValidSessionId, type FlushReason } from "@/lib/transcript/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REASONS: FlushReason[] = ["chat-closed", "page-closed", "manual"];

/**
 * Called when the visitor closes the chat panel, or when the page is being
 * unloaded (via `navigator.sendBeacon`).
 *
 * The transcript is sent **immediately** — this route awaits the SMTP handoff
 * rather than queueing it, so a closed conversation is in the inbox within a
 * second or two. Closing a tab fires both `chat-closed` and `page-closed`;
 * the second finds nothing new to send and is a no-op.
 *
 * `sendBeacon` cannot set headers, so the body arrives as `text/plain` and is
 * parsed here rather than via `request.json()`.
 */
export async function POST(request: Request) {
  if (!originAllowed(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const ip = clientIp(request.headers);
  const { allowed } = rateLimit(`close:${ip}`, 30, 60_000);
  if (!allowed) return new Response(null, { status: 429 });

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }

  const { sessionId, reason } = (payload ?? {}) as Record<string, unknown>;
  if (!isValidSessionId(sessionId)) {
    return new Response(null, { status: 400 });
  }

  const flushReason: FlushReason = VALID_REASONS.includes(reason as FlushReason)
    ? (reason as FlushReason)
    : "manual";

  // closeSession awaits store hydration internally, so a beacon that lands as
  // the first request after a restart still resolves its session from disk.
  const { known, sent } = await closeSession(sessionId, flushReason);

  return Response.json(
    { known, sent },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
