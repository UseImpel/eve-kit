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
/** Render a Markdown string to WhatsApp inline format. */
export declare function renderWhatsAppMarkdown(markdown: string): string;
/** WhatsApp text messages are capped at 4096 characters. */
export declare const WHATSAPP_MESSAGE_LIMIT = 4096;
/**
 * Split text into chunks under the WhatsApp limit, breaking on paragraph then
 * line boundaries, and hard-splitting only as a last resort.
 */
export declare function splitWhatsAppMessage(text: string): string[];
//# sourceMappingURL=markdown.d.ts.map