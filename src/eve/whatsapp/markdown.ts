/**
 * Dependency-free Markdown → WhatsApp-format rendering.
 *
 * The agent emits GitHub-ish Markdown; WhatsApp uses its own inline syntax:
 *   **bold** / __bold__      → *bold*
 *   *italic* / _italic_      → _italic_
 *   ~~strike~~               → ~strike~
 *   # heading                → *heading* (bold line)
 *   ```code```               → ```code``` (kept; WhatsApp renders monospace)
 *
 * The tricky part is that `*x*` means BOLD on WhatsApp but ITALIC in Markdown,
 * so we convert `**x**` (Markdown bold) to `*x*` and single `*x*` (Markdown
 * italic) to `_x_`, while guarding fenced/inline code spans so their contents
 * are left untouched. Mirrors eve-kit's Telegram HTML renderer approach.
 */

// Private-use unicode sentinels: cannot appear in real message text, so the
// two-pass emphasis rewrite never collides with user content.
const BOLD = "";
const CODE_OPEN = "";
const CODE_CLOSE = "";

/** Render a Markdown string to WhatsApp inline format. */
export function renderWhatsAppMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines: string[] = [];
  let fence: string[] | null = null;

  for (const line of normalized.split("\n")) {
    if (/^\s*```/.test(line)) {
      if (fence === null) {
        fence = [];
      } else {
        lines.push("```" + fence.join("\n") + "```");
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }

    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      lines.push(`*${renderInline(stripInlineEmphasis(heading[1] ?? ""))}*`);
      continue;
    }
    lines.push(renderInline(line));
  }

  if (fence !== null) {
    // Unterminated fence — flush as monospace so nothing is lost.
    lines.push("```" + fence.join("\n") + "```");
  }

  return lines.join("\n");
}

/** Convert inline Markdown emphasis in a single line to WhatsApp syntax. */
function renderInline(text: string): string {
  // 1. Protect inline code spans (`code`) — their contents pass through.
  let out = text.replace(/`([^`\n]+)`/g, (_m, code: string) => `${CODE_OPEN}${code}${CODE_CLOSE}`);

  // 2. Bold **x** / __x__ → sentinel (so single-* italic handling skips them).
  out = out
    .replace(/\*\*([^\n]+?)\*\*/g, (_m, x: string) => `${BOLD}${x}${BOLD}`)
    .replace(/__([^\n]+?)__/g, (_m, x: string) => `${BOLD}${x}${BOLD}`);

  // 3. Strikethrough ~~x~~ → ~x~.
  out = out.replace(/~~([^\n]+?)~~/g, "~$1~");

  // 4. Remaining single *x* (Markdown italic) → _x_ (WhatsApp italic).
  out = out.replace(/(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g, "_$1_");

  // 5. Restore bold sentinels as WhatsApp *bold*, code spans as backticks.
  return out
    .split(BOLD)
    .join("*")
    .split(CODE_OPEN)
    .join("`")
    .split(CODE_CLOSE)
    .join("`");
}

/** Drop emphasis markers so a heading rendered as bold does not double up. */
function stripInlineEmphasis(text: string): string {
  return text
    .replace(/\*\*([^\n]+?)\*\*/g, "$1")
    .replace(/__([^\n]+?)__/g, "$1");
}

/** WhatsApp text messages are capped at 4096 characters. */
export const WHATSAPP_MESSAGE_LIMIT = 4096;

/**
 * Split text into chunks under the WhatsApp limit, breaking on paragraph then
 * line boundaries, and hard-splitting only as a last resort.
 */
export function splitWhatsAppMessage(text: string): string[] {
  if (text.length <= WHATSAPP_MESSAGE_LIMIT) {
    return [text];
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > WHATSAPP_MESSAGE_LIMIT) {
    const slice = remaining.slice(0, WHATSAPP_MESSAGE_LIMIT);
    let breakIndex = slice.lastIndexOf("\n\n");
    if (breakIndex === -1 || breakIndex < WHATSAPP_MESSAGE_LIMIT / 2) {
      breakIndex = slice.lastIndexOf("\n");
    }
    if (breakIndex === -1 || breakIndex < WHATSAPP_MESSAGE_LIMIT / 2) {
      breakIndex = WHATSAPP_MESSAGE_LIMIT;
    }
    chunks.push(remaining.slice(0, breakIndex).trimEnd());
    remaining = remaining.slice(breakIndex).trimStart();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}
