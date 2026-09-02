"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { type Me, toggleUserFavorite } from "@/lib/user";

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleUserFavorite,
    onMutate: async (courseCode: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me });
      const previous = queryClient.getQueryData<Me | null>(queryKeys.me);
      if (previous) {
        const has = previous.userFavorites.includes(courseCode);
        queryClient.setQueryData<Me>(queryKeys.me, {
          ...previous,
          userFavorites: has
            ? previous.userFavorites.filter((code) => code !== courseCode)
            : [...previous.userFavorites, courseCode],
        });
      }
      return { previous };
    },
    onError: (_err, _courseCode, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.me, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
