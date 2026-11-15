"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "td-local-value";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// A value kept in this browser's localStorage, shared by every component that
// reads the same key, and null while rendering on the server.
export function useLocalValue(key: string): [string | null, (value: string | null) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const handle = (event: Event) => {
      if (event instanceof StorageEvent ? event.key === key : (event as CustomEvent).detail === key) {
        onChange();
      }
    };
    window.addEventListener("storage", handle);
    window.addEventListener(EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(EVENT, handle);
    };
  }, [key]);

  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );

  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, next);
        }
      } catch {
        // Private browsing or storage full: nothing is kept.
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );

  return [value, set];
}
