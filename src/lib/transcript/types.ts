export type TranscriptRole = "user" | "assistant";

export type TranscriptMessage = {
  role: TranscriptRole;
  content: string;
  at: number;
};

export type TranscriptMeta = {
  ip?: string;
  /** Signed-cookie visitor id — the identity the question quota is tracked against. */
  visitorId?: string;
  userAgent?: string;
  referer?: string;
  /** Contact details the assistant captured via the record_contact tool. */
  contact?: { name?: string; email?: string; notes?: string };
  /** Questions the assistant could not answer. */
  unanswered?: string[];
};

export type SessionRecord = {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  messages: TranscriptMessage[];
  /** How many messages have already been emailed; guards against duplicates. */
  emailedCount: number;
  meta: TranscriptMeta;
};

/** Why a transcript is being sent — shown in the email subject line. */
export type FlushReason =
  | "chat-closed"
  | "page-closed"
  | "idle-timeout"
  | "manual";

export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}
