import "server-only";

import { env } from "@/lib/env";
import { isValidSessionId } from "@/lib/transcript/types";

export const LIMITS = {
  message: 4_000,
  historyTurns: 40,
  historyContent: 8_000,
} as const;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ParsedChatRequest = {
  message: string;
  history: ChatTurn[];
  sessionId: string | null;
};

export class BadRequest extends Error {}

/**
 * Parses and bounds an untrusted chat payload. Every field is checked for
 * type and size — the history array in particular is attacker-controlled and
 * is what gets billed as input tokens, so it is capped hard.
 */
export function parseChatRequest(body: unknown): ParsedChatRequest {
  if (typeof body !== "object" || body === null) {
    throw new BadRequest("Expected a JSON object.");
  }

  const { message, history, sessionId } = body as Record<string, unknown>;

  if (typeof message !== "string" || !message.trim()) {
    throw new BadRequest("`message` must be a non-empty string.");
  }
  if (message.length > LIMITS.message) {
    throw new BadRequest(
      `Message must be ${LIMITS.message} characters or fewer.`,
    );
  }

  const turns: ChatTurn[] = [];
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      throw new BadRequest("`history` must be an array.");
    }
    // Keep only the most recent turns; older context is dropped rather than
    // rejected so a long conversation degrades instead of erroring.
    for (const entry of history.slice(-LIMITS.historyTurns)) {
      if (typeof entry !== "object" || entry === null) continue;
      const { role, content } = entry as Record<string, unknown>;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      turns.push({ role, content: content.slice(0, LIMITS.historyContent) });
    }
  }

  // The Messages API requires the first turn to be from the user.
  while (turns.length && turns[0]!.role !== "user") turns.shift();

  return {
    message: message.trim(),
    history: turns,
    sessionId: isValidSessionId(sessionId) ? sessionId : null,
  };
}

/**
 * Rejects cross-site POSTs. A missing Origin is allowed — some proxies strip
 * it on same-origin requests — but a present-and-wrong Origin never is.
 */
export function originAllowed(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;

  const allowed = env.allowedOrigins;
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}
