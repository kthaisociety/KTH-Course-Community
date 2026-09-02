"use client";

import { useEffect, useState } from "react";

export function useDebouncedQuery(value: string, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return [debounced, setDebounced] as const;
}
