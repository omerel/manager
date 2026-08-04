"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { emailRun, type EmailState } from "@/lib/chat-actions";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Send an answer to the asker's own address.
 *
 * A client island because the outcome belongs next to the button that was
 * pressed: a send that failed and says nothing is worse than no button at all,
 * since the user walks away believing the report went out.
 */
export function EmailRunButton({ runId }: { runId: string }) {
  const [state, formAction] = useActionState<EmailState, FormData>(emailRun, {});

  return (
    <span className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="runId" value={runId} />
        <SubmitButton
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
          pendingText="שולח…"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          שלח למייל
        </SubmitButton>
      </form>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span>
      )}
    </span>
  );
}
