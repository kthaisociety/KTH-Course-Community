import { type InferAgentUIMessage, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getWeatherTool, retrieveKthCoursesTool } from "./tools";

/**
 * Call-options schema — validated at runtime and type-checked by TypeScript.
 *
 * Pass these in the request body alongside `messages` to influence how the
 * agent behaves for a specific call.
 *
 * Example body:
 *   { messages: [...], locale: "en", preferredDifficulty: "advanced" }
 */
export const kthCourseAgentCallOptionsSchema = z.object({
  /** ISO-639 locale, used to tailor the language of course descriptions. */
  locale: z.string().optional().default("en"),
  /** Preferred course difficulty: filter or highlight in system instructions. */
  preferredDifficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional(),
});

export type KthCourseAgentCallOptions = z.infer<
  typeof kthCourseAgentCallOptionsSchema
>;

/**
 * KTH Course Community agent.
 *
 * Uses `ToolLoopAgent` so the model can call tools multiple times in a loop
 * (up to the default 20 steps) before delivering a final answer.
 *
 * `callOptionsSchema` + `prepareCall` demonstrate how to dynamically adapt
 * the agent's system instructions and active tool set at call time.
 */
export const kthCourseAgent = new ToolLoopAgent({
  model: "openai/gpt-5.4-mini",
  instructions:
    "You are a helpful KTH Course Community assistant. Help students find courses, understand curricula, and plan their studies at KTH Royal Institute of Technology.",
  tools: {
    retrieveKthCourses: retrieveKthCoursesTool,
    getWeather: getWeatherTool,
  },
  callOptionsSchema: kthCourseAgentCallOptionsSchema,
  /**
   * prepareCall — runs once per `.stream()` / `.generate()` call before the
   * agent loop starts.  Use it to inject per-request context that is not
   * available at construction time (user locale, feature flags, fetched data…).
   */
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions:
      settings.instructions +
      `\n\nCall context:\n- Response language: ${options.locale ?? "en"}${
        options.preferredDifficulty
          ? `\n- Preferred difficulty: ${options.preferredDifficulty} (highlight courses at this level when relevant)`
          : ""
      }`,
  }),
});

/**
 * Inferred UIMessage type — import this in your frontend for end-to-end
 * type safety when rendering tool invocation parts with `useChat`.
 */
export type KthCourseAgentUIMessage = InferAgentUIMessage<
  typeof kthCourseAgent
>;
