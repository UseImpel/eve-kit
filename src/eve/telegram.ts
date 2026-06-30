import {
  splitTelegramMessageText,
  type TelegramEventContext,
} from "eve/channels/telegram";

export type TelegramJsonPrimitive = boolean | number | string | null;
export type TelegramJsonValue =
  | TelegramJsonPrimitive
  | readonly TelegramJsonValue[]
  | { readonly [key: string]: TelegramJsonValue };
export type TelegramJsonObject = { readonly [key: string]: TelegramJsonValue };

export type TelegramMessageTarget = {
  chatId: number | string;
  messageThreadId?: number | string;
};

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTelegramInlineMarkdown(text: string): string {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((segment) => {
      if (segment.startsWith("`") && segment.endsWith("`")) {
        return `<code>${escapeTelegramHtml(segment.slice(1, -1))}</code>`;
      }

      return escapeTelegramHtml(segment).replace(
        /\*\*([^*\n]+?)\*\*/g,
        "<b>$1</b>",
      );
    })
    .join("");
}

export function renderTelegramMarkdownAsHtml(markdown: string): string {
  const html: string[] = [];
  let codeBlock: string[] | null = null;

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) {
      if (codeBlock === null) {
        codeBlock = [];
      } else {
        html.push(`<pre>${escapeTelegramHtml(codeBlock.join("\n"))}</pre>`);
        codeBlock = null;
      }
      continue;
    }

    if (codeBlock !== null) {
      codeBlock.push(line);
      continue;
    }

    const heading = /^\s{0,3}#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      html.push(`<b>${renderTelegramInlineMarkdown(heading[1] ?? "")}</b>`);
    } else {
      html.push(renderTelegramInlineMarkdown(line));
    }
  }

  if (codeBlock !== null) {
    html.push(`<pre>${escapeTelegramHtml(codeBlock.join("\n"))}</pre>`);
  }

  return html.join("\n");
}

export function createTelegramMarkdownSendMessageBody(
  target: TelegramMessageTarget,
  markdown: string,
): TelegramJsonObject {
  return {
    chat_id: target.chatId,
    ...(target.messageThreadId === undefined
      ? {}
      : { message_thread_id: target.messageThreadId }),
    parse_mode: "HTML",
    text: renderTelegramMarkdownAsHtml(markdown),
  };
}

export async function sendTelegramMarkdownReply(
  ctx: TelegramEventContext,
  markdown: string,
): Promise<void> {
  for (const chunk of splitTelegramMessageText(markdown)) {
    try {
      const response = await ctx.telegram.request(
        "sendMessage",
        createTelegramMarkdownSendMessageBody(
          {
            chatId: ctx.telegram.chatId,
            messageThreadId: ctx.telegram.messageThreadId,
          },
          chunk,
        ),
      );
      if (response.ok) continue;
      console.error(
        "telegram markdown reply failed:",
        response.status,
        response.body,
      );
    } catch (error) {
      console.error("telegram markdown reply failed:", error);
    }

    await ctx.telegram.post(chunk).catch((error) => {
      console.error("telegram native reply fallback failed:", error);
    });
  }
}
