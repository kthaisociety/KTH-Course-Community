"use client";

import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSessionData } from "@/hooks/sessionHooks";
import { toggleUserFavorite } from "@/lib/user";
import type { Dispatch, RootState } from "@/state/store";
import { toggleFavoriteSuccess } from "@/state/user/userSlice";
import { fetchFavorites } from "@/state/user/userThunk";

/**
 * The single entry point for the signed-in user's favorite courses.
 *
 * Redux is the shared cache here only so the list survives navigation between
 * /search, /favorites and /profile. When TanStack Query lands this becomes a
 * `useQuery` + `useMutation` pair and no caller has to change.
 */
export function useFavorites() {
  const dispatch = useDispatch<Dispatch>();
  const { isAuthenticated } = useSessionData();
  const favorites = useSelector((s: RootState) => s.user.userFavorites);
  const status = useSelector((s: RootState) => s.user.status);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchFavorites());
  }, [isAuthenticated, dispatch]);

  const toggle = useCallback(
    async (courseCode: string) => {
      const res = await toggleUserFavorite(courseCode);
      dispatch(toggleFavoriteSuccess({ courseCode, action: res.action }));
      return res;
    },
    [dispatch],
  );

  return { favorites, isLoading: status !== "ready", toggle };
}
