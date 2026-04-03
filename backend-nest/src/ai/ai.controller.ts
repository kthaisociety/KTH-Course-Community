import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import { streamText, type UIMessage } from "ai";
import type { Response } from "express";
import { AiService } from "./ai.service";

interface ChatRequestBody {
  messages: UIMessage[];
}

/**
 * Example AI chat endpoint demonstrating Vercel AI SDK + AI Gateway usage.
 *
 * POST /ai/chat
 * Body: { messages: UIMessage[] }
 *
 * Returns a UI message stream compatible with the AI SDK's `useChat` hook.
 * The frontend can point useChat at the Next.js proxy route /api/ai/chat
 * which forwards here.
 *
 * streamText is called directly in the controller to avoid TS4053:
 * its return type contains an un-nameable Output generic from the ai package
 * that cannot appear on public methods of exported NestJS service classes.
 */
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("chat")
  @HttpCode(200)
  async chat(@Body() body: ChatRequestBody, @Res() res: Response) {
    const modelMessages = await this.aiService.toModelMessages(
      body.messages ?? [],
    );

    const result = streamText({
      model: "openai/gpt-5.4-mini",
      messages: modelMessages,
    });

    result.pipeUIMessageStreamToResponse(res);
  }
}
