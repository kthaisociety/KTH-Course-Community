import { Injectable } from "@nestjs/common";
import { cosineSimilarity, embed, embedMany, gateway } from "ai";

/**
 * AiService — AI utility methods for the KTH Course Community backend.
 *
 * Uses the Vercel AI Gateway (default global provider) for all model calls.
 * The `AI_GATEWAY_API_KEY` environment variable is picked up automatically
 * by the AI SDK.
 *
 * Model string format: "<provider>/<model-id>"
 * Examples:
 *   "openai/gpt-5-mini"
 *   "anthropic/claude-sonnet-4.5"
 *   "google/gemini-2.5-pro"
 */
@Injectable()
export class AiService {
  private readonly embeddingModel = gateway.embeddingModel(
    "openai/text-embedding-3-small",
  );

  /**
   * Embed a single string value.
   * Returns the embedding vector (number[]) and token usage.
   *
   * Example:
   *   const { embedding, usage } = await aiService.embedSingle("machine learning");
   */
  async embedSingle(value: string) {
    const { embedding, usage } = await embed({
      model: this.embeddingModel,
      value,
    });
    return { embedding, usage };
  }

  /**
   * Embed many string values in a single batch request.
   * Returns embeddings sorted in the same order as the input values.
   *
   * Example:
   *   const { embeddings, usage } = await aiService.embedBatch([
   *     "machine learning",
   *     "deep learning",
   *     "natural language processing",
   *   ]);
   */
  async embedBatch(values: string[]) {
    const { embeddings, usage } = await embedMany({
      model: this.embeddingModel,
      values,
    });
    return { embeddings, usage };
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   * Returns a value between -1 (opposite) and 1 (identical).
   *
   * Example:
   *   const { embeddings } = await aiService.embedBatch(["cat", "dog"]);
   *   const similarity = aiService.similarity(embeddings[0], embeddings[1]);
   */
  similarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }
}
