import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

/**
 * Retrieve relevant KTH courses for a given topic.
 * In a real app this would query a database / search index.
 */
export const retrieveKthCoursesTool = tool({
  description:
    "Retrieve relevant KTH courses for a given topic. Use this whenever the user asks about courses, subjects, or study programmes at KTH.",
  inputSchema: z.object({
    topic: z.string().describe("The subject or topic to find KTH courses for"),
  }),
  execute: async ({ topic }) => {
    // TODO: replace with a real KTH course search
    return {
      topic,
      courses: [
        { code: "DD2352", name: "Algorithms and Complexity" },
        { code: "ID2201", name: "Distributed Systems" },
        { code: "DD2421", name: "Machine Learning" },
      ],
    };
  },
});

/**
 * Get the current weather for a location (demo tool).
 */
export const getWeatherTool = tool({
  description: "Get the current weather for a given city.",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
  execute: async ({ city }) => ({
    city,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
    condition: "partly cloudy",
  }),
});

// ── Exported invocation types for type-safe UI rendering ──────────────────────

export type RetrieveKthCoursesInvocation = UIToolInvocation<
  typeof retrieveKthCoursesTool
>;
export type GetWeatherInvocation = UIToolInvocation<typeof getWeatherTool>;
