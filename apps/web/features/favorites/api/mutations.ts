"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/lib/user";
import { useTRPC } from "@/trpc/client";

/**
 * Saves or unsaves a course. The caller says which state it wants, because the
 * server has no toggle: `saved.save` and `saved.unsave` are separate and
 * idempotent.
 */
export function useSetCourseSaved() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const meKey = trpc.user.me.queryKey();

  const save = useMutation(trpc.saved.save.mutationOptions());
  const unsave = useMutation(trpc.saved.unsave.mutationOptions());

  async function setSaved(courseCode: string, saved: boolean) {
    await queryClient.cancelQueries({ queryKey: meKey });
    const previous = queryClient.getQueryData<Me | null>(meKey);
    if (previous) {
      queryClient.setQueryData<Me>(meKey, {
        ...previous,
        savedCourseCodes: saved
          ? [...new Set([...previous.savedCourseCodes, courseCode])]
          : previous.savedCourseCodes.filter((code) => code !== courseCode),
      });
    }

    try {
      await (saved ? save : unsave).mutateAsync({ courseCode });
    } catch (error) {
      if (previous !== undefined) {
        queryClient.setQueryData(meKey, previous);
      }
      throw error;
    } finally {
      queryClient.invalidateQueries({ queryKey: meKey });
    }
  }

  return {
    setSaved,
    isPending: save.isPending || unsave.isPending,
  };
}
