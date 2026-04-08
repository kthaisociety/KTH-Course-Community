/**
 * Shared type definitions for the KTH Course Community AI agent.
 *
 * These types mirror the tool schemas defined in
 * `backend-nest/src/ai/tools.ts` and the agent in
 * `backend-nest/src/ai/kth-course-agent.ts`.
 *
 * They are kept here so the frontend can import them without pulling in the
 * NestJS backend as a dependency.
 *
 * Usage in a Next.js component:
 *   import { useChat } from "@ai-sdk/react";
 *   import type { KthCourseAgentUIMessage } from "@/types/ai/kth-course-agent";
 *
 *   const { messages } = useChat<KthCourseAgentUIMessage>({ ... });
 */

import type { UIMessage } from "ai";

// ── Tool input / output shapes ────────────────────────────────────────────────

export interface KthCourse {
  code: string;
  name: string;
}

/**
 * UITools-compatible record that maps tool names to their input/output types.
 * Pass this as the third generic to `UIMessage` to get typed tool parts.
 */
export type KthCourseAgentUITools = {
  retrieveKthCourses: {
    input: { topic: string };
    output: { topic: string; courses: KthCourse[] };
  };
  getWeather: {
    input: { city: string };
    output: { city: string; temperature: number; condition: string };
  };
};

/**
 * Typed UIMessage for the KTH Course Community agent.
 *
 * Use as the generic parameter for `useChat<KthCourseAgentUIMessage>()` to get
 * type-safe access to `tool-retrieveKthCourses` and `tool-getWeather` parts.
 */
export type KthCourseAgentUIMessage = UIMessage<
  unknown,
  // no custom data parts
  Record<string, never>,
  KthCourseAgentUITools
>;
