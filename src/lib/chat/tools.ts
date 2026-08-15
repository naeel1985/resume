import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { recordContact, recordUnanswered } from "@/lib/transcript/store";

/**
 * Client-side tools. Both write into the session record, so whatever the
 * assistant captures shows up at the top of the transcript email rather than
 * needing a separate notification channel.
 */
export const chatTools: Anthropic.Tool[] = [
  {
    name: "record_contact",
    description:
      "Record a visitor's contact details. Call this the moment a visitor shares an email address and wants to be contacted about a role, project, or collaboration.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The visitor's email address." },
        name: { type: "string", description: "The visitor's name, if given." },
        notes: {
          type: "string",
          description:
            "What they are looking for — the role, project, company, or question that prompted them to get in touch.",
        },
      },
      required: ["email"],
      additionalProperties: false,
    },
  },
  {
    name: "record_unanswered_question",
    description:
      "Record a question that could not be answered from the profile. Call this whenever you have to tell a visitor you do not have the information, so the question reaches the real Naeel.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question, as the visitor asked it.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
];

/** Optional server-side web search, enabled with ENABLE_WEB_SEARCH=true. */
export function webSearchTool(): Anthropic.Messages.WebSearchTool20250305[] {
  if (process.env.ENABLE_WEB_SEARCH !== "true") return [];
  return [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
}

function asString(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export async function runTool(
  sessionId: string,
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  const args = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case "record_contact": {
      const email = asString(args.email, 320);
      if (!email) {
        return { content: "No email address was provided.", isError: true };
      }
      await recordContact(sessionId, {
        email,
        name: asString(args.name, 120),
        notes: asString(args.notes, 2_000),
      });
      return { content: "Contact details recorded.", isError: false };
    }

    case "record_unanswered_question": {
      const question = asString(args.question, 1_000);
      if (!question) {
        return { content: "No question was provided.", isError: true };
      }
      await recordUnanswered(sessionId, question);
      return { content: "Question recorded for follow-up.", isError: false };
    }

    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}
