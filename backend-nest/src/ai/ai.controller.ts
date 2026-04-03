import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import { pipeAgentUIStreamToResponse, type UIMessage } from "ai";
import type { Response } from "express";
import {
  kthCourseAgent,
  kthCourseAgentCallOptionsSchema,
} from "./kth-course-agent";

interface ChatRequestBody {
  messages: UIMessage[];
  /** Optional call options validated by kthCourseAgentCallOptionsSchema */
  locale?: string;
  preferredDifficulty?: "beginner" | "intermediate" | "advanced";
}

/**
 * AI chat endpoint for the KTH Course Community.
 *
 * POST /ai/chat
 * Body: { messages: UIMessage[], locale?: string, preferredDifficulty?: string }
 *
 * Returns a UI message stream compatible with the AI SDK's `useChat` hook.
 *
 * Architecture:
 *   Browser (useChat)
 *     → POST /api/ai/chat       (Next.js proxy route)
 *     → POST /ai/chat           (this controller)
 *     → kthCourseAgent.stream() (ToolLoopAgent, Vercel AI Gateway)
 *     → openai/gpt-5.4-mini
 *   ← pipeAgentUIStreamToResponse()
 *   ← UI message stream forwarded back to the browser
 *
 * The agent runs a multi-step tool loop: the model may call
 * `retrieveKthCourses` and/or `getWeather` multiple times before
 * producing its final answer.
 *
 * `pipeAgentUIStreamToResponse` is used instead of raw `streamText` because
 * it handles the ToolLoopAgent loop, tool execution, and stream piping in one
 * call — no manual `convertToModelMessages` needed.
 */
@Controller("ai")
export class AiController {
  @Post("chat")
  @HttpCode(200)
  async chat(@Body() body: ChatRequestBody, @Res() res: Response) {
    // Parse and validate call options from the request body.
    // Unknown keys are stripped; missing optionals receive their defaults.
    const callOptions = kthCourseAgentCallOptionsSchema.parse({
      locale: body.locale,
      preferredDifficulty: body.preferredDifficulty,
    });

    await pipeAgentUIStreamToResponse({
      response: res,
      agent: kthCourseAgent,
      uiMessages: body.messages ?? [],
      options: callOptions,
    });
  }
}
