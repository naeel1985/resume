import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";
import { headerSafe } from "./render";

/**
 * Lazily-created SMTP transport.
 *
 * `pool: true` keeps one authenticated connection warm between transcripts,
 * which matters on Gmail where the TLS + AUTH handshake dominates send time.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const smtp = env.smtp;
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

export type MailPayload = {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export async function sendTranscriptMail(payload: MailPayload): Promise<void> {
  if (!env.mailEnabled) {
    console.warn("[transcript] SMTP not configured; skipping delivery");
    return;
  }

  const smtp = env.smtp;
  await getTransporter().sendMail({
    from: smtp.from,
    to: smtp.to,
    subject: headerSafe(payload.subject, 180),
    text: payload.text,
    html: payload.html,
    // Lets Naeel hit reply and land in the visitor's inbox when the assistant
    // captured an address. Sanitised so it cannot inject headers.
    ...(payload.replyTo ? { replyTo: headerSafe(payload.replyTo, 320) } : {}),
  });
}
