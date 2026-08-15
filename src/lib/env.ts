import "server-only";

/**
 * Runtime environment access. Server-only — importing this from a client
 * component is a build error, which is the point: secrets cannot leak into
 * the browser bundle by accident.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get anthropicModel() {
    return optional("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001");
  },

  get smtp() {
    return {
      host: required("SMTP_HOST"),
      port: int("SMTP_PORT", 465),
      secure: optional("SMTP_SECURE", "true").toLowerCase() !== "false",
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
      from: optional("MAIL_FROM") || required("SMTP_USER"),
      to: optional("MAIL_TO") || required("SMTP_USER"),
    };
  },

  /** True when SMTP is fully configured; transcript delivery is skipped otherwise. */
  get mailEnabled() {
    return Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
  },

  get allowedOrigins(): string[] {
    return optional("ALLOWED_ORIGINS")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  },

  /** Idle minutes before an abandoned conversation is emailed automatically. */
  get transcriptIdleMs() {
    return int("TRANSCRIPT_IDLE_MINUTES", 60) * 60_000;
  },

  get sweepToken() {
    return optional("SWEEP_TOKEN");
  },

  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
} as const;
