"use client";

import { useEffect } from "react";

export function TaskReloader({ onLoad }: { onLoad: (tasks: unknown[]) => void }) {
  useEffect(() => {
    void fetch("/api/tasks", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.tasks)) onLoad(payload.tasks);
      })
      .catch(() => undefined);
  }, [onLoad]);
  return null;
}
