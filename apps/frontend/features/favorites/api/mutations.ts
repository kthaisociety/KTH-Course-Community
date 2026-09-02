"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/lib/user";
import { useTRPC } from "@/trpc/client";

export function useFavoriteMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const meKey = trpc.user.me.queryKey();

  return {
    toggle: () =>
      trpc.user.toggleFavorite.mutationOptions({
        onMutate: async ({ courseCode }) => {
          await queryClient.cancelQueries({ queryKey: meKey });
          const previous = queryClient.getQueryData<Me | null>(meKey);
          if (previous) {
            const has = previous.userFavorites.includes(courseCode);
            queryClient.setQueryData<Me>(meKey, {
              ...previous,
              userFavorites: has
                ? previous.userFavorites.filter((code) => code !== courseCode)
                : [...previous.userFavorites, courseCode],
            });
          }
          return { previous };
        },
        onError: (_err, _input, context) => {
          if (context?.previous !== undefined) {
            queryClient.setQueryData(meKey, context.previous);
          }
        },
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: meKey });
        },
      }),
  };
}

export function useToggleFavorite() {
  const favorites = useFavoriteMutations();
  return useMutation(favorites.toggle());
}
