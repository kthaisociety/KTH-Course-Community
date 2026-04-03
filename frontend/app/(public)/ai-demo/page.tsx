"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

/**
 * AI Chat Demo
 *
 * Demonstrates end-to-end AI SDK usage in this fullstack project:
 *
 *  Browser (useChat)
 *    → POST /api/ai/chat          (Next.js proxy route)
 *    → POST <backend>/ai/chat     (NestJS AiController)
 *    → streamText(...)            (AI SDK core, Vercel AI Gateway)
 *    → openai/gpt-5.4
 *
 * Route: /ai-demo
 */
export default function AiDemoPage() {
  const [input, setInput] = useState("");

  // useChat sends POST /api/ai/chat (via DefaultChatTransport) — matches our proxy route.
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BACKEND_DOMAIN}/ai/chat`,
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-bold">AI Chat Demo</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Powered by Vercel AI SDK + AI Gateway →{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            openai/gpt-5.4
          </code>
        </p>
      </header>

      {/* Message thread */}
      <section className="flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400">
            Send a message to start the conversation.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg px-4 py-3 text-sm ${
              message.role === "user"
                ? "ml-auto max-w-sm bg-blue-600 text-white"
                : "mr-auto max-w-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            <span className="mb-1 block text-xs font-semibold opacity-60">
              {message.role === "user" ? "You" : "AI"}
            </span>
            {message.parts.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <p
                      key={`${message.id}-${i}`}
                      className="whitespace-pre-wrap"
                    >
                      {part.text}
                    </p>
                  );
                default:
                  return null;
              }
            })}
          </div>
        ))}

        {isLoading && (
          <div className="mr-auto rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-800">
            Thinking…
          </div>
        )}
      </section>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          value={input}
          placeholder="Ask something…"
          onChange={(e) => setInput(e.currentTarget.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
