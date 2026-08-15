import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MAX_TOKENS, MODEL } from "@/lib/chat/client";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { chatTools, runTool, webSearchTool } from "@/lib/chat/tools";
import { BadRequest, originAllowed, parseChatRequest } from "@/lib/chat/validate";
import {
  consumeQuota,
  identifyVisitor,
  visitorCookie,
  type QuotaStatus,
} from "@/lib/quota";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { appendMessage, createSessionId, openSession } from "@/lib/transcript/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short-window abuse guard, separate from the per-visitor question quota. */
const BURST = { limit: 10, windowMs: 60_000 };

/** Guards against a tool loop that never terminates. */
const MAX_TURNS = 8;

const encoder = new TextEncoder();

function sse(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** The subset of quota state the browser is allowed to see. */
function publicQuota(status: QuotaStatus) {
  return {
    remaining: status.remaining,
    limit: status.limit,
    lockedUntil: status.lockedUntil,
    scope: status.scope,
  };
}

function json(body: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export async function POST(request: Request) {
  if (!originAllowed(request.headers)) {
    return json({ error: "Origin not allowed." }, 403);
  }

  const ip = clientIp(request.headers);
  const burst = rateLimit(`chat:burst:${ip}`, BURST.limit, BURST.windowMs);
  if (!burst.allowed) {
    return json({ error: "Too many messages. Give it a moment." }, 429, {
      "retry-after": String(burst.retryAfterSeconds),
    });
  }

  // Validate before spending a question, so a malformed payload is free.
  let parsed;
  try {
    parsed = parseChatRequest(await request.json());
  } catch (error) {
    const message =
      error instanceof BadRequest ? error.message : "Malformed request body.";
    return json({ error: message }, 400);
  }

  const visitor = identifyVisitor(request.headers);
  const cookieHeader = visitorCookie(visitor.id);
  const quota = await consumeQuota(visitor.id, ip);

  if (!quota.allowed) {
    const shared = quota.scope === "ip";
    return json(
      {
        error: shared
          ? "This network has reached its limit for the assistant. It will be available again shortly."
          : "You've reached your question limit for now. The assistant will be available again in an hour.",
        quota: publicQuota(quota),
      },
      429,
      {
        "retry-after": String(quota.retryAfterSeconds),
        "set-cookie": cookieHeader,
      },
    );
  }

  const sessionId = parsed.sessionId ?? createSessionId();

  let system: string;
  try {
    system = await buildSystemPrompt({ isFinalQuestion: quota.isFinalQuestion });
  } catch (error) {
    console.error("[chat] failed to build system prompt", error);
    return json({ error: "Chat is temporarily unavailable." }, 503);
  }

  await openSession(sessionId, {
    ip,
    visitorId: visitor.id,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
  });
  await appendMessage(sessionId, "user", parsed.message);

  const messages: Anthropic.MessageParam[] = [
    ...parsed.history.map(
      (turn): Anthropic.MessageParam => ({ role: turn.role, content: turn.content }),
    ),
    { role: "user", content: parsed.message },
  ];

  const tools = [...chatTools, ...webSearchTool()];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let closed = false;

      const push = (payload: Record<string, unknown>) => {
        if (!closed) controller.enqueue(sse(payload));
      };

      try {
        push({ type: "session", sessionId, quota: publicQuota(quota) });

        for (let turn = 0; turn < MAX_TURNS; turn += 1) {
          const message = anthropic().messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: [
              {
                type: "text",
                text: system,
                // No-op below the model's minimum cacheable prefix, but keeps
                // the breakpoint correct as the profile files grow.
                cache_control: { type: "ephemeral" },
              },
            ],
            tools,
            messages,
          });

          for await (const event of message) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              answer += event.delta.text;
              push({ type: "delta", text: event.delta.text });
            }
          }

          const final = await message.finalMessage();
          messages.push({ role: "assistant", content: final.content });

          if (final.stop_reason === "tool_use") {
            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const block of final.content) {
              if (block.type !== "tool_use") continue;
              const { content, isError } = await runTool(
                sessionId,
                block.name,
                block.input,
              );
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content,
                is_error: isError,
              });
            }
            // All results must go back in a single user message.
            messages.push({ role: "user", content: results });
            continue;
          }

          if (final.stop_reason === "pause_turn") {
            // Server-side tool loop hit its iteration cap; re-send to resume.
            continue;
          }

          break;
        }

        if (answer.trim()) {
          await appendMessage(sessionId, "assistant", answer);
        }
        push({ type: "done", quota: publicQuota(quota) });
      } catch (error) {
        console.error("[chat] stream failed", error);
        push({ type: "error", error: "Something went wrong generating a reply." });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Stops Apache/nginx in front of cPanel from buffering the stream.
      "x-accel-buffering": "no",
      "x-session-id": sessionId,
      "set-cookie": cookieHeader,
    },
  });
}
