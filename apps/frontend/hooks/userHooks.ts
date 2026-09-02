"use client";

import { useSelector } from "react-redux";
import type { RootState } from "../state/store";

export function useUser() {
  return useSelector((state: RootState) => state.user);
}
