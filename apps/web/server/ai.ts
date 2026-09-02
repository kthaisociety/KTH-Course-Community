import { cosineSimilarity, embed, embedMany, gateway } from "ai";

const embeddingModel = gateway.embeddingModel("openai/text-embedding-3-small");

export async function embedSingle(
  value: string,
): Promise<{ embedding: number[]; usage: { tokens: number } }> {
  const { embedding, usage } = await embed({
    model: embeddingModel,
    value,
  });
  return { embedding, usage };
}

export async function embedBatch(
  values: string[],
): Promise<{ embeddings: number[][]; usage: { tokens: number } }> {
  const { embeddings, usage } = await embedMany({
    model: embeddingModel,
    values,
  });
  return { embeddings, usage };
}

export function similarity(a: number[], b: number[]): number {
  return cosineSimilarity(a, b);
}
