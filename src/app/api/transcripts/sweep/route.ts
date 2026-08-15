import { env } from "@/lib/env";
import { sweep } from "@/lib/transcript/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual trigger for the idle sweep.
 *
 * The in-process timer in `store.ts` already runs this every five minutes,
 * so this route only matters if Passenger has idled the app to sleep — a
 * cPanel cron hitting this URL keeps the process warm and guarantees the
 * one-hour rule fires even with no visitor traffic.
 *
 * Disabled unless SWEEP_TOKEN is set.
 */
export async function GET(request: Request) {
  const token = env.sweepToken;
  if (!token) {
    return new Response("Sweep endpoint disabled.", { status: 404 });
  }
  if (request.headers.get("x-sweep-token") !== token) {
    return new Response("Unauthorised.", { status: 401 });
  }

  const result = await sweep();
  return Response.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
