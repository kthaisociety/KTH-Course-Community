"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { BookOpenIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { KthCourseAgentUIMessage } from "@/types/ai/kth-course-agent";

/**
 * AI Chat Demo — KTH Course Community
 *
 * Demonstrates end-to-end AI SDK usage with tool calling, using the
 * ai-elements component library for a polished UI:
 *
 *  Browser (useChat)
 *
 *    → POST <backend>/ai/chat     (NestJS AiController)
 *    → kthCourseAgent.stream()    (ToolLoopAgent, multi-step tool loop)
 *      ↳ tools: retrieveKthCourses, getWeather
 *    → openai/gpt-5.4-mini        (via Vercel AI Gateway)
 *
 * Route: /ai-demo
 */

const suggestions = [
  "What ML courses does KTH offer?",
  "Show me beginner programming courses",
  "What are the best distributed systems courses?",
  "Compare algorithms and data structures courses",
  "What is the weather in Stockholm?",
];

// ── Attachment helpers ────────────────────────────────────────────────────────

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: FileUIPart & { id: string };
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(
    () => onRemove(attachment.id),
    [onRemove, attachment.id],
  );
  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

const PromptAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();
  const handleRemove = useCallback(
    (id: string) => attachments.remove(id),
    [attachments],
  );
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((a) => (
        <AttachmentItem attachment={a} key={a.id} onRemove={handleRemove} />
      ))}
    </Attachments>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AiDemoPage() {
  const [text, setText] = useState("");

  const { messages, sendMessage, status } = useChat<KthCourseAgentUIMessage>({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BACKEND_DOMAIN}/ai/chat`,
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text.trim() && !message.files?.length) return;
      sendMessage({ text: message.text });
      setText("");
    },
    [sendMessage],
  );

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion });
    },
    [sendMessage],
  );

  const isSubmitDisabled = !text.trim() || isLoading;

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      {/* ── Message thread ── */}
      <Conversation>
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              description="Ask about KTH courses, study programmes, or anything else."
              icon={<BookOpenIcon className="size-8" />}
              title="KTH Course Community AI"
            />
          )}

          {messages.map((message) => (
            <MessageBranch defaultBranch={0} key={message.id}>
              <MessageBranchContent>
                <Message from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      const key = `${message.id}-${i}`;

                      switch (part.type) {
                        case "text":
                          return (
                            <MessageResponse isAnimating={isLoading} key={key}>
                              {part.text}
                            </MessageResponse>
                          );

                        case "tool-retrieveKthCourses":
                          return (
                            <Tool key={key}>
                              <ToolHeader
                                state={part.state}
                                title="Retrieve KTH Courses"
                                type={part.type}
                              />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                {part.state === "output-available" && (
                                  <ToolOutput
                                    errorText={undefined}
                                    output={part.output}
                                  />
                                )}
                              </ToolContent>
                            </Tool>
                          );

                        case "tool-getWeather":
                          return (
                            <Tool key={key}>
                              <ToolHeader
                                state={part.state}
                                title="Get Weather"
                                type={part.type}
                              />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                {part.state === "output-available" && (
                                  <ToolOutput
                                    errorText={undefined}
                                    output={part.output}
                                  />
                                )}
                              </ToolContent>
                            </Tool>
                          );

                        default:
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              </MessageBranchContent>
              <MessageBranchSelector>
                <MessageBranchPrevious />
                <MessageBranchPage />
                <MessageBranchNext />
              </MessageBranchSelector>
            </MessageBranch>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* ── Input area ── */}
      <div className="grid shrink-0 gap-4 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((s) => (
            <Suggestion key={s} onClick={handleSuggestion} suggestion={s} />
          ))}
        </Suggestions>

        <div className="w-full px-4 pb-4">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputHeader>
              <PromptAttachmentsDisplay />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask about KTH courses…"
                value={text}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>
              <PromptInputSubmit disabled={isSubmitDisabled} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
