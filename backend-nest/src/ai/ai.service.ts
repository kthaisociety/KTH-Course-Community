import { Injectable } from "@nestjs/common";
import { convertToModelMessages, type UIMessage } from "ai";

@Injectable()
export class AiService {
  /**
   * Convert UI messages to model messages for use with streamText.
   * Call this before streamText in the controller.
   *
   * The `AI_GATEWAY_API_KEY` environment variable is picked up automatically
   * by the AI SDK's default global gateway provider.
   *
   * Model string format: "<provider>/<model-id>"
   * Examples:
   *   "openai/gpt-5.4"
   *   "anthropic/claude-sonnet-4.5"
   *   "google/gemini-2.5-pro"
   */
  toModelMessages(messages: UIMessage[]) {
    return convertToModelMessages(messages);
  }
}
