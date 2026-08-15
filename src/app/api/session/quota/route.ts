import { identifyVisitor, peekQuota, visitorCookie } from "@/lib/quota";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Current allowance for this visitor, without spending a question.
 *
 * The chat panel calls this when it opens so it can show the remaining count —
 * or the locked state and countdown — before the visitor types anything.
 */
export async function GET(request: Request) {
  const visitor = identifyVisitor(request.headers);
  const status = await peekQuota(visitor.id, clientIp(request.headers));

  return Response.json(
    {
      remaining: status.remaining,
      limit: status.limit,
      lockedUntil: status.lockedUntil,
      scope: status.scope,
    },
    {
      headers: {
        "cache-control": "no-store",
        // Issue the cookie now so the first question is already attributed.
        "set-cookie": visitorCookie(visitor.id),
      },
    },
  );
}
