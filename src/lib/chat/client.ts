import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

let client: Anthropic | null = null;

/** Single shared client so the underlying HTTP agent pools connections. */
export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env.anthropicApiKey,
      maxRetries: 2,
      timeout: 60_000,
    });
  }
  return client;
}

export const MODEL = env.anthropicModel;

/** Plenty for a conversational answer; keeps latency and cost predictable. */
export const MAX_TOKENS = 2048;
