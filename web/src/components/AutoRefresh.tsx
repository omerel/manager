"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While rendered, refreshes the page every `ms` so a RUNNING job's result
 * appears on its own. The server stops rendering this component once the job
 * completes, which stops the polling. Capped as a safety net.
 */
export function AutoRefresh({ ms = 3000, maxTicks = 220 }: { ms?: number; maxTicks?: number }) {
  const router = useRouter();
  useEffect(() => {
    let ticks = 0;
    const id = setInterval(() => {
      if (++ticks > maxTicks) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms, maxTicks]);
  return null;
}
