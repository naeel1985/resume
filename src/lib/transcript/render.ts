import type { FlushReason, SessionRecord, TranscriptMessage } from "./types";

const REASON_LABEL: Record<FlushReason, string> = {
  "chat-closed": "visitor closed the chat",
  "page-closed": "visitor left the page",
  "idle-timeout": "conversation went idle",
  manual: "manually flushed",
};

/**
 * Escape for HTML *text* context. Every visitor-supplied value in the email
 * body goes through this — a transcript is untrusted input arriving in your
 * inbox, so it must never be interpolated raw.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip CR/LF so a crafted value cannot inject extra SMTP headers. */
export function headerSafe(value: string, max = 200): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

const DUBAI = "Asia/Dubai";

function formatTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(ms));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function buildSubject(
  record: SessionRecord,
  reason: FlushReason,
  alreadySent: number,
): string {
  const questions = record.messages
    .slice(alreadySent)
    .filter((m) => m.role === "user").length;
  const email = record.meta.contact?.email;
  const lead = email ? ` — lead: ${email}` : "";
  const continuation = alreadySent > 0 ? " (cont.)" : "";
  return headerSafe(
    `Website chat${continuation} (${questions} question${
      questions === 1 ? "" : "s"
    })${lead} · ${REASON_LABEL[reason]}`,
  );
}

export function buildText(
  record: SessionRecord,
  reason: FlushReason,
  segment: TranscriptMessage[],
  alreadySent: number,
): string {
  const lines: string[] = [
    alreadySent > 0
      ? "CHAT TRANSCRIPT (CONTINUED) — naeel.ai-technology.ae"
      : "CHAT TRANSCRIPT — naeel.ai-technology.ae",
    "",
    `Started   ${formatDateTime(record.createdAt)} (Asia/Dubai)`,
    `Ended     ${formatDateTime(record.lastActivityAt)}`,
    `Duration  ${formatDuration(record.lastActivityAt - record.createdAt)}`,
    `Trigger   ${REASON_LABEL[reason]}`,
    `Session   ${record.id}`,
  ];

  if (alreadySent > 0) {
    lines.push(
      `Note      Continues an earlier email; ${alreadySent} message${
        alreadySent === 1 ? "" : "s"
      } already sent and not repeated below.`,
    );
  }

  if (record.meta.contact?.email) {
    lines.push(
      "",
      "--- CONTACT CAPTURED ---",
      `Name   ${record.meta.contact.name ?? "not provided"}`,
      `Email  ${record.meta.contact.email}`,
      `Notes  ${record.meta.contact.notes ?? "none"}`,
    );
  }

  if (record.meta.unanswered?.length) {
    lines.push("", "--- COULD NOT ANSWER ---");
    for (const q of record.meta.unanswered) lines.push(`  · ${q}`);
  }

  lines.push("", alreadySent > 0 ? "--- NEW MESSAGES ---" : "--- TRANSCRIPT ---", "");
  for (const message of segment) {
    const who = message.role === "user" ? "VISITOR " : "ASSISTANT";
    lines.push(`[${formatTime(message.at)}] ${who}`, message.content, "");
  }

  lines.push(
    "--- VISITOR ---",
    `IP         ${record.meta.ip ?? "unknown"}`,
    `Referer    ${record.meta.referer ?? "direct"}`,
    `User agent ${record.meta.userAgent ?? "unknown"}`,
  );

  return lines.join("\n");
}

export function buildHtml(
  record: SessionRecord,
  reason: FlushReason,
  segment: TranscriptMessage[],
  alreadySent: number,
): string {
  const contact = record.meta.contact;
  const unanswered = record.meta.unanswered ?? [];

  const bubbles = segment
    .map((message) => {
      const isUser = message.role === "user";
      const bg = isUser ? "#0F172A" : "#F1F5F9";
      const fg = isUser ? "#F8FAFC" : "#0F172A";
      const who = isUser ? "Visitor" : "Assistant";
      return `
        <tr>
          <td style="padding:0 0 14px 0;">
            <div style="font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#64748B;padding-bottom:5px;">
              ${esc(who)} &middot; ${esc(formatTime(message.at))}
            </div>
            <div style="background:${bg};color:${fg};border-radius:10px;padding:12px 15px;font:400 14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;white-space:pre-wrap;word-break:break-word;">
              ${esc(message.content)}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const contactBlock = contact?.email
    ? `
      <tr><td style="padding:0 0 22px 0;">
        <div style="border:1px solid #C2703D;border-left-width:4px;border-radius:8px;background:#FDF6F1;padding:14px 16px;">
          <div style="font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#9A4F22;padding-bottom:9px;">Contact captured</div>
          <div style="font:400 14px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
            <strong>Name</strong> ${esc(contact.name || "not provided")}<br>
            <strong>Email</strong> <a href="mailto:${esc(contact.email)}" style="color:#9A4F22;">${esc(contact.email)}</a><br>
            <strong>Notes</strong> ${esc(contact.notes || "none")}
          </div>
        </div>
      </td></tr>`
    : "";

  const unansweredBlock = unanswered.length
    ? `
      <tr><td style="padding:0 0 22px 0;">
        <div style="border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC;padding:14px 16px;">
          <div style="font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#475569;padding-bottom:9px;">Could not answer</div>
          <ul style="margin:0;padding-left:18px;font:400 14px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
            ${unanswered.map((q) => `<li>${esc(q)}</li>`).join("")}
          </ul>
        </div>
      </td></tr>`
    : "";

  const metaRow = (label: string, value: string) => `
    <tr>
      <td style="padding:3px 14px 3px 0;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#94A3B8;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:3px 0;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#334155;word-break:break-all;">${esc(value)}</td>
    </tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat transcript</title></head>
<body style="margin:0;padding:24px 12px;background:#EEF2F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.12);">
    <tr>
      <td style="background:#0F172A;padding:22px 26px;">
        <div style="font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#C2703D;">naeel.ai-technology.ae</div>
        <div style="font:600 21px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;padding-top:7px;">Chat transcript${
          alreadySent > 0 ? " (continued)" : ""
        }</div>
        <div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#94A3B8;padding-top:4px;">Sent because the ${esc(REASON_LABEL[reason])}.</div>
      </td>
    </tr>
    ${
      alreadySent > 0
        ? `<tr><td style="background:#F1F5F9;padding:10px 26px;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#475569;border-bottom:1px solid #E2E8F0;">Continues an earlier email. The ${alreadySent} message${
            alreadySent === 1 ? "" : "s"
          } already sent are not repeated below.</td></tr>`
        : ""
    }
    <tr>
      <td style="padding:24px 26px 6px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          ${metaRow("Started", `${formatDateTime(record.createdAt)} (Asia/Dubai)`)}
          ${metaRow("Ended", formatDateTime(record.lastActivityAt))}
          ${metaRow("Duration", formatDuration(record.lastActivityAt - record.createdAt))}
          ${metaRow(
            alreadySent > 0 ? "New / total" : "Messages",
            alreadySent > 0
              ? `${segment.length} of ${record.messages.length}`
              : String(record.messages.length),
          )}
        </table>
      </td>
    </tr>
    <tr><td style="padding:20px 26px 0 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${contactBlock}
        ${unansweredBlock}
        ${bubbles}
      </table>
    </td></tr>
    <tr>
      <td style="padding:8px 26px 26px 26px;border-top:1px solid #E2E8F0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;padding-top:12px;">
          ${metaRow("IP", record.meta.ip ?? "unknown")}
          ${metaRow("Referer", record.meta.referer ?? "direct")}
          ${metaRow("Agent", record.meta.userAgent ?? "unknown")}
          ${metaRow("Session", record.id)}
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}
